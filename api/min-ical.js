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
  TOM_ICS: () => TOM_ICS,
  byggIcsForToken: () => byggIcsForToken,
  config: () => config,
  default: () => handler,
  parseMinIcalToken: () => parseMinIcalToken
});
module.exports = __toCommonJS(minIcal_exports);

// src/data/initialData.ts
var MAL_DATO = "2026-01-10";
function mal(id, rekkefolge, tittel, varighet, rolleId, forStart = false) {
  return {
    MalAktivitetID: id,
    Rekkefolge: rekkefolge,
    Tittel: tittel,
    VarighetMin: varighet,
    RolleID: rolleId,
    ForStart: forStart,
    Merknad: "",
    OpprettetDato: MAL_DATO,
    SistEndret: MAL_DATO
  };
}
var initialMalaktiviteter = [
  mal("MA001", 1, "Velkommen ved inngang", 15, "R008", true),
  mal("MA002", 2, "Lovsang x2", 7, "R005"),
  mal("MA003", 3, "Velkommen. \xC5pningsord", 3, "R001"),
  mal("MA004", 4, "B\xF8nn", 2, "R001"),
  mal("MA005", 5, "Kunngj\xF8ringer", 3, "R001"),
  mal("MA006", 6, "Lovsang x3", 10, "R005"),
  mal("MA007", 7, "Barnekirke", 2, "R004"),
  mal("MA008", 8, "Kaffe / te-p\xE5fyll", 8, "R008"),
  mal("MA009", 9, "B\xF8nn f\xF8r tale", 2, "R001"),
  mal("MA010", 10, "Tale / undervisning", 20, "R002"),
  mal("MA011", 11, "Lovsang", 5, "R005"),
  mal("MA012", 12, "Nattverd og presentasjon av b\xF8nnestasjoner (3stk)", 8, ""),
  mal("MA013", 13, "Forb\xF8nn", 7, "R003"),
  mal("MA014", 14, "Kollekt", 2, "R001"),
  mal("MA015", 15, "Lovsang x2", 7, "R005"),
  mal("MA016", 16, "Velsignelsen", 1, "R001"),
  mal("MA017", 17, "Lovsang (avslutningssang)", 2, "R005"),
  mal("MA018", 18, "Kirkekaffe", 0, "R008")
];
var MAL_GUDSTJENESTE_ID = "MAL001";
var initialMalposter = initialMalaktiviteter.map((m, i) => ({
  MalPostID: `MP${String(i + 1).padStart(3, "0")}`,
  MalID: MAL_GUDSTJENESTE_ID,
  Rekkefolge: m.Rekkefolge,
  Tittel: m.Tittel,
  VarighetMin: m.VarighetMin,
  RolleID: m.RolleID || "",
  ForStart: Boolean(m.ForStart),
  Merknad: m.Merknad || "",
  OpprettetDato: MAL_DATO,
  SistEndret: MAL_DATO
}));
var initialMalTilleggsvakter = [
  { RolleID: "R006", Antall: 1 },
  { RolleID: "R007", Antall: 1 },
  { RolleID: "R009", Antall: 2 },
  { RolleID: "R010", Antall: 2 },
  { RolleID: "R011", Antall: 2 },
  { RolleID: "R012", Antall: 1 },
  { RolleID: "R013", Antall: 1 }
].map((rad, i) => ({
  MalTilleggsvaktID: `MTV${String(i + 1).padStart(3, "0")}`,
  MalID: MAL_GUDSTJENESTE_ID,
  RolleID: rad.RolleID,
  Antall: rad.Antall,
  Aktiv: true,
  OpprettetDato: MAL_DATO,
  SistEndret: MAL_DATO
}));

// src/services/innlogging.ts
function erMagiskLenkeToken(verdi) {
  return /^mk_[0-9a-z]+$/i.test(String(verdi || "").trim());
}

// src/services/tilgang.ts
function finnPersonMedMagiskToken(db, token) {
  if (!token || !db?.personer) return void 0;
  const clean = token.trim();
  if (!erMagiskLenkeToken(clean)) return void 0;
  return db.personer.find((p) => String(p.SikkerhetsToken || "").trim() === clean);
}

