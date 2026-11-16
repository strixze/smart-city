import React from "react";
import { Link } from "react-router-dom";
import HotspotMap from "./HotspotMap";
import { Flame, MapPin, ExternalLink } from "lucide-react";

export const AdminMap = ({ stats = {}, complaints = [] }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-bold text-slate-800">Civic Hotspot Density Map</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Live GPS Sync" />
        </div>
        <Link
          to="/admin/map"
          className="text-xs font-bold text-teal-600 hover:text-teal-700 hover:underline flex items-center gap-1 transition-colors"
        >
          <span>View Fullscreen Map</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Embedded Interactive Hotspot Map */}
      <HotspotMap
        height="360px"
        initialRole="ADMIN"
        showStatsHeader={false}
      />
    </div>
  );
};

export default AdminMap;
