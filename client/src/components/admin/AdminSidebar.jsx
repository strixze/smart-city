import React from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/authContex";
import { useNotification } from "../../context/notificationContext";
import {
  LayoutDashboard,
  Map,
  FileText,
  Wrench,
  Megaphone,
  BarChart3,
  Users,
  UserCheck,
  Settings,
  LogOut,
  X,
  MapPin
} from "lucide-react";

export const AdminSidebar = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { unreadCount } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navGroups = [
    {
      group: t("nav.adminPortal").toUpperCase(),
      items: [
        {
          name: t("nav.dashboard"),
          path: "/admin/dashboard",
          icon: LayoutDashboard,
          exact: true
        }
      ]
    },
    {
      group: t("common.actions").toUpperCase(),
      items: [
        {
          name: t("nav.complaints"),
          path: "/admin/complaints",
          icon: FileText
        },
        {
          name: t("nav.staffManagement"),
          path: "/admin/staff",
          icon: Users
        },
        {
          name: t("nav.notifications"),
          path: "/admin/notifications",
          icon: Megaphone,
          badge: unreadCount > 0 ? unreadCount : null
        }
      ]
    },
    {
      group: t("nav.analytics").toUpperCase(),
      items: [
        {
          name: t("nav.analytics"),
          path: "/admin/analytics",
          icon: BarChart3
        },
        {
          name: t("nav.profile"),
          path: "/admin/profile",
          icon: UserCheck
        }
      ]
    }
  ];

  // Helper for admin initials
  const getInitials = (name) => {
    if (!name) return "AD";
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
              to="/admin/dashboard"
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

          {/* Nav Groups */}
          <div className="px-3 py-4 space-y-6">
            {navGroups.map((group) => (
              <div key={group.group} className="space-y-1">
                <div className="px-3 pb-1 text-[10px] font-bold text-[#94A3B8] tracking-wider uppercase">
                  {group.group}
                </div>
                <nav className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={`${group.group}-${item.name}`}
                        to={item.path}
                        end={item.exact}
                        onClick={(e) => {
                          if (item.onClick) item.onClick(e);
                          onClose();
                        }}
                        className={({ isActive }) => {
                          const active =
                            item.name === "Map"
                              ? location.hash === "#live-map"
                              : isActive && location.hash !== "#live-map";

                          return `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                            active
                              ? "bg-[#F0FDFA] text-[#0D9488] font-semibold"
                              : "text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                          }`;
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
            ))}
          </div>
        </div>

        {/* Bottom Profile and Logout Section */}
        <div className="p-3 border-t border-[#E2E8F0] bg-white">
          <div className="flex items-center justify-between p-2 rounded-xl hover:bg-[#F8FAFC] transition-colors group">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Initials Circle matching "SK" in blue circle */}
              <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-xs">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user?.name || "Admin"}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  getInitials(user?.name)
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-[#0F172A] truncate">
                  {user?.name || "Administrator"}
                </span>
                <span className="text-[10px] text-[#64748B] truncate">
                  {user?.role === "ADMIN" ? "Administrator" : user?.role || "Admin"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 text-[#94A3B8] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
