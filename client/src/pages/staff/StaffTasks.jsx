import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import StaffLayout from "../../components/staff/StaffLayout";
import StatusBadge from "../../components/StatusBadge";
import PriorityBadge from "../../components/PriorityBadge";
import { staffApi, getImageUrl } from "../../api/client";
import {
  getLocalizedCategory,
  getLocalizedSubcategory,
  getLocalizedStatus,
  getLocalizedPriority,
  formatDate
} from "../../utils/formatters";
import {
  Search,
  CheckSquare,
  MapPin,
  Calendar,
  Loader2,
  ArrowRight,
  Image as ImageIcon,
  RefreshCw,
  Phone,
  User,
  Filter,
  CheckCircle2,
  Clock
} from "lucide-react";
import dayjs from "dayjs";

export const StaffTasks = () => {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialStatus = searchParams.get("status") || "ALL";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState([]);

  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  // Sync state if URL changes
  useEffect(() => {
    const s = searchParams.get("status");
    if (s && s !== statusFilter) {
      setStatusFilter(s);
    }
  }, [searchParams]);

  const fetchTasks = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else if (!tasks.length) setLoading(true);

      const res = await staffApi.getTasks({
        status: statusFilter,
        priority: priorityFilter,
        search
      });
      if (res.data?.data) {
        setTasks(res.data.data.tasks || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 15000);
    return () => clearInterval(interval);
  }, [statusFilter, priorityFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchTasks();
  };

  const handleTabChange = (status) => {
    setStatusFilter(status);
    if (status === "ALL") {
      searchParams.delete("status");
    } else {
      searchParams.set("status", status);
    }
    setSearchParams(searchParams);
  };

  return (
    <StaffLayout
      title={t("staff.tasks.title", "Assigned Field Tasks")}
      subtitle={t("staff.tasks.subtitle", "Grievances dispatched to your department requiring on-site resolution")}
      actions={
        <button
          type="button"
          onClick={() => fetchTasks(true)}
          disabled={refreshing}
          className="px-3.5 py-1.5 rounded-xl bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] flex items-center gap-1.5 shadow-2xs transition-colors"
          title={t("common.refresh", "Refresh")}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-[#0D9488] ${
              refreshing ? "animate-spin" : ""
            }`}
          />
          <span>{refreshing ? t("common.loading", "Refreshing...") : t("common.refresh", "Refresh")}</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* FILTERS & SEARCH TOOLBAR */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#E2E8F0] shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row items-center gap-3">
            {/* Search Input */}
            <form onSubmit={handleSearch} className="flex-1 relative w-full">
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("staff.tasks.searchPlaceholder", "Search by complaint ID, issue title, or street address...")}
                className="w-full pl-10 pr-4 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs sm:text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#0D9488] focus:bg-white transition-all"
              />
            </form>

            {/* Dropdown Filters */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => handleTabChange(e.target.value)}
                className="w-full md:w-auto px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#0D9488]"
              >
                <option value="ALL">{t("common.allStatuses", "All Statuses")}</option>
                <option value="ASSIGNED">{t("status.ASSIGNED", "Assigned")} / {t("status.Pending", "Pending")}</option>
                <option value="IN_PROGRESS">{t("status.IN_PROGRESS", "In Progress")}</option>
                <option value="RESOLVED">{t("status.RESOLVED", "Resolved")}</option>
                <option value="REOPENED">{t("status.REOPENED", "Reopened")}</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full md:w-auto px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:border-[#0D9488]"
              >
                <option value="ALL">{t("common.allPriorities", "All Priorities")}</option>
                <option value="CRITICAL">{t("priority.CRITICAL", "Critical")}</option>
                <option value="HIGH">{t("priority.HIGH", "High")}</option>
                <option value="MEDIUM">{t("priority.MEDIUM", "Medium")}</option>
                <option value="LOW">{t("priority.LOW", "Low")}</option>
              </select>
            </div>
          </div>

          {/* Quick Status Tabs */}
          <div className="flex items-center gap-1.5 pt-2 border-t border-[#F1F5F9] overflow-x-auto text-xs font-semibold">
            {[
              { label: t("common.all", "All Tasks"), value: "ALL" },
              { label: t("staff.dashboard.pendingFieldVisit", "Pending Visit"), value: "ASSIGNED" },
              { label: t("status.IN_PROGRESS", "In Progress"), value: "IN_PROGRESS" },
              { label: t("status.RESOLVED", "Resolved"), value: "RESOLVED" },
              { label: t("status.REOPENED", "Reopened"), value: "REOPENED" }
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => handleTabChange(tab.value)}
                className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                  statusFilter === tab.value
                    ? "bg-[#0D9488] text-white shadow-2xs"
                    : "text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* TASKS GRID */}
        {loading ? (
          <div className="py-24 flex justify-center text-[#0D9488]">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-[#E2E8F0] shadow-xs max-w-md mx-auto">
            <CheckSquare className="w-10 h-10 text-[#94A3B8] mx-auto mb-3" />
            <h3 className="text-sm font-bold text-[#0F172A]">{t("staff.tasks.empty", "No tasks found")}</h3>
            <p className="text-xs text-[#64748B] mt-1">
              {t("staff.tasks.noTasks", "There are currently no assigned tasks matching your filter criteria.")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {tasks.map((task) => {
              const beforeUrl = task.beforeImage
                ? getImageUrl(task.beforeImage?.imageUrl || task.beforeImage)
                : null;
              const isHighPriority =
                task.priority === "CRITICAL" || task.priority === "HIGH";

              return (
                <div
                  key={task._id}
                  className={`bg-white rounded-2xl p-5 border shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
                    isHighPriority
                      ? "border-amber-300 ring-1 ring-amber-100"
                      : "border-[#E2E8F0] hover:border-[#CBD5E1]"
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header Row: ID + Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-[#0D9488] bg-[#F0FDFA] px-2.5 py-1 rounded-md border border-[#CCFBF1]">
                        #{task.complaintNumber}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <PriorityBadge priority={task.priority} size="sm" />
                        <StatusBadge status={task.status} size="sm" />
                      </div>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h3 className="font-bold text-[#0F172A] text-sm sm:text-base line-clamp-1">
                        {task.title}
                      </h3>
                      <p className="text-xs text-[#64748B] line-clamp-2 leading-relaxed mt-1">
                        {task.description}
                      </p>
                    </div>

                    {/* Image & Location metadata */}
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                      {beforeUrl ? (
                        <img
                          src={beforeUrl}
                          alt="Before"
                          className="w-14 h-14 rounded-lg object-cover border border-[#E2E8F0] flex-shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center text-[#94A3B8] flex-shrink-0">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      )}

                      <div className="flex flex-col text-xs space-y-1 min-w-0">
                        <span className="flex items-center gap-1 font-semibold text-[#0F172A] truncate">
                          <MapPin className="w-3.5 h-3.5 text-[#0D9488] flex-shrink-0" />
                          <span className="truncate">{task.locationAddress}</span>
                        </span>
                        <span className="text-[11px] text-[#64748B] flex items-center gap-1 truncate">
                          <User className="w-3 h-3 text-[#94A3B8] flex-shrink-0" />
                          {task.citizen?.name || t("auth.login.demoCitizen", "Citizen")} ({task.citizen?.phone || "No phone"})
                        </span>
                        <span className="text-[10px] text-[#0D9488] font-bold">
                          {getLocalizedCategory(task.category, t)} • {getLocalizedSubcategory(task.subcategory, t)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Row: Timestamp + Action Link */}
                  <div className="pt-3 mt-4 border-t border-[#F1F5F9] flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-[#64748B]">
                      <Calendar className="w-3.5 h-3.5 text-[#94A3B8]" />
                      {formatDate(task.createdAt, i18n.language)}
                    </span>

                    <Link
                      to={`/staff/tasks/${task._id}`}
                      className="px-3.5 py-1.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5"
                    >
                      {task.status === "ASSIGNED" || task.status === "PENDING"
                        ? t("staff.tasks.startWork", "Start Work")
                        : task.status === "IN_PROGRESS"
                        ? t("staff.tasks.submitProof", "Submit Proof")
                        : t("staff.tasks.viewTask", "Inspect Task")}{" "}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </StaffLayout>
  );
};

export default StaffTasks;
