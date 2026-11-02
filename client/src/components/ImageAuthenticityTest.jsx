import React, { useState, useEffect } from "react";
import { complaintApi } from "../api/client";
import {
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Loader2,
  X,
  RefreshCw,
  Info,
  Calendar,
  Layers,
  Cpu
} from "lucide-react";
import toast from "react-hot-toast";
import dayjs from "dayjs";

/**
 * Reusable On-Demand AI Image Authenticity Test Component
 *
 * CRITICAL RULE:
 * Absolutely NO automatic calls. Only calls the backend when the user explicitly clicks "Test Image Authenticity".
 *
 * @param {Object} props
 * @param {string} props.complaintId - Complaint ID or Complaint Number
 * @param {'original' | 'resolution'} props.target - Explicit image target to test
 * @param {boolean} props.hasImage - Whether the target image exists
 * @param {string} [props.imageLabel] - Human-readable label (e.g. "Original Complaint Evidence")
 * @param {string} [props.disabledMessage] - Optional explanation when image is unavailable
 * @param {Object} [props.existingTest] - Optional previously stored test result to display
 * @param {Function} [props.onTestComplete] - Optional callback after new test finishes
 */
export const ImageAuthenticityTest = ({
  complaintId,
  target = "original",
  hasImage = true,
  imageLabel,
  disabledMessage,
  existingTest = null,
  onTestComplete
}) => {
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState(existingTest);
  const [showModal, setShowModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Update if parent provides an existing test
  useEffect(() => {
    if (existingTest && !testResult) {
      setTestResult(existingTest);
    }
  }, [existingTest]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && showModal) {
        setShowModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showModal]);

  const defaultLabel =
    target === "original"
      ? "Original Complaint Evidence (Citizen Submission)"
      : "Staff Resolution Proof (AFTER Photo)";

  const targetDisplayName = imageLabel || defaultLabel;

  const handleRunTest = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!hasImage) {
      toast.error(
        disabledMessage ||
          `No ${target === "original" ? "original evidence" : "resolution photo"} image is available to analyze.`
      );
      return;
    }

    if (loading) return; // Prevent double-clicks

    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await complaintApi.testImageAuthenticity(complaintId, target);

      if (res.data?.data?.testResult) {
        const result = res.data.data.testResult;
        setTestResult(result);
        setShowModal(true);
        toast.success("Image authenticity analysis completed.");
        if (typeof onTestComplete === "function") {
          onTestComplete(result);
        }
      } else {
        throw new Error("Invalid response format received from server.");
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Failed to test image authenticity. Please try again.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Assessment presentation helpers
  const getAssessmentConfig = (assessment) => {
    switch (assessment) {
      case "LIKELY_AI_GENERATED":
        return {
          title: "Likely AI-Generated",
          badgeBg: "bg-amber-50 text-amber-800 border-amber-300",
          icon: AlertTriangle,
          iconColor: "text-amber-600",
          summaryText: "Visual clues indicate potential AI synthesis or synthetic manipulation."
        };
      case "LIKELY_PHOTOGRAPHIC":
        return {
          title: "Likely Photographic",
          badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-300",
          icon: CheckCircle2,
          iconColor: "text-emerald-600",
          summaryText: "Visual clues appear consistent with an authentic optical camera capture."
        };
      case "INCONCLUSIVE":
      default:
        return {
          title: "Inconclusive",
          badgeBg: "bg-slate-100 text-slate-800 border-slate-300",
          icon: HelpCircle,
          iconColor: "text-slate-600",
          summaryText: "Visual evidence was insufficient or ambiguous for a conclusive estimate."
        };
    }
  };

  return (
    <div className="w-full">
      {/* TRIGGER BUTTON & STATUS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunTest}
            disabled={loading || !hasImage}
            aria-busy={loading}
            aria-label={`Test image authenticity for ${targetDisplayName}`}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all min-h-[40px] ${
              !hasImage
                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                : loading
                ? "bg-teal-50 text-teal-700 border border-teal-300 cursor-wait"
                : "bg-white hover:bg-teal-50/60 text-[#0F172A] hover:text-[#0D9488] border border-[#CBD5E1] hover:border-teal-400 active:scale-[0.98]"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#0D9488]" />
                <span>Analyzing image…</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-[#0D9488]" />
                <span>Test Image Authenticity</span>
              </>
            )}
          </button>

          {/* Quick view button if result already exists */}
          {testResult && !loading && (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#F1F5F9] hover:bg-slate-200 text-[#0F172A] border border-[#E2E8F0] transition-colors"
            >
              <span>View Report</span>
            </button>
          )}
        </div>

        {/* Existing Assessment Pill (if available) */}
        {testResult && !loading && (
          <div className="flex items-center gap-1.5">
            {(() => {
              const cfg = getAssessmentConfig(testResult.assessment);
              const Icon = cfg.icon;
              return (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cfg.badgeBg}`}
                >
                  <Icon className={`w-3.5 h-3.5 ${cfg.iconColor}`} />
                  <span>{cfg.title}</span>
                  {typeof testResult.confidence === "number" && testResult.confidence > 0 && (
                    <span className="font-mono opacity-80">({testResult.confidence}%)</span>
                  )}
                </span>
              );
            })()}
          </div>
        )}
      </div>

      {/* Explanation when disabled */}
      {!hasImage && disabledMessage && (
        <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
          <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span>{disabledMessage}</span>
        </p>
      )}

      {/* In-place Error Notification */}
      {errorMsg && (
        <div className="mt-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Analysis Failed</p>
            <p className="text-[11px] mt-0.5">{errorMsg}</p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-500 hover:text-rose-700"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* RESULT MODAL DIALOG */}
      {showModal && testResult && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="image-authenticity-title"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
        >
          <div className="bg-white border border-[#E2E8F0] rounded-2xl sm:rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-[#0D9488] flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="image-authenticity-title" className="text-base font-bold text-[#0F172A]">
                    AI Image Authenticity Assessment
                  </h3>
                  <p className="text-xs text-[#64748B]">Automated Visual Verification Engine</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                aria-label="Close report dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Target Details */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-[#E2E8F0] text-xs">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Layers className="w-3.5 h-3.5 text-[#0D9488]" />
                  <span className="font-semibold">Evidence Target:</span>
                  <span className="font-bold text-[#0F172A]">{targetDisplayName}</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                  <Cpu className="w-3 h-3 text-slate-400" />
                  <span>Visual Analysis</span>
                </div>
              </div>

              {/* Assessment Banner */}
              {(() => {
                const cfg = getAssessmentConfig(testResult.assessment);
                const Icon = cfg.icon;
                return (
                  <div className={`p-4 rounded-2xl border ${cfg.badgeBg} space-y-2`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-5 h-5 ${cfg.iconColor}`} />
                        <span className="text-sm sm:text-base font-extrabold tracking-tight">
                          {cfg.title}
                        </span>
                      </div>

                      {typeof testResult.confidence === "number" && testResult.confidence > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-600">
                            Estimated Confidence:
                          </span>
                          <span className="text-xs font-extrabold font-mono px-2 py-0.5 rounded-full bg-white border border-slate-300">
                            {testResult.confidence}%
                          </span>
                        </div>
                      )}
                    </div>

                    <p className="text-xs leading-relaxed opacity-95">{cfg.summaryText}</p>

                    {/* Confidence Meter Bar */}
                    {typeof testResult.confidence === "number" && testResult.confidence > 0 && (
                      <div className="pt-1">
                        <div className="w-full bg-black/10 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              testResult.assessment === "LIKELY_AI_GENERATED"
                                ? "bg-amber-600"
                                : testResult.assessment === "LIKELY_PHOTOGRAPHIC"
                                ? "bg-emerald-600"
                                : "bg-slate-600"
                            }`}
                            style={{ width: `${testResult.confidence}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Observations & Reasoning */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-2.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#0D9488]" />
                  <span>Visual Clues & Forensic Observations</span>
                </h4>
                {Array.isArray(testResult.reasoning) && testResult.reasoning.length > 0 ? (
                  <ul className="space-y-2">
                    {testResult.reasoning.map((item, idx) => (
                      <li
                        key={idx}
                        className="text-xs text-[#334155] leading-relaxed bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0] flex items-start gap-2.5"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0D9488] flex-shrink-0 mt-1.5" />
                        <span className="flex-1">{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 italic bg-slate-50 p-3 rounded-xl">
                    No specific visual anomalies observed.
                  </p>
                )}
              </div>

              {/* Explicit Model Limitations Notice */}
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-900 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>Advisory Notice & Model Limitations</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800/90">
                  {testResult.limitations ||
                    "AI-generated image detection is an estimate based on visual clues. It cannot prove whether an image is genuine or AI-generated. Review the evidence and other complaint details before making a decision."}
                </p>
              </div>

              {/* Timestamp & Auditor */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#64748B]">
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Test conducted on:{" "}
                    {dayjs(testResult.testedAt || testResult.createdAt).format(
                      "DD MMM YYYY, hh:mm A"
                    )}
                  </span>
                </div>
                {testResult.testedBy && (
                  <span>
                    Requested by:{" "}
                    <strong className="text-slate-700">
                      {testResult.testedBy.name || "Authorized User"} ({testResult.userRole || testResult.testedBy.role})
                    </strong>
                  </span>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-[#E2E8F0] bg-[#F8FAFC] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={handleRunTest}
                disabled={loading}
                className="px-4 py-2 rounded-xl border border-[#CBD5E1] bg-white hover:bg-slate-50 text-[#0F172A] text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0D9488]" />
                    <span>Re-testing image…</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Re-test Image</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageAuthenticityTest;
