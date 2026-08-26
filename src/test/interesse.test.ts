import "./polyfill";
import assert from "node:assert/strict";
import {
  DatabaseState,
  aktiveTjenesteRolleIds,
  erMedITjenestegruppe,
  bekreftelseKonsekvensTekst,
  grupperAFølge,
  hentPåmeldingsRoller,
  oppsummerRolleendring,
  settPersonroller,
  avlysKommendeOppgaverIGruppe,
  velkomstForGrupper,
} from "../services/dataService";
import { Gruppe, Gruppetype, Person, Rolle } from "../types/database";

function person(id: string, navn: string): Person {
  const [Fornavn, ...rest] = navn.split(" ");
  return {
    PersonID: id,
    Navn: navn,
    Fornavn,
    Etternavn: rest.join(" "),
    Epost: "",
    Telefon: "",
    Notat: "",
    Aktiv: true,
    OpprettetDato: "2026-01-01",
    SistEndret: "2026-01-01",
  };
}

function type(id: string, navn: string): Gruppetype {
  return {
    GruppetypeID: id,
    Navn: navn,
    Beskrivelse: "",
    Aktiv: true,
    OpprettetDato: "2026-01-01",
    SistEndret: "2026-01-01",
  };
}

function gruppe(
  partial: Partial<Gruppe> & Pick<Gruppe, "GruppeID" | "Gruppenavn" | "GruppetypeID">
): Gruppe {
  return {
    Beskrivelse: "",
    Aktiv: true,
    OpprettetDato: "2026-01-01",
    SistEndret: "2026-01-01",
    ...partial,
  };
}

function rolle(
  partial: Partial<Rolle> & Pick<Rolle, "RolleID" | "Rollenavn" | "GruppeID">
): Rolle {
  return {
    Beskrivelse: "",
    Aktiv: true,
    Behov: 1,
    OpprettetDato: "2026-01-01",
    SistEndret: "2026-01-01",
    ...partial,
  };
}

function tomDb(): DatabaseState {
  return {
    gruppetyper: [
      type("GT001", "Tjenestegruppe"),
      type("GT004", "Husgruppe"),
    ],
    personer: [
      person("P001", "Camilla Vik"),
      person("P002", "Jonas Berg"),
      person("P010", "Leder Person"),
    ],
    grupper: [
      gruppe({
        GruppeID: "G003",
        Gruppenavn: "Teknikk",
        GruppetypeID: "GT001",
        GruppelederID: "P010",
      }),
      gruppe({
        GruppeID: "G006",
        Gruppenavn: "Kjøkken",
        GruppetypeID: "GT001",
      }),
      gruppe({
        GruppeID: "G008",
        Gruppenavn: "Husgruppe Sentrum",
        GruppetypeID: "GT004",
      }),
    ],
    gruppemedlemmer: [],
    roller: [
      rolle({ RolleID: "R006", Rollenavn: "Lyd", GruppeID: "G003" }),
      rolle({ RolleID: "R007", Rollenavn: "Bilde", GruppeID: "G003" }),
      rolle({ RolleID: "R010", Rollenavn: "Kjøkken", GruppeID: "G006" }),
    ],
    personroller: [],
    rollebeskrivelser: [],
    gudstjenester: [],
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

let failed = 0;
let passed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(e);
  }
}

test("erMedITjenestegruppe er false uten medlemskap, husgruppe teller ikke", () => {
  const db = tomDb();
  db.gruppemedlemmer = [
    {
      GruppeMedlemID: "GM1",
      GruppeID: "G008",
      PersonID: "P001",
      Aktiv: true,
      OpprettetDato: "2026-01-01",
      SistEndret: "2026-01-01",
    },
  ];
  assert.equal(erMedITjenestegruppe(db, "P001"), false);
  assert.equal(erMedITjenestegruppe(db, "P010"), true);
});

test("settPersonroller huk Lyd plasserer automatisk i Teknikk", () => {
  const forJoin = tomDb();
  assert.equal(grupperAFølge(forJoin, "P001", ["R006"]).map((g) => g.GruppeID).join(), "G003");
  const etter = settPersonroller(forJoin, "P001", ["R006"]);
  assert.deepEqual(aktiveTjenesteRolleIds(etter, "P001"), ["R006"]);
  assert.equal(erMedITjenestegruppe(etter, "P001"), true);
  const paaMelding = hentPåmeldingsRoller(etter, "P001").map((r) => r.RolleID);
  assert.deepEqual(paaMelding, ["R007", "R006"]);
});

