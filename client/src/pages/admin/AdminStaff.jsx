import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import { adminApi } from "../../api/client";
import {
  Users,
  UserPlus,
  Briefcase,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  Loader2,
  Check,
  X,
  Lock,
  Tag
} from "lucide-react";
import toast from "react-hot-toast";

const DEPARTMENTS = [
  "Street Light",
  "Waste Management",
  "Roads",
  "Drainage",
  "Water Supply",
  "Street Infrastructure",
  "Public Property",
  "Other"
];

export const AdminStaff = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [staffList, setStaffList] = useState([]);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    employeeId: "",
    department: "Waste Management",
    designation: "Field Officer"
  });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStaff = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      const res = await adminApi.getStaffList();
      if (res.data?.data) {
        setStaffList(res.data.data.staff || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load staff directory.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleToggleStatus = async (staffId) => {
    try {
      const res = await adminApi.toggleStaffStatus(staffId);
      toast.success(res.data?.message || "Status updated.");
      fetchStaff(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update staff status.");
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password || !formData.department) {
      toast.error("Please fill all required fields.");
      return;
    }

    try {
      setActionLoading(true);
      await adminApi.createStaff(formData);
      toast.success(`Staff account for ${formData.name} created successfully!`);
      setShowAddModal(false);
      setFormData({
        name: "",
        email: "",
        phone: "",
        password: "",
        employeeId: "",
        department: "Waste Management",
        designation: "Field Officer"
      });
      fetchStaff(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create staff account.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AdminLayout
      title="Staff & Field Operations"
      subtitle="Configure municipal department teams, monitor workloads, and provision field credentials"
      onRefresh={() => fetchStaff(true)}
      refreshing={refreshing}
      actions={
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-1.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-xs shadow-xs flex items-center gap-1.5 transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" /> Add Field Officer
        </button>
      }
    >
      {/* STAFF TABLE CARD */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        {loading && !staffList.length ? (
          <div className="py-20 flex justify-center text-[#0D9488]">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : staffList.length === 0 ? (
          <div className="py-16 text-center text-[#64748B]">
            <Users className="w-10 h-10 mx-auto text-[#CBD5E1] mb-2" />
            <p className="text-base font-semibold text-[#0F172A]">No field staff found</p>
            <p className="text-xs text-[#94A3B8] mt-1">Click "Add Field Officer" to create staff accounts.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#0F172A]">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] text-[11px] font-semibold">
                  <th className="py-3.5 px-4 font-semibold">Staff Member</th>
                  <th className="py-3.5 px-4 font-semibold">Department</th>
                  <th className="py-3.5 px-4 font-semibold">Employee ID</th>
                  <th className="py-3.5 px-4 font-semibold">Contact</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Active Tasks</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Resolved Tasks</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {staffList.map((staff) => (
                  <tr key={staff._id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={staff.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80"}
                          alt={staff.name}
                          className="w-8 h-8 rounded-full object-cover border border-[#E2E8F0]"
                        />
                        <div>
                          <p className="font-bold text-[#0F172A]">{staff.name}</p>
                          <p className="text-[11px] text-[#64748B]">{staff.designation || "Field Officer"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-[#0D9488] border border-teal-200 text-xs font-semibold">
                        {staff.department}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-[#64748B]">
                      {staff.employeeId || "N/A"}
                    </td>
                    <td className="py-3.5 px-4 text-[#475569]">
                      <p>{staff.email}</p>
                      <p className="text-[11px] text-[#94A3B8]">{staff.phone || "No phone"}</p>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-bold text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        {staff.assignedCount || 0}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-bold text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        {staff.resolvedCount || 0}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          staff.isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                      >
                        {staff.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(staff._id)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors border shadow-2xs ${
                          staff.isActive
                            ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                        }`}
                      >
                        {staff.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD STAFF MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 sm:p-7 max-w-lg w-full shadow-2xl text-[#0F172A] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#0D9488] border border-teal-200 flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">Add Field Staff Member</h3>
                  <p className="text-xs text-[#64748B]">Provision credentials for departmental field officers</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Rajesh Shinde"
                  className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] placeholder-[#94A3B8] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#0D9488]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#64748B] mb-1">
                    Official Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="staff@smartcity.local"
                    className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] placeholder-[#94A3B8] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#0D9488]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#64748B] mb-1">
                    Login Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] placeholder-[#94A3B8] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#0D9488]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#64748B] mb-1">
                    Department *
                  </label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#0D9488]"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#64748B] mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g., Senior Inspector"
                    className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] placeholder-[#94A3B8] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#0D9488]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#64748B] mb-1">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    placeholder="e.g., WM-102"
                    className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] placeholder-[#94A3B8] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#0D9488]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#64748B] mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98220 12345"
                    className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] placeholder-[#94A3B8] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#0D9488]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#F1F5F9]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Staff Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminStaff;
