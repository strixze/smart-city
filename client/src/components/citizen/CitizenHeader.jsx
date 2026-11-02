import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/authContex";
import { useNotification } from "../../context/notificationContext";
import LanguageSwitcher from "../LanguageSwitcher";
import {
  Menu,
  Search,
  Bell,
  Check,
  ChevronRight,
  ChevronDown,
  User,
  LogOut
} from "lucide-react";
import dayjs from "dayjs";

export const CitizenHeader = ({
  title,
  subtitle,
  onToggleSidebar,
  searchQuery,
  onSearchChange,
  actions = null
}) => {
  const { t } = useTranslation();
  const headerTitle = title || t("nav.dashboard");
  const headerSubtitle = subtitle !== undefined ? subtitle : t("citizen.dashboard.subtitle");
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const notifRef = useRef(null);
  const userRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifMenu(false);
      }
      if (userRef.current && !userRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = async (n) => {
    if (!n.isRead) {
      await markAsRead(n._id);
    }
    setShowNotifMenu(false);
    if (n.complaint) {
      const cid = n.complaint._id || n.complaint;
      navigate(`/citizen/complaints/${cid}`);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getInitials = (name) => {
    if (!name) return "CZ";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-[#E2E8F0] px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4 transition-colors">
      {/* Left: Hamburger & Titles */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors -ml-1"
          aria-label="Open navigation sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-extrabold text-[#0F172A] tracking-tight truncate">
            {headerTitle}
          </h1>
          {headerSubtitle && (
            <p className="text-xs text-[#64748B] mt-0.5 truncate hidden sm:block">
              {headerSubtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right Controls: Language, Search, Notifications, Profile */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Language Switcher */}
        <LanguageSwitcher variant="segmented" className="hidden sm:inline-flex" />
        <LanguageSwitcher variant="compact" className="sm:hidden" />

        {/* Search input (if onSearchChange provided) */}
        {onSearchChange !== undefined && (
          <div className="relative hidden md:block w-56 lg:w-64">
            <input
              type="text"
              value={searchQuery || ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t("citizen.complaints.searchPlaceholder") || "Search complaints..."}
              className="w-full pl-9 pr-4 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#0D9488] focus:bg-white transition-colors"
            />
            <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-2.5" />
          </div>
        )}

        {/* Notifications Icon Button with Flyout */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setShowNotifMenu(!showNotifMenu)}
            className="relative p-2 bg-white border border-[#E2E8F0] rounded-xl text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] shadow-2xs transition-colors"
            title={t("nav.notifications")}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Clean Notification Dropdown */}
          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl z-50 overflow-hidden text-[#0F172A]">
              <div className="p-3.5 px-4 border-b border-[#F1F5F9] flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#0F172A]">{t("citizen.notifications.title")}</h4>
                  <p className="text-[11px] text-[#64748B]">
                    {unreadCount} {t("citizen.notifications.unread", "unread")}
                  </p>
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-[11px] font-semibold text-[#0D9488] hover:underline flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" /> {t("citizen.notifications.markAllRead")}
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-[#F1F5F9]">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#94A3B8]">
                    {t("citizen.notifications.noNotifications")}
                  </div>
                ) : (
                  notifications.slice(0, 6).map((n) => (
                    <div
                      key={n._id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3.5 flex items-start gap-3 cursor-pointer hover:bg-[#F8FAFC] transition-colors ${
                        !n.isRead ? "bg-teal-50/40" : ""
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          !n.isRead ? "bg-[#0D9488]" : "bg-transparent"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-[#0F172A] truncate">
                            {n.title}
                          </p>
                          <span className="text-[10px] text-[#94A3B8] font-mono whitespace-nowrap">
                            {dayjs(n.createdAt).fromNow()}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#64748B] mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-2.5 bg-[#F8FAFC] border-t border-[#F1F5F9] text-center">
                <Link
                  to="/citizen/notifications"
                  onClick={() => setShowNotifMenu(false)}
                  className="text-xs font-semibold text-[#0D9488] hover:underline inline-flex items-center gap-1"
                >
                  {t("citizen.dashboard.viewAll")} <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill with Dropdown Menu */}
        <div className="relative" ref={userRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#CBD5E1] shadow-2xs transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-[#0D9488] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user?.name || "Citizen"}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                getInitials(user?.name)
              )}
            </div>
            <span className="hidden sm:block text-xs font-semibold text-[#0F172A] max-w-[120px] truncate">
              {user?.name || "Citizen"}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8] hidden sm:block" />
          </button>

          {/* User Menu Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-[#E2E8F0] rounded-xl shadow-xl z-50 py-1.5 text-xs text-[#0F172A]">
              <div className="px-3.5 py-2 border-b border-[#F1F5F9]">
                <p className="font-bold truncate">{user?.name || "Citizen"}</p>
                <p className="text-[11px] text-[#64748B] truncate">{user?.email}</p>
              </div>
              <Link
                to="/citizen/profile"
                onClick={() => setShowUserMenu(false)}
                className="flex items-center gap-2 px-3.5 py-2 hover:bg-[#F8FAFC] text-[#334155]"
              >
                <User className="w-3.5 h-3.5" />
                <span>{t("nav.profile")}</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3.5 py-2 hover:bg-rose-50 text-rose-600 text-left"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t("common.logout")}</span>
              </button>
            </div>
          )}
        </div>

        {actions}
      </div>
    </header>
  );
};

export default CitizenHeader;
