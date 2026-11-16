import React, { useState, useEffect, useRef } from "react";
import L from "leaflet";
import {
  MapPin,
  Compass,
  CheckCircle2,
  AlertCircle,
  Search,
  Loader2,
  Navigation,
  Crosshair,
  RefreshCw,
  Info
} from "lucide-react";
import toast from "react-hot-toast";

// Create custom SVG marker icon to prevent broken asset URLs in bundled environments
const createCustomMarkerIcon = (color = "#0D9488") => {
  return L.divIcon({
    className: "custom-leaflet-marker",
    html: `
      <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
        <span style="position: absolute; width: 36px; height: 36px; border-radius: 9999px; background-color: ${color}; opacity: 0.25; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <div style="width: 32px; height: 32px; border-radius: 9999px; background-color: ${color}; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -2px rgba(0, 0, 0, 0.1); border: 2.5px solid white;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36]
  });
};

export const ComplaintLocationPicker = ({
  initialLatitude = null,
  initialLongitude = null,
  initialAddress = "",
  onLocationChange,
  onLocationConfirm,
  isConfirmed = false
}) => {
  // Center coordinates (defaults to municipal city center or initial coordinates)
  const defaultCenter = [
    initialLatitude || 18.5204,
    initialLongitude || 73.8567
  ];

  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const [coords, setCoords] = useState({
    latitude: initialLatitude,
    longitude: initialLongitude
  });
  const [address, setAddress] = useState(initialAddress);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [confirmed, setConfirmed] = useState(isConfirmed || Boolean(initialLatitude && initialLongitude));
  const [gpsError, setGpsError] = useState(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: initialLatitude && initialLongitude ? 16 : 13,
        zoomControl: true,
        attributionControl: true
      });

      // Add OpenStreetMap Tile Layer
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;

      // Click on map to place/move marker
      map.on("click", (e) => {
        const { lat, lng } = e.latlng;
        handlePositionSelected(lat, lng, true);
      });

      // If initial coordinates exist, place marker
      if (initialLatitude && initialLongitude) {
        placeOrMoveMarker(initialLatitude, initialLongitude);
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Update marker placement on map
  const placeOrMoveMarker = (lat, lng) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!markerRef.current) {
      const marker = L.marker([lat, lng], {
        icon: createCustomMarkerIcon("#0D9488"),
        draggable: true,
        autoPan: true
      }).addTo(map);

      marker.on("dragend", (event) => {
        const newPos = event.target.getLatLng();
        handlePositionSelected(newPos.lat, newPos.lng, true);
      });

      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
  };

  // Reverse Geocoding with OpenStreetMap Nominatim
  const reverseGeocode = async (lat, lng) => {
    setIsGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      );
      if (!res.ok) throw new Error("Reverse geocode request failed");

      const data = await res.json();
      if (data && data.display_name) {
        const road = data.address?.road || data.address?.pedestrian || "";
        const suburb = data.address?.suburb || data.address?.neighbourhood || data.address?.residential || "";
        const city = data.address?.city || data.address?.town || data.address?.municipality || "";
        const formattedShort = [road, suburb, city].filter(Boolean).join(", ");

        const resolvedAddress = formattedShort || data.display_name;
        setAddress(resolvedAddress);
        return resolvedAddress;
      }
    } catch (err) {
      console.warn("[LocationPicker] Reverse geocode error:", err.message);
    } finally {
      setIsGeocoding(false);
    }
    const fallbackAddr = `Civic Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
    setAddress(fallbackAddr);
    return fallbackAddr;
  };

  // Handle selected position (from GPS, click, or drag)
  const handlePositionSelected = async (lat, lng, shouldReverseGeocode = true) => {
    setCoords({ latitude: lat, longitude: lng });
    setGpsError(null);
    setConfirmed(false); // Reset confirmed status so user confirms adjustment

    placeOrMoveMarker(lat, lng);

    let newAddress = address;
    if (shouldReverseGeocode) {
      newAddress = await reverseGeocode(lat, lng);
    }

    if (onLocationChange) {
      onLocationChange({
        latitude: lat,
        longitude: lng,
        address: newAddress
      });
    }
  };

  // Browser GPS Geolocation Handler
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      const msg = "Geolocation is not supported by your browser.";
      setGpsError(msg);
      toast.error(msg);
      return;
    }

    setIsLocating(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setIsLocating(false);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 17, { duration: 1.2 });
        }

        await handlePositionSelected(latitude, longitude, true);
        toast.success("GPS Location acquired successfully!");
      },
      (error) => {
        setIsLocating(false);
        let errorMsg = "Unable to retrieve your GPS location.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = "Location permission denied. Please click on the map to pinpoint your location.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = "GPS location unavailable. Please tap or click directly on the map.";
            break;
          case error.TIMEOUT:
            errorMsg = "GPS request timed out. Please try again or tap the map directly.";
            break;
        }
        setGpsError(errorMsg);
        toast.error(errorMsg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Search Address / Landmark via OpenStreetMap Nominatim
  const handleSearchLocation = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery.trim()
        )}&limit=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 16, { duration: 1.2 });
        }

        setAddress(data[0].display_name);
        await handlePositionSelected(lat, lng, false);
        toast.success("Location found on map!");
      } else {
        toast.error("Landmark or address not found. Please click on the map directly.");
      }
    } catch (err) {
      toast.error("Failed to search location. Please tap directly on the map.");
    } finally {
      setIsSearching(false);
    }
  };

  // Confirm Location Handler
  const handleConfirmLocation = () => {
    if (!coords.latitude || !coords.longitude) {
      toast.error("Please click on the map or use GPS to select a location first.");
      return;
    }
    if (!address.trim()) {
      toast.error("Please provide an address or landmark for the location.");
      return;
    }

    setConfirmed(true);
    toast.success("Complaint location confirmed!");
    if (onLocationConfirm) {
      onLocationConfirm({
        latitude: coords.latitude,
        longitude: coords.longitude,
        address: address.trim()
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        {/* GPS Button */}
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
          className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition-all disabled:opacity-60 flex-shrink-0 cursor-pointer"
        >
          {isLocating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Crosshair className="w-4 h-4" />
          )}
          <span>{isLocating ? "Acquiring GPS..." : "Use My Current Location"}</span>
        </button>

        {/* Search Landmark Bar */}
        <form onSubmit={handleSearchLocation} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search area, street, or municipal landmark..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600 focus:bg-white transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Search"}
          </button>
        </form>
      </div>

      {/* GPS Error Alert (if permission denied or unavailable) */}
      {gpsError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Map Interactive Canvas */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-slate-100">
        <div
          ref={mapContainerRef}
          style={{ height: "340px", width: "100%", zIndex: 1 }}
          className="cursor-crosshair"
        />

        {/* Map Overlay Instructions */}
        <div className="absolute top-3 right-3 z-[1000] bg-white/90 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs text-[11px] font-medium text-slate-700 flex items-center gap-1.5 pointer-events-none">
          <MapPin className="w-3.5 h-3.5 text-teal-600" />
          <span>Click anywhere or drag marker to adjust</span>
        </div>

        {/* Reverse Geocoding Loader */}
        {isGeocoding && (
          <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs text-[11px] font-semibold text-teal-700 flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
            <span>Resolving landmark address...</span>
          </div>
        )}
      </div>

      {/* Selected Location Card & Address Input */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 border border-teal-200 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800">Selected Civic Location</span>
              {coords.latitude && coords.longitude ? (
                <div className="text-[11px] font-mono text-teal-700">
                  {coords.latitude.toFixed(5)}° N, {coords.longitude.toFixed(5)}° E
                </div>
              ) : (
                <div className="text-[11px] text-slate-500">No point selected on map yet</div>
              )}
            </div>
          </div>

          {/* Confirmation Indicator / Button */}
          {coords.latitude && coords.longitude && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {confirmed ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Location Confirmed</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmLocation}
                  className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer w-full sm:w-auto justify-center"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirm Location</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Address / Landmark Edit Field */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
            Street Address / Nearby Landmark *
          </label>
          <input
            type="text"
            required
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setConfirmed(false);
              if (onLocationChange && coords.latitude && coords.longitude) {
                onLocationChange({
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  address: e.target.value
                });
              }
            }}
            placeholder="e.g. Near Bus Stand, Market Yard, Sector 4"
            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-600 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-0.5">
          <Info className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
          <span>Coordinates are automatically embedded in your complaint for rapid field response.</span>
        </div>
      </div>
    </div>
  );
};

export default ComplaintLocationPicker;

