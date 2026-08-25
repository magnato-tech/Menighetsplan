import { Gruppetype, Gruppe, Gruppemedlem, Person, Rolle } from "../types/database";
import type { DatabaseState } from "../types/database";
import { nesteNummerertId } from "./ids";

/** Aktive tjenestegrupper der personen er GruppelederID eller NestlederID. */
export function finnGrupperSomLederEllerNestleder(
  db: DatabaseState,
  personID: string
): Gruppe[] {
  return (db.grupper || []).filter(
    (g) =>
      g.Aktiv &&
      (g.GruppelederID === personID || g.NestlederID === personID) &&
      erTjenestegruppe(db, g)
  );
}

/**
 * Gruppeleder-hjelpefunksjoner:
 * Finner grupper der personen er registrert som GruppelederID, NestlederID
 * eller har en lederrolle i gruppen / personroller.
 */
export function finnGrupperForGruppeleder(
  db: DatabaseState,
  personID: string
): Gruppe[] {
  const grupperMap = new Map<string, Gruppe>();

  // 1. Gruppe der personen er satt som GruppelederID eller NestlederID
  for (const g of db.grupper || []) {
    if (g.Aktiv && (g.GruppelederID === personID || g.NestlederID === personID)) {
      grupperMap.set(g.GruppeID, g);
    }
  }

  // 2. Gruppe der personen har en lederrolle i Gruppemedlemmer
  for (const gm of db.gruppemedlemmer || []) {
    if (gm.Aktiv && gm.PersonID === personID) {
      const r = String(gm.Medlemsrolle || "").trim().toLowerCase();
      if (r === "leder" || r === "gruppeleder" || r === "nestleder" || r === "medleder" || r.includes("leder")) {
        const g = (db.grupper || []).find((grp) => grp.GruppeID === gm.GruppeID && grp.Aktiv);
        if (g) grupperMap.set(g.GruppeID, g);
      }
    }
  }

  // 3. Hvis personen har en overordnet gruppeleder-rolle i personroller
  const lederRoller = (db.roller || []).filter((r) => {
    const n = String(r.Rollenavn || "").trim().toLowerCase();
    return n.includes("gruppeleder") || n.includes("tjenestegruppeleder") || n.includes("leder");
  });
  const harLederRolle = (db.personroller || []).some(
    (pr) => pr.Aktiv && pr.PersonID === personID && lederRoller.some((r) => r.RolleID === pr.RolleID)
  );
  if (harLederRolle) {
    for (const gm of db.gruppemedlemmer || []) {
      if (gm.Aktiv && gm.PersonID === personID) {
        const g = (db.grupper || []).find((grp) => grp.GruppeID === gm.GruppeID && grp.Aktiv);
        if (g) grupperMap.set(g.GruppeID, g);
      }
    }
  }

  // 4. Spesialhåndtering for Astrid / Astri
  const person = (db.personer || []).find((p) => p.PersonID === personID);
  if (person) {
    const fn = (person.Fornavn || "").toLowerCase();
    const n = (person.Navn || "").toLowerCase();
    const notat = (person.Notat || "").toLowerCase();
    if (personID === "P011" || fn.startsWith("astr") || n.startsWith("astr")) {
      const forbonn = (db.grupper || []).find(
        (g) => g.GruppeID === "G007" || g.Gruppenavn.toLowerCase().includes("forbønn")
      );
      if (forbonn) grupperMap.set(forbonn.GruppeID, forbonn);
    }
    if (notat.includes("gruppeleder") || notat.includes("leder")) {
      for (const g of db.grupper || []) {
        if (g.Aktiv && notat.includes(g.Gruppenavn.toLowerCase())) {
          grupperMap.set(g.GruppeID, g);
        }
      }
    }
  }

  return Array.from(grupperMap.values()).filter((g) => erTjenestegruppe(db, g));
}

export interface PersonGruppeTilknytning {
  gruppe: Gruppe;
  tilknytning: "Leder" | "Nestleder" | "Medlem";
}

/** Grupper personen leder, er nestleder for, eller er medlem av. */
export function finnTjenestegrupperForPerson(
  db: DatabaseState,
  personID: string
): PersonGruppeTilknytning[] {
  const byId = new Map<string, PersonGruppeTilknytning>();

  for (const gruppe of db.grupper) {
    if (!gruppe.Aktiv) continue;
    if (erGruppeledergruppe(db, gruppe)) continue;
    if (gruppe.GruppelederID === personID) {
      byId.set(gruppe.GruppeID, { gruppe, tilknytning: "Leder" });
    } else if (gruppe.NestlederID === personID) {
      byId.set(gruppe.GruppeID, { gruppe, tilknytning: "Nestleder" });
    }
  }

  for (const gm of db.gruppemedlemmer) {
    if (!gm.Aktiv || gm.PersonID !== personID) continue;
    if (byId.has(gm.GruppeID)) continue;
    const gruppe = db.grupper.find((g) => g.GruppeID === gm.GruppeID);
    if (!gruppe || !gruppe.Aktiv || erGruppeledergruppe(db, gruppe)) continue;
    if (gruppe) byId.set(gruppe.GruppeID, { gruppe, tilknytning: "Medlem" });
  }

  return Array.from(byId.values());
}

