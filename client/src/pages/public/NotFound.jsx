import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navbar from "../../components/Navbar";
import SmartCityLogo from "../../components/SmartCityLogo";
import {
  Home,
  ArrowLeft,
  Compass,
  FileText,
  Search,
  ShieldCheck,
  MapPin,
  LifeBuoy
} from "lucide-react";

export const NotFound = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleGoBack = () => {
    // If the browser history has a previous entry in this session, navigate back;
    // otherwise fallback gracefully to the public homepage.
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-[#0F172A] antialiased selection:bg-teal-500 selection:text-white">
      {/* Top Navigation Bar */}
      <Navbar />

      {/* Main 404 Section */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12 lg:py-16">
        <div className="max-w-xl w-full text-center">
          {/* Civic / SmartCity Themed SVG Graphic */}
          <div className="relative mx-auto w-48 h-48 sm:w-56 sm:h-56 mb-4 flex items-center justify-center select-none">
            {/* Ambient subtle backdrop circles */}
            <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/10 via-emerald-500/10 to-sky-500/10 rounded-full blur-2xl pointer-events-none" />

            <svg
              className="w-full h-full relative z-10"
              viewBox="0 0 240 240"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {/* Outer soft dashed orbital / coordinate ring */}
              <circle
                cx="120"
                cy="120"
                r="100"
                stroke="#CBD5E1"
                strokeWidth="1.5"
                strokeDasharray="4 6"
                className="opacity-60"
              />
              <circle
                cx="120"
                cy="120"
                r="72"
                stroke="#0D9488"
                strokeWidth="1.5"
                strokeDasharray="3 4"
                className="opacity-30"
              />

              {/* Connected Civic City Network Nodes */}
              <line x1="60" y1="90" x2="120" y2="50" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
              <line x1="120" y1="50" x2="180" y2="90" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
              <line x1="60" y1="150" x2="120" y2="190" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
              <line x1="120" y1="190" x2="180" y2="150" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />

              <circle cx="60" cy="90" r="5" fill="#3B82F6" opacity="0.8" />
              <circle cx="180" cy="90" r="5" fill="#10B981" opacity="0.8" />
              <circle cx="60" cy="150" r="5" fill="#0D9488" opacity="0.8" />
              <circle cx="180" cy="150" r="5" fill="#F59E0B" opacity="0.8" />

              {/* Central Map / Compass Foundation Tile */}
              <rect
                x="68"
                y="68"
                width="104"
                height="104"
                rx="24"
                fill="#FFFFFF"
                stroke="#E2E8F0"
                strokeWidth="2"
                className="shadow-md"
              />

              {/* City Road Network Path inside Tile */}
              <path
                d="M80 136C95 136 100 110 120 110C140 110 145 84 160 84"
                stroke="#0D9488"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <path
                d="M84 136C97 136 101 110 120 110C139 110 143 84 156 84"
                stroke="#FFFFFF"
                strokeWidth="1"
                strokeLinecap="round"
                strokeDasharray="2 3"
              />

              {/* Redirection / Broken Segment Pin Indicator */}
              <circle cx="120" cy="110" r="16" fill="#F0FDFA" stroke="#0D9488" strokeWidth="2" />
              <circle cx="120" cy="110" r="6" fill="#0D9488" />

              {/* Satellite / Signal Waves */}
              <path
                d="M106 96C114 88 126 88 134 96"
                stroke="#0D9488"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.8"
              />
              <path
                d="M100 90C112 78 128 78 140 90"
                stroke="#0D9488"
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity="0.5"
              />
            </svg>

            {/* Floating Mini 404 Pill Badge */}
            <div className="absolute -bottom-2 bg-white/95 backdrop-blur-xs border border-[#E2E8F0] shadow-xs px-3.5 py-1 rounded-full text-xs font-black tracking-wider text-[#0D9488] z-20">
              {t("notFound.status", "STATUS 404")}
            </div>
          </div>

          {/* Large Stylized 404 Heading */}
          <div className="inline-block mb-1">
            <span className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-[#0F172A]">
              4<span className="text-[#0D9488]">0</span>4
            </span>
          </div>

          {/* Main Heading & Supporting Message */}
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[#0F172A] tracking-tight">
            {t("notFound.title", "Page Not Found")}
          </h1>

          <p className="text-xs sm:text-sm text-[#64748B] mt-2 max-w-md mx-auto leading-relaxed">
            {t("notFound.description", "The page you are looking for may have been moved, removed, or is temporarily unavailable. Please verify the address or return to the main portal.")}
          </p>

          {/* Action Buttons: Primary (Homepage) & Secondary (Go Back) */}
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-sm sm:max-w-md mx-auto">
            <Link
              to="/"
              className="w-full sm:w-auto min-w-[160px] py-2.5 sm:py-3 px-5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:ring-offset-2"
            >
              <Home className="w-4 h-4" />
              <span>{t("notFound.goToHomepage", "Go to Homepage")}</span>
            </Link>

            <button
              type="button"
              onClick={handleGoBack}
              className="w-full sm:w-auto min-w-[140px] py-2.5 sm:py-3 px-5 rounded-xl bg-white hover:bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] font-semibold text-xs sm:text-sm shadow-2xs transition-colors flex items-center justify-center gap-2 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              <ArrowLeft className="w-4 h-4 text-[#64748B]" />
              <span>{t("notFound.goBack", "Go Back")}</span>
            </button>
          </div>

          {/* Quick Helpful Civic Links Card */}
          <div className="mt-8 sm:mt-12 bg-white rounded-2xl p-4 sm:p-5 border border-[#E2E8F0] shadow-xs text-left max-w-lg mx-auto">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#475569] mb-3">
              <Compass className="w-4 h-4 text-[#0D9488]" />
              <span>{t("notFound.popularServices", "Popular Municipal Services")}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <Link
                to="/citizen/report"
                className="p-2.5 rounded-xl hover:bg-[#F8FAFC] border border-transparent hover:border-[#E2E8F0] transition-colors flex items-center gap-2.5 text-[#0F172A] font-medium group"
              >
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-[#0D9488] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <span>{t("notFound.reportIssue", "Report an Issue")}</span>
              </Link>

              <Link
                to="/citizen/complaints"
                className="p-2.5 rounded-xl hover:bg-[#F8FAFC] border border-transparent hover:border-[#E2E8F0] transition-colors flex items-center gap-2.5 text-[#0F172A] font-medium group"
              >
                <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <span>{t("notFound.trackComplaints", "Track Complaints")}</span>
              </Link>

              <Link
                to="/login"
                className="p-2.5 rounded-xl hover:bg-[#F8FAFC] border border-transparent hover:border-[#E2E8F0] transition-colors flex items-center gap-2.5 text-[#0F172A] font-medium group"
              >
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <span>{t("notFound.staffSignIn", "Staff & Admin Sign In")}</span>
              </Link>

              <Link
                to="/"
                className="p-2.5 rounded-xl hover:bg-[#F8FAFC] border border-transparent hover:border-[#E2E8F0] transition-colors flex items-center gap-2.5 text-[#0F172A] font-medium group"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <LifeBuoy className="w-3.5 h-3.5" />
                </div>
                <span>{t("notFound.civicHelp", "Civic Help & Services")}</span>
              </Link>
            </div>
          </div>

          {/* Municipal Footer Notice */}
          <p className="text-[11px] text-[#94A3B8] mt-6 sm:mt-8">
            {t("notFound.footer", "SmartCity Civic Operations & Grievance Redressal System • Municipal Corporation")}
          </p>
        </div>
      </main>
    </div>
  );
};

export default NotFound;
