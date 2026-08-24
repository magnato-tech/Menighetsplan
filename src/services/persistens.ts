import { Gruppe } from "../types/database";
import type { DatabaseState } from "../types/database";
import type { SvarStatus } from "../types/database";
import {
  initialGruppetyper,
  initialPersoner,
  initialGrupper,
  initialGruppemedlemmer,
  initialRoller,
  initialPersonroller,
  initialRollebeskrivelser,
  initialGudstjenester,
  initialTjenestebehov,
  initialTildelinger,
  initialSvar,
  initialPersonerImport,
  initialGudstjenesterImport,
  initialRollebeskrivelseImport,
  initialMalaktiviteter,
} from "../data/initialData";
import { hentApiIdentitet, lagreAdminSesjonPersonId } from "./innlogging";
import { sikreSikkerhetsTokens, rensLastetPersondata } from "./tilgang";
import { synkGruppeledergruppe } from "./grupper";

const MOCK_STORAGE_KEY = "gudstjenesteplanlegger_db_v2_mock";
const REMOTE_CACHE_KEY = "gudstjenesteplanlegger_db_v2_remote";
const DEV_SOURCE_KEY = "gudstjenesteplanlegger_dev_data_source";
const SCRIPT_URL_STORAGE_KEY = "gudstjenesteplanlegger_apps_script_url";

let sisteLastetPersonId: string | null = null;

export function hentSisteLastetPersonId(): string | null {
  return sisteLastetPersonId;
}

export const DEFAULT_REMOTE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbznLoq62orP53izSEA0wnA7VdQHiNWpP3upTo2nd1owcL3LDZp13gK8LxrAdsjxWwt7vw/exec";

/** Timeout mot Google Apps Script (dev+remote og produksjon). */
export const REMOTE_FETCH_TIMEOUT_MS = 45_000;

export type DevDataSource = "mock" | "remote";

let sessionMockOverride = false;
let devDataSource: DevDataSource | null = null;

export function getDevDataSource(): DevDataSource {
  if (import.meta.env?.PROD) return "remote";
  if (devDataSource) return devDataSource;
  try {
    const saved = localStorage.getItem(DEV_SOURCE_KEY);
    if (saved === "mock" || saved === "remote") {
      devDataSource = saved;
      return saved;
    }
  } catch {
    // Ignore
  }
  devDataSource = import.meta.env?.VITE_USE_REMOTE_DATA === "true" ? "remote" : "mock";
  return devDataSource;
}

export function setDevDataSource(source: DevDataSource): void {
  if (import.meta.env?.PROD) return;
  devDataSource = source;
  sessionMockOverride = false;
  try {
    localStorage.setItem(DEV_SOURCE_KEY, source);
  } catch (e) {
    console.error("Kunne ikke lagre datakilde:", e);
  }
}

function currentLocalStorageKey(): string {
  return shouldWriteToRemote() ? REMOTE_CACHE_KEY : MOCK_STORAGE_KEY;
}

function persistLocalState(state: DatabaseState): void {
  try {
    localStorage.setItem(currentLocalStorageKey(), JSON.stringify(state));
  } catch (e) {
    console.warn("Kunne ikke lagre til localStorage cache:", e);
  }
}

/**
 * Produksjon bruker alltid Google Sheets.
 * Utvikling: admin-valget (localStorage), ellers mock som standard.
 */
export function useRemoteData(): boolean {
  if (import.meta.env?.PROD) return true;
  return getDevDataSource() === "remote";
}

/** Dev-only: etter feilet Sheets-kall kan utvikler velge mock for denne økten. */
export function enableSessionMockOverride(): void {
  sessionMockOverride = true;
}

export function clearSessionMockOverride(): void {
  sessionMockOverride = false;
}

export function isSessionMockOverride(): boolean {
  return sessionMockOverride;
}

/** True når lagring/opplasting mot arket er tillatt. Mock og session-override skriver aldri til Sheets. */
export function shouldWriteToRemote(): boolean {
  return useRemoteData() && !sessionMockOverride;
}

