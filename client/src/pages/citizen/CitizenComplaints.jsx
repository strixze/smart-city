import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import CitizenLayout from "../../components/citizen/CitizenLayout";
import StatusBadge from "../../components/StatusBadge";
import PriorityBadge from "../../components/PriorityBadge";
import { complaintApi, getImageUrl } from "../../api/client";
import {
  Search,
  Filter,
  Plus,
  MapPin,
  Calendar,
  Loader2,
  Image as ImageIcon,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  FileText
} from "lucide-react";
import dayjs from "dayjs";

export const CitizenComplaints = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [complaints, setComplaints] = useState([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const fetchComplaints = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else if (!complaints.length) setLoading(true);

      const res = await complaintApi.getMyComplaints({
        status: statusFilter,
        category: categoryFilter,
        search
      });
      if (res.data?.data) {
        setComplaints(res.data.data.complaints || []);
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
  }, [statusFilter, categoryFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchComplaints();
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case "IN_PROGRESS":
      case "ASSIGNED":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#DBEAFE] text-[#1D4ED8] whitespace-nowrap">
            In Progress
          </span>
        );
      case "RESOLVED":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#DCFCE7] text-[#166534] whitespace-nowrap">
            Resolved
          </span>
        );
      case "REOPENED":
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#FEE2E2] text-[#B91C1C] whitespace-nowrap">
            Reopened
          </span>
        );
      case "SUBMITTED":
      case "UNDER_REVIEW":
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#FEF3C7] text-[#92400E] whitespace-nowrap">
            Pending
          </span>
        );
    }
  };

  return (
    <CitizenLayout
      title="My Grievance History"
      subtitle="View resolution progress, photographic proofs, and feedback actions"
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchComplaints(true)}
            disabled={refreshing}
            className="p-2 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#0D9488] shadow-2xs transition-colors"
            title="Refresh Grievances"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-[#0D9488]" : ""}`} />
          </button>
          <Link
            to="/citizen/report"
            className="px-3.5 py-1.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" /> Report Issue
          </Link>
        </div>
      }
    >
      {/* Filters & Search Toolbar */}
      <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-xs flex flex-col md:flex-row items-center gap-3">
        <form onSubmit={handleSearch} className="flex-1 relative w-full">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by complaint ID, title, or location..."
            className="w-full pl-10 pr-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs sm:text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#0D9488] focus:bg-white transition-colors"
          />
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full md:w-auto md:flex md:items-center">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full md:w-auto px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#0D9488]"
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
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full md:w-auto px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#0D9488]"
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
        </div>
      </div>

      {/* Complaints Grid */}
      {loading && !complaints.length ? (
        <div className="py-20 flex justify-center text-[#0D9488]">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : complaints.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-[#E2E8F0] shadow-xs">
          <FileText className="w-10 h-10 mx-auto text-[#CBD5E1] mb-2" />
          <p className="text-base font-bold text-[#0F172A]">No complaints found</p>
          <p className="text-xs text-[#64748B] mt-1">Try adjusting your filters or search term above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {complaints.map((comp) => {
            const beforeUrl = comp.beforeImage ? getImageUrl(comp.beforeImage) : null;

            return (
              <div
                key={comp._id}
                className="bg-white rounded-2xl p-5 border border-[#E2E8F0] hover:border-[#CBD5E1] shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top Header */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono text-xs font-bold text-[#0D9488] bg-teal-50 px-2.5 py-0.5 rounded-md border border-teal-200">
                      #{comp.complaintNumber}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {renderStatusBadge(comp.status)}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-bold text-[#0F172A] text-sm sm:text-base mb-1 line-clamp-1">
                    {comp.title}
                  </h3>
                  <p className="text-xs text-[#64748B] line-clamp-2 leading-relaxed mb-3">
                    {comp.description}
                  </p>

                  {/* Photo Thumbnail + Location */}
                  <div className="flex items-center gap-3 mb-3">
                    {beforeUrl ? (
                      <img
                        src={beforeUrl}
                        alt="Before"
                        className="w-14 h-14 rounded-xl object-cover border border-[#E2E8F0] flex-shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#94A3B8] flex-shrink-0">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}

                    <div className="flex flex-col text-xs text-[#64748B] space-y-1 min-w-0">
                      <span className="flex items-center gap-1 line-clamp-1 font-medium text-[#334155]">
                        <MapPin className="w-3.5 h-3.5 text-[#0D9488] flex-shrink-0" />
                        <span className="truncate">{comp.locationAddress}</span>
                      </span>
                      <span className="text-[11px] text-[#94A3B8]">
                        Dept: <span className="text-[#475569]">{comp.category}</span> • {comp.subcategory || "General"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-xs text-[#64748B]">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#94A3B8]" />
                    {dayjs(comp.createdAt).format("DD MMM YYYY")}
                  </span>

                  <Link
                    to={`/citizen/complaints/${comp._id}`}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#F8FAFC] text-xs font-bold text-[#0D9488] border border-[#E2E8F0] shadow-2xs transition-colors flex items-center gap-1"
                  >
                    Details & Proof <ArrowRight className="w-3.5 h-3.5 text-[#0D9488]" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CitizenLayout>
  );
};

export default CitizenComplaints;
