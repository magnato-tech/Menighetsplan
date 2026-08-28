import type {
  Arrangement,
  DatabaseState,
  GruppeMelding,
  Person,
  VarselLogg,
} from "../types/database";
import { nesteNummerertId } from "./ids";
import { finnMedlemmerIGruppe } from "./grupper";
import { formatertArrangementDato } from "./gruppeArrangementer";
import { genererPersonligLenke } from "./tilgang";

export type VarselKanal = "sms" | "epost" | "kopier";
export type VarselType = "ny_melding" | "foresporsel" | "samling";

export type VarselUtkast = {
  gruppeMeldingId?: string;
  type: VarselType;
  personId: string;
  telefon?: string;
  epost?: string;
  kropp: string;
  emne?: string;
};

export type ManueltVarselResultat = {
  href?: string;
  tekstTilKopiering: string;
};

export type MeldingForPerson = GruppeMelding & {
  gruppenavn: string;
  arrangement?: Arrangement;
};

function iDagIso(): string {
  return new Date().toISOString().split("T")[0];
}

function fornavn(person: Person): string {
  return String(person.Fornavn || person.Navn || "").trim() || "du";
}

export function kanSendeSms(telefon: string | undefined | null): boolean {
  return normaliserTelefon(telefon) != null;
}

export function kanSendeEpost(epost: string | undefined | null): boolean {
  return Boolean(String(epost || "").trim());
}

export function normaliserTelefon(telefon: string | undefined | null): string | null {
  const rå = String(telefon || "").replace(/\s+/g, "");
  if (!rå) return null;
  if (rå.startsWith("+")) return rå;
  const bare = rå.replace(/\D/g, "");
  if (bare.length === 8) return `+47${bare}`;
  if (bare.startsWith("47") && bare.length === 10) return `+${bare}`;
  if (bare.length >= 8) return `+${bare}`;
  return null;
}

export function smsLenke(telefon: string | undefined | null, kropp: string): string | null {
  const nr = normaliserTelefon(telefon);
  if (!nr) return null;
  return `sms:${nr}?body=${encodeURIComponent(kropp)}`;
}

export function mailtoMedKropp(opts: {
  mottakere: string[];
  emne: string;
  kropp: string;
}): string {
  const eposter = opts.mottakere.map((e) => String(e || "").trim()).filter(Boolean);
  if (eposter.length === 0) return "";
  const params = new URLSearchParams();
  if (eposter.length === 1) params.set("to", eposter[0]);
  else params.set("bcc", eposter.join(","));
  params.set("subject", opts.emne);
  params.set("body", opts.kropp);
  return `mailto:?${params.toString()}`;
}

export function varselNyMelding(opts: { gruppenavn: string; lenke: string }): string {
  return `Ny melding fra ${opts.gruppenavn}. Åpne: ${opts.lenke}`;
}

export function varselForesporselOppgave(opts: {
  fornavn: string;
  rolle: string;
  dato: string;
  lenke: string;
}): string {
  return `Hei ${opts.fornavn}, kan du ta ${opts.rolle} ${opts.dato}? Åpne lenken for å svare og se instruks: ${opts.lenke}`;
}

export function varselSamling(opts: {
  gruppenavn: string;
  dato: string;
  lenke: string;
}): string {
  return `Påminnelse: ${opts.gruppenavn} ${opts.dato}. Les detaljer: ${opts.lenke}`;
}

export function opprettGruppeMelding(
  db: DatabaseState,
  input: {
    gruppeId: string;
    tekst: string;
    opprettetAvPersonId: string;
    arrangementId?: string;
  }
): DatabaseState {
  const tekst = String(input.tekst || "").trim();
  if (!tekst) return db;
  const iDag = iDagIso();
  const ny: GruppeMelding = {
    GruppeMeldingID: nesteNummerertId(db.gruppeMeldinger || [], "GruppeMeldingID", "GM"),
    GruppeID: input.gruppeId,
    ArrangementID: input.arrangementId || undefined,
    Tekst: tekst,
    OpprettetAvPersonID: input.opprettetAvPersonId,
    OpprettetDato: iDag,
    SistEndret: iDag,
  };
  return {
    ...db,
    gruppeMeldinger: [...(db.gruppeMeldinger || []), ny],
  };
}

