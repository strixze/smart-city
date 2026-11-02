import React from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/authContex";
import { useNotification } from "../../context/notificationContext";
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  Bell,
  User,
  LogOut,
  X,
  MapPin,
  ChevronRight
} from "lucide-react";

export const CitizenSidebar = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { unreadCount } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navLinks = [
    {
      name: t("nav.dashboard"),
      path: "/citizen/dashboard",
      icon: LayoutDashboard,
      exact: true
    },
    {
      name: t("nav.myComplaints"),
      path: "/citizen/complaints",
      icon: FileText
    },
    {
      name: t("nav.newComplaint"),
      path: "/citizen/report",
      icon: PlusCircle,
      isPrimaryAction: true
    },
    {
      name: t("nav.notifications"),
      path: "/citizen/notifications",
      icon: Bell,
      badge: unreadCount > 0 ? unreadCount : null
    },
    {
      name: t("nav.profile"),
      path: "/citizen/profile",
      icon: User
    }
  ];

  const getInitials = (name) => {
    if (!name) return "CZ";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Clean White Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-[230px] bg-white border-r border-[#E2E8F0] z-50 transition-transform duration-200 ease-in-out lg:translate-x-0 flex flex-col justify-between ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Logo / Brand Header */}
          <div className="h-16 px-5 flex items-center justify-between border-b border-[#F1F5F9]">
            <NavLink
              to="/citizen/dashboard"
              onClick={onClose}
              className="flex items-center gap-2.5 group"
            >
              {/* Civic Pin Icon */}
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 flex items-center justify-center text-[#0D9488] flex-shrink-0 group-hover:scale-105 transition-transform">
                <MapPin className="w-4 h-4 fill-[#0D9488] text-[#0D9488]" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-extrabold text-[15px] text-[#0F172A] tracking-tight">
                  Smart<span className="text-[#0D9488]">City</span>
                </span>
                <span className="text-[10px] text-[#64748B] font-medium tracking-wide">
                  {t("app.tagline")}
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

          {/* Navigation Items */}
          <div className="px-3 py-4 space-y-4">
            <div className="px-3 pb-1 text-[10px] font-bold text-[#94A3B8] tracking-wider uppercase">
              {t("nav.citizenPortal")}
            </div>

            <nav className="space-y-1">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isNewReport = item.isPrimaryAction;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.exact}
                    onClick={onClose}
                    className={({ isActive }) => {
                      if (isActive) {
                        return "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold bg-[#F0FDFA] text-[#0D9488] transition-colors";
                      }
                      if (isNewReport) {
                        return "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-[#0D9488] bg-teal-50/70 hover:bg-teal-100/60 transition-colors";
                      }
                      return "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition-colors";
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.name}</span>
                    </div>

                    {item.badge && (
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold min-w-4 text-center">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Profile and Logout Section */}
        <div className="p-3 border-t border-[#E2E8F0] bg-white space-y-1">
          <NavLink
            to="/citizen/profile"
            onClick={onClose}
            className="flex items-center justify-between p-2 rounded-xl hover:bg-[#F8FAFC] transition-colors group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#0D9488] text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-2xs">
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
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-[#0F172A] truncate group-hover:text-[#0D9488]">
                  {user?.name || "Citizen"}
                </span>
                <span className="text-[10px] text-[#64748B] truncate">
                  {t("nav.citizenPortal")}
                </span>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#0D9488] transition-colors" />
          </NavLink>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#64748B] hover:text-rose-600 hover:bg-rose-50 transition-colors text-left"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t("common.logout")}</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default CitizenSidebar;
