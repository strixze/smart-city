import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import AdminLayout from "../../components/admin/AdminLayout";
import StatusBadge from "../../components/StatusBadge";
import PriorityBadge from "../../components/PriorityBadge";
import TimelineView from "../../components/TimelineView";
import BeforeAfterComparison from "../../components/BeforeAfterComparison";
import ImageAuthenticityTest from "../../components/ImageAuthenticityTest";
import { complaintApi, adminApi } from "../../api/client";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  User,
  Phone,
  Cpu,
  UserCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Save,
  Check
} from "lucide-react";
import dayjs from "dayjs";
import toast from "react-hot-toast";

const MUNICIPAL_CATEGORIES = [
  "Street Light",
  "Waste Management",
  "Roads",
  "Drainage",
  "Water Supply",
  "Street Infrastructure",
  "Public Property",
  "Other"
];

export const AdminComplaintDetail = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [complaintData, setComplaintData] = useState(null);
  const [staffList, setStaffList] = useState([]);

  // Editable Form State
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("MEDIUM");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [assignmentNote, setAssignmentNote] = useState("");

  // Rejection modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchComplaintAndStaff = async () => {
    try {
      setLoading(true);
      const [compRes, staffRes] = await Promise.all([
        complaintApi.getComplaintById(id),
        adminApi.getStaffList()
      ]);

      if (compRes.data?.data) {
        const comp = compRes.data.data.complaint;
        setComplaintData(compRes.data.data);
        setSelectedCategory(comp.category);
        setSelectedPriority(comp.priority);
        setSelectedStaffId(comp.assignedStaff?._id || "");
      }

      if (staffRes.data?.data) {
        setStaffList(staffRes.data.data.staff || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load complaint data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaintAndStaff();
  }, [id]);

  // Save Category/Priority Override
  const handleUpdateClassification = async () => {
    try {
      setActionLoading(true);
      await adminApi.updateComplaint(id, {
        category: selectedCategory,
        priority: selectedPriority
      });
      toast.success("Classification updated successfully.");
      fetchComplaintAndStaff();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update complaint.");
    } finally {
      setActionLoading(false);
    }
  };

  // Assign or Reassign Staff
  const handleAssignStaff = async (e) => {
    e.preventDefault();
    if (!selectedStaffId) {
      toast.error("Please select a municipal officer to assign.");
      return;
    }

    try {
      setActionLoading(true);
      await adminApi.assignStaff(id, {
        staffId: selectedStaffId,
        remarks: assignmentNote
      });
      toast.success("Staff assigned successfully!");
      setAssignmentNote("");
      fetchComplaintAndStaff();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign staff.");
    } finally {
      setActionLoading(false);
    }
  };

  // Reject Complaint
  const handleRejectComplaint = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim() || rejectReason.trim().length < 5) {
      toast.error("Please provide a rejection reason (at least 5 characters).");
      return;
    }

    try {
      setActionLoading(true);
      await adminApi.rejectComplaint(id, { reason: rejectReason.trim() });
      toast.success("Complaint rejected.");
      setShowRejectModal(false);
      setRejectReason("");
      fetchComplaintAndStaff();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject complaint.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Complaint Details" subtitle="Loading incident file...">
        <div className="py-24 flex items-center justify-center text-[#0D9488]">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (!complaintData) {
    return (
      <AdminLayout title="Complaint Details" subtitle="Incident not found">
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-12 text-center shadow-xs">
          <p className="text-[#0F172A] font-bold">Complaint record not found.</p>
          <Link
            to="/admin/complaints"
            className="mt-3 inline-block px-4 py-2 rounded-xl bg-[#0F172A] text-white text-xs font-semibold hover:bg-slate-800"
          >
            Back to master table
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const { complaint, beforeImage, afterImage, progressImages, timeline, authenticityTests } = complaintData;
  const originalTest = authenticityTests?.find((t) => t.imageTarget === "original") || null;
  const hasAiConfidence = typeof complaint.aiConfidence === "number" && complaint.aiConfidence > 0;
  const confidencePct = hasAiConfidence ? Math.round(complaint.aiConfidence * 100) : null;

  const matchingDeptStaff = staffList.filter(
    (s) => s.isActive && s.department === complaint.category
  );
  const otherStaff = staffList.filter(
    (s) => s.isActive && s.department !== complaint.category
  );

  return (
    <AdminLayout
      title={`Complaint #${complaint.complaintNumber}`}
      subtitle={`Reported on ${dayjs(complaint.createdAt).format("DD MMM YYYY, hh:mm A")}`}
      actions={
        <Link
          to="/admin/complaints"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Directory
        </Link>
      }
    >
      {/* MAIN RECORD HEADER */}
      <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E2E8F0] shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-extrabold text-[#0D9488] bg-teal-50 px-3 py-1 rounded-lg border border-teal-200">
              #{complaint.complaintNumber}
            </span>
            <StatusBadge status={complaint.status} />
          </div>
          <div className="flex items-center gap-2">
            <PriorityBadge priority={complaint.priority} />
            {complaint.status !== "REJECTED" && (
              <button
                type="button"
                onClick={() => setShowRejectModal(true)}
                className="px-3 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-colors"
              >
                Reject Issue
              </button>
            )}
          </div>
        </div>

        <h1 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
          {complaint.title}
        </h1>
        <p className="text-sm text-[#475569] leading-relaxed">
          {complaint.description}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#F1F5F9] text-xs">
          <div className="flex items-center gap-2.5">
            <MapPin className="w-4 h-4 text-sky-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-[#0F172A]">Location Address</p>
              <p className="text-[#64748B]">{complaint.locationAddress}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <User className="w-4 h-4 text-[#0D9488] flex-shrink-0" />
            <div>
              <p className="font-semibold text-[#0F172A]">Reporting Citizen</p>
              <p className="text-[#64748B]">
                {complaint.citizen?.name} ({complaint.citizen?.email})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Phone className="w-4 h-4 text-purple-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-[#0F172A]">Citizen Contact</p>
              <p className="text-[#64748B]">{complaint.citizen?.phone || "No phone on file"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* AI CLASSIFICATION REVIEW & MANUAL OVERRIDE SECTION */}
      <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-xs space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0F172A]">
            <Cpu className="w-4 h-4 text-[#0D9488]" />
            AI Vision Prediction & Intelligent Recommendation
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-teal-50 text-[#0D9488] border border-teal-200">
            Confidence: {confidencePct !== null ? `${confidencePct}%` : "Pending AI Analysis"}
          </span>
        </div>

        {/* Confidence Progress Bar */}
        {confidencePct !== null ? (
          <div className="space-y-1">
            <div className="w-full bg-[#F1F5F9] h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${confidencePct}%` }}
              />
            </div>
            <p className="text-[11px] text-[#64748B]">
              Computer vision model evaluated visual attributes, contours, and citizen text description
            </p>
          </div>
        ) : (
          <p className="text-xs text-[#94A3B8] italic">
            AI analysis has not completed or is awaiting review.
          </p>
        )}

        {/* AI SUGGESTION TILES */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs">
          <div>
            <p className="text-[#64748B] font-semibold uppercase text-[10px]">AI Category</p>
            <p className="font-bold text-[#0F172A] mt-0.5">{complaint.aiCategory || complaint.predictedCategory || "Pending AI Analysis"}</p>
          </div>
          <div>
            <p className="text-[#64748B] font-semibold uppercase text-[10px]">AI Subcategory</p>
            <p className="font-bold text-[#0F172A] mt-0.5">
              {complaint.aiSubcategory || complaint.predictedSubcategory || (complaint.aiCategory ? "General Issue" : "Pending AI Analysis")}
            </p>
          </div>
          <div>
            <p className="text-[#64748B] font-semibold uppercase text-[10px]">Suggested Urgency</p>
            <p className="font-bold text-amber-700 mt-0.5">{complaint.aiPriority || "Pending AI Analysis"}</p>
          </div>
          <div>
            <p className="text-[#64748B] font-semibold uppercase text-[10px]">Prediction Source</p>
            <p className="font-bold text-[#0D9488] mt-0.5">
              {complaint.predictionSource === "gemini_vision" || complaint.predictionSource === "mobilenet"
                ? "Visual AI Analysis"
                : complaint.predictionSource === "rules"
                ? "Rule-Based System"
                : complaint.predictionSource === "manual"
                ? "Manual Citizen Override"
                : "Auto-Assigned"}
            </p>
          </div>
        </div>

        {/* Prediction Pipeline Diagnostic Metadata */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono text-[#64748B] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span>Engine: <strong className="text-slate-800">{complaint.modelLoaded ? "Active" : "Inactive"}</strong></span>
            <span>Fallback: <strong className={complaint.fallbackUsed ? "text-amber-700" : "text-emerald-700"}>{complaint.fallbackUsed ? (complaint.fallbackReason || "Yes") : "No"}</strong></span>
          </div>
          {complaint.requestId && (
            <span className="text-[10px] text-slate-400">Request ID: {complaint.requestId}</span>
          )}
        </div>

        {/* ADMIN OVERRIDE CONTROLS */}
        <div className="p-4 sm:p-5 rounded-xl border border-[#E2E8F0] bg-white space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
            Administrative Classification Override
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1">
                Final Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#0D9488]"
              >
                {MUNICIPAL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] mb-1">
                Final Priority
              </label>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#0D9488]"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleUpdateClassification}
              disabled={actionLoading}
              className="px-4 py-2 rounded-xl bg-[#0D9488] hover:bg-[#0f766e] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> Save Final Classification
            </button>
          </div>
        </div>
      </div>

      {/* STAFF ASSIGNMENT / DISPATCH SECTION */}
      <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-[#0F172A]">
            <UserCheck className="w-4 h-4 text-amber-600" />
            Assign or Reassign Municipal Field Officer
          </div>
          {complaint.assignedStaff && (
            <span className="text-xs text-[#64748B]">
              Currently Assigned: <span className="font-bold text-[#0F172A]">{complaint.assignedStaff.name}</span>
            </span>
          )}
        </div>

        <form onSubmit={handleAssignStaff} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#64748B] mb-1">
              Select Field Staff Member *
            </label>
            <select
              required
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#0D9488]"
            >
              <option value="">-- Choose Field Officer --</option>
              {matchingDeptStaff.length > 0 && (
                <optgroup label={`Recommended: Matching Department (${complaint.category})`}>
                  {matchingDeptStaff.map((staff) => (
                    <option key={staff._id} value={staff._id}>
                      ⭐ {staff.name} — {staff.designation || "Officer"} ({staff.department}) [{staff.assignedCount || 0} active]
                    </option>
                  ))}
                </optgroup>
              )}
              {otherStaff.length > 0 && (
                <optgroup label="Other Municipal Staff">
                  {otherStaff.map((staff) => (
                    <option key={staff._id} value={staff._id}>
                      {staff.name} — {staff.department} ({staff.designation || "Officer"}) [{staff.assignedCount || 0} active]
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#64748B] mb-1">
              Dispatch Instructions / Remarks (Optional)
            </label>
            <input
              type="text"
              value={assignmentNote}
              onChange={(e) => setAssignmentNote(e.target.value)}
              placeholder="e.g. Priority repair needed before Monday morning peak traffic..."
              className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] placeholder-[#94A3B8] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#0D9488]"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={actionLoading || !selectedStaffId}
              className="px-5 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold shadow-xs disabled:opacity-50 flex items-center gap-1.5 transition-all"
            >
              <Check className="w-4 h-4" />
              {complaint.assignedStaff ? "Reassign Officer" : "Dispatch & Assign Staff"}
            </button>
          </div>
        </form>
      </div>

      {/* BEFORE / AFTER PHOTO VERIFICATION */}
      <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-bold text-[#0F172A]">
            Photographic Proofs & Evidence Verification
          </h3>
          <span className="text-xs text-[#64748B]">
            Original Citizen Evidence & Staff Resolution Proofs
          </span>
        </div>
        <BeforeAfterComparison
          beforeImage={beforeImage}
          afterImage={afterImage}
          progressImages={progressImages}
          theme="light"
          beforeAction={
            <ImageAuthenticityTest
              complaintId={complaint._id || id}
              target="original"
              hasImage={Boolean(beforeImage)}
              imageLabel="Citizen Complaint Evidence (Original Photo)"
              disabledMessage="No original image was submitted with this complaint."
              existingTest={originalTest}
              onTestComplete={() => {
                fetchComplaintAndStaff();
              }}
            />
          }
        />
      </div>

      {/* TIMELINE */}
      <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-[#0F172A]">
          Activity History & Dispatch Audit Log
        </h3>
        <TimelineView updates={timeline} />
      </div>

      {/* REJECT MODAL */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 max-w-md w-full shadow-2xl text-[#0F172A] space-y-4">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0F172A]">Reject Complaint</h3>
              <p className="text-xs text-[#64748B] mt-1">
                Please enter the official reason for rejecting complaint #{complaint.complaintNumber} (e.g. duplicate submission, outside municipal jurisdiction).
              </p>
            </div>

            <form onSubmit={handleRejectComplaint} className="space-y-4">
              <textarea
                required
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection..."
                className="w-full p-3 bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] rounded-xl text-xs sm:text-sm focus:outline-none focus:border-rose-500 resize-y"
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#E2E8F0] text-xs font-semibold text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminComplaintDetail;
