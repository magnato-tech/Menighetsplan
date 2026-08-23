import "./polyfill";
import assert from "node:assert/strict";
import {
  DatabaseState,
  ledigePlasserForRolle,
  summerBemanning,
  hentSvarStatus,
  personHarAktivTildeling,
  finnPersonMedVisningsnavn,
  tildelEksternPerson,
  settDeltakelseForPerson,
  velgDatoForPerson,
  meldPaaFrivillig,
  erEksternPersonId,
  tildelingVisningsnavn,
  plusBemanningstall,
  tomtBemanningstall,
  belastningForSemester,
  situasjonRollerForGudstjeneste,
} from "../services/dataService";
import { personerIRolle } from "../components/GudstjenesteRolleOversikt";
import { Rolle, Person, Tildeling, Svar } from "../types/database";

function person(partial: Partial<Person> & Pick<Person, "PersonID" | "Navn" | "Fornavn">): Person {
  return {
    Etternavn: "",
    Epost: "",
    Telefon: "",
    Notat: "",
    Aktiv: true,
    OpprettetDato: "2026-01-01",
    SistEndret: "2026-01-01",
    ...partial,
  };
}

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
      person({ PersonID: "P001", Navn: "Camilla Vik", Fornavn: "Camilla", Etternavn: "Vik" }),
      person({ PersonID: "P002", Navn: "Astrid Moen", Fornavn: "Astrid", Etternavn: "Moen" }),
      person({ PersonID: "P003", Navn: "Andreas Lund", Fornavn: "Andreas", Etternavn: "Lund" }),
    ],
    grupper: [],
    gruppemedlemmer: [],
    roller: [rolle],
    personroller: [
      {
        PersonRolleID: "PR001",
        PersonID: "P001",
        RolleID: "R009",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    rollebeskrivelser: [],
    gudstjenester: [
      {
        GudstjenesteID: "GUD001",
        Dato: "2026-08-23",
        Tid: "11:00",
        Sted: "",
        Tema: "Test",
      },
    ],
    tjenestebehov: [],
    tildelinger: [],
    svar: [],
    malaktiviteter: [],
    programaktiviteter: [],
    programinstanser: [],
    personerImport: [],
    gudstjenesterImport: [],
    rollebeskrivelseImport: [],
  };
}

function tildel(
  db: DatabaseState,
  id: string,
  personId: string,
  svar: Svar["Svar"],
  ekstra?: Partial<Tildeling>
): DatabaseState {
  const t: Tildeling = {
    TildelingID: id,
    GudstjenesteID: "GUD001",
    RolleID: "R009",
    PersonID: personId,
    OpprettetDato: "2026-01-01",
    SistEndret: "2026-01-01",
    ...ekstra,
  };
  const s: Svar = {
    SvarID: `S-${id}`,
    TildelingID: id,
    PersonID: personId,
    Svar: svar,
    SvartDato: "2026-01-01",
  };
  return {
    ...db,
    tildelinger: [...db.tildelinger, t],
    svar: [...db.svar, s],
  };
}

let failed = 0;
let passed = 0;

function test(name: string, _hypothesisId: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed += 1;
    const err = e instanceof Error ? e.message : String(e);
    console.error(`FAIL  ${name}`);
    console.error(`      ${err}`);
  }
}

const rolle = () => tomDb().roller[0];

test("A: venter fyller ikke grønt / ledige = behov − bekreftet", "A", () => {
  let db = tomDb();
  db = tildel(db, "T1", "P001", "Venter");
  const tall = summerBemanning(db, "GUD001", [rolle()]);
  assert.equal(tall.bekreftet, 0);
  assert.equal(tall.venter, 1);
  assert.equal(tall.ledige, 2);
  assert.equal(ledigePlasserForRolle(2, 0), 2);
  assert.equal(ledigePlasserForRolle(1, 0), 1);
});

