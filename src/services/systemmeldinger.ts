import type {
  DatabaseState,
  GruppeMeldingHendelseType,
  GruppeMeldingKilde,
  Rolle,
} from "../types/database";
import { getEffektivtBehov, hentSvarStatus } from "./bemanning";
import { hentInnstillinger } from "./kalender";
import { opprettGruppeMelding } from "./kommunikasjon";

export const STANDARD_FORFALL_SYSTEMMAL =
  "{fornavn} har meldt forfall til {rolle} {dato}. Er det noen som kan steppe inn og ta denne oppgaven?";

export type MalKontekst = {
  fornavn: string;
  rolle: string;
  dato: string;
  gruppe: string;
  tema?: string;
};

export function erstattMalPlaceholdere(mal: string, ctx: MalKontekst): string {
  return mal
    .replace(/\{fornavn\}/g, ctx.fornavn)
    .replace(/\{rolle\}/g, ctx.rolle)
    .replace(/\{dato\}/g, ctx.dato)
    .replace(/\{gruppe\}/g, ctx.gruppe)
    .replace(/\{tema\}/g, ctx.tema || "");
}

export function hentForfallSystemmal(db: DatabaseState): string {
  const mal = String(hentInnstillinger(db).systemmeldingForfallMal || "").trim();
  return mal || STANDARD_FORFALL_SYSTEMMAL;
}

export function erForfallSystemmeldingAktivert(db: DatabaseState, gruppeId: string): boolean {
  if (hentInnstillinger(db).systemmeldingForfallAktivert === false) return false;
  const gruppe = db.grupper.find((g) => g.GruppeID === gruppeId);
  if (!gruppe) return false;
  return gruppe.Systemmeldinger?.forfallAutoAktivert !== false;
}

export function settGruppeForfallAutoAktivert(
  db: DatabaseState,
  gruppeId: string,
  aktivert: boolean
): DatabaseState {
  const iDag = new Date().toISOString().split("T")[0];
  return {
    ...db,
    grupper: db.grupper.map((g) =>
      g.GruppeID === gruppeId
        ? {
            ...g,
            Systemmeldinger: {
              ...g.Systemmeldinger,
              forfallAutoAktivert: aktivert,
            },
            SistEndret: iDag,
          }
        : g
    ),
  };
}

function formatDatoKort(dato: string): string {
  const parsed = new Date(`${dato}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dato;
  return parsed.toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function fornavnFraPerson(navn: string, fornavn?: string): string {
  const f = String(fornavn || navn || "").trim();
  if (f) return f.split(/\s+/)[0] || f;
  return "Noen";
}

export function harForfallSystemmeldingForTildeling(
  db: DatabaseState,
  tildelingId: string
): boolean {
  return (db.gruppeMeldinger || []).some(
    (m) => m.TildelingID === tildelingId && m.HendelseType === "forfall" && m.Kilde === "system"
  );
}

export function ledigeEtterForfall(
  db: DatabaseState,
  gudstjenesteId: string,
  rolle: Rolle
): number {
  const behov = getEffektivtBehov(db, gudstjenesteId, rolle);
  const bekreftet = db.tildelinger.filter(
    (t) =>
      t.GudstjenesteID === gudstjenesteId &&
      t.RolleID === rolle.RolleID &&
      hentSvarStatus(db, t.TildelingID) === "Bekreftet"
  ).length;
  return Math.max(0, behov - bekreftet);
}

export function skalOppretteForfallSystemmelding(
  db: DatabaseState,
  input: {
    gruppeId: string;
    tildelingId: string;
    gudstjenesteId: string;
    rolle: Rolle;
  }
): boolean {
  if (!erForfallSystemmeldingAktivert(db, input.gruppeId)) return false;
  if (harForfallSystemmeldingForTildeling(db, input.tildelingId)) return false;
  return ledigeEtterForfall(db, input.gudstjenesteId, input.rolle) > 0;
}

export function opprettForfallSystemmelding(
  db: DatabaseState,
  input: {
    gruppeId: string;
    personId: string;
    tildelingId: string;
    gudstjenesteId: string;
    rolle: Rolle;
    gudstjenesteDato: string;
    gudstjenesteTema?: string;
  }
): DatabaseState {
  if (
    !skalOppretteForfallSystemmelding(db, {
      gruppeId: input.gruppeId,
      tildelingId: input.tildelingId,
      gudstjenesteId: input.gudstjenesteId,
      rolle: input.rolle,
    })
  ) {
    return db;
  }

  const person = db.personer.find((p) => p.PersonID === input.personId);
  const gruppe = db.grupper.find((g) => g.GruppeID === input.gruppeId);
  const mal = hentForfallSystemmal(db);
  const tekst = erstattMalPlaceholdere(mal, {
    fornavn: fornavnFraPerson(person?.Navn || "", person?.Fornavn),
    rolle: input.rolle.Rollenavn,
    dato: formatDatoKort(input.gudstjenesteDato),
    gruppe: gruppe?.Gruppenavn || "gruppen",
    tema: input.gudstjenesteTema,
  });

  return opprettGruppeMelding(db, {
    gruppeId: input.gruppeId,
    tekst,
    opprettetAvPersonId: input.personId,
    kilde: "system",
    hendelseType: "forfall",
    gudstjenesteId: input.gudstjenesteId,
    rolleId: input.rolle.RolleID,
    tildelingId: input.tildelingId,
    utlostAvPersonId: input.personId,
  });
}

export function tolkeGruppeMeldingKilde(m: {
  Kilde?: GruppeMeldingKilde;
  ArrangementID?: string;
  HendelseType?: GruppeMeldingHendelseType;
}): GruppeMeldingKilde {
  if (m.Kilde) return m.Kilde;
  if (m.ArrangementID || m.HendelseType === "samling") return "gruppeleder";
  if (m.HendelseType === "forfall") return "medlem";
  return "gruppeleder";
}