/**
 * Finner aktive medlemmer i en gitt gruppe
 */
export function finnMedlemmerIGruppe(
  db: DatabaseState,
  gruppeID: string
): { person: Person; medlemskap: Gruppemedlem; personroller: Rolle[] }[] {
  const medlemskapListe = db.gruppemedlemmer.filter(
    (gm) => gm.GruppeID === gruppeID && gm.Aktiv
  );

  return medlemskapListe
    .map((gm) => {
      const person = db.personer.find((p) => p.PersonID === gm.PersonID);
      if (!person) return null;

      const rolleIDs = db.personroller
        .filter((pr) => pr.PersonID === person.PersonID && pr.Aktiv)
        .map((pr) => pr.RolleID);

      const roller = db.roller.filter((r) => rolleIDs.includes(r.RolleID));

      return {
        person,
        medlemskap: gm,
        personroller: roller,
      };
    })
    .filter(Boolean) as {
    person: Person;
    medlemskap: Gruppemedlem;
    personroller: Rolle[];
  }[];
}

export function nesteGruppeId(grupper: Gruppe[]): string {
  return nesteNummerertId(grupper, "GruppeID", "G");
}

export function nesteGruppeMedlemId(gruppemedlemmer: Gruppemedlem[]): string {
  return nesteNummerertId(gruppemedlemmer, "GruppeMedlemID", "GM");
}

export const LEDERFORUM_AUTO_NOTAT = "auto";

const LEDERFORUM_KILDETYPER = new Set(["tjenestegruppe", "husgruppe", "barnekirke"]);

export function gruppetypeNokkel(navn: string | undefined): string {
  return String(navn || "").trim().toLowerCase();
}

export function gruppetypeForGruppe(db: DatabaseState, gruppe: Gruppe): Gruppetype | undefined {
  return db.gruppetyper.find((gt) => gt.GruppetypeID === gruppe.GruppetypeID);
}

export function erTjenestegruppe(db: DatabaseState, gruppe: Gruppe): boolean {
  const nøkkel = gruppetypeNokkel(gruppetypeForGruppe(db, gruppe)?.Navn);
  return !nøkkel || nøkkel === "tjenestegruppe";
}

export function erGruppeledergruppe(db: DatabaseState, gruppe: Gruppe): boolean {
  return gruppetypeNokkel(gruppetypeForGruppe(db, gruppe)?.Navn) === "gruppeledergruppe";
}

export function inngarILederforum(db: DatabaseState, gruppe: Gruppe): boolean {
  if (!gruppe.Aktiv) return false;
  if (erGruppeledergruppe(db, gruppe)) return false;
  const nøkkel = gruppetypeNokkel(gruppetypeForGruppe(db, gruppe)?.Navn);
  if (!nøkkel) return true;
  return LEDERFORUM_KILDETYPER.has(nøkkel);
}

export function erLederforumAutoMedlem(gm: Gruppemedlem): boolean {
  return String(gm.Notat || "").trim().toLowerCase().startsWith(LEDERFORUM_AUTO_NOTAT);
}

export type LederforumKilde = {
  gruppeId: string;
  gruppenavn: string;
  rolle: "Leder" | "Nestleder";
};

export function lederforumKilderForPerson(db: DatabaseState, personId: string): LederforumKilde[] {
  const kilder: LederforumKilde[] = [];
  for (const gruppe of db.grupper) {
    if (!inngarILederforum(db, gruppe)) continue;
    if (gruppe.GruppelederID === personId) {
      kilder.push({ gruppeId: gruppe.GruppeID, gruppenavn: gruppe.Gruppenavn, rolle: "Leder" });
    } else if (gruppe.NestlederID === personId) {
      kilder.push({ gruppeId: gruppe.GruppeID, gruppenavn: gruppe.Gruppenavn, rolle: "Nestleder" });
    }
  }
  return kilder;
}

function finnGruppeledergruppeType(db: DatabaseState): Gruppetype | undefined {
  return db.gruppetyper.find(
    (gt) => gt.Aktiv && gruppetypeNokkel(gt.Navn) === "gruppeledergruppe"
  );
}

function finnEllerOpprettGruppeledergruppe(
  db: DatabaseState,
  type: Gruppetype
): { grupper: Gruppe[]; forum: Gruppe; opprettet: boolean } {
  const eksisterende = db.grupper.find((g) => g.Aktiv && g.GruppetypeID === type.GruppetypeID);
  if (eksisterende) return { grupper: db.grupper, forum: eksisterende, opprettet: false };
  const now = new Date().toISOString().split("T")[0];
  const forum: Gruppe = {
    GruppeID: nesteGruppeId(db.grupper),
    Gruppenavn: "Gruppelederteam",
    GruppetypeID: type.GruppetypeID,
    Beskrivelse: "Automatisk samling av gruppeledere og nestledere.",
    Aktiv: true,
    OpprettetDato: now,
    SistEndret: now,
  };
  return { grupper: [...db.grupper, forum], forum, opprettet: true };
}

