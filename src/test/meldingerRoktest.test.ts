/**
 * Automatisert røyktest for meldings-/forfall-flyt etter 28cbe13.
 * Dekker scenariene i vedlikeholdsplanen (datat lag — UI verifiseres manuelt).
 */
import "./polyfill";
import assert from "node:assert/strict";
import { hentSvarStatus, settDeltakelseForPerson, svarPaaTildeling } from "../services/bemanning";
import { meldingerForPerson } from "../services/kommunikasjon";
import { meldForfall } from "../services/paamelding";
import { oppdaterInnstillinger, visMeldingerForPerson } from "../services/kalender";
import { skalOppretteForfallSystemmelding } from "../services/systemmeldinger";
import type { DatabaseState, Rolle } from "../types/database";

const GUD_ID = "GUD001";
const PERSON = "P010";
const PERSON2 = "P011";

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
        PersonID: PERSON,
        Navn: "Ola Nord",
        Fornavn: "Ola",
        Etternavn: "Nord",
        Epost: "",
        Telefon: "",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        PersonID: PERSON2,
        Navn: "Kari Nord",
        Fornavn: "Kari",
        Etternavn: "Nord",
        Epost: "",
        Telefon: "",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        PersonID: "P012",
        Navn: "Per Nord",
        Fornavn: "Per",
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
    gruppemedlemmer: [
      {
        GruppeMedlemID: "GM001",
        GruppeID: "G001",
        PersonID: PERSON,
        Medlemsrolle: "Medlem",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        GruppeMedlemID: "GM002",
        GruppeID: "G001",
        PersonID: PERSON2,
        Medlemsrolle: "Medlem",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    roller: [lovsangRolle],
    personroller: [],
    rollebeskrivelser: [],
    gudstjenester: [
      {
        GudstjenesteID: GUD_ID,
        Dato: "2026-09-06",
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
    samlingoppmote: [],
    gruppeMeldinger: [],
    varselLogg: [],
    personerImport: [],
    gudstjenesterImport: [],
    rollebeskrivelseImport: [],
    ...overrides,
  };
}

// Forfall fra bemanning (gruppeleder) → systemmelding
{
  let db = settDeltakelseForPerson(tomDb(), PERSON, GUD_ID, "R005", "Deltar");
  const t = db.tildelinger.find(
    (x) => x.GudstjenesteID === GUD_ID && x.RolleID === "R005" && x.PersonID === PERSON
  )!;
  db = svarPaaTildeling(db, t.TildelingID, PERSON, "Avvist", "Avvist av gruppeleder");
  assert.equal(db.gruppeMeldinger?.length, 1);
  assert.equal(db.gruppeMeldinger![0].Kilde, "system");
}

// Forfall fra Min side uten egen tekst → systemmelding
{
  let db = settDeltakelseForPerson(tomDb(), PERSON, GUD_ID, "R005", "Deltar");
  db = meldForfall(db, PERSON, GUD_ID, "R005")!;
  assert.equal(db.gruppeMeldinger?.length, 1);
  assert.equal(db.gruppeMeldinger![0].Kilde, "system");
}

// Forfall fra Min side med egen tekst → medlemsmelding
{
  let db = settDeltakelseForPerson(tomDb(), PERSON, GUD_ID, "R005", "Deltar");
  db = meldForfall(db, PERSON, GUD_ID, "R005", "Kan ikke denne søndagen")!;
  assert.equal(db.gruppeMeldinger?.length, 1);
  assert.equal(db.gruppeMeldinger![0].Kilde, "medlem");
  assert.match(db.gruppeMeldinger![0].Tekst, /Kan ikke denne søndagen/);
}

// Potten full etter forfall (overbooking) → ingen systemmelding
{
  let db = tomDb();
  db = settDeltakelseForPerson(db, PERSON, GUD_ID, "R005", "Deltar");
  db = settDeltakelseForPerson(db, PERSON2, GUD_ID, "R005", "Deltar");
  db = settDeltakelseForPerson(db, "P012", GUD_ID, "R005", "Deltar");
  const t = db.tildelinger.find((x) => x.PersonID === PERSON)!;
  assert.equal(
    skalOppretteForfallSystemmelding(db, {
      gruppeId: "G001",
      tildelingId: t.TildelingID,
      gudstjenesteId: GUD_ID,
      rolle: lovsangRolle,
    }),
    false
  );
  db = svarPaaTildeling(db, t.TildelingID, PERSON, "Avvist", "Meldt forfall");
  assert.equal(db.gruppeMeldinger?.length ?? 0, 0);
  assert.equal(hentSvarStatus(db, t.TildelingID), "Avvist");
}

// Admin: visMeldingerMinSide av/på styrer Min side-meldinger
{
  let db = tomDb();
  assert.equal(visMeldingerForPerson(db, PERSON), false);
  db = oppdaterInnstillinger(db, { visMeldingerMinSide: true });
  assert.equal(visMeldingerForPerson(db, PERSON), true);
  db = settDeltakelseForPerson(db, PERSON, GUD_ID, "R005", "Deltar");
  db = meldForfall(db, PERSON, GUD_ID, "R005", "Testmelding")!;
  assert.equal(meldingerForPerson(db, PERSON).length, 1);
  db = oppdaterInnstillinger(db, { visMeldingerMinSide: false });
  assert.equal(visMeldingerForPerson(db, PERSON), false);
}

console.log("meldingerRoktest.test.ts: ok");
