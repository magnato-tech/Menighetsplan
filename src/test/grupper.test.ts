import "./polyfill";
import assert from "node:assert/strict";
import {
  DatabaseState,
  erGruppeledergruppe,
  finnGrupperForGruppeleder,
  finnTjenestegrupperForPerson,
  hentTilgang,
  lederforumKilderForPerson,
  synkGruppeledergruppe,
} from "../services/dataService";
import { Gruppe, Gruppetype, Person } from "../types/database";

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

function gruppe(partial: Partial<Gruppe> & Pick<Gruppe, "GruppeID" | "Gruppenavn" | "GruppetypeID">): Gruppe {
  return {
    Beskrivelse: "",
    Aktiv: true,
    OpprettetDato: "2026-01-01",
    SistEndret: "2026-01-01",
    ...partial,
  };
}

function tomDb(): DatabaseState {
  return {
    gruppetyper: [
      type("GT001", "Tjenestegruppe"),
      type("GT002", "Gruppeledergruppe"),
      type("GT003", "Ledergruppe"),
      type("GT004", "Husgruppe"),
    ],
    personer: [
      person("P001", "Camilla Vik"),
      person("P002", "Astrid Moen"),
      person("P090", "Hus Leder"),
      person("P099", "Manuell Extra"),
    ],
    grupper: [
      gruppe({
        GruppeID: "G001",
        Gruppenavn: "Lovsang",
        GruppetypeID: "GT001",
        GruppelederID: "P001",
        NestlederID: "P002",
      }),
      gruppe({
        GruppeID: "G008",
        Gruppenavn: "Husgruppe Sentrum",
        GruppetypeID: "GT004",
        GruppelederID: "P090",
      }),
      gruppe({
        GruppeID: "G009",
        Gruppenavn: "Lederskap",
        GruppetypeID: "GT003",
        GruppelederID: "P001",
      }),
    ],
    gruppemedlemmer: [],
    roller: [],
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

const synket = synkGruppeledergruppe(tomDb());
const forum = synket.grupper.find((g) => erGruppeledergruppe(synket, g));
assert.ok(forum, "skal opprette gruppelederteam");
assert.equal(forum!.Gruppenavn, "Gruppelederteam");

const auto = synket.gruppemedlemmer.filter(
  (gm) => gm.GruppeID === forum!.GruppeID && gm.Aktiv
);
const ids = auto.map((gm) => gm.PersonID).sort();
assert.deepEqual(ids, ["P001", "P002", "P090"]);
assert.ok(
  auto.every((gm) => gm.Notat === "auto" && gm.Medlemsrolle === "Automatisk")
);

const kilder = lederforumKilderForPerson(synket, "P001");
assert.equal(kilder.length, 1);
assert.equal(kilder[0].gruppenavn, "Lovsang");
assert.equal(kilder[0].rolle, "Leder");

assert.equal(hentTilgang(synket, "P001").isLeader, true);
assert.equal(hentTilgang(synket, "P090").isLeader, false);
assert.equal(finnGrupperForGruppeleder(synket, "P090").length, 0);
assert.ok(!finnTjenestegrupperForPerson(synket, "P001").some((t) => t.gruppe.GruppeID === forum!.GruppeID));

const igjen = synkGruppeledergruppe(synket);
assert.equal(igjen.gruppemedlemmer.filter((gm) => gm.GruppeID === forum!.GruppeID && gm.Aktiv).length, 3);

const medManuell = {
  ...synket,
  gruppemedlemmer: [
    ...synket.gruppemedlemmer,
    {
      GruppeMedlemID: "GM099",
      GruppeID: forum!.GruppeID,
      PersonID: "P099",
      Medlemsrolle: "Medlem",
      Aktiv: true,
      Notat: "",
      OpprettetDato: "2026-01-01",
      SistEndret: "2026-01-01",
    },
  ],
};
const etterManuell = synkGruppeledergruppe(medManuell);
assert.ok(
  etterManuell.gruppemedlemmer.some(
    (gm) => gm.GruppeID === forum!.GruppeID && gm.PersonID === "P099" && gm.Aktiv
  )
);

const utenP002 = {
  ...etterManuell,
  grupper: etterManuell.grupper.map((g) =>
    g.GruppeID === "G001" ? { ...g, NestlederID: undefined } : g
  ),
};
const etterFjern = synkGruppeledergruppe(utenP002);
const aktiveForum = etterFjern.gruppemedlemmer.filter(
  (gm) => gm.GruppeID === forum!.GruppeID && gm.Aktiv
);
assert.ok(!aktiveForum.some((gm) => gm.PersonID === "P002"));
assert.ok(aktiveForum.some((gm) => gm.PersonID === "P099"));
assert.ok(aktiveForum.some((gm) => gm.PersonID === "P001"));
assert.ok(aktiveForum.some((gm) => gm.PersonID === "P090"));
