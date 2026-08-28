/**
 * Fyller Supabase app_state med mock fra initialData.
 * Overskrives senere med Admin → «Hent fra Google-arket til Supabase».
 *
 * Leser SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY fra .env.local
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { byggStandardMockState } from "../src/services/persistens";

function lesEnvLocal(): Record<string, string> {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const ut: Record<string, string> = {};
  for (const linje of raw.split(/\r?\n/)) {
    const t = linje.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    ut[k] = v;
  }
  return ut;
}

const env = lesEnvLocal();
const supabaseUrl = (env.SUPABASE_URL || "").trim().replace(/\/$/, "");
const supabaseKey = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Mangler SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY i .env.local");
}

const payload = byggStandardMockState();
const url = `${supabaseUrl}/rest/v1/app_state?on_conflict=id`;
const res = await fetch(url, {
  method: "POST",
  headers: {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=representation",
  },
  body: JSON.stringify({ id: 1, payload }),
});
if (!res.ok) {
  throw new Error(`Supabase-lagring feilet (${res.status}): ${(await res.text()).slice(0, 300)}`);
}
const rader = (await res.json()) as Array<{ updated_at?: string }>;
console.log(
  `OK mock i app_state: ${payload.personer.length} personer, ${payload.gudstjenester.length} gudstjenester, ${payload.grupper.length} grupper. updated_at=${rader[0]?.updated_at || "?"}`
);
console.log("Erstatt med ekte ark: Admin → Hent fra Google-arket til Supabase.");
