import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AdminLayout from "../../components/admin/AdminLayout";
import PushNotificationBanner from "../../components/PushNotificationBanner";
import { useNotification } from "../../context/notificationContext";
import {
  Bell,
  Check,
  ArrowRight,
  Loader2,
  AlertTriangle,
  FilePlus,
  RotateCcw,
  CheckCheck,
  Building2
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export const AdminNotifications = () => {
  const { t } = useTranslation();
  const {
    notifications,
    loading,
    markAsRead,
    markAllAsRead,
    socketConnected
  } = useNotification();

  const getNotificationIcon = (type) => {
    switch (type) {
      case "COMPLAINT_SUBMITTED":
        return <FilePlus className="w-4 h-4 text-purple-600" />;
      case "COMPLAINT_REOPENED":
        return <RotateCcw className="w-4 h-4 text-rose-600" />;
      case "COMPLAINT_CRITICAL_ALERT":
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case "COMPLAINT_RESOLVED":
        return <CheckCheck className="w-4 h-4 text-emerald-600" />;
      default:
        return <Building2 className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <AdminLayout
      title={t("admin.notifications.title")}
      subtitle={t("admin.notifications.subtitle")}
      actions={
        notifications.some((n) => !n.isRead) && (
          <button
            type="button"
            onClick={markAllAsRead}
            className="px-3.5 py-1.5 rounded-xl bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] flex items-center gap-1.5 shadow-2xs transition-colors"
          >
            <Check className="w-3.5 h-3.5 text-[#0D9488]" /> {t("citizen.notifications.markAllRead", "Mark All Read")}
          </button>
        )
      }
    >
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center text-[#0D9488]">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-16 text-center text-[#64748B]">
            <Bell className="w-10 h-10 mx-auto text-[#CBD5E1] mb-2" />
            <p className="text-sm font-semibold text-[#0F172A]">{t("citizen.notifications.noNotifications")}</p>
            <p className="text-xs text-[#94A3B8] mt-1">{t("citizen.notifications.noNotificationsSub")}</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9]">
            {notifications.map((n) => (
              <div
                key={n._id}
                className={`p-4 sm:p-5 flex items-start justify-between gap-4 transition-colors ${
                  !n.isRead ? "bg-teal-50/40" : "hover:bg-[#F8FAFC]"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      !n.isRead ? "bg-[#0D9488]" : "bg-transparent"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-bold text-[#0F172A] truncate">
                        {n.title}
                      </h4>
                      <span className="text-[11px] text-[#94A3B8] font-mono whitespace-nowrap">
                        {dayjs(n.createdAt).fromNow()}
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                      {n.message}
                    </p>
                  </div>
                </div>

                {n.complaint && (
                  <Link
                    to={`/admin/complaints/${n.complaint._id || n.complaint}`}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#F1F5F9] border border-[#E2E8F0] text-xs font-bold text-[#0D9488] flex items-center gap-1 transition-colors flex-shrink-0 shadow-2xs"
                  >
                    {t("common.viewDetails", "Inspect")} <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminNotifications;
