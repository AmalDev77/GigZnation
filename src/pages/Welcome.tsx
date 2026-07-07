import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

const Welcome = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast.error("Google sign-in failed");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center px-6"
         style={{ backgroundColor: "#7C5CBF" }}>
      {/* Logo */}
      <h1
        className="font-display text-4xl font-bold text-white animate-[fadeInLogo_0.8s_ease-out_both]"
      >
        GigZnation
      </h1>

      {/* Tagline */}
      <p className="mt-4 text-center font-body text-base text-white/90">
        Every Stage. Every City. Every Night.
      </p>

      {/* Buttons */}
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-btn bg-white font-body text-sm font-medium text-foreground transition hover:bg-white/90 disabled:opacity-60"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <button
          onClick={() => navigate("/phone")}
          className="flex h-12 w-full items-center justify-center rounded-btn border border-white/60 font-body text-sm font-medium text-white transition hover:bg-white/10"
        >
          Use Phone Number
        </button>
      </div>

      {/* Bottom link */}
      <p className="absolute bottom-8 text-[11px] text-white/70 font-body">
        Already have an account?{" "}
        <button onClick={() => navigate("/phone")} className="underline text-white">
          Sign in
        </button>
      </p>

      <style>{`
        @keyframes fadeInLogo {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

export default Welcome;
