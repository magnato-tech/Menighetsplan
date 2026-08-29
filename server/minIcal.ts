const GAS_URL =
  process.env.APPS_SCRIPT_URL ||
  process.env.VITE_APPS_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbznLoq62orP53izSEA0wnA7VdQHiNWpP3upTo2nd1owcL3LDZp13gK8LxrAdsjxWwt7vw/exec";

export const config = { maxDuration: 60 };

const TOM_ICS =
  "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Menighetsplan//NO\r\nCALSCALE:GREGORIAN\r\nX-WR-CALNAME:Menighetsplan\r\nEND:VCALENDAR\r\n";

function tokenFra(req: {
  query?: Record<string, string | string[] | undefined>;
  url?: string;
}): string {
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

// #region agent log
function debugLog(
  hypothesisId: string,
  message: string,
  data: Record<string, unknown>
): void {
  if (process.env.VERCEL) return;
  fetch("http://127.0.0.1:7773/ingest/22f8ce1a-6ae6-4b39-94db-6128c87cda21", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c1c83b" },
    body: JSON.stringify({
      sessionId: "c1c83b",
      hypothesisId,
      location: "server/minIcal.ts",
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}
// #endregion

export default async function handler(
  req: { query?: Record<string, string | string[] | undefined>; url?: string },
  res: {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => { send: (body: string) => void };
  }
) {
  const t = tokenFra(req);
  // #region agent log
  debugLog("A", "minIcal request", {
    tokenLen: t.length,
    tokenPrefix: t.slice(0, 6),
    hasQueryT: Boolean(req.query?.t),
    url: String(req.url || "").slice(0, 120),
  });
  // #endregion

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");

  if (!t) {
    // #region agent log
    debugLog("B", "minIcal missing token", {});
    // #endregion
    res.status(200).send(TOM_ICS);
    return;
  }

  const dest = `${GAS_URL.replace(/\/$/, "")}?action=minIcal&t=${encodeURIComponent(t)}`;
  try {
    const upstream = await fetch(dest, { redirect: "follow" });
    const ics = await upstream.text();
    const harHendelser = ics.includes("BEGIN:VEVENT");
    const harKalendernavn = /X-WR-CALNAME|CALNAME:/i.test(ics);
    // #region agent log
    debugLog("C", "minIcal upstream", {
      ok: upstream.ok,
      status: upstream.status,
      icsLen: ics.length,
      harHendelser,
      harKalendernavn,
      startsWithVcal: ics.startsWith("BEGIN:VCALENDAR"),
    });
    // #endregion

    if (!upstream.ok || !ics.includes("BEGIN:VCALENDAR")) {
      // #region agent log
      debugLog("C", "minIcal upstream invalid", {
        ok: upstream.ok,
        status: upstream.status,
        icsLen: ics.length,
      });
      // #endregion
      res.status(200).send(TOM_ICS);
      return;
    }
    res.status(200).send(ics);
  } catch (err) {
    // #region agent log
    debugLog("D", "minIcal fetch error", { error: String(err) });
    // #endregion
    res.status(200).send(TOM_ICS);
  }
}
