import type { DatabaseState, Person, SamlingOppmote } from "../types/database";
import { nesteNummerertId } from "./ids";
import { opprettPersonIRegister } from "./bemanning";
import { sikreGruppemedlemskap } from "./grupper";
import { forrigeArrangementForGruppe, iDagIso } from "./gruppeArrangementer";
import { hentSvarStatus } from "./bemanning";

export type OppfolgingsSignal = {
  personId: string;
  navn: string;
  type: "ny" | "mangler-lenke" | "ingen-kommende" | "mangler-oppmote";
  beskrivelse: string;
};

export function erNyPerson(person: Person): boolean {
  return person.PersonStatus === "ny";
}

export function opprettNyPersonFraGruppeleder(
  db: DatabaseState,
  navn: string,
  gruppeId: string
): DatabaseState {
  const medPerson = opprettPersonIRegister(db, { Navn: navn });
  const now = new Date().toISOString().split("T")[0];
  const nyId = medPerson.personer[medPerson.personer.length - 1]?.PersonID;
  if (!nyId) return medPerson;

  const personer = medPerson.personer.map((p) =>
    p.PersonID === nyId
      ? {
          ...p,
          PersonStatus: "ny" as const,
          Notat: [p.Notat, "Opprettet av gruppeleder — venter på admin."].filter(Boolean).join(" "),
          SistEndret: now,
        }
      : p
  );

  return {
    ...medPerson,
    personer,
    gruppemedlemmer: sikreGruppemedlemskap(medPerson.gruppemedlemmer, gruppeId, nyId, "Medlem"),
  };
}

export function hentOppmoteForSamling(
  db: DatabaseState,
  arrangementId: string
): SamlingOppmote[] {
  return (db.samlingoppmote || []).filter((o) => o.ArrangementID === arrangementId);
}

export function settSamlingOppmote(
  db: DatabaseState,
  arrangementId: string,
  gruppeId: string,
  personId: string,
  tilstede: boolean
): DatabaseState {
  const now = new Date().toISOString().split("T")[0];
  const eksisterende = (db.samlingoppmote || []).find(
    (o) => o.ArrangementID === arrangementId && o.PersonID === personId
  );

  if (eksisterende) {
    return {
      ...db,
      samlingoppmote: (db.samlingoppmote || []).map((o) =>
        o.SamlingOppmoteID === eksisterende.SamlingOppmoteID
          ? { ...o, Tilstede: tilstede, SistEndret: now }
          : o
      ),
    };
  }

  const ny: SamlingOppmote = {
    SamlingOppmoteID: nesteNummerertId(db.samlingoppmote || [], "SamlingOppmoteID", "SO"),
    ArrangementID: arrangementId,
    GruppeID: gruppeId,
    PersonID: personId,
    Tilstede: tilstede,
    OpprettetDato: now,
    SistEndret: now,
  };

  return {
    ...db,
    samlingoppmote: [...(db.samlingoppmote || []), ny],
  };
}

function manglerKommendeTjeneste(
  db: DatabaseState,
  personId: string,
  rolleIds: string[]
): boolean {
  if (rolleIds.length === 0) return false;
  const iDag = iDagIso();
  return !db.gudstjenester
    .filter((g) => g.Dato >= iDag)
    .some((gud) =>
      db.tildelinger.some(
        (t) =>
          t.GudstjenesteID === gud.GudstjenesteID &&
          t.PersonID === personId &&
          rolleIds.includes(t.RolleID) &&
          hentSvarStatus(db, t.TildelingID) !== "Avvist"
      )
    );
}

function manglerOppmoteSisteSamling(
  db: DatabaseState,
  gruppeId: string,
  personId: string
): boolean {
  const siste = forrigeArrangementForGruppe(db, gruppeId);
  if (!siste) return false;
  const oppmote = hentOppmoteForSamling(db, siste.ArrangementID);
  if (oppmote.length === 0) return false;
  const rad = oppmote.find((o) => o.PersonID === personId);
  return !rad || !rad.Tilstede;
}

export function oppfølgingsSignaler(
  db: DatabaseState,
  gruppeId: string,
  medlemmer: Person[],
  rolleIds: string[] = []
): OppfolgingsSignal[] {
  const signaler: OppfolgingsSignal[] = [];

  for (const m of medlemmer) {
    if (erNyPerson(m)) {
      signaler.push({
        personId: m.PersonID,
        navn: m.Navn,
        type: "ny",
        beskrivelse: "Ny i registeret — venter på admin",
      });
      continue;
    }
    if (!String(m.SikkerhetsToken || "").trim()) {
      signaler.push({
        personId: m.PersonID,
        navn: m.Navn,
        type: "mangler-lenke",
        beskrivelse: "Mangler personlenke — send Min side-lenken",
      });
    }
    if (rolleIds.length > 0 && manglerKommendeTjeneste(db, m.PersonID, rolleIds)) {
      signaler.push({
        personId: m.PersonID,
        navn: m.Navn,
        type: "ingen-kommende",
        beskrivelse: "Ingen kommende gudstjeneste i gruppen",
      });
    } else if (rolleIds.length === 0 && manglerOppmoteSisteSamling(db, gruppeId, m.PersonID)) {
      signaler.push({
        personId: m.PersonID,
        navn: m.Navn,
        type: "mangler-oppmote",
        beskrivelse: "Ikke registrert på forrige samling",
      });
    }
  }

  return signaler;
}

export function epostListe(medlemmer: Person[]): string[] {
  return medlemmer
    .map((p) => String(p.Epost || "").trim())
    .filter(Boolean);
}

export function mailtoGruppe(medlemmer: Person[], emne = "Fra gruppeleder"): string {
  const eposter = epostListe(medlemmer);
  if (eposter.length === 0) return "";
  return `mailto:?bcc=${encodeURIComponent(eposter.join(","))}&subject=${encodeURIComponent(emne)}`;
}

export function navnelisteTekst(medlemmer: Person[]): string {
  return medlemmer
    .slice()
    .sort((a, b) => a.Navn.localeCompare(b.Navn, "nb"))
    .map((p) => p.Navn)
    .join("\n");
}
