import "./polyfill";
import assert from "node:assert/strict";
import {
  initialMaler,
  initialMalposter,
  initialRoller,
  MAL_ARRANGEMENT_ID,
  MAL_GRUPPEMØTE_ID,
  MAL_GUDSTJENESTE_ID,
} from "../data/initialData";
import {
  bemanningForArrangement,
  bemanningFraMal,
  foreslaMalId,
  kjoreplanRolleIder,
  kopierMal,
  leggTilArrangementVakt,
  leggTilMalTilleggsvakt,
  opprettMal,
  sikreStandardMaler,
  sikreTjenestebehovFraMal,
  slettMalTilleggsvakt,
} from "../services/mal";
import { opprettArrangement } from "../services/arrangementer";
import { opprettProgramFraMal, programForGudstjeneste } from "../services/program";
import type { DatabaseState } from "../types/database";

function tomUtenMaler(): DatabaseState {
  return {
    gruppetyper: [],
    personer: [],
    grupper: [],
    gruppemedlemmer: [],
    roller: initialRoller,
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
    personerImport: [],
    gudstjenesterImport: [],
    rollebeskrivelseImport: [],
  };
}

{
  const db = sikreStandardMaler(tomUtenMaler());
  assert.equal(db.maler.length, initialMaler.length);
  assert.equal(db.malaktiviteter.length, 0, "søndagsmalen skal ikke flyttes");
  assert.equal(
    db.malposter.filter((p) => p.MalID === MAL_GUDSTJENESTE_ID).length,
    initialMalposter.length
  );
  assert.equal(db.malposter.filter((p) => p.MalID === MAL_GRUPPEMØTE_ID).length, 0);
  const igjen = sikreStandardMaler({ ...db, maler: [{ ...db.maler[0], Navn: "Egendefinert" }] });
  assert.equal(
    igjen.maler.find((m) => m.MalID === MAL_GUDSTJENESTE_ID)?.Navn,
    "Egendefinert",
    "ikke overskriv eksisterende maler"
  );
  assert.ok(igjen.maler.some((m) => m.MalID === MAL_ARRANGEMENT_ID));
  assert.ok(igjen.maler.some((m) => m.MalID === MAL_GRUPPEMØTE_ID));
}

{
  const db = sikreStandardMaler(tomUtenMaler());
  const unike = kjoreplanRolleIder(db, MAL_GUDSTJENESTE_ID);
  assert.deepEqual(unike, ["R008", "R005", "R001", "R004", "R002", "R003"]);
  const nattverd = db.malposter.find((p) => p.Tittel.toLowerCase().includes("nattverd"));
  assert.ok(nattverd);
  assert.equal(String(nattverd?.RolleID || ""), "");
  const bem = bemanningFraMal(db, MAL_GUDSTJENESTE_ID);
  const kjore = bem.filter((r) => r.kilde === "kjoreplan").map((r) => r.rolleId);
  const tillegg = bem.filter((r) => r.kilde === "tillegg").map((r) => r.rolleId);
  assert.deepEqual(kjore, unike);
  assert.ok(tillegg.includes("R006"));
  assert.ok(tillegg.includes("R009"));
  assert.ok(!tillegg.includes("R001"));
  assert.equal(bemanningFraMal(db, MAL_GRUPPEMØTE_ID).length, 0);
  assert.equal(bemanningFraMal(db, MAL_ARRANGEMENT_ID).length, 0);
}

{
  const db = sikreStandardMaler(tomUtenMaler());
  const avvist = leggTilMalTilleggsvakt(db, MAL_GUDSTJENESTE_ID, "R001");
  assert.equal(avvist.malTilleggsvakter.length, db.malTilleggsvakter.length);
  const lyd = db.malTilleggsvakter.find((t) => t.RolleID === "R006");
  assert.ok(lyd);
  const utenLyd = slettMalTilleggsvakt(db, lyd!.MalTilleggsvaktID);
  const lagt = leggTilMalTilleggsvakt(utenLyd, MAL_GUDSTJENESTE_ID, "R006");
  assert.equal(lagt.malTilleggsvakter.some((t) => t.RolleID === "R006" && t.MalID === MAL_GUDSTJENESTE_ID), true);
}

{
  const db = sikreStandardMaler(tomUtenMaler());
  assert.equal(foreslaMalId(db, "Gudstjeneste 11:00"), MAL_GUDSTJENESTE_ID);
  assert.equal(foreslaMalId(db, "Bønn for Lillesand"), MAL_ARRANGEMENT_ID);
  assert.equal(foreslaMalId(db, "Gruppemøte onsdag"), MAL_GRUPPEMØTE_ID);
  assert.equal(foreslaMalId(db, "Husgruppe onsdag"), MAL_GRUPPEMØTE_ID);
  assert.equal(foreslaMalId(db, "Konsert i bedehuset"), MAL_ARRANGEMENT_ID);
  const medBonn = opprettMal(db, "Bønnemøte");
  assert.equal(foreslaMalId(medBonn.db, "Bønn og faste"), medBonn.malId);
}

