import "./polyfill";
import assert from "node:assert/strict";
import { mergeIncomingState } from "../services/serverSanitize";
import type { DatabaseState, Person } from "../types/database";

function person(p: Partial<Person> & Pick<Person, "PersonID" | "Navn" | "Fornavn">): Person {
  return {
    Etternavn: "",
    Epost: "",
    Telefon: "",
    Notat: "",
    Aktiv: true,
    OpprettetDato: "2026-01-01",
    SistEndret: "2026-01-01",
    ...p,
  };
}

function tom(): DatabaseState {
  return {
    gruppetyper: [],
    personer: [person({ PersonID: "P001", Navn: "Ada", Fornavn: "Ada", Epost: "ada@example.com" })],
    grupper: [],
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
    arrangementer: [],
    kalenderoppgaver: [],
    personerImport: [],
    gudstjenesterImport: [],
    rollebeskrivelseImport: [],
  };
}

{
  const existing = tom();
  const incoming = tom();
  incoming.personer = [person({ PersonID: "P001", Navn: "Ada", Fornavn: "Ada", Epost: "" })];
  const merget = mergeIncomingState(existing, incoming, true);
  assert.equal(merget.personer[0].Epost, "ada@example.com");
}

{
  const existing = tom();
  existing.tildelinger = [
    {
      TildelingID: "T1",
      GudstjenesteID: "GUD001",
      RolleID: "R001",
      PersonID: "P001",
      OpprettetDato: "2026-01-01",
      SistEndret: "2026-01-01",
    },
  ];
  const incoming = tom();
  incoming.tildelinger = [];
  incoming.personer = [];
  const merget = mergeIncomingState(existing, incoming, false);
  assert.equal(merget.personer[0].Epost, "ada@example.com");
  assert.equal(merget.tildelinger.length, 0);
}

console.log("serverSanitize.test.ts: ok");