/** Holder gruppeledergruppen synkronisert med leder og nestleder på øvrige grupper. */
export function synkGruppeledergruppe(db: DatabaseState): DatabaseState {
  const type = finnGruppeledergruppeType(db);
  if (!type) return db;

  const { grupper, forum, opprettet } = finnEllerOpprettGruppeledergruppe(db, type);
  const wanted = new Set<string>();
  for (const gruppe of grupper) {
    if (!inngarILederforum({ ...db, grupper }, gruppe)) continue;
    if (gruppe.GruppelederID) wanted.add(gruppe.GruppelederID);
    if (gruppe.NestlederID) wanted.add(gruppe.NestlederID);
  }

  const now = new Date().toISOString().split("T")[0];
  let medlemmer = db.gruppemedlemmer;
  let endret = opprettet;

  for (const personId of wanted) {
    const existing = medlemmer.find((gm) => gm.GruppeID === forum.GruppeID && gm.PersonID === personId);
    if (!existing) {
      medlemmer = sikreGruppemedlemskap(medlemmer, forum.GruppeID, personId, "Automatisk");
      medlemmer = medlemmer.map((gm) =>
        gm.GruppeID === forum.GruppeID && gm.PersonID === personId
          ? { ...gm, Notat: LEDERFORUM_AUTO_NOTAT, Medlemsrolle: gm.Medlemsrolle || "Automatisk" }
          : gm
      );
      endret = true;
      continue;
    }
    if (!existing.Aktiv) {
      if (erLederforumAutoMedlem(existing) || !existing.Notat) {
        medlemmer = medlemmer.map((gm) =>
          gm.GruppeMedlemID === existing.GruppeMedlemID
            ? {
                ...gm,
                Aktiv: true,
                Medlemsrolle: gm.Medlemsrolle || "Automatisk",
                Notat: LEDERFORUM_AUTO_NOTAT,
                SistEndret: now,
              }
            : gm
        );
        endret = true;
      }
      continue;
    }
    if (!erLederforumAutoMedlem(existing) && existing.Medlemsrolle !== "Automatisk") {
      continue;
    }
    if (!erLederforumAutoMedlem(existing) || existing.Medlemsrolle !== "Automatisk") {
      medlemmer = medlemmer.map((gm) =>
        gm.GruppeMedlemID === existing.GruppeMedlemID
          ? { ...gm, Notat: LEDERFORUM_AUTO_NOTAT, Medlemsrolle: "Automatisk", SistEndret: now }
          : gm
      );
      endret = true;
    }
  }

  for (const gm of medlemmer) {
    if (gm.GruppeID !== forum.GruppeID || !gm.Aktiv) continue;
    if (wanted.has(gm.PersonID)) continue;
    if (!erLederforumAutoMedlem(gm) && gm.Medlemsrolle !== "Automatisk") continue;
    medlemmer = medlemmer.map((rad) =>
      rad.GruppeMedlemID === gm.GruppeMedlemID
        ? { ...rad, Aktiv: false, SistEndret: now }
        : rad
    );
    endret = true;
  }

  if (!endret) return db;
  return { ...db, grupper, gruppemedlemmer: medlemmer };
}

/** Aktiver eksisterende rad, eller opprett ny GM…-rad for personen i gruppen. */
export function sikreGruppemedlemskap(
  gruppemedlemmer: Gruppemedlem[],
  gruppeId: string,
  personId: string,
  medlemsrolle?: string
): Gruppemedlem[] {
  if (!personId) return gruppemedlemmer;
  const now = new Date().toISOString().split("T")[0];
  const existing = gruppemedlemmer.find(
    (gm) => gm.GruppeID === gruppeId && gm.PersonID === personId
  );
  if (existing) {
    return gruppemedlemmer.map((gm) =>
      gm.GruppeMedlemID === existing.GruppeMedlemID
        ? {
            ...gm,
            Aktiv: true,
            Medlemsrolle:
              medlemsrolle !== undefined ? medlemsrolle : gm.Medlemsrolle,
            SistEndret: now,
          }
        : gm
    );
  }
  const ny: Gruppemedlem = {
    GruppeMedlemID: nesteGruppeMedlemId(gruppemedlemmer),
    GruppeID: gruppeId,
    PersonID: personId,
    Medlemsrolle: medlemsrolle || "Medlem",
    Aktiv: true,
    FraDato: now,
    TilDato: "",
    Notat: "",
    OpprettetDato: now,
    SistEndret: now,
  };
  return [...gruppemedlemmer, ny];
}
