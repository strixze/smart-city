import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/authContex";
import { useNotification } from "../context/notificationContext";
import {
  Home,
  LayoutDashboard,
  FileText,
  Plus,
  Bell,
  User,
  ClipboardList
} from "lucide-react";

export const MobileNavBottom = () => {
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const { unreadCount } = useNotification();
  const location = useLocation();
  const currentPath = location.pathname;

  if (!user) return null;

  // Active route matching helper supporting nested routes
  const isItemActive = (item) => {
    if (item.exact) {
      return currentPath === item.path;
    }
    if (currentPath === item.path) return true;
    if (item.matchNested && currentPath.startsWith(item.path)) return true;
    if (
      Array.isArray(item.additionalMatches) &&
      item.additionalMatches.some((match) => currentPath.startsWith(match))
    ) {
      return true;
    }
    return false;
  };

  // Build role-specific navigation destinations
  let navItems = [];

  if (role === "CITIZEN") {
    navItems = [
      {
        name: t("nav.home"),
        path: "/citizen/dashboard",
        icon: Home,
        exact: true
      },
      {
        name: t("nav.complaints"),
        path: "/citizen/complaints",
        icon: FileText,
        matchNested: true
      },
      {
        name: t("nav.newComplaint"),
        path: "/citizen/report",
        icon: Plus,
        isCenterAction: true
      },
      {
        name: t("nav.alerts"),
        path: "/citizen/notifications",
        icon: Bell,
        hasBadge: true
      },
      {
        name: t("nav.profile"),
        path: "/citizen/profile",
        icon: User
      }
    ];
  } else if (role === "STAFF") {
    navItems = [
      {
        name: t("nav.dashboard"),
        path: "/staff/dashboard",
        icon: LayoutDashboard,
        exact: true
      },
      {
        name: t("nav.tasks"),
        path: "/staff/tasks",
        icon: ClipboardList,
        matchNested: true,
        additionalMatches: ["/staff/complaints"]
      },
      {
        name: t("nav.alerts"),
        path: "/staff/notifications",
        icon: Bell,
        hasBadge: true
      },
      {
        name: t("nav.profile"),
        path: "/staff/profile",
        icon: User
      }
    ];
  } else if (role === "ADMIN") {
    navItems = [
      {
        name: t("nav.dashboard"),
        path: "/admin/dashboard",
        icon: LayoutDashboard,
        exact: true
      },
      {
        name: t("nav.complaints"),
        path: "/admin/complaints",
        icon: FileText,
        matchNested: true
      },
      {
        name: t("nav.alerts"),
        path: "/admin/notifications",
        icon: Bell,
        hasBadge: true
      },
      {
        name: t("nav.profile"),
        path: "/admin/profile",
        icon: User
      }
    ];
  } else {
    return null;
  }

  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E2E8F0] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 pt-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom,0px))] flex items-center justify-around select-none"
      aria-label="Mobile Bottom Navigation"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isItemActive(item);

        // Center Action Button (e.g. Citizen Report Complaint)
        if (item.isCenterAction) {
          return (
            <NavLink
              key={item.path}
              to={item.path}
              aria-label="Report a new civic issue"
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center justify-center flex-1 -mt-4 relative group focus:outline-none"
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-all duration-200 active:scale-95 ${
                  active
                    ? "bg-[#0D9488] text-white shadow-teal-500/30 ring-4 ring-white scale-105"
                    : "bg-[#0D9488] hover:bg-[#0f766e] text-white shadow-teal-500/25 ring-4 ring-white"
                }`}
              >
                <Plus className="w-6 h-6 stroke-[2.75]" />
              </div>
              <span
                className={`text-[10px] font-bold tracking-tight mt-1 transition-colors ${
                  active ? "text-[#0D9488]" : "text-[#475569]"
                }`}
              >
                {item.name}
              </span>
            </NavLink>
          );
        }

        // Standard Navigation Tab
        return (
          <NavLink
            key={item.path}
            to={item.path}
            aria-label={item.name}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center justify-center flex-1 py-1 min-h-[46px] rounded-xl transition-all relative focus:outline-none ${
              active
                ? "text-[#0D9488] font-bold"
                : "text-[#64748B] hover:text-[#0F172A] font-medium"
            }`}
          >
            <div className="relative flex items-center justify-center">
              <Icon
                className={`w-5 h-5 transition-transform duration-200 ${
                  active ? "scale-110 stroke-[2.5]" : "stroke-[1.75]"
                }`}
              />

              {/* Notification Badge */}
              {item.hasBadge && unreadCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-white shadow-2xs leading-none"
                  aria-label={`${unreadCount} unread alerts`}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>

            <span
              className={`text-[10.5px] tracking-tight mt-0.5 leading-tight transition-colors ${
                active ? "text-[#0D9488] font-bold" : "text-[#64748B]"
              }`}
            >
              {item.name}
            </span>

            {/* Subtle active indicator dot */}
            {active && (
              <span className="w-1.5 h-1 rounded-full bg-[#0D9488] mt-0.5 animate-in fade-in zoom-in-75 duration-150" />
            )}
          </NavLink>
        );
      })}
    </nav>
  );
};

export default MobileNavBottom;