test("A: manglende svar-rad telles som venter, ikke bekreftet", "A", () => {
  const db = tomDb();
  db.tildelinger = [
    {
      TildelingID: "T-mangler",
      GudstjenesteID: "GUD001",
      RolleID: "R009",
      PersonID: "P001",
      OpprettetDato: "2026-01-01",
      SistEndret: "2026-01-01",
    },
  ];
  assert.equal(hentSvarStatus(db, "T-mangler"), "Venter");
  const tall = summerBemanning(db, "GUD001", [rolle()]);
  assert.equal(tall.bekreftet, 0);
  assert.equal(tall.venter, 1);
});

test("A: avvist fyller ikke og gir ledig plass", "A", () => {
  let db = tomDb();
  db = tildel(db, "T1", "P001", "Avvist");
  const tall = summerBemanning(db, "GUD001", [rolle()]);
  assert.equal(tall.bekreftet, 0);
  assert.equal(tall.forfall, 1);
  assert.equal(tall.ledige, 2);
  assert.equal(personHarAktivTildeling(db, "P001", "GUD001", "R009"), false);
});

test("B: overbooking 3 bekreftet på behov 2 → 3/2 og 0 ledige", "B", () => {
  let db = tomDb();
  db = tildel(db, "T1", "P001", "Bekreftet");
  db = tildel(db, "T2", "P002", "Bekreftet");
  db = tildel(db, "T3", "P003", "Bekreftet");
  const tall = summerBemanning(db, "GUD001", [rolle()]);
  assert.equal(tall.bekreftet, 3);
  assert.equal(tall.behov, 2);
  assert.equal(tall.ledige, 0);
  assert.equal(ledigePlasserForRolle(2, 3), 0);
});

test("B: velgDatoForPerson blokkerer ikke når veiledende behov er dekket", "B", () => {
  let db = tomDb();
  db = tildel(db, "T1", "P001", "Bekreftet");
  db = tildel(db, "T2", "P002", "Bekreftet");
  const result = velgDatoForPerson(db, "P003", "GUD001", "R009");
  assert.equal(result.success, true);
  assert.ok(result.updatedDb);
  const tall = summerBemanning(result.updatedDb!, "GUD001", [rolle()]);
  assert.equal(tall.bekreftet, 3);
});

test("B: meldPaaFrivillig tillater overbooking", "B", () => {
  let db = tomDb();
  db = tildel(db, "T1", "P002", "Bekreftet");
  db = tildel(db, "T2", "P003", "Bekreftet");
  const result = meldPaaFrivillig(db, "P001", "GUD001", "R009");
  assert.equal(result.success, true, result.message);
  assert.equal(result.updatedDb!.personer.length, db.personer.length);
});

test("C: settDeltakelseForPerson gjenbruker rad og lager ikke dublett", "C", () => {
  let db = tomDb();
  db = settDeltakelseForPerson(db, "P001", "GUD001", "R009", "Avventer");
  const etterFørste = db.tildelinger.filter(
    (t) => t.PersonID === "P001" && t.RolleID === "R009"
  ).length;
  db = settDeltakelseForPerson(db, "P001", "GUD001", "R009", "Deltar");
  const etterAndre = db.tildelinger.filter(
    (t) => t.PersonID === "P001" && t.RolleID === "R009"
  ).length;
  assert.equal(etterFørste, 1);
  assert.equal(etterAndre, 1);
  assert.equal(hentSvarStatus(db, db.tildelinger[0].TildelingID), "Bekreftet");
  assert.equal(personHarAktivTildeling(db, "P001", "GUD001", "R009"), true);
});

test("C: to rader for samme person telles som to inntil de ryddes — personHarAktiv er true", "C", () => {
  let db = tomDb();
  db = tildel(db, "T1", "P002", "Bekreftet");
  db = tildel(db, "T2", "P002", "Bekreftet");
  const tall = summerBemanning(db, "GUD001", [rolle()]);
  assert.equal(tall.bekreftet, 2);
  assert.equal(personHarAktivTildeling(db, "P002", "GUD001", "R009"), true);
});