test("huk av Lyd og Bilde deaktiverer medlemskap for vanlig medlem", () => {
  let db = settPersonroller(tomDb(), "P001", ["R006", "R007"]);
  db = settPersonroller(db, "P001", []);
  assert.equal(erMedITjenestegruppe(db, "P001"), false);
  assert.equal(
    db.gruppemedlemmer.some((gm) => gm.PersonID === "P001" && gm.GruppeID === "G003" && gm.Aktiv),
    false
  );
});

test("gruppeleder mister ikke medlemskap når siste rolle hukes av", () => {
  let db = settPersonroller(tomDb(), "P010", ["R006"]);
  db = settPersonroller(db, "P010", []);
  assert.equal(erMedITjenestegruppe(db, "P010"), true);
});

test("én av to roller i samme gruppe beholder medlemskap", () => {
  let db = settPersonroller(tomDb(), "P001", ["R006", "R007"]);
  db = settPersonroller(db, "P001", ["R006"]);
  assert.equal(erMedITjenestegruppe(db, "P001"), true);
  assert.deepEqual(aktiveTjenesteRolleIds(db, "P001"), ["R006"]);
});

test("oppsummerRolleendring legger til og fjerner med gruppenavn", () => {
  const db = settPersonroller(tomDb(), "P001", ["R006"]);
  const opps = oppsummerRolleendring(db, "P001", ["R010"]);
  assert.equal(opps.lagtTil.map((l) => l.rollenavn).join(), "Kjøkken");
  assert.equal(opps.fjernet.map((l) => l.rollenavn).join(), "Lyd");
});

test("oppsummerRolleendring nevner gruppe man forlater", () => {
  const db = settPersonroller(tomDb(), "P001", ["R006"]);
  const opps = oppsummerRolleendring(db, "P001", []);
  assert.equal(opps.forlaterGrupper.map((g) => g.gruppeId).join(), "G003");
});

test("bekreftelseKonsekvensTekst har tre modus", () => {
  const ny = bekreftelseKonsekvensTekst({
    varMedITjenestegruppe: false,
    nyeGruppenavn: ["Barnekirke"],
    forlaterGruppenavn: [],
    blirMedITjenestegruppe: true,
  });
  assert.match(ny, /Velkommen til Barnekirke.*tjenestegruppen Barnekirke/);

  const bytte = bekreftelseKonsekvensTekst({
    varMedITjenestegruppe: true,
    nyeGruppenavn: ["Barnekirke"],
    forlaterGruppenavn: ["Teknikk"],
    blirMedITjenestegruppe: true,
  });
  assert.match(bytte, /Du bytter fra Teknikk til Barnekirke.*trekkes tilbake/);

  const slutter = bekreftelseKonsekvensTekst({
    varMedITjenestegruppe: true,
    nyeGruppenavn: [],
    forlaterGruppenavn: ["Teknikk"],
    blirMedITjenestegruppe: false,
  });
  assert.match(slutter, /Du går ut av Teknikk.*ikke med i noen tjenestegruppe.*trekkes tilbake/);
});

test("tildeling eller personrolle uten gruppemedlemskap gir ikke påmelding", () => {
  const db = tomDb();
  db.personroller = [
    {
      PersonRolleID: "PR001",
      PersonID: "P001",
      RolleID: "R010",
      Aktiv: true,
      FraDato: "2026-01-01",
      TilDato: "",
      Notat: "",
      OpprettetDato: "2026-01-01",
      SistEndret: "2026-01-01",
    },
  ];
  db.tildelinger = [
    {
      TildelingID: "T001",
      GudstjenesteID: "GUD001",
      RolleID: "R006",
      PersonID: "P001",
      OpprettetDato: "2026-01-01",
      SistEndret: "2026-01-01",
    },
  ];
  assert.deepEqual(hentPåmeldingsRoller(db, "P001"), []);
});

test("velkomstForGrupper viser gruppeleders navn", () => {
  const db = tomDb();
  const teknikk = db.grupper.find((g) => g.GruppeID === "G003")!;
  const velkomst = velkomstForGrupper(db, [teknikk]);
  assert.equal(velkomst[0].lederNavn, "Leder Person");
});

