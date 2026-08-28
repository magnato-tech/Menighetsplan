import type { DatabaseState } from "../types/database";
import { rensPersondataForKlient } from "./tilgang";

export function sanitizeStateForViewer(
  db: DatabaseState,
  personId: string | undefined,
  isAdmin: boolean
): DatabaseState {
  return rensPersondataForKlient(db, personId, isAdmin);
}

const PERSON_KONTAKT = [
  "Epost",
  "Telefon",
  "Adresse",
  "Postnummer",
  "Poststed",
  "Fødselsår",
  "Fødselsdato",
  "Kjønn",
  "Notat",
  "Tilgangsnivå",
  "BildeURL",
  "SikkerhetsToken",
] as const;

function tomVerdi(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === "";
}

function flettPersoner(
  incoming: DatabaseState["personer"] | undefined,
  existing: DatabaseState["personer"]
): DatabaseState["personer"] {
  if (!incoming) return existing;
  const byId = new Map(existing.map((p) => [p.PersonID, p]));
  return incoming.map((p) => {
    const prev = byId.get(p.PersonID);
    if (!prev) return p;
    const neste = { ...p };
    for (const felt of PERSON_KONTAKT) {
      if (tomVerdi(neste[felt]) && !tomVerdi(prev[felt])) {
        (neste as Record<string, unknown>)[felt] = prev[felt];
      }
    }
    return neste;
  });
}

function flettGudstjenesterIkkeAdmin(
  incoming: DatabaseState["gudstjenester"] | undefined,
  existing: DatabaseState["gudstjenester"]
): DatabaseState["gudstjenester"] {
  if (!incoming) return existing;
  const byId = new Map(existing.map((g) => [g.GudstjenesteID, { ...g }]));
  for (const ny of incoming) {
    const id = String(ny.GudstjenesteID || "").trim();
    const prev = byId.get(id);
    if (!id || !prev) continue;
    if (ny.Kollekt !== undefined) prev.Kollekt = ny.Kollekt;
    if (ny.Merknad !== undefined) prev.Merknad = ny.Merknad;
  }
  return [...byId.values()];
}

/** Slå sammen innkommende lagring med lagret snapshot (ikke-admin kan ikke overskrive register). */
export function mergeIncomingState(
  existing: DatabaseState,
  incoming: Partial<DatabaseState>,
  isAdmin: boolean
): DatabaseState {
  if (!isAdmin) {
    return {
      ...existing,
      grupper: incoming.grupper ?? existing.grupper,
      gruppemedlemmer: incoming.gruppemedlemmer ?? existing.gruppemedlemmer,
      gudstjenester: flettGudstjenesterIkkeAdmin(incoming.gudstjenester, existing.gudstjenester),
      tjenestebehov: incoming.tjenestebehov ?? existing.tjenestebehov,
      tildelinger: incoming.tildelinger ?? existing.tildelinger,
      svar: incoming.svar ?? existing.svar,
      programaktiviteter: incoming.programaktiviteter ?? existing.programaktiviteter,
      programinstanser: incoming.programinstanser ?? existing.programinstanser,
    };
  }

  const neste: DatabaseState = { ...existing };
  const nøkler = Object.keys(existing) as (keyof DatabaseState)[];
  for (const key of nøkler) {
    if (incoming[key] === undefined || incoming[key] === null) continue;
    if (key === "personer") continue;
    (neste as unknown as Record<string, unknown>)[key] = incoming[key];
  }
  neste.personer = flettPersoner(incoming.personer, existing.personer);
  return neste;
}