export function getCustomScriptUrl(): string {
  try {
    const saved = localStorage.getItem(SCRIPT_URL_STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim();
    }
  } catch (e) {
    // Ignore localStorage errors
  }
  return ((import.meta.env?.VITE_APPS_SCRIPT_URL as string | undefined) || DEFAULT_REMOTE_SCRIPT_URL).trim();
}

export function saveCustomScriptUrl(url: string): void {
  try {
    if (url && url.trim()) {
      localStorage.setItem(SCRIPT_URL_STORAGE_KEY, url.trim());
    } else {
      localStorage.removeItem(SCRIPT_URL_STORAGE_KEY);
    }
  } catch (e) {
    console.error("Kunne ikke lagre Apps Script URL:", e);
  }
}

export function getApiBase(): string {
  const custom = getCustomScriptUrl();
  if (import.meta.env?.DEV) {
    // I dev miljø hvis det er default URL bruker vi proxyen
    if (custom === DEFAULT_REMOTE_SCRIPT_URL) {
      return "/gas-api";
    }
  }
  return custom.replace(/\/$/, "");
}


function hentSvarStatusLokalt(db: DatabaseState, tildelingId: string): SvarStatus {
  return db.svar.find((s) => s.TildelingID === tildelingId)?.Svar || "Venter";
}

/** Fjern feil kirkenevn. Vis Bedehuset i stedet for gammel «Hovedsalen». */
export function rensSted(sted: string | undefined | null): string {
  return String(sted || "")
    .replace(/\s*,\s*Sentrumskirken\s*/gi, "")
    .replace(/\bSentrumskirken\b/gi, "")
    .replace(/\bHovedsalen\b/gi, "Bedehuset")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .trim();
}

function emptyState(): DatabaseState {
  return {
    gruppetyper: [],
    personer: [],
    grupper: [],
    gruppemedlemmer: [],
    roller: [],
    personroller: [],
    rollebeskrivelser: [],
    gudstjenester: [],
    tjenestebehov: [],
    tildelinger: [],
    svar: [],
    malaktiviteter: [],
    programaktiviteter: [],
    programinstanser: [],
    personerImport: [],
    gudstjenesterImport: [],
    rollebeskrivelseImport: [],
  };
}

function normalizeState(parsed: Partial<DatabaseState> | null | undefined): DatabaseState {
  const base = emptyState();
  if (!parsed) return base;
  const rawPersoner = Array.isArray(parsed.personer) ? parsed.personer : base.personer;
  return {
    gruppetyper: Array.isArray(parsed.gruppetyper) ? parsed.gruppetyper : base.gruppetyper,
    personer: sikreSikkerhetsTokens(rawPersoner),
    grupper: Array.isArray(parsed.grupper) ? parsed.grupper : base.grupper,
    gruppemedlemmer: Array.isArray(parsed.gruppemedlemmer) ? parsed.gruppemedlemmer : base.gruppemedlemmer,
    roller: Array.isArray(parsed.roller) ? parsed.roller : base.roller,
    personroller: Array.isArray(parsed.personroller) ? parsed.personroller : base.personroller,
    rollebeskrivelser: Array.isArray(parsed.rollebeskrivelser) ? parsed.rollebeskrivelser : base.rollebeskrivelser,
    gudstjenester: Array.isArray(parsed.gudstjenester) ? parsed.gudstjenester : base.gudstjenester,
    tjenestebehov: Array.isArray(parsed.tjenestebehov) ? parsed.tjenestebehov : base.tjenestebehov,
    tildelinger: Array.isArray(parsed.tildelinger) ? parsed.tildelinger : base.tildelinger,
    svar: Array.isArray(parsed.svar) ? parsed.svar : base.svar,
    malaktiviteter: Array.isArray(parsed.malaktiviteter) ? parsed.malaktiviteter : base.malaktiviteter,
    programaktiviteter: Array.isArray(parsed.programaktiviteter)
      ? parsed.programaktiviteter
      : base.programaktiviteter,
    programinstanser: Array.isArray(parsed.programinstanser)
      ? parsed.programinstanser
      : base.programinstanser,
    personerImport: Array.isArray(parsed.personerImport) ? parsed.personerImport : base.personerImport,
    gudstjenesterImport: Array.isArray(parsed.gudstjenesterImport) ? parsed.gudstjenesterImport : base.gudstjenesterImport,
    rollebeskrivelseImport: Array.isArray(parsed.rollebeskrivelseImport)
      ? parsed.rollebeskrivelseImport
      : base.rollebeskrivelseImport,
  };
}

