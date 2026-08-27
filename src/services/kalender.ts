import { AppInnstillinger } from "../types/database";
import type { DatabaseState } from "../types/database";
import { beregnProgramtider, parseKlokkeMinutter, formatKlokkeMinutter, programForGudstjeneste } from "./program";

export const GUDSTJENESTE_STANDARD_MIN = 90;
export const ARRANGEMENT_STANDARD_MIN = 60;

export type KalenderFlate = "minSide" | "gruppeleder" | "ical";

export type KalenderHendelse = {
  kind: "gudstjeneste" | "arrangement";
  id: string;
  dato: string;
  tid: string;
  tittel: string;
  sted: string;
};

export function standardInnstillinger(): AppInnstillinger {
  return {
    visKalenderMinSide: false,
    visKalenderGruppeleder: false,
    visKalenderIcal: false,
    eksternIcalUrl: "",
  };
}

export function hentInnstillinger(db: Pick<DatabaseState, "innstillinger"> | null | undefined): AppInnstillinger {
  const i = db?.innstillinger;
  return {
    visKalenderMinSide: Boolean(i?.visKalenderMinSide),
    visKalenderGruppeleder: Boolean(i?.visKalenderGruppeleder),
    visKalenderIcal: Boolean(i?.visKalenderIcal),
    eksternIcalUrl: String(i?.eksternIcalUrl || "").trim(),
  };
}

export function visKalenderForPerson(
  db: DatabaseState,
  _personId: string,
  flate: KalenderFlate
): boolean {
  const i = hentInnstillinger(db);
  if (flate === "minSide") return i.visKalenderMinSide;
  if (flate === "gruppeleder") return i.visKalenderGruppeleder;
  return i.visKalenderIcal;
}

export function parseInnstillinger(raa: unknown): AppInnstillinger {
  const base = standardInnstillinger();
  if (!raa) return base;
  if (Array.isArray(raa)) {
    const kart = new Map<string, string>();
    for (const rad of raa) {
      const nøkkel = String((rad as { Nøkkel?: string })?.Nøkkel || "").trim();
      const verdi = String((rad as { Verdi?: string })?.Verdi ?? "").trim();
      if (nøkkel) kart.set(nøkkel, verdi);
    }
    return {
      visKalenderMinSide: kart.get("visKalenderMinSide")?.toLowerCase() === "true",
      visKalenderGruppeleder: kart.get("visKalenderGruppeleder")?.toLowerCase() === "true",
      visKalenderIcal: kart.get("visKalenderIcal")?.toLowerCase() === "true",
      eksternIcalUrl: String(kart.get("eksternIcalUrl") || "").trim(),
    };
  }
  if (typeof raa === "object") {
    const o = raa as Partial<AppInnstillinger>;
    return {
      visKalenderMinSide: Boolean(o.visKalenderMinSide),
      visKalenderGruppeleder: Boolean(o.visKalenderGruppeleder),
      visKalenderIcal: Boolean(o.visKalenderIcal),
      eksternIcalUrl: String(o.eksternIcalUrl || "").trim(),
    };
  }
  return base;
}

export function innstillingerTilRader(i: AppInnstillinger): { Nøkkel: string; Verdi: string }[] {
  return [
    { Nøkkel: "visKalenderMinSide", Verdi: i.visKalenderMinSide ? "true" : "false" },
    { Nøkkel: "visKalenderGruppeleder", Verdi: i.visKalenderGruppeleder ? "true" : "false" },
    { Nøkkel: "visKalenderIcal", Verdi: i.visKalenderIcal ? "true" : "false" },
    { Nøkkel: "eksternIcalUrl", Verdi: String(i.eksternIcalUrl || "").trim() },
  ];
}

/** Tom Innstillinger-fane skal ikke slette huker og iCal-lenke som ligger lokalt. */
export function innstillingerManglerILast(raa: unknown): boolean {
  if (raa == null) return true;
  if (Array.isArray(raa)) return raa.length === 0;
  return false;
}

export function flettManglendeInnstillinger<T extends { innstillinger?: unknown }>(
  ny: T,
  gammel: { innstillinger?: unknown } | null | undefined
): T {
  if (!gammel || !innstillingerManglerILast(ny.innstillinger)) return ny;
  if (innstillingerManglerILast(gammel.innstillinger)) return ny;
  return { ...ny, innstillinger: gammel.innstillinger as T["innstillinger"] };
}

function personErIGruppe(db: DatabaseState, personId: string, gruppeId: string): boolean {
  const gruppe = (db.grupper || []).find((g) => g.GruppeID === gruppeId);
  if (gruppe && (gruppe.GruppelederID === personId || gruppe.NestlederID === personId)) return true;
  return (db.gruppemedlemmer || []).some(
    (gm) => gm.Aktiv !== false && gm.PersonID === personId && gm.GruppeID === gruppeId
  );
}

export function arrangementSynligForPerson(
  db: DatabaseState,
  personId: string,
  arrangement: { Aktiv?: boolean; GruppeID?: string }
): boolean {
  if (arrangement.Aktiv === false) return false;
  const gruppeId = String(arrangement.GruppeID || "").trim();
  if (!gruppeId) return true;
  return personErIGruppe(db, personId, gruppeId);
}

