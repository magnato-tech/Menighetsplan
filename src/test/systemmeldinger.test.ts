import "./polyfill";
import assert from "node:assert/strict";
import { opprettGruppeMelding } from "../services/kommunikasjon";
import {
  erstattMalPlaceholdere,
  harForfallSystemmeldingForTildeling,
  hentForfallSystemmal,
  opprettForfallSystemmelding,
  skalOppretteForfallSystemmelding,
  STANDARD_FORFALL_SYSTEMMAL,
  tolkeGruppeMeldingKilde,
} from "../services/systemmeldinger";
import { oppdaterInnstillinger } from "../services/kalender";
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

function tomDb(overrides: Partial<DatabaseState> = {}): DatabaseState {
  return {
    gruppetyper: [],
    personer: [
      {
        PersonID: "P010",
        Navn: "Ola Nord",
        Fornavn: "Ola",
        Etternavn: "Nord",
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
    ],
    gruppemedlemmer: [],
    roller: [lovsangRolle],
    personroller: [],
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
    tildelinger: [
      {
        TildelingID: "T001",
        GudstjenesteID: GUD_ID,
        RolleID: "R005",
        PersonID: "P010",
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    svar: [
      {
        SvarID: "S001",
        TildelingID: "T001",
        PersonID: "P010",
        Svar: "Bekreftet",
        SvartDato: "2026-01-02",
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
    samlingoppmote: [],
    gruppeMeldinger: [],
    varselLogg: [],
    personerImport: [],
    gudstjenesterImport: [],
    rollebeskrivelseImport: [],
    ...overrides,
  };
}

{
  const mal = erstattMalPlaceholdere(STANDARD_FORFALL_SYSTEMMAL, {
    fornavn: "Ola",
    rolle: "Lovsang",
    dato: "søn. 7. sep.",
    gruppe: "Lovsang",
    tema: "Test",
  });
  assert.ok(mal.includes("Ola"));
  assert.ok(mal.includes("Lovsang"));
  assert.ok(mal.includes("søn. 7. sep."));
}

{
  const db = tomDb();
  const medLeder = opprettGruppeMelding(db, {
    gruppeId: "G001",
    tekst: "Hei alle",
    opprettetAvPersonId: "P002",
    kilde: "gruppeleder",
    hendelseType: "manuell",
  });
  assert.equal(medLeder.gruppeMeldinger![0].Kilde, "gruppeleder");
  assert.equal(tolkeGruppeMeldingKilde(medLeder.gruppeMeldinger![0]), "gruppeleder");
}

{
  let db = tomDb();
  db = opprettForfallSystemmelding(db, {
    gruppeId: "G001",
    personId: "P010",
    tildelingId: "T001",
    gudstjenesteId: GUD_ID,
    rolle: lovsangRolle,
    gudstjenesteDato: GUD_DATO,
    gudstjenesteTema: "Test",
  });
  assert.equal(db.gruppeMeldinger?.length, 1);
  assert.equal(db.gruppeMeldinger![0].Kilde, "system");
  assert.equal(db.gruppeMeldinger![0].HendelseType, "forfall");
  assert.equal(db.gruppeMeldinger![0].TildelingID, "T001");
  assert.ok(db.gruppeMeldinger![0].Tekst.includes("Ola"));
}

{
  let db = tomDb();
  db = oppdaterInnstillinger(db, { systemmeldingForfallAktivert: false });
  db = opprettForfallSystemmelding(db, {
    gruppeId: "G001",
    personId: "P010",
    tildelingId: "T001",
    gudstjenesteId: GUD_ID,
    rolle: lovsangRolle,
    gudstjenesteDato: GUD_DATO,
  });
  assert.equal(db.gruppeMeldinger?.length, 0);
}

{
  let db = tomDb({
    grupper: [
      {
        GruppeID: "G001",
        Gruppenavn: "Lovsang",
        GruppetypeID: "GT001",
        Beskrivelse: "",
        Aktiv: true,
        Systemmeldinger: { forfallAutoAktivert: false },
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
  });
  db = opprettForfallSystemmelding(db, {
    gruppeId: "G001",
    personId: "P010",
    tildelingId: "T001",
    gudstjenesteId: GUD_ID,
    rolle: lovsangRolle,
    gudstjenesteDato: GUD_DATO,
  });
  assert.equal(db.gruppeMeldinger?.length, 0);
}

{
  let db = tomDb();
  db = oppdaterInnstillinger(db, {
    systemmeldingForfallMal: "{fornavn} trenger erstatter til {rolle}.",
  });
  assert.equal(hentForfallSystemmal(db), "{fornavn} trenger erstatter til {rolle}.");
  db = opprettForfallSystemmelding(db, {
    gruppeId: "G001",
    personId: "P010",
    tildelingId: "T001",
    gudstjenesteId: GUD_ID,
    rolle: lovsangRolle,
    gudstjenesteDato: GUD_DATO,
  });
  assert.match(db.gruppeMeldinger![0].Tekst, /Ola trenger erstatter/);
}

{
  let db = tomDb();
  db = opprettForfallSystemmelding(db, {
    gruppeId: "G001",
    personId: "P010",
    tildelingId: "T001",
    gudstjenesteId: GUD_ID,
    rolle: lovsangRolle,
    gudstjenesteDato: GUD_DATO,
  });
  assert.ok(harForfallSystemmeldingForTildeling(db, "T001"));
  db = opprettForfallSystemmelding(db, {
    gruppeId: "G001",
    personId: "P010",
    tildelingId: "T001",
    gudstjenesteId: GUD_ID,
    rolle: lovsangRolle,
    gudstjenesteDato: GUD_DATO,
  });
  assert.equal(db.gruppeMeldinger?.length, 1);
}

{
  const db = tomDb({
    svar: [
      {
        SvarID: "S001",
        TildelingID: "T001",
        PersonID: "P010",
        Svar: "Bekreftet",
        SvartDato: "2026-01-02",
      },
      {
        SvarID: "S002",
        TildelingID: "T002",
        PersonID: "P011",
        Svar: "Bekreftet",
        SvartDato: "2026-01-02",
      },
    ],
    tildelinger: [
      {
        TildelingID: "T001",
        GudstjenesteID: GUD_ID,
        RolleID: "R005",
        PersonID: "P010",
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        TildelingID: "T002",
        GudstjenesteID: GUD_ID,
        RolleID: "R005",
        PersonID: "P011",
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
  });
  assert.equal(
    skalOppretteForfallSystemmelding(db, {
      gruppeId: "G001",
      tildelingId: "T001",
      gudstjenesteId: GUD_ID,
      rolle: lovsangRolle,
    }),
    false
  );
}

console.log("systemmeldinger.test.ts: ok");
