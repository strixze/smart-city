import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
// Attach L to window so leaflet.heat plugin binds to Leaflet instance
if (typeof window !== "undefined") {
  window.L = L;
}
import "leaflet.heat";
import { complaintApi } from "../../api/client";
import {
  MapPin,
  Layers,
  Flame,
  Filter,
  RefreshCw,
  Search,
  ExternalLink,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  X,
  Maximize2,
  Minimize2,
  Info,
  Loader2
} from "lucide-react";
import dayjs from "dayjs";
import toast from "react-hot-toast";

export const CATEGORIES_WITH_SUBCATEGORIES = {
  "Waste Management": [
    "Garbage Dump",
    "Overflowing Dustbin",
    "Illegal Waste Disposal"
  ],
  "Roads": [
    "Pothole",
    "Damaged Road",
    "Broken Footpath"
  ],
  "Drainage": [
    "Blocked Drain",
    "Drainage Overflow",
    "Sewage Leakage"
  ],
  "Water Supply": [
    "Water Leakage",
    "Pipeline Damage",
    "Water Supply Issue"
  ],
  "Street Light": [
    "Street Light Not Working",
    "Street Light Damaged",
    "Street Light Missing",
    "Street Light Flickering",
    "Street Light Pole Damaged",
    "Multiple Street Lights Not Working"
  ],
  "Street Infrastructure": [
    "Broken Street Light",
    "Damaged Traffic Signal",
    "Damaged Sign Board"
  ],
  "Public Property": [
    "Damaged Bench",
    "Damaged Park Equipment",
    "Vandalism"
  ],
  "Other": [
    "General Issue",
    "Other"
  ]
};

