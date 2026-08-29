import "./polyfill";
import assert from "node:assert/strict";
import {
  aktiveArrangementerForGruppe,
  kommendeArrangementerForGruppe,
  nesteArrangementForGruppe,
  nesteSamlingInfo,
} from "../services/gruppeArrangementer";
import {
  erNyPerson,
  hentOppmoteForSamling,
  mailtoGruppe,
  navnelisteTekst,
  opprettNyPersonFraGruppeleder,
  settSamlingOppmote,
} from "../services/gruppeOppfolging";
import { standardLederSeksjon, standardLederSeksjonForGruppe } from "../services/grupper";
import type { DatabaseState, Gruppe, Person } from "../types/database";

const gruppe: Gruppe = {
  GruppeID: "G010",
  Gruppenavn: "Fredagsgruppa",
  GruppetypeID: "GT003",
  Beskrivelse: "",
  Aktiv: true,
  OpprettetDato: "2026-01-01",
  SistEndret: "2026-01-01",
};

function tomDb(): DatabaseState {
  return {
    gruppetyper: [],
    personer: [],
    grupper: [gruppe],
    gruppemedlemmer: [],
    roller: [],
    personroller: [],
    rollebeskrivelser: [],
    gudstjenester: [],
    tjenestebehov: [],
    tildelinger: [],
    svar: [],
    malaktiviteter: [],
    maler: [],
    malposter: [],
    malTilleggsvakter: [],
    programaktiviteter: [],
    programinstanser: [],
    arrangementer: [
      {
        ArrangementID: "AR001",
        Dato: "2026-08-01",
        Tid: "19:00",
        Sted: "Hjemme",
        Tittel: "Tidligere",
        Beskrivelse: "",
        GruppeID: "G010",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        ArrangementID: "AR002",
        Dato: "2026-09-15",
        Tid: "19:00",
        Sted: "Kirken",
        Tittel: "Neste",
        Beskrivelse: "",
        GruppeID: "G010",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    kalenderoppgaver: [],
    samlingoppmote: [],
    personerImport: [],
    gudstjenesterImport: [],
    rollebeskrivelseImport: [],
  };
}

{
  const db = tomDb();
  assert.equal(aktiveArrangementerForGruppe(db, "G010").length, 2);
  assert.equal(nesteArrangementForGruppe(db, "G010", "2026-08-15")?.ArrangementID, "AR002");
  assert.equal(kommendeArrangementerForGruppe(db, "G010", 1, "2026-08-15").length, 1);
}

{
  const db = tomDb();
  const info = nesteSamlingInfo(db, "G010");
  assert.equal(info?.kilde, "arrangement");
}

{
  const p: Person = {
    PersonID: "P001",
    Navn: "Test",
    Fornavn: "Test",
    Etternavn: "",
    Epost: "a@b.no",
    Telefon: "",
    Aktiv: true,
    PersonStatus: "ny",
    OpprettetDato: "2026-01-01",
    SistEndret: "2026-01-01",
  };
  assert.equal(erNyPerson(p), true);
  assert.ok(mailtoGruppe([p]).includes(encodeURIComponent("a@b.no")));
  assert.equal(navnelisteTekst([p]), "Test");
}

{
  const db = tomDb();
  const neste = opprettNyPersonFraGruppeleder(db, "Ny Person", "G010");
  const opprettet = neste.personer.find((x) => x.Navn === "Ny Person");
  assert.ok(opprettet);
  assert.equal(opprettet!.PersonStatus, "ny");
  assert.ok(
    neste.gruppemedlemmer.some(
      (gm) => gm.GruppeID === "G010" && gm.PersonID === opprettet!.PersonID
    )
  );
}

{
  const db = tomDb();
  const medOppmote = settSamlingOppmote(db, "AR001", "G010", "P001", true);
  assert.equal(hentOppmoteForSamling(medOppmote, "AR001").length, 1);
}

{
  const tjenesteDb: DatabaseState = {
    ...tomDb(),
    gruppetyper: [
      { GruppetypeID: "GT001", Navn: "Tjenestegruppe", Beskrivelse: "", Aktiv: true, OpprettetDato: "2026-01-01", SistEndret: "2026-01-01" },
      { GruppetypeID: "GT004", Navn: "Husgruppe", Beskrivelse: "", Aktiv: true, OpprettetDato: "2026-01-01", SistEndret: "2026-01-01" },
    ],
    grupper: [
      {
        GruppeID: "G100",
        Gruppenavn: "Rigging",
        GruppetypeID: "GT001",
        GruppelederID: "P100",
        Beskrivelse: "",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        GruppeID: "G200",
        Gruppenavn: "Fredagsgruppa",
        GruppetypeID: "GT004",
        GruppelederID: "P200",
        Beskrivelse: "",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    roller: [
      {
        RolleID: "R100",
        Rollenavn: "Rigging",
        GruppeID: "G100",
        Beskrivelse: "",
        Behov: 2,
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    personer: [
      { PersonID: "P100", Navn: "Tek Leder", Fornavn: "Tek", Etternavn: "Leder", Epost: "", Telefon: "", Aktiv: true, OpprettetDato: "2026-01-01", SistEndret: "2026-01-01" },
      { PersonID: "P200", Navn: "Hus Leder", Fornavn: "Hus", Etternavn: "Leder", Epost: "", Telefon: "", Aktiv: true, OpprettetDato: "2026-01-01", SistEndret: "2026-01-01" },
    ],
  };
  assert.equal(standardLederSeksjon(tjenesteDb, "P100"), "bemanning");
  assert.equal(standardLederSeksjon(tjenesteDb, "P200"), "samlinger");
  assert.equal(standardLederSeksjon(tjenesteDb, "P999"), "hjem");
  assert.equal(standardLederSeksjonForGruppe(tjenesteDb, tjenesteDb.grupper[0]), "bemanning");
  assert.equal(standardLederSeksjonForGruppe(tjenesteDb, tjenesteDb.grupper[1]), "samlinger");
}

console.log("gruppeArrangementer + gruppeOppfolging: ok");
