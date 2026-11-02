import React from "react";
import { useTranslation } from "react-i18next";
import CitizenLayout from "../../components/citizen/CitizenLayout";
import { useAuth } from "../../context/authContex";
import {
  User,
  Mail,
  Phone,
  Shield,
  Calendar,
  CheckCircle,
  Building,
  Key
} from "lucide-react";
import dayjs from "dayjs";

export const CitizenProfile = () => {
  const { user } = useAuth();
  const { t } = useTranslation();

  return (
    <CitizenLayout
      title={t("nav.profile", "Citizen Profile")}
      subtitle="Your verified municipal account details and portal credentials"
    >
      <div className="max-w-3xl space-y-6">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E2E8F0] shadow-xs space-y-6">
          {/* Header Profile Info */}
          <div className="flex items-center gap-4">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-[#0D9488]/30 shadow-xs"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-[#0D9488] text-white flex items-center justify-center font-bold text-xl shadow-xs">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : "CZ"}
              </div>
            )}
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-[#0F172A]">
                {user?.name || "Citizen"}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F0FDFA] text-[#0D9488] border border-[#CCFBF1]">
                  <CheckCircle className="w-3.5 h-3.5" /> Verified Municipal Citizen
                </span>
                <span className="text-xs text-[#64748B] font-mono">
                  ID: {user?._id ? user._id.slice(-6).toUpperCase() : "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-4 border-t border-[#F1F5F9]">
            <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-center text-[#0D9488] shadow-2xs flex-shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[#64748B]">Email Address</p>
                <p className="font-semibold text-sm text-[#0F172A] truncate mt-0.5">
                  {user?.email || "Not specified"}
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-center text-[#0D9488] shadow-2xs flex-shrink-0">
                <Phone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[#64748B]">Mobile Number</p>
                <p className="font-semibold text-sm text-[#0F172A] truncate mt-0.5">
                  {user?.phone || "+91 98765 43210"}
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-center text-[#0D9488] shadow-2xs flex-shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[#64748B]">Portal Access</p>
                <p className="font-semibold text-sm text-[#0F172A] truncate mt-0.5">
                  Citizen Reporting & Tracking
                </p>
              </div>
            </div>

            <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-white border border-[#E2E8F0] flex items-center justify-center text-[#0D9488] shadow-2xs flex-shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[#64748B]">Account Standing</p>
                <p className="font-semibold text-sm text-[#0F172A] truncate mt-0.5">
                  {user?.isActive !== false ? "Active / In Good Standing" : "Inactive"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Civic Guidelines Card */}
        <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-xs space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
            Municipal Citizen Rights & Security
          </h4>
          <p className="text-xs text-[#64748B] leading-relaxed">
            Your citizen account is registered with the Municipal Grievance Redressal System. Reports filed from this account receive automated AI priority scoring and are assigned directly to the relevant municipal departments.
          </p>
        </div>
      </div>
    </CitizenLayout>
  );
};

export default CitizenProfile;
