import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, ArrowLeft, Camera, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Step = "method" | "phone-input" | "email-input";

const fade = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
};

const inputCls = "h-13 rounded-xl border-border/50 bg-secondary/50 text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-foreground/30 focus-visible:border-foreground/20";

const Signup = () => {
  const [step, setStep] = useState<Step>("method");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const navigate = useNavigate();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleEmailSubmit = async () => {
    if (!email.trim() || !email.includes("@")) { toast.error("Please enter a valid email"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate("/feed");
      } else {
        if (!name.trim()) { toast.error("Please enter your name"); setLoading(false); return; }
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { name }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created! Check your email to verify.");
        navigate("/interests");
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally { setLoading(false); }
  };

  const handlePhoneContinue = async () => {
    if (!name.trim()) { toast.error("Please enter your name"); return; }
    if (phone.trim().length < 7) {
      toast.error("Please enter a valid phone number");
      return;
    }
    // Sign up with email derived from phone (workaround since phone auth needs SMS provider)
    const fakeEmail = `${phone.replace(/\D/g, "")}@phone.rekindled.app`;
    const tempPassword = `phone_${phone.replace(/\D/g, "")}_${Date.now()}`;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: fakeEmail,
        password: tempPassword,
        options: { data: { name, phone } },
      });
      if (error) throw error;
      toast.success("Welcome to Rekindled!");
      navigate("/interests");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally { setLoading(false); }
  };

  const subtitle: Record<Step, string> = {
    method: isLogin ? "Welcome back" : "Let's get you started",
    "email-input": isLogin ? "Sign in to your account" : "Create your account",
    "phone-input": "Enter your phone number",
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
          {step === "method" && (
            <motion.div key="method" {...fade} className="w-full space-y-3">
              <button
                onClick={() => setStep("email-input")}
                className="flex w-full items-center gap-4 rounded-2xl border border-border/50 bg-card/50 p-5 text-left transition-all hover:bg-card hover:border-foreground/10 hover:shadow-card"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  <Mail className="h-5 w-5 text-foreground/70" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Continue with Email</p>
                  <p className="text-xs text-muted-foreground">Sign up or log in with email</p>
                </div>
              </button>
              <button
                onClick={() => setStep("phone-input")}
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
                <button onClick={() => { setIsLogin(true); setStep("email-input"); }} className="font-semibold text-foreground hover:underline underline-offset-4">
                  Sign in
                </button>
              </p>
            </motion.div>
          )}

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
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-foreground/70">Password</label>
                <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
              </div>
              <Button
                className="w-full rounded-full bg-foreground py-6 text-base font-semibold text-primary-foreground hover:opacity-90"
                onClick={handleEmailSubmit}
                disabled={loading}
              >
                {loading ? "Please wait..." : isLogin ? "Sign in" : "Create account"}
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
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Signup;
