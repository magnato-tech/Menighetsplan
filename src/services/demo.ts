/** Offentlig demo: fiktive data, ingen skriving til menighetens Supabase. */
export function erDemoVersjon(): boolean {
  if (String(import.meta.env?.VITE_DEMO || "").toLowerCase() === "true") return true;
  try {
    const h = String(globalThis.location?.hostname || "").toLowerCase();
    return h === "demo.menighetsplan.no" || h.endsWith(".demo.menighetsplan.no");
  } catch {
    return false;
  }
}

export const SKARP_APP_URL = "https://www.menighetsplan.no";
