import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import GlassCard from "@/components/GlassCard";
import { motion } from "framer-motion";
import logo from "@/assets/logo.png";
import { useTranslation } from "react-i18next";

/**
 * Animated neon "NOTO" SVG component.
 * Each letter is drawn with stroke-dashoffset animation.
 */
function NeonNotoLogo() {
  const letters = [
  // N
  "M 10 80 L 10 20 L 50 80 L 50 20",
  // O
  "M 65 50 C 65 22 95 22 95 50 C 95 78 65 78 65 50 Z",
  // T
  "M 105 20 L 145 20 M 125 20 L 125 80",
  // O
  "M 155 50 C 155 22 185 22 185 50 C 185 78 155 78 155 50 Z"];


  const strokeColor = "hsl(156, 100%, 50%)";
  const glowFilter = `
    drop-shadow(0 0 6px hsl(156, 100%, 50%))
    drop-shadow(0 0 20px hsl(156, 100%, 50%))
    drop-shadow(0 0 40px hsla(156, 100%, 50%, 0.5))
    drop-shadow(0 0 80px hsla(156, 100%, 50%, 0.3))
  `;

  return (
    <svg
      viewBox="0 0 195 100"
      className="w-48 h-auto"
      style={{ filter: glowFilter }}>
      
      {letters.map((d, i) =>
      <motion.path
        key={i}
        d={d}
        fill="none"
        stroke={strokeColor}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{
          pathLength: { delay: i * 0.25, duration: 0.8, ease: "easeInOut" },
          opacity: { delay: i * 0.25, duration: 0.1 }
        }} />

      )}
    </svg>);

}

export default function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // MUST end with trailing slash to avoid GitHub Pages 302 redirect which strips hash fragments
    const siteBase = `${window.location.origin}${window.location.pathname}`.replace(/\/?$/, "/");

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: siteBase
      });
      if (error) setError(error.message);else
      setError(t("login.resetEmailSent"));
      setLoading(false);
      return;
    }

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: siteBase,
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            date_of_birth: birthDate || null
          }
        }
      });
      if (error) setError(error.message);else
      {
        // Update profile with name + birth date
        if (data?.user) {
          await supabase.from("profiles").update({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            date_of_birth: birthDate || null
          }).eq("id", data.user.id);
        }
        setError(t("login.checkEmail"));
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4 bg-primary-foreground">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm">
        
        <div className="mb-8 text-center flex flex-col items-center gap-4">
          <motion.img
            src={logo}
            alt="NOTO"
            className="w-36 h-36 object-contain rounded-2xl"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }} />
          
          <NeonNotoLogo />
          <motion.p
            className="text-base font-bold text-primary tracking-[0.3em] uppercase"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.2 }}
            style={{
              textShadow: "0 0 20px hsla(156, 100%, 50%, 0.5), 0 0 40px hsla(156, 100%, 50%, 0.3)"
            }}>
            
            Track. Train. Transform.
          </motion.p>
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
                required />
              
            </div>

            {mode !== "forgot" &&
            <div>
                <label className="text-noto-label text-muted-foreground mb-1 block">{t("login.password")}</label>
                <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-muted/50 px-3 py-2.5 text-foreground outline-none ring-1 ring-border focus:ring-primary transition-all"
                required />
              
              </div>
            }

            {mode === "signup" &&
            <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-noto-label text-muted-foreground mb-1 block">{t("login.firstName")}</label>
                    <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-lg bg-muted/50 px-3 py-2.5 text-foreground outline-none ring-1 ring-border focus:ring-primary transition-all"
                    required />
                  
                  </div>
                  <div>
                    <label className="text-noto-label text-muted-foreground mb-1 block">{t("login.lastName")}</label>
                    <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-lg bg-muted/50 px-3 py-2.5 text-foreground outline-none ring-1 ring-border focus:ring-primary transition-all"
                    required />
                  
                  </div>
                </div>
                <div>
                  <label className="text-noto-label text-muted-foreground mb-1 block">{t("login.birthDate")}</label>
                  <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full rounded-lg bg-muted/50 px-3 py-2.5 text-foreground outline-none ring-1 ring-border focus:ring-primary transition-all" />
                
                </div>
              </>
            }

            {error &&
            <p className={`text-sm ${mode === "forgot" && error === t("login.resetEmailSent") ? "text-foreground" : "text-destructive"}`}>{error}</p>
            }

            <Button type="submit" disabled={loading} className="mt-2 font-bold">
              {mode === "forgot" ?
              loading ? t("login.sending") : t("login.resetPassword") :
              mode === "login" ?
              loading ? t("login.loggingIn") : t("login.login") :
              loading ? t("login.signingUp") : t("login.signup")}
            </Button>
          </form>

          {mode === "login" &&
          <button
            type="button"
            onClick={() => {setMode("forgot");setError("");}}
            className="mt-3 block w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors">
            
              {t("login.forgotPassword")}
            </button>
          }

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "forgot" ?
            <button
              type="button"
              onClick={() => {setMode("login");setError("");}}
              className="font-bold text-primary hover:underline">
              
                {t("login.backToLogin")}
              </button> :

            <>
                {mode === "login" ? t("login.noAccount") : t("login.hasAccount")}{" "}
                <button
                type="button"
                onClick={() => {setMode(mode === "login" ? "signup" : "login");setError("");}}
                className="font-bold text-primary hover:underline">
                
                  {mode === "login" ? t("login.signup") : t("login.login")}
                </button>
              </>
            }
          </p>
        </GlassCard>
      </motion.div>
    </div>);

}