function gruppenavnNokkel(navn: string): string {
  return String(navn || "").trim().toLowerCase();
}

function finnRiggGruppe(grupper: Gruppe[]): Gruppe | undefined {
  const aktive = grupper.filter((g) => g.Aktiv !== false);
  const n = (g: Gruppe) => gruppenavnNokkel(g.Gruppenavn);
  return (
    aktive.find((g) => n(g) === "rigg") ||
    aktive.find((g) => n(g) === "rigging") ||
    aktive.find((g) => n(g).startsWith("rigg")) ||
    aktive.find(
      (g) =>
        n(g).includes("rigg") &&
        !n(g).includes("møtevert") &&
        !n(g).includes("motevert")
    ) ||
    aktive.find((g) => n(g).includes("teknikk")) ||
    aktive.find((g) => n(g).includes("rigg"))
  );
}

const LYD_BILDE_ROLLER = new Set(["lyd", "bilde", "lys"]);

/** Lyd og Bilde hører til Rigg, ikke Lovsang. */
function korrigerLydBildeTilRigg(state: DatabaseState): {
  state: DatabaseState;
  endret: boolean;
} {
  const riggingRolle = state.roller.find((r) => {
    const n = gruppenavnNokkel(r.Rollenavn);
    return n === "rigg" || n === "rigging";
  });
  const rigg =
    state.grupper.find((g) => g.GruppeID === riggingRolle?.GruppeID) ||
    finnRiggGruppe(state.grupper);
  if (!rigg) return { state, endret: false };
  let endret = false;
  const now = new Date().toISOString().split("T")[0];
  const roller = state.roller.map((r) => {
    const navn = gruppenavnNokkel(r.Rollenavn);
    if (!LYD_BILDE_ROLLER.has(navn) || r.GruppeID === rigg.GruppeID) return r;
    endret = true;
    return { ...r, GruppeID: rigg.GruppeID, SistEndret: now };
  });
  return { state: endret ? { ...state, roller } : state, endret };
}

function svarRang(db: DatabaseState, tildelingId: string): number {
  const svar = hentSvarStatusLokalt(db, tildelingId);
  if (svar === "Bekreftet") return 2;
  if (svar === "Venter") return 1;
  return 0;
}

/** Én person skal bare ha én tildeling per rolle per gudstjeneste. */
function fjernDuplikateTildelinger(state: DatabaseState): {
  state: DatabaseState;
  endret: boolean;
} {
  const behold = new Map<string, string>();
  const fjern = new Set<string>();
  for (const t of state.tildelinger) {
    const nokkel = `${t.GudstjenesteID}|${t.RolleID}|${t.PersonID}`;
    const forrige = behold.get(nokkel);
    if (!forrige) {
      behold.set(nokkel, t.TildelingID);
      continue;
    }
    if (svarRang(state, t.TildelingID) > svarRang(state, forrige)) {
      fjern.add(forrige);
      behold.set(nokkel, t.TildelingID);
    } else {
      fjern.add(t.TildelingID);
    }
  }
  if (fjern.size === 0) return { state, endret: false };
  return {
    state: {
      ...state,
      tildelinger: state.tildelinger.filter((t) => !fjern.has(t.TildelingID)),
      svar: state.svar.filter((s) => !fjern.has(s.TildelingID)),
    },
    endret: true,
  };
}