export function kalenderHendelserForPerson(db: DatabaseState, personId: string): KalenderHendelse[] {
  const guds: KalenderHendelse[] = (db.gudstjenester || []).map((g) => ({
    kind: "gudstjeneste",
    id: g.GudstjenesteID,
    dato: g.Dato,
    tid: g.Tid || "11:00",
    tittel: g.Tema || "Gudstjeneste",
    sted: g.Sted || "",
  }));
  const ar: KalenderHendelse[] = (db.arrangementer || [])
    .filter((a) => arrangementSynligForPerson(db, personId, a))
    .map((a) => ({
      kind: "arrangement" as const,
      id: a.ArrangementID,
      dato: a.Dato,
      tid: a.Tid || "12:00",
      tittel: a.Tittel,
      sted: a.Sted || "",
    }));
  return [...guds, ...ar].sort((a, b) => a.dato.localeCompare(b.dato) || a.tid.localeCompare(b.tid));
}

export function hendelseSluttTid(db: DatabaseState, h: KalenderHendelse): string {
  const start = h.tid || (h.kind === "gudstjeneste" ? "11:00" : "12:00");
  const linjer =
    h.kind === "gudstjeneste"
      ? programForGudstjeneste(db, h.id)
      : programForGudstjeneste(db, "", h.id);
  if (linjer.length > 0) {
    const tider = beregnProgramtider(linjer, start);
    return tider[tider.length - 1].slutt;
  }
  const min = h.kind === "gudstjeneste" ? GUDSTJENESTE_STANDARD_MIN : ARRANGEMENT_STANDARD_MIN;
  return formatKlokkeMinutter(parseKlokkeMinutter(start) + min);
}

function icsEscape(tekst: string): string {
  return String(tekst || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function normalizeIcsDato(dato: string): string {
  const t = String(dato || "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return `${iso[1]}${iso[2]}${iso[3]}`;
  const nordisk = /^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/.exec(t);
  if (nordisk) {
    let year = parseInt(nordisk[3], 10);
    if (year < 100) year += 2000;
    return `${year}${String(nordisk[2]).padStart(2, "0")}${String(nordisk[1]).padStart(2, "0")}`;
  }
  const siffer = t.replace(/-/g, "");
  return /^\d{8}$/.test(siffer) ? siffer : "";
}

function icsDatoTid(dato: string, tid: string): string {
  const d = normalizeIcsDato(dato);
  if (!d) return "";
  const m = /^(\d{1,2})[:.](\d{2})/.exec(String(tid || "").trim());
  const hh = m ? String(m[1]).padStart(2, "0") : "11";
  const mm = m ? m[2] : "00";
  return `${d}T${hh}${mm}00`;
}

function icsStamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Google Kalender avviser TZID uten VTIMEZONE. */
const ICS_VTIMEZONE_OSLO = [
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
  "END:VTIMEZONE",
];

export function byggPersonIcs(db: DatabaseState, personId: string): string {
  const hendelser = kalenderHendelserForPerson(db, personId);
  const linjer = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Menighetsplan//NO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Menighetsplan",
    "X-WR-TIMEZONE:Europe/Oslo",
    ...ICS_VTIMEZONE_OSLO,
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

export function minIcalHttpsUrl(execUrl: string, token: string): string {
  const base = String(execUrl || "")
    .trim()
    .replace(/\/$/, "")
    .split("?")[0];
  const t = String(token || "").trim();
  if (!base || !t) return "";
  return `${base}?action=minIcal&t=${encodeURIComponent(t)}`;
}

/** Offentlig ICS uten Apps Script-omdirigering — samme type adresse som kirkens webcal. */
export const OFFENTLIG_APP_URL = "https://gudstjenesteplanlegger2-0.vercel.app";

export function minIcalOffentligUrl(token: string, origin = OFFENTLIG_APP_URL): string {
  const t = String(token || "").trim();
  const base = String(origin || "")
    .trim()
    .replace(/\/$/, "");
  if (!base || !t) return "";
  // Token i stien: Google Kalender dropper ofte query-parametre på webcal-abonnement.
  return `${base}/kalender/${encodeURIComponent(t)}.ics`;
}

export function minIcalWebcalUrl(httpsUrl: string): string {
  return String(httpsUrl || "").replace(/^https:/i, "webcal:").replace(/^http:/i, "webcal:");
}

/** Åpner Google Kalender med «legg til fra URL». cid må være webcal:// — https:// gir «sjekk nettadressen». */
export function googleKalenderAbonnerUrl(icsHttpsUrl: string): string {
  const ics = String(icsHttpsUrl || "").trim();
  if (!ics) return "";
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(minIcalWebcalUrl(ics))}`;
}

export function oppdaterInnstillinger(
  db: DatabaseState,
  patch: Partial<AppInnstillinger>
): DatabaseState {
  return {
    ...db,
    innstillinger: { ...hentInnstillinger(db), ...patch },
  };
}