// src/services/dato.ts
function tilIsoDato(dato) {
  const t = String(dato || "").trim();
  if (!t) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const compact = /^(\d{4})(\d{2})(\d{2})(?:$|T)/.exec(t);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const nordisk = /^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/.exec(t);
  if (nordisk) {
    let year = parseInt(nordisk[3], 10);
    if (year < 100) year += 2e3;
    return `${year}-${String(nordisk[2]).padStart(2, "0")}-${String(nordisk[1]).padStart(2, "0")}`;
  }
  return t;
}

// src/services/bemanning.ts
function erHendelseRad(row, gudstjenesteId, arrangementId) {
  if (arrangementId) return row.ArrangementID === arrangementId;
  return row.GudstjenesteID === gudstjenesteId && !row.ArrangementID;
}

// src/services/program.ts
function parseKlokkeMinutter(tid) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(tid || "").trim());
  if (!m) return 11 * 60;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}
function formatKlokkeMinutter(min) {
  const wrapped = (min % (24 * 60) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const mm = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
function beregnProgramtider(aktiviteter, startTid) {
  const sorted = [...aktiviteter].sort((a, b) => (a.Rekkefolge ?? 0) - (b.Rekkefolge ?? 0));
  let prefix = 0;
  for (const a of sorted) {
    if (!a.ForStart) break;
    prefix += Math.max(0, Number(a.VarighetMin) || 0);
  }
  let cursor = parseKlokkeMinutter(startTid) - prefix;
  return sorted.map((a) => {
    const dur = Math.max(0, Number(a.VarighetMin) || 0);
    const start = formatKlokkeMinutter(cursor);
    const slutt = formatKlokkeMinutter(cursor + dur);
    cursor += dur;
    return { ...a, start, slutt };
  });
}
function programForGudstjeneste(db, gudstjenesteId, arrangementId) {
  return (db.programaktiviteter || []).filter((p) => erHendelseRad(p, gudstjenesteId, arrangementId)).sort((a, b) => a.Rekkefolge - b.Rekkefolge);
}

// src/services/kalender.ts
var GUDSTJENESTE_STANDARD_MIN = 90;
var ARRANGEMENT_STANDARD_MIN = 60;
function personErIGruppe(db, personId, gruppeId) {
  const gruppe = (db.grupper || []).find((g) => g.GruppeID === gruppeId);
  if (gruppe && (gruppe.GruppelederID === personId || gruppe.NestlederID === personId)) return true;
  return (db.gruppemedlemmer || []).some(
    (gm) => gm.Aktiv !== false && gm.PersonID === personId && gm.GruppeID === gruppeId
  );
}
function arrangementSynligForPerson(db, personId, arrangement) {
  if (arrangement.Aktiv === false) return false;
  const gruppeId = String(arrangement.GruppeID || "").trim();
  if (!gruppeId) return true;
  return personErIGruppe(db, personId, gruppeId);
}
function arrangementMedIIcal(db, personId, arrangement) {
  if (arrangement.Aktiv === false) return false;
  if (String(arrangement.EksternKalenderID || "").trim()) return true;
  return arrangementSynligForPerson(db, personId, arrangement);
}
function kalenderHendelserForPerson(db, personId) {
  const guds = (db.gudstjenester || []).map((g) => ({
    kind: "gudstjeneste",
    id: g.GudstjenesteID,
    dato: g.Dato,
    tid: g.Tid || "11:00",
    tittel: g.Tema || "Gudstjeneste",
    sted: g.Sted || ""
  }));
  const ar = (db.arrangementer || []).filter((a) => arrangementMedIIcal(db, personId, a)).map((a) => ({
    kind: "arrangement",
    id: a.ArrangementID,
    dato: a.Dato,
    tid: a.Tid || "12:00",
    tittel: a.Tittel,
    sted: a.Sted || "",
    tagger: a.Tagger?.length ? a.Tagger : void 0
  }));
  return [...guds, ...ar].sort((a, b) => a.dato.localeCompare(b.dato) || a.tid.localeCompare(b.tid));
}
function hendelseSluttTid(db, h) {
  const start = h.tid || (h.kind === "gudstjeneste" ? "11:00" : "12:00");
  const linjer = h.kind === "gudstjeneste" ? programForGudstjeneste(db, h.id) : programForGudstjeneste(db, "", h.id);
  if (linjer.length > 0) {
    const tider = beregnProgramtider(linjer, start);
    return tider[tider.length - 1].slutt;
  }
  const min = h.kind === "gudstjeneste" ? GUDSTJENESTE_STANDARD_MIN : ARRANGEMENT_STANDARD_MIN;
  return formatKlokkeMinutter(parseKlokkeMinutter(start) + min);
}
function icsEscape(tekst) {
  return String(tekst || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
function normalizeIcsDato(dato) {
  const iso = tilIsoDato(dato).replace(/-/g, "");
  return /^\d{8}$/.test(iso) ? iso : "";
}
function icsDatoTid(dato, tid) {
  const d = normalizeIcsDato(dato);
  if (!d) return "";
  const m = /^(\d{1,2})[:.](\d{2})/.exec(String(tid || "").trim());
  const hh = m ? String(m[1]).padStart(2, "0") : "11";
  const mm = m ? m[2] : "00";
  return `${d}T${hh}${mm}00`;
}
function icsStamp() {
  return (/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
var ICS_VTIMEZONE_OSLO = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Oslo",
  "X-LIC-LOCATION:Europe/Oslo",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE"
];
function byggPersonIcs(db, personId) {
  const hendelser = kalenderHendelserForPerson(db, personId);
  const linjer = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Menighetsplan//NO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Menighetsplan",
    "X-WR-TIMEZONE:Europe/Oslo",
    ...ICS_VTIMEZONE_OSLO
  ];
  const stamp = icsStamp();
  for (const h of hendelser) {
    const start = icsDatoTid(h.dato, h.tid);
    const slutt = icsDatoTid(h.dato, hendelseSluttTid(db, h));
    if (!start || !slutt) continue;
    const uid = h.kind === "gudstjeneste" ? `gudstjeneste-${h.id}@menighetsplan` : `arrangement-${h.id}@menighetsplan`;
    linjer.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Europe/Oslo:${start}`,
      `DTEND;TZID=Europe/Oslo:${slutt}`,
      `SUMMARY:${icsEscape(h.tittel)}`,
      h.sted ? `LOCATION:${icsEscape(h.sted)}` : "",
      "END:VEVENT"
    );
  }
  linjer.push("END:VCALENDAR");
  return linjer.filter((l) => l !== "").join("\r\n") + "\r\n";
}

// server/dbCore.ts
function tomPayload(payload) {
  if (!payload || typeof payload !== "object") return true;
  const o = payload;
  return !Array.isArray(o.personer) || o.personer.length === 0;
}
function somState(payload) {
  return payload && typeof payload === "object" ? payload : {};
}
async function hentSupabaseState(env) {
  if (!env.supabaseUrl || !env.supabaseKey) return null;
  try {
    const { payload } = await supabaseHent(env);
    const state = somState(payload);
    if (tomPayload(state)) return null;
    return state;
  } catch {
    return null;
  }
}
async function supabaseHent(env) {
  const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/app_state?id=eq.1&select=payload,updated_at`;
  const res = await fetch(url, {
    headers: {
      apikey: env.supabaseKey,
      Authorization: `Bearer ${env.supabaseKey}`
    }
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase-lesing feilet (${res.status}): ${t.slice(0, 200)}`);
  }
  const rader = await res.json();
  const rad = rader[0];
  if (!rad) return { payload: {} };
  return { payload: rad.payload ?? {}, updated_at: rad.updated_at };
}

// server/minIcal.ts
var GAS_URL = process.env.APPS_SCRIPT_URL || process.env.VITE_APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbznLoq62orP53izSEA0wnA7VdQHiNWpP3upTo2nd1owcL3LDZp13gK8LxrAdsjxWwt7vw/exec";
var config = { maxDuration: 60 };
var TOM_ICS = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Menighetsplan//NO\r\nCALSCALE:GREGORIAN\r\nX-WR-CALNAME:Menighetsplan\r\nEND:VCALENDAR\r\n";
function parseMinIcalToken(req) {
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
async function byggIcsForToken(token, fetchFn = fetch) {
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
async function handler(req, res) {
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  TOM_ICS,
  byggIcsForToken,
  config,
  parseMinIcalToken
});
module.exports = handler; module.exports.config = config;
