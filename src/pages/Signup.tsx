import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, ArrowLeft, Camera, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";

type Step = "method" | "phone-input" | "email-input" | "otp-verify";
type AuthMethod = "email" | "phone";

const fade = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
};

const inputCls = "h-13 rounded-xl border-border/50 bg-secondary/50 text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-foreground/30 focus-visible:border-foreground/20";

const OTP_LENGTH = 6;

const Signup = () => {
  const [step, setStep] = useState<Step>("method");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const navigate = useNavigate();
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // --- OTP input handlers ---
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = [...otp];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setOtp(next);
    const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
    otpRefs.current[focusIdx]?.focus();
  };

  const otpCode = otp.join("");

  // --- Email OTP: send code ---
  const sendEmailOtp = useCallback(async () => {
    setLoading(true);
    try {
      const opts: any = { email };
      if (!isLogin && name.trim()) {
        opts.options = { data: { name } };
      }
      const { error } = await supabase.auth.signInWithOtp(opts);
      if (error) throw error;
      toast.success("Check your email for a verification code");
      setResendCooldown(30);
      setOtp(Array(OTP_LENGTH).fill(""));
      setStep("otp-verify");
      setTimeout(() => otpRefs.current[0]?.focus(), 200);
    } catch (err: any) {
      toast.error(err.message || "Failed to send code");
    } finally {
      setLoading(false);
    }
  }, [email, name, isLogin]);

  const handleEmailSubmit = async () => {
    if (!email.trim() || !email.includes("@")) { toast.error("Please enter a valid email"); return; }
    if (!isLogin && !name.trim()) { toast.error("Please enter your name"); return; }
    setAuthMethod("email");
    await sendEmailOtp();
  };

  // --- Phone flow: go to OTP screen (demo) ---
  const handlePhoneContinue = () => {
    if (!name.trim()) { toast.error("Please enter your name"); return; }
    if (phone.trim().length < 7) { toast.error("Please enter a valid phone number"); return; }
    setAuthMethod("phone");
    setOtp(Array(OTP_LENGTH).fill(""));
    toast.success("Enter any 6-digit code to continue (demo)");
    setStep("otp-verify");
    setTimeout(() => otpRefs.current[0]?.focus(), 200);
  };

  // --- Verify OTP ---
  const handleVerifyOtp = async () => {
    if (otpCode.length !== OTP_LENGTH) { toast.error("Please enter the full 6-digit code"); return; }
    setLoading(true);
    try {
      if (authMethod === "email") {
        const { error } = await supabase.auth.verifyOtp({ email, token: otpCode, type: "email" });
        if (error) throw error;
        toast.success(isLogin ? "Welcome back!" : "Account verified!");
        trackEvent("onboarding_auth_success", { flow: isLogin ? "login" : "signup", auth_method: "email" });
        navigate(isLogin ? "/feed" : "/interests");
      } else {
        // Phone demo: accept any 6-digit code
        const fakeEmail = `${phone.replace(/\D/g, "")}@phone.rekindled.app`;
        const tempPassword = `phone_${phone.replace(/\D/g, "")}_${Date.now()}`;
        const { error } = await supabase.auth.signUp({
          email: fakeEmail,
          password: tempPassword,
          options: { data: { name, phone } },
        });
        if (error) throw error;
        toast.success("Welcome to Rekindled!");
        trackEvent("onboarding_auth_success", { flow: "signup", auth_method: "phone" });
        navigate("/interests");
      }
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  // --- Resend ---
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    if (authMethod === "email") {
      await sendEmailOtp();
    } else {
      toast.success("Enter any 6-digit code to continue (demo)");
      setResendCooldown(30);
    }
  };

  const subtitle: Record<Step, string> = {
    method: isLogin ? "Welcome back" : "Let's get you started",
    "email-input": isLogin ? "Sign in with a magic code" : "Create your account",
    "phone-input": "Enter your phone number",
    "otp-verify": authMethod === "email"
      ? `Enter the code sent to ${email}`
      : `Enter any 6-digit code (demo)`,
  };

  const avatarPicker = (
    <div className="flex justify-center">
      <label className="group relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border/50 bg-card/50 transition-all hover:border-foreground/20 hover:shadow-card">
        {avatarPreview ? (
          <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Camera className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            <span className="text-[10px] text-muted-foreground">Photo</span>
          </div>
        )}
        <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
      </label>
    </div>
  );

  return (
    <div className="flex min-h-[100svh] flex-col items-center justify-center bg-background px-6">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-[400px] w-[400px] rounded-full bg-accent/[0.03] blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] as const }}
        className="relative flex w-full max-w-[400px] flex-col items-center"
      >
        <h1 className="mb-2 font-display text-4xl font-bold tracking-tight">Rekindled</h1>
        <p className="mb-12 text-center text-sm text-muted-foreground">{subtitle[step]}</p>

        <AnimatePresence mode="wait">
          {/* Step 1: Method selection */}
          {step === "method" && (
            <motion.div key="method" {...fade} className="w-full space-y-3">
              <button
                onClick={() => {
                  trackEvent("onboarding_signup_method_selected", { method: "email" });
                  setStep("email-input");
                }}
                className="flex w-full items-center gap-4 rounded-2xl border border-border/50 bg-card/50 p-5 text-left transition-all hover:bg-card hover:border-foreground/10 hover:shadow-card"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  <Mail className="h-5 w-5 text-foreground/70" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Continue with Email</p>
                  <p className="text-xs text-muted-foreground">We'll send you a verification code</p>
                </div>
              </button>
              <button
                onClick={() => {
                  trackEvent("onboarding_signup_method_selected", { method: "phone" });
                  setStep("phone-input");
                }}
                className="flex w-full items-center gap-4 rounded-2xl border border-border/50 bg-card/50 p-5 text-left transition-all hover:bg-card hover:border-foreground/10 hover:shadow-card"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  <Phone className="h-5 w-5 text-foreground/70" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Continue with Phone</p>
                  <p className="text-xs text-muted-foreground">Verify via SMS code</p>
                </div>
              </button>
              <p className="pt-8 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <button
                  onClick={() => {
                    trackEvent("onboarding_signup_method_selected", { method: "email", intent: "login" });
                    setIsLogin(true);
                    setStep("email-input");
                  }}
                  className="font-semibold text-foreground hover:underline underline-offset-4"
                >
                  Sign in
                </button>
              </p>
            </motion.div>
          )}

          {/* Step 2a: Email input */}
          {step === "email-input" && (
            <motion.div key="email" {...fade} className="w-full space-y-5">
              {!isLogin && (
                <>
                  {avatarPicker}
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-foreground/70">Name</label>
                    <Input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-foreground/70">Email</label>
                <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
              </div>
              <Button
                className="w-full rounded-full bg-foreground py-6 text-base font-semibold text-primary-foreground hover:opacity-90"
                onClick={handleEmailSubmit}
                disabled={loading}
              >
                {loading ? "Sending code..." : "Send verification code"}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button onClick={() => setIsLogin(!isLogin)} className="font-semibold text-foreground hover:underline underline-offset-4">
                  {isLogin ? "Sign up" : "Sign in"}
                </button>
              </p>
              <button onClick={() => { setStep("method"); setIsLogin(false); }} className="flex w-full items-center justify-center gap-1.5 pt-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            </motion.div>
          )}

          {/* Step 2b: Phone input */}
          {step === "phone-input" && (
            <motion.div key="phone" {...fade} className="w-full space-y-5">
              {avatarPicker}
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-foreground/70">First Name</label>
                <Input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-foreground/70">Phone Number</label>
                <Input type="tel" placeholder="+1 (555) 000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
              </div>
              <Button
                className="w-full rounded-full bg-foreground py-6 text-base font-semibold text-primary-foreground hover:opacity-90"
                onClick={handlePhoneContinue}
                disabled={loading}
              >
                {loading ? "Please wait..." : "Continue"}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <button onClick={() => setStep("method")} className="flex w-full items-center justify-center gap-1.5 pt-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            </motion.div>
          )}

          {/* Step 3: OTP verification */}
          {step === "otp-verify" && (
            <motion.div key="otp" {...fade} className="w-full space-y-6">
              <div className="flex justify-center gap-3" onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="h-14 w-11 rounded-xl border border-border/50 bg-secondary/50 text-center text-xl font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/30 focus:border-foreground/20 transition-all"
                  />
                ))}
              </div>
              <Button
                className="w-full rounded-full bg-foreground py-6 text-base font-semibold text-primary-foreground hover:opacity-90"
                onClick={handleVerifyOtp}
                disabled={loading || otpCode.length !== OTP_LENGTH}
              >
                {loading ? "Verifying..." : "Verify"}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Didn't get a code?{" "}
                <button
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  className="font-semibold text-foreground hover:underline underline-offset-4 disabled:opacity-40 disabled:no-underline"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
              </p>
              <button
                onClick={() => {
                  setOtp(Array(OTP_LENGTH).fill(""));
                  setStep(authMethod === "email" ? "email-input" : "phone-input");
                }}
                className="flex w-full items-center justify-center gap-1.5 pt-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Signup;