// Custom colored SVG pin markers for Leaflet
const createPinIcon = (color = "#EF4444", status = "SUBMITTED") => {
  return L.divIcon({
    className: "custom-hotspot-pin",
    html: `
      <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.15s ease;">
        <div style="width: 26px; height: 26px; border-radius: 9999px; background-color: ${color}; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.25); border: 2px solid white;">
          <div style="width: 8px; height: 8px; border-radius: 9999px; background-color: white;"></div>
        </div>
        <div style="position: absolute; bottom: 0; left: 50%; transform: translateX(-50%) rotate(45deg); width: 6px; height: 6px; background-color: ${color}; margin-bottom: 2px;"></div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
  });
};

export const HotspotMap = ({
  height = "520px",
  initialRole = "ADMIN",
  showStatsHeader = true,
  isFullScreenMode = false
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersLayerRef = useRef(null);
  const heatLayerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    markers: [],
    heatmapPoints: [],
    stats: { categories: {}, statuses: {}, priorities: {} },
    role: initialRole
  });

  // Layer Visibility Mode: "HYBRID" (both), "HEATMAP", "MARKERS"
  const [viewMode, setViewMode] = useState("HYBRID");

  // Filters State
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedSubcategory, setSelectedSubcategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedPriority, setSelectedPriority] = useState("ALL");
  const [dateRange, setDateRange] = useState("ALL"); // "ALL", "TODAY", "WEEK", "MONTH"
  const [showFiltersPanel, setShowFiltersPanel] = useState(true);

  // Fetch Hotspot Data
  const fetchHotspots = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedCategory !== "ALL") params.category = selectedCategory;
      if (selectedSubcategory !== "ALL") params.subcategory = selectedSubcategory;
      if (selectedStatus !== "ALL") params.status = selectedStatus;
      if (selectedPriority !== "ALL") params.priority = selectedPriority;

      // Date range filtering
      if (dateRange === "TODAY") {
        params.startDate = dayjs().startOf("day").toISOString();
      } else if (dateRange === "WEEK") {
        params.startDate = dayjs().subtract(7, "day").startOf("day").toISOString();
      } else if (dateRange === "MONTH") {
        params.startDate = dayjs().subtract(30, "day").startOf("day").toISOString();
      }

      const res = await complaintApi.getHotspots(params);
      if (res.data?.data) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error("[HotspotMap] Error loading hotspots:", err);
      toast.error("Failed to load complaint hotspot map data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHotspots();
  }, [selectedCategory, selectedSubcategory, selectedStatus, selectedPriority, dateRange]);

  // Reset Subcategory if Category changes
  useEffect(() => {
    setSelectedSubcategory("ALL");
  }, [selectedCategory]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const defaultCenter = [18.5204, 73.8567]; // Municipal center
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 12,
        zoomControl: false,
        attributionControl: true
      });

      // Add Zoom Control to top-right
      L.control.zoom({ position: "topright" }).addTo(map);

      // OpenStreetMap Layer
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      // Initialize Layer Groups
      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        heatLayerRef.current = null;
      }
    };
  }, []);

  // Update Layers (Heatmap & Markers) when data or viewMode updates
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Clear existing markers
    if (markersLayerRef.current) {
      markersLayerRef.current.clearLayers();
    }

    // 2. Clear existing heatmap
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    const showMarkers = viewMode === "MARKERS" || viewMode === "HYBRID";
    const showHeatmap = viewMode === "HEATMAP" || viewMode === "HYBRID";

    // Add Heatmap Layer
    if (showHeatmap && data.heatmapPoints?.length > 0) {
      try {
        const heat = L.heatLayer(data.heatmapPoints, {
          radius: 28,
          blur: 18,
          maxZoom: 16,
          max: 1.0,
          gradient: {
            0.2: "#3B82F6", // Blue
            0.4: "#10B981", // Green
            0.6: "#FBBF24", // Yellow
            0.8: "#F97316", // Orange
            1.0: "#EF4444"  // Red (highest concentration)
          }
        }).addTo(map);
        heatLayerRef.current = heat;
      } catch (err) {
        console.warn("[HotspotMap] HeatLayer initialization error:", err);
      }
    }

    // Add Marker Pins
    if (showMarkers && data.markers?.length > 0 && markersLayerRef.current) {
      const bounds = [];

      data.markers.forEach((item) => {
        if (!item.lat || !item.lng) return;

        bounds.push([item.lat, item.lng]);

        // Priority / Status based color
        let pinColor = "#3B82F6"; // default blue
        if (item.priority === "CRITICAL") pinColor = "#EF4444"; // red
        else if (item.priority === "HIGH") pinColor = "#F97316"; // orange
        else if (item.status === "RESOLVED") pinColor = "#10B981"; // green
        else if (item.status === "IN_PROGRESS") pinColor = "#EAB308"; // amber
        else if (item.category === "Water Supply") pinColor = "#06B6D4"; // cyan
        else if (item.category === "Drainage") pinColor = "#8B5CF6"; // purple
        else if (item.category === "Waste Management") pinColor = "#10B981"; // green

        const marker = L.marker([item.lat, item.lng], {
          icon: createPinIcon(pinColor, item.status)
        });

        // Rich HTML Popup
        const detailLink = `/admin/complaints/${item._id}`;
        const popupContent = `
          <div style="font-family: inherit; font-size: 12px; line-height: 1.4; color: #0F172A; min-width: 200px; padding: 2px;">
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px; margin-bottom: 6px;">
              <span style="font-weight: 800; font-size: 13px; color: #0D9488;">#${item.complaintNumber}</span>
              <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 9999px; background: ${
                item.priority === "CRITICAL" ? "#FEE2E2; color: #991B1B;" :
                item.priority === "HIGH" ? "#FFEDD5; color: #9A3412;" : "#F1F5F9; color: #475569;"
              }">${item.priority}</span>
            </div>
            <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px; color: #1E293B;">${item.title || "Civic Complaint"}</div>
            <div style="font-size: 11px; color: #64748B; margin-bottom: 6px;">
              <strong>${item.category}</strong>${item.subcategory ? ` &bull; ${item.subcategory}` : ""}
            </div>
            <div style="font-size: 11px; color: #475569; margin-bottom: 8px;">
              📍 ${item.locationAddress || "Location Point"}
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #F1F5F9; pt-2; font-size: 11px;">
              <span style="padding: 2px 6px; border-radius: 6px; font-weight: 600; background: #F8FAFC; color: #334155;">${item.status}</span>
              <a href="${detailLink}" style="color: #0D9488; font-weight: 700; text-decoration: none; display: flex; align-items: center; gap: 2px;">
                View Details &rarr;
              </a>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent, { maxWidth: 280 });
        markersLayerRef.current.addLayer(marker);
      });

      // Fit map to markers bounds if valid
      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      }
    }
  }, [data, viewMode]);

  // Center on User's Current Location
  const handleCenterOnUser = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([pos.coords.latitude, pos.coords.longitude], 15);
          toast.success("Centered on your current location.");
        }
      },
      () => toast.error("Could not obtain GPS location.")
    );
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSelectedCategory("ALL");
    setSelectedSubcategory("ALL");
    setSelectedStatus("ALL");
    setSelectedPriority("ALL");
    setDateRange("ALL");
  };

  const availableSubcategories =
    selectedCategory !== "ALL" && CATEGORIES_WITH_SUBCATEGORIES[selectedCategory]
      ? CATEGORIES_WITH_SUBCATEGORIES[selectedCategory]
      : [];

  // Top category computation
  const topCategory = Object.entries(data.stats.categories || {}).sort((a, b) => b[1] - a[1])[0];
  const criticalCount = (data.stats.priorities?.CRITICAL || 0) + (data.stats.priorities?.HIGH || 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
      {/* ─────────────────────────────────────────────────────────
          HEADER & KPI METRICS RIBBON
         ───────────────────────────────────────────────────────── */}
      {showStatsHeader && (
        <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/60">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
                  <Flame className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Civic Hotspot Density Map
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Live Geo Feed" />
                  </h3>
                  <p className="text-xs text-slate-500">
                    Real-time spatial visualization of complaints, cluster density, and field response zones
                  </p>
                </div>
              </div>
            </div>

            {/* Quick KPI badges */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs">
                <span className="text-slate-500">Mapped Issues: </span>
                <span className="font-bold text-slate-900">{data.total || 0}</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                <span className="text-rose-600 font-medium">Critical/High: </span>
                <span className="font-bold">{criticalCount}</span>
              </div>
              {topCategory && (
                <div className="px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs">
                  <span className="text-teal-600 font-medium">Top Cluster: </span>
                  <span className="font-bold">{topCategory[0]} ({topCategory[1]})</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          CONTROLS TOOLBAR
         ───────────────────────────────────────────────────────── */}
      <div className="p-3 sm:px-5 border-b border-slate-200/80 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Layer Mode Switch */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setViewMode("HYBRID")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              viewMode === "HYBRID"
                ? "bg-white text-teal-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Hybrid View
          </button>
          <button
            type="button"
            onClick={() => setViewMode("HEATMAP")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === "HEATMAP"
                ? "bg-white text-orange-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            Heatmap Only
          </button>
          <button
            type="button"
            onClick={() => setViewMode("MARKERS")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === "MARKERS"
                ? "bg-white text-teal-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Pins Only
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              showFiltersPanel
                ? "bg-teal-50 border-teal-200 text-teal-800"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>

          <button
            type="button"
            onClick={handleCenterOnUser}
            title="Center on my location"
            className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all cursor-pointer"
          >
            <MapPin className="w-4 h-4 text-teal-600" />
          </button>

          <button
            type="button"
            onClick={fetchHotspots}
            disabled={loading}
            title="Refresh hotspots data"
            className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────
          COLLAPSIBLE FILTERS PANEL
         ───────────────────────────────────────────────────────── */}
      {showFiltersPanel && (
        <div className="p-3 sm:px-5 bg-slate-50/80 border-b border-slate-200/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
          {/* Main Category */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-teal-600 font-medium"
            >
              <option value="ALL">All Categories</option>
              {Object.keys(CATEGORIES_WITH_SUBCATEGORIES).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategory */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Subcategory
            </label>
            <select
              value={selectedSubcategory}
              onChange={(e) => setSelectedSubcategory(e.target.value)}
              disabled={selectedCategory === "ALL"}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-teal-600 font-medium disabled:opacity-50"
            >
              <option value="ALL">All Subcategories</option>
              {availableSubcategories.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-teal-600 font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">SUBMITTED</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Priority
            </label>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-teal-600 font-medium"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>

          {/* Date Range & Reset */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Date Range
              </label>
              {(selectedCategory !== "ALL" ||
                selectedStatus !== "ALL" ||
                selectedPriority !== "ALL" ||
                dateRange !== "ALL") && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[10px] text-teal-600 hover:underline font-semibold cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-teal-600 font-medium"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today Only</option>
              <option value="WEEK">Last 7 Days</option>
              <option value="MONTH">Last 30 Days</option>
            </select>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────
          MAP CONTAINER
         ───────────────────────────────────────────────────────── */}
      <div className="relative w-full" style={{ height }}>
        <div ref={mapContainerRef} style={{ height: "100%", width: "100%" }} />

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs z-[1000] flex items-center justify-center gap-2 text-xs font-semibold text-teal-700">
            <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
            <span>Updating Hotspot Clusters...</span>
          </div>
        )}

        {/* Legend Overlay at Bottom-Left */}
        <div className="absolute bottom-4 left-4 z-[900] bg-white/95 backdrop-blur-xs p-3 rounded-xl border border-slate-200 shadow-md text-[11px] space-y-1.5 pointer-events-auto">
          <div className="font-bold text-slate-900 flex items-center justify-between gap-4">
            <span>Density Scale</span>
            <span className="text-[10px] text-slate-400 font-normal">Leaflet.heat</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-24 h-2.5 rounded-full bg-gradient-to-r from-blue-500 via-emerald-500 via-amber-400 via-orange-500 to-red-500" />
            <span className="text-[10px] text-slate-500">Low &rarr; High</span>
          </div>
          <div className="flex items-center gap-3 pt-1 text-[10px] text-slate-600 border-t border-slate-100">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Critical
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Medium
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Resolved
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HotspotMap;

