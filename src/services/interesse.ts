import { Gruppe, Personrolle, Rolle, Svar } from "../types/database";
import type { DatabaseState } from "../types/database";
import { nesteNummerertId } from "./ids";
import {
  erGruppeledergruppe,
  erObligatoriskIGruppelederteam,
  erTjenestegruppe,
  finnTjenestegrupperForPerson,
  sikreGruppemedlemskap,
} from "./grupper";
import { saveDatabase } from "./persistens";

const AVLYST_UTMELDING = "Gått ut av tjenestegruppe";

export type RolleEndringLinje = {
  rolleId: string;
  rollenavn: string;
  gruppenavn: string;
  gruppeId: string;
};

export type RolleEndringOppsummering = {
  lagtTil: RolleEndringLinje[];
  fjernet: RolleEndringLinje[];
  forlaterGrupper: { gruppeId: string; gruppenavn: string }[];
};

function iDag(): string {
  return new Date().toISOString().split("T")[0];
}

export function erLederEllerNestlederIGruppe(
  db: DatabaseState,
  personId: string,
  gruppeId: string
): boolean {
  const gruppe = db.grupper.find((g) => g.GruppeID === gruppeId);
  if (!gruppe) return false;
  return gruppe.GruppelederID === personId || gruppe.NestlederID === personId;
}

export function erMedlemAvGruppe(db: DatabaseState, personId: string, gruppeId: string): boolean {
  if (erLederEllerNestlederIGruppe(db, personId, gruppeId)) return true;
  return (db.gruppemedlemmer || []).some(
    (gm) => gm.Aktiv && gm.PersonID === personId && gm.GruppeID === gruppeId
  );
}

/** Aktivt medlem (eller leder/nestleder) i minst én tjenestegruppe. Husgruppe teller ikke. */
export function erMedITjenestegruppe(db: DatabaseState, personId: string): boolean {
  for (const gruppe of db.grupper || []) {
    if (!gruppe.Aktiv || !erTjenestegruppe(db, gruppe)) continue;
    if (erMedlemAvGruppe(db, personId, gruppe.GruppeID)) return true;
  }
  return false;
}

export function tjenesteRoller(db: DatabaseState): Rolle[] {
  return (db.roller || []).filter((r) => {
    if (!r.Aktiv || !r.GruppeID) return false;
    const gruppe = db.grupper.find((g) => g.GruppeID === r.GruppeID);
    return !!gruppe?.Aktiv && erTjenestegruppe(db, gruppe);
  });
}

export type TjenesteRolleGruppe = { gruppe: Gruppe; roller: Rolle[] };

export function tjenesteRollerGruppert(db: DatabaseState): TjenesteRolleGruppe[] {
  const byId = new Map<string, TjenesteRolleGruppe>();
  for (const rolle of tjenesteRoller(db)) {
    const gruppe = db.grupper.find((g) => g.GruppeID === rolle.GruppeID);
    if (!gruppe) continue;
    const eksisterende = byId.get(gruppe.GruppeID);
    if (eksisterende) {
      eksisterende.roller.push(rolle);
    } else {
      byId.set(gruppe.GruppeID, { gruppe, roller: [rolle] });
    }
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.gruppe.Gruppenavn.localeCompare(b.gruppe.Gruppenavn, "nb")
  );
}

export function aktiveTjenesteRolleIds(db: DatabaseState, personId: string): string[] {
  const tillatte = new Set(tjenesteRoller(db).map((r) => r.RolleID));
  return (db.personroller || [])
    .filter((pr) => pr.PersonID === personId && pr.Aktiv && tillatte.has(pr.RolleID))
    .map((pr) => pr.RolleID);
}

function linjeForRolle(db: DatabaseState, rolle: Rolle): RolleEndringLinje {
  const gruppe = rolle.GruppeID
    ? db.grupper.find((g) => g.GruppeID === rolle.GruppeID)
    : undefined;
  return {
    rolleId: rolle.RolleID,
    rollenavn: rolle.Rollenavn,
    gruppenavn: gruppe?.Gruppenavn || "",
    gruppeId: rolle.GruppeID || "",
  };
}

