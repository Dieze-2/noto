import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/GlassCard";
import { motion } from "framer-motion";
import logo from "@/assets/logo.png";
import { useTranslation } from "react-i18next";

export default function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/#/reset-password`,
      });
      if (error) setError(error.message);
      else setError(t("login.resetEmailSent"));
      setLoading(false);
      return;
    }

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) setError(error.message);
      else setError(t("login.checkEmail"));
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 text-center flex flex-col items-center">
          <img src={logo} alt="NOTO" className="w-24 h-24 mb-4 object-contain rounded-2xl" />
          <h1 className="text-noto-title text-5xl text-primary">NOTO</h1>
          <p className="mt-2 text-sm text-muted-foreground">Track. Train. Transform.</p>
        </div>

        <GlassCard className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-noto-label text-muted-foreground mb-1 block">{t("login.email")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-muted/50 px-3 py-2.5 text-foreground outline-none ring-1 ring-border focus:ring-primary transition-all"
                required
              />
            </div>

            {mode !== "forgot" && (
              <div>
                <label className="text-noto-label text-muted-foreground mb-1 block">{t("login.password")}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg bg-muted/50 px-3 py-2.5 text-foreground outline-none ring-1 ring-border focus:ring-primary transition-all"
                  required
                />
              </div>
            )}

            {error && (
              <p className={`text-sm ${mode === "forgot" && error === t("login.resetEmailSent") ? "text-foreground" : "text-destructive"}`}>{error}</p>
            )}

            <Button type="submit" disabled={loading} className="mt-2 font-bold">
              {mode === "forgot"
                ? (loading ? t("login.sending") : t("login.resetPassword"))
                : mode === "login"
                  ? (loading ? t("login.loggingIn") : t("login.login"))
                  : (loading ? t("login.signingUp") : t("login.signup"))}
            </Button>
          </form>

          {mode === "login" && (
            <button
              type="button"
              onClick={() => { setMode("forgot"); setError(""); }}
              className="mt-3 block w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              {t("login.forgotPassword")}
            </button>
          )}

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "forgot" ? (
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); }}
                className="font-bold text-primary hover:underline"
              >
                {t("login.backToLogin")}
              </button>
            ) : (
              <>
                {mode === "login" ? t("login.noAccount") : t("login.hasAccount")}{" "}
                <button
                  type="button"
                  onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
                  className="font-bold text-primary hover:underline"
                >
                  {mode === "login" ? t("login.signup") : t("login.login")}
                </button>
              </>
            )}
          </p>
        </GlassCard>
      </motion.div>
    </div>
  );
}
