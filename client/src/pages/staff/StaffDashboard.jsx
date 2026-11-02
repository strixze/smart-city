import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/authContex";
import { useNotification } from "../../context/notificationContext";
import { staffApi, getImageUrl } from "../../api/client";
import StaffLayout from "../../components/staff/StaffLayout";
import StaffTaskMap from "../../components/staff/StaffTaskMap";
import StatusBadge from "../../components/StatusBadge";
import PriorityBadge from "../../components/PriorityBadge";
import { getLocalizedCategory, getLocalizedStatus, formatDate } from "../../utils/formatters";
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  MapPin,
  Calendar,
  Search,
  Filter,
  Camera,
  FileText,
  Zap,
  Trophy,
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export const StaffDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { notifications } = useNotification();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    stats: { assigned: 0, inProgress: 0, resolved: 0, highPriority: 0 },
    recentTasks: []
  });

  // Table filters & pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab] = useState("ALL"); // 'ALL' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await staffApi.getDashboard();
      if (res.data?.data) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error("Staff dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 15000);
    return () => clearInterval(interval);
  }, []);

  const firstName = user?.name?.split(" ")[0] || "Amit";
  const tasks = data.recentTasks || [];

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Status filter
      if (statusTab === "ASSIGNED" && task.status !== "ASSIGNED" && task.status !== "PENDING") {
        return false;
      }
      if (statusTab === "IN_PROGRESS" && task.status !== "IN_PROGRESS") {
        return false;
      }
      if (statusTab === "RESOLVED" && task.status !== "RESOLVED") {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = task.complaintNumber?.toLowerCase().includes(q);
        const matchesTitle = task.title?.toLowerCase().includes(q);
        const matchesLocation = task.locationAddress?.toLowerCase().includes(q);
        const matchesCategory = task.category?.toLowerCase().includes(q);
        if (!matchesId && !matchesTitle && !matchesLocation && !matchesCategory) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, statusTab, searchQuery]);

  // Paginated tasks
  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage) || 1;
  const paginatedTasks = filteredTasks.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Tab counts
  const pendingCount = tasks.filter(
    (t) => t.status === "ASSIGNED" || t.status === "PENDING"
  ).length;
  const inProgressCount = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const resolvedCount = tasks.filter((t) => t.status === "RESOLVED").length;

  return (
    <StaffLayout
      title={t("staff.dashboard.title", "Field Operations")}
      subtitle={t("staff.dashboard.subtitle", "Manage your assigned tasks, inspect issues, and submit completion proof")}
    >
      <div className="space-y-6">
        {/* WELCOME SECTION */}
        <div className="bg-[#F0FDFA] border border-[#CCFBF1] rounded-2xl p-5 sm:p-6 shadow-2xs relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left Column: Greeting & Action */}
          <div className="space-y-3 z-10 max-w-lg">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
                {t("citizen.dashboard.greeting", "Welcome back")}, {firstName}!
              </h2>
              <p className="text-xs sm:text-sm text-[#475569] mt-1 leading-relaxed">
                You have {data.stats.assigned || pendingCount || 3} assigned tasks today. Keep the city clean and safe.
              </p>
            </div>
            <Link
              to="/staff/tasks"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0D9488] hover:bg-[#0F766E] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <Send className="w-3.5 h-3.5 rotate-45" /> {t("nav.tasks", "View My Tasks")}
            </Link>
          </div>

          {/* Center Illustration: Vector municipal field officer & maintenance vehicle */}
          <div className="hidden lg:flex items-center justify-center flex-1 max-w-md h-28 relative">
            <svg
              className="w-full h-full object-contain"
              viewBox="0 0 320 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* City skyline silhouettes */}
              <rect x="20" y="40" width="22" height="50" rx="2" fill="#E2E8F0" opacity="0.7" />
              <rect x="46" y="25" width="26" height="65" rx="2" fill="#CBD5E1" opacity="0.6" />
              <rect x="76" y="35" width="20" height="55" rx="2" fill="#E2E8F0" opacity="0.7" />
              <rect x="180" y="30" width="28" height="60" rx="2" fill="#CBD5E1" opacity="0.6" />
              <rect x="212" y="45" width="24" height="45" rx="2" fill="#E2E8F0" opacity="0.7" />

              {/* Road */}
              <rect x="0" y="88" width="320" height="12" fill="#E2E8F0" />
              <line x1="0" y1="94" x2="320" y2="94" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="6 6" />

              {/* Trees */}
              <circle cx="15" cy="65" r="14" fill="#86EFAC" opacity="0.8" />
              <rect x="13" y="65" width="4" height="24" fill="#94A3B8" />

              <circle cx="95" cy="70" r="10" fill="#4ADE80" opacity="0.8" />
              <rect x="93" y="70" width="4" height="19" fill="#94A3B8" />

              <circle cx="280" cy="65" r="14" fill="#86EFAC" opacity="0.8" />
              <rect x="278" y="65" width="4" height="24" fill="#94A3B8" />

              {/* Municipal Field Staff Officer */}
              <g transform="translate(108, 30)">
                {/* Cap */}
                <ellipse cx="14" cy="8" rx="8" ry="4" fill="#0D9488" />
                {/* Head */}
                <circle cx="14" cy="14" r="6" fill="#FCD34D" />
                {/* Body / Uniform */}
                <path d="M7 21 C7 18, 21 18, 21 21 L22 42 L6 42 Z" fill="#0D9488" />
                {/* High-vis Vest strip */}
                <rect x="9" y="24" width="10" height="4" fill="#FEF08A" />
                {/* Legs */}
                <rect x="7" y="42" width="5" height="18" fill="#1E293B" />
                <rect x="16" y="42" width="5" height="18" fill="#1E293B" />
                {/* Broom */}
                <line x1="22" y1="20" x2="28" y2="60" stroke="#78350F" strokeWidth="2" />
                <path d="M25 56 L33 58 L28 62 Z" fill="#D97706" />
              </g>

              {/* Green Municipal Service Truck */}
              <g transform="translate(165, 42)">
                {/* Cab */}
                <rect x="42" y="12" width="24" height="28" rx="3" fill="#0F766E" />
                <rect x="48" y="16" width="16" height="12" rx="2" fill="#CCFBF1" />
                {/* Cargo Body */}
                <rect x="0" y="8" width="40" height="32" rx="3" fill="#0D9488" />
                {/* Service Emblem */}
                <circle cx="20" cy="24" r="6" fill="#CCFBF1" />
                <path d="M18 24 L20 26 L23 22" stroke="#0D9488" strokeWidth="1.5" strokeLinecap="round" />
                {/* Chassis & Wheels */}
                <rect x="0" y="38" width="66" height="4" fill="#334155" />
                <circle cx="14" cy="42" r="6" fill="#0F172A" />
                <circle cx="14" cy="42" r="2.5" fill="#E2E8F0" />
                <circle cx="52" cy="42" r="6" fill="#0F172A" />
                <circle cx="52" cy="42" r="2.5" fill="#E2E8F0" />
              </g>
            </svg>
          </div>

          {/* Far Right Badge: "Your Work Matters" */}
          <div className="z-10 bg-white border border-[#CCFBF1] rounded-xl p-3.5 flex items-center gap-3 shadow-2xs max-w-xs self-stretch md:self-auto">
            <div className="w-10 h-10 rounded-full bg-[#0D9488] text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
              <Trophy className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#0F172A]">{t("staff.dashboard.yourWorkMatters", "Your Work Matters")}</h4>
              <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">
                {t("staff.dashboard.cleanerNeighborhoods", "Cleaner neighborhoods create healthier communities.")}
              </p>
            </div>
          </div>
        </div>

        {/* 4 KPI CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* 1: Assigned Tasks */}
          <Link
            to="/staff/tasks"
            className="bg-white rounded-2xl border border-[#E2E8F0] p-4 sm:p-5 shadow-xs hover:border-[#CBD5E1] transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center flex-shrink-0">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#64748B]">{t("staff.dashboard.assignedToMe", "Assigned Tasks")}</p>
                <p className="text-2xl font-extrabold text-[#0F172A] tracking-tight mt-0.5">
                  {data.stats.assigned || pendingCount || 3}
                </p>
                <p className="text-[11px] text-[#94A3B8]">{t("staff.dashboard.pendingFieldVisit", "Pending field visit")}</p>
              </div>
            </div>
            <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:translate-x-0.5 transition-transform flex-shrink-0">
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          {/* 2: In Progress */}
          <Link
            to="/staff/tasks?status=IN_PROGRESS"
            className="bg-white rounded-2xl border border-[#E2E8F0] p-4 sm:p-5 shadow-xs hover:border-[#CBD5E1] transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#64748B]">{t("status.IN_PROGRESS", "In Progress")}</p>
                <p className="text-2xl font-extrabold text-[#0F172A] tracking-tight mt-0.5">
                  {data.stats.inProgress || inProgressCount || 2}
                </p>
                <p className="text-[11px] text-[#94A3B8]">{t("staff.dashboard.activeFieldwork", "Active fieldwork")}</p>
              </div>
            </div>
            <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center group-hover:translate-x-0.5 transition-transform flex-shrink-0">
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          {/* 3: Completed */}
          <Link
            to="/staff/tasks?status=RESOLVED"
            className="bg-white rounded-2xl border border-[#E2E8F0] p-4 sm:p-5 shadow-xs hover:border-[#CBD5E1] transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#64748B]">{t("status.RESOLVED", "Completed")}</p>
                <p className="text-2xl font-extrabold text-[#0F172A] tracking-tight mt-0.5">
                  {data.stats.resolved || resolvedCount || 18}
                </p>
                <p className="text-[11px] text-[#94A3B8]">{t("staff.dashboard.thisMonth", "This month")}</p>
              </div>
            </div>
            <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:translate-x-0.5 transition-transform flex-shrink-0">
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          {/* 4: Overdue */}
          <Link
            to="/staff/tasks?priority=CRITICAL"
            className="bg-white rounded-2xl border border-[#E2E8F0] p-4 sm:p-5 shadow-xs hover:border-[#CBD5E1] transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#64748B]">{t("staff.dashboard.urgentAttention", "Overdue")}</p>
                <p className="text-2xl font-extrabold text-[#0F172A] tracking-tight mt-0.5">
                  {data.stats.highPriority || 2}
                </p>
                <p className="text-[11px] text-[#94A3B8]">{t("staff.dashboard.pastDueDate", "Past due date")}</p>
              </div>
            </div>
            <div className="w-7 h-7 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center group-hover:translate-x-0.5 transition-transform flex-shrink-0">
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>

        {/* TWO-COLUMN MAIN SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: MY ASSIGNED TASKS TABLE (~7 cols) */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E2E8F0] p-5 sm:p-6 shadow-xs space-y-4">
            {/* Header: Title + Search & Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#F0FDFA] text-[#0D9488] border border-[#CCFBF1] flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A]">{t("staff.tasks.title", "My Assigned Tasks")}</h3>
                  <p className="text-[11px] text-[#64748B]">
                    {t("staff.dashboard.tasksAllocated", "Tasks allocated to you for inspection and resolution")}
                  </p>
                </div>
              </div>

              {/* Search & Filter */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder={t("staff.tasks.searchPlaceholder", "Search tasks...")}
                    className="w-40 sm:w-52 pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#0D9488]"
                  />
                </div>
                <button
                  type="button"
                  className="p-1.5 rounded-xl border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] transition-colors"
                  title="Filter options"
                >
                  <Filter className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-2 border-b border-[#F1F5F9] pb-2 text-xs font-semibold overflow-x-auto">
              <button
                type="button"
                onClick={() => {
                  setStatusTab("ALL");
                  setCurrentPage(1);
                }}
                className={`pb-1.5 transition-colors border-b-2 whitespace-nowrap ${
                  statusTab === "ALL"
                    ? "border-[#0D9488] text-[#0D9488]"
                    : "border-transparent text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                {t("common.all", "All")} ({tasks.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusTab("ASSIGNED");
                  setCurrentPage(1);
                }}
                className={`pb-1.5 transition-colors border-b-2 whitespace-nowrap ${
                  statusTab === "ASSIGNED"
                    ? "border-[#0D9488] text-[#0D9488]"
                    : "border-transparent text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                {t("status.Pending", "Pending")} ({pendingCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusTab("IN_PROGRESS");
                  setCurrentPage(1);
                }}
                className={`pb-1.5 transition-colors border-b-2 whitespace-nowrap ${
                  statusTab === "IN_PROGRESS"
                    ? "border-[#0D9488] text-[#0D9488]"
                    : "border-transparent text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                {t("status.IN_PROGRESS", "In Progress")} ({inProgressCount})
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusTab("RESOLVED");
                  setCurrentPage(1);
                }}
                className={`pb-1.5 transition-colors border-b-2 whitespace-nowrap ${
                  statusTab === "RESOLVED"
                    ? "border-[#0D9488] text-[#0D9488]"
                    : "border-transparent text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                {t("status.RESOLVED", "Completed")} ({resolvedCount})
              </button>
            </div>

            {/* Table */}
            {loading ? (
              <div className="py-16 flex justify-center text-[#0D9488]">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
            ) : paginatedTasks.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#94A3B8]">
                {t("staff.tasks.empty", "No assigned tasks match your filter.")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#F1F5F9] text-[#64748B] font-bold text-[10px] uppercase tracking-wider">
                      <th className="pb-2.5 px-2">{t("common.id", "ID")}</th>
                      <th className="pb-2.5 px-2">{t("citizen.complaintDetail.detailsTitle", "Issue Details")}</th>
                      <th className="pb-2.5 px-2">{t("citizen.report.step2", "Location")}</th>
                      <th className="pb-2.5 px-2">{t("citizen.complaintDetail.priority", "Priority")}</th>
                      <th className="pb-2.5 px-2">{t("citizen.complaintDetail.status", "Status")}</th>
                      <th className="pb-2.5 px-2">{t("staff.dashboard.dueDate", "Due Date")}</th>
                      <th className="pb-2.5 px-2 text-right">{t("common.actions", "Actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {paginatedTasks.map((task) => {
                      const beforeUrl = task.beforeImage
                        ? getImageUrl(task.beforeImage?.imageUrl || task.beforeImage)
                        : null;

                      return (
                        <tr
                          key={task._id}
                          className="hover:bg-[#F8FAFC] transition-colors group"
                        >
                          {/* ID */}
                          <td className="py-3 px-2 font-mono font-bold text-[#0F172A] whitespace-nowrap">
                            #{task.complaintNumber}
                          </td>

                          {/* Issue Details: Thumbnail + Title + Category */}
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2.5 min-w-[160px]">
                              {beforeUrl ? (
                                <img
                                  src={beforeUrl}
                                  alt={task.title}
                                  className="w-9 h-9 rounded-lg object-cover border border-[#E2E8F0] flex-shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center text-[#94A3B8] flex-shrink-0">
                                  <ImageIcon className="w-4 h-4" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <Link
                                  to={`/staff/tasks/${task._id}`}
                                  className="font-bold text-[#0F172A] hover:text-[#0D9488] block truncate leading-tight"
                                >
                                  {task.title}
                                </Link>
                                <span className="text-[10px] text-[#64748B] block truncate mt-0.5">
                                  {getLocalizedCategory(task.category, t)}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Location */}
                          <td className="py-3 px-2 text-[#64748B] max-w-[140px]">
                            <div className="flex items-center gap-1 truncate">
                              <MapPin className="w-3.5 h-3.5 text-[#0D9488] flex-shrink-0" />
                              <span className="truncate">{task.locationAddress}</span>
                            </div>
                          </td>

                          {/* Priority */}
                          <td className="py-3 px-2 whitespace-nowrap">
                            <PriorityBadge priority={task.priority} size="sm" />
                          </td>

                          {/* Status */}
                          <td className="py-3 px-2 whitespace-nowrap">
                            <StatusBadge status={task.status} size="sm" />
                          </td>

                          {/* Due Date */}
                          <td className="py-3 px-2 whitespace-nowrap text-[#64748B] text-[11px]">
                            {formatDate(task.createdAt, i18n.language)}
                            <span className="block text-[10px] text-[#94A3B8]">
                              {dayjs(task.createdAt).format("hh:mm A")}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-2 text-right whitespace-nowrap">
                            {task.status === "ASSIGNED" || task.status === "PENDING" ? (
                              <Link
                                to={`/staff/tasks/${task._id}`}
                                className="inline-flex items-center px-3 py-1.5 bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors"
                              >
                                {t("staff.tasks.startWork", "Start Work")}
                              </Link>
                            ) : task.status === "IN_PROGRESS" ? (
                              <Link
                                to={`/staff/tasks/${task._id}`}
                                className="inline-flex items-center px-3 py-1.5 bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold text-xs rounded-lg shadow-2xs transition-colors"
                              >
                                {t("staff.tasks.submitProof", "Submit Proof")}
                              </Link>
                            ) : (
                              <Link
                                to={`/staff/tasks/${task._id}`}
                                className="inline-flex items-center px-3 py-1.5 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#0F172A] font-semibold text-xs rounded-lg shadow-2xs transition-colors"
                              >
                                {t("common.view", "View")}
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer Pagination */}
            <div className="flex items-center justify-between pt-3 border-t border-[#F1F5F9] text-xs text-[#64748B]">
              <span>
                {t("common.showing", "Showing")} {paginatedTasks.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} -{" "}
                {Math.min(currentPage * itemsPerPage, filteredTasks.length)} / {filteredTasks.length}
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentPage(idx + 1)}
                    className={`w-6 h-6 rounded-lg text-xs font-semibold transition-colors ${
                      currentPage === idx + 1
                        ? "bg-[#0D9488] text-white"
                        : "text-[#64748B] hover:bg-[#F8FAFC]"
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: MAP + RECENT ALERTS + QUICK ACTIONS (~5 cols) */}
          <div className="lg:col-span-4 space-y-5">
            {/* 1. Map Widget */}
            <StaffTaskMap tasks={tasks} />

            {/* 2. Recent Alerts Widget */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#F0FDFA] text-[#0D9488] border border-[#CCFBF1] flex items-center justify-center">
                    <AlertCircle className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm font-bold text-[#0F172A]">{t("staff.dashboard.recentAlerts", "Recent Alerts")}</h3>
                </div>
                <Link
                  to="/staff/notifications"
                  className="text-xs font-semibold text-[#0D9488] hover:underline"
                >
                  {t("common.viewAll", "View all")}
                </Link>
              </div>

              {/* Alert items matching screenshot with status dots */}
              <div className="divide-y divide-[#F1F5F9] text-xs">
                {notifications && notifications.length > 0 ? (
                  notifications.slice(0, 3).map((notif, i) => (
                    <div key={notif._id || i} className="py-2.5 flex items-start gap-2.5">
                      <span
                        className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          i === 0 ? "bg-[#EF4444]" : i === 1 ? "bg-[#F59E0B]" : "bg-blue-600"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-bold text-[#0F172A] truncate">{notif.title}</p>
                          <span className="text-[10px] text-[#94A3B8] font-mono flex-shrink-0">
                            {dayjs(notif.createdAt).fromNow()}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#64748B] line-clamp-1 mt-0.5">
                          {notif.message}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="py-2.5 flex items-start gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-[#EF4444] mt-1.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-bold text-[#0F172A] truncate">{t("staff.dashboard.newAssignedAlert", "New task assigned")}</p>
                          <span className="text-[10px] text-[#94A3B8] font-mono">1h ago</span>
                        </div>
                        <p className="text-[11px] text-[#64748B] line-clamp-1 mt-0.5">
                          {t("categories.Waste Management", "Waste Management")} (#SC-2026-000024)
                        </p>
                      </div>
                    </div>
                    <div className="py-2.5 flex items-start gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-[#F59E0B] mt-1.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-bold text-[#0F172A] truncate">{t("staff.dashboard.deadlineApproaching", "Deadline approaching")}</p>
                          <span className="text-[10px] text-[#94A3B8] font-mono">4h ago</span>
                        </div>
                        <p className="text-[11px] text-[#64748B] line-clamp-1 mt-0.5">
                          {t("categories.Drainage", "Drainage")} (#SC-2026-000022)
                        </p>
                      </div>
                    </div>
                    <div className="py-2.5 flex items-start gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="font-bold text-[#0F172A] truncate">{t("staff.dashboard.statusUpdated", "Status updated")}</p>
                          <span className="text-[10px] text-[#94A3B8] font-mono">6h ago</span>
                        </div>
                        <p className="text-[11px] text-[#64748B] line-clamp-1 mt-0.5">
                          {t("categories.Street Light", "Street Light")} {t("status.IN_PROGRESS", "In Progress")}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 3. Quick Actions Widget matching screenshot */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#F0FDFA] text-[#0D9488] border border-[#CCFBF1] flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-bold text-[#0F172A]">{t("staff.dashboard.quickActions", "Quick Actions")}</h3>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <Link
                  to="/staff/tasks?status=IN_PROGRESS"
                  className="px-3 py-2 bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#0F172A] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
                >
                  <FileText className="w-3.5 h-3.5 text-[#64748B]" />
                  <span>{t("staff.dashboard.viewWorkLog", "View Work Log")}</span>
                </Link>

                <Link
                  to="/staff/tasks"
                  className="px-3 py-2 bg-[#0D9488] hover:bg-[#0F766E] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{t("staff.dashboard.captureEvidence", "Capture Evidence")}</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </StaffLayout>
  );
};

export default StaffDashboard;