export function oppdaterArrangementBeskrivelse(
  db: DatabaseState,
  arrangementId: string,
  beskrivelse: string
): DatabaseState {
  const iDag = iDagIso();
  return {
    ...db,
    arrangementer: db.arrangementer.map((a) =>
      a.ArrangementID === arrangementId
        ? { ...a, Beskrivelse: beskrivelse.trim(), SistEndret: iDag }
        : a
    ),
  };
}

export function sisteMeldingerForGruppe(
  db: DatabaseState,
  gruppeId: string,
  antall = 5
): GruppeMelding[] {
  return (db.gruppeMeldinger || [])
    .filter((m) => m.GruppeID === gruppeId)
    .sort((a, b) => `${b.OpprettetDato} ${b.GruppeMeldingID}`.localeCompare(`${a.OpprettetDato} ${a.GruppeMeldingID}`))
    .slice(0, antall);
}

function gruppeIdsForPerson(db: DatabaseState, personId: string): Set<string> {
  const ids = new Set<string>();
  for (const gm of db.gruppemedlemmer || []) {
    if (gm.Aktiv && gm.PersonID === personId) ids.add(gm.GruppeID);
  }
  for (const g of db.grupper || []) {
    if (!g.Aktiv) continue;
    if (g.GruppelederID === personId || g.NestlederID === personId) ids.add(g.GruppeID);
  }
  return ids;
}

export function meldingerForPerson(
  db: DatabaseState,
  personId: string,
  antall = 10
): MeldingForPerson[] {
  const gruppeIds = gruppeIdsForPerson(db, personId);
  if (gruppeIds.size === 0) return [];
  return (db.gruppeMeldinger || [])
    .filter((m) => gruppeIds.has(m.GruppeID))
    .sort((a, b) => `${b.OpprettetDato} ${b.GruppeMeldingID}`.localeCompare(`${a.OpprettetDato} ${a.GruppeMeldingID}`))
    .slice(0, antall)
    .map((m) => {
      const gruppe = db.grupper.find((g) => g.GruppeID === m.GruppeID);
      const arrangement = m.ArrangementID
        ? db.arrangementer.find((a) => a.ArrangementID === m.ArrangementID)
        : undefined;
      return {
        ...m,
        gruppenavn: gruppe?.Gruppenavn || "Gruppe",
        arrangement,
      };
    });
}

export function kommendeSamlingerForPerson(
  db: DatabaseState,
  personId: string,
  antall = 6
): { gruppenavn: string; arrangement: Arrangement }[] {
  const gruppeIds = gruppeIdsForPerson(db, personId);
  const iDag = iDagIso();
  return db.arrangementer
    .filter((a) => a.Aktiv && a.Dato >= iDag && a.GruppeID && gruppeIds.has(a.GruppeID))
    .sort((a, b) => `${a.Dato} ${a.Tid}`.localeCompare(`${b.Dato} ${b.Tid}`))
    .slice(0, antall)
    .map((a) => ({
      gruppenavn: db.grupper.find((g) => g.GruppeID === a.GruppeID)?.Gruppenavn || "Gruppe",
      arrangement: a,
    }));
}

export function byggVarselForMelding(
  db: DatabaseState,
  melding: GruppeMelding,
  mottakere: Person[]
): VarselUtkast[] {
  const gruppe = db.grupper.find((g) => g.GruppeID === melding.GruppeID);
  const gruppenavn = gruppe?.Gruppenavn || "gruppen";
  return mottakere.map((person) => {
    const lenke = genererPersonligLenke(person.PersonID, db);
    return {
      gruppeMeldingId: melding.GruppeMeldingID,
      type: "ny_melding" as const,
      personId: person.PersonID,
      telefon: person.Telefon,
      epost: person.Epost,
      emne: `Melding fra ${gruppenavn}`,
      kropp: varselNyMelding({ gruppenavn, lenke }),
    };
  });
}

export function byggVarselForesporsel(
  db: DatabaseState,
  input: {
    personId: string;
    rolleNavn: string;
    gudstjenesteDato: string;
  }
): VarselUtkast | null {
  const person = db.personer.find((p) => p.PersonID === input.personId);
  if (!person) return null;
  const lenke = genererPersonligLenke(person.PersonID, db);
  const dato = new Date(`${input.gudstjenesteDato}T12:00:00`).toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return {
    type: "foresporsel",
    personId: person.PersonID,
    telefon: person.Telefon,
    epost: person.Epost,
    emne: `Forespørsel: ${input.rolleNavn}`,
    kropp: varselForesporselOppgave({
      fornavn: fornavn(person),
      rolle: input.rolleNavn,
      dato,
      lenke,
    }),
  };
}

