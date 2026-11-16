import React from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import HotspotMap from "../../components/admin/HotspotMap";
import { Flame, MapPin } from "lucide-react";

export const AdminHotspotMap = () => {
  return (
    <AdminLayout
      title="City Hotspot & Heatmap Center"
      subtitle="Interactive geospatial analysis of citizen complaints with Leaflet and OpenStreetMap density heatmaps"
    >
      <div className="space-y-6">
        <HotspotMap height="calc(100vh - 290px)" initialRole="ADMIN" showStatsHeader={true} />
      </div>
    </AdminLayout>
  );
};

export default AdminHotspotMap;

