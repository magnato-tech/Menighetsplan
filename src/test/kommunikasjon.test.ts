import "./polyfill";
import assert from "node:assert/strict";
import {
  byggVarselForesporsel,
  byggVarselForMelding,
  kanSendeSms,
  mailtoMedKropp,
  meldingerForPerson,
  normaliserTelefon,
  opprettGruppeMelding,
  sendVarselManuelt,
  smsLenke,
  varselNyMelding,
} from "../services/kommunikasjon";
import type { DatabaseState, Person } from "../types/database";

function person(id: string, navn: string, telefon = "", epost = ""): Person {
  const [Fornavn, ...rest] = navn.split(" ");
  return {
    PersonID: id,
    Navn: navn,
    Fornavn,
    Etternavn: rest.join(" "),
    Epost: epost,
    Telefon: telefon,
    Aktiv: true,
    OpprettetDato: "2026-01-01",
    SistEndret: "2026-01-01",
  };
}

function tomDb(): DatabaseState {
  return {
    gruppetyper: [],
    personer: [person("P001", "Lars Test", "91234567", "lars@test.no")],
    grupper: [
      {
        GruppeID: "G001",
        Gruppenavn: "Rigging",
        GruppetypeID: "GT001",
        GruppelederID: "P002",
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
  };
}

{
  assert.equal(normaliserTelefon("91234567"), "+4791234567");
  assert.equal(kanSendeSms("91234567"), true);
  assert.equal(kanSendeSms(""), false);
  const sms = smsLenke("91234567", "Hei");
  assert.ok(sms?.startsWith("sms:+4791234567"));
  assert.ok(sms?.includes(encodeURIComponent("Hei")));
}

{
  const href = mailtoMedKropp({
    mottakere: ["a@b.no"],
    emne: "Test",
    kropp: "Hei der",
  });
  assert.ok(href.startsWith("mailto:"));
  assert.ok(href.includes("a%40b.no"));
}

{
  const tekst = varselNyMelding({ gruppenavn: "Rigging", lenke: "https://x.test?t=mk_abc" });
  assert.ok(tekst.includes("Rigging"));
  assert.ok(tekst.includes("https://x.test"));
}

{
  const db = tomDb();
  const medMelding = opprettGruppeMelding(db, {
    gruppeId: "G001",
    tekst: "Husk mat",
    opprettetAvPersonId: "P002",
    kilde: "gruppeleder",
    hendelseType: "manuell",
  });
  assert.equal(medMelding.gruppeMeldinger?.length, 1);
  assert.equal(medMelding.gruppeMeldinger![0].Kilde, "gruppeleder");
  assert.equal(meldingerForPerson(medMelding, "P001").length, 1);
  const melding = medMelding.gruppeMeldinger![0];
  const utkast = byggVarselForMelding(medMelding, melding, [db.personer[0]]);
  assert.equal(utkast.length, 1);
  assert.ok(utkast[0].kropp.includes("Rigging"));
  const manuell = sendVarselManuelt(utkast[0], "kopier");
  assert.ok(manuell.tekstTilKopiering.length > 10);
}

{
  const db = tomDb();
  const utkast = byggVarselForesporsel(db, {
    personId: "P001",
    rolleNavn: "Lyd",
    gudstjenesteDato: "2026-09-01",
  });
  assert.ok(utkast);
  assert.ok(utkast!.kropp.includes("Lyd"));
  assert.ok(utkast!.kropp.includes("instruks"));
}

console.log("kommunikasjon.test.ts: ok");
