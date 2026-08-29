import type { DatabaseState, Person, Svar, Tildeling } from "../types/database";
import {
  type AppView,
  hentTilgang,
  visningErTillatt,
  genererPersonligLenke,
} from "./tilgang";

/** Offentlig demo: fiktive data, ingen skriving til menighetens Supabase. */
export function erDemoVersjon(): boolean {
  if (String(import.meta.env?.VITE_DEMO || "").toLowerCase() === "true") return true;
  try {
    const h = String(globalThis.location?.hostname || "").toLowerCase();
    return h === "demo.menighetsplan.no" || h.endsWith(".demo.menighetsplan.no");
  } catch {
    return false;
  }
}

export const SKARP_APP_URL = "https://www.menighetsplan.no";

const DEMO_TOKEN_SUFFIX = "aabbccddeeff00112233445566778899";

/** Stabil magisk token per PersonID — lik for alle besøkende på demo. */
export function demoTokenForPerson(personId: string): string {
  const num = String(personId || "")
    .trim()
    .replace(/^P/i, "")
    .padStart(3, "0");
  return `mk_demo${num}${DEMO_TOKEN_SUFFIX}`;
}

/** Erstatter tilfeldige tokens slik at ?t=…-lenker virker på tvers av enheter. */
export function applyDemoTestTokens(state: DatabaseState): DatabaseState {
  if (!erDemoVersjon()) return state;
  let endret = false;
  const personer = state.personer.map((p) => {
    const token = demoTokenForPerson(p.PersonID);
    if (p.SikkerhetsToken === token) return p;
    endret = true;
    return { ...p, SikkerhetsToken: token };
  });
  return endret ? { ...state, personer } : state;
}

export function finnPersonFraDemoParam(
  db: DatabaseState,
  raw: string | null | undefined
): Person | undefined {
  if (!erDemoVersjon()) return undefined;
  const id = String(raw || "").trim().toUpperCase();
  if (!/^P\d+$/.test(id)) return undefined;
  const person = db.personer.find((p) => p.PersonID === id);
  if (!person || person.Aktiv === false) return undefined;
  return person;
}

export function tolkVisningFraUrl(
  raw: string | null | undefined,
  db: DatabaseState,
  personId: string
): AppView | null {
  const v = String(raw || "").trim().toLowerCase();
  if (v !== "personal" && v !== "leader" && v !== "admin") return null;
  const tilgang = hentTilgang(db, personId);
  return visningErTillatt(tilgang, v) ? v : null;
}

export function genererDemoTestlenke(
  personId: string,
  view?: AppView | null,
  origin = typeof window !== "undefined" ? window.location.origin : "",
  pathname = typeof window !== "undefined" ? window.location.pathname : "/"
): string {
  const params = new URLSearchParams();
  params.set("demo", personId.trim().toUpperCase());
  if (view) params.set("view", view);
  return `${origin}${pathname}?${params.toString()}`;
}

/** Prod: magisk lenke. Demo: ?demo=P00X (& view). */
export function genererDelbarLenke(
  personId: string,
  db?: DatabaseState,
  view?: AppView | null
): string {
  if (erDemoVersjon()) {
    return genererDemoTestlenke(personId, view);
  }
  return genererPersonligLenke(personId, db);
}

export type DemoTestlenkePreset = {
  personId: string;
  view?: AppView;
  etikett: string;
  beskrivelse: string;
};

/** Sikrer forutsigbare bemannings-scenarioer i demo ( også for eldre localStorage ). */
export function applyDemoBemanningScenarios(state: DatabaseState): DatabaseState {
  if (!erDemoVersjon()) return state;

  let endret = false;
  let tildelinger = [...(state.tildelinger || [])];
  let svar = [...(state.svar || [])];

  const ensureTildeling = (t: Tildeling) => {
    const finnes = tildelinger.some((x) => x.TildelingID === t.TildelingID);
    if (!finnes) {
      tildelinger.push(t);
      endret = true;
    }
  };

  const ensureSvar = (s: Svar) => {
    const idx = svar.findIndex((x) => x.TildelingID === s.TildelingID);
    if (idx < 0) {
      svar.push(s);
      endret = true;
      return;
    }
    const gammel = svar[idx];
    if (gammel.Svar !== s.Svar || gammel.Kommentar !== s.Kommentar) {
      svar[idx] = { ...gammel, ...s };
      endret = true;
    }
  };

  ensureTildeling({
    TildelingID: "T019",
    GudstjenesteID: "GUD002",
    RolleID: "R003",
    PersonID: "P018",
    OpprettetDato: "2026-01-20",
    SistEndret: "2026-01-20",
  });
  ensureSvar({
    SvarID: "S019",
    TildelingID: "T019",
    PersonID: "P018",
    Svar: "Venter",
    SvartDato: "",
  });
  ensureSvar({
    SvarID: "S009",
    TildelingID: "T009",
    PersonID: "P006",
    Svar: "Avvist",
    Kommentar: "Meldt forfall",
    SvartDato: "2026-01-19",
  });

  return endret ? { ...state, tildelinger, svar } : state;
}

export const DEMO_TESTLENKER: DemoTestlenkePreset[] = [
  {
    personId: "P008",
    view: "personal",
    etikett: "Forespurt lovsang",
    beskrivelse: "Camilla Nilsen — forespørsel på lovsang (Ja/Nei)",
  },
  {
    personId: "P018",
    view: "personal",
    etikett: "Forespurt utenfor rolle",
    beskrivelse: "Forespørsel på forbønn uten avhuket rolle på Min side",
  },
  {
    personId: "P015",
    view: "personal",
    etikett: "Ta ledig plass",
    beskrivelse: "Kjøkken — se forfall i gruppestatus og meld deg på",
  },
  {
    personId: "P007",
    view: "personal",
    etikett: "Bruker med tjenester",
    beskrivelse: "Andreas Lund — Min side med gudstjenesteoppgaver",
  },
  {
    personId: "P002",
    view: "leader",
    etikett: "Gruppeleder bemanning",
    beskrivelse: "Ingrid Hansen — sett forespørsel og se KPI",
  },
  {
    personId: "P001",
    view: "admin",
    etikett: "Administrator",
    beskrivelse: "Magnar Totland — admin-visning",
  },
];
