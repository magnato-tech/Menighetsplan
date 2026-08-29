import "./polyfill";
import assert from "node:assert/strict";
import { opprettGruppeMelding } from "../services/kommunikasjon";
import {
  antallUlesteMeldinger,
  erMeldingUlest,
  lesSistSettMeldingNokkel,
  markerMeldingerSomLest,
  meldingSorteringsNokkel,
} from "../services/gruppeMeldingLest";
import { visMeldingerForPerson, oppdaterInnstillinger } from "../services/kalender";
import type { DatabaseState } from "../types/database";

function tomDb(overrides: Partial<DatabaseState> = {}): DatabaseState {
  return {
    gruppetyper: [],
    personer: [
      {
        PersonID: "P001",
        Navn: "Lars Test",
        Fornavn: "Lars",
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
        GruppeID: "G001",
        Gruppenavn: "Rigging",
        GruppetypeID: "GT001",
        Beskrivelse: "",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    gruppemedlemmer: [
      {
        GruppeMedlemID: "GM001",
        GruppeID: "G001",
        PersonID: "P001",
        Medlemsrolle: "Medlem",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
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
    samlingoppmote: [],
    gruppeMeldinger: [],
    varselLogg: [],
    personerImport: [],
    gudstjenesterImport: [],
    rollebeskrivelseImport: [],
    ...overrides,
  };
}

const mockStorage = new Map<string, string>();

function settMockLocalStorage() {
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => mockStorage.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mockStorage.set(k, v);
      },
      removeItem: (k: string) => {
        mockStorage.delete(k);
      },
      clear: () => mockStorage.clear(),
      key: () => null,
      length: mockStorage.size,
    },
    configurable: true,
  });
}

settMockLocalStorage();

{
  mockStorage.clear();
  let db = tomDb();
  db = opprettGruppeMelding(db, {
    gruppeId: "G001",
    tekst: "Hei",
    opprettetAvPersonId: "P002",
    kilde: "gruppeleder",
  });
  assert.equal(antallUlesteMeldinger(db, "P001"), 1);
  markerMeldingerSomLest(db, "P001");
  assert.equal(antallUlesteMeldinger(db, "P001"), 0);
  assert.ok(lesSistSettMeldingNokkel("P001").length > 0);
}

{
  mockStorage.clear();
  const m = {
    GruppeMeldingID: "GM002",
    GruppeID: "G001",
    Tekst: "Ny",
    OpprettetAvPersonID: "P002",
    OpprettetDato: "2026-02-01",
    SistEndret: "2026-02-01",
  };
  mockStorage.set("gruppeMeldingerSistSett_P001", meldingSorteringsNokkel(m));
  assert.equal(erMeldingUlest({ ...m, OpprettetDato: "2026-03-01", GruppeMeldingID: "GM003" }, meldingSorteringsNokkel(m)), true);
  assert.equal(erMeldingUlest(m, meldingSorteringsNokkel(m)), false);
}

{
  const db = tomDb();
  assert.equal(visMeldingerForPerson(db, "P001"), false);
  const pa = oppdaterInnstillinger(db, { visMeldingerMinSide: true });
  assert.equal(visMeldingerForPerson(pa, "P001"), true);
  assert.equal(visMeldingerForPerson(pa, "P999"), false);
}

console.log("gruppeMeldingLest.test.ts: ok");
