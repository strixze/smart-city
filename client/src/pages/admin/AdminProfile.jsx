import React from "react";
import { useTranslation } from "react-i18next";
import AdminLayout from "../../components/admin/AdminLayout";
import { useAuth } from "../../context/authContex";
import { Shield, Mail, Phone, Lock, Award, User } from "lucide-react";

export const AdminProfile = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <AdminLayout
      title={t("admin.profile.title")}
      subtitle={t("admin.profile.subtitle")}
    >
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E2E8F0] shadow-xs space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center text-xl font-bold border-2 border-teal-500 shadow-sm flex-shrink-0">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user?.name || "Admin"}
                className="w-full h-full rounded-2xl object-cover"
              />
            ) : (
              (user?.name ? user.name.slice(0, 2).toUpperCase() : "AD")
            )}
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-[#0F172A]">{user?.name || "Sarah Khan"}</h3>
            <p className="text-xs text-[#64748B]">{user?.designation || "Municipal System Administrator"}</p>
            <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-[#0D9488] border border-teal-200">
              {t("admin.profile.privileges", "FULL ADMIN PRIVILEGES")}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-4 border-t border-[#F1F5F9] text-sm">
          <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] flex items-center gap-3">
            <Mail className="w-5 h-5 text-[#0D9488] flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-[#64748B]">{t("auth.login.emailLabel")}</p>
              <p className="font-semibold text-[#0F172A] truncate">{user?.email}</p>
            </div>
          </div>

          <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] flex items-center gap-3">
            <Phone className="w-5 h-5 text-[#0D9488] flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-[#64748B]">{t("admin.staff.staffPhone")}</p>
              <p className="font-semibold text-[#0F172A] truncate">{user?.phone || "+91 98765 43210"}</p>
            </div>
          </div>

          <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] flex items-center gap-3">
            <Award className="w-5 h-5 text-[#0D9488] flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-[#64748B]">{t("admin.staff.employeeId")}</p>
              <p className="font-semibold text-[#0F172A] truncate">{user?.employeeId || "ADM-001"}</p>
            </div>
          </div>

          <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] flex items-center gap-3">
            <Shield className="w-5 h-5 text-[#0D9488] flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-[#64748B]">{t("admin.profile.authority", "Authority")}</p>
              <p className="font-semibold text-[#0F172A] truncate">{t("admin.profile.authDesc", "Dispatch, Override, & Manage")}</p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminProfile;
