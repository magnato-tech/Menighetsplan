import type { DatabaseState, Kalenderoppgave } from "../types/database";
import { nesteNummerertId } from "./ids";
import { opprettArrangement } from "./arrangementer";

/** Standardfeed når innstillingen er tom (Lillesand misjonskirke). */
export const KIRKE_ICAL_KATEGORI_URL =
  "https://lillesandmisjonskirke.no/er/functions/calendar/shareplanneritems.aspx?categoryid=81";

export function gyldigIcalHttpUrl(url: string): string {
  const t = String(url || "")
    .trim()
    .replace(/^webcal:\/\//i, "https://");
  if (!/^https?:\/\//i.test(t)) return "";
  return t;
}

export function icalFeedUrl(innstiltUrl = ""): string {
  return gyldigIcalHttpUrl(innstiltUrl) || KIRKE_ICAL_KATEGORI_URL;
}

export const EKSTERN_ICAL_ACTIONS = ["eksternIcal", "eksternIcalJson"] as const;

/** I og l forveksles i UI; prod kan også sende annen casing. */
export function erKjentEksternIcalAction(action: string): boolean {
  const n = String(action || "").toLowerCase();
  return n === "eksternical" || n === "eksternicaljson" || n === "eksternlcal" || n === "eksternlcaljson";
}

export function synkFeilMedKilde(melding: string, execUrl: string): string {
  const base = String(execUrl || "")
    .trim()
    .replace(/\/$/, "")
    .split("?")[0];
  if (!base) return melding;
  const hale = base.replace(/^https:\/\/script\.google\.com\/macros\/s\//i, "s/");
  return `${melding} (${hale.slice(-24)})`;
}

export function icalAbonnementUrl(execUrl: string): string {
  const base = String(execUrl || "")
    .trim()
    .replace(/\/$/, "")
    .split("?")[0];
  return base ? `${base}?action=eksternIcal` : "";
}

function unfoldIcal(raw: string): string {
  return String(raw || "").replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

/**
 * eRedaktør merker DTSTART som VALUE=DATE men legger datetime i verdien.
 * RFC 5545 krever da bare YYYYMMDD, så Google Kalender dropper tiden.
 */
export function korrigerIcalHeldagsTilKlokkeslett(ics: string): string {
  const tekst = unfoldIcal(ics);
  return tekst.replace(
    /^(DT(?:START|END));VALUE=DATE:(\d{8}T\d{6}(?:Z)?)$/gm,
    (_m, felt, verdi) => `${felt}:${verdi}`
  );
}

function utcTilOslo(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number
): { dato: string; tid: string } {
  const utc = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  const deler = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(utc);
  const les = (type: string) => deler.find((p) => p.type === type)?.value || "";
  return {
    dato: `${les("year")}-${les("month")}-${les("day")}`,
    tid: `${les("hour")}:${les("minute")}`,
  };
}

function icalDatoTid(verdi: string, utc = false): { dato: string; tid: string } {
  const v = String(verdi || "").trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?$/i.exec(v);
  if (!m) return { dato: "", tid: "" };
  const somUtc = utc || Boolean(m[7]);
  if (m[4] && somUtc) {
    return utcTilOslo(
      Number(m[1]),
      Number(m[2]),
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6])
    );
  }
  const dato = `${m[1]}-${m[2]}-${m[3]}`;
  const tid = m[4] ? `${m[4]}:${m[5]}` : "";
  return { dato, tid };
}

function feltLinje(blokk: string, navn: string): { params: string; verdi: string } {
  const re = new RegExp(`^${navn}(;[^:]*)?:(.*)$`, "im");
  const treff = re.exec(blokk);
  if (!treff) return { params: "", verdi: "" };
  return {
    params: treff[1] || "",
    verdi: treff[2].trim().replace(/\\n/g, "\n").replace(/\\,/g, ","),
  };
}

function feltVerdi(blokk: string, navn: string): string {
  return feltLinje(blokk, navn).verdi;
}

export interface IcalHendelse {
  uid: string;
  dato: string;
  tid: string;
  sted: string;
  tittel: string;
  beskrivelse: string;
}

export function icalHendelser(ics: string): IcalHendelse[] {
  const tekst = korrigerIcalHeldagsTilKlokkeslett(unfoldIcal(ics));
  const blokker = tekst.split(/BEGIN:VEVENT/i).slice(1);
  const ut: IcalHendelse[] = [];
  for (const raa of blokker) {
    const blokk = raa.split(/END:VEVENT/i)[0] || "";
    const startFelt = feltLinje(blokk, "DTSTART");
    const startUtc = /TZID=UTC/i.test(startFelt.params);
    const start = icalDatoTid(startFelt.verdi, startUtc);
    if (!start.dato) continue;
    ut.push({
      uid: feltVerdi(blokk, "UID"),
      dato: start.dato,
      tid: start.tid || "00:00",
      sted: feltVerdi(blokk, "LOCATION"),
      tittel: feltVerdi(blokk, "SUMMARY") || "Uten tittel",
      beskrivelse: feltVerdi(blokk, "DESCRIPTION"),
    });
  }
  return ut;
}

function sammeKlokke(aDato: string, aTid: string, bDato: string, bTid: string): boolean {
  return aDato === bDato && String(aTid || "").trim() === String(bTid || "").trim();
}

function oppgaveMatcherHendelse(o: Kalenderoppgave, h: IcalHendelse): boolean {
  if (h.uid && o.EksternUID && o.EksternUID === h.uid) return true;
  return !h.uid && sammeKlokke(o.Dato, o.Tid, h.dato, h.tid) && o.Tittel === h.tittel;
}

function aktivArrangementForOppgave(db: DatabaseState, o: Kalenderoppgave): boolean {
  if (!o.ArrangementID) return false;
  const ar = (db.arrangementer || []).find((a) => a.ArrangementID === o.ArrangementID);
  return Boolean(ar && ar.Aktiv !== false);
}

export function icalHendelseFinnesIAppen(h: IcalHendelse, db: DatabaseState): boolean {
  if (h.uid) {
    if ((db.gudstjenester || []).some((g) => g.EksternKalenderID === h.uid)) return true;
    if ((db.arrangementer || []).some((a) => a.Aktiv !== false && a.EksternKalenderID === h.uid)) {
      return true;
    }
  }
  if ((db.gudstjenester || []).some((g) => sammeKlokke(g.Dato, g.Tid, h.dato, h.tid))) return true;
  if (
    (db.arrangementer || []).some(
      (a) => a.Aktiv !== false && sammeKlokke(a.Dato, a.Tid, h.dato, h.tid)
    )
  ) {
    return true;
  }
  return false;
}

export function synkKalenderoppgaver(
  db: DatabaseState,
  ics: string
): { db: DatabaseState; nye: number } {
  const hendelser = icalHendelser(ics);
  const oppgaver: Kalenderoppgave[] = [...(db.kalenderoppgaver || [])];
  const now = new Date().toISOString().split("T")[0];
  let nye = 0;
  for (const h of hendelser) {
    if (icalHendelseFinnesIAppen(h, db)) continue;
    const treff = oppgaver.filter((o) => oppgaveMatcherHendelse(o, h));
    if (treff.some((o) => o.Status === "Avvist")) continue;
    if (treff.some((o) => o.Status === "Åpen")) continue;
    if (treff.some((o) => o.Status === "Opprettet" && aktivArrangementForOppgave(db, o))) continue;

    const foreldrelos = treff.find((o) => o.Status === "Opprettet" && !aktivArrangementForOppgave(db, o));
    if (foreldrelos) {
      const idx = oppgaver.findIndex((o) => o.KalenderoppgaveID === foreldrelos.KalenderoppgaveID);
      if (idx >= 0) {
        oppgaver[idx] = {
          ...oppgaver[idx],
          Status: "Åpen",
          ArrangementID: undefined,
          SistEndret: now,
        };
        nye += 1;
      }
      continue;
    }

    oppgaver.push({
      KalenderoppgaveID: nesteNummerertId(oppgaver, "KalenderoppgaveID", "KO"),
      EksternUID: h.uid,
      Dato: h.dato,
      Tid: h.tid,
      Sted: h.sted,
      Tittel: h.tittel,
      Beskrivelse: h.beskrivelse,
      Status: "Åpen",
      OpprettetDato: now,
      SistEndret: now,
    });
    nye += 1;
  }
  return { db: { ...db, kalenderoppgaver: oppgaver }, nye };
}

export function avvisKalenderoppgave(db: DatabaseState, oppgaveId: string): DatabaseState {
  const now = new Date().toISOString().split("T")[0];
  return {
    ...db,
    kalenderoppgaver: (db.kalenderoppgaver || []).map((o) =>
      o.KalenderoppgaveID === oppgaveId ? { ...o, Status: "Avvist" as const, SistEndret: now } : o
    ),
  };
}

export function leggInnKalenderoppgave(
  db: DatabaseState,
  oppgaveId: string,
  opprettetAv?: string,
  malId?: string
): DatabaseState {
  const oppgave = (db.kalenderoppgaver || []).find((o) => o.KalenderoppgaveID === oppgaveId);
  if (!oppgave || oppgave.Status !== "Åpen") return db;
  const medAr = opprettArrangement(db, {
    tittel: oppgave.Tittel,
    dato: oppgave.Dato,
    tid: oppgave.Tid,
    sted: oppgave.Sted,
    beskrivelse: "",
    opprettetAv,
    eksternKalenderID: oppgave.EksternUID,
    malId,
  });
  const ny = (medAr.arrangementer || []).find(
    (a) => !db.arrangementer?.some((gammel) => gammel.ArrangementID === a.ArrangementID)
  );
  const now = new Date().toISOString().split("T")[0];
  return {
    ...medAr,
    kalenderoppgaver: (medAr.kalenderoppgaver || []).map((o) =>
      o.KalenderoppgaveID === oppgaveId
        ? {
            ...o,
            Status: "Opprettet" as const,
            ArrangementID: ny?.ArrangementID,
            SistEndret: now,
          }
        : o
    ),
  };
}

export function icsTekstFraSvar(raw: string): string {
  const trimmet = String(raw || "").trim();
  if (trimmet.startsWith("{")) {
    const parsed = JSON.parse(trimmet) as { ok?: boolean; ics?: string; error?: string };
    if (parsed.ics) return parsed.ics;
    throw new Error(parsed.error || "Kalendersvaret manglet ics.");
  }
  return String(raw || "");
}

export function icalHentUrlKandidater(
  execUrl = "",
  modus: "dev" | "prod" = import.meta.env?.DEV ? "dev" : "prod"
): string[] {
  const urls: string[] = [];
  const base = String(execUrl || "")
    .trim()
    .replace(/\/$/, "")
    .split("?")[0];
  if (base && !base.startsWith("/")) {
    urls.push(`${base}?action=eksternIcalJson`);
    urls.push(icalAbonnementUrl(base));
  }
  if (modus === "dev") {
    urls.push("/gas-api?action=eksternIcalJson");
    urls.push("/gas-api?action=eksternIcal");
    urls.push("/kirke-ical");
  }
  return [...new Set(urls)];
}

/** Custom URL i prod-localStorage kan peke på gammel /exec; fallback er den vi deployer. */
export function icalHentUrlKandidaterForSynk(
  execUrl: string,
  fallbackUrl = "",
  modus: "dev" | "prod" = import.meta.env?.DEV ? "dev" : "prod"
): string[] {
  const primaer = icalHentUrlKandidater(execUrl, modus);
  const fb = String(fallbackUrl || "")
    .trim()
    .replace(/\/$/, "")
    .split("?")[0];
  const exec = String(execUrl || "")
    .trim()
    .replace(/\/$/, "")
    .split("?")[0];
  if (!fb || fb === exec) return primaer;
  return [...new Set([...primaer, ...icalHentUrlKandidater(fb, modus)])];
}

export function icalGasPostInit(
  url: string,
  signal?: AbortSignal,
  icalUrl = ""
): { fetchUrl: string; init: RequestInit } {
  const action = new URL(url, "http://localhost").searchParams.get("action") || "";
  if (!erKjentEksternIcalAction(action)) {
    return { fetchUrl: url, init: { signal } };
  }
  const feed = gyldigIcalHttpUrl(icalUrl);
  return {
    fetchUrl: url.split("?")[0],
    init: {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "eksternIcalJson",
        ...(feed ? { icalUrl: feed } : {}),
      }),
      signal,
    },
  };
}

