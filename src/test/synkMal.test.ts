import "./polyfill";
import assert from "node:assert/strict";
import {
  initialRoller,
  MAL_GRUPPEMØTE_ID,
  MAL_GUDSTJENESTE_ID,
} from "../data/initialData";
import { opprettArrangement, slettArrangement } from "../services/arrangementer";
import { icsTekstFraSvar, leggInnKalenderoppgave, synkKalenderoppgaver } from "../services/eksternKalender";
import {
  bemanningForArrangement,
  bemanningFraMal,
  foreslaMalId,
  leggTilArrangementVakt,
  leggTilMalTilleggsvakt,
  nyMalPost,
  opprettMal,
  sikreStandardMaler,
  sortertMalposter,
} from "../services/mal";
import { applyLoadedState } from "../services/persistens";
import { programForGudstjeneste, tilbakestillProgramFraMal } from "../services/program";
import type { DatabaseState } from "../types/database";

const GUD_ID = "GUD001";
const GUD_UID = "uid-gud@kirke";
const FASTE_UID = "uid-faste@kirke";
const LILLESAND_UID = "uid-lillesand@kirke";
const BONN_UID = "uid-bonn@kirke";
const MALAKTIVITET_ID = "MA001";

const icsKirke = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:${GUD_UID}
DTSTART:20261011T110000
SUMMARY:Gudstjeneste
LOCATION:Bedehuset
END:VEVENT
BEGIN:VEVENT
UID:${FASTE_UID}
DTSTART:20261013T190000
SUMMARY:Bønn og faste
LOCATION:Bedehuset
END:VEVENT
BEGIN:VEVENT
UID:${LILLESAND_UID}
DTSTART:20261020T190000
SUMMARY:Bønn for Lillesand
LOCATION:Bedehuset
END:VEVENT
BEGIN:VEVENT
UID:${BONN_UID}
DTSTART:20261027T190000
SUMMARY:Bønn
LOCATION:Bedehuset
END:VEVENT
END:VCALENDAR`;

function tomUtenMaler(): DatabaseState {
  return {
    gruppetyper: [],
    personer: [],
    grupper: [],
    gruppemedlemmer: [],
    roller: initialRoller,
    personroller: [],
    rollebeskrivelser: [],
    gudstjenester: [
      {
        GudstjenesteID: GUD_ID,
        Dato: "2026-10-11",
        Tid: "11:00",
        Sted: "Bedehuset",
        Tema: "Sendt ut i verden",
        EksternKalenderID: GUD_UID,
      },
    ],
    tjenestebehov: [],
    tildelinger: [],
    svar: [],
    malaktiviteter: [
      {
        MalAktivitetID: MALAKTIVITET_ID,
        Rekkefolge: 1,
        Tittel: "Velkommen ved inngang",
        VarighetMin: 15,
        RolleID: "R008",
        ForStart: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
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

function leggPosterPåMal(db: DatabaseState, malId: string, titler: { tittel: string; rolleId: string }[]) {
  let neste = db;
  for (const rad of titler) {
    const post = nyMalPost(neste.malposter, malId);
    neste = {
      ...neste,
      malposter: [
        ...neste.malposter,
        { ...post, Tittel: rad.tittel, RolleID: rad.rolleId, VarighetMin: 5 },
      ],
    };
  }
  return neste;
}

function katalog(): { db: DatabaseState; malBonn: string; malFaste: string; malLillesand: string } {
  let db = sikreStandardMaler(tomUtenMaler());
  const bonn = opprettMal(db, "Bønn");
  const faste = opprettMal(bonn.db, "Bønn og faste");
  const lillesand = opprettMal(faste.db, "Bønn for Lillesand");
  db = leggPosterPåMal(lillesand.db, faste.malId, [
    { tittel: "Åpning", rolleId: "R001" },
    { tittel: "Stille bønn", rolleId: "R001" },
  ]);
  db = leggTilMalTilleggsvakt(db, faste.malId, "R006");
  return {
    db,
    malBonn: bonn.malId,
    malFaste: faste.malId,
    malLillesand: lillesand.malId,
  };
}

function oppgaveForTittel(db: DatabaseState, tittel: string) {
  const o = db.kalenderoppgaver.find((x) => x.Tittel === tittel);
  assert.ok(o, `mangler kalenderoppgave for ${tittel}`);
  return o;
}

function malaktiviteterUendret(db: DatabaseState) {
  assert.equal(db.malaktiviteter.length, 1);
  assert.equal(db.malaktiviteter[0].MalAktivitetID, MALAKTIVITET_ID);
  assert.equal(db.malaktiviteter[0].Tittel, "Velkommen ved inngang");
}

{
  const { db, malBonn, malFaste, malLillesand } = katalog();
  assert.equal(foreslaMalId(db, "Bønn og faste"), malFaste);
  assert.notEqual(foreslaMalId(db, "Bønn og faste"), malBonn);
  assert.equal(foreslaMalId(db, "Bønn for Lillesand"), malLillesand);
  assert.equal(foreslaMalId(db, "Bønn"), malBonn);
  assert.equal(foreslaMalId(db, "Gudstjeneste 11:00"), MAL_GUDSTJENESTE_ID);
  assert.equal(foreslaMalId(db, "Husgruppe onsdag"), MAL_GRUPPEMØTE_ID);
}

{
  const { db: start, malFaste } = katalog();
  const malaktiviteterFør = start.malaktiviteter.map((m) => ({ ...m }));
  const synk = synkKalenderoppgaver(start, icsKirke);
  assert.equal(synk.nye, 3, "søndag som allerede finnes skal ikke bli oppgave");
  assert.equal(
    synk.db.kalenderoppgaver.some((o) => o.EksternUID === GUD_UID),
    false
  );

  const fasteOppgave = oppgaveForTittel(synk.db, "Bønn og faste");
  const malId = foreslaMalId(synk.db, fasteOppgave.Tittel);
  assert.equal(malId, malFaste);
  const lagt = leggInnKalenderoppgave(synk.db, fasteOppgave.KalenderoppgaveID, "P001", malId);
  const oppgave = oppgaveForTittel(lagt, "Bønn og faste");
  assert.equal(oppgave.Status, "Opprettet");
  const arr = lagt.arrangementer.find((a) => a.ArrangementID === oppgave.ArrangementID);
  assert.ok(arr);
  assert.equal(arr.Aktiv, true);
  assert.equal(arr.MalID, malFaste);
  assert.equal(arr.EksternKalenderID, FASTE_UID);

  const behovRoller = lagt.tjenestebehov
    .filter((t) => t.ArrangementID === arr.ArrangementID)
    .map((t) => t.RolleID)
    .sort();
  const malRoller = bemanningFraMal(lagt, malFaste)
    .map((r) => r.rolleId)
    .sort();
  assert.deepEqual(behovRoller, malRoller);
  assert.ok(malRoller.includes("R001"));
  assert.ok(malRoller.includes("R006"));

  const poster = sortertMalposter(lagt, malFaste);
  const program = programForGudstjeneste(lagt, "", arr.ArrangementID);
  assert.equal(program.length, poster.length);
  assert.equal(program[0].Tittel, poster[0].Tittel);
  assert.equal(programForGudstjeneste(lagt, GUD_ID).length, 0);
  malaktiviteterUendret(lagt);
  assert.deepEqual(
    lagt.malaktiviteter.map((m) => m.Tittel),
    malaktiviteterFør.map((m) => m.Tittel)
  );

  const igjen = synkKalenderoppgaver(lagt, icsKirke);
  assert.equal(igjen.nye, 0);
}

{
  const { db: start } = katalog();
  const synk = synkKalenderoppgaver(start, icsKirke);
  const fasteOppgave = oppgaveForTittel(synk.db, "Bønn og faste");
  const lagt = leggInnKalenderoppgave(
    synk.db,
    fasteOppgave.KalenderoppgaveID,
    "P001",
    MAL_GRUPPEMØTE_ID
  );
  const arr = lagt.arrangementer.find((a) => a.EksternKalenderID === FASTE_UID);
  assert.ok(arr);
  assert.equal(arr.MalID, MAL_GRUPPEMØTE_ID);
  assert.equal(programForGudstjeneste(lagt, "", arr.ArrangementID).length, 0);
  const behov = lagt.tjenestebehov.filter((t) => t.ArrangementID === arr.ArrangementID);
  assert.deepEqual(
    behov.map((t) => t.RolleID).sort(),
    bemanningFraMal(lagt, MAL_GRUPPEMØTE_ID)
      .map((r) => r.rolleId)
      .sort()
  );
  malaktiviteterUendret(lagt);
}

{
  const { db: start, malFaste } = katalog();
  const synk = synkKalenderoppgaver(start, icsKirke);
  const fasteOppgave = oppgaveForTittel(synk.db, "Bønn og faste");
  const lagt = leggInnKalenderoppgave(synk.db, fasteOppgave.KalenderoppgaveID, "P001", malFaste);
  const førsteId = lagt.arrangementer.find((a) => a.EksternKalenderID === FASTE_UID)!.ArrangementID;
  const slettet = slettArrangement(lagt, førsteId);
  assert.equal(slettet.arrangementer.find((a) => a.ArrangementID === førsteId)?.Aktiv, false);
  const åpen = oppgaveForTittel(slettet, "Bønn og faste");
  assert.equal(åpen.Status, "Åpen");
  assert.equal(åpen.ArrangementID, undefined);
  const synkIgjen = synkKalenderoppgaver(slettet, icsKirke);
  assert.equal(synkIgjen.nye, 0);
  assert.equal(synkIgjen.db.kalenderoppgaver.filter((o) => o.Tittel === "Bønn og faste").length, 1);

  const lagtIgjen = leggInnKalenderoppgave(
    synkIgjen.db,
    oppgaveForTittel(synkIgjen.db, "Bønn og faste").KalenderoppgaveID,
    "P001",
    malFaste
  );
  const aktive = lagtIgjen.arrangementer.filter((a) => a.EksternKalenderID === FASTE_UID && a.Aktiv !== false);
  assert.equal(aktive.length, 1);
  assert.notEqual(aktive[0].ArrangementID, førsteId);
  assert.equal(
    programForGudstjeneste(lagtIgjen, "", aktive[0].ArrangementID).length,
    sortertMalposter(lagtIgjen, malFaste).length
  );
}

{
  const { db: start, malFaste } = katalog();
  const synk = synkKalenderoppgaver(start, icsKirke);
  const lagt = leggInnKalenderoppgave(
    synk.db,
    oppgaveForTittel(synk.db, "Bønn og faste").KalenderoppgaveID,
    "P001",
    malFaste
  );
  const arId = lagt.arrangementer.find((a) => a.EksternKalenderID === FASTE_UID)!.ArrangementID;
  const medVakt = leggTilArrangementVakt(lagt, arId, "R013");
  const bem = bemanningForArrangement(medVakt, arId) || [];
  assert.equal(bem.some((r) => r.rolleId === "R013" && r.kilde === "tillegg"), true);
  assert.equal(bem.some((r) => r.rolleId === "R001" && r.kilde === "kjoreplan"), true);

  const endret = {
    ...medVakt,
    programaktiviteter: medVakt.programaktiviteter.map((p) =>
      p.ArrangementID === arId && p.Rekkefolge === 1 ? { ...p, Tittel: "Endret i kortet" } : p
    ),
  };
  assert.equal(programForGudstjeneste(endret, "", arId)[0].Tittel, "Endret i kortet");
  const tilbakestilt = tilbakestillProgramFraMal(endret, "", arId);
  assert.equal(programForGudstjeneste(tilbakestilt, "", arId)[0].Tittel, "Åpning");
  assert.notEqual(programForGudstjeneste(tilbakestilt, "", arId)[0].Tittel, "Velkommen ved inngang");
  malaktiviteterUendret(tilbakestilt);

  const toAvSamme = opprettArrangement(tilbakestilt, {
    tittel: "Bønn og faste (ekstra)",
    dato: "2026-11-03",
    tid: "19:00",
    sted: "Bedehuset",
    malId: malFaste,
  });
  const andreId = toAvSamme.arrangementer.find((a) => a.Tittel === "Bønn og faste (ekstra)")!.ArrangementID;
  const kunAndreEndret = {
    ...toAvSamme,
    programaktiviteter: toAvSamme.programaktiviteter.map((p) =>
      p.ArrangementID === andreId && p.Rekkefolge === 1 ? { ...p, Tittel: "Bare den andre" } : p
    ),
  };
  assert.equal(programForGudstjeneste(kunAndreEndret, "", arId)[0].Tittel, "Åpning");
  assert.equal(programForGudstjeneste(kunAndreEndret, "", andreId)[0].Tittel, "Bare den andre");
}

{
  const lastet = applyLoadedState(tomUtenMaler());
  assert.ok(lastet.maler.some((m) => m.MalID === MAL_GUDSTJENESTE_ID));
  assert.ok(lastet.maler.some((m) => m.MalID === MAL_GRUPPEMØTE_ID));
  assert.ok(lastet.malposter.length > 0);

  const { db: medKatalog, malFaste } = katalog();
  const fasteNavn = medKatalog.maler.find((m) => m.MalID === malFaste)?.Navn;
  const posterFør = sortertMalposter(medKatalog, malFaste).map((p) => p.Tittel);
  const igjen = applyLoadedState(medKatalog);
  assert.equal(igjen.maler.find((m) => m.MalID === malFaste)?.Navn, fasteNavn);
  assert.deepEqual(
    sortertMalposter(igjen, malFaste).map((p) => p.Tittel),
    posterFør
  );
  assert.equal(igjen.maler.some((m) => m.Navn === "Bønn og faste"), true);
}

{
  const jsonOk = JSON.stringify({ ok: true, ics: icsKirke });
  assert.equal(icsTekstFraSvar(jsonOk), icsKirke);
  assert.throws(() => icsTekstFraSvar(JSON.stringify({ ok: false, error: "Kalender nede" })), /Kalender nede/);
  assert.equal(icsTekstFraSvar(icsKirke), icsKirke);

  const { db } = katalog();
  const fraJson = synkKalenderoppgaver(db, icsTekstFraSvar(jsonOk));
  const fraRaa = synkKalenderoppgaver(db, icsKirke);
  assert.equal(fraJson.nye, fraRaa.nye);
  assert.deepEqual(
    fraJson.db.kalenderoppgaver.map((o) => o.Tittel).sort(),
    fraRaa.db.kalenderoppgaver.map((o) => o.Tittel).sort()
  );
}

console.log("synkMal.test.ts: alle tester ok");