export function oppsummerRolleendring(
  db: DatabaseState,
  personId: string,
  nesteRolleIds: string[]
): RolleEndringOppsummering {
  const forrige = new Set(aktiveTjenesteRolleIds(db, personId));
  const neste = new Set(nesteRolleIds);
  const roller = tjenesteRoller(db);
  const lagtTil: RolleEndringLinje[] = [];
  const fjernet: RolleEndringLinje[] = [];
  for (const rolle of roller) {
    const varMed = forrige.has(rolle.RolleID);
    const blirMed = neste.has(rolle.RolleID);
    if (!varMed && blirMed) lagtTil.push(linjeForRolle(db, rolle));
    if (varMed && !blirMed) fjernet.push(linjeForRolle(db, rolle));
  }

  const forlaterGrupper: { gruppeId: string; gruppenavn: string }[] = [];
  const grupper = new Set(
    roller.map((r) => r.GruppeID).filter((id): id is string => Boolean(id))
  );
  for (const gruppeId of grupper) {
    const harNeste = roller.some((r) => r.GruppeID === gruppeId && neste.has(r.RolleID));
    if (harNeste) continue;
    const haddeForrige = roller.some((r) => r.GruppeID === gruppeId && forrige.has(r.RolleID));
    if (!haddeForrige) continue;
    if (erLederEllerNestlederIGruppe(db, personId, gruppeId)) continue;
    if (!erMedlemAvGruppe(db, personId, gruppeId)) continue;
    const gruppe = db.grupper.find((g) => g.GruppeID === gruppeId);
    if (!gruppe) continue;
    forlaterGrupper.push({ gruppeId, gruppenavn: gruppe.Gruppenavn });
  }

  return { lagtTil, fjernet, forlaterGrupper };
}

function unikeNavn(navn: string[]): string[] {
  return [...new Set(navn.map((n) => n.trim()).filter(Boolean))];
}

function joinerNavn(navn: string[]): string {
  if (navn.length <= 1) return navn[0] || "";
  if (navn.length === 2) return `${navn[0]} og ${navn[1]}`;
  return `${navn.slice(0, -1).join(", ")} og ${navn[navn.length - 1]}`;
}

export type BekreftelseKonsekvens = {
  varMedITjenestegruppe: boolean;
  nyeGruppenavn: string[];
  forlaterGruppenavn: string[];
  blirMedITjenestegruppe: boolean;
};

export function bekreftelseKonsekvensTekst(input: BekreftelseKonsekvens): string {
  const nye = unikeNavn(input.nyeGruppenavn);
  const forlater = unikeNavn(input.forlaterGruppenavn);

  if (forlater.length > 0 && !input.blirMedITjenestegruppe) {
    return `Du går ut av ${joinerNavn(forlater)}. Du er da ikke med i noen tjenestegruppe. Kommende oppgaver i gruppen trekkes tilbake.`;
  }

  if (!input.varMedITjenestegruppe && nye.length > 0) {
    if (nye.length === 1) {
      return `Velkommen til ${nye[0]}. Nå kan du sette deg opp på oppgavene du har valgt i tjenestegruppen ${nye[0]}.`;
    }
    return `Velkommen til ${joinerNavn(nye)}. Nå kan du sette deg opp på oppgavene du har valgt i disse tjenestegruppene.`;
  }

  if (forlater.length > 0 && nye.length > 0) {
    const til =
      nye.length === 1 ? `tjenestegruppen ${nye[0]}` : "disse tjenestegruppene";
    return `Du bytter fra ${joinerNavn(forlater)} til ${joinerNavn(nye)}. Kommende oppgaver i ${joinerNavn(forlater)} trekkes tilbake. Nå kan du sette deg opp på oppgavene du har valgt i ${til}.`;
  }

  if (nye.length > 0) {
    const til =
      nye.length === 1 ? `tjenestegruppen ${nye[0]}` : "disse tjenestegruppene";
    return `Du blir med i ${joinerNavn(nye)}. Nå kan du sette deg opp på oppgavene du har valgt i ${til}.`;
  }

  if (forlater.length > 0) {
    return `Du går ut av ${joinerNavn(forlater)}. Kommende oppgaver i gruppen trekkes tilbake.`;
  }

  return "";
}

function svarForTildeling(db: DatabaseState, tildelingId: string): string {
  return db.svar.find((s) => s.TildelingID === tildelingId)?.Svar || "Venter";
}

