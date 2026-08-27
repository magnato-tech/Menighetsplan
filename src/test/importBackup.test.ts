import "./polyfill";
import assert from "node:assert/strict";
import { byggImportBackup } from "../services/importBackup";
import type { DatabaseState } from "../types/database";

function tomDb(): DatabaseState {
  return {
    gruppetyper: [],
    personer: [
      {
        PersonID: "P001",
        Navn: "Kari Strand",
        Fornavn: "Kari",
        Etternavn: "Strand",
        Epost: "kari@example.com",
        Telefon: "111",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    grupper: [],
    gruppemedlemmer: [],
    roller: [
      {
        RolleID: "R010",
        Rollenavn: "Kjøkken",
        Beskrivelse: "Kaffe",
        Aktiv: true,
        Behov: 2,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    personroller: [
      {
        PersonRolleID: "PR001",
        PersonID: "P001",
        RolleID: "R010",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    rollebeskrivelser: [
      {
        RolleID: "R010",
        Rollebeskrivelse: "Lag kaffe",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    gudstjenester: [
      {
        GudstjenesteID: "GUD001",
        Dato: "2026-09-13",
        Tid: "11:00",
        Sted: "Bedehuset",
        Tema: "Sendt ut i verden",
        Bibeltekst: "Joh 20",
        Kollekt: "Bymisjon",
        Merknad: "",
      },
    ],
    tjenestebehov: [],
    tildelinger: [
      {
        TildelingID: "T001",
        GudstjenesteID: "GUD001",
        RolleID: "R010",
        PersonID: "P001",
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    svar: [],
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
  };
}

const backup = byggImportBackup(tomDb());
assert.equal(backup.personerImport.length, 1);
assert.equal(backup.personerImport[0].Tjenesteområde1, "Kjøkken");
assert.equal(backup.gudstjenesterImport[0].Tema, "Sendt ut i verden");
assert.equal(backup.gudstjenesterImport[0].Kjøkken, "Kari Strand");
assert.equal(backup.gudstjenesterImport[0].Leder, "");
assert.equal(backup.rollebeskrivelseImport[0].FullBeskrivelse, "Lag kaffe");

console.log("importBackup.test.ts: alle tester ok");
