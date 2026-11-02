import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/authContex";
import { useNotification } from "../../context/notificationContext";
import LanguageSwitcher from "../LanguageSwitcher";
import {
  Menu,
  Bell,
  Calendar,
  ChevronDown,
  User,
  LogOut,
  Check,
  ArrowRight,
  ShieldCheck
} from "lucide-react";
import dayjs from "dayjs";

export const StaffHeader = ({
  title,
  subtitle,
  onToggleSidebar,
  actions = null
}) => {
  const { t } = useTranslation();
  const headerTitle = title || t("staff.dashboard.title");
  const headerSubtitle = subtitle !== undefined ? subtitle : t("staff.dashboard.subtitle");
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead } = useNotification();
  const navigate = useNavigate();

  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);

  const profileRef = useRef(null);
  const notifRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const currentDateFormatted = dayjs().format("dddd, MMMM D, YYYY");

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-[#E2E8F0] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
      {/* Left: Hamburger (mobile) + Titles */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] border border-[#E2E8F0]"
          aria-label="Toggle Navigation Drawer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-[#0F172A] tracking-tight leading-tight truncate">
            {headerTitle}
          </h1>
          {headerSubtitle && (
            <p className="text-xs text-[#64748B] hidden sm:block truncate">
              {headerSubtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: Language / Date / Bell / User Profile */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <LanguageSwitcher variant="segmented" className="hidden sm:inline-flex" />
        <LanguageSwitcher variant="compact" className="sm:hidden" />

        {actions}

        {/* Date Selector / Display Pill matching reference */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs font-semibold text-[#334155] shadow-2xs">
          <Calendar className="w-3.5 h-3.5 text-[#0D9488]" />
          <span>{currentDateFormatted}</span>
          <ChevronDown className="w-3 h-3 text-[#94A3B8]" />
        </div>

        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifDropdownOpen(!notifDropdownOpen)}
            className="relative p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] border border-[#E2E8F0] transition-colors shadow-2xs"
            aria-label={t("nav.workAlerts")}
          >
            <Bell className="w-4 h-4" />
            {(unreadCount > 0 || notifications.length > 0) && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                {unreadCount > 0 ? unreadCount : 3}
              </span>
            )}
          </button>

          {notifDropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl z-50 overflow-hidden text-left animate-in fade-in zoom-in-95">
              <div className="p-3.5 border-b border-[#F1F5F9] flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">{t("staff.notifications.title")}</h4>
                  <p className="text-[10px] text-[#64748B]">
                    {unreadCount > 0 ? `${unreadCount} ${t("citizen.notifications.unread", "unread")}` : t("common.all")}
                  </p>
                </div>
                <Link
                  to="/staff/notifications"
                  onClick={() => setNotifDropdownOpen(false)}
                  className="text-[11px] font-semibold text-[#0D9488] hover:underline"
                >
                  {t("citizen.dashboard.viewAll")}
                </Link>
              </div>

              <div className="max-h-64 overflow-y-auto divide-y divide-[#F8FAFC]">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#94A3B8]">
                    No recent alerts
                  </div>
                ) : (
                  notifications.slice(0, 4).map((n) => (
                    <div
                      key={n._id}
                      onClick={() => {
                        if (n.complaint) {
                          setNotifDropdownOpen(false);
                          navigate(`/staff/tasks/${n.complaint._id || n.complaint}`);
                        }
                      }}
                      className={`p-3 text-xs cursor-pointer hover:bg-[#F8FAFC] transition-colors ${
                        !n.isRead ? "bg-[#F0FDFA]/60" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-bold text-[#0F172A] truncate">
                          {n.title}
                        </span>
                        <span className="text-[10px] text-[#94A3B8] font-mono flex-shrink-0">
                          {dayjs(n.createdAt).fromNow()}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#64748B] line-clamp-2">
                        {n.message}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="p-2.5 bg-[#F8FAFC] border-t border-[#F1F5F9] text-center">
                <Link
                  to="/staff/notifications"
                  onClick={() => setNotifDropdownOpen(false)}
                  className="text-xs font-semibold text-[#0D9488] hover:text-[#0F766E] flex items-center justify-center gap-1"
                >
                  Go to Alerts Center <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-2 p-1 sm:pr-2.5 rounded-xl hover:bg-[#F8FAFC] border border-[#E2E8F0] transition-colors shadow-2xs"
          >
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user?.name || "Staff"}
                className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-[#0D9488] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : "AP"}
              </div>
            )}
            <span className="text-xs font-bold text-[#0F172A] hidden sm:block max-w-[120px] truncate">
              {user?.name || "Amit Patil"}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8]" />
          </button>

          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl z-50 py-1.5 text-left animate-in fade-in zoom-in-95">
              <div className="px-3.5 py-2 border-b border-[#F1F5F9]">
                <p className="text-xs font-bold text-[#0F172A] truncate">
                  {user?.name || "Amit Patil"}
                </p>
                <p className="text-[10px] text-[#64748B] truncate">
                  {user?.email || "staff@smartcity.gov"}
                </p>
                <span className="inline-block mt-1 px-1.5 py-0.2 bg-[#F0FDFA] text-[#0D9488] border border-[#CCFBF1] rounded text-[9px] font-bold">
                  {user?.department || "Waste Management"}
                </span>
              </div>

              <div className="py-1">
                <Link
                  to="/staff/profile"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="flex items-center gap-2 px-3.5 py-1.5 text-xs text-[#334155] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                >
                  <User className="w-3.5 h-3.5 text-[#64748B]" />
                  <span>{t("nav.profile")}</span>
                </Link>
                <Link
                  to="/staff/tasks"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="flex items-center gap-2 px-3.5 py-1.5 text-xs text-[#334155] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#64748B]" />
                  <span>{t("nav.tasks")}</span>
                </Link>
              </div>

              <div className="border-t border-[#F1F5F9] pt-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t("common.logout")}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default StaffHeader;
