import type { Arrangement, DatabaseState, Gruppe } from "../types/database";
import { beregnSamlingsdatoer, hentSamlingsplan } from "./samlingsplanlegging";
import { erGruppeledergruppe } from "./grupper";

export function iDagIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function aktiveArrangementerForGruppe(
  db: DatabaseState,
  gruppeId: string
): Arrangement[] {
  return (db.arrangementer || [])
    .filter((a) => a.Aktiv && a.GruppeID === gruppeId)
    .slice()
    .sort((a, b) => a.Dato.localeCompare(b.Dato) || a.Tid.localeCompare(b.Tid));
}

export function nesteArrangementForGruppe(
  db: DatabaseState,
  gruppeId: string,
  fraDato: string = iDagIso()
): Arrangement | undefined {
  return aktiveArrangementerForGruppe(db, gruppeId).find((a) => a.Dato >= fraDato);
}

export function kommendeArrangementerForGruppe(
  db: DatabaseState,
  gruppeId: string,
  limit = 5,
  fraDato: string = iDagIso()
): Arrangement[] {
  return aktiveArrangementerForGruppe(db, gruppeId)
    .filter((a) => a.Dato >= fraDato)
    .slice(0, limit);
}

export function forrigeArrangementForGruppe(
  db: DatabaseState,
  gruppeId: string,
  tilDato: string = iDagIso()
): Arrangement | undefined {
  const tidligere = aktiveArrangementerForGruppe(db, gruppeId).filter((a) => a.Dato < tilDato);
  return tidligere[tidligere.length - 1];
}

export function finnGruppelederteam(db: DatabaseState): Gruppe | undefined {
  return db.grupper.find((g) => g.Aktiv && erGruppeledergruppe(db, g));
}

export function nesteGruppeledersamling(db: DatabaseState): Arrangement | undefined {
  const forum = finnGruppelederteam(db);
  if (!forum) return undefined;
  return nesteArrangementForGruppe(db, forum.GruppeID);
}

export type NesteSamlingInfo =
  | { kilde: "arrangement"; arrangement: Arrangement }
  | { kilde: "plan"; dato: string; tid?: string; frekvens?: string };

/** Neste samling fra kalender, eller planlagt rytme fra Samlingsplan. */
export function nesteSamlingInfo(
  db: DatabaseState,
  gruppeId: string
): NesteSamlingInfo | undefined {
  const neste = nesteArrangementForGruppe(db, gruppeId);
  if (neste) return { kilde: "arrangement", arrangement: neste };

  const plan = hentSamlingsplan(db, gruppeId);
  const datoer = beregnSamlingsdatoer(plan).filter((d) => d >= iDagIso());
  const dato = datoer[0];
  if (!dato) return undefined;
  return {
    kilde: "plan",
    dato,
    tid: plan.Klokkeslett,
    frekvens: plan.Frekvens,
  };
}

export function formatertArrangementDato(dato: string, tid?: string): string {
  const parsed = new Date(`${dato}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dato;
  const tekst = parsed.toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const kl = String(tid || "").trim();
  return kl ? `${tekst} kl. ${kl.slice(0, 5)}` : tekst;
}
