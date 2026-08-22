/**
 * Tjenestelag for datalagring, forretningslogikk og bemanningsberegning
 * i henhold til Gudstjenesteplanlegger 2.0 datamodellen.
 */

import {
  Person,
  Gruppetype,
  Gruppe,
  Gruppemedlem,
  Rolle,
  Personrolle,
  Rollebeskrivelse,
  Gudstjeneste,
  Tjenestebehov,
  Tildeling,
  Svar,
  SvarStatus,
  LedigOppgave,
  PersonerImport,
  GudstjenesterImport,
  RollebeskrivelseImport,
  MalAktivitet,
  ProgramAktivitet,
  Programinstans,
} from "../types/database";

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

const MOCK_STORAGE_KEY = "gudstjenesteplanlegger_db_v2_mock";
const REMOTE_CACHE_KEY = "gudstjenesteplanlegger_db_v2_remote";
const DEV_SOURCE_KEY = "gudstjenesteplanlegger_dev_data_source";
const SCRIPT_URL_STORAGE_KEY = "gudstjenesteplanlegger_apps_script_url";

export const DEFAULT_REMOTE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbznLoq62orP53izSEA0wnA7VdQHiNWpP3upTo2nd1owcL3LDZp13gK8LxrAdsjxWwt7vw/exec";

/** Timeout mot Google Apps Script (dev+remote og produksjon). */
export const REMOTE_FETCH_TIMEOUT_MS = 15_000;

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
  return ((import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined) || DEFAULT_REMOTE_SCRIPT_URL).trim();
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
  if (import.meta.env.DEV) {
    // I dev miljø hvis det er default URL bruker vi proxyen
    if (custom === DEFAULT_REMOTE_SCRIPT_URL) {
      return "/gas-api";
    }
  }
  return custom.replace(/\/$/, "");
}

export interface DatabaseState {
  gruppetyper: Gruppetype[];
  personer: Person[];
  grupper: Gruppe[];
  gruppemedlemmer: Gruppemedlem[];
  roller: Rolle[];
  personroller: Personrolle[];
  rollebeskrivelser: Rollebeskrivelse[];
  gudstjenester: Gudstjeneste[];
  tjenestebehov: Tjenestebehov[];
  tildelinger: Tildeling[];
  svar: Svar[];
  malaktiviteter: MalAktivitet[];
  programaktiviteter: ProgramAktivitet[];
  programinstanser: Programinstans[];
  personerImport: PersonerImport[];
  gudstjenesterImport: GudstjenesterImport[];
  rollebeskrivelseImport: RollebeskrivelseImport[];
}

/**
 * Genererer et ugjettelig, unikt og stabilt sikkerhetstoken per person.
 * Tokenet endres ikke fra gang til gang, slik at bokmerker og tilsendte SMS-er forblir gyldige.
 */
export function genererStatiskSikkerhetsToken(personId: string, navn: string): string {
  let hash1 = 0x811c9dc5;
  const salt = `LMK_SEC_${personId}_${navn || "frivillig"}_SALT2026`;
  for (let i = 0; i < salt.length; i++) {
    hash1 ^= salt.charCodeAt(i);
    hash1 = Math.imul(hash1, 0x01000193);
  }
  let hash2 = 0x5a17c2e3;
  for (let i = salt.length - 1; i >= 0; i--) {
    hash2 ^= salt.charCodeAt(i);
    hash2 = Math.imul(hash2, 0x01000193);
  }
  const part1 = (hash1 >>> 0).toString(36).padStart(7, "0");
  const part2 = (hash2 >>> 0).toString(36).padStart(7, "0");
  return `mk_${part1}${part2}`;
}

export function sikreSikkerhetsTokens(personer: Person[]): Person[] {
  if (!Array.isArray(personer)) return [];
  return personer.map((p) => {
    if (p.SikkerhetsToken && p.SikkerhetsToken.trim().length >= 6) {
      return p;
    }
    return {
      ...p,
      SikkerhetsToken: genererStatiskSikkerhetsToken(p.PersonID, p.Navn),
    };
  });
}

/**
 * Finner person i databasen via enten ugjettelig sikkerhetstoken eller personID
 */
