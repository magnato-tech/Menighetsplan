import "./polyfill";
import assert from "node:assert/strict";
import {
  avvisKalenderoppgave,
  icalHendelseFinnesIAppen,
  icalHendelser,
  korrigerIcalHeldagsTilKlokkeslett,
  leggInnKalenderoppgave,
  synkKalenderoppgaver,
} from "../services/eksternKalender";
import { slettArrangement } from "../services/arrangementer";
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

console.log("eksternKalender.test.ts: alle tester ok");
