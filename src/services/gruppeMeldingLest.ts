import type { DatabaseState, GruppeMelding } from "../types/database";
import { meldingerForPerson } from "./kommunikasjon";

const STORAGE_PREFIX = "gruppeMeldingerSistSett_";

function lestNokkel(personId: string): string {
  return `${STORAGE_PREFIX}${personId}`;
}

export function meldingSorteringsNokkel(m: GruppeMelding): string {
  return `${m.OpprettetDato}|${m.GruppeMeldingID}`;
}

export function lesSistSettMeldingNokkel(personId: string): string {
  try {
    return String(localStorage.getItem(lestNokkel(personId)) || "").trim();
  } catch {
    return "";
  }
}

export function markerMeldingerSomLest(db: DatabaseState, personId: string): void {
  const meldinger = meldingerForPerson(db, personId, 100);
  if (meldinger.length === 0) return;
  const nyeste = meldinger[0];
  try {
    localStorage.setItem(lestNokkel(personId), meldingSorteringsNokkel(nyeste));
  } catch {
    /* nettleser uten localStorage */
  }
}

export function erMeldingUlest(m: GruppeMelding, sistSett: string): boolean {
  if (!sistSett) return true;
  return meldingSorteringsNokkel(m) > sistSett;
}

export function antallUlesteMeldinger(db: DatabaseState, personId: string): number {
  const sistSett = lesSistSettMeldingNokkel(personId);
  return meldingerForPerson(db, personId, 100).filter((m) => erMeldingUlest(m, sistSett)).length;
}
