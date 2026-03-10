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
(async function handleSupabaseRedirect() {
  const hash = window.location.hash;
  if (!hash || hash.startsWith("#/")) return; // normal HashRouter route

  const params = new URLSearchParams(hash.substring(1)); // remove leading #
  const type = params.get("type");

  if (params.has("access_token") || params.has("error_description")) {
    // Import supabase client and let it exchange the tokens from the URL hash
    const { supabase } = await import("@/lib/supabaseClient");
    // This forces Supabase to detect & consume the hash tokens
    await supabase.auth.getSession();

    const targetRoute =
      type === "recovery" ? "#/reset-password" : "#/";

    window.location.hash = targetRoute;
  }
})();

createRoot(document.getElementById("root")!).render(<App />);