test("C: finnPersonMedVisningsnavn treffer unik Astrid, ikke ved to like fornavn", "C", () => {
  const db = tomDb();
  const treff = finnPersonMedVisningsnavn(db, "Astrid");
  assert.equal(treff?.PersonID, "P002");
  db.personer.push(
    person({ PersonID: "P099", Navn: "Astrid Hagen", Fornavn: "Astrid", Etternavn: "Hagen" })
  );
  const tvetydig = finnPersonMedVisningsnavn(db, "Astrid");
  assert.equal(tvetydig, undefined);
  const eksakt = finnPersonMedVisningsnavn(db, "Astrid Moen");
  assert.equal(eksakt?.PersonID, "P002");
});

test("D: tildelEksternPerson legger ikke til i Personer", "D", () => {
  const db = tomDb();
  const oppdatert = tildelEksternPerson(db, "GUD001", "R009", "Gjest Taler");
  assert.equal(oppdatert.personer.length, db.personer.length);
  assert.equal(oppdatert.personroller.length, db.personroller.length);
  const gjest = oppdatert.tildelinger.find((t) => t.EksternNavn === "Gjest Taler");
  assert.ok(gjest);
  assert.ok(erEksternPersonId(gjest!.PersonID));
  assert.equal(tildelingVisningsnavn(oppdatert, gjest!), "Gjest Taler");
  assert.equal(hentSvarStatus(oppdatert, gjest!.TildelingID), "Venter");
});

test("D: samme eksterne navn på samme oppgave lages ikke to ganger", "D", () => {
  let db = tomDb();
  db = tildelEksternPerson(db, "GUD001", "R009", "Gjest Taler");
  const n1 = db.tildelinger.length;
  db = tildelEksternPerson(db, "GUD001", "R009", "gjest taler");
  assert.equal(db.tildelinger.length, n1);
});

test("E: personerIRolle viser gjest med merkelapp ekstern", "E", () => {
  let db = tomDb();
  db = tildel(db, "T1", "P001", "Bekreftet");
  db = tildel(db, "TEXT", "EXT001", "Venter", { EksternNavn: "Ole Gjest" });
  const personer = personerIRolle(db, "GUD001", "R009");
  assert.equal(personer.length, 2);
  const gjest = personer.find((p) => p.personId === "EXT001");
  assert.equal(gjest?.navn, "Ole Gjest");
  assert.equal(gjest?.ekstern, true);
  assert.equal(gjest?.status, "Venter");
});

test("E: avvist navn er med i oversikten, bekreftet teller grønt", "E", () => {
  let db = tomDb();
  db = tildel(db, "T1", "P001", "Avvist");
  db = tildel(db, "T2", "P002", "Bekreftet");
  const personer = personerIRolle(db, "GUD001", "R009");
  assert.equal(personer.filter((p) => p.status === "Avvist").length, 1);
  const tall = summerBemanning(db, "GUD001", [rolle()]);
  assert.equal(tall.bekreftet, 1);
  assert.equal(tall.ledige, 1);
});

test("belastning: bekreftet og venter teller, avvist ikke", "A", () => {
  let db = tomDb();
  db = tildel(db, "T1", "P001", "Bekreftet");
  db = tildel(db, "T2", "P001", "Venter");
  db = tildel(db, "T3", "P002", "Avvist");
  const b = belastningForSemester(db, "2026-08-01");
  const camilla = b.rader.find((r) => r.personId === "P001")!;
  const astrid = b.rader.find((r) => r.personId === "P002")!;
  assert.equal(camilla.oppgaver, 2);
  assert.equal(camilla.gudstjenester, 1);
  assert.equal(camilla.bekreftet, 1);
  assert.equal(camilla.venter, 1);
  assert.equal(astrid.oppgaver, 0);
  assert.equal(b.utenOppgaver, 2);
});

