import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/authContex";
import { complaintApi, getImageUrl } from "../../api/client";
import CitizenLayout from "../../components/citizen/CitizenLayout";
import {
  Plus,
  PlusCircle,
  Clock,
  Wrench,
  CheckCircle2,
  AlertCircle,
  FileText,
  MapPin,
  Search,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Layers,
  Trash2,
  Droplets,
  Lightbulb,
  Building,
  Image as ImageIcon,
  Loader2,
  SlidersHorizontal,
  ChevronLeft,
  Check,
  TrendingUp,
  Sprout
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export const CitizenDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatusTab, setSelectedStatusTab] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [data, setData] = useState({
    stats: { total: 0, pending: 0, inProgress: 0, resolved: 0, reopened: 0 },
    recentComplaints: [],
    recentNotifications: []
  });

  const fetchDashboard = async () => {
    try {
      if (!data.recentComplaints.length) setLoading(true);
      const res = await complaintApi.getCitizenDashboard();
      if (res.data?.data) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error("Citizen dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 12000);
    return () => clearInterval(interval);
  }, []);

  // Filter complaints client-side by search query and status tab
  const filteredComplaints = useMemo(() => {
    let list = data.recentComplaints || [];
    if (selectedStatusTab !== "ALL") {
      list = list.filter((c) => {
        if (selectedStatusTab === "IN_PROGRESS") return c.status === "IN_PROGRESS" || c.status === "ASSIGNED";
        if (selectedStatusTab === "RESOLVED") return c.status === "RESOLVED";
        if (selectedStatusTab === "REOPENED") return c.status === "REOPENED";
        if (selectedStatusTab === "PENDING") return c.status === "SUBMITTED" || c.status === "UNDER_REVIEW";
        return true;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.title?.toLowerCase().includes(q) ||
          c.complaintNumber?.toLowerCase().includes(q) ||
          c.locationAddress?.toLowerCase().includes(q) ||
          c.category?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data.recentComplaints, searchQuery, selectedStatusTab]);

  // Paginate filtered complaints
  const totalPages = Math.ceil(filteredComplaints.length / itemsPerPage) || 1;
  const paginatedComplaints = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredComplaints.slice(start, start + itemsPerPage);
  }, [filteredComplaints, currentPage]);

  const firstName = user?.name ? user.name.split(" ")[0] : "Citizen";

  // Category Icon helper matching the reference
  const getCategoryIcon = (category) => {
    switch (category) {
      case "Roads":
        return <Layers className="w-3.5 h-3.5 text-blue-600" />;
      case "Street Light":
      case "Street Infrastructure":
        return <Lightbulb className="w-3.5 h-3.5 text-amber-600" />;
      case "Waste Management":
        return <Trash2 className="w-3.5 h-3.5 text-emerald-600" />;
      case "Drainage":
      case "Water Supply":
        return <Droplets className="w-3.5 h-3.5 text-sky-600" />;
      case "Public Property":
        return <Building className="w-3.5 h-3.5 text-purple-600" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  // Status Badge helper matching the citizen screenshot
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
      title="Dashboard"
      subtitle="Track your civic complaints and help build a better city"
      searchQuery={searchQuery}
      onSearchChange={(q) => {
        setSearchQuery(q);
        setCurrentPage(1);
      }}
    >
      {/* ─────────────────────────────────────────────────────────
          SECTION A: Compact Welcome Section matching reference
         ───────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        {/* Left Side: Welcome Text + Report Button */}
        <div className="flex-1 min-w-0 z-10">
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
            Welcome back, {firstName}!
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B] mt-1.5 max-w-md leading-relaxed">
            Report civic issues, track progress, and help make our city cleaner, safer and better for everyone.
          </p>
          <div className="mt-4">
            <Link
              to="/citizen/report"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-xs shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Report a Civic Issue</span>
            </Link>
          </div>
        </div>

        {/* Center: Vector City Landscape Graphic */}
        <div className="hidden lg:block w-72 h-28 relative flex-shrink-0 select-none pointer-events-none">
          <svg viewBox="0 0 280 110" className="w-full h-full" fill="none">
            {/* Soft skyline clouds */}
            <path d="M40 30 C50 20, 70 20, 80 30 C90 25, 110 25, 120 35 Z" fill="#E2E8F0" opacity="0.5" />
            <path d="M160 25 C170 15, 190 15, 200 25 C210 20, 230 20, 240 30 Z" fill="#E2E8F0" opacity="0.4" />
            {/* City silhouette buildings */}
            <rect x="80" y="35" width="22" height="65" rx="2" fill="#CBD5E1" opacity="0.5" />
            <rect x="105" y="20" width="28" height="80" rx="2" fill="#94A3B8" opacity="0.4" />
            <rect x="136" y="30" width="24" height="70" rx="2" fill="#CBD5E1" opacity="0.6" />
            <rect x="163" y="45" width="20" height="55" rx="2" fill="#E2E8F0" />
            {/* Rolling green hills / park */}
            <path d="M0 100 Q70 70 140 90 T280 85 L280 110 L0 110 Z" fill="#BBF7D0" opacity="0.7" />
            <path d="M20 105 Q100 80 180 95 T280 95 L280 110 L0 110 Z" fill="#86EFAC" opacity="0.6" />
            {/* Trees */}
            <circle cx="50" cy="80" r="14" fill="#15803D" opacity="0.8" />
            <rect x="48" y="85" width="4" height="15" fill="#78350F" />
            <circle cx="75" cy="85" r="11" fill="#16A34A" opacity="0.8" />
            <circle cx="210" cy="78" r="16" fill="#15803D" opacity="0.8" />
            <rect x="208" y="86" width="4" height="16" fill="#78350F" />
            <circle cx="235" cy="84" r="12" fill="#22C55E" opacity="0.7" />
            {/* Street lamp post */}
            <line x1="185" y1="65" x2="185" y2="100" stroke="#334155" strokeWidth="2" />
            <path d="M185 65 Q180 60 176 65" stroke="#334155" strokeWidth="2" fill="none" />
            <circle cx="176" cy="67" r="2.5" fill="#F59E0B" />
            {/* Road path */}
            <path d="M0 106 Q140 100 280 106" stroke="#94A3B8" strokeWidth="6" />
            <path d="M0 106 Q140 100 280 106" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="8 6" />
          </svg>
        </div>

        {/* Right Side: "A Cleaner, Better City" Card */}
        <div className="w-full md:w-56 bg-[#F0FDF4] border border-[#DCFCE7] rounded-xl p-3.5 flex items-center gap-3 flex-shrink-0 z-10">
          <div className="w-9 h-9 rounded-xl bg-[#DCFCE7] text-[#166534] flex items-center justify-center flex-shrink-0">
            <Sprout className="w-5 h-5 text-[#166534]" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#166534]">A Cleaner, Better City</h4>
            <p className="text-[11px] text-[#15803D] mt-0.5 leading-snug">
              Your reports help us build safer, healthier neighborhoods.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────
          SECTION B: 4 Complaint Summary Cards matching screenshot
         ───────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Total Complaints */}
        <div
          onClick={() => {
            setSelectedStatusTab("ALL");
            setCurrentPage(1);
          }}
          className={`bg-white rounded-2xl border p-4 shadow-xs transition-all cursor-pointer hover:border-blue-300 flex flex-col justify-between ${
            selectedStatusTab === "ALL" ? "border-blue-400 ring-2 ring-blue-100" : "border-[#E2E8F0]"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-[#64748B]">Total Complaints</span>
            </div>
          </div>
          <div className="flex items-end justify-between mt-1">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#0F172A]">
                {data.stats.total}
              </div>
              <div className="text-[11px] text-blue-600 font-semibold mt-0.5 flex items-center gap-1">
                <span>↑ +12%</span>
                <span className="text-[#94A3B8] font-normal">from last month</span>
              </div>
            </div>
            {/* Sparkline wave SVG */}
            <div className="w-14 h-7 text-blue-500">
              <svg viewBox="0 0 60 25" className="w-full h-full fill-none stroke-current" strokeWidth="2" strokeLinecap="round">
                <path d="M 2 18 Q 15 5 30 15 T 58 8" />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 2: Pending */}
        <div
          onClick={() => {
            setSelectedStatusTab("PENDING");
            setCurrentPage(1);
          }}
          className={`bg-white rounded-2xl border p-4 shadow-xs transition-all cursor-pointer hover:border-amber-300 flex flex-col justify-between ${
            selectedStatusTab === "PENDING" ? "border-amber-400 ring-2 ring-amber-100" : "border-[#E2E8F0]"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-[#64748B]">Pending</span>
            </div>
          </div>
          <div className="flex items-end justify-between mt-1">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#0F172A]">
                {data.stats.pending || data.stats.reopened || 0}
              </div>
              <div className="text-[11px] text-amber-600 font-semibold mt-0.5 flex items-center gap-1">
                <span>↗ Awaiting</span>
                <span className="text-[#94A3B8] font-normal">assignment</span>
              </div>
            </div>
            {/* Sparkline wave SVG */}
            <div className="w-14 h-7 text-amber-500">
              <svg viewBox="0 0 60 25" className="w-full h-full fill-none stroke-current" strokeWidth="2" strokeLinecap="round">
                <path d="M 2 15 Q 15 22 30 10 T 58 12" />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 3: In Progress */}
        <div
          onClick={() => {
            setSelectedStatusTab("IN_PROGRESS");
            setCurrentPage(1);
          }}
          className={`bg-white rounded-2xl border p-4 shadow-xs transition-all cursor-pointer hover:border-sky-300 flex flex-col justify-between ${
            selectedStatusTab === "IN_PROGRESS" ? "border-sky-400 ring-2 ring-sky-100" : "border-[#E2E8F0]"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0">
                <Wrench className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-[#64748B]">In Progress</span>
            </div>
          </div>
          <div className="flex items-end justify-between mt-1">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#0F172A]">
                {data.stats.inProgress}
              </div>
              <div className="text-[11px] text-sky-600 font-semibold mt-0.5 flex items-center gap-1">
                <span>↘ Work</span>
                <span className="text-[#94A3B8] font-normal">in progress</span>
              </div>
            </div>
            {/* Sparkline wave SVG */}
            <div className="w-14 h-7 text-sky-500">
              <svg viewBox="0 0 60 25" className="w-full h-full fill-none stroke-current" strokeWidth="2" strokeLinecap="round">
                <path d="M 2 10 Q 18 20 32 8 T 58 16" />
              </svg>
            </div>
          </div>
        </div>

        {/* Card 4: Resolved */}
        <div
          onClick={() => {
            setSelectedStatusTab("RESOLVED");
            setCurrentPage(1);
          }}
          className={`bg-white rounded-2xl border p-4 shadow-xs transition-all cursor-pointer hover:border-emerald-300 flex flex-col justify-between ${
            selectedStatusTab === "RESOLVED" ? "border-emerald-400 ring-2 ring-emerald-100" : "border-[#E2E8F0]"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-[#64748B]">Resolved</span>
            </div>
          </div>
          <div className="flex items-end justify-between mt-1">
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#0F172A]">
                {data.stats.resolved}
              </div>
              <div className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                <span>↑ +25%</span>
                <span className="text-[#94A3B8] font-normal">from last month</span>
              </div>
            </div>
            {/* Sparkline wave SVG */}
            <div className="w-14 h-7 text-emerald-500">
              <svg viewBox="0 0 60 25" className="w-full h-full fill-none stroke-current" strokeWidth="2" strokeLinecap="round">
                <path d="M 2 20 Q 15 15 30 5 T 58 3" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────
          SECTION C: Two-Column Main Content (My Complaints + Sidebar)
         ───────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: My Complaints List (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E2E8F0] p-4 sm:p-5 shadow-xs space-y-4">
          {/* Card Header with Search & Filter Icon */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#0D9488] border border-teal-200 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">My Complaints</h3>
                <p className="text-[11px] text-[#64748B]">
                  Track the status and progress of your submitted complaints
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-48">
                <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search your complaints..."
                  className="w-full pl-8 pr-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#0D9488] focus:bg-white"
                />
              </div>
              <button
                type="button"
                className="p-1.5 border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#F1F5F9] rounded-xl text-[#64748B]"
                title="Filter options"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Status Filter Tabs matching screenshot */}
          <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-3 overflow-x-auto no-scrollbar text-xs">
            <button
              type="button"
              onClick={() => {
                setSelectedStatusTab("ALL");
                setCurrentPage(1);
              }}
              className={`pb-1 font-bold transition-all whitespace-nowrap border-b-2 ${
                selectedStatusTab === "ALL"
                  ? "border-[#0D9488] text-[#0D9488]"
                  : "border-transparent text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              All ({data.stats.total})
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedStatusTab("PENDING");
                setCurrentPage(1);
              }}
              className={`pb-1 font-bold transition-all whitespace-nowrap border-b-2 ${
                selectedStatusTab === "PENDING"
                  ? "border-[#0D9488] text-[#0D9488]"
                  : "border-transparent text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              Pending ({data.stats.pending || data.stats.reopened || 0})
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedStatusTab("IN_PROGRESS");
                setCurrentPage(1);
              }}
              className={`pb-1 font-bold transition-all whitespace-nowrap border-b-2 ${
                selectedStatusTab === "IN_PROGRESS"
                  ? "border-[#0D9488] text-[#0D9488]"
                  : "border-transparent text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              In Progress ({data.stats.inProgress})
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedStatusTab("RESOLVED");
                setCurrentPage(1);
              }}
              className={`pb-1 font-bold transition-all whitespace-nowrap border-b-2 ${
                selectedStatusTab === "RESOLVED"
                  ? "border-[#0D9488] text-[#0D9488]"
                  : "border-transparent text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              Resolved ({data.stats.resolved})
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedStatusTab("REOPENED");
                setCurrentPage(1);
              }}
              className={`pb-1 font-bold transition-all whitespace-nowrap border-b-2 ${
                selectedStatusTab === "REOPENED"
                  ? "border-[#0D9488] text-[#0D9488]"
                  : "border-transparent text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              Reopened ({data.stats.reopened || 0})
            </button>
          </div>

          {/* Complaints Rows */}
          {loading && !filteredComplaints.length ? (
            <div className="py-16 flex justify-center text-[#0D9488]">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : filteredComplaints.length === 0 ? (
            /* Friendly Empty State matching requirement */
            <div className="py-12 text-center text-[#64748B] bg-[#F8FAFC] rounded-2xl border border-dashed border-[#E2E8F0]">
              <FileText className="w-10 h-10 mx-auto text-[#CBD5E1] mb-2" />
              <p className="text-sm font-bold text-[#0F172A]">No complaints yet</p>
              <p className="text-xs text-[#64748B] mt-1">
                Report a civic issue in your neighborhood to get started.
              </p>
              <Link
                to="/citizen/report"
                className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 bg-[#0D9488] hover:bg-[#0F766E] text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Report an Issue</span>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {paginatedComplaints.map((c) => {
                const thumb = c.beforeImage ? getImageUrl(c.beforeImage) : null;

                return (
                  <Link
                    key={c._id}
                    to={`/citizen/complaints/${c._id}`}
                    className="py-3 sm:py-3.5 flex items-center justify-between gap-3 hover:bg-[#F8FAFC] -mx-2 px-2 rounded-xl transition-colors group"
                  >
                    {/* Left: Thumbnail + ID + Title + Location */}
                    <div className="flex items-center gap-3 min-w-0">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={c.title}
                          className="w-12 h-12 rounded-xl object-cover border border-[#E2E8F0] flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#94A3B8] flex-shrink-0">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <span className="font-mono text-[11px] font-bold text-[#64748B] block">
                          #{c.complaintNumber}
                        </span>
                        <h4 className="text-xs sm:text-sm font-bold text-[#0F172A] truncate group-hover:text-[#0D9488] transition-colors">
                          {c.title}
                        </h4>
                        <div className="flex items-center gap-1 text-[11px] text-[#64748B] truncate mt-0.5">
                          <MapPin className="w-3 h-3 text-[#94A3B8] flex-shrink-0" />
                          <span className="truncate">{c.locationAddress || "Civic location"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Category */}
                    <div className="hidden md:flex items-center gap-1.5 text-xs text-[#475569] font-medium flex-shrink-0">
                      {getCategoryIcon(c.category)}
                      <span>{c.category}</span>
                    </div>

                    {/* Right: Status badge, Date, and chevron */}
                    <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                      {renderStatusBadge(c.status)}

                      <div className="hidden sm:block text-right whitespace-nowrap">
                        <p className="text-xs font-medium text-[#0F172A]">
                          {dayjs(c.createdAt).format("MMM D, YYYY")}
                        </p>
                        <p className="text-[10px] text-[#94A3B8] font-mono">
                          {dayjs(c.createdAt).fromNow()}
                        </p>
                      </div>

                      <ChevronRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#0D9488] group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Footer & Pagination */}
          <div className="pt-3 border-t border-[#F1F5F9] flex items-center justify-between text-xs text-[#64748B]">
            <span>
              Showing {filteredComplaints.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredComplaints.length)} of{" "}
              {filteredComplaints.length} complaints
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentPage(idx + 1)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                      currentPage === idx + 1
                        ? "bg-[#0D9488] text-white"
                        : "border border-[#E2E8F0] text-[#0F172A] hover:bg-[#F8FAFC]"
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: "Report a New Issue" + "Recent Updates" (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Top Card: Report a New Issue matching screenshot */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#0D9488] text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">Report a New Issue</h3>
                <p className="text-[11px] text-[#64748B]">Click below to report a civic issue in your area</p>
              </div>
            </div>
            <Link
              to="/citizen/report"
              className="w-full py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Report a Civic Issue</span>
            </Link>
          </div>

          {/* Bottom Card: Recent Updates matching screenshot */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#0D9488]" />
                <span>Recent Updates</span>
              </h3>
              <Link
                to="/citizen/notifications"
                className="text-xs font-semibold text-[#0D9488] hover:underline"
              >
                View all
              </Link>
            </div>

            <div className="space-y-4 relative before:absolute before:top-2 before:bottom-2 before:left-2 before:w-0.5 before:bg-[#F1F5F9]">
              {data.recentComplaints.slice(0, 4).map((c, i) => {
                const isResolved = c.status === "RESOLVED";
                const isInProgress = c.status === "IN_PROGRESS" || c.status === "ASSIGNED";
                const dotColor = isResolved
                  ? "bg-emerald-500 ring-4 ring-emerald-50"
                  : isInProgress
                  ? "bg-blue-500 ring-4 ring-blue-50"
                  : "bg-slate-400 ring-4 ring-slate-100";

                return (
                  <div key={c._id || i} className="flex items-start gap-3 relative pl-6">
                    <span className={`w-2 h-2 rounded-full absolute left-1 top-1.5 ${dotColor}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-bold text-[#0F172A] truncate">
                          {isResolved ? "Status updated" : isInProgress ? "Work in progress" : "New complaint submitted"}
                        </p>
                        <span className="text-[10px] text-[#94A3B8] font-mono whitespace-nowrap">
                          {dayjs(c.createdAt).fromNow()}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-0.5 line-clamp-2">
                        Your complaint #{c.complaintNumber} ({c.title}) is {c.status.toLowerCase().replace("_", " ")}.
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </CitizenLayout>
  );
};

export default CitizenDashboard;
