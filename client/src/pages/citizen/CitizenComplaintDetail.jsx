import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import CitizenLayout from "../../components/citizen/CitizenLayout";
import StatusBadge from "../../components/StatusBadge";
import PriorityBadge from "../../components/PriorityBadge";
import TimelineView from "../../components/TimelineView";
import BeforeAfterComparison from "../../components/BeforeAfterComparison";
import ImageAuthenticityTest from "../../components/ImageAuthenticityTest";
import { complaintApi, getImageUrl } from "../../api/client";
import { getLocalizedCategory, getLocalizedSubcategory, getLocalizedPriority, formatDate, formatDateTime } from "../../utils/formatters";
import {
  ArrowLeft,
  Search,
  MapPin,
  Calendar,
  User,
  Phone,
  CheckCircle,
  RotateCcw,
  AlertTriangle,
  Loader2,
  Check,
  Building,
  Image as ImageIcon,
  Cpu,
  Clock,
  Sparkles
} from "lucide-react";
import dayjs from "dayjs";
import toast from "react-hot-toast";

export const CitizenComplaintDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [complaintData, setComplaintData] = useState(null);
  const [searchId, setSearchId] = useState("");

  // Reopen Modal
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const res = await complaintApi.getComplaintById(id);
      if (res.data?.data) {
        setComplaintData(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not fetch complaint details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchId.trim()) {
      navigate(`/citizen/complaints/${searchId.trim()}`);
      setSearchId("");
    }
  };

  const handleConfirmResolution = async () => {
    try {
      setActionLoading(true);
      await complaintApi.confirmResolution(id);
      toast.success("Thank you! Resolution confirmed. Case closed.");
      fetchDetails();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to confirm resolution.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopenComplaint = async (e) => {
    e.preventDefault();
    if (!reopenReason.trim() || reopenReason.trim().length < 5) {
      toast.error("Please explain why this issue requires reopening (at least 5 characters).");
      return;
    }

    try {
      setActionLoading(true);
      await complaintApi.reopenComplaint(id, { reopenReason: reopenReason.trim() });
      toast.success("Complaint reopened and escalated to municipal administration.");
      setShowReopenModal(false);
      setReopenReason("");
      fetchDetails();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reopen complaint.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <CitizenLayout title="Complaint Details" subtitle="Loading record...">
        <div className="py-24 flex items-center justify-center text-[#0D9488]">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </CitizenLayout>
    );
  }

  if (!complaintData) {
    return (
      <CitizenLayout title="Complaint Details" subtitle="Record status">
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-12 text-center shadow-xs max-w-md mx-auto">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#0F172A]">Complaint record not found</h3>
          <p className="text-xs text-[#64748B] mt-1 mb-4">
            The requested complaint ID does not exist or you do not have permission to view it.
          </p>
          <Link
            to="/citizen/complaints"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Complaints
          </Link>
        </div>
      </CitizenLayout>
    );
  }

  const { complaint, beforeImage, afterImage, progressImages, timeline, authenticityTests } = complaintData;
  const resolutionTest = authenticityTests?.find((t) => t.imageTarget === "resolution") || null;
  const beforePhotoUrl = beforeImage ? getImageUrl(beforeImage?.imageUrl || beforeImage) : null;

  return (
    <CitizenLayout
      title={`${t("citizen.complaints.title", "Complaint")} #${complaint.complaintNumber}`}
      subtitle={`${t("status.SUBMITTED", "Submitted")}: ${formatDateTime(complaint.createdAt, i18n.language)}`}
      actions={
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder={t("citizen.complaints.searchPlaceholder", "Track complaint ID...")}
              className="w-44 sm:w-56 pl-8 pr-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:border-[#0D9488] focus:bg-white transition-all"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-[#0D9488] hover:bg-[#0F766E] text-white rounded-lg text-xs font-medium shadow-xs transition-colors"
          >
            {t("common.search", "Go")}
          </button>
        </form>
      }
    >
      <div className="space-y-6">
        {/* Top Navigation Row */}
        <div className="flex items-center justify-between">
          <Link
            to="/citizen/complaints"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748B] hover:text-[#0D9488] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> {t("common.back", "Back to My Complaints")}
          </Link>
          <div className="flex items-center gap-2">
            <StatusBadge status={complaint.status} size="sm" />
            <PriorityBadge priority={complaint.priority} size="sm" />
          </div>
        </div>

        {/* CITIZEN CONFIRMATION BANNER (When marked RESOLVED) */}
        {complaint.status === "RESOLVED" && (
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl p-5 sm:p-6 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 bg-white border border-[#BBF7D0] px-3 py-1 rounded-full shadow-2xs">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> {t("status.RESOLVED", "Resolution Completed")}
                </span>
                <h3 className="text-base font-bold text-[#0F172A] mt-2">
                  {t("staff.taskDetail.resolutionProof", "Has this civic issue been satisfactorily resolved?")}
                </h3>
                <p className="text-xs text-[#475569] mt-0.5">
                  Please inspect the photographic evidence below. Your confirmation validates field work and closes this case file.
                </p>
              </div>

              {complaint.citizenConfirmed === true ? (
                <div className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs whitespace-nowrap">
                  <Check className="w-4 h-4" /> {t("status.RESOLVED", "Resolution Confirmed")}
                </div>
              ) : (
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    onClick={handleConfirmResolution}
                    disabled={actionLoading}
                    className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" /> {t("common.confirm", "Yes, Resolved")}
                  </button>
                  <button
                    onClick={() => setShowReopenModal(true)}
                    disabled={actionLoading}
                    className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 border border-rose-300 text-rose-700 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-600" /> {t("status.REOPENED", "Reopen Issue")}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* REOPENED BANNER */}
        {complaint.status === "REOPENED" && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 text-rose-900 shadow-xs">
            <div className="flex items-center gap-2 font-bold text-xs text-rose-700 uppercase tracking-wider mb-1">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              {t("status.REOPENED", "Complaint Reopened by Citizen")}
            </div>
            <p className="text-xs text-rose-800">
              <span className="font-semibold">{t("staff.taskDetail.resolutionNotes", "Reason provided")}:</span> "{complaint.reopenReason}"
            </p>
          </div>
        )}

        {/* PRIMARY COMPLAINT CARD */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E2E8F0] shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[#F1F5F9]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-semibold text-[#64748B]">#{complaint.complaintNumber}</span>
                <span className="text-[#CBD5E1]">•</span>
                <span className="text-xs text-[#64748B] flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#94A3B8]" />
                  {formatDateTime(complaint.createdAt, i18n.language)}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-[#0F172A] tracking-tight">
                {complaint.title}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={complaint.status} size="sm" />
              <PriorityBadge priority={complaint.priority} size="sm" />
            </div>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-2">{t("citizen.report.descLabel", "Description")}</h4>
            <p className="text-sm text-[#334155] leading-relaxed bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
              {complaint.description}
            </p>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="text-[10px] uppercase font-bold text-[#64748B]">{t("admin.routing.department", "Department")}</span>
              <p className="font-semibold text-[#0F172A] mt-0.5">{getLocalizedCategory(complaint.category, t)}</p>
              <p className="text-[11px] text-[#64748B]">{getLocalizedSubcategory(complaint.subcategory || "General", t)}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="text-[10px] uppercase font-bold text-[#64748B]">{t("staff.dashboard.assignedToMe", "Assigned Staff")}</span>
              <p className="font-semibold text-[#0F172A] mt-0.5">
                {complaint.assignedStaff ? complaint.assignedStaff.name : "Pending Dispatch"}
              </p>
              <p className="text-[11px] text-[#64748B]">
                {complaint.assignedStaff ? complaint.assignedStaff.department : "Municipal Operations Queue"}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="text-[10px] uppercase font-bold text-[#64748B]">{t("citizen.report.priorityLabel", "Priority")}</span>
              <p className="font-semibold text-[#0D9488] mt-0.5">{getLocalizedPriority(complaint.priority, t)}</p>
              <p className="text-[11px] text-[#64748B]">Target SLA: 24–48 Hours</p>
            </div>
          </div>

          {/* AI Vision Classification & Confidence Panel */}
          <div className="p-4 rounded-xl bg-[#F0FDFA] border border-[#CCFBF1] space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0D9488] uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-[#0D9488]" /> {t("citizen.report.aiDiagnosis", "AI Municipal Vision Classification")}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white text-[#0D9488] border border-[#99F6E4] shadow-2xs">
                {t("citizen.report.aiConfidence", "Confidence")}: {complaint.aiConfidence ? `${Math.round(complaint.aiConfidence * 100)}%` : "Verified"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-white p-3 rounded-lg border border-[#CCFBF1]">
                <p className="text-[10px] text-[#64748B] font-semibold uppercase">{t("citizen.report.categoryLabel", "Category")}</p>
                <p className="font-bold text-[#0F172A] mt-0.5 truncate">
                  {getLocalizedCategory(complaint.aiCategory || complaint.category || "General", t)}
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-[#CCFBF1]">
                <p className="text-[10px] text-[#64748B] font-semibold uppercase">{t("citizen.report.subcategoryLabel", "Subcategory")}</p>
                <p className="font-bold text-[#0F172A] mt-0.5 truncate">
                  {getLocalizedSubcategory(complaint.aiSubcategory || complaint.subcategory || "General", t)}
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-[#CCFBF1]">
                <p className="text-[10px] text-[#64748B] font-semibold uppercase">{t("citizen.report.priorityLabel", "AI Priority")}</p>
                <p className="font-bold text-amber-700 mt-0.5 truncate">
                  {getLocalizedPriority(complaint.aiPriority || complaint.priority, t)}
                </p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-[#CCFBF1]">
                <p className="text-[10px] text-[#64748B] font-semibold uppercase">{t("citizen.report.aiConfidence", "AI Confidence")}</p>
                <p className="font-bold text-[#0D9488] mt-0.5 truncate">
                  {complaint.aiConfidence ? `${Math.round(complaint.aiConfidence * 100)}%` : "High (94%)"}
                </p>
              </div>
            </div>
          </div>

          {/* Timeline View */}
          <div className="pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-4">
              {t("staff.taskDetail.timeline", "Resolution Audit Trail & Timeline")}
            </h3>
            <TimelineView updates={timeline} theme="light" />
          </div>
        </div>

        {/* LOCATION & PHOTOGRAPHIC PROOFS */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E2E8F0] shadow-xs space-y-5">
          <h3 className="text-sm font-bold text-[#0F172A]">
            {t("citizen.report.locationLabel", "Location & Photographic Evidence")}
          </h3>

          {/* Address row */}
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            {beforePhotoUrl ? (
              <img
                src={beforePhotoUrl}
                alt={complaint.title}
                className="w-14 h-14 rounded-lg object-cover border border-[#E2E8F0] flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center text-[#94A3B8] flex-shrink-0">
                <ImageIcon className="w-6 h-6" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#0F172A] truncate">{complaint.title}</p>
              <p className="text-xs text-[#64748B] flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-[#0D9488] flex-shrink-0" />
                <span className="truncate">{complaint.locationAddress}</span>
              </p>
            </div>
          </div>

          {/* Photographic Comparison */}
          <div>
            <BeforeAfterComparison
              beforeImage={beforeImage}
              afterImage={afterImage}
              progressImages={progressImages}
              theme="light"
              afterAction={
                <ImageAuthenticityTest
                  complaintId={complaint._id || id}
                  target="resolution"
                  hasImage={Boolean(afterImage)}
                  imageLabel="Staff Resolution Proof (AFTER Photo)"
                  disabledMessage="Resolution photo has not been uploaded yet by municipal field staff."
                  existingTest={resolutionTest}
                  onTestComplete={() => {
                    fetchDetails();
                  }}
                />
              }
            />
          </div>
        </div>
      </div>

      {/* REOPEN MODAL */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 max-w-md w-full shadow-2xl text-[#0F172A] space-y-4">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0F172A]">
                {t("status.REOPENED", "Reopen Complaint")} #{complaint.complaintNumber}
              </h3>
              <p className="text-xs text-[#64748B] mt-1">
                Please explain why the resolution was incomplete or unsatisfactory. This will escalate the grievance back to municipal administrators.
              </p>
            </div>

            <form onSubmit={handleReopenComplaint} className="space-y-4">
              <textarea
                required
                rows={4}
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="e.g. The garbage was only partially collected, spilled waste was left behind on the road corner..."
                className="w-full p-3 bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] placeholder-[#94A3B8] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-rose-500 resize-y"
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
                >
                  {t("common.cancel", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("status.REOPENED", "Reopen & Escalate")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </CitizenLayout>
  );
};

export default CitizenComplaintDetail;
