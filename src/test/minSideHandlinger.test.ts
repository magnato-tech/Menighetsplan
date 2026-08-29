import "./polyfill";
import assert from "node:assert/strict";
import { hentSvarStatus, settDeltakelseForPerson } from "../services/bemanning";
import {
  byggPersonligSondagsliste,
  hentKommendeForesporsler,
  meldForfall,
  svarPaForesporsel,
  togglePaamelding,
} from "../services/paamelding";
import type { DatabaseState, Rolle } from "../types/database";

/**
 * Handlings-tester for Min side og bemanning.
 * Hver test speiler én knapp/handling i UI og sjekker at tjenestelaget
 * faktisk oppdaterer databasen (ikke returnerer undefined).
 */

const GUD_ID = "GUD001";
const GUD_DATO = "2026-09-06";
const PERSON = "P010";
const LEDER = "P011";

const lovsangRolle: Rolle = {
  RolleID: "R005",
  Rollenavn: "Lovsang",
  Beskrivelse: "",
  BidraPreposisjon: "med",
  Aktiv: true,
  Behov: 3,
  GruppeID: "G001",
  OpprettetDato: "2026-01-01",
  SistEndret: "2026-01-01",
};

const barnekirkeRolle: Rolle = {
  RolleID: "R004",
  Rollenavn: "Barnekirke",
  Beskrivelse: "",
  BidraPreposisjon: "i",
  Aktiv: true,
  Behov: 2,
  GruppeID: "G001",
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
        PersonID: PERSON,
        Navn: "Camilla Test",
        Fornavn: "Camilla",
        Etternavn: "Test",
        Epost: "",
        Telefon: "",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        PersonID: LEDER,
        Navn: "Gruppeleder Test",
        Fornavn: "Gruppeleder",
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
        GruppeMedlemID: "GM1",
        GruppeID: "G001",
        PersonID: PERSON,
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        GruppeMedlemID: "GM2",
        GruppeID: "G001",
        PersonID: LEDER,
        Medlemsrolle: "Leder",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    roller: [lovsangRolle, barnekirkeRolle],
    personroller: [
      {
        PersonRolleID: "PR1",
        PersonID: PERSON,
        RolleID: "R005",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        PersonRolleID: "PR2",
        PersonID: PERSON,
        RolleID: "R004",
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

function assertOppdatert<T>(result: T | undefined, handling: string): T {
  assert.ok(result, `${handling} skal oppdatere databasen, ikke returnere undefined`);
  return result;
}

function finnRad(db: DatabaseState, rolleId: string) {
  const sondag = byggPersonligSondagsliste(db, PERSON).find(
    (s) => s.gudstjeneste.GudstjenesteID === GUD_ID
  );
  return sondag?.roller.find((r) => r.rolle.RolleID === rolleId);
}

function finnTildeling(db: DatabaseState, rolleId: string) {
  return db.tildelinger.find(
    (t) =>
      t.GudstjenesteID === GUD_ID && t.RolleID === rolleId && t.PersonID === PERSON
  );
}

// —— Gruppeleder: «Sett forespørsel» ——
{
  const db = settDeltakelseForPerson(tomDb(), PERSON, GUD_ID, "R005", "Avventer");
  assert.equal(hentKommendeForesporsler(db, PERSON).length, 1);
  assert.equal(finnRad(db, "R005")?.status, "min-venter");
}

// —— Forespørsler-panel: «Ja, jeg kan» ——
{
  let db = settDeltakelseForPerson(tomDb(), PERSON, GUD_ID, "R005", "Avventer");
  const foresp = hentKommendeForesporsler(db, PERSON)[0];
  db = assertOppdatert(
    svarPaForesporsel(db, PERSON, foresp.gudstjenesteId, foresp.rolleId, "Bekreftet"),
    "Ja, jeg kan"
  );
  assert.equal(hentKommendeForesporsler(db, PERSON).length, 0);
  assert.equal(finnRad(db, "R005")?.status, "min-bekreftet");
  const t = finnTildeling(db, "R005")!;
  assert.equal(hentSvarStatus(db, t.TildelingID), "Bekreftet");
}

// —— Forespørsler-panel: «Send avslag» med melding til gruppa ——
{
  let db = settDeltakelseForPerson(tomDb(), PERSON, GUD_ID, "R005", "Avventer");
  const foresp = hentKommendeForesporsler(db, PERSON)[0];
  db = assertOppdatert(
    svarPaForesporsel(
      db,
      PERSON,
      foresp.gudstjenesteId,
      foresp.rolleId,
      "Avvist",
      "Kan ikke denne søndagen",
      foresp.tildelingId
    ),
    "Send avslag med melding"
  );
  assert.equal(hentKommendeForesporsler(db, PERSON).length, 0);
  const t = finnTildeling(db, "R005")!;
  assert.equal(hentSvarStatus(db, t.TildelingID), "Avvist");
  assert.equal(db.gruppeMeldinger?.length, 1);
  assert.match(db.gruppeMeldinger![0].Tekst, /Kan ikke denne søndagen/);
  assert.equal(db.gruppeMeldinger![0].Kilde, "medlem");
}

// —— Søndagsliste: «Ja» på forespurt rad ——
{
  let db = settDeltakelseForPerson(tomDb(), PERSON, GUD_ID, "R004", "Avventer");
  const rad = finnRad(db, "R004");
  assert.equal(rad?.status, "min-venter");
  db = assertOppdatert(
    svarPaForesporsel(
      db,
      PERSON,
      GUD_ID,
      "R004",
      "Bekreftet",
      undefined,
      rad?.minTildelingId
    ),
    "Ja i søndagsliste"
  );
  assert.equal(finnRad(db, "R004")?.status, "min-bekreftet");
}

// —— Søndagsliste: «Nei» på forespurt rad (uten valgfri melding) ——
{
  let db = settDeltakelseForPerson(tomDb(), PERSON, GUD_ID, "R004", "Avventer");
  const rad = finnRad(db, "R004");
  db = assertOppdatert(
    svarPaForesporsel(
      db,
      PERSON,
      GUD_ID,
      "R004",
      "Avvist",
      undefined,
      rad?.minTildelingId
    ),
    "Nei i søndagsliste"
  );
  assert.equal(finnRad(db, "R004")?.status, "ledig");
  const t = finnTildeling(db, "R004")!;
  assert.equal(hentSvarStatus(db, t.TildelingID), "Avvist");
}

// —— Søndagsliste: hake av / «Meld meg på» ——
{
  let db = tomDb();
  assert.equal(finnRad(db, "R005")?.status, "ledig");
  db = assertOppdatert(togglePaamelding(db, PERSON, GUD_ID, "R005", true), "Meld meg på");
  assert.equal(finnRad(db, "R005")?.status, "min-bekreftet");
  const t = finnTildeling(db, "R005")!;
  assert.equal(hentSvarStatus(db, t.TildelingID), "Bekreftet");
}

// —— Søndagsliste: «Bekreft forfall» med melding ——
{
  let db = settDeltakelseForPerson(tomDb(), PERSON, GUD_ID, "R005", "Deltar");
  db = assertOppdatert(
    meldForfall(db, PERSON, GUD_ID, "R005", "Reiser bort den helgen"),
    "Bekreft forfall med melding"
  );
  assert.notEqual(finnRad(db, "R005")?.status, "min-bekreftet");
  const t = finnTildeling(db, "R005")!;
  assert.equal(hentSvarStatus(db, t.TildelingID), "Avvist");
  assert.equal(db.gruppeMeldinger?.length, 1);
  assert.match(db.gruppeMeldinger![0].Tekst, /Reiser bort/);
  assert.equal(db.gruppeMeldinger![0].Kilde, "medlem");
}

// —— Søndagsliste: «Bekreft forfall» uten melding (systemmelding) ——
{
  let db = settDeltakelseForPerson(tomDb(), PERSON, GUD_ID, "R005", "Deltar");
  db = assertOppdatert(meldForfall(db, PERSON, GUD_ID, "R005"), "Bekreft forfall uten melding");
  assert.equal(db.gruppeMeldinger?.length, 1);
  assert.equal(db.gruppeMeldinger![0].Kilde, "system");
}

// —— Ingen duplikat systemmelding ved gjentatt forfall ——
{
  let db = settDeltakelseForPerson(tomDb(), PERSON, GUD_ID, "R005", "Deltar");
  db = assertOppdatert(meldForfall(db, PERSON, GUD_ID, "R005"), "første forfall");
  db = assertOppdatert(meldForfall(db, PERSON, GUD_ID, "R005"), "andre forfall-kall");
  assert.equal(db.gruppeMeldinger?.length, 1);
}

// —— Gruppeleder: bekreft direkte (Deltar) ——
{
  const db = settDeltakelseForPerson(tomDb(), PERSON, GUD_ID, "R005", "Deltar");
  const t = finnTildeling(db, "R005")!;
  assert.equal(hentSvarStatus(db, t.TildelingID), "Bekreftet");
  assert.equal(finnRad(db, "R005")?.status, "min-bekreftet");
}

// —— Alle synlige forespørsler skal kunne besvares ——
{
  let db = tomDb();
  db = settDeltakelseForPerson(db, PERSON, GUD_ID, "R005", "Avventer");
  db = settDeltakelseForPerson(db, PERSON, GUD_ID, "R004", "Avventer");
  const foresporsler = hentKommendeForesporsler(db, PERSON);
  assert.equal(foresporsler.length, 2);
  for (const f of foresporsler) {
    const neste = svarPaForesporsel(
      db,
      PERSON,
      f.gudstjenesteId,
      f.rolleId,
      "Bekreftet",
      undefined,
      f.tildelingId
    );
    assert.ok(neste, `Forespørsel ${f.rollenavn} skal kunne besvares`);
    db = neste;
  }
  assert.equal(hentKommendeForesporsler(db, PERSON).length, 0);
}

// —— Handling uten tildeling skal feile tydelig (ikke stille) ——
{
  const db = tomDb();
  assert.equal(svarPaForesporsel(db, PERSON, GUD_ID, "R005", "Bekreftet"), undefined);
  assert.equal(togglePaamelding(db, PERSON, GUD_ID, "R099", true), undefined);
  assert.equal(meldForfall(db, PERSON, GUD_ID, "R005"), undefined);
}

// —— Duplikat svar-rader: avslag skal likevel fjerne forespørselen ——
{
  let db = settDeltakelseForPerson(tomDb(), PERSON, GUD_ID, "R005", "Avventer");
  const t = finnTildeling(db, "R005")!;
  db = {
    ...db,
    svar: [
      ...db.svar,
      {
        SvarID: "S_DUP",
        TildelingID: t.TildelingID,
        PersonID: "FEIL",
        Svar: "Venter",
        SvartDato: "",
      },
    ],
  };
  assert.equal(hentKommendeForesporsler(db, PERSON).length, 1);
  db = assertOppdatert(
    svarPaForesporsel(db, PERSON, GUD_ID, "R005", "Avvist", "Nei takk", t.TildelingID),
    "Send avslag med duplikat svar-rad"
  );
  assert.equal(hentKommendeForesporsler(db, PERSON).length, 0);
  assert.equal(hentSvarStatus(db, t.TildelingID), "Avvist");
}

console.log("minSideHandlinger.test.ts: ok");
