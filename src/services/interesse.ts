import { Gruppe, Personrolle, Rolle } from "../types/database";
import type { DatabaseState } from "../types/database";
import { nesteNummerertId } from "./ids";
import { erTjenestegruppe, sikreGruppemedlemskap } from "./grupper";
import { saveDatabase } from "./persistens";

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

export function bekreftelseKonsekvensTekst(nyeGruppeantall: number): string {
  if (nyeGruppeantall <= 1) {
    return "Nye oppgaver plasserer deg i tilhørende tjenestegruppe. Du kan nå velge oppgaver fra denne tjenestegruppen.";
  }
  return "Nye oppgaver plasserer deg i tilhørende tjenestegrupper. Du kan nå velge oppgaver i disse tjenestegruppene.";
}

export function settPersonroller(
  db: DatabaseState,
  personId: string,
  rolleIds: string[]
): DatabaseState {
  const now = iDag();
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

  const updatedDb: DatabaseState = { ...db, personroller, gruppemedlemmer };
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
 * Roller personen kan melde seg på: kun oppgaver i tjenestegrupper
 * vedkommende er medlem (eller leder/nestleder) av.
 */
export function hentPåmeldingsRoller(db: DatabaseState, personId: string): Rolle[] {
  return tjenesteRoller(db)
    .filter((rolle) => Boolean(rolle.GruppeID) && erMedlemAvGruppe(db, personId, rolle.GruppeID))
    .sort((a, b) => a.Rollenavn.localeCompare(b.Rollenavn, "nb"));
}
