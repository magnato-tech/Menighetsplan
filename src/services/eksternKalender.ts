import type { DatabaseState, Kalenderoppgave } from "../types/database";
import { nesteNummerertId } from "./ids";
import { opprettArrangement } from "./arrangementer";

export const KIRKE_ICAL_KATEGORI_URL =
  "https://lillesandmisjonskirke.no/er/functions/calendar/shareplanneritems.aspx?categoryid=81";

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

function icalDatoTid(verdi: string): { dato: string; tid: string } {
  const v = String(verdi || "").trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/.exec(v);
  if (!m) return { dato: "", tid: "" };
  const dato = `${m[1]}-${m[2]}-${m[3]}`;
  const tid = m[4] ? `${m[4]}:${m[5]}` : "";
  return { dato, tid };
}

function feltVerdi(blokk: string, navn: string): string {
  const re = new RegExp(`^${navn}(?:;[^:]*)?:(.*)$`, "im");
  const m = re.exec(blokk);
  return m ? m[1].trim().replace(/\\n/g, "\n").replace(/\\,/g, ",") : "";
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
    const start = icalDatoTid(feltVerdi(blokk, "DTSTART"));
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

function icalHentUrlKandidater(execUrl = ""): string[] {
  const urls: string[] = [];
  if (import.meta.env?.DEV) {
    urls.push("/kirke-ical");
    urls.push("/gas-api?action=eksternIcalJson");
    urls.push("/gas-api?action=eksternIcal");
  }
  const base = String(execUrl || "")
    .trim()
    .replace(/\/$/, "")
    .split("?")[0];
  if (base && !base.startsWith("/")) {
    urls.push(`${base}?action=eksternIcalJson`);
    urls.push(icalAbonnementUrl(base));
  }
  return [...new Set(urls)];
}

async function hentIcalFraUrl(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Kunne ikke hente kalender (${res.status})`);
  }
  const ics = icsTekstFraSvar(await res.text());
  if (!ics.includes("BEGIN:VCALENDAR")) {
    throw new Error("Kalenderfeeden var ugyldig.");
  }
  return ics;
}

/** Dev: Vite-proxy, deretter GAS. Prod: GAS JSON. */
export async function hentEksternIcalTekst(execUrl = "", signal?: AbortSignal): Promise<string> {
  const urls = icalHentUrlKandidater(execUrl);
  let siste = "Kunne ikke hente kalenderen fra nettsiden.";
  for (const url of urls) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      return await hentIcalFraUrl(url, signal);
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) throw err;
      siste = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(siste);
}
