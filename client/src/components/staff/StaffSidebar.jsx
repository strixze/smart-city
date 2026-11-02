import React, { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/authContex";
import { useNotification } from "../../context/notificationContext";
import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  FileText,
  Bell,
  User,
  LogOut,
  ChevronRight,
  X,
  MapPin
} from "lucide-react";

export const StaffSidebar = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { unreadCount } = useNotification();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const currentPath = location.pathname;
  const searchParams = new URLSearchParams(location.search);
  const statusParam = searchParams.get("status");

  const navItems = [
    {
      name: t("nav.dashboard"),
      path: "/staff/dashboard",
      icon: LayoutDashboard,
      isActive: currentPath === "/staff/dashboard"
    },
    {
      name: t("nav.tasks"),
      path: "/staff/tasks",
      icon: ClipboardList,
      isActive: currentPath === "/staff/tasks" && !statusParam
    },
    {
      name: t("common.status") + ": " + t("status.IN_PROGRESS"),
      path: "/staff/tasks?status=IN_PROGRESS",
      icon: CalendarDays,
      isActive: currentPath === "/staff/tasks" && statusParam === "IN_PROGRESS"
    },
    {
      name: t("common.status") + ": " + t("status.RESOLVED"),
      path: "/staff/tasks?status=RESOLVED",
      icon: FileText,
      isActive: currentPath === "/staff/tasks" && statusParam === "RESOLVED"
    },
    {
      name: t("nav.workAlerts"),
      path: "/staff/notifications",
      icon: Bell,
      badge: unreadCount > 0 ? unreadCount : 3,
      isActive: currentPath === "/staff/notifications"
    },
    {
      name: t("nav.profile"),
      path: "/staff/profile",
      icon: User,
      isActive: currentPath === "/staff/profile"
    }
  ];

  const departmentLabel = `${t("nav.staffPortal").toUpperCase()} (${(user?.department || "FIELD").toUpperCase()})`;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-[230px] bg-white border-r border-[#E2E8F0] flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Logo / Brand Header matching Admin Panel */}
          <div className="h-16 px-5 flex items-center justify-between border-b border-[#F1F5F9]">
            <NavLink
              to="/staff/dashboard"
              onClick={onClose}
              className="flex items-center gap-2.5 group"
            >
              {/* Fixly-style Location / City Pin Icon */}
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 flex items-center justify-center text-[#0D9488] flex-shrink-0 group-hover:scale-105 transition-transform">
                <MapPin className="w-4 h-4 fill-[#0D9488] text-[#0D9488]" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-extrabold text-[15px] text-[#0F172A] tracking-tight">
                  Smart<span className="text-[#0D9488]">City</span>
                </span>
                <span className="text-[10px] text-[#64748B] font-medium tracking-wide">
                  City Dashboard
                </span>
              </div>
            </NavLink>

            {/* Mobile close button */}
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-1 text-[#64748B] hover:text-[#0F172A] rounded-lg hover:bg-[#F8FAFC]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Role Category Label */}
          <div className="px-5 pt-4 pb-2">
            <span className="text-[10px] font-extrabold tracking-wider text-[#64748B] uppercase block truncate">
              {departmentLabel}
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.isActive;

              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => onClose && onClose()}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    active
                      ? "bg-[#F0FDFA] text-[#0D9488]"
                      : "text-[#334155] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        active ? "text-[#0D9488]" : "text-[#64748B]"
                      }`}
                    />
                    <span className="truncate">{item.name}</span>
                  </div>

                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="w-4 h-4 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer: Staff User Card & Logout */}
        <div className="p-3 border-t border-[#F1F5F9] space-y-2">
          {/* User Preview */}
          <Link
            to="/staff/profile"
            onClick={() => onClose && onClose()}
            className="flex items-center justify-between p-2 rounded-xl hover:bg-[#F8FAFC] transition-colors group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user?.name || "Staff"}
                  className="w-8 h-8 rounded-full object-cover border border-[#E2E8F0] flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#0D9488] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                  {user?.name ? user.name.slice(0, 2).toUpperCase() : "AP"}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#0F172A] truncate leading-tight">
                  {user?.name || "Amit Patil"}
                </p>
                <p className="text-[10px] text-[#64748B] truncate">
                  {user?.designation || "Field Staff"}
                </p>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#0F172A] transition-colors flex-shrink-0" />
          </Link>

          {/* Logout Action */}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#64748B] hover:text-[#DC2626] hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>{t("common.logout")}</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default StaffSidebar;
