import React from "react";
import HotspotMap from "../admin/HotspotMap";
import { Flame, MapPin } from "lucide-react";

export const StaffTaskMap = ({ tasks = [] }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-teal-600" />
          <span className="text-sm font-bold text-slate-800">Assigned Tasks & Department Hotspots</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Live Geo Feed" />
        </div>
      </div>

      {/* Embedded Leaflet Map with Staff-scoped task hotspots */}
      <HotspotMap
        height="360px"
        initialRole="STAFF"
        showStatsHeader={false}
      />
    </div>
  );
};

export default StaffTaskMap;