test("går ut av gruppe avlyser kommende oppgaver, ikke historikk", () => {
  let db = settPersonroller(tomDb(), "P001", ["R006", "R007"]);
  db = {
    ...db,
    gudstjenester: [
      {
        GudstjenesteID: "GUD-FORTID",
        Dato: "2020-01-05",
        Tid: "11:00",
        Sted: "",
        Tema: "",
      },
      {
        GudstjenesteID: "GUD-FREMTID",
        Dato: "2026-12-06",
        Tid: "11:00",
        Sted: "",
        Tema: "",
      },
    ],
    tildelinger: [
      {
        TildelingID: "T-FORTID",
        GudstjenesteID: "GUD-FORTID",
        RolleID: "R006",
        PersonID: "P001",
        OpprettetDato: "2020-01-01",
        SistEndret: "2020-01-01",
      },
      {
        TildelingID: "T-FREMTID",
        GudstjenesteID: "GUD-FREMTID",
        RolleID: "R006",
        PersonID: "P001",
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        TildelingID: "T-BILDE",
        GudstjenesteID: "GUD-FREMTID",
        RolleID: "R007",
        PersonID: "P001",
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    svar: [
      {
        SvarID: "S-FORTID",
        TildelingID: "T-FORTID",
        PersonID: "P001",
        Svar: "Bekreftet",
        SvartDato: "2020-01-02",
      },
      {
        SvarID: "S-FREMTID",
        TildelingID: "T-FREMTID",
        PersonID: "P001",
        Svar: "Bekreftet",
        SvartDato: "2026-01-02",
      },
    ],
  };
  db = settPersonroller(db, "P001", []);
  const fortid = db.svar.find((s) => s.TildelingID === "T-FORTID");
  const fremtid = db.svar.find((s) => s.TildelingID === "T-FREMTID");
  const bilde = db.svar.find((s) => s.TildelingID === "T-BILDE");
  assert.equal(fortid?.Svar, "Bekreftet");
  assert.equal(fremtid?.Svar, "Avvist");
  assert.equal(fremtid?.Kommentar, "Gått ut av tjenestegruppe");
  assert.equal(bilde?.Svar, "Avvist");
});

test("huk av én rolle avlyser bare den oppgaven", () => {
  let db = settPersonroller(tomDb(), "P001", ["R006", "R007"]);
  db = {
    ...db,
    gudstjenester: [
      {
        GudstjenesteID: "GUD-FREMTID",
        Dato: "2026-12-06",
        Tid: "11:00",
        Sted: "",
        Tema: "",
      },
    ],
    tildelinger: [
      {
        TildelingID: "T-LYD",
        GudstjenesteID: "GUD-FREMTID",
        RolleID: "R006",
        PersonID: "P001",
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        TildelingID: "T-BILDE",
        GudstjenesteID: "GUD-FREMTID",
        RolleID: "R007",
        PersonID: "P001",
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    svar: [
      {
        SvarID: "S-LYD",
        TildelingID: "T-LYD",
        PersonID: "P001",
        Svar: "Venter",
        SvartDato: "2026-01-02",
      },
      {
        SvarID: "S-BILDE",
        TildelingID: "T-BILDE",
        PersonID: "P001",
        Svar: "Bekreftet",
        SvartDato: "2026-01-02",
      },
    ],
  };
  db = settPersonroller(db, "P001", ["R007"]);
  assert.equal(db.svar.find((s) => s.TildelingID === "T-LYD")?.Svar, "Avvist");
  assert.equal(db.svar.find((s) => s.TildelingID === "T-BILDE")?.Svar, "Bekreftet");
});

test("avlysKommendeOppgaverIGruppe tar kun gruppens kommende tildelinger", () => {
  let db = settPersonroller(tomDb(), "P001", ["R006", "R010"]);
  db = {
    ...db,
    gudstjenester: [
      {
        GudstjenesteID: "GUD-FREMTID",
        Dato: "2026-12-06",
        Tid: "11:00",
        Sted: "",
        Tema: "",
      },
    ],
    tildelinger: [
      {
        TildelingID: "T-LYD",
        GudstjenesteID: "GUD-FREMTID",
        RolleID: "R006",
        PersonID: "P001",
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        TildelingID: "T-KJOKKEN",
        GudstjenesteID: "GUD-FREMTID",
        RolleID: "R010",
        PersonID: "P001",
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    svar: [
      {
        SvarID: "S-LYD",
        TildelingID: "T-LYD",
        PersonID: "P001",
        Svar: "Bekreftet",
        SvartDato: "2026-01-02",
      },
      {
        SvarID: "S-KJOKKEN",
        TildelingID: "T-KJOKKEN",
        PersonID: "P001",
        Svar: "Bekreftet",
        SvartDato: "2026-01-02",
      },
    ],
  };
  db = avlysKommendeOppgaverIGruppe(db, "P001", "G003");
  assert.equal(db.svar.find((s) => s.TildelingID === "T-LYD")?.Svar, "Avvist");
  assert.equal(db.svar.find((s) => s.TildelingID === "T-LYD")?.Kommentar, "Fjernet fra tjenestegruppe");
  assert.equal(db.svar.find((s) => s.TildelingID === "T-KJOKKEN")?.Svar, "Bekreftet");
});

if (failed > 0) {
  console.error(`\n${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n${passed} passed, 0 failed`);