async function hentIcalFraUrl(url: string, signal?: AbortSignal, icalUrl = ""): Promise<string> {
  const { fetchUrl, init } = icalGasPostInit(url, signal, icalUrl);
  const res = await fetch(fetchUrl, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Kunne ikke hente kalender (${res.status})`);
  }
  const ics = icsTekstFraSvar(text);
  if (!ics.includes("BEGIN:VCALENDAR")) {
    throw new Error("Kalenderfeeden var ugyldig.");
  }
  return ics;
}

/** Dev: Vite-proxy (kun standardfeed), deretter GAS. Prod: GAS JSON. */
export async function hentEksternIcalTekst(
  execUrl = "",
  signal?: AbortSignal,
  fallbackUrl = "",
  innstiltIcalUrl = ""
): Promise<string> {
  const feed = icalFeedUrl(innstiltIcalUrl);
  let urls = icalHentUrlKandidaterForSynk(execUrl, fallbackUrl);
  if (feed !== KIRKE_ICAL_KATEGORI_URL) {
    urls = urls.filter((u) => u !== "/kirke-ical");
  }
  let siste = "Kunne ikke hente kalenderen fra nettsiden.";
  for (const url of urls) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      return await hentIcalFraUrl(url, signal, feed);
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) throw err;
      siste = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(siste);
}
