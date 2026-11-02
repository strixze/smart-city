import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navbar from "../../components/Navbar";
import SmartCityLogo from "../../components/SmartCityLogo";

import {
  Camera,
  Cpu,
  MapPin,
  ArrowRight,
  CheckCircle2,
  Wrench,
  Search,
  ShieldCheck,
  Check,
  Activity,
  Droplets,
  Trash2,
  Lightbulb,
  Trees,
  Calendar,
  Navigation,
  FileText,
  Plus
} from "lucide-react";
import { api } from "../../api/client";

export const Home = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [trackId, setTrackId] = useState("");
  const [realStats, setRealStats] = useState(null);
  const [activeHeroTab, setActiveHeroTab] = useState("tracking"); // 'tracking', 'ai', 'dispatch', 'proof'
  const [selectedDept, setSelectedDept] = useState(0);

  useEffect(() => {
    // Attempt to load real statistics from backend if user has an active session
    const token = localStorage.getItem("token");
    if (token) {
      api.get("/complaints/dashboard")
        .then((res) => {
          if (res.data?.data?.stats) {
            setRealStats(res.data.data.stats);
          }
        })
        .catch(() => {
          api.get("/admin/dashboard")
            .then((res) => {
              if (res.data?.data?.stats) {
                setRealStats(res.data.data.stats);
              }
            })
            .catch(() => { });
        });
    }
  }, []);

  const handleTrackSubmit = (e) => {
    e.preventDefault();
    if (trackId.trim()) {
      navigate(`/citizen/complaints/${trackId.trim()}`);
    }
  };

  const sampleTrackIds = ["SC2025001234", "SC-9821", "SC-4402"];

  // Department explorer data with clean light theme styling
  const departments = [
    {
      id: "roads",
      name: "Roads & Infrastructure",
      icon: Wrench,
      accent: "bg-teal-50 text-teal-700 border-teal-200",
      sla: "< 24 Hours",
      crews: "14 Active Field Crews",
      description: "Potholes, broken footpaths, damaged road dividers, manhole covers, and road surfacing repairs.",
      examples: ["Potholes & craters", "Damaged guard rails", "Unpaved road edges", "Broken pedestrian paths"],
      metric: "98.2% on-time fix"
    },
    {
      id: "sanitation",
      name: "Sanitation & Waste",
      icon: Trash2,
      accent: "bg-emerald-50 text-emerald-700 border-emerald-200",
      sla: "< 12 Hours",
      crews: "28 Sweeper & Bin Units",
      description: "Overflowing garbage dumps, uncollected residential waste, illegal debris dumping, and street cleanliness.",
      examples: ["Dumpster overflow", "Construction debris", "Littered sidewalks", "Bio-waste alerts"],
      metric: "4.8/5 Cleanliness Score"
    },
    {
      id: "water",
      name: "Water Supply & Drainage",
      icon: Droplets,
      accent: "bg-cyan-50 text-cyan-700 border-cyan-200",
      sla: "< 8 Hours (High Priority)",
      crews: "9 Rapid Plumbing Vans",
      description: "Underground pipeline bursts, low water pressure, contaminated supply, storm drain clogs, and sewer backflow.",
      examples: ["Main pipeline leaks", "Open sewer hazards", "Drainage blockages", "Water contamination"],
      metric: "99.4% leak containment"
    },
    {
      id: "lighting",
      name: "Street Lighting & Power",
      icon: Lightbulb,
      accent: "bg-amber-50 text-amber-700 border-amber-200",
      sla: "< 18 Hours",
      crews: "6 Electrical Bucket Trucks",
      description: "Non-functional street lamps, dangling overhead wires, exposed electric junction boxes, and blackout sectors.",
      examples: ["Dark street stretches", "Faulty solar lights", "Exposed wiring", "Damaged light poles"],
      metric: "100% safety certified"
    },
    {
      id: "parks",
      name: "Parks & Urban Greenery",
      icon: Trees,
      accent: "bg-teal-50 text-teal-700 border-teal-200",
      sla: "< 36 Hours",
      crews: "5 Horticultural Squads",
      description: "Fallen tree limbs obstructing roads, overgrown public gardens, broken children playground equipment, and public benches.",
      examples: ["Fallen tree blockage", "Broken swing sets", "Damaged garden fences", "Overgrown hedges"],
      metric: "96.5% satisfaction"
    }
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-[#0F172A] antialiased selection:bg-teal-500 selection:text-white overflow-x-hidden w-full">
      <Navbar />

      {/* HERO SECTION — FULLY RESPONSIVE TWO-COLUMN LAYOUT */}
      <section className="relative overflow-hidden pt-6 pb-12 sm:pt-10 sm:pb-20 lg:py-24 bg-[#F8FAFC] w-full">
        {/* Subtle decorative background curves and skyline silhouette */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-60 max-w-full">
          <svg
            className="absolute bottom-0 left-0 right-0 w-full h-36 sm:h-48 md:h-64 text-slate-200/50"
            viewBox="0 0 1440 220"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
          >
            {/* Distant soft skyline buildings */}
            <rect x="180" y="70" width="35" height="150" fill="#E2E8F0" opacity="0.4" rx="2" />
            <rect x="225" y="40" width="45" height="180" fill="#CBD5E1" opacity="0.35" rx="3" />
            <rect x="280" y="85" width="40" height="135" fill="#E2E8F0" opacity="0.4" rx="2" />
            <rect x="330" y="100" width="30" height="120" fill="#CBD5E1" opacity="0.3" rx="2" />

            <rect x="680" y="90" width="30" height="130" fill="#E2E8F0" opacity="0.3" rx="2" />
            <rect x="720" y="50" width="40" height="170" fill="#CBD5E1" opacity="0.35" rx="3" />
            <rect x="770" y="80" width="35" height="140" fill="#E2E8F0" opacity="0.4" rx="2" />

            <rect x="1100" y="60" width="50" height="160" fill="#CBD5E1" opacity="0.35" rx="3" />
            <rect x="1160" y="95" width="38" height="125" fill="#E2E8F0" opacity="0.4" rx="2" />
            <rect x="1210" y="75" width="45" height="145" fill="#CBD5E1" opacity="0.3" rx="2" />

            {/* Soft rolling landscape curve */}
            <path
              d="M0 160 C 320 120, 560 190, 840 140 C 1120 90, 1320 170, 1440 150 L 1440 220 L 0 220 Z"
              fill="#E6F4EA"
              opacity="0.6"
            />
            <path
              d="M0 180 C 280 150, 600 200, 920 160 C 1200 130, 1380 180, 1440 170 L 1440 220 L 0 220 Z"
              fill="#F0FDFA"
              opacity="0.8"
            />
          </svg>
        </div>

        {/* Hero Content Container */}
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Headline, Description & CTAs */}
            <div className="lg:col-span-6 space-y-5 sm:space-y-6">
              {/* Civic Tag Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F0FDFA] border border-teal-200 text-xs font-semibold text-[#0D9488]">
                <Cpu className="w-3.5 h-3.5 text-[#0D9488] flex-shrink-0" />
                <span className="tracking-wide">{t("home.badge")}</span>
              </div>

              {/* Responsive Headline with clamp scaling */}
              <h1 className="font-extrabold text-[#0F172A] tracking-tight leading-[1.14] text-[2.1rem] sm:text-4xl md:text-5xl lg:text-[3.85rem]">
                {t("home.heroTitle")}
              </h1>

              {/* Supporting Description */}
              <p className="text-sm sm:text-base lg:text-lg text-[#64748B] max-w-xl leading-relaxed font-normal">
                {t("home.heroSubtitle")}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1 w-full">
                <Link
                  to="/citizen/report"
                  className="w-full sm:w-auto px-6 sm:px-7 py-3 sm:py-3.5 rounded-xl bg-[#0D9488] hover:bg-[#0f766e] text-white font-semibold text-sm sm:text-base shadow-xs hover:shadow transition-all duration-200 flex items-center justify-center gap-2 group min-h-[44px]"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>{t("home.reportGrievanceBtn")}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>

                <a
                  href="#track-section"
                  className="w-full sm:w-auto px-6 sm:px-7 py-3 sm:py-3.5 rounded-xl bg-white hover:bg-slate-50 text-[#0F172A] font-semibold text-sm sm:text-base border border-[#E2E8F0] shadow-xs hover:border-slate-300 transition-all duration-200 flex items-center justify-center gap-2 group min-h-[44px]"
                >
                  <Search className="w-4 h-4 text-[#64748B]" />
                  <span>{t("home.trackStatusBtn")}</span>
                  <ArrowRight className="w-4 h-4 text-[#64748B] group-hover:translate-x-1 transition-transform" />
                </a>
              </div>

              {/* 3 Small Feature Labels */}
              <div className="pt-3 sm:pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F0FDFA] border border-teal-100 flex items-center justify-center text-[#0D9488] flex-shrink-0">
                    <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[#0F172A]">Photo-based reporting</p>
                    <p className="text-[#64748B] text-[11px]">Upload photos and location</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F0FDFA] border border-teal-100 flex items-center justify-center text-[#0D9488] flex-shrink-0">
                    <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[#0F172A]">Live status updates</p>
                    <p className="text-[#64748B] text-[11px]">Track your complaint in real time</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F0FDFA] border border-teal-100 flex items-center justify-center text-[#0D9488] flex-shrink-0">
                    <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[#0F172A]">Verified resolution</p>
                    <p className="text-[#64748B] text-[11px]">On-site proof and closure</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Complaint Tracking Dashboard Preview & Interactive Simulator */}
            <div className="lg:col-span-6 flex justify-center lg:justify-end w-full">
              <div className="w-full max-w-xl bg-white rounded-2xl sm:rounded-3xl border border-[#E2E8F0] p-3.5 sm:p-5 lg:p-6 shadow-xl relative overflow-hidden">
                {/* Mode Selector Tabs (Preserves interactive simulation) */}
                <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-[#E2E8F0] mb-3 sm:mb-4 gap-2">
                  <div className="flex items-center gap-1 p-1 bg-[#F1F5F9] rounded-xl text-[11px] sm:text-xs font-semibold overflow-x-auto scrollbar-none max-w-full">
                    <button
                      onClick={() => setActiveHeroTab("tracking")}
                      className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${
                        activeHeroTab === "tracking"
                          ? "bg-white text-[#0F172A] shadow-xs font-bold"
                          : "text-[#64748B] hover:text-[#0F172A]"
                      }`}
                    >
                      Complaint Flow
                    </button>
                    <button
                      onClick={() => setActiveHeroTab("ai")}
                      className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${
                        activeHeroTab === "ai"
                          ? "bg-white text-[#0F172A] shadow-xs font-bold"
                          : "text-[#64748B] hover:text-[#0F172A]"
                      }`}
                    >
                      AI Vision
                    </button>
                    <button
                      onClick={() => setActiveHeroTab("dispatch")}
                      className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${
                        activeHeroTab === "dispatch"
                          ? "bg-white text-[#0F172A] shadow-xs font-bold"
                          : "text-[#64748B] hover:text-[#0F172A]"
                      }`}
                    >
                      Dispatch
                    </button>
                    <button
                      onClick={() => setActiveHeroTab("proof")}
                      className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg transition-all whitespace-nowrap flex-shrink-0 ${
                        activeHeroTab === "proof"
                          ? "bg-white text-[#0F172A] shadow-xs font-bold"
                          : "text-[#64748B] hover:text-[#0F172A]"
                      }`}
                    >
                      Proof
                    </button>
                  </div>

                  <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    24/7 ONLINE
                  </span>
                </div>

                {/* TAB 1: LIVE COMPLAINT TRACKING & MAP PREVIEW (MATCHING REFERENCE IMAGE) */}
                {activeHeroTab === "tracking" && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 items-stretch animate-in fade-in duration-200">
                    {/* Left Sub-column: Civic Map Snippet */}
                    <div className="md:col-span-6 rounded-2xl overflow-hidden border border-[#E2E8F0] bg-[#F1F5F9] relative flex flex-col justify-between w-full">
                      {/* Vector Map Graphic */}
                      <div className="relative w-full h-[180px] xs:h-[200px] sm:h-[230px]">
                        <svg
                          viewBox="0 0 320 250"
                          className="w-full h-full select-none"
                          xmlns="http://www.w3.org/2000/svg"
                          preserveAspectRatio="xMidYMid slice"
                        >
                          <defs>
                            <filter id="pin-shadow" x="-20%" y="-20%" width="140%" height="140%">
                              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.25" />
                            </filter>
                          </defs>

                          {/* Base ground / land */}
                          <rect width="320" height="250" fill="#F8FAFC" />

                          {/* River on the right */}
                          <path
                            d="M 235 0 C 240 50, 248 100, 265 140 C 280 180, 290 210, 295 250 L 320 250 L 320 0 Z"
                            fill="#BAE6FD"
                          />
                          <path
                            d="M 235 0 C 240 50, 248 100, 265 140 C 280 180, 290 210, 295 250"
                            fill="none"
                            stroke="#7DD3FC"
                            strokeWidth="1.5"
                            opacity="0.8"
                          />

                          {/* Lakeside Park on bottom left */}
                          <path
                            d="M 0 170 C 30 165, 60 175, 75 195 C 85 215, 90 235, 90 250 L 0 250 Z"
                            fill="#DCFCE7"
                          />

                          {/* Road Grid */}
                          <path d="M 0 55 L 235 55" stroke="#FFFFFF" strokeWidth="9" />
                          <path d="M 0 120 L 255 120" stroke="#FFFFFF" strokeWidth="11" />
                          <path d="M 0 185 L 275 185" stroke="#FFFFFF" strokeWidth="8" />

                          <path d="M 50 0 L 50 250" stroke="#FFFFFF" strokeWidth="7" />
                          <path d="M 125 0 L 125 250" stroke="#FFFFFF" strokeWidth="10" />
                          <path d="M 195 0 L 195 250" stroke="#FFFFFF" strokeWidth="8" />
                          <path d="M 20 20 L 240 220" stroke="#FFFFFF" strokeWidth="7" opacity="0.9" />

                          {/* Street center dashed lines */}
                          <path d="M 0 120 L 255 120" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="5 4" />
                          <path d="M 125 0 L 125 250" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="5 4" />

                          {/* Area labels */}
                          <text x="135" y="44" fill="#475569" fontSize="10" fontWeight="700" fontFamily="sans-serif">Central</text>
                          <text x="135" y="55" fill="#475569" fontSize="9" fontWeight="600" fontFamily="sans-serif">Ward 04</text>

                          <text x="30" y="105" fill="#475569" fontSize="9.5" fontWeight="600" fontFamily="sans-serif">Shivaji Nagar</text>

                          <text x="150" y="165" fill="#475569" fontSize="9.5" fontWeight="600" fontFamily="sans-serif">City Center</text>

                          <text x="15" y="215" fill="#15803D" fontSize="9.5" fontWeight="600" fontFamily="sans-serif">Lakeside</text>
                          <text x="18" y="227" fill="#15803D" fontSize="9" fontWeight="500" fontFamily="sans-serif">Park</text>

                          {/* Red Pin (High Priority) */}
                          <g filter="url(#pin-shadow)" transform="translate(95, 78)">
                            <path d="M 10 0 C 4.5 0, 0 4.5, 0 10 C 0 16.5, 10 26, 10 26 C 10 26, 20 16.5, 20 10 C 20 4.5, 15.5 0, 10 0 Z" fill="#EF4444" />
                            <circle cx="10" cy="9.5" r="4.5" fill="#FFFFFF" />
                            <text x="10" y="12.5" fill="#EF4444" fontSize="8" fontWeight="900" textAnchor="middle">!</text>
                          </g>

                          {/* Orange Pin (Medium Priority) */}
                          <g filter="url(#pin-shadow)" transform="translate(180, 105)">
                            <path d="M 10 0 C 4.5 0, 0 4.5, 0 10 C 0 16.5, 10 26, 10 26 C 10 26, 20 16.5, 20 10 C 20 4.5, 15.5 0, 10 0 Z" fill="#F59E0B" />
                            <circle cx="10" cy="9.5" r="4.5" fill="#FFFFFF" />
                            <path d="M 8 7.5 L 12 11.5 M 12 7.5 L 8 11.5" stroke="#F59E0B" strokeWidth="1.3" strokeLinecap="round" />
                          </g>

                          {/* Blue Pin (Low Priority) */}
                          <g filter="url(#pin-shadow)" transform="translate(165, 155)">
                            <path d="M 10 0 C 4.5 0, 0 4.5, 0 10 C 0 16.5, 10 26, 10 26 C 10 26, 20 16.5, 20 10 C 20 4.5, 15.5 0, 10 0 Z" fill="#3B82F6" />
                            <circle cx="10" cy="9" r="3.5" fill="#FFFFFF" />
                          </g>

                          {/* Green Pin (Resolved) */}
                          <g filter="url(#pin-shadow)" transform="translate(225, 85)">
                            <path d="M 10 0 C 4.5 0, 0 4.5, 0 10 C 0 16.5, 10 26, 10 26 C 10 26, 20 16.5, 20 10 C 20 4.5, 15.5 0, 10 0 Z" fill="#10B981" />
                            <circle cx="10" cy="9.5" r="4.5" fill="#FFFFFF" />
                            <path d="M 8 9.5 L 9.5 11 L 12.5 8" fill="none" stroke="#10B981" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                          </g>
                        </svg>

                        {/* Floating Zoom Controls */}
                        <div className="absolute top-2 right-2 flex flex-col bg-white rounded-lg shadow-xs border border-[#E2E8F0] overflow-hidden text-xs">
                          <button className="px-2 py-1 hover:bg-slate-50 text-slate-700 font-bold border-b border-[#E2E8F0]" aria-label="Zoom in">+</button>
                          <button className="px-2 py-1 hover:bg-slate-50 text-slate-700 font-bold border-b border-[#E2E8F0]" aria-label="Zoom out">−</button>
                          <button className="px-2 py-1 hover:bg-slate-50 text-slate-600 text-[11px]" aria-label="Recenter">⌖</button>
                        </div>
                      </div>

                      {/* Map Legend */}
                      <div className="flex items-center justify-between py-2 px-2.5 bg-white border-t border-[#E2E8F0] text-[9.5px] sm:text-[10px] font-semibold text-[#64748B]">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          <span>High (3)</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>Medium (5)</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span>Low (4)</span>
                        </span>
                      </div>
                    </div>

                    {/* Right Sub-column: Complaint Status & Stepper */}
                    <div className="md:col-span-6 flex flex-col justify-between space-y-3 min-w-0">
                      {/* Header with ID and Pill */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-[#0F172A]">Complaint status</h4>
                          <p className="text-xs font-mono text-[#64748B]">#SC-2026-00024</p>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200 flex-shrink-0">
                          In Progress
                        </span>
                      </div>

                      {/* Stepper Timeline */}
                      <div className="space-y-2 sm:space-y-2.5 py-1">
                        {/* Step 1: Submitted */}
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col items-center flex-shrink-0">
                            <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                            <div className="w-0.5 h-6 bg-emerald-500 my-0.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#0F172A]">Submitted</p>
                            <p className="text-[10px] text-[#64748B]">Apr 20, 2025, 10:30 AM</p>
                            <p className="text-[11px] text-[#64748B]">Your complaint has been submitted.</p>
                          </div>
                        </div>

                        {/* Step 2: Assigned */}
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col items-center flex-shrink-0">
                            <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                            <div className="w-0.5 h-6 bg-teal-500 my-0.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#0F172A]">Assigned</p>
                            <p className="text-[10px] text-[#64748B]">Apr 21, 2025, 02:15 PM</p>
                            <p className="text-[11px] text-[#64748B]">Assigned to Municipal Team.</p>
                          </div>
                        </div>

                        {/* Step 3: In progress */}
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col items-center flex-shrink-0">
                            <div className="w-5 h-5 rounded-full bg-[#F0FDFA] border-2 border-[#0D9488] flex items-center justify-center">
                              <span className="w-2 h-2 rounded-full bg-[#0D9488]" />
                            </div>
                            <div className="w-0.5 h-6 bg-slate-200 my-0.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#0D9488]">In progress</p>
                            <p className="text-[10px] text-[#64748B]">Apr 23, 2025, 11:20 AM</p>
                            <p className="text-[11px] text-[#64748B]">Field team is working on this issue.</p>
                          </div>
                        </div>

                        {/* Step 4: Resolved */}
                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full border-2 border-slate-300 bg-white flex items-center justify-center text-[10px] flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-400">Resolved</p>
                            <p className="text-[11px] text-slate-400">Pending verification.</p>
                          </div>
                        </div>
                      </div>

                      {/* Card Details Footer */}
                      <div className="pt-2.5 border-t border-[#E2E8F0] grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-[#64748B]">
                        <div className="flex items-center gap-1.5">
                          <Navigation className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <div>
                            <span className="block text-[9px] uppercase tracking-wider text-slate-400">Category</span>
                            <span className="font-bold text-[#0F172A]">Roads</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <div>
                            <span className="block text-[9px] uppercase tracking-wider text-slate-400">Location</span>
                            <span className="font-bold text-[#0F172A]">Ward 04</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <div>
                            <span className="block text-[9px] uppercase tracking-wider text-slate-400">Last update</span>
                            <span className="font-bold text-[#0F172A] truncate block">Field team assigned</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: AI VISION TRIAGE SIMULATOR */}
                {activeHeroTab === "ai" && (
                  <div className="space-y-4 py-2 animate-in fade-in duration-200">
                    <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-3.5 sm:p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-[#0D9488] flex-shrink-0">
                            <Cpu className="w-5 h-5 animate-pulse" />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-[#0D9488] uppercase tracking-wider">Vision Engine</span>
                            <p className="text-sm font-bold text-[#0F172A]">Hazard Class: Severe Pothole</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 flex-shrink-0">
                          98.4% Match
                        </span>
                      </div>
                      <div className="mt-3 pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
                        <span>Confidence: High</span>
                        <span className="text-amber-600 font-semibold">Auto-Priority: HIGH</span>
                      </div>
                    </div>
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      Citizen uploads a photo &rarr; Local AI detects defects, determines priority, and verifies authenticity without human delay.
                    </p>
                  </div>
                )}

                {/* TAB 3: DISPATCH SIMULATOR */}
                {activeHeroTab === "dispatch" && (
                  <div className="space-y-4 py-2 animate-in fade-in duration-200">
                    <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-3.5 sm:p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Wrench className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <span className="text-sm font-bold text-[#0F172A]">PWD Road Crew 07</span>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200 flex-shrink-0">
                          En Route (18 min)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#64748B]">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                        <span className="truncate">Near Central Junction, North Avenue</span>
                      </div>
                    </div>
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      Instant departmental assignment with GPS geotagging. Crew receives mobile task dispatch notification immediately.
                    </p>
                  </div>
                )}

                {/* TAB 4: RESOLUTION PROOF SIMULATOR */}
                {activeHeroTab === "proof" && (
                  <div className="space-y-4 py-2 animate-in fade-in duration-200">
                    <div className="rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] p-3.5 sm:p-4">
                      <div className="flex items-center justify-between mb-3 gap-2">
                        <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> Resolution Verified
                        </span>
                        <span className="text-[11px] text-[#64748B] flex-shrink-0">Fixed in 14h 20m</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5 text-center text-xs">
                        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-[#E2E8F0]">
                          <span className="text-rose-600 font-bold block mb-1">BEFORE</span>
                          <span className="text-[#64748B] text-[11px]">Reported Oct 03</span>
                        </div>
                        <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-emerald-300">
                          <span className="text-emerald-600 font-bold block mb-1">AFTER</span>
                          <span className="text-[#0F172A] text-[11px] font-medium">Photographic Proof</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      Field staff must upload post-resolution evidence. Citizens retain the power to confirm case closure or reopen anytime.
                    </p>
                  </div>
                )}

                {/* Micro-Stats Footer of the Card */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-[#E2E8F0] text-center">
                  <div>
                    <span className="text-[10px] text-[#64748B] uppercase tracking-wider block">Avg SLA</span>
                    <span className="text-xs sm:text-sm font-extrabold text-[#0F172A]">&lt; 24 Hrs</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#64748B] uppercase tracking-wider block">Resolved</span>
                    <span className="text-xs sm:text-sm font-extrabold text-[#0D9488]">
                      {realStats?.resolved ? `${realStats.resolved}+` : "1,420+"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#64748B] uppercase tracking-wider block">Satisfaction</span>
                    <span className="text-xs sm:text-sm font-extrabold text-[#0F172A]">98.6%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: CIVIC ISSUES, HANDLED TRANSPARENTLY */}
      <section className="py-12 sm:py-20 bg-white border-y border-[#E2E8F0] w-full">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
              Civic issues, handled transparently
            </h2>
            <p className="text-sm sm:text-base text-[#64748B] mt-2">
              SmartCity uses AI and real-time field operations to make your city cleaner, safer and more responsive.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {/* Card 1 */}
            <div className="bg-[#F8FAFC] rounded-2xl p-5 sm:p-7 border border-[#E2E8F0] shadow-xs hover:shadow-sm transition-all flex flex-col items-start gap-3.5 sm:gap-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#F0FDFA] border border-teal-200/60 flex items-center justify-center text-[#0D9488] flex-shrink-0">
                <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#0F172A] mb-1 sm:mb-1.5">
                  Report in seconds
                </h3>
                <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
                  Capture a photo, add the location, and describe the issue. Our AI helps classify it automatically.
                </p>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-[#F8FAFC] rounded-2xl p-5 sm:p-7 border border-[#E2E8F0] shadow-xs hover:shadow-sm transition-all flex flex-col items-start gap-3.5 sm:gap-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 flex-shrink-0">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#0F172A] mb-1 sm:mb-1.5">
                  Track every update
                </h3>
                <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
                  See real-time progress, from assignment to on-site work, with clear status updates and notifications.
                </p>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-[#F8FAFC] rounded-2xl p-5 sm:p-7 border border-[#E2E8F0] shadow-xs hover:shadow-sm transition-all flex flex-col items-start gap-3.5 sm:gap-4">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-600 flex-shrink-0">
                <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#0F172A] mb-1 sm:mb-1.5">
                  Verified resolution
                </h3>
                <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
                  We verify the completed work with photographic proof, so you can see the impact in your neighborhood.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: HOW IT WORKS */}
      <section id="how-it-works" className="py-12 sm:py-20 bg-[#F8FAFC] w-full">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
              How it works
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1.5">
              From report to resolution, a simple and transparent process.
            </p>
          </div>

          <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#E2E8F0] p-4 sm:p-8 shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 lg:gap-8 items-center">
              {/* Step 1 */}
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div className="flex items-start gap-3.5 sm:gap-4">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F0FDFA] border border-teal-200/80 text-[#0D9488] font-bold text-sm sm:text-base flex items-center justify-center flex-shrink-0">
                    1
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-[#0F172A] mb-1">
                      Report the issue
                    </h3>
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      Submit a photo, location and details of the civic issue.
                    </p>
                  </div>
                </div>
                <ArrowRight className="hidden md:block w-5 h-5 text-slate-300 self-center flex-shrink-0" />
              </div>

              {/* Step 2 */}
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div className="flex items-start gap-3.5 sm:gap-4">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F0FDFA] border border-teal-200/80 text-[#0D9488] font-bold text-sm sm:text-base flex items-center justify-center flex-shrink-0">
                    2
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-[#0F172A] mb-1">
                      Team is assigned
                    </h3>
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      Your complaint is reviewed, classified by AI, and assigned to the right municipal team.
                    </p>
                  </div>
                </div>
                <ArrowRight className="hidden md:block w-5 h-5 text-slate-300 self-center flex-shrink-0" />
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3.5 sm:gap-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F0FDFA] border border-teal-200/80 text-[#0D9488] font-bold text-sm sm:text-base flex items-center justify-center flex-shrink-0">
                  3
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-[#0F172A] mb-1">
                    Verify the resolution
                  </h3>
                  <p className="text-xs text-[#64748B] leading-relaxed">
                    Our team resolves the issue and uploads on-site photos for verification.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: PLATFORM ARCHITECTURE (FEATURES BENTO GRID IN LIGHT THEME) */}
      <section id="features" className="py-12 sm:py-20 bg-white border-t border-[#E2E8F0] w-full">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-[#0D9488] bg-[#F0FDFA] px-3.5 py-1 rounded-full border border-teal-200">
              Platform Architecture
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] mt-3 tracking-tight">
              Designed for Citizen Trust & Speed
            </h2>
            <p className="text-sm text-[#64748B] mt-2">
              Every civic complaint undergoes transparent automated triage, verified assignment, and photographic validation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Bento Card 1: 1-Click Reporting */}
            <div className="rounded-2xl sm:rounded-3xl bg-[#F8FAFC] p-5 sm:p-7 border border-[#E2E8F0] hover:border-teal-300 relative group flex flex-col justify-between shadow-xs hover:shadow-md transition-all">
              <div>
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-teal-50 text-[#0D9488] flex items-center justify-center mb-4 sm:mb-5 group-hover:scale-105 transition-transform">
                  <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="inline-block px-2.5 py-0.5 rounded-full bg-teal-50 text-[10px] font-bold text-teal-700 uppercase tracking-wider mb-2 border border-teal-200">
                  Citizen Mobile & Web
                </div>
                <h3 className="text-base sm:text-lg font-bold text-[#0F172A] mb-1.5 sm:mb-2">
                  Effortless Reporting
                </h3>
                <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
                  Snap a photo from your phone or desktop. Auto-detects geolocation and uploads securely in under 30 seconds.
                </p>
              </div>
              <Link
                to="/citizen/report"
                className="pt-3.5 sm:pt-4 mt-3 sm:mt-4 border-t border-[#E2E8F0] flex items-center text-xs font-semibold text-[#0D9488] group-hover:translate-x-1 transition-transform min-h-[36px]"
              >
                <span>Start report flow</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </div>

            {/* Bento Card 2: AI Vision Classification */}
            <div className="rounded-2xl sm:rounded-3xl bg-[#F8FAFC] p-5 sm:p-7 border border-[#E2E8F0] hover:border-indigo-300 relative group flex flex-col justify-between shadow-xs hover:shadow-md transition-all">
              <div>
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 sm:mb-5 group-hover:scale-105 transition-transform">
                  <Cpu className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="inline-block px-2.5 py-0.5 rounded-full bg-indigo-50 text-[10px] font-bold text-indigo-700 uppercase tracking-wider mb-2 border border-indigo-200">
                  Computer Vision
                </div>
                <h3 className="text-base sm:text-lg font-bold text-[#0F172A] mb-1.5 sm:mb-2">
                  Automated AI Triage
                </h3>
                <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
                  Advanced vision models classify hazard severity, subcategory, and eliminate duplicate reports automatically.
                </p>
              </div>
              <div className="pt-3.5 sm:pt-4 mt-3 sm:mt-4 border-t border-[#E2E8F0] flex items-center text-xs font-semibold text-indigo-600 group-hover:translate-x-1 transition-transform min-h-[36px]">
                <span>Explore AI specs</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </div>

            {/* Bento Card 3: Real-Time Transparency */}
            <div className="rounded-2xl sm:rounded-3xl bg-[#F8FAFC] p-5 sm:p-7 border border-[#E2E8F0] hover:border-sky-300 relative group flex flex-col justify-between shadow-xs hover:shadow-md transition-all">
              <div>
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mb-4 sm:mb-5 group-hover:scale-105 transition-transform">
                  <MapPin className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="inline-block px-2.5 py-0.5 rounded-full bg-sky-50 text-[10px] font-bold text-sky-700 uppercase tracking-wider mb-2 border border-sky-200">
                  Live Transparency
                </div>
                <h3 className="text-base sm:text-lg font-bold text-[#0F172A] mb-1.5 sm:mb-2">
                  Milestone Tracking
                </h3>
                <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
                  Follow your complaint at every step. Receive SMS & in-app alerts as field crews are dispatched and work begins.
                </p>
              </div>
              <a
                href="#track-section"
                className="pt-3.5 sm:pt-4 mt-3 sm:mt-4 border-t border-[#E2E8F0] flex items-center text-xs font-semibold text-sky-600 group-hover:translate-x-1 transition-transform min-h-[36px]"
              >
                <span>Track an issue</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </a>
            </div>

            {/* Bento Card 4: Verified On-Site Proof */}
            <div className="rounded-2xl sm:rounded-3xl bg-[#F8FAFC] p-5 sm:p-7 border border-[#E2E8F0] hover:border-emerald-300 relative group flex flex-col justify-between shadow-xs hover:shadow-md transition-all">
              <div>
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 sm:mb-5 group-hover:scale-105 transition-transform">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-2 border border-emerald-200">
                  Citizen Power
                </div>
                <h3 className="text-base sm:text-lg font-bold text-[#0F172A] mb-1.5 sm:mb-2">
                  Before/After Proof
                </h3>
                <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
                  No fake closures. Staff must submit high-res resolution photos. If the work is incomplete, reopen with 1 tap.
                </p>
              </div>
              <div className="pt-3.5 sm:pt-4 mt-3 sm:mt-4 border-t border-[#E2E8F0] flex items-center text-xs font-semibold text-emerald-600 group-hover:translate-x-1 transition-transform min-h-[36px]">
                <span>Resolution standards</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: INTERACTIVE DEPARTMENT TRIAGE EXPLORER (LIGHT THEME) */}
      <section className="py-12 sm:py-20 bg-[#F8FAFC] border-t border-[#E2E8F0] w-full">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 sm:mb-8">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#0D9488]">
                Municipal Operations Hub
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] mt-1">
                Explore Municipal Service Departments
              </h2>
              <p className="text-sm text-[#64748B] mt-1 max-w-xl">
                Select a department below to inspect live response standards, dedicated field units, and issue classifications.
              </p>
            </div>
            <Link
              to="/citizen/report"
              className="w-full sm:w-fit inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0f766e] text-white text-xs sm:text-sm font-semibold transition-all shadow-xs min-h-[44px]"
            >
              <span>Submit General Complaint</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Department Selector Tabs with smooth horizontal scroll on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
            {departments.map((dept, index) => {
              const Icon = dept.icon;
              const isSelected = selectedDept === index;
              return (
                <button
                  key={dept.id}
                  onClick={() => setSelectedDept(index)}
                  className={`flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all border flex-shrink-0 min-h-[40px] ${
                    isSelected
                      ? "bg-[#0D9488] text-white font-bold border-[#0D9488] shadow-xs"
                      : "bg-white text-[#475569] border-[#E2E8F0] hover:bg-slate-50 hover:text-[#0F172A]"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isSelected ? "text-white" : "text-[#0D9488]"}`} />
                  <span>{dept.name}</span>
                </button>
              );
            })}
          </div>

          {/* Active Department Showcase Card */}
          {departments[selectedDept] && (
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#E2E8F0] p-4 sm:p-8 lg:p-10 shadow-sm animate-in fade-in duration-300">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`px-2.5 sm:px-3 py-1 rounded-full font-bold border ${departments[selectedDept].accent}`}>
                      Target SLA: {departments[selectedDept].sla}
                    </span>
                    <span className="px-2.5 sm:px-3 py-1 rounded-full font-semibold bg-slate-50 text-slate-700 border border-[#E2E8F0]">
                      {departments[selectedDept].crews}
                    </span>
                    <span className="px-2.5 sm:px-3 py-1 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {departments[selectedDept].metric}
                    </span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-extrabold text-[#0F172A]">
                    {departments[selectedDept].name}
                  </h3>

                  <p className="text-xs sm:text-sm text-[#64748B] leading-relaxed">
                    {departments[selectedDept].description}
                  </p>

                  <div className="pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#475569] mb-2.5">
                      Common Issues Handled by this Unit:
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {departments[selectedDept].examples.map((ex, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs font-medium text-[#1E293B] bg-[#F8FAFC] p-2.5 rounded-xl border border-[#E2E8F0]">
                          <Check className="w-3.5 h-3.5 text-[#0D9488] flex-shrink-0" />
                          <span>{ex}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3">
                    <Link
                      to="/citizen/report"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#0D9488] hover:bg-[#0f766e] text-white font-bold text-xs sm:text-sm shadow-xs transition-all min-h-[44px]"
                    >
                      <span>Report an issue in this department</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>

                <div className="lg:col-span-5 bg-[#F8FAFC] rounded-2xl p-4 sm:p-6 text-[#0F172A] space-y-4 border border-[#E2E8F0]">
                  <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
                    <span className="text-xs font-bold text-[#0D9488]">DISPATCH PROTOCOL</span>
                    <span className="text-[10px] text-[#64748B] font-mono font-semibold">AUTOMATED</span>
                  </div>
                  <div className="space-y-3 text-xs text-[#475569]">
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-teal-50 text-[#0D9488] border border-teal-200 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                        1
                      </div>
                      <p>Visual verification & severity rating via AI Vision Engine.</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-teal-50 text-[#0D9488] border border-teal-200 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                        2
                      </div>
                      <p>Nearest available crew dispatched based on geographic ward GPS.</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-teal-50 text-[#0D9488] border border-teal-200 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                        3
                      </div>
                      <p>Resolution photograph stamped with timestamp and GPS coordinate.</p>
                    </div>
                  </div>
                  <div className="pt-1">
                    <div className="bg-white rounded-xl p-3 border border-[#E2E8F0] flex items-center justify-between text-xs">
                      <span className="text-[#64748B]">Escalation Threshold</span>
                      <span className="font-bold text-amber-600">Automatic at 80% SLA</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* SECTION: TRACK COMPLAINT (LIGHT THEME) */}
      <section id="track-section" className="py-12 sm:py-20 bg-white border-t border-[#E2E8F0] w-full">
        <div className="max-w-3xl mx-auto px-3.5 sm:px-6 lg:px-8 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-[#0D9488] bg-[#F0FDFA] px-3.5 py-1 rounded-full border border-teal-200">
            {t("home.badge")}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] mt-3">
            {t("home.trackStatusBtn")}
          </h2>
          <p className="text-xs sm:text-sm text-[#64748B] mt-2 max-w-lg mx-auto">
            {t("home.howItWorksSubtitle")}
          </p>

          <form onSubmit={handleTrackSubmit} className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center gap-3 max-w-lg mx-auto w-full">
            <div className="relative w-full">
              <input
                type="text"
                value={trackId}
                onChange={(e) => setTrackId(e.target.value)}
                placeholder="e.g. SC2025001234 or Complaint ID"
                className="w-full px-4 py-3 sm:py-3.5 pl-11 bg-white border border-[#CBD5E1] rounded-2xl text-sm text-[#0F172A] placeholder-slate-400 focus:outline-none focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/20 shadow-xs"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5 sm:top-4" />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto px-7 py-3 sm:py-3.5 min-h-[44px] rounded-2xl bg-[#0D9488] hover:bg-[#0f766e] text-white font-bold text-sm shadow-xs hover:shadow transition-all whitespace-nowrap flex items-center justify-center"
            >
              {t("home.trackStatusBtn")}
            </button>
          </form>

          {/* Quick Sample IDs with wrapping */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-[#64748B]">
            <span className="w-full sm:w-auto text-center sm:text-left">{t("citizen.complaints.complaintId")}:</span>
            {sampleTrackIds.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTrackId(id)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px] font-medium border border-[#E2E8F0] transition-colors min-h-[30px]"
              >
                {id}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER (LIGHT THEME) */}
      <footer id="contact" className="mt-auto bg-white text-[#64748B] py-10 sm:py-16 border-t border-[#E2E8F0] w-full">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5 sm:gap-6 pb-6 sm:pb-8 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-3">
              <SmartCityLogo variant="dark-text" size="md" />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-[#64748B]">
              <Link to="/citizen/report" className="hover:text-[#0D9488] transition-colors py-1">{t("citizen.dashboard.reportNew")}</Link>
              <Link to="/citizen/complaints" className="hover:text-[#0D9488] transition-colors py-1">{t("citizen.complaints.title")}</Link>
              <Link to="/login" className="hover:text-[#0D9488] transition-colors py-1">{t("nav.login")}</Link>
            </div>
          </div>

          <div className="pt-6 sm:pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3 text-center sm:text-left">
            <p>© {new Date().getFullYear()} {t("home.footerTagline")}. {t("home.footerRights")}</p>
            <p className="flex items-center justify-center sm:justify-start gap-1.5 text-slate-600">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Smart Maharashtra Civic Platform
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
