import "./polyfill";
import assert from "node:assert/strict";
import {
  beregnSamlingsdatoer,
  genererSamlingshendelser,
  gruppeArrangementTagger,
  samlingsplanEksternId,
} from "../services/samlingsplanlegging";
import type { DatabaseState, Gruppe } from "../types/database";

function tomDb(gruppe: Gruppe): DatabaseState {
  return {
    gruppetyper: [
      {
        GruppetypeID: "GT003",
        Navn: "Husgruppe",
        Beskrivelse: "",
        Aktiv: true,
        OpprettetDato: "2026-01-01",
        SistEndret: "2026-01-01",
      },
    ],
    personer: [],
    grupper: [gruppe],
    gruppemedlemmer: [],
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
    personerImport: [],
    gudstjenesterImport: [],
    rollebeskrivelseImport: [],
  };
}

const gruppe: Gruppe = {
  GruppeID: "G010",
  Gruppenavn: "Fredagsgruppa",
  GruppetypeID: "GT003",
  Beskrivelse: "Husgruppe i sentrum",
  Aktiv: true,
  OpprettetDato: "2026-01-01",
  SistEndret: "2026-01-01",
};

{
  const tagger = gruppeArrangementTagger(tomDb(gruppe), gruppe);
  assert.equal(tagger.length, 2);
  assert.equal(tagger[0].Kategori, "Gruppe");
  assert.equal(tagger[0].Verdi, "Fredagsgruppa");
  assert.equal(tagger[1].Kategori, "Type gruppe");
  assert.equal(tagger[1].Verdi, "Husgruppe");
}

{
  const datoer = beregnSamlingsdatoer({
    Frekvens: "Ingen gjentakelse",
    Startdato: "2026-08-30",
    Klokkeslett: "19:00",
  });
  assert.deepEqual(datoer, ["2026-08-30"]);
}

{
  const datoer = beregnSamlingsdatoer({
    Frekvens: "Hver uke",
    Ukedag: "Fredag",
    Startdato: "2026-08-28",
    Sluttdato: "2026-09-18",
    Klokkeslett: "19:00",
  });
  assert.deepEqual(datoer, ["2026-08-28", "2026-09-04", "2026-09-11", "2026-09-18"]);
}

{
  const db = tomDb(gruppe);
  const resultat = genererSamlingshendelser(db, "G010", {
    Frekvens: "1 gang pr 2 uker",
    Ukedag: "Fredag",
    Startdato: "2026-08-28",
    Sluttdato: "2026-09-18",
    Klokkeslett: "19:30",
    Sluttid: "21:00",
  });
  assert.equal(resultat.ok, true);
  if (!resultat.ok) throw new Error("forventet ok");
  assert.equal(resultat.antall, 2);
  assert.equal(resultat.db.arrangementer.length, 2);
  const forste = resultat.db.arrangementer[0];
  assert.equal(forste.EksternKalenderID, samlingsplanEksternId("G010", "2026-08-28"));
  assert.equal(forste.GruppeID, "G010");
  assert.equal(forste.Tagger?.[0].Verdi, "Fredagsgruppa");
  assert.equal(forste.Tagger?.[1].Verdi, "Husgruppe");
  assert.equal(forste.Tid, "19:30");
  assert.match(forste.Beskrivelse, /21:00/);

  const igjen = genererSamlingshendelser(resultat.db, "G010", {
    Frekvens: "Hver uke",
    Ukedag: "Fredag",
    Startdato: "2026-08-28",
    Sluttdato: "2026-09-11",
    Klokkeslett: "19:30",
  });
  assert.equal(igjen.ok, true);
  if (!igjen.ok) throw new Error("forventet ok");
  assert.equal(igjen.db.arrangementer.filter((a) => a.Aktiv !== false).length, 3);
  assert.equal(igjen.db.arrangementer.filter((a) => a.Aktiv === false).length, 2);
}

{
  const db = tomDb(gruppe);
  const enkelt = genererSamlingshendelser(db, "G010", {
    Frekvens: "Ingen gjentakelse",
    Startdato: "2026-08-30",
    Klokkeslett: "18:00",
  });
  assert.equal(enkelt.ok, true);
  if (!enkelt.ok) throw new Error("forventet ok");
  assert.equal(enkelt.antall, 1);
  assert.equal(enkelt.db.arrangementer[0].Dato, "2026-08-30");
}

console.log("samlingsplanlegging.test.ts: alle tester ok");
