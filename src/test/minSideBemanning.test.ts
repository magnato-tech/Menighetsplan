import "./polyfill";
import assert from "node:assert/strict";
import { hentSvarStatus, settDeltakelseForPerson, velgDatoForPerson } from "../services/bemanning";
import {
  byggGruppeSondagStatus,
  byggPersonligSondagsliste,
  byggPåmeldingsrader,
  hentKommendeForesporsler,
  meldForfall,
  svarPaForesporsel,
  togglePaamelding,
} from "../services/paamelding";
import type { DatabaseState, Rolle } from "../types/database";

const GUD_ID = "GUD001";
const GUD_DATO = "2026-09-06";

const lovsangRolle: Rolle = {
  RolleID: "R005",
  Rollenavn: "Lovsang",
  Beskrivelse: "",
  Aktiv: true,
  Behov: 2,
  GruppeID: "G001",
  OpprettetDato: "2026-01-01",
  SistEndret: "2026-01-01",
};

const kjokkenRolle: Rolle = {
  RolleID: "R010",
  Rollenavn: "Kjøkken",
  Beskrivelse: "",
  Aktiv: true,
  Behov: 2,
  GruppeID: "G002",
  OpprettetDato: "2026-01-01",
  SistEndret: "2026-01-01",
};

function tomDb(overrides: Partial<DatabaseState> = {}): DatabaseState {
  return {
    gruppetyper: [
      {
        GruppetypeID: "GT001",
        Navn: "Tjenestegruppe",
        Beskrivelse: "",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    personer: [
      {
        PersonID: "P010",
        Navn: "Ingrid Medlem",
        Fornavn: "Ingrid",
        Etternavn: "Medlem",
        Epost: "",
        Telefon: "",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        PersonID: "P011",
        Navn: "Ola Peer",
        Fornavn: "Ola",
        Etternavn: "Peer",
        Epost: "",
        Telefon: "",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        PersonID: "P015",
        Navn: "Kari Kjøkken",
        Fornavn: "Kari",
        Etternavn: "Kjøkken",
        Epost: "",
        Telefon: "",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        PersonID: "P020",
        Navn: "Utenfor Gruppe",
        Fornavn: "Utenfor",
        Etternavn: "Gruppe",
        Epost: "",
        Telefon: "",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    grupper: [
      {
        GruppeID: "G001",
        Gruppenavn: "Lovsang",
        GruppetypeID: "GT001",
        Beskrivelse: "",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        GruppeID: "G002",
        Gruppenavn: "Kjøkken",
        GruppetypeID: "GT001",
        Beskrivelse: "",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    gruppemedlemmer: [
      {
        GruppeMedlemID: "GM1",
        GruppeID: "G001",
        PersonID: "P010",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        GruppeMedlemID: "GM2",
        GruppeID: "G001",
        PersonID: "P011",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        GruppeMedlemID: "GM3",
        GruppeID: "G002",
        PersonID: "P015",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    roller: [lovsangRolle, kjokkenRolle],
    personroller: [
      {
        PersonRolleID: "PR1",
        PersonID: "P010",
        RolleID: "R005",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        PersonRolleID: "PR2",
        PersonID: "P011",
        RolleID: "R005",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        PersonRolleID: "PR3",
        PersonID: "P015",
        RolleID: "R010",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    rollebeskrivelser: [],
    gudstjenester: [
      {
        GudstjenesteID: GUD_ID,
        Dato: GUD_DATO,
        Tid: "11:00",
        Tema: "Test",
        Sted: "Bedehuset",
      },
    ],
    tjenestebehov: [],
    tildelinger: [],
    svar: [],
    malaktiviteter: [],
    maler: [],
    malposter: [],
    malTilleggsvakter: [],
    programaktiviteter: [],
    programinstanser: [],
    arrangementer: [],
    kalenderoppgaver: [],
    gruppeMeldinger: [],
    personerImport: [],
    gudstjenesterImport: [],
    rollebeskrivelseImport: [],
    ...overrides,
  };
}

function finnMinRad(db: DatabaseState, personId: string, rolleId: string) {
  const liste = byggPersonligSondagsliste(db, personId);
  const sondag = liste.find((s) => s.gudstjeneste.GudstjenesteID === GUD_ID);
  return sondag?.roller.find((r) => r.rolle.RolleID === rolleId);
}

function reload(db: DatabaseState): DatabaseState {
  return JSON.parse(JSON.stringify(db)) as DatabaseState;
}

{
  const db = settDeltakelseForPerson(tomDb(), "P010", GUD_ID, "R005", "Avventer");
  const rad = finnMinRad(db, "P010", "R005");
  assert.equal(rad?.status, "min-venter");
}

{
  const db = settDeltakelseForPerson(tomDb(), "P010", GUD_ID, "R010", "Avventer");
  const rad = finnMinRad(db, "P010", "R010");
  assert.ok(rad, "forespørsel uten huket rolle skal synes");
  assert.equal(rad?.status, "min-venter");
}

{
  const db = settDeltakelseForPerson(tomDb(), "P020", GUD_ID, "R005", "Avventer");
  const rad = finnMinRad(db, "P020", "R005");
  assert.ok(rad, "forespørsel utenfor gruppe skal synes");
  assert.equal(rad?.status, "min-venter");
  assert.equal(hentKommendeForesporsler(db, "P020").length, 1);
}

{
  let db = settDeltakelseForPerson(tomDb(), "P010", GUD_ID, "R005", "Avventer");
  db = svarPaForesporsel(db, "P010", GUD_ID, "R005", "Bekreftet")!;
  const t = db.tildelinger.find(
    (x) => x.GudstjenesteID === GUD_ID && x.RolleID === "R005" && x.PersonID === "P010"
  );
  assert.equal(hentSvarStatus(db, t!.TildelingID), "Bekreftet");
}

{
  let db = settDeltakelseForPerson(tomDb(), "P010", GUD_ID, "R005", "Avventer");
  db = svarPaForesporsel(db, "P010", GUD_ID, "R005", "Avvist")!;
  const t = db.tildelinger.find(
    (x) => x.GudstjenesteID === GUD_ID && x.RolleID === "R005" && x.PersonID === "P010"
  );
  assert.equal(hentSvarStatus(db, t!.TildelingID), "Avvist");
}

{
  let db = settDeltakelseForPerson(tomDb(), "P010", GUD_ID, "R005", "Deltar");
  db = meldForfall(db, "P010", GUD_ID, "R005", "Kan ikke denne søndagen")!;
  const t = db.tildelinger.find(
    (x) => x.GudstjenesteID === GUD_ID && x.RolleID === "R005" && x.PersonID === "P010"
  );
  assert.equal(hentSvarStatus(db, t!.TildelingID), "Avvist");
  assert.equal(db.gruppeMeldinger?.length, 1);
  assert.match(db.gruppeMeldinger![0].Tekst, /Lovsang/i);
}

{
  let db = settDeltakelseForPerson(tomDb(), "P010", GUD_ID, "R005", "Deltar");
  db = meldForfall(db, "P010", GUD_ID, "R005")!;
  const rad = byggPåmeldingsrader(db, "P011", lovsangRolle)[0];
  const forfall = rad.personerPå.find((p) => p.personId === "P010");
  assert.equal(forfall?.status, "Avvist");
  const gruppe = byggGruppeSondagStatus(db, "P011", GUD_ID);
  assert.ok(gruppe.some((g) => g.roller.some((r) => r.forfall >= 1)));
}

{
  let db = settDeltakelseForPerson(tomDb(), "P010", GUD_ID, "R010", "Deltar");
  db = meldForfall(db, "P010", GUD_ID, "R010")!;
  db = togglePaamelding(db, "P015", GUD_ID, "R010", true)!;
  const t = db.tildelinger.find(
    (x) => x.GudstjenesteID === GUD_ID && x.RolleID === "R010" && x.PersonID === "P015"
  );
  assert.ok(t);
  assert.equal(hentSvarStatus(db, t!.TildelingID), "Bekreftet");
}

{
  let db = settDeltakelseForPerson(tomDb(), "P010", GUD_ID, "R005", "Avventer");
  db = svarPaForesporsel(db, "P010", GUD_ID, "R005", "Bekreftet", "Ja takk")!;
  const roundtrip = reload(db);
  const t = roundtrip.tildelinger.find(
    (x) => x.GudstjenesteID === GUD_ID && x.RolleID === "R005" && x.PersonID === "P010"
  );
  assert.equal(hentSvarStatus(roundtrip, t!.TildelingID), "Bekreftet");
  assert.equal(finnMinRad(roundtrip, "P010", "R005")?.status, "min-bekreftet");
}

{
  const db = tomDb();
  const result = velgDatoForPerson(db, "P010", GUD_ID, "R010");
  assert.equal(result.success, false);
}

console.log("minSideBemanning.test.ts: ok");