export function loadLocalDatabase(): DatabaseState {
  try {
    const saved = localStorage.getItem(MOCK_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (
        Array.isArray(parsed.personer) &&
        Array.isArray(parsed.grupper) &&
        Array.isArray(parsed.roller) &&
        Array.isArray(parsed.gudstjenester)
      ) {
        return applyLoadedState(normalizeState({
          gruppetyper: Array.isArray(parsed.gruppetyper) ? parsed.gruppetyper : initialGruppetyper,
          personer: parsed.personer,
          grupper: parsed.grupper,
          gruppemedlemmer: Array.isArray(parsed.gruppemedlemmer) ? parsed.gruppemedlemmer : initialGruppemedlemmer,
          roller: parsed.roller,
          personroller: Array.isArray(parsed.personroller) ? parsed.personroller : initialPersonroller,
          rollebeskrivelser: Array.isArray(parsed.rollebeskrivelser) ? parsed.rollebeskrivelser : initialRollebeskrivelser,
          gudstjenester: parsed.gudstjenester,
          tjenestebehov: Array.isArray(parsed.tjenestebehov) ? parsed.tjenestebehov : initialTjenestebehov,
          tildelinger: Array.isArray(parsed.tildelinger) ? parsed.tildelinger : initialTildelinger,
          svar: Array.isArray(parsed.svar) ? parsed.svar : initialSvar,
          malaktiviteter: Array.isArray(parsed.malaktiviteter)
            ? parsed.malaktiviteter
            : initialMalaktiviteter,
          programaktiviteter: Array.isArray(parsed.programaktiviteter) ? parsed.programaktiviteter : [],
          programinstanser: Array.isArray(parsed.programinstanser) ? parsed.programinstanser : [],
          personerImport: Array.isArray(parsed.personerImport) ? parsed.personerImport : initialPersonerImport,
          gudstjenesterImport: Array.isArray(parsed.gudstjenesterImport) ? parsed.gudstjenesterImport : initialGudstjenesterImport,
          rollebeskrivelseImport: Array.isArray(parsed.rollebeskrivelseImport)
            ? parsed.rollebeskrivelseImport
            : initialRollebeskrivelseImport,
        }));
      }
    }
  } catch (e) {
    console.warn("Kunne ikke laste lagret database, bruker initielle data:", e);
  }

  return applyLoadedState({
    gruppetyper: initialGruppetyper,
    personer: initialPersoner,
    grupper: initialGrupper,
    gruppemedlemmer: initialGruppemedlemmer,
    roller: initialRoller,
    personroller: initialPersonroller,
    rollebeskrivelser: initialRollebeskrivelser,
    gudstjenester: initialGudstjenester,
    tjenestebehov: initialTjenestebehov,
    tildelinger: initialTildelinger,
    svar: initialSvar,
    malaktiviteter: initialMalaktiviteter,
    programaktiviteter: [],
    programinstanser: [],
    personerImport: initialPersonerImport,
    gudstjenesterImport: initialGudstjenesterImport,
    rollebeskrivelseImport: initialRollebeskrivelseImport,
  });
}

function requireRemoteAuth(): { token?: string; googleCredential?: string } {
  const ident = hentApiIdentitet();
  if (!ident.token && !ident.googleCredential) {
    throw new Error(
      "Ikke innlogget. Åpne den personlige lenken, eller logg inn med Google som administrator."
    );
  }
  return ident;
}

