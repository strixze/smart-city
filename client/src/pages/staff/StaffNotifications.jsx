import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import StaffLayout from "../../components/staff/StaffLayout";
import PushNotificationBanner from "../../components/PushNotificationBanner";
import { useNotification } from "../../context/notificationContext";
import {
  Bell,
  Check,
  ArrowRight,
  Loader2,
  Clock,
  AlertTriangle,
  Briefcase,
  CheckCheck,
  Inbox
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export const StaffNotifications = () => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("all"); // 'all' | 'unread'
  const {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    socketConnected
  } = useNotification();

  const handleMarkAll = async () => {
    try {
      await markAllAsRead();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkOne = async (id) => {
    try {
      await markAsRead(id);
    } catch (err) {
      console.error(err);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "COMPLAINT_RESOLVED":
      case "WORK_COMPLETED":
        return (
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-200">
            <CheckCheck className="w-4 h-4" />
          </div>
        );
      case "COMPLAINT_CRITICAL_ALERT":
      case "PRIORITY_CHANGED":
        return (
          <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0 border border-rose-200">
            <AlertTriangle className="w-4 h-4" />
          </div>
        );
      case "STAFF_ASSIGNED":
        return (
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 border border-amber-200">
            <Briefcase className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0 border border-slate-200">
            <Clock className="w-4 h-4" />
          </div>
        );
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead;
    return true;
  });

  return (
    <StaffLayout
      title={t("staff.notifications.title", "Alerts & Assignments")}
      subtitle={t("staff.notifications.subtitle", "Real-time field dispatches, status updates, and priority escalations")}
      actions={
        notifications.some((n) => !n.isRead) ? (
          <button
            onClick={handleMarkAll}
            className="px-3.5 py-1.5 rounded-lg bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] flex items-center gap-1.5 shadow-2xs transition-colors"
          >
            <Check className="w-3.5 h-3.5 text-[#0D9488]" /> {t("citizen.notifications.markAllRead", "Mark All Read")}
          </button>
        ) : null
      }
    >
      <div className="space-y-5 max-w-4xl">
        <PushNotificationBanner />

        {/* Notifications Card */}
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
          {/* Header & Tabs */}
          <div className="p-4 sm:p-5 border-b border-[#F1F5F9] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#0F172A]">{t("staff.notifications.title", "All Field Alerts")}</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#F0FDFA] text-[#0D9488] border border-[#CCFBF1]">
                  {unreadCount} {t("citizen.notifications.unreadTab", "unread")}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 bg-[#F8FAFC] p-1 rounded-xl border border-[#E2E8F0] self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filter === "all"
                    ? "bg-white text-[#0F172A] shadow-2xs"
                    : "text-[#64748B] hover:text-[#0F172A]"
                }`}
              >
                {t("common.all", "All")} ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filter === "unread"
                    ? "bg-white text-[#0D9488] shadow-2xs"
                    : "text-[#64748B] hover:text-[#0D9488]"
                }`}
              >
                {t("citizen.notifications.unreadTab", "Unread")} ({unreadCount})
              </button>
            </div>
          </div>

          {/* List Content */}
          {loading ? (
            <div className="py-20 flex justify-center text-[#0D9488]">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-16 text-center text-[#64748B] px-4">
              <div className="w-12 h-12 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center mx-auto mb-3 text-[#94A3B8]">
                <Inbox className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-[#0F172A]">
                {filter === "unread" ? t("citizen.notifications.noUnread", "No unread alerts") : t("citizen.notifications.noNotifications", "No alerts recorded")}
              </p>
              <p className="text-xs text-[#64748B] mt-1 max-w-sm mx-auto">
                {filter === "unread"
                  ? t("citizen.notifications.allCaughtUp", "All dispatch notifications have been acknowledged.")
                  : t("citizen.notifications.noNotificationsSub", "Field task assignments and municipal alerts will appear here in real time.")}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {filteredNotifications.map((n) => {
                const complaintId = n.complaint?._id || n.complaint;

                return (
                  <div
                    key={n._id}
                    className={`p-4 sm:p-5 flex items-start justify-between gap-4 transition-colors ${
                      !n.isRead ? "bg-[#F0FDFA]/60 hover:bg-[#F0FDFA]" : "hover:bg-[#F8FAFC]"
                    }`}
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      {getNotificationIcon(n.type)}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-bold text-[#0F172A] truncate">
                            {n.title}
                          </h4>
                          {!n.isRead && (
                            <span className="w-2 h-2 rounded-full bg-[#0D9488] flex-shrink-0" />
                          )}
                          <span className="text-[11px] text-[#94A3B8] font-medium">
                            {dayjs(n.createdAt).fromNow()}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-[#475569] mt-1 leading-relaxed">
                          {n.message}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {complaintId && (
                        <Link
                          to={`/staff/tasks/${complaintId}`}
                          onClick={() => handleMarkOne(n._id)}
                          className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#F8FAFC] text-xs font-semibold text-[#0D9488] border border-[#E2E8F0] hover:border-[#0D9488]/40 flex items-center gap-1 transition-all shadow-2xs whitespace-nowrap"
                        >
                          {t("staff.tasks.viewTask", "Inspect Task")} <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </StaffLayout>
  );
};

export default StaffNotifications;
