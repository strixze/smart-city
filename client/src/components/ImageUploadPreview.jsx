import React, { useState, useRef } from "react";
import { UploadCloud, X, Image as ImageIcon, CheckCircle2, Camera } from "lucide-react";
import toast from "react-hot-toast";

export const ImageUploadPreview = ({
  onImageChange,
  required = false,
  label = "Upload Complaint Photograph",
  theme = "dark"
}) => {
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState("");
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const isLight = theme === "light";

  const handleFile = (file) => {
    if (!file) return;

    // Validate type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/svg+xml", "image/gif"];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(jpeg|jpg|png|webp|svg|gif)$/i)) {
      toast.error("Please upload a valid image file (JPEG, PNG, WEBP, SVG).");
      return;
    }

    // Validate size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size exceeds 10MB limit. Please upload a smaller image.");
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result);
      if (onImageChange) onImageChange(file, reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleClear = () => {
    setPreview(null);
    setFileName("");
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (onImageChange) onImageChange(null, null);
  };

  return (
    <div className="space-y-2">
      <label className={`block text-xs font-semibold ${isLight ? "text-[#0F172A]" : "text-slate-300"}`}>
        {label} {required && <span className="text-rose-500">*</span>}
      </label>

      {/* Hidden camera capture input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
          e.target.value = "";
        }}
      />

      {/* Hidden gallery file input */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg,image/svg+xml,image/gif"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
          e.target.value = "";
        }}
      />

      {/* Fallback alias ref input for external references */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg,image/svg+xml,image/gif"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
          e.target.value = "";
        }}
      />

      {!preview ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-5 sm:p-6 text-center transition-all ${
            isLight
              ? "border-[#CBD5E1] bg-[#F8FAFC]"
              : "border-slate-700 bg-[#070B14]"
          }`}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
            {/* Option 1: Take Photo */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all group shadow-2xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
                isLight
                  ? "bg-white border-[#E2E8F0] hover:border-[#0D9488] hover:bg-[#F0FDFA]"
                  : "bg-slate-900/60 border-slate-800 hover:border-teal-500 hover:bg-teal-500/10"
              }`}
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${
                  isLight
                    ? "bg-[#F0FDFA] text-[#0D9488] border border-[#CCFBF1]"
                    : "bg-teal-500/10 text-teal-400 border border-teal-500/30"
                }`}
              >
                <Camera className="w-5 h-5" />
              </div>
              <div className="text-center">
                <span className={`text-xs font-bold block ${isLight ? "text-[#0F172A]" : "text-slate-200"}`}>
                  Take Photo
                </span>
                <span className={`text-[10px] block mt-0.5 ${isLight ? "text-[#64748B]" : "text-slate-400"}`}>
                  Capture with camera
                </span>
              </div>
            </button>

            {/* Option 2: Upload from Gallery */}
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all group shadow-2xs cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
                isLight
                  ? "bg-white border-[#E2E8F0] hover:border-[#0D9488] hover:bg-[#F0FDFA]"
                  : "bg-slate-900/60 border-slate-800 hover:border-teal-500 hover:bg-teal-500/10"
              }`}
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${
                  isLight
                    ? "bg-[#F0FDFA] text-[#0D9488] border border-[#CCFBF1]"
                    : "bg-teal-500/10 text-teal-400 border border-teal-500/30"
                }`}
              >
                <UploadCloud className="w-5 h-5" />
              </div>
              <div className="text-center">
                <span className={`text-xs font-bold block ${isLight ? "text-[#0F172A]" : "text-slate-200"}`}>
                  Upload from Gallery
                </span>
                <span className={`text-[10px] block mt-0.5 ${isLight ? "text-[#64748B]" : "text-slate-400"}`}>
                  Select from device files
                </span>
              </div>
            </button>
          </div>

          <p className={`text-[11px] mt-3.5 ${isLight ? "text-[#64748B]" : "text-slate-400"}`}>
            or drag & drop photo here • JPG, JPEG, PNG, or WEBP (Max 10MB)
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className={`relative border rounded-2xl overflow-hidden aspect-video max-h-64 flex items-center justify-center ${
            isLight
              ? "border-[#E2E8F0] bg-[#F8FAFC]"
              : "border-slate-800 bg-[#070B14]"
          }`}>
            <img
              src={preview}
              alt="Upload Preview"
              className="w-full h-full object-contain"
            />
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="max-w-[120px] sm:max-w-[180px] truncate">{fileName}</span>
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 rounded-full bg-rose-600 text-white hover:bg-rose-700 shadow-md transition-colors"
                title="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Image replacement / change options */}
          <div className={`flex flex-wrap items-center justify-between gap-2 p-2 sm:p-2.5 rounded-xl border text-xs ${
            isLight
              ? "bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A]"
              : "bg-slate-900/60 border-slate-800 text-slate-300"
          }`}>
            <span className="text-[11px] font-medium truncate max-w-[130px] sm:max-w-[190px]">
              {fileName || "Photo attached"}
            </span>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-semibold text-[11px] transition-colors shadow-2xs ${
                  isLight
                    ? "bg-white border-[#E2E8F0] hover:bg-[#F0FDFA] hover:border-[#0D9488] text-[#0F172A]"
                    : "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200"
                }`}
                title="Retake photo using camera"
              >
                <Camera className="w-3.5 h-3.5 text-[#0D9488]" />
                <span>Retake</span>
              </button>
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-semibold text-[11px] transition-colors shadow-2xs ${
                  isLight
                    ? "bg-white border-[#E2E8F0] hover:bg-[#F0FDFA] hover:border-[#0D9488] text-[#0F172A]"
                    : "bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-200"
                }`}
                title="Choose different photo from gallery"
              >
                <UploadCloud className="w-3.5 h-3.5 text-[#0D9488]" />
                <span>Gallery</span>
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] transition-colors shadow-2xs"
                title="Remove photo"
              >
                <X className="w-3 h-3" />
                <span>Remove</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUploadPreview;