export function finnPersonMedTokenEllerId(db: DatabaseState, tokenOrId: string): Person | undefined {
  if (!tokenOrId || !db?.personer) return undefined;
  const clean = tokenOrId.trim();
  // 1. Sjekk om det matcher en persons hemmelige / unike SikkerhetsToken
  const byToken = db.personer.find((p) => p.SikkerhetsToken === clean);
  if (byToken) return byToken;
  // 2. Bakoverkompatibilitet: Sjekk om det matcher PersonID (f.eks. P001, P011)
  const byId = db.personer.find((p) => p.PersonID.toUpperCase() === clean.toUpperCase());
  return byId;
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
  const svar = hentSvarStatus(db, tildelingId);
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
  let { state: fixed, endret } = korrigerLydBildeTilRigg(state);
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
    const text = await fetchJson(`${base}?action=load`, { signal: controller.signal });
    const payload = JSON.parse(text);
    if (payload?.ok && payload.data) {
      const state = applyLoadedState(normalizeState(payload.data));
      persistLocalState(state);
      return state;
    }
    throw new Error(payload?.error || "Ukjent svar fra Google Sheets.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof DOMException && e.name === "AbortError") {
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
        : "Mock-modus er aktiv. Velg «Ekte data» under Admin → Google Sheets & Data.",
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
    const text = await fetchJson(`${fetchUrl}?action=load`, { signal: controller.signal });
    clearTimeout(timeoutId);

    const payload = JSON.parse(text);
    if (payload?.ok && payload.data) {
      const normalized = applyLoadedState(normalizeState(payload.data));
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
      body: JSON.stringify({ action: "save", data: state }),
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

export function saveDatabase(state: DatabaseState): void {
  persistLocalState(state);

  if (!shouldWriteToRemote()) {
    return;
  }

  const base = getApiBase();
  if (!base) return;

  void fetch(base, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "save", data: state }),
  }).then(async (response) => {
    const payload = await response.json().catch(() => null);
    if (!payload?.ok) {
      console.error("Kunne ikke lagre til Google Sheets:", payload?.error || response.statusText);
    }
  }).catch((e) => {
    console.error("Kunne ikke lagre til Google Sheets:", e);
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

/**
 * Beregner effektivt behov for en rolle på en bestemt gudstjeneste
 * Regel: Hvis Tjenestebehov har en aktiv rad for GudstjenesteID + RolleID, brukes Antall.
 * Hvis ikke, brukes Roller.Behov.
 */
export function getEffektivtBehov(
  arg1: string | DatabaseState,
  arg2: Rolle | string,
  arg3?: Tjenestebehov[] | string | DatabaseState | Rolle
): number {
  // Case 1: getEffektivtBehov(db, gudstjenesteID, rolleID)
  if (typeof arg1 === "object" && arg1 !== null && "tjenestebehov" in arg1) {
    const db = arg1 as DatabaseState;
    const gudstjenesteID = String(arg2 || "");
    let rolleID = "";
    if (typeof arg3 === "string") {
      rolleID = arg3;
    } else if (arg3 && typeof arg3 === "object" && "RolleID" in arg3) {
      rolleID = (arg3 as Rolle).RolleID;
    }
    const rolle = db.roller.find((r) => r.RolleID === rolleID);
    const overstyring = (db.tjenestebehov || []).find(
      (tb) =>
        tb.GudstjenesteID === gudstjenesteID &&
        tb.RolleID === rolleID &&
        tb.Aktiv
    );
    return overstyring !== undefined ? overstyring.Antall : (rolle?.Behov ?? 1);
  }

  // Case 2: getEffektivtBehov(gudstjenesteID, rolle, tjenestebehovListe)
  const gudstjenesteID = String(arg1 || "");
  const rolleObj = typeof arg2 === "object" && arg2 !== null ? (arg2 as Rolle) : null;
  const rolleID = rolleObj ? rolleObj.RolleID : String(arg2 || "");

  let tjenestebehovListe: Tjenestebehov[] = [];
  if (Array.isArray(arg3)) {
    tjenestebehovListe = arg3;
  } else if (arg3 && typeof arg3 === "object" && "tjenestebehov" in arg3) {
    tjenestebehovListe = (arg3 as DatabaseState).tjenestebehov || [];
  }

  const overstyring = tjenestebehovListe.find(
    (tb) =>
      tb.GudstjenesteID === gudstjenesteID &&
      tb.RolleID === rolleID &&
      tb.Aktiv
  );
  if (overstyring !== undefined) {
    return overstyring.Antall;
  }
  return rolleObj ? rolleObj.Behov : 1;
}

export function hentSvarStatus(db: DatabaseState, tildelingId: string): SvarStatus {
  return db.svar.find((s) => s.TildelingID === tildelingId)?.Svar || "Venter";
}

export function erEksternPersonId(personId: string): boolean {
  return /^EXT\d+$/i.test(personId || "");
}

export function tildelingVisningsnavn(
  db: DatabaseState,
  t: { PersonID: string; EksternNavn?: string }
): string {
  if (t.EksternNavn) return t.EksternNavn;
  const p = db.personer.find((pers) => pers.PersonID === t.PersonID);
  return p?.Fornavn || p?.Navn || "Ukjent";
}

export function parseKlokkeMinutter(tid: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(tid || "").trim());
  if (!m) return 11 * 60;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function formatKlokkeMinutter(min: number): string {
  const wrapped = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const mm = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export type ProgramLinje = {
  Rekkefolge?: number;
  VarighetMin: number;
  ForStart?: boolean;
};

export type ProgramTidslinjeRad<T extends ProgramLinje> = T & {
  start: string;
  slutt: string;
};

/** Offisiell start minus ledende «Før start»-brikker, deretter kumulativ varighet. 0 min flytter ikke klokka. */
export function beregnProgramtider<T extends ProgramLinje>(
  aktiviteter: T[],
  startTid: string
): ProgramTidslinjeRad<T>[] {
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

export function sortertMalaktiviteter(db: DatabaseState): MalAktivitet[] {
  return [...(db.malaktiviteter || [])].sort((a, b) => a.Rekkefolge - b.Rekkefolge);
}

export function programForGudstjeneste(
  db: DatabaseState,
  gudstjenesteId: string
): ProgramAktivitet[] {
  return (db.programaktiviteter || [])
    .filter((p) => p.GudstjenesteID === gudstjenesteId)
    .sort((a, b) => a.Rekkefolge - b.Rekkefolge);
}

export type BrikkeAnsvarPerson = {
  personId: string;
  navn: string;
  status: SvarStatus;
};

export function hentAnsvarForBrikke(
  db: DatabaseState,
  gudstjenesteId: string,
  rolleId?: string
): { rolle?: Rolle; gruppe?: Gruppe; personer: BrikkeAnsvarPerson[] } {
  if (!rolleId) return { personer: [] };
  const rolle = (db.roller || []).find((r) => r.RolleID === rolleId);
  const gruppe = rolle?.GruppeID
    ? (db.grupper || []).find((g) => g.GruppeID === rolle.GruppeID)
    : undefined;
  const personer = (db.tildelinger || [])
    .filter((t) => t.GudstjenesteID === gudstjenesteId && t.RolleID === rolleId)
    .filter((t) => hentSvarStatus(db, t.TildelingID) !== "Avvist")
    .map((t) => ({
      personId: t.PersonID,
      navn: tildelingVisningsnavn(db, t),
      status: hentSvarStatus(db, t.TildelingID),
    }));
  return { rolle, gruppe, personer };
}

export function finnMotelederRolle(db: DatabaseState): Rolle | undefined {
  const aktive = (db.roller || []).filter((r) => r.Aktiv);
  return (
    aktive.find((r) => String(r.Rollenavn || "").trim().toLowerCase() === "møteleder") ||
    aktive.find((r) => String(r.Rollenavn || "").trim().toLowerCase().includes("møteleder"))
  );
}

export function kanRedigereProgram(
  db: DatabaseState,
  personId: string,
  gudstjenesteId?: string
): boolean {
  if (erAdministrator(db, personId)) return true;
  if (!gudstjenesteId) return false;
  const rolle = finnMotelederRolle(db);
  if (!rolle) return false;
  const tildeling = (db.tildelinger || []).find(
    (t) =>
      t.GudstjenesteID === gudstjenesteId &&
      t.RolleID === rolle.RolleID &&
      t.PersonID === personId
  );
  if (!tildeling) return false;
  return hentSvarStatus(db, tildeling.TildelingID) !== "Avvist";
}

export function visProgramIkon(
  db: DatabaseState,
  personId: string,
  gudstjenesteId: string
): boolean {
  return kanRedigereProgram(db, personId, gudstjenesteId) || erProgramPublisert(db, gudstjenesteId);
}

export function hentPrograminstans(
  db: DatabaseState,
  gudstjenesteId: string
): Programinstans | undefined {
  return (db.programinstanser || []).find((p) => p.GudstjenesteID === gudstjenesteId);
}

export function erProgramPublisert(db: DatabaseState, gudstjenesteId: string): boolean {
  return hentPrograminstans(db, gudstjenesteId)?.Status === "Publisert";
}

function upsertPrograminstans(
  db: DatabaseState,
  gudstjenesteId: string,
  patch: Partial<Programinstans>
): DatabaseState {
  const now = dagensDatoFelt();
  const eksisterende = hentPrograminstans(db, gudstjenesteId);
  const rad: Programinstans = {
    Status: "Utkast",
    PublisertDato: "",
    PublisertAv: "",
    OpprettetDato: now,
    ...eksisterende,
    ...patch,
    GudstjenesteID: gudstjenesteId,
    SistEndret: now,
  };
  const uten = (db.programinstanser || []).filter((p) => p.GudstjenesteID !== gudstjenesteId);
  return { ...db, programinstanser: [...uten, rad] };
}

export function opprettProgramFraMal(db: DatabaseState, gudstjenesteId: string): DatabaseState {
  const kopiert = kopierMalTilGudstjeneste(db, gudstjenesteId);
  if (hentPrograminstans(kopiert, gudstjenesteId)) return kopiert;
  return upsertPrograminstans(kopiert, gudstjenesteId, { Status: "Utkast" });
}

export function publiserProgram(
  db: DatabaseState,
  gudstjenesteId: string,
  personId: string
): DatabaseState {
  if (programForGudstjeneste(db, gudstjenesteId).length === 0) return db;
  const now = dagensDatoFelt();
  return upsertPrograminstans(db, gudstjenesteId, {
    Status: "Publisert",
    PublisertDato: now,
    PublisertAv: personId,
  });
}

export function avpubliserProgram(db: DatabaseState, gudstjenesteId: string): DatabaseState {
  if (!hentPrograminstans(db, gudstjenesteId)) return db;
  return upsertPrograminstans(db, gudstjenesteId, {
    Status: "Utkast",
    PublisertDato: "",
    PublisertAv: "",
  });
}

function dagensDatoFelt(): string {
  return new Date().toISOString().split("T")[0];
}

export function kopierMalTilGudstjeneste(
  db: DatabaseState,
  gudstjenesteId: string
): DatabaseState {
  const now = dagensDatoFelt();
  const mal = sortertMalaktiviteter(db);
  const utenDenne = (db.programaktiviteter || []).filter((p) => p.GudstjenesteID !== gudstjenesteId);
  let neste = utenDenne;
  const nye: ProgramAktivitet[] = mal.map((m, index) => {
    const id = nesteNummerertId(neste, "ProgramAktivitetID", "PA");
    const rad: ProgramAktivitet = {
      ProgramAktivitetID: id,
      GudstjenesteID: gudstjenesteId,
      Rekkefolge: index + 1,
      Tittel: m.Tittel,
      VarighetMin: Number(m.VarighetMin) || 0,
      RolleID: m.RolleID || "",
      ForStart: Boolean(m.ForStart),
      Merknad: m.Merknad || "",
      OpprettetDato: now,
      SistEndret: now,
    };
    neste = [...neste, rad];
    return rad;
  });
  return { ...db, programaktiviteter: [...utenDenne, ...nye] };
}

export function tilbakestillProgramFraMal(
  db: DatabaseState,
  gudstjenesteId: string
): DatabaseState {
  return kopierMalTilGudstjeneste(db, gudstjenesteId);
}

export function fyllStandardMalaktiviteter(db: DatabaseState): DatabaseState {
  return { ...db, malaktiviteter: initialMalaktiviteter.map((m) => ({ ...m })) };
}

export function omskrivMalRekkefolge(linjer: MalAktivitet[]): MalAktivitet[] {
  const now = dagensDatoFelt();
  return linjer.map((m, i) => ({ ...m, Rekkefolge: i + 1, SistEndret: now }));
}

export function omskrivProgramRekkefolge(linjer: ProgramAktivitet[]): ProgramAktivitet[] {
  const now = dagensDatoFelt();
  return linjer.map((p, i) => ({ ...p, Rekkefolge: i + 1, SistEndret: now }));
}

export function nyMalAktivitet(eksisterende: MalAktivitet[]): MalAktivitet {
  const now = dagensDatoFelt();
  const maxRekke = eksisterende.reduce((acc, m) => Math.max(acc, m.Rekkefolge || 0), 0);
  return {
    MalAktivitetID: nesteNummerertId(eksisterende, "MalAktivitetID", "MA"),
    Rekkefolge: maxRekke + 1,
    Tittel: "Ny aktivitet",
    VarighetMin: 5,
    RolleID: "",
    ForStart: false,
    Merknad: "",
    OpprettetDato: now,
    SistEndret: now,
  };
}

export function nyProgramAktivitet(
  eksisterende: ProgramAktivitet[],
  gudstjenesteId: string
): ProgramAktivitet {
  const now = dagensDatoFelt();
  const iGud = eksisterende.filter((p) => p.GudstjenesteID === gudstjenesteId);
  const maxRekke = iGud.reduce((acc, p) => Math.max(acc, p.Rekkefolge || 0), 0);
  return {
    ProgramAktivitetID: nesteNummerertId(eksisterende, "ProgramAktivitetID", "PA"),
    GudstjenesteID: gudstjenesteId,
    Rekkefolge: maxRekke + 1,
    Tittel: "Ny aktivitet",
    VarighetMin: 5,
    RolleID: "",
    ForStart: false,
    Merknad: "",
    OpprettetDato: now,
    SistEndret: now,
  };
}

export type Bemanningstall = {
  bekreftet: number;
  venter: number;
  ledige: number;
  forfall: number;
  behov: number;
};

export function tomtBemanningstall(): Bemanningstall {
  return { bekreftet: 0, venter: 0, ledige: 0, forfall: 0, behov: 0 };
}

export function plusBemanningstall(a: Bemanningstall, b: Bemanningstall): Bemanningstall {
  return {
    bekreftet: a.bekreftet + b.bekreftet,
    venter: a.venter + b.venter,
    ledige: a.ledige + b.ledige,
    forfall: a.forfall + b.forfall,
    behov: a.behov + b.behov,
  };
}

/** Ledige plasser: kun bekreftet fyller. Venter og forfall teller som 0. */
export function ledigePlasserForRolle(behov: number, bekreftet: number): number {
  return Math.max(0, behov - bekreftet);
}

export function summerBemanning(
  db: DatabaseState,
  gudstjenesteId: string,
  roller: Rolle[]
): Bemanningstall {
  const totalt = tomtBemanningstall();
  for (const rolle of roller) {
    const behov = getEffektivtBehov(gudstjenesteId, rolle, db.tjenestebehov);
    totalt.behov += behov;
    const tildelinger = db.tildelinger.filter(
      (t) => t.GudstjenesteID === gudstjenesteId && t.RolleID === rolle.RolleID
    );
    let bekreftet = 0;
    let venter = 0;
    let forfall = 0;
    for (const t of tildelinger) {
      const svar = hentSvarStatus(db, t.TildelingID);
      if (svar === "Avvist") forfall += 1;
      else if (svar === "Bekreftet") bekreftet += 1;
      else venter += 1;
    }
    totalt.bekreftet += bekreftet;
    totalt.venter += venter;
    totalt.forfall += forfall;
    totalt.ledige += ledigePlasserForRolle(behov, bekreftet);
  }
  return totalt;
}

export type BelastningCelleOppgave = {
  rolleId: string;
  rollenavn: string;
  status: "Bekreftet" | "Venter";
};

export type BelastningPersonRad = {
  personId: string;
  navn: string;
  fornavn: string;
  gruppeIds: string[];
  oppgaver: number;
  gudstjenester: number;
  bekreftet: number;
  venter: number;
  harFlereSammeDag: boolean;
  celler: Record<string, BelastningCelleOppgave[]>;
};

export type BelastningSemester = {
  gudstjenester: { GudstjenesteID: string; Dato: string; Tid: string; Tema: string }[];
  rader: BelastningPersonRad[];
  hoyestLast: { personId: string; navn: string; oppgaver: number } | null;
  utenOppgaver: number;
  flereSammeDag: number;
};

function tellerSomBelastning(status: SvarStatus): status is "Bekreftet" | "Venter" {
  return status === "Bekreftet" || status === "Venter";
}

/** Person × kommende gudstjenester. Avvist og eksterne telles ikke. */
export function belastningForSemester(db: DatabaseState, fraDato: string): BelastningSemester {
  const gudstjenester = db.gudstjenester
    .filter((g) => g.Dato >= fraDato)
    .slice()
    .sort((a, b) => `${a.Dato} ${a.Tid}`.localeCompare(`${b.Dato} ${b.Tid}`))
    .map((g) => ({
      GudstjenesteID: g.GudstjenesteID,
      Dato: g.Dato,
      Tid: g.Tid,
      Tema: g.Tema || "",
    }));
  const gudIdSet = new Set(gudstjenester.map((g) => g.GudstjenesteID));
  const rolleNavn = new Map(db.roller.map((r) => [r.RolleID, r.Rollenavn]));

  const aktivePersoner = db.personer.filter(
    (p) => p.Aktiv && !erEksternPersonId(p.PersonID)
  );

  const rader: BelastningPersonRad[] = aktivePersoner.map((p) => {
    const gruppeIds = finnTjenestegrupperForPerson(db, p.PersonID).map((t) => t.gruppe.GruppeID);
    const celler: Record<string, BelastningCelleOppgave[]> = {};
    let bekreftet = 0;
    let venter = 0;

    for (const t of db.tildelinger) {
      if (t.PersonID !== p.PersonID) continue;
      if (t.EksternNavn || erEksternPersonId(t.PersonID)) continue;
      if (!gudIdSet.has(t.GudstjenesteID)) continue;
      const status = hentSvarStatus(db, t.TildelingID);
      if (!tellerSomBelastning(status)) continue;
      const oppgave: BelastningCelleOppgave = {
        rolleId: t.RolleID,
        rollenavn: rolleNavn.get(t.RolleID) || t.RolleID,
        status,
      };
      if (!celler[t.GudstjenesteID]) celler[t.GudstjenesteID] = [];
      celler[t.GudstjenesteID].push(oppgave);
      if (status === "Bekreftet") bekreftet += 1;
      else venter += 1;
    }

    const oppgaver = bekreftet + venter;
    const gudstjenesteAntall = Object.keys(celler).length;
    const harFlereSammeDag = Object.values(celler).some((liste) => liste.length >= 2);

    return {
      personId: p.PersonID,
      navn: p.Navn,
      fornavn: p.Fornavn || p.Navn,
      gruppeIds,
      oppgaver,
      gudstjenester: gudstjenesteAntall,
      bekreftet,
      venter,
      harFlereSammeDag,
      celler,
    };
  });

  rader.sort((a, b) => b.oppgaver - a.oppgaver || a.navn.localeCompare(b.navn, "nb"));

  const medLast = rader.filter((r) => r.oppgaver > 0);
  const hoyest = medLast[0];
  return {
    gudstjenester,
    rader,
    hoyestLast: hoyest
      ? { personId: hoyest.personId, navn: hoyest.navn, oppgaver: hoyest.oppgaver }
      : null,
    utenOppgaver: rader.filter((r) => r.oppgaver === 0).length,
    flereSammeDag: rader.filter((r) => r.harFlereSammeDag).length,
  };
}

/**
 * Beregner ledige oppgaver (avledet sannhet) for alle eller spesifikke gudstjenester
 */
export function beregnLedigeOppgaver(
  db: DatabaseState,
  gudstjenesteIDFilter?: string
): LedigOppgave[] {
  const result: LedigOppgave[] = [];

  const gudstjenester = gudstjenesteIDFilter
    ? db.gudstjenester.filter((g) => g.GudstjenesteID === gudstjenesteIDFilter)
    : db.gudstjenester;

  const aktiveRoller = db.roller.filter((r) => r.Aktiv);

  for (const g of gudstjenester) {
    for (const r of aktiveRoller) {
      const effektivtBehov = getEffektivtBehov(g.GudstjenesteID, r, db.tjenestebehov);

      // Finn tildelinger for denne gudstjenesten og rollen
      const tildelingerForRolle = db.tildelinger.filter(
        (t) => t.GudstjenesteID === g.GudstjenesteID && t.RolleID === r.RolleID
      );

      // Veiledende ledig: kun bekreftet fyller. Overbooking er tillatt.
      const bekreftetAntall = tildelingerForRolle.filter(
        (t) => hentSvarStatus(db, t.TildelingID) === "Bekreftet"
      ).length;
      const ledigePlasser = Math.max(0, effektivtBehov - bekreftetAntall);

      const gruppe = db.grupper.find((grp) => grp.GruppeID === r.GruppeID);

      result.push({
        GudstjenesteID: g.GudstjenesteID,
        RolleID: r.RolleID,
        Rollenavn: r.Rollenavn,
        Dato: g.Dato,
        Tid: g.Tid,
        Sted: g.Sted,
        Tema: g.Tema,
        EffektivtBehov: effektivtBehov,
        AntallTildelt: bekreftetAntall,
        LedigePlasser: ledigePlasser,
        AnsvarligGruppeID: r.GruppeID,
        AnsvarligGruppeNavn: gruppe ? gruppe.Gruppenavn : undefined,
      });
    }
  }

  return result;
}

/**
 * Frivillig påmelding:
 * Finner oppgaver som matcher personens aktive Personroller.
 * Behovstall er veiledende; overbooking er tillatt.
 */
export function finnLedigeOppgaverForPerson(
  db: DatabaseState,
  personID: string
): LedigOppgave[] {
  const personensRoller = db.personroller
    .filter((pr) => pr.PersonID === personID && pr.Aktiv)
    .map((pr) => pr.RolleID);

  if (personensRoller.length === 0) return [];

  const alleLedige = beregnLedigeOppgaver(db);

  return alleLedige.filter((oppgave) => {
    // 1. Rollen må matche personens aktive roller
    if (!personensRoller.includes(oppgave.RolleID)) return false;

    // 2. Personen må ikke allerede være tildelt denne rollen på denne gudstjenesten
    const alleredeTildelt = db.tildelinger.some(
      (t) =>
        t.GudstjenesteID === oppgave.GudstjenesteID &&
        t.RolleID === oppgave.RolleID &&
        t.PersonID === personID
    );

    return !alleredeTildelt;
  });
}

/**
 * Atomisk frivillig påmelding:
 * 1. Validerer personrolle
 * 2. Oppretter Tildeling
 * 3. Oppretter Svar med "Bekreftet"
 * Behovstall er veiledende — overbooking er tillatt.
 */
export function meldPaaFrivillig(
  db: DatabaseState,
  personID: string,
  gudstjenesteID: string,
  rolleID: string,
  kommentar?: string
): { success: boolean; message: string; updatedDb?: DatabaseState } {
  // 1. Valider person
  const person = db.personer.find((p) => p.PersonID === personID && p.Aktiv);
  if (!person) {
    return { success: false, message: "Personen finnes ikke eller er ikke aktiv." };
  }

  // 2. Valider personrolle
  const harRolle = db.personroller.some(
    (pr) => pr.PersonID === personID && pr.RolleID === rolleID && pr.Aktiv
  );
  if (!harRolle) {
    return {
      success: false,
      message: "Personen har ikke registrert denne rollen i sine personroller.",
    };
  }

  // 3. Valider at personen ikke allerede er tildelt denne rollen på denne datoen
  const eksisterende = db.tildelinger.find(
    (t) =>
      t.GudstjenesteID === gudstjenesteID &&
      t.RolleID === rolleID &&
      t.PersonID === personID
  );
  if (eksisterende) {
    return {
      success: false,
      message: "Du er allerede registrert på denne oppgaven.",
    };
  }

  // Generer nye ID-er
  const maxTildelingNr = db.tildelinger.reduce((max, t) => {
    const num = parseInt(t.TildelingID.replace(/\D/g, ""), 10);
    return !isNaN(num) && num > max ? num : max;
  }, 0);
  const newTildelingID = `T${String(maxTildelingNr + 1).padStart(3, "0")}`;

  const maxSvarNr = db.svar.reduce((max, s) => {
    const num = parseInt(s.SvarID.replace(/\D/g, ""), 10);
    return !isNaN(num) && num > max ? num : max;
  }, 0);
  const newSvarID = `S${String(maxSvarNr + 1).padStart(3, "0")}`;

  const now = new Date().toISOString().split("T")[0];

  const nyTildeling: Tildeling = {
    TildelingID: newTildelingID,
    GudstjenesteID: gudstjenesteID,
    RolleID: rolleID,
    PersonID: personID,
    OpprettetDato: now,
    SistEndret: now,
  };

  const nyttSvar: Svar = {
    SvarID: newSvarID,
    TildelingID: newTildelingID,
    PersonID: personID,
    Svar: "Bekreftet",
    Kommentar: kommentar || "Frivillig påmeldt via personlig visning",
    SvartDato: now,
  };

  const updatedDb: DatabaseState = {
    ...db,
    tildelinger: [...db.tildelinger, nyTildeling],
    svar: [...db.svar, nyttSvar],
  };

  saveDatabase(updatedDb);

  return {
    success: true,
    message: "Du er nå bekreftet påmeldt til rollen!",
    updatedDb,
  };
}

/**
 * Velg eller legg til en dato for en person på en rolle
 */
export function velgDatoForPerson(
  db: DatabaseState,
  personID: string,
  gudstjenesteID: string,
  rolleID: string
): { success: boolean; message: string; updatedDb?: DatabaseState } {
  // Sjekk om det allerede finnes en tildeling for personen på denne gudstjenesten og rollen
  const eksisterendeTildeling = db.tildelinger.find(
    (t) =>
      t.GudstjenesteID === gudstjenesteID &&
      t.RolleID === rolleID &&
      t.PersonID === personID
  );

  if (eksisterendeTildeling) {
    const updatedDb = svarPaaTildeling(
      db,
      eksisterendeTildeling.TildelingID,
      personID,
      "Bekreftet",
      "Valgt av person via Min side"
    );
    return {
      success: true,
      message: "Datoen er nå bekreftet for din oppgave!",
      updatedDb,
    };
  }

  // Hvis ingen tildeling finnes fra før, opprett ny tildeling og bekreftet svar
  const maxTildelingNr = db.tildelinger.reduce((max, t) => {
    const num = parseInt(t.TildelingID.replace(/\D/g, ""), 10);
    return !isNaN(num) && num > max ? num : max;
  }, 0);
  const newTildelingID = `T${String(maxTildelingNr + 1).padStart(3, "0")}`;

  const maxSvarNr = db.svar.reduce((max, s) => {
    const num = parseInt(s.SvarID.replace(/\D/g, ""), 10);
    return !isNaN(num) && num > max ? num : max;
  }, 0);
  const newSvarID = `S${String(maxSvarNr + 1).padStart(3, "0")}`;

  const now = new Date().toISOString().split("T")[0];

  const nyTildeling: Tildeling = {
    TildelingID: newTildelingID,
    GudstjenesteID: gudstjenesteID,
    RolleID: rolleID,
    PersonID: personID,
    OpprettetDato: now,
    SistEndret: now,
  };

  const nyttSvar: Svar = {
    SvarID: newSvarID,
    TildelingID: newTildelingID,
    PersonID: personID,
    Svar: "Bekreftet",
    Kommentar: "Valgt av person via Min side",
    SvartDato: now,
  };

  const updatedDb: DatabaseState = {
    ...db,
    tildelinger: [...db.tildelinger, nyTildeling],
    svar: [...db.svar, nyttSvar],
  };

  saveDatabase(updatedDb);

  return {
    success: true,
    message: "Datoen er lagt til og bekreftet for din oppgave!",
    updatedDb,
  };
}

/**
 * Oppdaterer eller oppretter svar på en tildeling (Bekreftet / Avvist)
 */
export function svarPaaTildeling(
  db: DatabaseState,
  tildelingID: string,
  personID: string,
  nyttSvarStatus: SvarStatus,
  kommentar?: string
): DatabaseState {
  const now = new Date().toISOString().split("T")[0];
  const eksisterendeSvarIndex = db.svar.findIndex(
    (s) => s.TildelingID === tildelingID && s.PersonID === personID
  );

  let updatedSvarListe: Svar[];

  if (eksisterendeSvarIndex >= 0) {
    updatedSvarListe = [...db.svar];
    updatedSvarListe[eksisterendeSvarIndex] = {
      ...updatedSvarListe[eksisterendeSvarIndex],
      Svar: nyttSvarStatus,
      Kommentar: kommentar !== undefined ? kommentar : updatedSvarListe[eksisterendeSvarIndex].Kommentar,
      SvartDato: now,
    };
  } else {
    const maxSvarNr = db.svar.reduce((max, s) => {
      const num = parseInt(s.SvarID.replace(/\D/g, ""), 10);
      return !isNaN(num) && num > max ? num : max;
    }, 0);
    const newSvarID = `S${String(maxSvarNr + 1).padStart(3, "0")}`;

    const nyttSvar: Svar = {
      SvarID: newSvarID,
      TildelingID: tildelingID,
      PersonID: personID,
      Svar: nyttSvarStatus,
      Kommentar: kommentar || "",
      SvartDato: now,
    };
    updatedSvarListe = [...db.svar, nyttSvar];
  }

  const updatedDb: DatabaseState = {
    ...db,
    svar: updatedSvarListe,
  };

  saveDatabase(updatedDb);
  return updatedDb;
}

export type DeltakelseStatus = "Deltar" | "Avventer" | "Deltar ikke" | "Avvist";

/** Rolle å bruke når leder setter status: personens personrolle i gruppen, ellers gruppens eneste/første rolle. */
export function velgRolleForGruppemedlem(
  db: DatabaseState,
  personId: string,
  gruppeRoller: Rolle[]
): Rolle | undefined {
  if (gruppeRoller.length === 0) return undefined;
  if (gruppeRoller.length === 1) return gruppeRoller[0];
  const personRolleIds = new Set(
    db.personroller
      .filter((pr) => pr.PersonID === personId && pr.Aktiv)
      .map((pr) => pr.RolleID)
  );
  return gruppeRoller.find((r) => personRolleIds.has(r.RolleID)) || gruppeRoller[0];
}

/** Gruppeleder eller medlem: sett deltakelse for én person på én gudstjeneste+rolle. */
export function settDeltakelseForPerson(
  db: DatabaseState,
  personId: string,
  gudstjenesteId: string,
  rolleId: string,
  status: DeltakelseStatus,
  kommentar?: string
): DatabaseState {
  const now = new Date().toISOString().split("T")[0];
  const eksisterende = db.tildelinger.filter(
    (t) =>
      t.GudstjenesteID === gudstjenesteId &&
      t.PersonID === personId &&
      t.RolleID === rolleId
  );

  if (status === "Deltar ikke") {
    const fjernIds = new Set(eksisterende.map((t) => t.TildelingID));
    const updatedDb: DatabaseState = {
      ...db,
      tildelinger: db.tildelinger.filter((t) => !fjernIds.has(t.TildelingID)),
      svar: db.svar.filter((s) => !fjernIds.has(s.TildelingID)),
    };
    saveDatabase(updatedDb);
    return updatedDb;
  }

  let tildelinger = db.tildelinger;
  let tildelingId = eksisterende[0]?.TildelingID;
  if (!tildelingId) {
    tildelingId = nesteNummerertId(tildelinger, "TildelingID", "T");
    tildelinger = [
      ...tildelinger,
      {
        TildelingID: tildelingId,
        GudstjenesteID: gudstjenesteId,
        RolleID: rolleId,
        PersonID: personId,
        OpprettetDato: now,
        SistEndret: now,
      },
    ];
  }

  const svarStatus: SvarStatus =
    status === "Deltar" ? "Bekreftet" : status === "Avvist" ? "Avvist" : "Venter";

  const utenSave: DatabaseState = { ...db, tildelinger };
  const eksisterendeSvarIndex = utenSave.svar.findIndex(
    (s) => s.TildelingID === tildelingId && s.PersonID === personId
  );
  let svar = [...utenSave.svar];
  if (eksisterendeSvarIndex >= 0) {
    svar[eksisterendeSvarIndex] = {
      ...svar[eksisterendeSvarIndex],
      Svar: svarStatus,
      Kommentar: kommentar !== undefined ? kommentar : svar[eksisterendeSvarIndex].Kommentar,
      SvartDato: now,
    };
  } else {
    svar = [
      ...svar,
      {
        SvarID: nesteNummerertId(svar, "SvarID", "S"),
        TildelingID: tildelingId,
        PersonID: personId,
        Svar: svarStatus,
        Kommentar: kommentar || "",
        SvartDato: now,
      },
    ];
  }

  const updatedDb: DatabaseState = { ...utenSave, svar };
  saveDatabase(updatedDb);
  return updatedDb;
}

function nesteEksternPersonId(tildelinger: Tildeling[]): string {
  const max = tildelinger.reduce((acc, t) => {
    const m = /^EXT(\d+)$/i.exec(t.PersonID || "");
    if (!m) return acc;
    const n = parseInt(m[1], 10);
    return !isNaN(n) && n > acc ? n : acc;
  }, 0);
  return `EXT${String(max + 1).padStart(3, "0")}`;
}

/** Gjest på én gudstjeneste. Skrives ikke til Personer. */
export function tildelEksternPerson(
  db: DatabaseState,
  gudstjenesteId: string,
  rolleId: string,
  navn: string,
  kommentar?: string
): DatabaseState {
  const visningsnavn = navn.trim();
  if (!visningsnavn) return db;
  const nøkkel = visningsnavn.toLowerCase();
  const allerede = db.tildelinger.find(
    (t) =>
      t.GudstjenesteID === gudstjenesteId &&
      t.RolleID === rolleId &&
      (t.EksternNavn || "").trim().toLowerCase() === nøkkel &&
      hentSvarStatus(db, t.TildelingID) !== "Avvist"
  );
  if (allerede) return db;

  const now = new Date().toISOString().split("T")[0];
  const personId = nesteEksternPersonId(db.tildelinger);
  const tildelingId = nesteNummerertId(db.tildelinger, "TildelingID", "T");
  const nyTildeling: Tildeling = {
    TildelingID: tildelingId,
    GudstjenesteID: gudstjenesteId,
    RolleID: rolleId,
    PersonID: personId,
    EksternNavn: visningsnavn,
    OpprettetDato: now,
    SistEndret: now,
  };
  const utenSave: DatabaseState = {
    ...db,
    tildelinger: [...db.tildelinger, nyTildeling],
  };
  return settDeltakelseForPerson(
    utenSave,
    personId,
    gudstjenesteId,
    rolleId,
    "Avventer",
    kommentar || "Ekstern person (ikke i menighetsregisteret)"
  );
}

/**
 * Gruppeleder-hjelpefunksjoner:
 * Finner grupper der personen er registrert som GruppelederID, NestlederID
 * eller har en lederrolle i gruppen / personroller.
 */
export function finnGrupperForGruppeleder(
  db: DatabaseState,
  personID: string
): Gruppe[] {
  const grupperMap = new Map<string, Gruppe>();

  // 1. Gruppe der personen er satt som GruppelederID eller NestlederID
  for (const g of db.grupper || []) {
    if (g.Aktiv && (g.GruppelederID === personID || g.NestlederID === personID)) {
      grupperMap.set(g.GruppeID, g);
    }
  }

  // 2. Gruppe der personen har en lederrolle i Gruppemedlemmer
  for (const gm of db.gruppemedlemmer || []) {
    if (gm.Aktiv && gm.PersonID === personID) {
      const r = String(gm.Medlemsrolle || "").trim().toLowerCase();
      if (r === "leder" || r === "gruppeleder" || r === "nestleder" || r === "medleder" || r.includes("leder")) {
        const g = (db.grupper || []).find((grp) => grp.GruppeID === gm.GruppeID && grp.Aktiv);
        if (g) grupperMap.set(g.GruppeID, g);
      }
    }
  }

  // 3. Hvis personen har en overordnet gruppeleder-rolle i personroller
  const lederRoller = (db.roller || []).filter((r) => {
    const n = String(r.Rollenavn || "").trim().toLowerCase();
    return n.includes("gruppeleder") || n.includes("tjenestegruppeleder") || n.includes("leder");
  });
  const harLederRolle = (db.personroller || []).some(
    (pr) => pr.Aktiv && pr.PersonID === personID && lederRoller.some((r) => r.RolleID === pr.RolleID)
  );
  if (harLederRolle) {
    for (const gm of db.gruppemedlemmer || []) {
      if (gm.Aktiv && gm.PersonID === personID) {
        const g = (db.grupper || []).find((grp) => grp.GruppeID === gm.GruppeID && grp.Aktiv);
        if (g) grupperMap.set(g.GruppeID, g);
      }
    }
  }

  // 4. Spesialhåndtering for Astrid / Astri
  const person = (db.personer || []).find((p) => p.PersonID === personID);
  if (person) {
    const fn = (person.Fornavn || "").toLowerCase();
    const n = (person.Navn || "").toLowerCase();
    const notat = (person.Notat || "").toLowerCase();
    if (personID === "P011" || fn.startsWith("astr") || n.startsWith("astr")) {
      const forbonn = (db.grupper || []).find(
        (g) => g.GruppeID === "G007" || g.Gruppenavn.toLowerCase().includes("forbønn")
      );
      if (forbonn) grupperMap.set(forbonn.GruppeID, forbonn);
    }
    if (notat.includes("gruppeleder") || notat.includes("leder")) {
      for (const g of db.grupper || []) {
        if (g.Aktiv && notat.includes(g.Gruppenavn.toLowerCase())) {
          grupperMap.set(g.GruppeID, g);
        }
      }
    }
  }

  return Array.from(grupperMap.values());
}

export type AppView = "personal" | "leader" | "admin";

export interface PersonTilgang {
  isLeader: boolean;
  isAdmin: boolean;
  views: AppView[];
}

function erAdministrator(db: DatabaseState, personID: string): boolean {
  const person = db.personer.find((p) => p.PersonID === personID);
  if (!person || !person.Aktiv) return false;

  const adminRolle = (db.roller || []).find(
    (r) => r.Aktiv && String(r.Rollenavn || "").trim().toLowerCase() === "administrator"
  );
  if (adminRolle) {
    const harRolle = (db.personroller || []).some(
      (pr) => pr.Aktiv && pr.PersonID === personID && pr.RolleID === adminRolle.RolleID
    );
    if (harRolle) return true;
  }

  if (person.PersonID === "P009") return true;
  const navn = String(person.Navn || "").trim().toLowerCase();
  const fornavn = String(person.Fornavn || "").trim().toLowerCase();
  return fornavn === "magnar" || navn === "magnar" || navn.startsWith("magnar ");
}

/** Tilgang for aktiv person: vanlige brukere, gruppeledere og administrator (Magnar). */
export function hentTilgang(db: DatabaseState, personID: string): PersonTilgang {
  const isAdmin = erAdministrator(db, personID);
  const isLeader = finnGrupperForGruppeleder(db, personID).length > 0;
  const views: AppView[] = ["personal"];
  if (isLeader || isAdmin) views.push("leader");
  if (isAdmin) views.push("admin");
  return { isLeader, isAdmin, views };
}

export function visningErTillatt(tilgang: PersonTilgang, view: AppView): boolean {
  return tilgang.views.indexOf(view) >= 0;
}

export interface PersonGruppeTilknytning {
  gruppe: Gruppe;
  tilknytning: "Leder" | "Nestleder" | "Medlem";
}

/** Grupper personen leder, er nestleder for, eller er medlem av. */
export function finnTjenestegrupperForPerson(
  db: DatabaseState,
  personID: string
): PersonGruppeTilknytning[] {
  const byId = new Map<string, PersonGruppeTilknytning>();

  for (const gruppe of db.grupper) {
    if (!gruppe.Aktiv) continue;
    if (gruppe.GruppelederID === personID) {
      byId.set(gruppe.GruppeID, { gruppe, tilknytning: "Leder" });
    } else if (gruppe.NestlederID === personID) {
      byId.set(gruppe.GruppeID, { gruppe, tilknytning: "Nestleder" });
    }
  }

  for (const gm of db.gruppemedlemmer) {
    if (!gm.Aktiv || gm.PersonID !== personID) continue;
    if (byId.has(gm.GruppeID)) continue;
    const gruppe = db.grupper.find((g) => g.GruppeID === gm.GruppeID);
    if (gruppe) byId.set(gruppe.GruppeID, { gruppe, tilknytning: "Medlem" });
  }

  return Array.from(byId.values());
}

/**
 * Finner aktive medlemmer i en gitt gruppe
 */
export function finnMedlemmerIGruppe(
  db: DatabaseState,
  gruppeID: string
): { person: Person; medlemskap: Gruppemedlem; personroller: Rolle[] }[] {
  const medlemskapListe = db.gruppemedlemmer.filter(
    (gm) => gm.GruppeID === gruppeID && gm.Aktiv
  );

  return medlemskapListe
    .map((gm) => {
      const person = db.personer.find((p) => p.PersonID === gm.PersonID);
      if (!person) return null;

      const rolleIDs = db.personroller
        .filter((pr) => pr.PersonID === person.PersonID && pr.Aktiv)
        .map((pr) => pr.RolleID);

      const roller = db.roller.filter((r) => rolleIDs.includes(r.RolleID));

      return {
        person,
        medlemskap: gm,
        personroller: roller,
      };
    })
    .filter(Boolean) as {
    person: Person;
    medlemskap: Gruppemedlem;
    personroller: Rolle[];
  }[];
}

/**
 * Genererer en personlig, ugjettelig direktelenke (Magic Link)
 */
export function genererPersonligLenke(
  personIDOrObj: string | Person,
  view?: AppView,
  db?: DatabaseState
): string {
  const origin = window.location.origin;
  const path = window.location.pathname;
  const params = new URLSearchParams();

  let token = "";
  let personId = "";

  if (typeof personIDOrObj === "string") {
    personId = personIDOrObj;
    if (db) {
      const person = db.personer.find((p) => p.PersonID === personIDOrObj);
      if (person) {
        token = person.SikkerhetsToken || genererStatiskSikkerhetsToken(person.PersonID, person.Navn);
      }
    }
    if (!token) {
      token = genererStatiskSikkerhetsToken(personIDOrObj, "");
    }
  } else if (personIDOrObj && typeof personIDOrObj === "object") {
    personId = personIDOrObj.PersonID;
    token = personIDOrObj.SikkerhetsToken || genererStatiskSikkerhetsToken(personIDOrObj.PersonID, personIDOrObj.Navn);
  }

  // Bruk ?t= for ugjettelig token, fallback til personId hvis token mangler
  if (token) {
    params.set("t", token);
  } else {
    params.set("personId", personId);
  }

  if (view && view !== "personal") {
    params.set("view", view);
  }
  return `${origin}${path}?${params.toString()}`;
}

const IMPORT_ROLE_COLUMNS: { col: keyof GudstjenesterImport; rolleId: string }[] = [
  { col: "Leder", rolleId: "R001" },
  { col: "Taler", rolleId: "R002" },
  { col: "Forbønn", rolleId: "R003" },
  { col: "Barnekirke", rolleId: "R004" },
  { col: "Lovsang", rolleId: "R005" },
  { col: "Lyd", rolleId: "R006" },
  { col: "Bilde", rolleId: "R007" },
  { col: "Møtevert", rolleId: "R008" },
  { col: "Rigging", rolleId: "R009" },
  { col: "Kjøkken", rolleId: "R010" },
  { col: "Baking", rolleId: "R011" },
  { col: "Pynting", rolleId: "R012" },
];

function normalizePersonName(value: string): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function splitImportNames(value: unknown): string[] {
  return String(value ?? "")
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function matchPersonByName(db: DatabaseState, rawName: string): Person | null {
  const key = normalizePersonName(rawName);
  if (!key) return null;
  const byNavn = db.personer.filter((p) => normalizePersonName(p.Navn) === key);
  if (byNavn.length === 1) return byNavn[0];
  if (byNavn.length > 1) return null;
  const byFornavn = db.personer.filter((p) => {
    const fn = normalizePersonName(p.Fornavn) || normalizePersonName(p.Navn).split(" ")[0];
    return fn === key;
  });
  return byFornavn.length === 1 ? byFornavn[0] : null;
}

export interface UkjentImportSlot {
  gudstjenesteId: string;
  rolleId: string;
  rolleNavn: string;
  dato: string;
}

export interface UkjentImportnavn {
  navn: string;
  slots: UkjentImportSlot[];
}

/** Navn i Gudstjenester_import som ikke matcher Personer — admin kan opprette dem. */
export function finnUkjenteImportnavn(db: DatabaseState): UkjentImportnavn[] {
  const grouped = new Map<string, UkjentImportnavn>();

  for (const row of db.gudstjenesterImport || []) {
    const gudstjenesteId = String(row.GudstjenesteID || "").trim();
    if (!gudstjenesteId) continue;
    const gud = db.gudstjenester.find((g) => g.GudstjenesteID === gudstjenesteId);

    for (const mapping of IMPORT_ROLE_COLUMNS) {
      const names = splitImportNames(row[mapping.col]);
      const rolle = db.roller.find((r) => r.RolleID === mapping.rolleId);
      for (const navn of names) {
        if (matchPersonByName(db, navn)) continue;
        const key = normalizePersonName(navn);
        const existing = grouped.get(key) || { navn, slots: [] };
        const already = existing.slots.some(
          (s) => s.gudstjenesteId === gudstjenesteId && s.rolleId === mapping.rolleId
        );
        if (!already) {
          existing.slots.push({
            gudstjenesteId,
            rolleId: mapping.rolleId,
            rolleNavn: rolle?.Rollenavn || mapping.col,
            dato: gud?.Dato || row.Dato || "",
          });
        }
        grouped.set(key, existing);
      }
    }
  }

  return Array.from(grouped.values());
}

function nesteNummerertId<T>(records: T[], field: keyof T, prefix: string): string {
  const max = records.reduce((acc, rec) => {
    const num = parseInt(String(rec[field] ?? "").replace(/\D/g, ""), 10);
    return !isNaN(num) && num > acc ? num : acc;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export function nesteGruppeId(grupper: Gruppe[]): string {
  return nesteNummerertId(grupper, "GruppeID", "G");
}

export function nesteGruppeMedlemId(gruppemedlemmer: Gruppemedlem[]): string {
  return nesteNummerertId(gruppemedlemmer, "GruppeMedlemID", "GM");
}

/** Aktiver eksisterende rad, eller opprett ny GM…-rad for personen i gruppen. */
export function sikreGruppemedlemskap(
  gruppemedlemmer: Gruppemedlem[],
  gruppeId: string,
  personId: string,
  medlemsrolle?: string
): Gruppemedlem[] {
  if (!personId) return gruppemedlemmer;
  const now = new Date().toISOString().split("T")[0];
  const existing = gruppemedlemmer.find(
    (gm) => gm.GruppeID === gruppeId && gm.PersonID === personId
  );
  if (existing) {
    return gruppemedlemmer.map((gm) =>
      gm.GruppeMedlemID === existing.GruppeMedlemID
        ? {
            ...gm,
            Aktiv: true,
            Medlemsrolle:
              medlemsrolle !== undefined ? medlemsrolle : gm.Medlemsrolle,
            SistEndret: now,
          }
        : gm
    );
  }
  const ny: Gruppemedlem = {
    GruppeMedlemID: nesteGruppeMedlemId(gruppemedlemmer),
    GruppeID: gruppeId,
    PersonID: personId,
    Medlemsrolle: medlemsrolle || "Medlem",
    Aktiv: true,
    FraDato: now,
    TilDato: "",
    Notat: "",
    OpprettetDato: now,
    SistEndret: now,
  };
  return [...gruppemedlemmer, ny];
}

/** Ett felt: fornavn alene, eller fornavn + etternavn når det står i kilden / skrives inn. */
export function splittVisningsnavn(raw: string): { Navn: string; Fornavn: string; Etternavn: string } {
  const parts = String(raw || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { Navn: "", Fornavn: "", Etternavn: "" };
  if (parts.length === 1) {
    return { Navn: parts[0], Fornavn: parts[0], Etternavn: "" };
  }
  const etternavn = parts[parts.length - 1];
  const fornavn = parts.slice(0, -1).join(" ");
  return { Navn: `${fornavn} ${etternavn}`.trim(), Fornavn: fornavn, Etternavn: etternavn };
}

export function personHarAktivTildeling(
  db: DatabaseState,
  personId: string,
  gudstjenesteId: string,
  rolleId: string
): boolean {
  return db.tildelinger.some(
    (t) =>
      t.GudstjenesteID === gudstjenesteId &&
      t.RolleID === rolleId &&
      t.PersonID === personId &&
      hentSvarStatus(db, t.TildelingID) !== "Avvist"
  );
}

/** Unikt navnetreff — brukes for å unngå ny person med samme visningsnavn. */
export function finnPersonMedVisningsnavn(
  db: DatabaseState,
  raw: string
): { PersonID: string; Navn: string; Fornavn: string; Etternavn: string } | undefined {
  const n = splittVisningsnavn(raw);
  const full = n.Navn.toLowerCase();
  const aktive = db.personer.filter((p) => p.Aktiv !== false);
  const eksakt = aktive.filter((p) => (p.Navn || "").trim().toLowerCase() === full);
  if (eksakt.length === 1) return eksakt[0];
  if (n.Etternavn) {
    const begge = aktive.filter(
      (p) =>
        (p.Fornavn || "").trim().toLowerCase() === n.Fornavn.toLowerCase() &&
        (p.Etternavn || "").trim().toLowerCase() === n.Etternavn.toLowerCase()
    );
    if (begge.length === 1) return begge[0];
  }
  const kunFornavn = aktive.filter(
    (p) => (p.Fornavn || "").trim().toLowerCase() === n.Fornavn.toLowerCase()
  );
  if (kunFornavn.length === 1) return kunFornavn[0];
  return undefined;
}

/** Opprett person. Etternavn lagres bare hvis navnet har mer enn ett ord. */
export function opprettPersonIRegister(
  db: DatabaseState,
  input: { Navn: string },
  slots: UkjentImportSlot[] = []
): DatabaseState {
  const now = new Date().toISOString().split("T")[0];
  const navn = splittVisningsnavn(input.Navn);
  const person: Person = {
    PersonID: nesteNummerertId(db.personer, "PersonID", "P"),
    Navn: navn.Navn,
    Fornavn: navn.Fornavn,
    Etternavn: navn.Etternavn,
    Epost: "",
    Telefon: "",
    Notat: "",
    Aktiv: true,
    OpprettetDato: now,
    SistEndret: now,
  };

  let tildelinger = [...db.tildelinger];
  let svar = [...db.svar];
  let personroller = [...db.personroller];

  for (const slot of slots) {
    const alreadyAssigned = tildelinger.some(
      (t) =>
        t.GudstjenesteID === slot.gudstjenesteId &&
        t.RolleID === slot.rolleId &&
        t.PersonID === person.PersonID
    );
    if (alreadyAssigned) continue;

    const tildelingId = nesteNummerertId(tildelinger, "TildelingID", "T");
    tildelinger = [
      ...tildelinger,
      {
        TildelingID: tildelingId,
        GudstjenesteID: slot.gudstjenesteId,
        RolleID: slot.rolleId,
        PersonID: person.PersonID,
        OpprettetDato: now,
        SistEndret: now,
      },
    ];
    svar = [
      ...svar,
      {
        SvarID: nesteNummerertId(svar, "SvarID", "S"),
        TildelingID: tildelingId,
        PersonID: person.PersonID,
        Svar: "Venter",
        Kommentar: "",
        SvartDato: "",
      },
    ];

    const hasRolle = personroller.some(
      (pr) => pr.PersonID === person.PersonID && pr.RolleID === slot.rolleId && pr.Aktiv
    );
    if (!hasRolle) {
      personroller = [
        ...personroller,
        {
          PersonRolleID: nesteNummerertId(personroller, "PersonRolleID", "PR"),
          PersonID: person.PersonID,
          RolleID: slot.rolleId,
          Aktiv: true,
          FraDato: now,
          TilDato: "",
          Notat: "",
          OpprettetDato: now,
          SistEndret: now,
        },
      ];
    }
  }

  return {
    ...db,
    personer: [...db.personer, person],
    tildelinger,
    svar,
    personroller,
  };
}
