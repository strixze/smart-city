import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/authContex";
import { useNotification } from "../context/notificationContext";
import SmartCityLogo from "./SmartCityLogo";
import LanguageSwitcher from "./LanguageSwitcher";
import {
  Bell,
  LogOut,
  User,
  Shield,
  Briefcase,
  Check,
  Menu,
  X,
  Search,
  Megaphone
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export const Navbar = ({ onToggleSidebar }) => {
  const { t } = useTranslation();
  const { user, role, logout } = useAuth();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead
  } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(true);

  const notifRef = useRef(null);
  const userRef = useRef(null);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (userRef.current && !userRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.isRead) {
        await markAsRead(notif._id);
      }
      setShowNotifications(false);

      if (notif.complaint) {
        const complaintId = notif.complaint._id || notif.complaint;
        if (role === "ADMIN") navigate(`/admin/complaints/${complaintId}`);
        else if (role === "STAFF") navigate(`/staff/complaints/${complaintId}`);
        else navigate(`/citizen/complaints/${complaintId}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getRoleBadge = () => {
    if (role === "ADMIN") {
      return (
        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
          <Shield className="w-3.5 h-3.5 text-teal-600" /> {t("nav.adminPortal")}
        </span>
      );
    }
    if (role === "STAFF") {
      return (
        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Briefcase className="w-3.5 h-3.5 text-amber-600" /> {t("nav.staffPortal")} ({user?.department || "Field"})
        </span>
      );
    }
    return (
      <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        <User className="w-3.5 h-3.5 text-slate-500" /> {t("nav.citizenPortal")}
      </span>
    );
  };

  return (
    <>
      {/* Civic Advisory Top Announcement Banner */}
      {showBanner && !user && (
        <div className="bg-[#F0FDFA] border-b border-teal-200/70 text-[#0D9488] text-xs py-2 px-3 sm:px-4 relative z-40 transition-all flex items-center justify-between">
          <div className="max-w-7xl mx-auto flex items-center gap-1.5 sm:gap-2 text-center w-full justify-center min-w-0 pr-2">
            <Megaphone className="w-3.5 h-3.5 text-[#0D9488] flex-shrink-0" />
            <span className="font-bold text-[#0D9488] tracking-wider text-[10px] sm:text-xs uppercase whitespace-nowrap">
              {t("app.title")}
            </span>
            <span className="text-[#0D9488] opacity-60 hidden sm:inline">•</span>
            <span className="font-medium text-[#0D9488] text-[11px] sm:text-xs truncate sm:overflow-visible">
              {t("app.subtitle")}
            </span>
            <Link
              to="/citizen/report"
              className="hidden lg:inline font-semibold text-[#0D9488] underline ml-2 hover:opacity-80 whitespace-nowrap"
            >
              {t("nav.reportComplaint")} &rarr;
            </Link>
          </div>
          <button
            onClick={() => setShowBanner(false)}
            className="text-[#0D9488]/70 hover:text-[#0D9488] p-1 rounded-md transition-colors flex-shrink-0"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] shadow-xs transition-all text-[#0F172A]">
        <div className={`w-full px-3 sm:px-6 lg:px-8 ${!user ? "max-w-7xl mx-auto" : ""}`}>
          <div className="flex items-center justify-between h-16 sm:h-18">
            {/* Left: Hamburger + Brand */}
            <div className="flex items-center gap-3">
              {user && onToggleSidebar && (
                <button
                  onClick={onToggleSidebar}
                  className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none transition-colors"
                  aria-label="Toggle Navigation"
                >
                  <Menu className="w-5 h-5" />
                </button>
              )}

              <SmartCityLogo variant="dark-text" size="md" />

              {user && getRoleBadge()}
            </div>

            {/* Center Links (Shown for public/home view) */}
            {!user && (
              <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
                <Link
                  to="/"
                  className={`relative py-2 text-sm font-semibold transition-colors ${
                    location.pathname === "/"
                      ? "text-[#0D9488]"
                      : "text-[#0F172A] hover:text-[#0D9488]"
                  }`}
                >
                  {t("nav.home")}
                  {location.pathname === "/" && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#0D9488] rounded-full" />
                  )}
                </Link>
                <Link
                  to="/citizen/report"
                  className="text-[#475569] hover:text-[#0D9488] transition-colors"
                >
                  {t("nav.reportComplaint")}
                </Link>
                <Link
                  to="/citizen/complaints"
                  className="text-[#475569] hover:text-[#0D9488] transition-colors"
                >
                  {t("nav.myComplaints")}
                </Link>
                <a
                  href="#how-it-works"
                  className="text-[#475569] hover:text-[#0D9488] transition-colors"
                >
                  {t("home.howItWorksTitle")}
                </a>
              </nav>
            )}

            {/* Right: Language Switcher & Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              <LanguageSwitcher variant="segmented" className="hidden sm:inline-flex" />
              <LanguageSwitcher variant="compact" className="sm:hidden" />

              {user ? (
                <>
                  {/* In-App Notifications Bell */}
                  <div className="relative" ref={notifRef}>
                    <button
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="relative p-2.5 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                      aria-label="Notifications"
                    >
                      <Bell className="w-5 h-5" />
                      {unreadCount > 0 && (
                        <>
                          <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                            {unreadCount > 9 ? "9+" : unreadCount}
                          </span>
                          <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 animate-ping opacity-75 pointer-events-none" />
                        </>
                      )}
                    </button>

                    {/* Notification Dropdown / Mobile Modal */}
                    {showNotifications && (
                      <>
                        <div
                          className="md:hidden fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs"
                          onClick={() => setShowNotifications(false)}
                        />

                        <div
                          className={[
                            "bg-white rounded-2xl shadow-xl border border-[#E2E8F0] overflow-hidden z-50 text-[#0F172A]",
                            "md:absolute md:right-0 md:mt-2 md:w-[380px]",
                            "fixed inset-x-0 mx-4 md:mx-0 md:inset-x-auto",
                            "top-[4.5rem] md:top-auto",
                            "max-w-[380px] md:max-w-none",
                            "w-[calc(100%-2rem)] md:w-[380px]",
                          ].join(" ")}
                          style={{
                            maxHeight: "calc(100vh - 5.5rem - 5rem - env(safe-area-inset-bottom, 0px))",
                          }}
                        >
                          <div className="px-4 py-3 bg-slate-50 border-b border-[#E2E8F0] flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-[#0F172A]">Notifications</h4>
                              {unreadCount > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-teal-50 text-[#0D9488] text-xs font-semibold border border-teal-200">
                                  {unreadCount} new
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {unreadCount > 0 && (
                                <button
                                  onClick={handleMarkAllRead}
                                  className="text-xs font-medium text-[#0D9488] hover:text-teal-700 flex items-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" /> Mark all read
                                </button>
                              )}
                              <button
                                onClick={() => setShowNotifications(false)}
                                className="md:hidden p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                aria-label="Close notifications"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="overflow-y-auto divide-y divide-slate-100 flex-1" style={{ maxHeight: "calc(100vh - 5.5rem - 5rem - 6.5rem - env(safe-area-inset-bottom, 0px))" }}>
                            {notifications.length === 0 ? (
                              <div className="py-8 text-center text-sm text-slate-500">
                                No notifications yet.
                              </div>
                            ) : (
                              notifications.map((n) => (
                                <div
                                  key={n._id}
                                  onClick={() => handleNotificationClick(n)}
                                  className={`p-3.5 hover:bg-slate-50 cursor-pointer transition-colors ${
                                    !n.isRead ? "bg-teal-50/40" : ""
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-xs font-semibold text-[#0F172A]">{n.title}</p>
                                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                      {dayjs(n.createdAt).fromNow()}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">{n.message}</p>
                                </div>
                              ))
                            )}
                          </div>

                          <div className="p-2.5 bg-slate-50 border-t border-[#E2E8F0] text-center flex-shrink-0">
                            <Link
                              to={
                                role === "ADMIN"
                                  ? "/admin/notifications"
                                  : role === "STAFF"
                                  ? "/staff/notifications"
                                  : "/citizen/notifications"
                              }
                              onClick={() => setShowNotifications(false)}
                              className="text-xs font-medium text-[#0D9488] hover:underline"
                            >
                              View all notifications
                            </Link>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* User Menu */}
                  <div className="relative" ref={userRef}>
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="flex items-center gap-2.5 p-1 rounded-full hover:bg-slate-100 transition-colors focus:outline-none"
                    >
                      <img
                        src={user?.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"}
                        alt={user?.name}
                        className="w-9 h-9 rounded-full object-cover border-2 border-[#E2E8F0]"
                      />
                      <div className="hidden md:flex flex-col text-left">
                        <span className="text-sm font-semibold text-[#0F172A] max-w-[120px] truncate leading-tight">
                          {user?.name}
                        </span>
                        <span className="text-[10px] font-medium text-slate-500 capitalize">
                          {user?.role?.toLowerCase()}
                        </span>
                      </div>
                    </button>

                    {showUserMenu && (
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-[#E2E8F0] py-2 z-50 text-[#0F172A]">
                        <div className="px-4 py-2.5 border-b border-slate-100">
                          <p className="text-sm font-semibold text-[#0F172A] truncate">{user?.name}</p>
                          <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                          <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-700 uppercase border border-teal-200">
                            {user?.role}
                          </span>
                        </div>

                        <Link
                          to={
                            role === "ADMIN"
                              ? "/admin/profile"
                              : role === "STAFF"
                              ? "/staff/profile"
                              : "/citizen/profile"
                          }
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <User className="w-4 h-4 text-slate-400" /> {t("nav.profile")}
                        </Link>

                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            logout();
                            navigate("/login");
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 text-left transition-colors"
                        >
                          <LogOut className="w-4 h-4" /> {t("common.logout")}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-1.5 sm:gap-2.5">
                  <a
                    href="#track-section"
                    aria-label="Search complaints"
                    className="p-1.5 sm:p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors flex-shrink-0"
                  >
                    <Search className="w-4 h-4" />
                  </a>
                  <Link
                    to="/login"
                    className="hidden sm:inline-block px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-[#0F172A] hover:text-[#0D9488] transition-colors whitespace-nowrap"
                  >
                    {t("common.login")}
                  </Link>
                  <Link
                    to="/register"
                    className="px-2.5 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#0D9488] hover:bg-[#0f766e] rounded-xl shadow-xs transition-all whitespace-nowrap flex-shrink-0"
                  >
                    {t("common.register")}
                  </Link>
                  <button
                    onClick={() => setMobileNavOpen(!mobileNavOpen)}
                    className="md:hidden p-1.5 sm:p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors flex-shrink-0"
                    aria-label="Toggle navigation menu"
                  >
                    {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile public dropdown menu */}
        {!user && mobileNavOpen && (
          <div className="md:hidden border-t border-[#E2E8F0] bg-white px-4 py-4 space-y-2.5 shadow-lg animate-in slide-in-from-top-2">
            <div className="pb-2 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">{t("common.language")}</span>
              <LanguageSwitcher variant="segmented" />
            </div>
            <Link
              to="/"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 text-sm font-semibold text-[#0D9488]"
            >
              {t("nav.home")}
            </Link>
            <Link
              to="/citizen/report"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 text-sm font-medium text-[#475569] hover:text-[#0D9488]"
            >
              {t("nav.reportComplaint")}
            </Link>
            <Link
              to="/citizen/complaints"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 text-sm font-medium text-[#475569] hover:text-[#0D9488]"
            >
              {t("nav.myComplaints")}
            </Link>
            <a
              href="#how-it-works"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 text-sm font-medium text-[#475569] hover:text-[#0D9488]"
            >
              {t("home.howItWorksTitle")}
            </a>
            <a
              href="#features"
              onClick={() => setMobileNavOpen(false)}
              className="block py-2 text-sm font-medium text-[#475569] hover:text-[#0D9488]"
            >
              {t("home.featuresTitle")}
            </a>
            <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
              <Link
                to="/login"
                onClick={() => setMobileNavOpen(false)}
                className="flex-1 py-2 text-center text-sm font-semibold text-[#0F172A] border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                {t("common.login")}
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileNavOpen(false)}
                className="flex-1 py-2 text-center text-sm font-semibold text-white bg-[#0D9488] hover:bg-[#0f766e] rounded-xl transition-colors shadow-xs"
              >
                {t("common.register")}
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
};

export default Navbar;
