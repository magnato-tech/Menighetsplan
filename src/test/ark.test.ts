import "./polyfill";
import assert from "node:assert/strict";
import {
  DatabaseState,
  arkCelleInnhold,
  arkRoller,
  belastningForSemester,
  finnPersonMedVisningsnavn,
  foreslaPersonerForCelle,
  hentSvarStatus,
  saveDatabase,
  setDevDataSource,
  settDeltakelseForPerson,
  splittCelleNavn,
  tildelEksternPersonMedStatus,
  tildelNavnICelle,
  tomArkCelle,
  whenRemoteSaveIdle,
} from "../services/dataService";
import { lagreMagiskToken, slettMagiskToken } from "../services/innlogging";
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

function rolle(id: string, navn: string, behov: number, gruppeId = "G005"): Rolle {
  return {
    RolleID: id,
    Rollenavn: navn,
    Beskrivelse: "",
    Aktiv: true,
    Behov: behov,
    GruppeID: gruppeId,
    OpprettetDato: "2026-01-01",
    SistEndret: "2026-01-01",
  };
}

function tomDb(): DatabaseState {
  return {
    gruppetyper: [],
    personer: [
      person({ PersonID: "P001", Navn: "Camilla Vik", Fornavn: "Camilla", Etternavn: "Vik" }),
      person({ PersonID: "P002", Navn: "Astrid Moen", Fornavn: "Astrid", Etternavn: "Moen" }),
      person({ PersonID: "P003", Navn: "Andreas Lund", Fornavn: "Andreas", Etternavn: "Lund" }),
      person({ PersonID: "P004", Navn: "Irene Haug", Fornavn: "Irene", Etternavn: "Haug" }),
      person({ PersonID: "P005", Navn: "Gunnar Lie", Fornavn: "Gunnar", Etternavn: "Lie" }),
    ],
    grupper: [],
    gruppemedlemmer: [],
    roller: [
      rolle("R009", "Rigging", 2),
      rolle("R005", "Lovsang", 3, "G002"),
      rolle("R013", "Administrator", 0, ""),
    ],
    personroller: [],
    rollebeskrivelser: [],
    gudstjenester: [
      {
        GudstjenesteID: "GUD001",
        Dato: "2026-08-23",
        Tid: "11:00",
        Sted: "",
        Tema: "Test",
      },
      {
        GudstjenesteID: "GUD002",
        Dato: "2026-08-30",
        Tid: "11:00",
        Sted: "",
        Tema: "Neste",
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

function test(name: string, fn: () => void) {
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

async function testAsync(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed += 1;
    const err = e instanceof Error ? e.message : String(e);
    console.error(`FAIL  ${name}`);
    console.error(`      ${err}`);
  }
}

test("splittCelleNavn deler komma og semikolon", () => {
  assert.deepEqual(splittCelleNavn("Irene, Gunnar"), ["Irene", "Gunnar"]);
  assert.deepEqual(splittCelleNavn(" Irene ; Gunnar "), ["Irene", "Gunnar"]);
});

test("arkRoller skjuler Administrator og sorterer tjenesteroller", () => {
  const db = tomDb();
  db.roller = [
    rolle("R013", "Administrator", 0, ""),
    rolle("R010", "Kjøkken", 2),
    rolle("R001", "Møteleder", 1),
    rolle("R005", "Lovsang", 3),
    rolle("R006", "Lyd", 1),
  ];
  assert.deepEqual(
    arkRoller(db).map((r) => r.Rollenavn),
    ["Møteleder", "Lovsang", "Lyd", "Kjøkken"]
  );
});

test("arkRoller skjuler smågruppeleder knyttet til husgruppe", () => {
  const db = tomDb();
  db.gruppetyper = [
    {
      GruppetypeID: "GT001",
      Navn: "Tjenestegruppe",
      Beskrivelse: "",
      Aktiv: true,
      OpprettetDato: "2026-01-01",
      SistEndret: "2026-01-01",
    },
    {
      GruppetypeID: "GT004",
      Navn: "Husgruppe",
      Beskrivelse: "",
      Aktiv: true,
      OpprettetDato: "2026-01-01",
      SistEndret: "2026-01-01",
    },
  ];
  db.grupper = [
    {
      GruppeID: "G005",
      Gruppenavn: "Møtevert",
      GruppetypeID: "GT001",
      Beskrivelse: "",
      Aktiv: true,
      OpprettetDato: "2026-01-01",
      SistEndret: "2026-01-01",
    },
    {
      GruppeID: "G008",
      Gruppenavn: "Husgruppe Sentrum",
      GruppetypeID: "GT004",
      Beskrivelse: "",
      Aktiv: true,
      OpprettetDato: "2026-01-01",
      SistEndret: "2026-01-01",
    },
  ];
  db.roller = [
    rolle("R008", "Møtevert", 2, "G005"),
    rolle("R014", "Smågruppeleder", 0, "G008"),
  ];
  assert.deepEqual(arkRoller(db).map((r) => r.Rollenavn), ["Møtevert"]);
});

test("unikt fornavn: Astrid treffer, to Astrid er tvetydig", () => {
  const db = tomDb();
  assert.equal(finnPersonMedVisningsnavn(db, "Astrid")?.PersonID, "P002");
  const forslag = foreslaPersonerForCelle(db, "GUD001", "R009", "Astrid");
  const astrid = forslag.find((f) => f.personId === "P002");
  assert.equal(astrid?.visningsnavn, "Astrid");
  db.personer.push(
    person({ PersonID: "P099", Navn: "Astrid Hagen", Fornavn: "Astrid", Etternavn: "Hagen" })
  );
  assert.equal(finnPersonMedVisningsnavn(db, "Astrid"), undefined);
  const to = foreslaPersonerForCelle(db, "GUD001", "R009", "Astrid");
  assert.equal(to.find((f) => f.personId === "P002")?.visningsnavn, "Astrid Moen");
});

test("komma Irene, Gunnar gir to tildelinger uten personrolle", () => {
  let db = tomDb();
  db = tildelNavnICelle(db, "GUD001", "R009", "Irene, Gunnar", "Deltar");
  const navn = db.tildelinger
    .filter((t) => t.RolleID === "R009")
    .map((t) => t.PersonID)
    .sort();
  assert.deepEqual(navn, ["P004", "P005"]);
  assert.equal(hentSvarStatus(db, db.tildelinger[0].TildelingID), "Bekreftet");
  assert.equal(db.personroller.length, 0);
});

test("avvist vises i cellen og åpner hull (ghost = behov − bekreftet)", () => {
  let db = tomDb();
  db = tildel(db, "T1", "P001", "Avvist");
  const celle = arkCelleInnhold(db, "GUD001", db.roller[0]);
  assert.equal(celle.personer.length, 1);
  assert.equal(celle.personer[0].status, "Avvist");
  assert.equal(celle.bekreftet, 0);
  assert.equal(celle.forfall, 1);
  assert.equal(celle.ledige, 2);
  assert.equal(celle.behov, 2);
});

test("bekreftet fyller, venter fyller ikke, lovsang behov 3", () => {
  let db = tomDb();
  db = tildel(db, "T1", "P001", "Bekreftet", { RolleID: "R005" });
  db = tildel(db, "T2", "P002", "Venter", { RolleID: "R005" });
  const lovsang = db.roller.find((r) => r.RolleID === "R005")!;
  const celle = arkCelleInnhold(db, "GUD001", lovsang);
  assert.equal(celle.behov, 3);
  assert.equal(celle.bekreftet, 1);
  assert.equal(celle.venter, 1);
  assert.equal(celle.ledige, 2);
});

test("tildelEksternPersonMedStatus Bekreftet setter Deltar etter Avventer", () => {
  let db = tomDb();
  db = tildelEksternPersonMedStatus(db, "GUD001", "R009", "Gjest Taler", "Deltar");
  const gjest = db.tildelinger.find((t) => t.EksternNavn === "Gjest Taler");
  assert.ok(gjest);
  assert.equal(hentSvarStatus(db, gjest!.TildelingID), "Bekreftet");
  assert.equal(db.personer.length, tomDb().personer.length);
});

test("typeahead advarer om samme søndag og semesterlast", () => {
  let db = tomDb();
  db = tildel(db, "T1", "P001", "Bekreftet");
  db = tildel(db, "T2", "P001", "Bekreftet", { RolleID: "R005" });
  const forslag = foreslaPersonerForCelle(db, "GUD001", "R009", "Camilla");
  const camilla = forslag.find((f) => f.personId === "P001")!;
  assert.equal(camilla.alleredeTildelt, true);
  assert.ok(camilla.sammeDagAndreRoller.includes("Lovsang"));
  assert.equal(camilla.oppgaverSemester, 2);
  assert.equal(camilla.harFlereSammeDag, true);
  const b = belastningForSemester(db, "2026-08-01");
  assert.equal(b.rader.find((r) => r.personId === "P001")?.harFlereSammeDag, true);
});

test("tomArkCelle fjerner via Deltar ikke", () => {
  let db = tomDb();
  db = tildelNavnICelle(db, "GUD001", "R009", "Camilla", "Deltar");
  assert.ok(db.tildelinger.length > 0);
  db = tomArkCelle(db, "GUD001", "R009");
  assert.equal(db.tildelinger.length, 0);
});

await testAsync("saveDatabase: localStorage med en gang, remote én in-flight og siste tilstand", async () => {
  setDevDataSource("remote");
  lagreMagiskToken("mk_testtokenabc");
  let inflight = 0;
  let maxInflight = 0;
  const mottatt: number[] = [];
  let slippFørste!: () => void;
  const førsteLås = new Promise<void>((r) => {
    slippFørste = r;
  });
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    inflight += 1;
    maxInflight = Math.max(maxInflight, inflight);
    const dest = String(url);
    assert.ok(dest.includes("/api/db"));
    const body = JSON.parse(String(init?.body || "{}")) as { data?: DatabaseState };
    const antall = body.data?.personer?.length ?? 0;
    if (mottatt.length === 0) await førsteLås;
    mottatt.push(antall);
    inflight -= 1;
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const db1 = tomDb();
    const db2 = {
      ...db1,
      personer: [
        ...db1.personer,
        person({ PersonID: "P099", Navn: "Ny Person", Fornavn: "Ny", Etternavn: "Person" }),
      ],
    };
    saveDatabase(db1);
    saveDatabase(db2);
    const cached = JSON.parse(
      localStorage.getItem("gudstjenesteplanlegger_db_v2_remote") || "{}"
    ) as DatabaseState;
    assert.equal(cached.personer.length, db2.personer.length);
    slippFørste();
    await whenRemoteSaveIdle();
    assert.equal(maxInflight, 1);
    assert.ok(mottatt.length >= 1);
    assert.equal(mottatt[mottatt.length - 1], 0);
  } finally {
    globalThis.fetch = origFetch;
    slettMagiskToken();
    setDevDataSource("mock");
  }
});

await testAsync("saveDatabase: sender uten keepalive slik at store JSON-kall ikke feiler", async () => {
  setDevDataSource("remote");
  lagreMagiskToken("mk_testtokenabc");
  let settKeepalive: boolean | undefined;
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    settKeepalive = init?.keepalive;
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    saveDatabase(tomDb());
    await whenRemoteSaveIdle();
    assert.notEqual(settKeepalive, true);
  } finally {
    globalThis.fetch = origFetch;
    slettMagiskToken();
    setDevDataSource("mock");
  }
});

test("gruppemedlemmer merkes iGruppen og kommer først i listen", () => {
  const db = tomDb();
  db.grupper = [
    {
      GruppeID: "G005",
      Gruppenavn: "Rigging",
      GruppetypeID: "GT001",
      Beskrivelse: "",
      Aktiv: true,
      OpprettetDato: "2026-01-01",
      SistEndret: "2026-01-01",
    },
  ];
  db.gruppemedlemmer = [
    {
      GruppeMedlemID: "GM1",
      GruppeID: "G005",
      PersonID: "P005",
      Aktiv: true,
      OpprettetDato: "2026-01-01",
      SistEndret: "2026-01-01",
    },
  ];
  const forslag = foreslaPersonerForCelle(db, "GUD001", "R009", "", { gruppeId: "G005" });
  assert.equal(forslag[0].personId, "P005");
  assert.equal(forslag[0].iGruppen, true);
  assert.equal(forslag.find((f) => f.personId === "P002")?.iGruppen, false);
});

console.log("");
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
