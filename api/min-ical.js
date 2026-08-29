var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/minIcal.ts
var minIcal_exports = {};
__export(minIcal_exports, {
  config: () => config,
  default: () => handler
});
module.exports = __toCommonJS(minIcal_exports);
var GAS_URL = process.env.APPS_SCRIPT_URL || process.env.VITE_APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbznLoq62orP53izSEA0wnA7VdQHiNWpP3upTo2nd1owcL3LDZp13gK8LxrAdsjxWwt7vw/exec";
var config = { maxDuration: 60 };
var TOM_ICS = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Menighetsplan//NO\r\nCALSCALE:GREGORIAN\r\nX-WR-CALNAME:Menighetsplan\r\nEND:VCALENDAR\r\n";
function tokenFra(req) {
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
function debugLog(hypothesisId, message, data) {
  fetch("http://127.0.0.1:7773/ingest/22f8ce1a-6ae6-4b39-94db-6128c87cda21", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c1c83b" },
    body: JSON.stringify({
      sessionId: "c1c83b",
      hypothesisId,
      location: "server/minIcal.ts",
      message,
      data,
      timestamp: Date.now()
    })
  }).catch(() => {
  });
}
async function handler(req, res) {
  const t = tokenFra(req);
  debugLog("A", "minIcal request", {
    tokenLen: t.length,
    tokenPrefix: t.slice(0, 6),
    hasQueryT: Boolean(req.query?.t),
    url: String(req.url || "").slice(0, 120)
  });
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  if (!t) {
    debugLog("B", "minIcal missing token", {});
    res.status(400).send(TOM_ICS);
    return;
  }
  const dest = `${GAS_URL.replace(/\/$/, "")}?action=minIcal&t=${encodeURIComponent(t)}`;
  try {
    const upstream = await fetch(dest, { redirect: "follow" });
    const ics = await upstream.text();
    const harHendelser = ics.includes("BEGIN:VEVENT");
    const harKalendernavn = /X-WR-CALNAME|CALNAME:/i.test(ics);
    debugLog("C", "minIcal upstream", {
      ok: upstream.ok,
      status: upstream.status,
      icsLen: ics.length,
      harHendelser,
      harKalendernavn,
      startsWithVcal: ics.startsWith("BEGIN:VCALENDAR")
    });
    if (!upstream.ok || !ics.includes("BEGIN:VCALENDAR")) {
      res.status(502).send(TOM_ICS);
      return;
    }
    res.status(200).send(ics);
  } catch (err) {
    debugLog("D", "minIcal fetch error", { error: String(err) });
    res.status(502).send(TOM_ICS);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  config
});
module.exports = handler; module.exports.config = config;
