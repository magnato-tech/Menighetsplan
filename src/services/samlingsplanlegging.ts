import type { ArrangementTag, DatabaseState, Gruppe, Samlingsplan } from "../types/database";
import { tilIsoDato } from "./dato";
import { opprettArrangement } from "./arrangementer";
import { gruppetypeForGruppe } from "./grupper";

export const SAMLINGSPLAN_FREKVENS = [
  "Ingen gjentakelse",
  "Hver uke",
  "1 gang pr 2 uker",
  "1 gang pr måned",
] as const;

export const SAMLINGSPLAN_INGEN_GJENTAKELSE = "Ingen gjentakelse";

export const SAMLINGSPLAN_UKEDAGER = [
  "Mandag",
  "Tirsdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lørdag",
  "Søndag",
] as const;

export const SAMLINGSPLAN_EKSTERN_PREFIKS = "SP:";

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function isoDato(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ukedagTilJs(dag: string | undefined): number {
  const map: Record<string, number> = {
    Søndag: 0,
    Mandag: 1,
    Tirsdag: 2,
    Onsdag: 3,
    Torsdag: 4,
    Fredag: 5,
    Lørdag: 6,
  };
  return map[String(dag || "").trim()] ?? 5;
}

export function samlingsplanEksternId(gruppeId: string, dato: string): string {
  return `${SAMLINGSPLAN_EKSTERN_PREFIKS}${gruppeId}:${dato}`;
}

export function erFraSamlingsplan(eksternId: string | undefined, gruppeId: string): boolean {
  return String(eksternId || "").startsWith(`${SAMLINGSPLAN_EKSTERN_PREFIKS}${gruppeId}:`);
}

export function gruppeArrangementTagger(db: DatabaseState, gruppe: Gruppe): ArrangementTag[] {
  const typeNavn = gruppetypeForGruppe(db, gruppe)?.Navn?.trim() || "Ukjent type";
  return [
    { Kategori: "Gruppe", Verdi: gruppe.Gruppenavn.trim() || gruppe.GruppeID },
    { Kategori: "Type gruppe", Verdi: typeNavn },
  ];
}

export function beregnSamlingsdatoer(plan: Samlingsplan): string[] {
  const start = tilIsoDato(String(plan.Startdato || "").trim());
  if (!start) return [];
  const frekvens = plan.Frekvens || SAMLINGSPLAN_INGEN_GJENTAKELSE;

  if (frekvens === SAMLINGSPLAN_INGEN_GJENTAKELSE) {
    return [start];
  }

  const slutt = tilIsoDato(String(plan.Sluttdato || "").trim() || start);
  if (!slutt) return [];
  const targetDag = ukedagTilJs(plan.Ukedag);

  const datoer: string[] = [];
  let current = parseIso(start);
  while (current.getDay() !== targetDag) {
    current.setDate(current.getDate() + 1);
  }
  const sluttDato = parseIso(slutt);
  if (current > sluttDato) return [];

  while (current <= sluttDato) {
    datoer.push(isoDato(current));
    if (frekvens === "Hver uke") {
      current.setDate(current.getDate() + 7);
    } else if (frekvens === "1 gang pr 2 uker") {
      current.setDate(current.getDate() + 14);
    } else {
      const nesteMnd = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      while (nesteMnd.getDay() !== targetDag) {
        nesteMnd.setDate(nesteMnd.getDate() + 1);
      }
      current = nesteMnd;
    }
  }
  return datoer;
}

export function planGjentas(plan: Samlingsplan): boolean {
  const frekvens = plan.Frekvens || SAMLINGSPLAN_INGEN_GJENTAKELSE;
  return frekvens !== SAMLINGSPLAN_INGEN_GJENTAKELSE;
}

export function tomSamlingsplan(): Samlingsplan {
  return {
    Frekvens: SAMLINGSPLAN_INGEN_GJENTAKELSE,
    Ukedag: "Fredag",
    Startdato: "",
    Sluttdato: "",
    Klokkeslett: "",
    Sluttid: "",
  };
}

export function hentSamlingsplan(db: DatabaseState, gruppeId: string): Samlingsplan {
  const gruppe = (db.grupper || []).find((g) => g.GruppeID === gruppeId);
  return { ...tomSamlingsplan(), ...(gruppe?.Samlingsplan || {}) };
}

export function lagreSamlingsplan(
  db: DatabaseState,
  gruppeId: string,
  plan: Samlingsplan
): DatabaseState {
  const now = new Date().toISOString().split("T")[0];
  return {
    ...db,
    grupper: (db.grupper || []).map((g) =>
      g.GruppeID === gruppeId
        ? {
            ...g,
            Samlingsplan: {
              Frekvens: plan.Frekvens?.trim() || undefined,
              Ukedag: plan.Ukedag?.trim() || undefined,
              Startdato: plan.Startdato?.trim() || undefined,
              Sluttdato: plan.Sluttdato?.trim() || undefined,
              Klokkeslett: plan.Klokkeslett?.trim() || undefined,
              Sluttid: plan.Sluttid?.trim() || undefined,
              SistGenerert: g.Samlingsplan?.SistGenerert,
            },
            SistEndret: now,
          }
        : g
    ),
  };
}

function fjernTidligereSamlingshendelser(db: DatabaseState, gruppeId: string): DatabaseState {
  const now = new Date().toISOString().split("T")[0];
  return {
    ...db,
    arrangementer: (db.arrangementer || []).map((a) =>
      erFraSamlingsplan(a.EksternKalenderID, gruppeId) && a.Aktiv !== false
        ? { ...a, Aktiv: false, SistEndret: now }
        : a
    ),
  };
}

export type GenererSamlingshendelserResultat =
  | { ok: true; antall: number; db: DatabaseState }
  | { ok: false; feil: string };

export function genererSamlingshendelser(
  db: DatabaseState,
  gruppeId: string,
  plan: Samlingsplan,
  opprettetAv?: string
): GenererSamlingshendelserResultat {
  const gruppe = (db.grupper || []).find((g) => g.GruppeID === gruppeId && g.Aktiv);
  if (!gruppe) return { ok: false, feil: "Fant ikke gruppen." };

  const klokkeslett = String(plan.Klokkeslett || "").trim();
  if (!plan.Startdato?.trim()) return { ok: false, feil: "Startdato må fylles ut." };
  if (!klokkeslett) return { ok: false, feil: "Klokkeslett må fylles ut." };

  const datoer = beregnSamlingsdatoer(plan);
  if (datoer.length === 0) {
    return { ok: false, feil: "Ingen datoer i perioden. Sjekk start- og sluttdato." };
  }

  let neste = lagreSamlingsplan(db, gruppeId, plan);
  neste = fjernTidligereSamlingshendelser(neste, gruppeId);

  const tagger = gruppeArrangementTagger(neste, gruppe);
  const beskrivelse = plan.Sluttid?.trim()
    ? `Slutt ca. ${plan.Sluttid.trim()}`
    : "";

  for (const dato of datoer) {
    neste = opprettArrangement(neste, {
      tittel: `${gruppe.Gruppenavn} – samling`,
      dato,
      tid: klokkeslett,
      sted: "",
      beskrivelse,
      opprettetAv,
      eksternKalenderID: samlingsplanEksternId(gruppeId, dato),
      gruppeId,
      tagger,
    });
  }

  const now = new Date().toISOString().split("T")[0];
  neste = {
    ...neste,
    grupper: (neste.grupper || []).map((g) =>
      g.GruppeID === gruppeId
        ? {
            ...g,
            Samlingsplan: {
              ...(g.Samlingsplan || {}),
              ...plan,
              SistGenerert: now,
            },
            SistEndret: now,
          }
        : g
    ),
  };

  return { ok: true, antall: datoer.length, db: neste };
}
