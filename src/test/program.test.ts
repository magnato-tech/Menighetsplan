import "./polyfill";
import assert from "node:assert/strict";
import {
  DatabaseState,
  beregnProgramtider,
  formatKlokkeMinutter,
  parseKlokkeMinutter,
  hentAnsvarForBrikke,
  kopierMalTilGudstjeneste,
  tilbakestillProgramFraMal,
  kanRedigereProgram,
  programForGudstjeneste,
  opprettProgramFraMal,
  publiserProgram,
  avpubliserProgram,
  erProgramPublisert,
  hentPrograminstans,
} from "../services/dataService";
import { Gruppe, MalAktivitet, Person, Rolle } from "../types/database";
import { initialMalaktiviteter } from "../data/initialData";

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
  const moteleder: Rolle = {
    RolleID: "R001",
    Rollenavn: "Møteleder",
    Beskrivelse: "",
    Aktiv: true,
    Behov: 1,
    GruppeID: "G001",
    OpprettetDato: "2026-01-01",
    SistEndret: "2026-01-01",
  };
  const gruppe: Gruppe = {
    GruppeID: "G001",
    Gruppenavn: "Gudstjenesteleder",
    GruppetypeID: "GT001",
    GruppelederID: "P002",
    Beskrivelse: "",
    Aktiv: true,
    OpprettetDato: "2026-01-01",
    SistEndret: "2026-01-01",
  };
  return {
    gruppetyper: [],
    personer: [
      person({ PersonID: "P001", Navn: "Line Lovsang", Fornavn: "Line" }),
      person({ PersonID: "P002", Navn: "Gruppe Leder", Fornavn: "Gruppe", Tilgangsnivå: "gruppeleder" }),
      person({ PersonID: "P003", Navn: "Admin Person", Fornavn: "Magnar", Tilgangsnivå: "admin" }),
      person({ PersonID: "P004", Navn: "Vanlig Deltaker", Fornavn: "Vanlig" }),
    ],
    grupper: [gruppe],
    gruppemedlemmer: [],
    personroller: [],
    roller: [
      moteleder,
      {
        RolleID: "R005",
        Rollenavn: "Lovsang",
        Beskrivelse: "",
        Aktiv: true,
        Behov: 1,
        GruppeID: "G001",
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
        Sted: "Salen",
        Tema: "Test",
      },
    ],
    tjenestebehov: [],
    tildelinger: [
      {
        TildelingID: "T001",
        GudstjenesteID: "GUD001",
        RolleID: "R005",
        PersonID: "P001",
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        TildelingID: "T002",
        GudstjenesteID: "GUD001",
        RolleID: "R001",
        PersonID: "P001",
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    svar: [
      {
        SvarID: "S001",
        TildelingID: "T001",
        PersonID: "P001",
        Svar: "Bekreftet",
        SvartDato: "2026-01-01",
      },
      {
        SvarID: "S002",
        TildelingID: "T002",
        PersonID: "P001",
        Svar: "Bekreftet",
        SvartDato: "2026-01-01",
      },
    ],
    malaktiviteter: initialMalaktiviteter,
    programaktiviteter: [],
    programinstanser: [],
    personerImport: [],
    gudstjenesterImport: [],
    rollebeskrivelseImport: [],
  };
}

{
  assert.equal(parseKlokkeMinutter("11:00"), 660);
  assert.equal(formatKlokkeMinutter(645), "10:45");
}

{
  const tider = beregnProgramtider(
    [
      { Rekkefolge: 1, VarighetMin: 15, ForStart: true, Tittel: "Velkommen" },
      { Rekkefolge: 2, VarighetMin: 7, ForStart: false, Tittel: "Lovsang" },
      { Rekkefolge: 3, VarighetMin: 0, ForStart: false, Tittel: "Kaffe" },
    ],
    "11:00"
  );
  assert.equal(tider[0].start, "10:45");
  assert.equal(tider[0].slutt, "11:00");
  assert.equal(tider[1].start, "11:00");
  assert.equal(tider[1].slutt, "11:07");
  assert.equal(tider[2].start, "11:07");
  assert.equal(tider[2].slutt, "11:07");
}

{
  const db = tomDb();
  const ansvar = hentAnsvarForBrikke(db, "GUD001", "R005");
  assert.equal(ansvar.rolle?.Rollenavn, "Lovsang");
  assert.equal(ansvar.gruppe?.Gruppenavn, "Gudstjenesteleder");
  assert.equal(ansvar.personer.length, 1);
  assert.equal(ansvar.personer[0].navn, "Line");
}

{
  const db = tomDb();
  const avvist: DatabaseState = {
    ...db,
    svar: db.svar.map((s) => (s.TildelingID === "T001" ? { ...s, Svar: "Avvist" as const } : s)),
  };
  assert.equal(hentAnsvarForBrikke(avvist, "GUD001", "R005").personer.length, 0);
}

{
  const db = tomDb();
  const kopiert = kopierMalTilGudstjeneste(db, "GUD001");
  const linjer = programForGudstjeneste(kopiert, "GUD001");
  assert.equal(linjer.length, initialMalaktiviteter.length);
  assert.equal(linjer[0].Tittel, "Velkommen ved inngang");
  assert.equal(linjer[0].ForStart, true);
  assert.equal(linjer[0].RolleID, "R008");
  const nattverd = linjer.find((l) => l.Tittel.startsWith("Nattverd"));
  assert.ok(nattverd);
  assert.equal(nattverd?.RolleID, "");
  const kaffe = linjer.find((l) => l.Tittel === "Kirkekaffe");
  assert.equal(kaffe?.VarighetMin, 0);

  const tilpasset: DatabaseState = {
    ...kopiert,
    programaktiviteter: kopiert.programaktiviteter.map((p) =>
      p.Rekkefolge === 1 ? { ...p, Tittel: "Endret" } : p
    ),
  };
  const tilbakestilt = tilbakestillProgramFraMal(tilpasset, "GUD001");
  assert.equal(programForGudstjeneste(tilbakestilt, "GUD001")[0].Tittel, "Velkommen ved inngang");
}

{
  const db = tomDb();
  assert.equal(kanRedigereProgram(db, "P001", "GUD001"), true);
  assert.equal(kanRedigereProgram(db, "P002", "GUD001"), false);
  assert.equal(kanRedigereProgram(db, "P003", "GUD001"), true);
  assert.equal(kanRedigereProgram(db, "P004", "GUD001"), false);
  const avvist: DatabaseState = {
    ...db,
    svar: db.svar.map((s) => (s.TildelingID === "T002" ? { ...s, Svar: "Avvist" as const } : s)),
  };
  assert.equal(kanRedigereProgram(avvist, "P001", "GUD001"), false);
  const venter: DatabaseState = {
    ...db,
    svar: db.svar.filter((s) => s.TildelingID !== "T002"),
  };
  assert.equal(kanRedigereProgram(venter, "P001", "GUD001"), true);
}

{
  const db = tomDb();
  assert.equal(erProgramPublisert(db, "GUD001"), false);
  const opprettet = opprettProgramFraMal(db, "GUD001");
  assert.equal(programForGudstjeneste(opprettet, "GUD001").length, initialMalaktiviteter.length);
  assert.equal(hentPrograminstans(opprettet, "GUD001")?.Status, "Utkast");
  assert.equal(erProgramPublisert(opprettet, "GUD001"), false);
  const publisert = publiserProgram(opprettet, "GUD001", "P003");
  assert.equal(erProgramPublisert(publisert, "GUD001"), true);
  assert.equal(hentPrograminstans(publisert, "GUD001")?.PublisertAv, "P003");
  const skjult = avpubliserProgram(publisert, "GUD001");
  assert.equal(erProgramPublisert(skjult, "GUD001"), false);
  assert.equal(hentPrograminstans(skjult, "GUD001")?.Status, "Utkast");
}

{
  const mal: MalAktivitet[] = initialMalaktiviteter;
  assert.equal(mal.length, 18);
  assert.equal(mal[0].ForStart, true);
  assert.equal(mal[mal.length - 1].VarighetMin, 0);
}

console.log("program.test.ts: alle tester ok");
