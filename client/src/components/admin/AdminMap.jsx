import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  MapPin,
  Plus,
  Minus,
  Navigation,
  AlertCircle,
  Clock,
  CheckCircle2,
  Maximize2,
  X
} from "lucide-react";

export const AdminMap = ({ stats = {}, complaints = [] }) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedPin, setSelectedPin] = useState(null);
  const [showFullMapModal, setShowFullMapModal] = useState(false);

  // Live counts derived from stats with fallbacks
  const openCount = (stats.submitted || 0) + (stats.underReview || 0) + (stats.assigned || 0);
  const inProgressCount = stats.inProgress || 0;
  const unassignedCount = stats.submitted || 0;
  const resolvedCount = stats.resolved || 0;

  // City Zones matching screenshot ("Riverview", "Oakwide", "Downtown", "Central District", "Oakwood Park", "Lakeside Park")
  const pins = [
    {
      id: "pin-1",
      x: 320,
      y: 190,
      zone: "Downtown Central District",
      status: "OPEN",
      color: "red",
      title: "Pothole on 4th & Main",
      category: "Roads",
      priority: "CRITICAL"
    },
    {
      id: "pin-2",
      x: 390,
      y: 240,
      zone: "Central District",
      status: "OPEN",
      color: "red",
      title: "Damaged Sign - Hwy 12",
      category: "Street Infrastructure",
      priority: "HIGH"
    },
    {
      id: "pin-3",
      x: 230,
      y: 235,
      zone: "Oakwide South",
      status: "IN_PROGRESS",
      color: "amber",
      title: "Broken Streetlight - Elm St",
      category: "Street Light",
      priority: "MEDIUM"
    },
    {
      id: "pin-4",
      x: 420,
      y: 245,
      zone: "Oakwood Park",
      status: "UNASSIGNED",
      color: "purple",
      title: "Graffiti on wall - Park Ave",
      category: "Public Property",
      priority: "LOW"
    },
    {
      id: "pin-5",
      x: 370,
      y: 95,
      zone: "Riverview East",
      status: "RESOLVED",
      color: "green",
      title: "Overflowing bin - Market St",
      category: "Waste Management",
      priority: "RESOLVED"
    },
    {
      id: "pin-6",
      x: 220,
      y: 195,
      zone: "Oakwide North",
      status: "OPEN",
      color: "red",
      title: "Water Leakage on Oak Rd",
      category: "Water Supply",
      priority: "HIGH"
    }
  ];

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 1.75));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.8));
  const handleResetZoom = () => setZoomLevel(1);

  return (
    <div id="live-map" className="bg-white rounded-2xl border border-[#E2E8F0] p-4 sm:p-5 shadow-xs flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
          <span>Live map</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Live GPS Sync" />
        </h3>
        <button
          type="button"
          onClick={() => setShowFullMapModal(true)}
          className="text-xs font-semibold text-[#0D9488] hover:text-[#0f766e] hover:underline"
        >
          View full map
        </button>
      </div>

      {/* Map Canvas Frame */}
      <div className="relative w-full h-[270px] sm:h-[300px] rounded-xl overflow-hidden border border-[#E2E8F0] bg-[#F1F5F9] select-none">
        {/* Transform container for zoom */}
        <div
          className="w-full h-full transition-transform duration-200 origin-center"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <svg viewBox="0 0 500 320" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
            <defs>
              {/* Subtle grid pattern for city streets */}
              <pattern id="street-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E2E8F0" strokeWidth="1" />
              </pattern>
              {/* Park green pattern */}
              <linearGradient id="park-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#DCFCE7" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#BBF7D0" stopOpacity="0.6" />
              </linearGradient>
            </defs>

            {/* City Base Ground */}
            <rect width="500" height="320" fill="#F8FAFC" />
            <rect width="500" height="320" fill="url(#street-grid)" />

            {/* Lakeside Park Area (bottom-left) */}
            <path
              d="M 60 220 C 100 210, 160 220, 180 270 C 190 295, 140 320, 60 320 Z"
              fill="url(#park-grad)"
              stroke="#86EFAC"
              strokeWidth="1"
            />
            {/* Oakwood Park Area (mid-right) */}
            <path
              d="M 410 180 C 450 180, 480 200, 500 220 L 500 280 C 470 290, 420 280, 400 240 Z"
              fill="url(#park-grad)"
              stroke="#86EFAC"
              strokeWidth="1"
            />

            {/* Major Arterial Roads */}
            <line x1="0" y1="90" x2="500" y2="120" stroke="#CBD5E1" strokeWidth="3" />
            <line x1="0" y1="210" x2="500" y2="170" stroke="#CBD5E1" strokeWidth="3" />
            <line x1="120" y1="0" x2="160" y2="320" stroke="#CBD5E1" strokeWidth="2.5" />
            <line x1="280" y1="0" x2="260" y2="320" stroke="#CBD5E1" strokeWidth="3.5" />
            <line x1="420" y1="0" x2="400" y2="320" stroke="#CBD5E1" strokeWidth="2.5" />

            {/* Curving Blue River flowing across the city */}
            <path
              d="M 330 0 C 340 50, 400 80, 430 140 C 460 200, 380 250, 320 280 C 270 305, 230 320, 200 320 L 250 320 C 290 320, 340 300, 380 260 C 450 200, 490 150, 450 90 C 420 40, 380 10, 370 0 Z"
              fill="#BFDBFE"
              opacity="0.8"
            />
            <path
              d="M 350 0 C 360 45, 410 75, 440 135 C 470 195, 390 245, 330 275 C 280 300, 240 320, 215 320"
              fill="none"
              stroke="#60A5FA"
              strokeWidth="2"
              strokeDasharray="4 3"
              opacity="0.7"
            />

            {/* Bridges over the River */}
            <rect x="405" y="105" width="22" height="6" fill="#64748B" rx="1.5" transform="rotate(-30 415 108)" />
            <rect x="365" y="240" width="24" height="6" fill="#64748B" rx="1.5" transform="rotate(35 377 243)" />

            {/* Neighborhood / District Labels matching reference */}
            <text x="60" y="70" className="text-[11px] font-bold fill-[#64748B] select-none">
              Riverview
            </text>
            <text x="90" y="150" className="text-[11px] font-bold fill-[#64748B] select-none">
              Oakwide
            </text>
            <text x="310" y="165" textAnchor="middle" className="text-[12px] font-extrabold fill-[#334155] select-none tracking-tight">
              Downtown
            </text>
            <text x="310" y="180" textAnchor="middle" className="text-[10px] font-semibold fill-[#64748B] select-none">
              Central District
            </text>
            <text x="440" y="210" textAnchor="middle" className="text-[11px] font-bold fill-[#64748B] select-none">
              Oakwood Park
            </text>
            <text x="110" y="280" textAnchor="middle" className="text-[10px] font-semibold fill-[#64748B] select-none">
              Lakeside Park
            </text>
          </svg>

          {/* Interactive Status Pins overlayed matching Fixly screenshot */}
          {pins.map((pin) => {
            const isRed = pin.color === "red";
            const isAmber = pin.color === "amber";
            const isPurple = pin.color === "purple";
            const isGreen = pin.color === "green";

            const pinBg = isRed
              ? "bg-[#EF4444] text-white ring-4 ring-red-100"
              : isAmber
              ? "bg-[#F59E0B] text-white ring-4 ring-amber-100"
              : isPurple
              ? "bg-[#A855F7] text-white ring-4 ring-purple-100"
              : "bg-[#10B981] text-white ring-4 ring-emerald-100";

            return (
              <div
                key={pin.id}
                onClick={() => setSelectedPin(pin)}
                className="absolute cursor-pointer transition-transform duration-150 hover:scale-125 z-10 -ml-3.5 -mt-7"
                style={{
                  left: `${(pin.x / 500) * 100}%`,
                  top: `${(pin.y / 320) * 100}%`
                }}
                title={`${pin.title} (${pin.zone})`}
              >
                {/* SVG Pin with Drop Point */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shadow-md ${pinBg}`}>
                  {isRed ? (
                    <AlertCircle className="w-3.5 h-3.5" />
                  ) : isAmber ? (
                    <Clock className="w-3.5 h-3.5" />
                  ) : isGreen ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <div
                  className={`w-1.5 h-1.5 rotate-45 mx-auto -mt-1 ${
                    isRed
                      ? "bg-[#EF4444]"
                      : isAmber
                      ? "bg-[#F59E0B]"
                      : isPurple
                      ? "bg-[#A855F7]"
                      : "bg-[#10B981]"
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Selected Pin Tooltip Popup */}
        {selectedPin && (
          <div className="absolute top-3 left-3 right-3 sm:right-auto sm:w-64 bg-white/95 backdrop-blur-xs p-3 rounded-xl border border-[#E2E8F0] shadow-lg z-20 text-xs">
            <div className="flex items-center justify-between pb-1 mb-1 border-b border-[#F1F5F9]">
              <span className="font-bold text-[#0F172A] truncate">
                {selectedPin.title}
              </span>
              <button
                type="button"
                onClick={() => setSelectedPin(null)}
                className="text-[#94A3B8] hover:text-[#0F172A] p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <p className="text-[11px] text-[#64748B]">{selectedPin.zone}</p>
            <div className="flex items-center justify-between mt-2 pt-1">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  selectedPin.status === "OPEN"
                    ? "bg-rose-50 text-rose-700"
                    : selectedPin.status === "IN_PROGRESS"
                    ? "bg-amber-50 text-amber-700"
                    : selectedPin.status === "RESOLVED"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-purple-50 text-purple-700"
                }`}
              >
                {selectedPin.status}
              </span>
              <Link
                to="/admin/complaints"
                className="text-[11px] font-semibold text-[#0D9488] hover:underline"
              >
                Inspect &rarr;
              </Link>
            </div>
          </div>
        )}

        {/* Zoom Controls floating at bottom right matching reference */}
        <div className="absolute bottom-3 right-3 flex flex-col bg-white border border-[#E2E8F0] rounded-xl shadow-xs overflow-hidden z-20">
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] border-b border-[#E2E8F0] transition-colors"
            title="Zoom In"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] border-b border-[#E2E8F0] transition-colors"
            title="Zoom Out"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="p-1.5 hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] transition-colors"
            title="Center Map"
          >
            <Navigation className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Bottom Legend matching reference screenshot */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] font-semibold text-[#475569] mt-3 pt-3 border-t border-[#F1F5F9]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
          <span>{openCount} Open</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
          <span>{inProgressCount} In progress</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#A855F7]" />
          <span>{unassignedCount} Unassigned</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
          <span>{resolvedCount} Resolved</span>
        </div>
      </div>

      {/* Modal for "View full map" */}
      {showFullMapModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl max-w-4xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  Municipal Live Operations Map
                </h3>
                <p className="text-xs text-[#64748B]">
                  Real-time municipal grievance distribution across city wards and zones
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowFullMapModal(false)}
                className="p-2 text-[#64748B] hover:text-[#0F172A] rounded-xl hover:bg-[#F1F5F9]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="h-[460px] w-full rounded-2xl overflow-hidden border border-[#E2E8F0] bg-[#F8FAFC]">
              <div className="w-full h-full p-2">
                <svg viewBox="0 0 500 320" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                  <rect width="500" height="320" fill="#F8FAFC" />
                  <rect width="500" height="320" fill="url(#street-grid)" />
                  <path d="M 60 220 C 100 210, 160 220, 180 270 C 190 295, 140 320, 60 320 Z" fill="#BBF7D0" opacity="0.6" />
                  <path d="M 410 180 C 450 180, 480 200, 500 220 L 500 280 C 470 290, 420 280, 400 240 Z" fill="#BBF7D0" opacity="0.6" />
                  <path d="M 330 0 C 340 50, 400 80, 430 140 C 460 200, 380 250, 320 280 C 270 305, 230 320, 200 320 L 250 320 C 290 320, 340 300, 380 260 C 450 200, 490 150, 450 90 C 420 40, 380 10, 370 0 Z" fill="#BFDBFE" />
                  <text x="60" y="70" className="text-[12px] font-bold fill-[#64748B]">Riverview</text>
                  <text x="90" y="150" className="text-[12px] font-bold fill-[#64748B]">Oakwide</text>
                  <text x="310" y="165" textAnchor="middle" className="text-[14px] font-extrabold fill-[#0F172A]">Downtown Central District</text>
                  <text x="440" y="210" textAnchor="middle" className="text-[12px] font-bold fill-[#64748B]">Oakwood Park</text>
                  <text x="110" y="280" textAnchor="middle" className="text-[11px] font-semibold fill-[#64748B]">Lakeside Park</text>
                </svg>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-[#64748B]">
                Showing live GIS incidents mapped from active municipal complaints.
              </span>
              <button
                type="button"
                onClick={() => setShowFullMapModal(false)}
                className="px-4 py-2 bg-[#0F172A] text-white text-xs font-semibold rounded-xl hover:bg-slate-800"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMap;