/** Kommende tildelinger for gitte roller settes til Avvist. Lagrer ikke selv. */
export function avlysKommendeTildelingerForRoller(
  db: DatabaseState,
  personId: string,
  rolleIds: string[],
  kommentar = AVLYST_UTMELDING
): DatabaseState {
  const trekk = new Set(rolleIds.filter(Boolean));
  if (trekk.size === 0) return db;
  const iDagStr = iDag();
  const kommendeGud = new Set(
    (db.gudstjenester || [])
      .filter((g) => String(g.Dato || "") >= iDagStr)
      .map((g) => g.GudstjenesteID)
  );
  const berorte = (db.tildelinger || []).filter(
    (t) =>
      t.PersonID === personId &&
      trekk.has(t.RolleID) &&
      kommendeGud.has(t.GudstjenesteID) &&
      svarForTildeling(db, t.TildelingID) !== "Avvist"
  );
  if (berorte.length === 0) return db;

  let svar = [...(db.svar || [])];
  for (const t of berorte) {
    const idx = svar.findIndex((s) => s.TildelingID === t.TildelingID && s.PersonID === personId);
    if (idx >= 0) {
      svar[idx] = {
        ...svar[idx],
        Svar: "Avvist",
        Kommentar: kommentar,
        SvartDato: iDagStr,
      };
      continue;
    }
    const ny: Svar = {
      SvarID: nesteNummerertId(svar, "SvarID", "S"),
      TildelingID: t.TildelingID,
      PersonID: personId,
      Svar: "Avvist",
      Kommentar: kommentar,
      SvartDato: iDagStr,
    };
    svar = [...svar, ny];
  }
  return { ...db, svar };
}

export function avlysKommendeOppgaverIGruppe(
  db: DatabaseState,
  personId: string,
  gruppeId: string,
  kommentar = "Fjernet fra tjenestegruppe"
): DatabaseState {
  const rolleIds = tjenesteRoller(db)
    .filter((r) => r.GruppeID === gruppeId)
    .map((r) => r.RolleID);
  return avlysKommendeTildelingerForRoller(db, personId, rolleIds, kommentar);
}

function rolleIdsSomSkalAvlyses(
  db: DatabaseState,
  personId: string,
  nesteRolleIds: string[]
): string[] {
  const opps = oppsummerRolleendring(db, personId, nesteRolleIds);
  const ids = new Set(opps.fjernet.map((l) => l.rolleId));
  for (const gruppe of opps.forlaterGrupper) {
    for (const rolle of tjenesteRoller(db)) {
      if (rolle.GruppeID === gruppe.gruppeId) ids.add(rolle.RolleID);
    }
  }
  return Array.from(ids);
}

export function settPersonroller(
  db: DatabaseState,
  personId: string,
  rolleIds: string[]
): DatabaseState {
  const now = iDag();
  const avlysRolleIds = rolleIdsSomSkalAvlyses(db, personId, rolleIds);
  const valgte = new Set(rolleIds);
  const tjenesteIds = new Set(tjenesteRoller(db).map((r) => r.RolleID));
  let personroller = [...(db.personroller || [])];

  personroller = personroller.map((pr) => {
    if (pr.PersonID !== personId || !tjenesteIds.has(pr.RolleID)) return pr;
    const skalVæreAktiv = valgte.has(pr.RolleID);
    if (pr.Aktiv === skalVæreAktiv) return pr;
    return { ...pr, Aktiv: skalVæreAktiv, SistEndret: now };
  });

  for (const rolleId of valgte) {
    if (!tjenesteIds.has(rolleId)) continue;
    const eksisterende = personroller.find(
      (pr) => pr.PersonID === personId && pr.RolleID === rolleId
    );
    if (eksisterende) continue;
    const ny: Personrolle = {
      PersonRolleID: nesteNummerertId(personroller, "PersonRolleID", "PR"),
      PersonID: personId,
      RolleID: rolleId,
      Aktiv: true,
      FraDato: now,
      TilDato: "",
      Notat: "",
      OpprettetDato: now,
      SistEndret: now,
    };
    personroller = [...personroller, ny];
  }

  let gruppemedlemmer = [...(db.gruppemedlemmer || [])];
  const etterDb: DatabaseState = { ...db, personroller };
  const grupper = new Set(
    tjenesteRoller(etterDb)
      .map((r) => r.GruppeID)
      .filter((id): id is string => Boolean(id))
  );
  for (const gruppeId of grupper) {
    const harRolle = tjenesteRoller(etterDb).some(
      (r) =>
        r.GruppeID === gruppeId &&
        personroller.some(
          (pr) => pr.PersonID === personId && pr.RolleID === r.RolleID && pr.Aktiv
        )
    );
    if (harRolle) continue;
    if (erLederEllerNestlederIGruppe(db, personId, gruppeId)) continue;
    const gruppe = db.grupper.find((g) => g.GruppeID === gruppeId);
    if (gruppe && erGruppeledergruppe(db, gruppe) && erObligatoriskIGruppelederteam(db, personId)) {
      continue;
    }
    gruppemedlemmer = gruppemedlemmer.map((gm) =>
      gm.PersonID === personId && gm.GruppeID === gruppeId && gm.Aktiv
        ? { ...gm, Aktiv: false, SistEndret: now }
        : gm
    );
  }

  for (const rolle of tjenesteRoller(etterDb)) {
    if (!valgte.has(rolle.RolleID) || !rolle.GruppeID) continue;
    const gruppe = db.grupper.find((g) => g.GruppeID === rolle.GruppeID);
    if (!gruppe?.Aktiv || !erTjenestegruppe(db, gruppe)) continue;
    gruppemedlemmer = sikreGruppemedlemskap(gruppemedlemmer, rolle.GruppeID, personId, "Medlem");
  }

  const medMedlemskap: DatabaseState = { ...db, personroller, gruppemedlemmer };
  const updatedDb = avlysKommendeTildelingerForRoller(medMedlemskap, personId, avlysRolleIds);
  saveDatabase(updatedDb);
  return updatedDb;
}

