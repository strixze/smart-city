import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/authContex";
import Navbar from "../../components/Navbar";
import SmartCityLogo from "../../components/SmartCityLogo";
import {
  Lock,
  Mail,
  ArrowRight,
  Shield,
  Briefcase,
  User,
  Loader2,
  Sparkles,
  Eye,
  EyeOff,
  AlertCircle
} from "lucide-react";

export const Login = () => {
  const { t } = useTranslation();
  const { login, isLoggedIn, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [validationErrors, setValidationErrors] = useState({});

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (isLoggedIn && role) {
      redirectAfterLogin(role);
    }
  }, [isLoggedIn, role]);

  // Load remembered email if present
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("smartcity_remembered_email");
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, []);

  const redirectAfterLogin = (userRole) => {
    const from = location.state?.from?.pathname;
    if (from && !from.includes("/login") && !from.includes("/register")) {
      navigate(from, { replace: true });
      return;
    }

    if (userRole === "ADMIN") navigate("/admin/dashboard", { replace: true });
    else if (userRole === "STAFF") navigate("/staff/dashboard", { replace: true });
    else navigate("/citizen/dashboard", { replace: true });
  };

  const validate = () => {
    const errors = {};
    if (!email.trim()) {
      errors.email = t("validation.emailInvalid", "Email address is required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = t("validation.emailInvalid", "Please enter a valid email address");
    }

    if (!password) {
      errors.password = t("validation.passwordMinLength", "Password is required");
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
    const result = await login(email.trim(), password);
    setLoading(false);

    if (result.success) {
      try {
        if (rememberMe) {
          localStorage.setItem("smartcity_remembered_email", email.trim());
        } else {
          localStorage.removeItem("smartcity_remembered_email");
        }
      } catch {
        // Ignore localStorage error
      }
      redirectAfterLogin(result.user.role);
    } else {
      setServerError(result.message || "Invalid email or password. Please verify your credentials.");
    }
  };

  const fillDemo = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setServerError("");
    setValidationErrors({});
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-[#0F172A] antialiased selection:bg-teal-500 selection:text-white">
      {/* Public Top Navbar */}
      <Navbar />

      {/* Main Centered Authentication Area */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12 lg:py-16">
        <div className="max-w-md w-full">
          {/* Header Branding */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center mb-3">
              <SmartCityLogo variant="dark-text" size="lg" to="/" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
              {t("auth.login.title")}
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] mt-1 max-w-sm mx-auto">
              {t("auth.login.subtitle")}
            </p>
          </div>

          {/* Quick Evaluation Accounts Helper */}
          <div className="bg-white rounded-2xl p-4 sm:p-4.5 border border-[#E2E8F0] shadow-xs mb-5">
            <div className="flex items-center justify-between text-xs font-semibold text-[#475569] mb-2.5">
              <span className="flex items-center gap-1.5 font-bold text-[#0D9488]">
                <Sparkles className="w-3.5 h-3.5 text-[#0D9488]" /> {t("auth.login.demoAccounts")}
              </span>
              <span className="text-[10px] text-[#94A3B8] font-medium">Auto-fills credentials</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillDemo("admin@smartcity.local", "Admin@123")}
                className="px-2 py-2.5 min-h-[44px] rounded-xl bg-purple-50/70 hover:bg-purple-100/70 border border-purple-200 text-[11px] font-bold text-purple-800 transition-all flex flex-col items-center justify-center gap-1 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-purple-400"
                aria-label="Fill Admin credentials"
              >
                <Shield className="w-4 h-4 text-purple-600" />
                <span>{t("auth.login.demoAdmin")}</span>
              </button>

              <button
                type="button"
                onClick={() => fillDemo("staff@smartcity.local", "Staff@123")}
                className="px-2 py-2.5 min-h-[44px] rounded-xl bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200 text-[11px] font-bold text-amber-800 transition-all flex flex-col items-center justify-center gap-1 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-amber-400"
                aria-label="Fill Staff credentials"
              >
                <Briefcase className="w-4 h-4 text-amber-600" />
                <span>{t("auth.login.demoStaff")}</span>
              </button>

              <button
                type="button"
                onClick={() => fillDemo("citizen@smartcity.local", "Citizen@123")}
                className="px-2 py-2.5 min-h-[44px] rounded-xl bg-teal-50/70 hover:bg-teal-100/70 border border-teal-200 text-[11px] font-bold text-teal-800 transition-all flex flex-col items-center justify-center gap-1 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-teal-400"
                aria-label="Fill Citizen credentials"
              >
                <User className="w-4 h-4 text-teal-600" />
                <span>{t("auth.login.demoCitizen")}</span>
              </button>
            </div>
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
              {/* Email Input */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5"
                >
                  {t("auth.login.emailLabel")}
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
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (validationErrors.email) {
                        setValidationErrors((prev) => ({ ...prev, email: "" }));
                      }
                      if (serverError) setServerError("");
                    }}
                    placeholder={t("auth.login.emailPlaceholder")}
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

              {/* Password Input */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5"
                >
                  {t("auth.login.passwordLabel")}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (validationErrors.password) {
                        setValidationErrors((prev) => ({ ...prev, password: "" }));
                      }
                      if (serverError) setServerError("");
                    }}
                    placeholder="••••••••"
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
                {validationErrors.password && (
                  <p className="text-[11px] font-medium text-rose-600 mt-1 pl-1">
                    {validationErrors.password}
                  </p>
                )}
              </div>

              {/* Remember Me Option */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-[#CBD5E1] text-[#0D9488] focus:ring-[#0D9488]/30 accent-[#0D9488]"
                  />
                  <span className="text-xs font-medium text-[#64748B]">Remember my email</span>
                </label>
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
                    {t("auth.login.signingIn")}
                  </>
                ) : (
                  <>
                    {t("auth.login.signInBtn")} <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Footer Navigation Link */}
            <div className="mt-6 pt-5 border-t border-[#F1F5F9] text-center">
              <p className="text-xs text-[#64748B]">
                {t("auth.login.noAccount")}{" "}
                <Link
                  to="/register"
                  className="font-semibold text-[#0D9488] hover:text-[#0F766E] hover:underline"
                >
                  {t("auth.login.createAccount")}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;