{
  const db = sikreStandardMaler(tomUtenMaler());
  const ny = opprettMal(db, "Onsdagsgruppe");
  assert.match(ny.malId, /^MAL\d+$/);
  assert.equal(ny.db.maler.some((m) => m.MalID === ny.malId && m.Navn === "Onsdagsgruppe"), true);
  assert.equal(ny.db.malposter.filter((p) => p.MalID === ny.malId).length, 0);
  const kopi = kopierMal(ny.db, MAL_GUDSTJENESTE_ID, "Gudstjeneste kort");
  assert.equal(kopi.db.malposter.filter((p) => p.MalID === kopi.malId).length, initialMalposter.length);
  assert.equal(kopi.db.malaktiviteter.length, 0);
  assert.equal(
    kopi.db.malTilleggsvakter.filter((t) => t.MalID === kopi.malId).length,
    db.malTilleggsvakter.filter((t) => t.MalID === MAL_GUDSTJENESTE_ID).length
  );
}

{
  const db = sikreStandardMaler(tomUtenMaler());
  const utenMal = opprettArrangement(db, {
    tittel: "Gammelt",
    dato: "2026-09-12",
    tid: "18:00",
    sted: "Bedehuset",
  });
  assert.equal(utenMal.arrangementer[0].MalID, undefined);
  assert.equal(utenMal.tjenestebehov.length, 0);

  const medMal = opprettArrangement(db, {
    tittel: "Gudstjeneste i gymsalen",
    dato: "2026-09-13",
    tid: "11:00",
    sted: "Bedehuset",
    malId: MAL_GUDSTJENESTE_ID,
  });
  assert.equal(medMal.arrangementer[0].MalID, MAL_GUDSTJENESTE_ID);
  const behovRoller = medMal.tjenestebehov.map((t) => t.RolleID).sort();
  const malRoller = bemanningFraMal(medMal, MAL_GUDSTJENESTE_ID)
    .map((r) => r.rolleId)
    .sort();
  assert.deepEqual(behovRoller, malRoller);
  assert.equal(
    programForGudstjeneste(medMal, "", medMal.arrangementer[0].ArrangementID).length,
    initialMalposter.length,
    "kjøreplan kopieres ved opprettelse når malen har poster"
  );

  const program = opprettProgramFraMal(medMal, "", medMal.arrangementer[0].ArrangementID);
  assert.equal(programForGudstjeneste(program, "").length, 0);
  assert.equal(
    programForGudstjeneste(program, "", medMal.arrangementer[0].ArrangementID).length,
    initialMalposter.length
  );
  assert.equal(program.malaktiviteter.length, 0);

  const gruppe = opprettArrangement(db, {
    tittel: "Husgruppe",
    dato: "2026-09-14",
    tid: "19:00",
    sted: "",
    malId: MAL_GRUPPEMØTE_ID,
  });
  assert.equal(gruppe.tjenestebehov.length, 0);
  const tomtProgram = opprettProgramFraMal(gruppe, "", gruppe.arrangementer[0].ArrangementID);
  assert.equal(programForGudstjeneste(tomtProgram, "", gruppe.arrangementer[0].ArrangementID).length, 0);
}

{
  const db = sikreTjenestebehovFraMal(tomUtenMaler(), "AR001");
  assert.equal(db.tjenestebehov.length, 0);
}

{
  const db = sikreStandardMaler(tomUtenMaler());
  const arr = opprettArrangement(db, {
    tittel: "Husgruppe",
    dato: "2026-09-14",
    tid: "19:00",
    sted: "",
    malId: MAL_GRUPPEMØTE_ID,
  });
  const arId = arr.arrangementer[0].ArrangementID;
  assert.equal(bemanningForArrangement(arr, arId)?.length, 0);
  const medVakt = leggTilArrangementVakt(arr, arId, "R013");
  assert.equal(bemanningForArrangement(medVakt, arId)?.some((r) => r.rolleId === "R013" && r.kilde === "tillegg"), true);
  const medKjore = {
    ...medVakt,
    programaktiviteter: [
      {
        ProgramAktivitetID: "PA001",
        GudstjenesteID: "",
        ArrangementID: arId,
        Rekkefolge: 1,
        Tittel: "Velkommen",
        VarighetMin: 5,
        RolleID: "R001",
        ForStart: false,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
  };
  const bem = bemanningForArrangement(medKjore, arId) || [];
  assert.equal(bem.some((r) => r.rolleId === "R001" && r.kilde === "kjoreplan"), true);
  assert.equal(bem.some((r) => r.rolleId === "R013"), true);
}

console.log("mal.test.ts: alle tester ok");
