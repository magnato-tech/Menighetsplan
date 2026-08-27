import "./polyfill";
import assert from "node:assert/strict";
import { opprettArrangement, slettArrangement } from "../services/arrangementer";
import {
  getEffektivtBehov,
  opprettProgramFraMal,
  programForGudstjeneste,
  settDeltakelseForPerson,
  settTjenestebehov,
} from "../services/dataService";
import type { DatabaseState } from "../types/database";
import { Rolle } from "../types/database";

function tomDb(): DatabaseState {
  const rolle: Rolle = {
    RolleID: "R009",
    Rollenavn: "Rigging",
    Beskrivelse: "",
    Aktiv: true,
    Behov: 2,
    GruppeID: "G005",
    OpprettetDato: "2026-01-01",
    SistEndret: "2026-01-01",
  };
  return {
    gruppetyper: [],
    personer: [
      {
        PersonID: "P001",
        Navn: "Camilla Vik",
        Fornavn: "Camilla",
        Etternavn: "Vik",
        Epost: "",
        Telefon: "",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    grupper: [],
    gruppemedlemmer: [],
    roller: [rolle],
    personroller: [],
    rollebeskrivelser: [],
    gudstjenester: [
      {
        GudstjenesteID: "GUD001",
        Dato: "2026-09-06",
        Tid: "11:00",
        Sted: "Bedehuset",
        Tema: "Søndag",
      },
    ],
    tjenestebehov: [],
    tildelinger: [],
    svar: [],
    malaktiviteter: [
      {
        MalAktivitetID: "MA001",
        Rekkefolge: 1,
        Tittel: "Velkommen",
        VarighetMin: 5,
        ForStart: false,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
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

{
  const db = tomDb();
  const medGrill = opprettArrangement(db, {
    tittel: "Grillfest",
    dato: "2026-09-12",
    tid: "18:00",
    sted: "Hagen",
  });
  assert.equal(medGrill.arrangementer.length, 1);
  assert.equal(medGrill.arrangementer[0].ArrangementID, "AR001");
  assert.equal(medGrill.arrangementer[0].MalID, undefined);
  assert.equal(medGrill.gudstjenester.length, 1);
  const tomTittel = opprettArrangement(db, { tittel: "  ", dato: "2026-09-12", tid: "18:00", sted: "" });
  assert.equal(tomTittel.arrangementer.length, 0);
  const slettet = slettArrangement(medGrill, "AR001");
  assert.equal(slettet.arrangementer[0].Aktiv, false);
}

{
  const db = opprettArrangement(tomDb(), {
    tittel: "Bønn",
    dato: "2026-09-08",
    tid: "19:00",
    sted: "Bedehuset",
  });
  const arId = db.arrangementer[0].ArrangementID;
  const rolle = db.roller[0];
  assert.equal(getEffektivtBehov(db, "GUD001", rolle), 2);
  const medBehov = settTjenestebehov(db, rolle.RolleID, 4, "", arId);
  assert.equal(getEffektivtBehov(medBehov, "GUD001", rolle), 2, "søndagsbehov uendret");
  assert.equal(getEffektivtBehov(medBehov, "", rolle, arId), 4);
  assert.equal(medBehov.tjenestebehov[0].GudstjenesteID, "");
  assert.equal(medBehov.tjenestebehov[0].ArrangementID, arId);

  const tildelt = settDeltakelseForPerson(medBehov, "P001", "", rolle.RolleID, "Avventer", "", arId);
  assert.equal(tildelt.tildelinger[0].ArrangementID, arId);
  assert.equal(tildelt.tildelinger[0].GudstjenesteID, "");
  assert.equal(
    tildelt.tildelinger.some((t) => t.GudstjenesteID === "GUD001"),
    false,
    "arrangement-tildeling skal ikke synes som gudstjeneste"
  );

  const medProgram = opprettProgramFraMal(tildelt, "", arId);
  assert.equal(programForGudstjeneste(medProgram, "GUD001").length, 0);
  assert.equal(programForGudstjeneste(medProgram, "", arId).length, 1);
  assert.equal(medProgram.programaktiviteter[0].ArrangementID, arId);
  assert.equal(medProgram.programaktiviteter[0].GudstjenesteID, "");
}

console.log("arrangementer.test.ts: alle tester ok");
