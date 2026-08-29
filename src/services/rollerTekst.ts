import type { BidraPreposisjon, Rolle } from "../types/database";

export type { BidraPreposisjon };

export const BIDRA_PREPOSISJON_VALG: ReadonlyArray<{
  id: BidraPreposisjon;
  eksempel: string;
}> = [
  { id: "som", eksempel: "bidra som møteleder" },
  { id: "med", eksempel: "bidra med lovsang" },
  { id: "i", eksempel: "bidra i barnekirke" },
  { id: "på", eksempel: "bidra på lyd" },
];

function normaliserRollenavn(navn: string): string {
  return String(navn || "")
    .trim()
    .toLowerCase()
    .replace(/å/g, "a");
}

/** Gjetter preposisjon for roller uten lagret verdi (f.eks. eldre data). */
export function gjetBidraPreposisjon(rolle: Pick<Rolle, "Rollenavn">): BidraPreposisjon {
  const n = normaliserRollenavn(rolle.Rollenavn);
  if (
    n.includes("moteleder") ||
    n.includes("motevert") ||
    n.includes("taler") ||
    n.includes("smagruppeleder") ||
    n.endsWith("leder")
  ) {
    return "som";
  }
  if (n.includes("lyd") || n.includes("bilde")) return "på";
  if (n.includes("barnekirke") || n.includes("kjokken")) return "i";
  return "med";
}

export function hentBidraPreposisjon(rolle: Rolle): BidraPreposisjon {
  const lagret = rolle.BidraPreposisjon;
  if (lagret === "som" || lagret === "med" || lagret === "i" || lagret === "på") {
    return lagret;
  }
  return gjetBidraPreposisjon(rolle);
}

/** Én rolle: «som Møteleder». */
export function formatBidraRolle(rolle: Rolle): string {
  return `${hentBidraPreposisjon(rolle)} ${rolle.Rollenavn}`;
}

/** Flere roller: «som Møteleder og med Lovsang». Null når listen er tom. */
export function formatBidraRoller(roller: Rolle[]): string | null {
  if (roller.length === 0) return null;
  const deler = roller.map(formatBidraRolle);
  if (deler.length === 1) return deler[0];
  if (deler.length === 2) return `${deler[0]} og ${deler[1]}`;
  const forste = deler.slice(0, -1).join(", ");
  const siste = deler[deler.length - 1];
  return `${forste} og ${siste}`;
}