export function byggVarselForSamling(
  db: DatabaseState,
  gruppeId: string,
  arrangement: Arrangement,
  mottakere: Person[]
): VarselUtkast[] {
  const gruppe = db.grupper.find((g) => g.GruppeID === gruppeId);
  const gruppenavn = gruppe?.Gruppenavn || "gruppen";
  const dato = formatertArrangementDato(arrangement.Dato, arrangement.Tid);
  return mottakere.map((person) => {
    const lenke = genererPersonligLenke(person.PersonID, db);
    return {
      type: "samling" as const,
      personId: person.PersonID,
      telefon: person.Telefon,
      epost: person.Epost,
      emne: `Samling: ${gruppenavn}`,
      kropp: varselSamling({ gruppenavn, dato, lenke }),
    };
  });
}

export function sendVarselManuelt(
  utkast: VarselUtkast,
  kanal: VarselKanal
): ManueltVarselResultat {
  if (kanal === "sms") {
    const href = smsLenke(utkast.telefon, utkast.kropp);
    return { href: href || undefined, tekstTilKopiering: utkast.kropp };
  }
  if (kanal === "epost") {
    const href = kanSendeEpost(utkast.epost)
      ? mailtoMedKropp({
          mottakere: [String(utkast.epost)],
          emne: utkast.emne || "Melding fra menighetsplanen",
          kropp: utkast.kropp,
        })
      : "";
    return { href: href || undefined, tekstTilKopiering: utkast.kropp };
  }
  return { tekstTilKopiering: utkast.kropp };
}

export function sendVarselManueltGruppe(
  utkast: VarselUtkast[],
  kanal: VarselKanal
): ManueltVarselResultat {
  if (kanal === "kopier") {
    return {
      tekstTilKopiering: utkast.map((u) => u.kropp).join("\n\n"),
    };
  }
  if (kanal === "epost") {
    const eposter = utkast.map((u) => String(u.epost || "").trim()).filter(Boolean);
    const emne = utkast[0]?.emne || "Melding fra menighetsplanen";
    const kropp = utkast[0]?.kropp || "";
    const href = mailtoMedKropp({ mottakere: eposter, emne, kropp });
    return { href: href || undefined, tekstTilKopiering: kropp };
  }
  return { tekstTilKopiering: utkast[0]?.kropp || "" };
}

export function loggManuelleVarsler(
  db: DatabaseState,
  utkast: VarselUtkast[],
  kanal: VarselKanal
): DatabaseState {
  const nå = new Date().toISOString();
  let eksisterende = [...(db.varselLogg || [])];
  const nye: VarselLogg[] = [];
  for (const u of utkast) {
    const id = nesteNummerertId(eksisterende, "VarselID", "VL");
    const rad: VarselLogg = {
      VarselID: id,
      PersonID: u.personId,
      GruppeMeldingID: u.gruppeMeldingId,
      Kanal: kanal,
      Status: "manuell",
      Tidspunkt: nå,
    };
    nye.push(rad);
    eksisterende.push(rad);
  }
  return {
    ...db,
    varselLogg: [...(db.varselLogg || []), ...nye],
  };
}

export function medlemmerForGruppe(db: DatabaseState, gruppeId: string): Person[] {
  const byId = new Map<string, Person>();
  for (const m of finnMedlemmerIGruppe(db, gruppeId)) {
    byId.set(m.person.PersonID, m.person);
  }
  const gruppe = db.grupper.find((g) => g.GruppeID === gruppeId);
  if (gruppe?.GruppelederID) {
    const leder = db.personer.find((p) => p.PersonID === gruppe.GruppelederID);
    if (leder) byId.set(leder.PersonID, leder);
  }
  if (gruppe?.NestlederID) {
    const nest = db.personer.find((p) => p.PersonID === gruppe.NestlederID);
    if (nest) byId.set(nest.PersonID, nest);
  }
  return Array.from(byId.values());
}