test("belastning: flere oppgaver samme søndag", "A", () => {
  let db = tomDb();
  db = {
    ...db,
    roller: [
      ...db.roller,
      {
        RolleID: "R010",
        Rollenavn: "Baking",
        Beskrivelse: "",
        Aktiv: true,
        Behov: 1,
        GruppeID: "G005",
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
  };
  db = tildel(db, "T1", "P001", "Bekreftet");
  db = tildel(db, "T2", "P001", "Bekreftet", { RolleID: "R010" });
  const b = belastningForSemester(db, "2026-08-01");
  const camilla = b.rader.find((r) => r.personId === "P001")!;
  assert.equal(camilla.harFlereSammeDag, true);
  assert.equal(camilla.celler.GUD001.length, 2);
  assert.equal(b.flereSammeDag, 1);
  assert.equal(b.hoyestLast?.personId, "P001");
});

test("belastning: eksterne og fortid telles ikke", "A", () => {
  let db = tomDb();
  db = {
    ...db,
    gudstjenester: [
      ...db.gudstjenester,
      {
        GudstjenesteID: "GUD000",
        Dato: "2020-01-01",
        Tid: "11:00",
        Sted: "",
        Tema: "Gammel",
      },
    ],
    personer: [
      ...db.personer,
      person({ PersonID: "EXT001", Navn: "Gjest", Fornavn: "Gjest" }),
    ],
  };
  db = tildel(db, "T1", "P001", "Bekreftet", { GudstjenesteID: "GUD000" });
  db = tildel(db, "T2", "EXT001", "Bekreftet", { EksternNavn: "Gjest" });
  const b = belastningForSemester(db, "2026-08-01");
  assert.ok(!b.rader.some((r) => r.personId === "EXT001"));
  const camilla = b.rader.find((r) => r.personId === "P001")!;
  assert.equal(camilla.oppgaver, 0);
  assert.equal(b.gudstjenester.length, 1);
});

test("situasjonRollerForGudstjeneste: fast rekkefølge, fornavn og uten avviste", "SIT", () => {
  const rolle = (id: string, navn: string, behov = 1): Rolle => ({
    RolleID: id,
    Rollenavn: navn,
    Beskrivelse: "",
    Aktiv: true,
    Behov: behov,
    GruppeID: "G001",
    OpprettetDato: "2026-01-01",
    SistEndret: "2026-01-01",
  });
  let db = tomDb();
  db = {
    ...db,
    roller: [
      rolle("R-KJOK", "Kjøkken"),
      rolle("R-TAL", "Taler"),
      rolle("R-MOT", "Møteleder"),
      rolle("R-FOR", "Forbønn", 2),
      rolle("R-INAKT", "Inaktiv"),
    ],
  };
  db.roller.find((r) => r.RolleID === "R-INAKT")!.Aktiv = false;
  db = tildel(db, "T-MOT", "P001", "Bekreftet", { RolleID: "R-MOT" });
  db = tildel(db, "T-TAL", "P002", "Venter", { RolleID: "R-TAL" });
  db = tildel(db, "T-FOR1", "P003", "Bekreftet", { RolleID: "R-FOR" });
  db = tildel(db, "T-FOR2", "P001", "Avvist", { RolleID: "R-FOR" });
  const rader = situasjonRollerForGudstjeneste(db, "GUD001");
  assert.deepEqual(
    rader.map((r) => r.rolle.Rollenavn),
    ["Møteleder", "Taler", "Forbønn", "Kjøkken"]
  );
  assert.equal(rader[0].personer[0].navn, "Camilla");
  assert.equal(rader[0].personer[0].status, "Bekreftet");
  assert.equal(rader[1].personer[0].status, "Venter");
  assert.equal(rader[2].personer.length, 1);
  assert.equal(rader[2].personer[0].navn, "Andreas");
  assert.equal(rader[3].personer.length, 0);
  const kunKjokken = situasjonRollerForGudstjeneste(db, "GUD001", ["R-KJOK"]);
  assert.deepEqual(kunKjokken.map((r) => r.rolle.RolleID), ["R-KJOK"]);
});

test("plusBemanningstall summerer semester-KPI", "A", () => {
  const a = { bekreftet: 1, venter: 2, ledige: 3, forfall: 1, behov: 4 };
  const b = { bekreftet: 3, venter: 0, ledige: 0, forfall: 0, behov: 2 };
  const s = plusBemanningstall(a, b);
  assert.equal(s.bekreftet, 4);
  assert.equal(s.ledige, 3);
  assert.deepEqual(tomtBemanningstall(), {
    bekreftet: 0,
    venter: 0,
    ledige: 0,
    forfall: 0,
    behov: 0,
  });
});

console.log("");
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
