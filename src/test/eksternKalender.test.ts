import "./polyfill";
import assert from "node:assert/strict";
import {
  avvisKalenderoppgave,
  icalHendelseFinnesIAppen,
  icalHendelser,
  korrigerIcalHeldagsTilKlokkeslett,
  leggInnKalenderoppgave,
  synkKalenderoppgaver,
  icsTekstFraSvar,
  icalGasPostInit,
  icalHentUrlKandidater,
  icalHentUrlKandidaterForSynk,
  erKjentEksternIcalAction,
  EKSTERN_ICAL_ACTIONS,
  synkFeilMedKilde,
  gyldigIcalHttpUrl,
  icalFeedUrl,
  KIRKE_ICAL_KATEGORI_URL,
} from "../services/eksternKalender";
import { slettArrangement } from "../services/arrangementer";
import {
  flettLastetMedLokalCache,
  flettManglendeKalenderdata,
  kalenderBleUtvidetFraCache,
} from "../services/persistens";
import type { DatabaseState } from "../types/database";

function tomDb(): DatabaseState {
  return {
    gruppetyper: [],
    personer: [],
    grupper: [],
    gruppemedlemmer: [],
    roller: [],
    personroller: [],
    rollebeskrivelser: [],
    gudstjenester: [
      {
        GudstjenesteID: "GUD001",
        Dato: "2026-09-06",
        Tid: "11:00",
        Sted: "Bedehuset",
        Tema: "Søndagsgudstjeneste",
        EksternKalenderID: "uid-gud@kirke",
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

const icsMedTid = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:uid-gud@kirke
DTSTART;VALUE=DATE:20260906T110000
SUMMARY:Gudstjeneste
LOCATION:Bedehuset
END:VEVENT
BEGIN:VEVENT
UID:uid-bønn@kirke
DTSTART:20260908T190000
SUMMARY:Bønnemøte
LOCATION:Bedehuset
END:VEVENT
END:VCALENDAR`;

{
  const rettet = korrigerIcalHeldagsTilKlokkeslett(icsMedTid);
  assert.match(rettet, /DTSTART:20260906T110000/);
  assert.doesNotMatch(rettet, /DTSTART;VALUE=DATE:20260906T110000/);
}

{
  const hendelser = icalHendelser(icsMedTid);
  assert.equal(hendelser.length, 2);
  assert.equal(hendelser[0].dato, "2026-09-06");
  assert.equal(hendelser[0].tid, "11:00");
  assert.equal(hendelser[1].tittel, "Bønnemøte");
}

{
  const kirkeIcs = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:uid-gud-utc@kirke
DTSTART;VALUE=DATE:20260913T090000Z
SUMMARY:Gudstjeneste
END:VEVENT
BEGIN:VEVENT
UID:uid-gud-vinter@kirke
DTSTART;VALUE=DATE:20261108T100000Z
SUMMARY:Gudstjeneste
END:VEVENT
END:VCALENDAR`;
  const hendelser = icalHendelser(kirkeIcs);
  assert.equal(hendelser[0].dato, "2026-09-13");
  assert.equal(hendelser[0].tid, "11:00", "09:00Z om sommeren er 11:00 i Oslo");
  assert.equal(hendelser[1].dato, "2026-11-08");
  assert.equal(hendelser[1].tid, "11:00", "10:00Z om vinteren er 11:00 i Oslo");
}

{
  const db = tomDb();
  const gud = icalHendelser(icsMedTid)[0];
  const bønn = icalHendelser(icsMedTid)[1];
  assert.equal(icalHendelseFinnesIAppen(gud, db), true);
  assert.equal(icalHendelseFinnesIAppen(bønn, db), false);
}

{
  const db = tomDb();
  const synk = synkKalenderoppgaver(db, icsMedTid);
  assert.equal(synk.nye, 1);
  assert.equal(synk.db.kalenderoppgaver.length, 1);
  assert.equal(synk.db.kalenderoppgaver[0].Tittel, "Bønnemøte");
  assert.equal(synk.db.kalenderoppgaver[0].Status, "Åpen");
  const igjen = synkKalenderoppgaver(synk.db, icsMedTid);
  assert.equal(igjen.nye, 0, "eksisterende oppgave skal ikke lages på nytt");
}

{
  const db = synkKalenderoppgaver(tomDb(), icsMedTid).db;
  const id = db.kalenderoppgaver[0].KalenderoppgaveID;
  const avvist = avvisKalenderoppgave(db, id);
  assert.equal(avvist.kalenderoppgaver[0].Status, "Avvist");
  const igjen = synkKalenderoppgaver(avvist, icsMedTid);
  assert.equal(igjen.nye, 0, "avvist oppgave skal ikke spørres på nytt");
}

{
  const db = synkKalenderoppgaver(tomDb(), icsMedTid).db;
  const id = db.kalenderoppgaver[0].KalenderoppgaveID;
  const lagtInn = leggInnKalenderoppgave(db, id, "P001");
  assert.equal(lagtInn.kalenderoppgaver[0].Status, "Opprettet");
  assert.equal(lagtInn.arrangementer.length, 1);
  assert.equal(lagtInn.arrangementer[0].Tittel, "Bønnemøte");
  assert.equal(lagtInn.arrangementer[0].Beskrivelse, "");
  assert.equal(lagtInn.arrangementer[0].EksternKalenderID, "uid-bønn@kirke");
  assert.equal(lagtInn.arrangementer[0].MalID, undefined);
  assert.equal(lagtInn.tjenestebehov.length, 0);
  assert.equal(lagtInn.tildelinger.length, 0);
  assert.equal(lagtInn.programaktiviteter.length, 0);
  const igjen = synkKalenderoppgaver(lagtInn, icsMedTid);
  assert.equal(igjen.nye, 0);
}

{
  const db = synkKalenderoppgaver(tomDb(), icsMedTid).db;
  const id = db.kalenderoppgaver[0].KalenderoppgaveID;
  const lagtInn = leggInnKalenderoppgave(db, id, "P001");
  const slettet = slettArrangement(lagtInn, lagtInn.arrangementer[0].ArrangementID);
  assert.equal(slettet.arrangementer[0].Aktiv, false);
  assert.equal(slettet.kalenderoppgaver[0].Status, "Åpen");
  assert.equal(slettet.kalenderoppgaver[0].ArrangementID, undefined);
  const synkIgjen = synkKalenderoppgaver(slettet, icsMedTid);
  assert.equal(synkIgjen.nye, 0, "åpen oppgave etter slett skal ikke dupliseres");
  assert.equal(synkIgjen.db.kalenderoppgaver.filter((o) => o.Status === "Åpen").length, 1);
}

{
  const db = synkKalenderoppgaver(tomDb(), icsMedTid).db;
  const lagtInn = leggInnKalenderoppgave(db, db.kalenderoppgaver[0].KalenderoppgaveID, "P001");
  const gammelSlett = {
    ...lagtInn,
    arrangementer: lagtInn.arrangementer.map((a) => ({ ...a, Aktiv: false })),
  };
  assert.equal(gammelSlett.kalenderoppgaver[0].Status, "Opprettet");
  const synk = synkKalenderoppgaver(gammelSlett, icsMedTid);
  assert.equal(synk.nye, 1);
  assert.equal(synk.db.kalenderoppgaver[0].Status, "Åpen");
  assert.equal(synk.db.kalenderoppgaver[0].ArrangementID, undefined);
}

{
  const exec = "https://script.google.com/macros/s/PRODDEPLOY/exec";
  const dev = icalHentUrlKandidater(exec, "dev");
  assert.equal(dev[0], `${exec}?action=eksternIcalJson`, "H: GAS først, samme sti som prod");
  assert.equal(dev[dev.length - 1], "/kirke-ical", "H: Vite-proxy bare som siste utvei");
  assert.equal(dev.includes("/kirke-ical"), true);
  const prod = icalHentUrlKandidater(exec, "prod");
  assert.equal(prod.includes("/kirke-ical"), false, "H: prod har ikke /kirke-ical");
  assert.deepEqual(prod, [`${exec}?action=eksternIcalJson`, `${exec}?action=eksternIcal`]);
}

{
  const gammel = "https://script.google.com/macros/s/GAMMEL/exec";
  const gjeldende = "https://script.google.com/macros/s/PRODDEPLOY/exec";
  const urls = icalHentUrlKandidaterForSynk(gammel, gjeldende, "prod");
  assert.equal(urls.length, 4, "F: gammel localStorage-URL + default /exec");
  assert.equal(urls.filter((u) => u.includes("GAMMEL")).length, 2);
  assert.equal(urls.filter((u) => u.includes("PRODDEPLOY")).length, 2);
  assert.deepEqual(icalHentUrlKandidaterForSynk(gjeldende, gjeldende, "prod").length, 2);
}

{
  const kirke = icalGasPostInit("/kirke-ical");
  assert.equal(kirke.init.method, undefined, "H: kirkefeeden er GET");
  const gas = icalGasPostInit("https://script.google.com/macros/s/x/exec?action=eksternIcal");
  assert.equal(gas.init.method, "POST", "B: prod poster som load/save");
  assert.equal(JSON.parse(String(gas.init.body)).action, "eksternIcalJson");
  const typo = icalGasPostInit("https://script.google.com/macros/s/x/exec?action=eksternlcal");
  assert.equal(typo.init.method, "POST", "G: I/l-variant skal også postes");
  const medUrl = icalGasPostInit(
    "https://script.google.com/macros/s/x/exec?action=eksternIcal",
    undefined,
    "https://example.com/kalender.ics"
  );
  assert.equal(JSON.parse(String(medUrl.init.body)).icalUrl, "https://example.com/kalender.ics");
  assert.equal(gyldigIcalHttpUrl("ftp://x"), "");
  assert.equal(gyldigIcalHttpUrl("webcal://example.com/x.ics"), "https://example.com/x.ics");
  assert.equal(icalFeedUrl(""), KIRKE_ICAL_KATEGORI_URL);
  assert.equal(icalFeedUrl("https://annen.kirke.no/cal.ics"), "https://annen.kirke.no/cal.ics");
}

{
  assert.equal(erKjentEksternIcalAction("eksternIcal"), true);
  assert.equal(erKjentEksternIcalAction("eksternIcalJson"), true);
  assert.equal(erKjentEksternIcalAction("eksternlcal"), true);
  assert.equal(erKjentEksternIcalAction("load"), false);
  assert.deepEqual([...EKSTERN_ICAL_ACTIONS], ["eksternIcal", "eksternIcalJson"]);
}

{
  assert.equal(icsTekstFraSvar("BEGIN:VCALENDAR"), "BEGIN:VCALENDAR");
  assert.match(icsTekstFraSvar(JSON.stringify({ ok: true, ics: "BEGIN:VCALENDAR" })), /BEGIN:VCALENDAR/);
  assert.throws(
    () => icsTekstFraSvar(JSON.stringify({ ok: false, error: "Ukjent action: eksternIcal" })),
    /Ukjent action: eksternIcal/
  );
}

{
  const feil = synkFeilMedKilde(
    "Ukjent action: eksternIcal",
    "https://script.google.com/macros/s/AKfycbznLoq62orP53izSEA0wnA7VdQHiNWpP3upTo2nd1owcL3LDZp13gK8LxrAdsjxWwt7vw/exec"
  );
  assert.match(feil, /Ukjent action: eksternIcal/);
  assert.match(feil, /Wwt7vw\/exec/);
  assert.equal(synkFeilMedKilde("feil", ""), "feil");
}

{
  assert.equal(icalHentUrlKandidater("", "prod").length, 0);
}

{
  const gammel = {
    arrangementer: [
      {
        ArrangementID: "AR001",
        Dato: "2026-10-10",
        Tid: "18:00",
        Sted: "Bedehuset",
        Tittel: "Bønn for Norge",
        Beskrivelse: "",
        Aktiv: true,
        OpprettetDato: "2026-08-27",
        SistEndret: "2026-08-27",
      },
    ],
    kalenderoppgaver: [
      {
        KalenderoppgaveID: "KO001",
        EksternUID: "uid-1",
        Dato: "2026-10-10",
        Tid: "18:00",
        Sted: "Bedehuset",
        Tittel: "Bønn for Norge",
        Beskrivelse: "",
        Status: "Opprettet" as const,
        ArrangementID: "AR001",
        OpprettetDato: "2026-08-27",
        SistEndret: "2026-08-27",
      },
    ],
    tjenestebehov: [
      {
        TjenestebehovID: "TB-AR",
        GudstjenesteID: "",
        ArrangementID: "AR001",
        RolleID: "R001",
        Antall: 1,
        Aktiv: true,
        OpprettetDato: "2026-08-27",
        SistEndret: "2026-08-27",
      },
    ],
  };
  const flettet = flettManglendeKalenderdata(
    { arrangementer: [], kalenderoppgaver: [], tjenestebehov: [] },
    gammel
  );
  assert.equal(flettet.arrangementer?.length, 1);
  assert.equal(flettet.kalenderoppgaver?.[0].Status, "Opprettet");
  assert.equal(flettet.tjenestebehov?.length, 1);
  const lastet = flettLastetMedLokalCache({ arrangementer: [], kalenderoppgaver: [] }, gammel);
  assert.equal(lastet.arrangementer?.length, 1);
  const urort = flettManglendeKalenderdata(
    { arrangementer: [{ ...gammel.arrangementer[0], Tittel: "Ny" }], kalenderoppgaver: [] },
    gammel
  );
  assert.equal(urort.arrangementer?.[0].Tittel, "Ny");
  const union = flettManglendeKalenderdata(
    {
      arrangementer: [
        {
          ...gammel.arrangementer[0],
          ArrangementID: "AR002",
          Tittel: "Ny bønn",
        },
      ],
      kalenderoppgaver: [],
    },
    gammel
  );
  assert.equal(union.arrangementer?.length, 2);
  assert.equal(
    kalenderBleUtvidetFraCache({ arrangementer: [], kalenderoppgaver: [] }, gammel),
    true
  );
  assert.equal(
    kalenderBleUtvidetFraCache(
      { arrangementer: gammel.arrangementer, kalenderoppgaver: gammel.kalenderoppgaver },
      gammel
    ),
    false
  );
}

console.log("eksternKalender.test.ts: alle tester ok");
