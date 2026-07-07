import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const RESEND_SECONDS = 30;

const PhoneOTP = () => {
  const navigate = useNavigate();

  // Phone step
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [sending, setSending] = useState(false);

  // OTP step
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  // Resend timer
  const [resendTimer, setResendTimer] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const fullPhone = `${countryCode}${phone.replace(/\D/g, "")}`;

  const handleSendOtp = async () => {
    if (phone.replace(/\D/g, "").length < 8) {
      toast.error("Enter a valid phone number");
      return;
    }
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
    setSending(false);
    if (error) {
      toast.error(error.message);
    } else {
      setOtpSent(true);
      setResendTimer(RESEND_SECONDS);
      toast.success("OTP sent!");
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
    setSending(false);
    if (error) {
      toast.error(error.message);
    } else {
      setResendTimer(RESEND_SECONDS);
      setOtp(Array(6).fill(""));
      setError("");
      toast.success("OTP resent!");
      inputRefs.current[0]?.focus();
    }
  };

  const verifyOtp = useCallback(
    async (code: string) => {
      setVerifying(true);
      setError("");
      const { error } = await supabase.auth.verifyOtp({
        phone: fullPhone,
        token: code,
        type: "sms",
      });
      setVerifying(false);
      if (error) {
        setError("Incorrect code. Try again.");
        setShake(true);
        setTimeout(() => setShake(false), 500);
      } else {
        navigate("/");
      }
    },
    [fullPhone, navigate]
  );

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all 6 filled
    if (value && next.every((d) => d !== "")) {
      verifyOtp(next.join(""));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = Array(6).fill("");
    pasted.split("").forEach((c, i) => (next[i] = c));
    setOtp(next);
    if (pasted.length === 6) verifyOtp(pasted);
    else inputRefs.current[pasted.length]?.focus();
  };

  const countries = [
    { code: "+91", flag: "🇮🇳", label: "India" },
    { code: "+1", flag: "🇺🇸", label: "US" },
    { code: "+44", flag: "🇬🇧", label: "UK" },
    { code: "+61", flag: "🇦🇺", label: "AU" },
    { code: "+971", flag: "🇦🇪", label: "UAE" },
  ];

  const selectedCountry = countries.find((c) => c.code === countryCode) ?? countries[0];

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 pt-4 pb-8">
      {/* Back arrow */}
      <button
        onClick={() => navigate(-1)}
        className="self-start p-2 -ml-2 text-foreground"
        aria-label="Go back"
      >
        <ArrowLeft size={24} />
      </button>

      <div className="mt-8 w-full max-w-sm mx-auto flex flex-col">
        <h1 className="font-display font-bold text-[28px] leading-tight text-foreground">
          Enter your number
        </h1>
        <p className="mt-2 font-body text-sm text-muted-foreground">
          We'll send you a 6-digit code
        </p>

        {/* Phone input row */}
        <div className="mt-8 flex gap-2">
          {/* Country code dropdown */}
          <div className="relative">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="h-12 appearance-none rounded-btn border border-card-border bg-card pl-3 pr-8 font-body text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          {/* Phone number */}
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="98765 43210"
            maxLength={15}
            className="h-12 flex-1 rounded-btn border border-card-border bg-card px-4 font-body text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Send OTP button */}
        {!otpSent && (
          <button
            onClick={handleSendOtp}
            disabled={sending}
            className="mt-6 h-12 w-full rounded-btn bg-accent font-body text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send OTP"}
          </button>
        )}

        {/* OTP section */}
        {otpSent && (
          <div className="mt-8 flex flex-col items-center animate-fade-in">
            {/* 6 boxes */}
            <div
              className={cn("flex gap-2", shake && "animate-[shakeBoxes_0.4s_ease-in-out]")}
              onPaste={handleOtpPaste}
            >
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className={cn(
                    "w-12 h-14 text-center text-xl font-body rounded-btn border-2 bg-card transition-colors focus:outline-none",
                    error
                      ? "border-destructive"
                      : "border-card-border focus:border-primary"
                  )}
                />
              ))}
            </div>

            {/* Error */}
            {error && (
              <p className="mt-3 text-sm font-body text-destructive">{error}</p>
            )}

            {/* Resend */}
            <div className="mt-4">
              {resendTimer > 0 ? (
                <p className="text-sm font-body text-muted-foreground">
                  Resend in {resendTimer}s
                </p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={sending}
                  className="text-sm font-body font-medium text-primary hover:underline disabled:opacity-60"
                >
                  Resend OTP
                </button>
              )}
            </div>

            {verifying && (
              <p className="mt-3 text-sm font-body text-muted-foreground">
                Verifying…
              </p>
            )}
          </div>
        )}
      </div>

      {/* Shake animation */}
      <style>{`
        @keyframes shakeBoxes {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
};

export default PhoneOTP;
