import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import { adminApi } from "../../api/client";
import {
  Search,
  Filter,
  Layers,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Calendar,
  MapPin,
  RefreshCw,
  Clock,
  User,
  ArrowRight
} from "lucide-react";
import dayjs from "dayjs";

export const AdminComplaints = () => {
  const [searchParams] = useSearchParams();
  const initialPriority = searchParams.get("priority") || "ALL";
  const initialStatus = searchParams.get("status") || "ALL";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });

  // Filters
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState(initialPriority);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetchComplaints = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else if (!complaints.length) setLoading(true);

      const res = await adminApi.getAllComplaints({
        status: statusFilter,
        category: categoryFilter,
        priority: priorityFilter,
        search,
        page,
        limit: 10
      });
      if (res.data?.data) {
        setComplaints(res.data.data.complaints || []);
        setPagination(res.data.data.pagination || { total: 0, page: 1, pages: 1 });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
    const interval = setInterval(() => {
      fetchComplaints();
    }, 12000);
    return () => clearInterval(interval);
  }, [statusFilter, categoryFilter, priorityFilter, page]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchComplaints();
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case "IN_PROGRESS":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#FEF3C7] text-[#92400E] uppercase tracking-wide border border-amber-200/50">
            IN PROGRESS
          </span>
        );
      case "RESOLVED":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#DCFCE7] text-[#166534] uppercase tracking-wide border border-emerald-200/50">
            RESOLVED
          </span>
        );
      case "REOPENED":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 uppercase tracking-wide border border-rose-200">
            REOPENED
          </span>
        );
      case "REJECTED":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 uppercase tracking-wide border border-slate-200">
            REJECTED
          </span>
        );
      case "SUBMITTED":
      case "UNDER_REVIEW":
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#FEE2E2] text-[#991B1B] uppercase tracking-wide border border-rose-200/50">
            {status || "OPEN"}
          </span>
        );
    }
  };

  const renderPriorityBadge = (priority) => {
    switch (priority) {
      case "CRITICAL":
      case "HIGH":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            {priority === "CRITICAL" ? "Critical" : "High"}
          </span>
        );
      case "MEDIUM":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Medium
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Low
          </span>
        );
    }
  };

  return (
    <AdminLayout
      title="Civic Reports & Complaints"
      subtitle="Master directory of all registered grievances across city wards"
      onRefresh={() => fetchComplaints(true)}
      refreshing={refreshing}
      actions={
        <span className="px-3 py-1.5 rounded-xl bg-teal-50 text-[#0D9488] border border-teal-200 text-xs font-bold shadow-2xs">
          Total: {pagination.total}
        </span>
      }
    >
      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-xs flex flex-col md:flex-row items-center gap-3">
        <form onSubmit={handleSearch} className="flex-1 relative w-full">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by complaint #, issue title, or street..."
            className="w-full pl-10 pr-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs sm:text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#0D9488] focus:bg-white transition-colors"
          />
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full md:w-auto md:flex md:items-center">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full md:w-auto px-3 py-2 bg-white border border-[#E2E8F0] text-[#0F172A] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#0D9488]"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="REOPENED">Reopened</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            className="w-full md:w-auto px-3 py-2 bg-white border border-[#E2E8F0] text-[#0F172A] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#0D9488]"
          >
            <option value="ALL">All Categories</option>
            <option value="Street Light">Street Light</option>
            <option value="Waste Management">Waste Management</option>
            <option value="Roads">Roads</option>
            <option value="Drainage">Drainage</option>
            <option value="Water Supply">Water Supply</option>
            <option value="Street Infrastructure">Street Infrastructure</option>
            <option value="Public Property">Public Property</option>
            <option value="Other">Other</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            className="w-full md:w-auto px-3 py-2 bg-white border border-[#E2E8F0] text-[#0F172A] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#0D9488]"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Complaints Master Table */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        {loading && !complaints.length ? (
          <div className="py-20 flex justify-center text-[#0D9488]">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : complaints.length === 0 ? (
          <div className="p-12 text-center text-[#64748B]">
            <Layers className="w-10 h-10 mx-auto text-[#CBD5E1] mb-2" />
            <p className="text-sm font-semibold text-[#0F172A]">No complaints matching filter criteria</p>
            <p className="text-xs text-[#94A3B8] mt-1">Try clearing your search query or changing filters above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#0F172A]">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] text-[11px] font-semibold">
                  <th className="py-3.5 px-4 font-semibold">ID</th>
                  <th className="py-3.5 px-4 font-semibold">Title & Category</th>
                  <th className="py-3.5 px-4 font-semibold">Citizen</th>
                  <th className="py-3.5 px-4 font-semibold">Assigned Staff</th>
                  <th className="py-3.5 px-4 font-semibold">Priority</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold">Date</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {complaints.map((comp) => (
                  <tr key={comp._id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#0D9488]">
                      #{comp.complaintNumber}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <Link
                        to={`/admin/complaints/${comp._id}`}
                        className="font-bold text-[#0F172A] hover:text-[#0D9488] line-clamp-1"
                      >
                        {comp.title}
                      </Link>
                      <p className="text-[11px] text-[#64748B]">{comp.category}</p>
                    </td>
                    <td className="py-3.5 px-4 text-[#475569]">
                      {comp.citizen?.name || "Citizen"}
                    </td>
                    <td className="py-3.5 px-4">
                      {comp.assignedStaff ? (
                        <div>
                          <p className="font-semibold text-[#0F172A]">{comp.assignedStaff.name}</p>
                          <p className="text-[10px] text-[#64748B]">{comp.assignedStaff.department}</p>
                        </div>
                      ) : (
                        <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px] font-bold">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {renderPriorityBadge(comp.priority)}
                    </td>
                    <td className="py-3.5 px-4">
                      {renderStatusBadge(comp.status)}
                    </td>
                    <td className="py-3.5 px-4 text-[#64748B] whitespace-nowrap">
                      {dayjs(comp.createdAt).format("DD MMM YYYY")}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <Link
                        to={`/admin/complaints/${comp._id}`}
                        className="px-3 py-1 rounded-lg bg-white hover:bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold text-[#0D9488] shadow-2xs transition-colors"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-5 py-3.5 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
            <span>
              Showing page <span className="font-bold text-[#0F172A]">{pagination.page}</span> of{" "}
              <span className="font-bold text-[#0F172A]">{pagination.pages}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-[#0F172A] disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={page >= pagination.pages}
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                className="p-1.5 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F1F5F9] text-[#0F172A] disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminComplaints;
