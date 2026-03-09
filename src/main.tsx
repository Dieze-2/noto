import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

/**
 * Supabase redirects append auth tokens as a URL hash fragment:
 *   #access_token=xxx&type=recovery
 * But HashRouter also uses the hash (#/route). They conflict.
 *
 * This handler detects Supabase auth params in the hash,
 * keeps them so the Supabase client can pick them up,
 * then after a tick rewrites the hash to the correct app route.
 */
(function handleSupabaseRedirect() {
  const hash = window.location.hash;
  if (!hash || hash.startsWith("#/")) return; // normal HashRouter route

  const params = new URLSearchParams(hash.substring(1)); // remove leading #
  const type = params.get("type");

  if (params.has("access_token") || params.has("error_description")) {
    // Let Supabase JS client detect and consume the tokens from the current URL.
    // After a microtask, redirect to the appropriate hash route.
    const targetRoute =
      type === "recovery" ? "#/reset-password" : "#/";

    // Use setTimeout so supabase client can read hash first
    setTimeout(() => {
      window.location.hash = targetRoute;
    }, 0);
  }
})();

createRoot(document.getElementById("root")!).render(<App />);
