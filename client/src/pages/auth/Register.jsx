import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/authContex";
import Navbar from "../../components/Navbar";
import SmartCityLogo from "../../components/SmartCityLogo";
import {
  Lock,
  Mail,
  User,
  Phone,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff,
  AlertCircle
} from "lucide-react";

export const Register = () => {
  const { t } = useTranslation();
  const { register, isLoggedIn, role } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: ""
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [validationErrors, setValidationErrors] = useState({});

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (isLoggedIn && role) {
      if (role === "ADMIN") navigate("/admin/dashboard", { replace: true });
      else if (role === "STAFF") navigate("/staff/dashboard", { replace: true });
      else navigate("/citizen/dashboard", { replace: true });
    }
  }, [isLoggedIn, role, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (validationErrors[name]) {
      setValidationErrors((prev) => ({ ...prev, [name]: "" }));
    }
    if (serverError) setServerError("");
  };

  const validate = () => {
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = t("validation.descRequired", "Full name is required");
    } else if (formData.name.trim().length < 2) {
      errors.name = t("validation.descRequired", "Name must be at least 2 characters");
    }

    if (!formData.email.trim()) {
      errors.email = t("validation.emailInvalid", "Email address is required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = t("validation.emailInvalid", "Please enter a valid email address");
    }

    if (!formData.password) {
      errors.password = t("validation.passwordMinLength", "Password is required");
    } else if (formData.password.length < 6) {
      errors.password = t("validation.passwordMinLength", "Password must be at least 6 characters");
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = t("validation.passwordMismatch", "Please confirm your password");
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = t("validation.passwordMismatch", "Passwords do not match");
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    if (!validate()) return;
    if (loading) return;

    setLoading(true);
    const result = await register({
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      password: formData.password
    });
    setLoading(false);

    if (result.success) {
      navigate("/citizen/dashboard", { replace: true });
    } else {
      setServerError(result.message || "Registration failed. Please try again.");
    }
  };

  const isPasswordValidLength = formData.password.length >= 6;
  const isPasswordsMatching =
    formData.confirmPassword.length > 0 && formData.password === formData.confirmPassword;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-[#0F172A] antialiased selection:bg-teal-500 selection:text-white">
      {/* Public Top Navbar */}
      <Navbar />

      {/* Main Centered Registration Area */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12 lg:py-16">
        <div className="max-w-md w-full">
          {/* Header Branding */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center mb-3">
              <SmartCityLogo variant="dark-text" size="lg" to="/" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
              {t("auth.register.title")}
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1 max-w-sm mx-auto">
              {t("auth.register.subtitle")}
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E2E8F0] shadow-xs">
            {/* Server Error Alert */}
            {serverError && (
              <div
                role="alert"
                className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in duration-200"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">{serverError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Full Name */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5"
                >
                  {t("auth.register.fullName")} *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    placeholder={t("auth.register.fullNamePlaceholder")}
                    disabled={loading}
                    className={`w-full pl-10 pr-4 py-2.5 bg-[#F8FAFC] border rounded-xl text-sm text-[#0F172A] placeholder-[#94A3B8] transition-all focus:outline-none focus:bg-white disabled:opacity-50 ${
                      validationErrors.name
                        ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
                        : "border-[#E2E8F0] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/15"
                    }`}
                  />
                </div>
                {validationErrors.name && (
                  <p className="text-[11px] font-medium text-rose-600 mt-1 pl-1">
                    {validationErrors.name}
                  </p>
                )}
              </div>

              {/* Email Address */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5"
                >
                  {t("auth.register.email")} *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder={t("auth.register.emailPlaceholder")}
                    disabled={loading}
                    className={`w-full pl-10 pr-4 py-2.5 bg-[#F8FAFC] border rounded-xl text-sm text-[#0F172A] placeholder-[#94A3B8] transition-all focus:outline-none focus:bg-white disabled:opacity-50 ${
                      validationErrors.email
                        ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
                        : "border-[#E2E8F0] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/15"
                    }`}
                  />
                </div>
                {validationErrors.email && (
                  <p className="text-[11px] font-medium text-rose-600 mt-1 pl-1">
                    {validationErrors.email}
                  </p>
                )}
              </div>

              {/* Phone Number */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="phone"
                    className="text-xs font-bold uppercase tracking-wider text-[#0F172A]"
                  >
                    {t("auth.register.phone")}
                  </label>
                  <span className="text-[11px] text-[#94A3B8]">Optional</span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder={t("auth.register.phonePlaceholder")}
                    disabled={loading}
                    className="w-full pl-10 pr-4 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] placeholder-[#94A3B8] transition-all focus:outline-none focus:border-[#0D9488] focus:bg-white focus:ring-2 focus:ring-[#0D9488]/15 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5"
                >
                  {t("auth.register.password")} *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    placeholder={t("auth.register.passwordPlaceholder")}
                    disabled={loading}
                    className={`w-full pl-10 pr-11 py-2.5 bg-[#F8FAFC] border rounded-xl text-sm text-[#0F172A] placeholder-[#94A3B8] transition-all focus:outline-none focus:bg-white disabled:opacity-50 ${
                      validationErrors.password
                        ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
                        : "border-[#E2E8F0] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/15"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#94A3B8] hover:text-[#475569] transition-colors focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 pl-1">
                  <span
                    className={`text-[11px] flex items-center gap-1 transition-colors ${
                      isPasswordValidLength
                        ? "text-emerald-600 font-semibold"
                        : "text-[#94A3B8]"
                    }`}
                  >
                    <CheckCircle2
                      className={`w-3 h-3 ${
                        isPasswordValidLength ? "text-emerald-500" : "text-[#CBD5E1]"
                      }`}
                    />
                    {t("validation.passwordMinLength")}
                  </span>
                </div>
                {validationErrors.password && (
                  <p className="text-[11px] font-medium text-rose-600 mt-1 pl-1">
                    {validationErrors.password}
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5"
                >
                  {t("auth.register.confirmPassword")} *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder={t("auth.register.confirmPasswordPlaceholder")}
                    disabled={loading}
                    className={`w-full pl-10 pr-11 py-2.5 bg-[#F8FAFC] border rounded-xl text-sm text-[#0F172A] placeholder-[#94A3B8] transition-all focus:outline-none focus:bg-white disabled:opacity-50 ${
                      validationErrors.confirmPassword
                        ? "border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15"
                        : "border-[#E2E8F0] focus:border-[#0D9488] focus:ring-2 focus:ring-[#0D9488]/15"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#94A3B8] hover:text-[#475569] transition-colors focus:outline-none"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {formData.confirmPassword.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1.5 pl-1">
                    <span
                      className={`text-[11px] flex items-center gap-1 font-semibold ${
                        isPasswordsMatching ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      <CheckCircle2
                        className={`w-3 h-3 ${
                          isPasswordsMatching ? "text-emerald-500" : "text-rose-400"
                        }`}
                      />
                      {isPasswordsMatching ? "Passwords match" : t("validation.passwordMismatch")}
                    </span>
                  </div>
                )}
                {validationErrors.confirmPassword && (
                  <p className="text-[11px] font-medium text-rose-600 mt-1 pl-1">
                    {validationErrors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-sm shadow-xs disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#0D9488] focus:ring-offset-2 mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("auth.register.signingUp")}
                  </>
                ) : (
                  <>
                    {t("auth.register.signUpBtn")} <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Footer Navigation Link */}
            <div className="mt-6 pt-5 border-t border-[#F1F5F9] text-center">
              <p className="text-xs text-[#64748B]">
                {t("auth.register.haveAccount")}{" "}
                <Link
                  to="/login"
                  className="font-semibold text-[#0D9488] hover:text-[#0F766E] hover:underline"
                >
                  {t("auth.register.signInLink")}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Register;
