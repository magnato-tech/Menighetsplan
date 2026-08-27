import "./polyfill";
import assert from "node:assert/strict";
import type { DatabaseState } from "../types/database";
import {
  arrangementSynligForPerson,
  byggPersonIcs,
  hentInnstillinger,
  innstillingerTilRader,
  kalenderHendelserForPerson,
  minIcalHttpsUrl,
  minIcalOffentligUrl,
  oppdaterInnstillinger,
  parseInnstillinger,
  flettManglendeInnstillinger,
  standardInnstillinger,
  visKalenderForPerson,
  googleKalenderAbonnerUrl,
} from "../services/kalender";
import { opprettArrangement } from "../services/arrangementer";
import { leggInnKalenderoppgave } from "../services/eksternKalender";

function tomDb(): DatabaseState {
  return {
    gruppetyper: [],
    personer: [
      {
        PersonID: "P001",
        Navn: "Ada Medlem",
        Fornavn: "Ada",
        Etternavn: "Medlem",
        Epost: "",
        Telefon: "",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        PersonID: "P002",
        Navn: "Bo Utenfor",
        Fornavn: "Bo",
        Etternavn: "Utenfor",
        Epost: "",
        Telefon: "",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    grupper: [
      {
        GruppeID: "G008",
        Gruppenavn: "Husgruppe sør",
        GruppetypeID: "GT004",
        GruppelederID: "P001",
        Beskrivelse: "",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    gruppemedlemmer: [],
    roller: [],
    personroller: [],
    rollebeskrivelser: [],
    gudstjenester: [
      {
        GudstjenesteID: "GUD001",
        Dato: "2026-10-11",
        Tid: "11:00",
        Sted: "Bedehuset",
        Tema: "Sendt ut i verden",
      },
    ],
    tjenestebehov: [],
    tildelinger: [],
    svar: [],
    malaktiviteter: [],
    maler: [],
    malposter: [],
    malTilleggsvakter: [],
    programaktiviteter: [
      {
        ProgramAktivitetID: "PA001",
        GudstjenesteID: "GUD001",
        Rekkefolge: 1,
        Tittel: "Velkommen",
        VarighetMin: 15,
        ForStart: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
      {
        ProgramAktivitetID: "PA002",
        GudstjenesteID: "GUD001",
        Rekkefolge: 2,
        Tittel: "Talen",
        VarighetMin: 20,
        ForStart: false,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    programinstanser: [],
    arrangementer: [],
    kalenderoppgaver: [],
    innstillinger: standardInnstillinger(),
    personerImport: [],
    gudstjenesterImport: [],
    rollebeskrivelseImport: [],
  };
}

{
  const i = hentInnstillinger(tomDb());
  assert.equal(i.visKalenderMinSide, false);
  assert.equal(i.visKalenderGruppeleder, false);
  assert.equal(i.visKalenderIcal, false);
  assert.equal(visKalenderForPerson(tomDb(), "P001", "minSide"), false);
  assert.deepEqual(parseInnstillinger(undefined), standardInnstillinger());
  assert.equal(parseInnstillinger([{ Nøkkel: "visKalenderIcal", Verdi: "true" }]).visKalenderIcal, true);

  const på = oppdaterInnstillinger(tomDb(), {
    visKalenderMinSide: true,
    visKalenderGruppeleder: true,
    visKalenderIcal: true,
  });
  assert.equal(visKalenderForPerson(på, "P001", "minSide"), true);
  assert.equal(visKalenderForPerson(på, "P001", "gruppeleder"), true);
  assert.equal(visKalenderForPerson(på, "P001", "ical"), true);

  const lagret = {
    visKalenderMinSide: true,
    visKalenderGruppeleder: false,
    visKalenderIcal: true,
    eksternIcalUrl: "https://example.com/kalender.ics",
  };
  assert.deepEqual(parseInnstillinger(innstillingerTilRader(lagret)), lagret);
  assert.equal(
    parseInnstillinger([{ Nøkkel: "eksternIcalUrl", Verdi: "HTTPS://Example.COM/X.ics" }]).eksternIcalUrl,
    "HTTPS://Example.COM/X.ics"
  );

  const flettet = flettManglendeInnstillinger(
    { innstillinger: [] },
    { innstillinger: lagret }
  );
  assert.deepEqual(parseInnstillinger(flettet.innstillinger), lagret);
  const urortInnst = flettManglendeInnstillinger(
    { innstillinger: innstillingerTilRader(standardInnstillinger()) },
    { innstillinger: lagret }
  );
  assert.equal(parseInnstillinger(urortInnst.innstillinger).visKalenderMinSide, false);
}

{
  let db = tomDb();
  db = opprettArrangement(db, {
    tittel: "Bønn og faste",
    dato: "2026-10-13",
    tid: "19:00",
    sted: "Bedehuset",
  });
  db = opprettArrangement(db, {
    tittel: "Husgruppe",
    dato: "2026-10-14",
    tid: "19:00",
    sted: "",
    gruppeId: "G008",
  });
  db = {
    ...db,
    arrangementer: [
      ...db.arrangementer,
      {
        ArrangementID: "AR099",
        Dato: "2026-10-15",
        Tid: "18:00",
        Sted: "",
        Tittel: "Slettet grill",
        Beskrivelse: "",
        Aktiv: false,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
  };
  const aapen = db.arrangementer.find((a) => a.Tittel === "Bønn og faste")!;
  const hus = db.arrangementer.find((a) => a.Tittel === "Husgruppe")!;
  const slettet = db.arrangementer.find((a) => a.ArrangementID === "AR099")!;
  assert.equal(arrangementSynligForPerson(db, "P001", aapen), true);
  assert.equal(arrangementSynligForPerson(db, "P002", aapen), true);
  assert.equal(arrangementSynligForPerson(db, "P001", hus), true);
  assert.equal(arrangementSynligForPerson(db, "P002", hus), false);
  assert.equal(arrangementSynligForPerson(db, "P001", slettet), false);

  const forAda = kalenderHendelserForPerson(db, "P001");
  const forBo = kalenderHendelserForPerson(db, "P002");
  assert.equal(forAda.some((h) => h.kind === "gudstjeneste" && h.id === "GUD001"), true);
  assert.equal(forAda.some((h) => h.tittel === "Bønn og faste"), true);
  assert.equal(forAda.some((h) => h.tittel === "Husgruppe"), true);
  assert.equal(forAda.some((h) => h.tittel === "Slettet grill"), false);
  assert.equal(forBo.some((h) => h.tittel === "Husgruppe"), false);
  assert.equal(forBo.some((h) => h.tittel === "Bønn og faste"), true);
}

{
  const db = tomDb();
  const ics = byggPersonIcs(db, "P001");
  assert.match(ics, /BEGIN:VTIMEZONE/);
  assert.match(ics, /TZID=Europe\/Oslo/);
  assert.match(ics, /DTSTART;TZID=Europe\/Oslo:20261011T110000/);
  assert.doesNotMatch(ics, /VALUE=DATE/);
  assert.match(ics, /DTEND;TZID=Europe\/Oslo:20261011T112000/);
  assert.match(ics, /UID:gudstjeneste-GUD001@menighetsplan/);
}

{
  let db = tomDb();
  db = opprettArrangement(db, {
    tittel: "Husgruppe",
    dato: "2026-10-14",
    tid: "19:00",
    sted: "",
    gruppeId: "G008",
  });
  const ada = byggPersonIcs(db, "P001");
  const bo = byggPersonIcs(db, "P002");
  assert.match(ada, /SUMMARY:Husgruppe/);
  assert.doesNotMatch(bo, /SUMMARY:Husgruppe/);
  assert.match(ada, /DTSTART;TZID=Europe\/Oslo:20261014T190000/);
  assert.match(ada, /DTEND;TZID=Europe\/Oslo:20261014T200000/);
}

{
  let db = tomDb();
  db = {
    ...db,
    grupper: db.grupper.map((g) =>
      g.GruppeID === "G008" ? { ...g, NestlederID: "P002" } : g
    ),
  };
  db = opprettArrangement(db, {
    tittel: "Husgruppe nestleder",
    dato: "2026-10-14",
    tid: "19:00",
    sted: "",
    gruppeId: "G008",
  });
  const hus = db.arrangementer.find((a) => a.Tittel === "Husgruppe nestleder")!;
  assert.equal(arrangementSynligForPerson(db, "P001", hus), true);
  assert.equal(arrangementSynligForPerson(db, "P002", hus), true);
}

{
  assert.equal(
    minIcalHttpsUrl("https://script.google.com/macros/s/x/exec/", "mk_abc"),
    "https://script.google.com/macros/s/x/exec?action=minIcal&t=mk_abc"
  );
  assert.equal(
    minIcalHttpsUrl("https://script.google.com/macros/s/x/exec?foo=1", "mk_abc"),
    "https://script.google.com/macros/s/x/exec?action=minIcal&t=mk_abc"
  );
  assert.equal(minIcalHttpsUrl("", "mk_abc"), "");
  assert.equal(minIcalHttpsUrl("https://script.google.com/macros/s/x/exec", ""), "");

  const ics = minIcalHttpsUrl("https://script.google.com/macros/s/x/exec", "mk_abc");
  const u = googleKalenderAbonnerUrl(ics);
  assert.match(u, /^https:\/\/calendar\.google\.com\/calendar\/r\?cid=/);
  assert.ok(u.includes(encodeURIComponent("webcal://script.google.com/macros/s/x/exec?action=minIcal&t=mk_abc")));
  assert.ok(!u.includes(encodeURIComponent(ics)), "cid skal være webcal, ikke https");
  assert.equal(googleKalenderAbonnerUrl(""), "");

  assert.equal(
    minIcalOffentligUrl("mk_abc"),
    "https://gudstjenesteplanlegger2-0.vercel.app/kalender/mk_abc.ics"
  );
  assert.equal(minIcalOffentligUrl(""), "");
  const offentlig = minIcalOffentligUrl("mk_abc");
  const googleOffentlig = googleKalenderAbonnerUrl(offentlig);
  assert.ok(
    googleOffentlig.includes(
      encodeURIComponent("webcal://gudstjenesteplanlegger2-0.vercel.app/kalender/mk_abc.ics")
    )
  );
  assert.ok(!offentlig.includes("?t="), "offentlig iCal-URL skal ikke bruke query");
}

{
  let db = tomDb();
  db = {
    ...db,
    kalenderoppgaver: [
      {
        KalenderoppgaveID: "KO001",
        EksternUID: "kirke-uid-1",
        Dato: "13.10.2026",
        Tid: "19:00",
        Sted: "Bedehuset",
        Tittel: "Bønnemøte fra kirken",
        Beskrivelse: "",
        Status: "Åpen",
        OpprettetDato: "2026-08-27",
        SistEndret: "2026-08-27",
      },
    ],
  };
  db = leggInnKalenderoppgave(db, "KO001", "P001");
  const icsAda = byggPersonIcs(db, "P001");
  const icsBo = byggPersonIcs(db, "P002");
  assert.match(icsAda, /SUMMARY:Bønnemøte fra kirken/);
  assert.match(icsBo, /SUMMARY:Bønnemøte fra kirken/);
  assert.match(icsBo, /DTSTART;TZID=Europe\/Oslo:20261013T190000/);
  const kirke = db.arrangementer.find((a) => a.Tittel === "Bønnemøte fra kirken")!;
  db = {
    ...db,
    arrangementer: db.arrangementer.map((a) =>
      a.ArrangementID === kirke.ArrangementID ? { ...a, GruppeID: "G008" } : a
    ),
  };
  assert.match(byggPersonIcs(db, "P002"), /SUMMARY:Bønnemøte fra kirken/);
  db = opprettArrangement(db, {
    tittel: "Husgruppe lukket",
    dato: "2026-10-14",
    tid: "19:00",
    sted: "",
    gruppeId: "G008",
  });
  const medHusAda = byggPersonIcs(db, "P001");
  const medHusBo = byggPersonIcs(db, "P002");
  assert.match(medHusAda, /SUMMARY:Husgruppe lukket/);
  assert.doesNotMatch(medHusBo, /SUMMARY:Husgruppe lukket/);
}

console.log("kalender.test.ts: alle tester ok");