async function fetchJson(url: string, init?: RequestInit): Promise<string> {
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (init?.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    try {
      const response = await fetch(url, init);
      const text = await response.text();
      if (text.trim()) return text;
      lastError = "Tomt svar fra Google Sheets.";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        throw e;
      }
      lastError = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
  throw new Error(
    lastError || "Kunne ikke nå Google Sheets. Last siden på nytt, eller start npm run dev på nytt."
  );
}

function applyLoadedState(state: DatabaseState): DatabaseState {
  const personer = sikreSikkerhetsTokens(state.personer);
  let endret = personer.some((p, i) => p.SikkerhetsToken !== state.personer[i]?.SikkerhetsToken);
  let fixed: DatabaseState = {
    ...state,
    personer,
    gudstjenester: (state.gudstjenester || []).map((g) => {
      const Sted = rensSted(g.Sted);
      return Sted === g.Sted ? g : { ...g, Sted };
    }),
  };
  const lydBilde = korrigerLydBildeTilRigg(fixed);
  fixed = lydBilde.state;
  if (lydBilde.endret) endret = true;
  const duplikat = fjernDuplikateTildelinger(fixed);
  fixed = duplikat.state;
  if (duplikat.endret) endret = true;

  // Finn Astrid / Astri i persondatabasen
  const astrid = fixed.personer.find(
    (p) =>
      p.PersonID === "P011" ||
      p.Fornavn.toLowerCase().startsWith("astr") ||
      p.Navn.toLowerCase().startsWith("astr")
  );

  if (astrid) {
    // Sørg for at Forbønn-gruppen (G007) har Astrid som GruppelederID
    const forbonnGruppe = fixed.grupper.find(
      (g) => g.GruppeID === "G007" || g.Gruppenavn.toLowerCase().includes("forbønn")
    );
    if (forbonnGruppe && forbonnGruppe.GruppelederID !== astrid.PersonID) {
      fixed = {
        ...fixed,
        grupper: fixed.grupper.map((g) =>
          g.GruppeID === forbonnGruppe.GruppeID ? { ...g, GruppelederID: astrid.PersonID } : g
        ),
      };
      endret = true;
    }

    // Sørg for at Astrid har Leder-rolle i gruppemedlemmer for Forbønn
    if (forbonnGruppe) {
      const eksisterendeMedlem = (fixed.gruppemedlemmer || []).find(
        (gm) => gm.GruppeID === forbonnGruppe.GruppeID && gm.PersonID === astrid.PersonID
      );
      if (!eksisterendeMedlem) {
        fixed = {
          ...fixed,
          gruppemedlemmer: [
            ...(fixed.gruppemedlemmer || []),
            {
              GruppeMedlemID: `GM_AUTO_${Date.now()}`,
              GruppeID: forbonnGruppe.GruppeID,
              PersonID: astrid.PersonID,
              Medlemsrolle: "Leder",
              Aktiv: true,
              OpprettetDato: "2026-01-10",
              SistEndret: "2026-01-10",
            },
          ],
        };
        endret = true;
      } else if (eksisterendeMedlem.Medlemsrolle !== "Leder") {
        fixed = {
          ...fixed,
          gruppemedlemmer: fixed.gruppemedlemmer.map((gm) =>
            gm.GruppeMedlemID === eksisterendeMedlem.GruppeMedlemID
              ? { ...gm, Medlemsrolle: "Leder" }
              : gm
          ),
        };
        endret = true;
      }
    }
  }

  // Sørg for at alle gruppeledere i fixed.grupper også er registrert som Leder i gruppemedlemmer
  for (const g of fixed.grupper || []) {
    if (g.Aktiv && g.GruppelederID) {
      const gm = (fixed.gruppemedlemmer || []).find(
        (m) => m.GruppeID === g.GruppeID && m.PersonID === g.GruppelederID
      );
      if (!gm) {
        fixed = {
          ...fixed,
          gruppemedlemmer: [
            ...(fixed.gruppemedlemmer || []),
            {
              GruppeMedlemID: `GM_AUTO_${g.GruppeID}_${g.GruppelederID}`,
              GruppeID: g.GruppeID,
              PersonID: g.GruppelederID,
              Medlemsrolle: "Leder",
              Aktiv: true,
              OpprettetDato: "2026-01-10",
              SistEndret: "2026-01-10",
            },
          ],
        };
        endret = true;
      }
    }
  }

  const synket = synkGruppeledergruppe(fixed);
  if (synket !== fixed) {
    fixed = synket;
    endret = true;
  }

  if (endret) {
    try {
      persistLocalState(fixed);
    } catch {
      // Ignorer lagringsfeil
    }
  }
  return fixed;
}

export async function loadDatabase(): Promise<DatabaseState> {
  if (!useRemoteData() || sessionMockOverride) {
    return loadLocalDatabase();
  }

  const base = getApiBase();
  if (!base) {
    throw new Error("Mangler Google Apps Script URL. Sett VITE_APPS_SCRIPT_URL.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS);
  try {
    const text = await fetchJson(base, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "load", ...requireRemoteAuth() }),
      signal: controller.signal,
    });
    const payload = JSON.parse(text);
    if (payload?.ok && payload.data) {
      const state = rensLastetPersondata(applyLoadedState(normalizeState(payload.data)));
      if (payload.personId) {
        sisteLastetPersonId = String(payload.personId);
        lagreAdminSesjonPersonId(sisteLastetPersonId);
      }
      persistLocalState(state);
      return state;
    }
    throw new Error(payload?.error || "Ukjent svar fra Google Sheets.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const aborted = e instanceof DOMException && e.name === "AbortError";
    if (aborted) {
      throw new Error(
        `Tidsavbrudd mot Google Sheets etter ${REMOTE_FETCH_TIMEOUT_MS / 1000} sekunder. Prøv igjen.`
      );
    }
    throw new Error(msg || "Kunne ikke nå Google Sheets.");
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Tvinger en full oppdatering/henting fra Google Sheets (Apps Script Web App URL)
 */
export async function forceSyncFromGoogleSheets(customUrl?: string): Promise<{ success: boolean; data?: DatabaseState; error?: string }> {
  if (!useRemoteData() || sessionMockOverride) {
    return {
      success: false,
      error: sessionMockOverride
        ? "Økten bruker mock-data. Last siden på nytt og hent fra Google Sheets."
        : "Mock-modus er aktiv. Velg «Ekte data» under Admin → Innstillinger.",
    };
  }

  let targetUrl = (customUrl || getCustomScriptUrl()).trim();
  if (!targetUrl) {
    return { success: false, error: "Ingen Google Apps Script URL er oppgitt." };
  }

  let fetchUrl = targetUrl.replace(/\/$/, "");
  if (import.meta.env.DEV && targetUrl === DEFAULT_REMOTE_SCRIPT_URL) {
    fetchUrl = "/gas-api";
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS);
    const text = await fetchJson(fetchUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "load", ...requireRemoteAuth() }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const payload = JSON.parse(text);
    if (payload?.ok && payload.data) {
      const normalized = rensLastetPersondata(applyLoadedState(normalizeState(payload.data)));
      // Lagre til lokal database slik at dataene sitter fast
      saveCustomScriptUrl(targetUrl);
      persistLocalState(normalized);
      return { success: true, data: normalized };
    } else {
      return { success: false, error: payload?.error || "Ukjent format fra Google Apps Script." };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Tilkoblingsfeil mot Google Sheets: ${msg}` };
  }
}

/**
 * Laster opp gjeldende databasemodell direkte til Google Sheets
 */
export async function uploadToGoogleSheets(state: DatabaseState, customUrl?: string): Promise<{ success: boolean; error?: string }> {
  if (!shouldWriteToRemote()) {
    return {
      success: false,
      error: "Mock-data lastes ikke opp til Google Sheets. Velg «Ekte data» først.",
    };
  }

  let targetUrl = (customUrl || getCustomScriptUrl()).trim();
  if (!targetUrl) {
    return { success: false, error: "Ingen Google Apps Script URL er oppgitt." };
  }

  let postUrl = targetUrl.replace(/\/$/, "");
  if (import.meta.env.DEV && targetUrl === DEFAULT_REMOTE_SCRIPT_URL) {
    postUrl = "/gas-api";
  }

  try {
    const response = await fetch(postUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "save", data: state, ...requireRemoteAuth() }),
    });
    const payload = await response.json().catch(() => null);
    if (payload?.ok) {
      return { success: true };
    } else {
      return { success: false, error: payload?.error || "Google Sheets svarte ikke med OK." };
    }
    } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Engangsimport: overskriv master fra fanen Gudstjenester_import. */
export async function overskrivFraGudstjenesterImport(): Promise<{
  success: boolean;
  report?: Record<string, unknown>;
  error?: string;
}> {
  if (!shouldWriteToRemote()) {
    return {
      success: false,
      error: "Mock-modus skriver ikke til arket. Velg «Ekte data» først.",
    };
  }
  const base = getApiBase();
  if (!base) {
    return { success: false, error: "Mangler Apps Script-URL." };
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "migrateImport",
        overwrite: true,
        dryRun: false,
        ...requireRemoteAuth(),
      }),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!text.trim()) {
      return { success: false, error: "Tomt svar fra Google Sheets." };
    }
    const payload = JSON.parse(text);
    if (payload?.ok) {
      return { success: true, report: payload.report };
    }
    return { success: false, error: payload?.error || "Importen ble avvist." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof DOMException && e.name === "AbortError") {
      return { success: false, error: "Tidsavbrudd under import (90 s). Prøv igjen." };
    }
    return { success: false, error: msg };
  } finally {
    clearTimeout(timeoutId);
  }
}

let remoteSaveInFlight = false;
let pendingRemoteState: DatabaseState | null = null;
let remoteSaveIdleWaiters: Array<() => void> = [];

function notifyRemoteSaveIdle() {
  if (remoteSaveInFlight || pendingRemoteState) return;
  const waiters = remoteSaveIdleWaiters;
  remoteSaveIdleWaiters = [];
  waiters.forEach((w) => w());
}

/** localStorage always; Sheets POST queued (latest state, one in-flight). */
export function saveDatabase(state: DatabaseState): void {
  persistLocalState(state);

  if (!shouldWriteToRemote()) {
    return;
  }

  const base = getApiBase();
  if (!base) return;

  pendingRemoteState = state;
  void pumpRemoteSave();
}

async function pumpRemoteSave(): Promise<void> {
  if (remoteSaveInFlight) return;
  if (!pendingRemoteState) {
    notifyRemoteSaveIdle();
    return;
  }

  const base = getApiBase();
  if (!base) {
    pendingRemoteState = null;
    notifyRemoteSaveIdle();
    return;
  }

  let ident: { token?: string; googleCredential?: string };
  try {
    ident = requireRemoteAuth();
  } catch (e) {
    console.error("Kunne ikke lagre til Google Sheets:", e instanceof Error ? e.message : e);
    pendingRemoteState = null;
    notifyRemoteSaveIdle();
    return;
  }

  const state = pendingRemoteState;
  pendingRemoteState = null;
  remoteSaveInFlight = true;

  try {
    const response = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "save", data: state, ...ident }),
    });
    const payload = await response.json().catch(() => null);
    if (!payload?.ok) {
      console.error("Kunne ikke lagre til Google Sheets:", payload?.error || response.statusText);
    }
  } catch (e) {
    console.error("Kunne ikke lagre til Google Sheets:", e);
  } finally {
    remoteSaveInFlight = false;
    if (pendingRemoteState) {
      void pumpRemoteSave();
    } else {
      notifyRemoteSaveIdle();
    }
  }
}

/** Test-hjelp: vent til køen er tom. */
export function whenRemoteSaveIdle(): Promise<void> {
  if (!remoteSaveInFlight && !pendingRemoteState) return Promise.resolve();
  return new Promise((resolve) => {
    remoteSaveIdleWaiters.push(resolve);
  });
}

export function populateMockDatabase(): DatabaseState {
  const state = applyLoadedState({
    gruppetyper: initialGruppetyper,
    personer: initialPersoner,
    grupper: initialGrupper,
    gruppemedlemmer: initialGruppemedlemmer,
    roller: initialRoller,
    personroller: initialPersonroller,
    rollebeskrivelser: initialRollebeskrivelser,
    gudstjenester: initialGudstjenester,
    tjenestebehov: initialTjenestebehov,
    tildelinger: initialTildelinger,
    svar: initialSvar,
    malaktiviteter: initialMalaktiviteter,
    programaktiviteter: [],
    programinstanser: [],
    personerImport: initialPersonerImport,
    gudstjenesterImport: initialGudstjenesterImport,
    rollebeskrivelseImport: initialRollebeskrivelseImport,
  });
  try {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore
  }
  return state;
}

/** Bytt datakilde i utvikling. Mock leser/skriver aldri Google Sheets. */
export async function switchDevDataSource(source: DevDataSource): Promise<DatabaseState> {
  if (import.meta.env.PROD) {
    return loadDatabase();
  }
  setDevDataSource(source);
  if (source === "mock") {
    return populateMockDatabase();
  }
  return loadDatabase();
}

export async function resetDatabase(): Promise<DatabaseState> {
  if (!shouldWriteToRemote()) {
    try {
      localStorage.removeItem(MOCK_STORAGE_KEY);
    } catch {
      // Ignore
    }
    return populateMockDatabase();
  }
  return loadDatabase();
}
