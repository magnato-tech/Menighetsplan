import "./polyfill";
import assert from "node:assert/strict";
import {
  byggPåmeldingsrader,
  byggPersonligMaanedsliste,
  byggPersonligSondagsliste,
  byggMaanedshorisont,
  erPaameldingValgt,
  grupperSondagerPerMaaned,
  kanPaameldingEndres,
  maanedErGjennomgaatt,
  nesteMaanedNokkel,
  antallGjenstaendeMaaneder,
  forsteUferdigeMaaned,
  forrigeMaanedNokkel,
  semesterFremdrift,
  sondagErBesvart,
  standardMaanedNokkel,
  velgMaanedNokkel,
  SEMESTER_HORISONT_MND,
} from "../services/paamelding";
import type { DatabaseState, Rolle } from "../types/database";

const kjokkenRolle: Rolle = {
  RolleID: "R010",
  Rollenavn: "Kjøkken",
  Beskrivelse: "",
  Aktiv: true,
  Behov: 2,
  GruppeID: "G006",
  OpprettetDato: "2026-01-01",
  SistEndret: "2026-01-01",
};

const talerRolle: Rolle = {
  RolleID: "R099",
  Rollenavn: "Taler",
  Beskrivelse: "",
  Aktiv: true,
  Behov: 1,
  GruppeID: "G006",
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
        Navn: "Solveig Test",
        Fornavn: "Solveig",
        Etternavn: "Test",
        Epost: "",
        Telefon: "",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        PersonID: "P020",
        Navn: "Grete Test",
        Fornavn: "Grete",
        Etternavn: "Test",
        Epost: "",
        Telefon: "",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    grupper: [
      {
        GruppeID: "G006",
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
        GruppeID: "G006",
        PersonID: "P010",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    roller: [kjokkenRolle, talerRolle],
    personroller: [
      {
        PersonRolleID: "PR1",
        PersonID: "P010",
        RolleID: "R010",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        PersonRolleID: "PR2",
        PersonID: "P010",
        RolleID: "R099",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    rollebeskrivelser: [],
    gudstjenester: [
      {
        GudstjenesteID: "GUD001",
        Dato: "2026-09-06",
        Tid: "11:00",
        Tema: "Test",
        Sted: "Bedehuset",
      },
    ],
    tjenestebehov: [],
    tildelinger: [
      {
        TildelingID: "T001",
        GudstjenesteID: "GUD001",
        RolleID: "R010",
        PersonID: "P020",
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        TildelingID: "T002",
        GudstjenesteID: "GUD001",
        RolleID: "R099",
        PersonID: "P020",
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    svar: [
      {
        SvarID: "S001",
        TildelingID: "T001",
        PersonID: "P020",
        Svar: "Bekreftet",
        Kommentar: "",
        SvartDato: "2026-01-01",
      },
      {
        SvarID: "S002",
        TildelingID: "T002",
        PersonID: "P020",
        Svar: "Bekreftet",
        Kommentar: "",
        SvartDato: "2026-01-01",
      },
    ],
    malaktiviteter: [],
    maler: [],
    malposter: [],
    malTilleggsvakter: [],
    programaktiviteter: [],
    programinstanser: [],
    arrangementer: [],
    kalenderoppgaver: [],
    personerImport: [],
    gudstjenesterImport: [],
    rollebeskrivelseImport: [],
    ...overrides,
  };
}

{
  const db = tomDb();
  const rader = byggPåmeldingsrader(db, "P010", kjokkenRolle);
  assert.equal(rader.length, 1);
  assert.equal(rader[0].status, "ledig");
  assert.equal(rader[0].bekreftetAntall, 1);
  assert.equal(rader[0].behov, 2);
}

{
  const db = tomDb();
  const liste = byggPersonligSondagsliste(db, "P010");
  assert.equal(liste.length, 1);
  assert.equal(liste[0].roller.length, 2);
  assert.deepEqual(
    liste[0].roller.map((r) => r.rolle.RolleID).sort(),
    ["R010", "R099"]
  );
}

{
  const db = tomDb();
  const filtrert = byggPersonligSondagsliste(db, "P010", "R010");
  assert.equal(filtrert.length, 1);
  assert.equal(filtrert[0].roller.length, 1);
  assert.equal(filtrert[0].roller[0].rolle.RolleID, "R010");
}

{
  const db = tomDb({
    tildelinger: [
      {
        TildelingID: "T010",
        GudstjenesteID: "GUD001",
        RolleID: "R010",
        PersonID: "P010",
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    svar: [
      {
        SvarID: "S010",
        TildelingID: "T010",
        PersonID: "P010",
        Svar: "Bekreftet",
        Kommentar: "",
        SvartDato: "2026-01-01",
      },
    ],
  });
  const rad = byggPåmeldingsrader(db, "P010", kjokkenRolle)[0];
  assert.equal(rad.status, "min-bekreftet");
}

{
  const db = tomDb({
    roller: [{ ...kjokkenRolle, Behov: 1 }],
    tildelinger: [
      {
        TildelingID: "T001",
        GudstjenesteID: "GUD001",
        RolleID: "R010",
        PersonID: "P020",
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    svar: [
      {
        SvarID: "S001",
        TildelingID: "T001",
        PersonID: "P020",
        Svar: "Bekreftet",
        Kommentar: "",
        SvartDato: "2026-01-01",
      },
    ],
  });
  const rad = byggPåmeldingsrader(db, "P010", { ...kjokkenRolle, Behov: 1 })[0];
  assert.equal(rad.status, "full");
}

{
  const db = tomDb();
  const rad = byggPåmeldingsrader(db, "P010", talerRolle)[0];
  assert.equal(rad.status, "stengt");
  assert.equal(rad.hardFull, true);
}

{
  assert.equal(erPaameldingValgt("min-bekreftet"), true);
  assert.equal(erPaameldingValgt("min-venter"), false);
  assert.equal(erPaameldingValgt("ledig"), false);
  assert.equal(kanPaameldingEndres("stengt"), false);
  assert.equal(kanPaameldingEndres("ledig"), true);
}

{
  const horisont = byggMaanedshorisont("2026-08", SEMESTER_HORISONT_MND);
  assert.equal(horisont.length, 6);
  assert.deepEqual(horisont, [
    "2026-08",
    "2026-09",
    "2026-10",
    "2026-11",
    "2026-12",
    "2027-01",
  ]);
}

{
  const db = tomDb({
    gudstjenester: [
      {
        GudstjenesteID: "GUD001",
        Dato: "2026-09-06",
        Tid: "11:00",
        Tema: "Test",
        Sted: "Bedehuset",
      },
      {
        GudstjenesteID: "GUD002",
        Dato: "2026-10-04",
        Tid: "11:00",
        Tema: "Høst",
        Sted: "Bedehuset",
      },
    ],
  });
  const liste = byggPersonligSondagsliste(db, "P010");
  const maaneder = grupperSondagerPerMaaned(liste);
  assert.equal(maaneder.length, 2);
  assert.equal(maaneder[0].nokkel, "2026-09");
  assert.equal(maaneder[1].nokkel, "2026-10");
  assert.equal(maaneder[0].harLedige, true);
  assert.equal(standardMaanedNokkel(maaneder, "2026-09-15"), "2026-09");
  assert.equal(velgMaanedNokkel(maaneder, "2026-10", "2026-09-15"), "2026-10");
  assert.equal(velgMaanedNokkel(maaneder, "2026-12", "2026-09-15"), "2026-09");
}

{
  const db = tomDb({
    gudstjenester: [
      {
        GudstjenesteID: "GUD001",
        Dato: "2026-09-06",
        Tid: "11:00",
        Tema: "Test",
        Sted: "Bedehuset",
      },
    ],
  });
  const liste = byggPersonligSondagsliste(db, "P010");
  const maaneder = byggPersonligMaanedsliste(liste, 6, "2026-08-29");
  assert.equal(maaneder.length, 6);
  assert.equal(maaneder[0].nokkel, "2026-09");
  assert.equal(maaneder[0].sondager.length, 1);
  assert.equal(maaneder[1].sondager.length, 0);
  assert.equal(nesteMaanedNokkel(maaneder, "2026-09"), "2026-10");
  assert.equal(forrigeMaanedNokkel(maaneder, "2026-10"), "2026-09");
  assert.equal(forrigeMaanedNokkel(maaneder, "2026-09"), null);
}

{
  const db = tomDb({
    personroller: [
      {
        PersonRolleID: "PR1",
        PersonID: "P010",
        RolleID: "R010",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    tildelinger: [
      {
        TildelingID: "T010",
        GudstjenesteID: "GUD001",
        RolleID: "R010",
        PersonID: "P010",
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    svar: [
      {
        SvarID: "S010",
        TildelingID: "T010",
        PersonID: "P010",
        Svar: "Bekreftet",
        Kommentar: "",
        SvartDato: "2026-01-01",
      },
    ],
  });
  const liste = byggPersonligSondagsliste(db, "P010");
  const maaneder = byggPersonligMaanedsliste(liste, 6, "2026-09-01");
  assert.equal(sondagErBesvart(liste[0]), true);
  const fremdrift = semesterFremdrift(maaneder);
  assert.equal(fremdrift.besvart, 1);
  assert.equal(fremdrift.totalt, 1);
  assert.equal(maanedErGjennomgaatt(maaneder[0], new Set()), true);
  assert.equal(maanedErGjennomgaatt(maaneder[1], new Set()), false);
  assert.equal(maanedErGjennomgaatt(maaneder[1], new Set(["2026-10"])), true);
}

{
  const db = tomDb({
    personroller: [
      {
        PersonRolleID: "PR1",
        PersonID: "P010",
        RolleID: "R010",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    tildelinger: [
      {
        TildelingID: "T010",
        GudstjenesteID: "GUD001",
        RolleID: "R010",
        PersonID: "P010",
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    svar: [
      {
        SvarID: "S010",
        TildelingID: "T010",
        PersonID: "P010",
        Svar: "Bekreftet",
        Kommentar: "",
        SvartDato: "2026-01-01",
      },
    ],
  });
  const liste = byggPersonligSondagsliste(db, "P010");
  const maaneder = byggPersonligMaanedsliste(liste, 6, "2026-09-01");
  const ferdig = new Set(["2026-09"]);
  assert.equal(antallGjenstaendeMaaneder(maaneder, ferdig), 5);
  assert.equal(forsteUferdigeMaaned(maaneder, ferdig)?.nokkel, "2026-10");
  assert.equal(antallGjenstaendeMaaneder(maaneder, new Set(maaneder.map((m) => m.nokkel))), 0);
  assert.equal(forsteUferdigeMaaned(maaneder, new Set(maaneder.map((m) => m.nokkel))), null);
}

console.log("paamelding.test.ts: ok");
