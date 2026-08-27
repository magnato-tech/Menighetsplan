import type {
  DatabaseState,
  GudstjenesterImport,
  Person,
  PersonerImport,
  RollebeskrivelseImport,
} from "../types/database";

/** Samme kolonner som Gudstjenester_import (F–Q). */
export const IMPORT_ROLLE_KOLONNER: { col: keyof GudstjenesterImport; rolleId: string }[] = [
  { col: "Leder", rolleId: "R001" },
  { col: "Taler", rolleId: "R002" },
  { col: "Forbønn", rolleId: "R003" },
  { col: "Barnekirke", rolleId: "R004" },
  { col: "Lovsang", rolleId: "R005" },
  { col: "Lyd", rolleId: "R006" },
  { col: "Bilde", rolleId: "R007" },
  { col: "Møtevert", rolleId: "R008" },
  { col: "Rigging", rolleId: "R009" },
  { col: "Kjøkken", rolleId: "R010" },
  { col: "Baking", rolleId: "R011" },
  { col: "Pynting", rolleId: "R012" },
];

function visningsnavn(db: DatabaseState, personId: string, eksternNavn?: string): string {
  const ekstern = String(eksternNavn || "").trim();
  if (ekstern) return ekstern;
  const p = db.personer.find((x) => x.PersonID === personId);
  return String(p?.Navn || "").trim();
}

function tjenesteomraderForPerson(db: DatabaseState, person: Person): string[] {
  const ids = (db.personroller || [])
    .filter((pr) => pr.PersonID === person.PersonID && pr.Aktiv !== false)
    .map((pr) => pr.RolleID);
  const navn: string[] = [];
  for (const rolle of db.roller || []) {
    if (!ids.includes(rolle.RolleID) || rolle.Aktiv === false) continue;
    if (rolle.Rollenavn && !navn.includes(rolle.Rollenavn)) navn.push(rolle.Rollenavn);
    if (navn.length >= 5) break;
  }
  return navn;
}

export function personerTilImport(db: DatabaseState): PersonerImport[] {
  return (db.personer || []).map((p) => {
    const omr = tjenesteomraderForPerson(db, p);
    return {
      PersonID: p.PersonID,
      Navn: p.Navn,
      Epost: p.Epost || "",
      Telefon: p.Telefon || "",
      Tjenesteområde1: omr[0] || "",
      Tjenesteområde2: omr[1] || "",
      Tjenesteområde3: omr[2] || "",
      Tjenesteområde4: omr[3] || "",
      Tjenesteområde5: omr[4] || "",
      Aktiv: p.Aktiv !== false,
    };
  });
}

function navnForRolle(db: DatabaseState, gudstjenesteId: string, rolleId: string): string {
  const navn = (db.tildelinger || [])
    .filter((t) => t.GudstjenesteID === gudstjenesteId && t.RolleID === rolleId && !t.ArrangementID)
    .map((t) => visningsnavn(db, t.PersonID, t.EksternNavn))
    .filter(Boolean);
  return [...new Set(navn)].join(", ");
}

export function gudstjenesterTilImport(db: DatabaseState): GudstjenesterImport[] {
  return (db.gudstjenester || []).map((g) => {
    const rad: GudstjenesterImport = {
      GudstjenesteID: g.GudstjenesteID,
      Dato: g.Dato,
      Tid: g.Tid,
      Sted: g.Sted || "",
      Tema: g.Tema || "",
      Bibeltekst: g.Bibeltekst || "",
      Kollekt: g.Kollekt || "",
      Merknad: g.Merknad || "",
    };
    for (const k of IMPORT_ROLLE_KOLONNER) {
      rad[k.col] = navnForRolle(db, g.GudstjenesteID, k.rolleId);
    }
    return rad;
  });
}

export function rollebeskrivelserTilImport(db: DatabaseState): RollebeskrivelseImport[] {
  return (db.roller || []).map((r) => {
    const tekst = db.rollebeskrivelser.find((rb) => rb.RolleID === r.RolleID);
    return {
      RolleID: r.RolleID,
      Rollenavn: r.Rollenavn,
      FullBeskrivelse: tekst?.Rollebeskrivelse || r.Beskrivelse || "",
      SjekklisteGammel: "",
    };
  });
}

export function byggImportBackup(db: DatabaseState): {
  personerImport: PersonerImport[];
  gudstjenesterImport: GudstjenesterImport[];
  rollebeskrivelseImport: RollebeskrivelseImport[];
} {
  return {
    personerImport: personerTilImport(db),
    gudstjenesterImport: gudstjenesterTilImport(db),
    rollebeskrivelseImport: rollebeskrivelserTilImport(db),
  };
}
