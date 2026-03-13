import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

// Apply saved font size
const savedFont = localStorage.getItem("fontScale") || "normal";
document.documentElement.classList.add(`font-${savedFont}`);

/**
 * Supabase redirects append auth tokens as a URL hash fragment:
 *   #access_token=xxx&type=recovery&refresh_token=yyy
 * But HashRouter also uses the hash (#/route). They conflict.
 *
 * This handler:
 * 1. Detects Supabase auth params in the hash
 * 2. Manually calls setSession() so Supabase establishes the session
 * 3. Rewrites the hash to the correct app route
 * 4. THEN renders the app
 */
async function handleSupabaseRedirect() {
  const hash = window.location.hash;
  if (!hash || hash.startsWith("#/")) return; // normal HashRouter route

  const params = new URLSearchParams(hash.substring(1)); // remove leading #
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const type = params.get("type");

  if (accessToken && refreshToken) {
    // Dynamically import to avoid circular issues
    const { supabase } = await import("@/lib/supabaseClient");

    // Manually set the session from the URL tokens
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Redirect to the appropriate hash route
    const targetRoute = type === "recovery" ? "#/reset-password" : "#/";
    window.location.hash = targetRoute;
  } else if (params.has("error_description")) {
    window.location.hash = "#/login";
  }
}

// Wait for redirect handling to complete BEFORE rendering the app
handleSupabaseRedirect().finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