export function grupperAFølge(
  db: DatabaseState,
  personId: string,
  rolleIds: string[]
): Gruppe[] {
  const valgte = new Set(rolleIds);
  const sett = new Map<string, Gruppe>();
  for (const rolle of tjenesteRoller(db)) {
    if (!valgte.has(rolle.RolleID) || !rolle.GruppeID) continue;
    if (erMedlemAvGruppe(db, personId, rolle.GruppeID)) continue;
    const gruppe = db.grupper.find((g) => g.GruppeID === rolle.GruppeID && g.Aktiv);
    if (!gruppe || !erTjenestegruppe(db, gruppe)) continue;
    sett.set(gruppe.GruppeID, gruppe);
  }
  return Array.from(sett.values()).sort((a, b) =>
    a.Gruppenavn.localeCompare(b.Gruppenavn, "nb")
  );
}

export type GruppeVelkomst = {
  gruppe: Gruppe;
  lederNavn: string | null;
};

export function velkomstForGrupper(db: DatabaseState, grupper: Gruppe[]): GruppeVelkomst[] {
  return grupper.map((gruppe) => {
    const leder = gruppe.GruppelederID
      ? db.personer.find((p) => p.PersonID === gruppe.GruppelederID)
      : undefined;
    const navn = leder?.Navn || leder?.Fornavn || null;
    return { gruppe, lederNavn: navn };
  });
}

/**
 * Roller personen kan sette seg opp på: kun oppgaver vedkommende har huket av,
 * og som fortsatt ligger i en tjenestegruppe hen er med i.
 * Medlemskap alene åpner ikke resten av gruppens oppgaver.
 */
export function hentPåmeldingsRoller(db: DatabaseState, personId: string): Rolle[] {
  const valgte = new Set(aktiveTjenesteRolleIds(db, personId));
  return tjenesteRoller(db)
    .filter(
      (rolle) =>
        valgte.has(rolle.RolleID) &&
        Boolean(rolle.GruppeID) &&
        erMedlemAvGruppe(db, personId, rolle.GruppeID)
    )
    .sort((a, b) => a.Rollenavn.localeCompare(b.Rollenavn, "nb"));
}

function visningsnavn(person: { Fornavn?: string; Navn?: string } | undefined): string | null {
  const navn = person?.Fornavn || person?.Navn || "";
  return navn.trim() || null;
}

export type MinGruppeKort = {
  gruppeId: string;
  gruppenavn: string;
  tilknytning: "Leder" | "Nestleder" | "Medlem";
  mineOppgaver: string[];
  lederNavn: string | null;
  nestlederNavn: string | null;
};

/** Tjeneste- og husgrupper personen er med i, med leder og hukede oppgaver. */
export function mineGrupperForPerson(db: DatabaseState, personId: string): MinGruppeKort[] {
  const valgte = new Set(aktiveTjenesteRolleIds(db, personId));
  return finnTjenestegrupperForPerson(db, personId)
    .map(({ gruppe, tilknytning }) => {
      const leder = gruppe.GruppelederID
        ? db.personer.find((p) => p.PersonID === gruppe.GruppelederID)
        : undefined;
      const nestleder = gruppe.NestlederID
        ? db.personer.find((p) => p.PersonID === gruppe.NestlederID)
        : undefined;
      const mineOppgaver = tjenesteRoller(db)
        .filter((r) => r.GruppeID === gruppe.GruppeID && valgte.has(r.RolleID))
        .map((r) => r.Rollenavn)
        .sort((a, b) => a.localeCompare(b, "nb"));
      return {
        gruppeId: gruppe.GruppeID,
        gruppenavn: gruppe.Gruppenavn,
        tilknytning,
        mineOppgaver,
        lederNavn: visningsnavn(leder),
        nestlederNavn: visningsnavn(nestleder),
      };
    })
    .sort((a, b) => a.gruppenavn.localeCompare(b.gruppenavn, "nb"));
}
