import type { DatabaseState } from "../src/types/database";
import { byggPersonIcs } from "../src/services/kalender";
import { finnPersonMedMagiskToken } from "../src/services/tilgang";
import { hentSupabaseState } from "./dbCore";

const GAS_URL =
  process.env.APPS_SCRIPT_URL ||
  process.env.VITE_APPS_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbznLoq62orP53izSEA0wnA7VdQHiNWpP3upTo2nd1owcL3LDZp13gK8LxrAdsjxWwt7vw/exec";

export const config = { maxDuration: 60 };

export const TOM_ICS =
  "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Menighetsplan//NO\r\nCALSCALE:GREGORIAN\r\nX-WR-CALNAME:Menighetsplan\r\nEND:VCALENDAR\r\n";

export type MinIcalRequest = {
  query?: Record<string, string | string[] | undefined>;
  url?: string;
};

export function parseMinIcalToken(req: MinIcalRequest): string {
  const q = req.query?.t;
  if (typeof q === "string" && q.trim()) return q.trim().replace(/\.ics$/i, "");
  if (Array.isArray(q) && q[0]) return String(q[0]).trim().replace(/\.ics$/i, "");
  try {
    const u = new URL(String(req.url || ""), "https://www.menighetsplan.no");
    const fraQuery = (u.searchParams.get("t") || "").trim();
    if (fraQuery) return fraQuery.replace(/\.ics$/i, "");
    const m = /\/kalender\/([^/?#]+)/i.exec(u.pathname);
    if (m) return decodeURIComponent(m[1]).replace(/\.ics$/i, "");
  } catch {
    return "";
  }
  return "";
}

export async function byggIcsForToken(token: string, fetchFn: typeof fetch = fetch): Promise<string | null> {
  const t = String(token || "").trim();
  if (!t) return null;

  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
  const supabaseKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (supabaseUrl && supabaseKey) {
    const state = await hentSupabaseState({ supabaseUrl, supabaseKey });
    if (state) {
      const person = finnPersonMedMagiskToken(state, t);
      if (person && person.Aktiv !== false) {
        return byggPersonIcs(state, person.PersonID);
      }
    }
  }

  const dest = `${GAS_URL.replace(/\/$/, "")}?action=minIcal&t=${encodeURIComponent(t)}`;
  try {
    const upstream = await fetchFn(dest, { redirect: "follow" });
    const ics = await upstream.text();
    if (!upstream.ok || !ics.includes("BEGIN:VCALENDAR")) return null;
    return ics;
  } catch {
    return null;
  }
}

export default async function handler(
  req: MinIcalRequest,
  res: {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => { send: (body: string) => void };
  }
) {
  const t = parseMinIcalToken(req);

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");

  if (!t) {
    res.status(200).send(TOM_ICS);
    return;
  }

  const ics = await byggIcsForToken(t);
  res.status(200).send(ics || TOM_ICS);
}
