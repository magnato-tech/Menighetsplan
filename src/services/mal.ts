import { Mal, MalPost, MalTilleggsvakt } from "../types/database";
import type { DatabaseState } from "../types/database";
import {
  MAL_ARRANGEMENT_ID,
  MAL_GRUPPEMØTE_ID,
  MAL_GUDSTJENESTE_ID,
  initialMalTilleggsvakter,
  initialMaler,
  initialMalposter,
} from "../data/initialData";
import { nesteNummerertId } from "./ids";
import { settTjenestebehov } from "./bemanning";

export { MAL_ARRANGEMENT_ID, MAL_GRUPPEMØTE_ID, MAL_GUDSTJENESTE_ID };

export type MalBemanningKilde = "kjoreplan" | "tillegg";

export type MalBemanningRad = {
  rolleId: string;
  kilde: MalBemanningKilde;
  antall: number;
};

function dagensDatoFelt(): string {
  return new Date().toISOString().split("T")[0];
}

export function aktiveMaler(db: DatabaseState): Mal[] {
  return [...(db.maler || [])].filter((m) => m.Aktiv !== false).sort((a, b) => a.MalID.localeCompare(b.MalID));
}

export function sortertMalposter(db: DatabaseState, malId: string): MalPost[] {
  return [...(db.malposter || [])]
    .filter((p) => p.MalID === malId)
    .sort((a, b) => a.Rekkefolge - b.Rekkefolge);
}

/** Unike ikke-tomme RolleID i malens kjøreplan, i første-forekomst-rekkefølge. */
export function kjoreplanRolleIder(db: DatabaseState, malId: string): string[] {
  const sett = new Set<string>();
  const ordered: string[] = [];
  for (const p of sortertMalposter(db, malId)) {
    const id = String(p.RolleID || "").trim();
    if (!id || sett.has(id)) continue;
    sett.add(id);
    ordered.push(id);
  }
  return ordered;
}

export function bemanningFraMal(db: DatabaseState, malId: string): MalBemanningRad[] {
  if (!malId) return [];
  const kjore = kjoreplanRolleIder(db, malId);
  const rader: MalBemanningRad[] = kjore.map((rolleId) => {
    const rolle = (db.roller || []).find((r) => r.RolleID === rolleId);
    return {
      rolleId,
      kilde: "kjoreplan",
      antall: Math.max(0, Number(rolle?.Behov) || 0),
    };
  });
  const kjoreSett = new Set(kjore);
  for (const t of db.malTilleggsvakter || []) {
    if (t.MalID !== malId || t.Aktiv === false) continue;
    const rolleId = String(t.RolleID || "").trim();
    if (!rolleId || kjoreSett.has(rolleId)) continue;
    const rolle = (db.roller || []).find((r) => r.RolleID === rolleId);
    rader.push({
      rolleId,
      kilde: "tillegg",
      antall: Math.max(0, Number(t.Antall) || Number(rolle?.Behov) || 0),
    });
  }
  return rader;
}

export function nøkkelForMalMatch(tekst: string): string {
  return String(tekst || "")
    .toLowerCase()
    .replace(/å/g, "a")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function malStammer(navn: string): string[] {
  const nøkkel = nøkkelForMalMatch(navn);
  const kompakt = nøkkel.replace(/\s/g, "").replace(/ny$/g, "");
  const stammer = new Set<string>();
  if (kompakt.length >= 4) stammer.add(kompakt);
  let stamme = kompakt.replace(/(samling|mote|mal)$/g, "");
  if (stamme.endsWith("e") && stamme.length > 4) stamme = stamme.slice(0, -1);
  if (stamme.length >= 4) stammer.add(stamme);
  for (const del of nøkkel.split(" ")) {
    if (del.length >= 4) stammer.add(del);
  }
  return [...stammer];
}

export function foreslaMalId(db: DatabaseState, tittel: string): string {
  const aktive = aktiveMaler(db);
  if (aktive.length === 0) return "";
  const tittelNøkkel = nøkkelForMalMatch(tittel).replace(/\s/g, "");
  const tittelOrd = nøkkelForMalMatch(tittel);
  const gud = aktive.find((m) => m.MalID === MAL_GUDSTJENESTE_ID);
  const gruppe = aktive.find((m) => m.MalID === MAL_GRUPPEMØTE_ID);
  const arrangement = aktive.find((m) => m.MalID === MAL_ARRANGEMENT_ID);
  if (tittelOrd.includes("gudstjeneste") || tittelOrd.includes("gudsteneste")) {
    return gud?.MalID || aktive[0].MalID;
  }
  if (
    tittelOrd.includes("gruppemote") ||
    tittelOrd.includes("husgruppe") ||
    tittelOrd.includes("smaagruppe")
  ) {
    return gruppe?.MalID || arrangement?.MalID || aktive[0].MalID;
  }
  if (tittelOrd.includes("arrangement")) {
    return arrangement?.MalID || aktive[0].MalID;
  }
  let beste: { id: string; poeng: number } | undefined;
  for (const m of aktive) {
    if (m.MalID === MAL_GUDSTJENESTE_ID) continue;
    for (const s of malStammer(m.Navn)) {
      if (tittelNøkkel.includes(s)) {
        if (!beste || s.length > beste.poeng) beste = { id: m.MalID, poeng: s.length };
      }
    }
  }
  if (beste) return beste.id;
  return arrangement?.MalID || gruppe?.MalID || aktive[0].MalID;
}

export function sikreStandardMaler(db: DatabaseState): DatabaseState {
  const eksisterende = db.maler || [];
  const ids = new Set(eksisterende.map((m) => m.MalID));
  const mangler = initialMaler.filter((m) => !ids.has(m.MalID));
  if (mangler.length === 0 && eksisterende.length > 0) return db;
  if (eksisterende.length === 0) {
    return {
      ...db,
      maler: initialMaler.map((m) => ({ ...m })),
      malposter: initialMalposter.map((p) => ({ ...p })),
      malTilleggsvakter: initialMalTilleggsvakter.map((t) => ({ ...t })),
    };
  }
  const manglerIds = new Set(mangler.map((m) => m.MalID));
  return {
    ...db,
    maler: [...eksisterende, ...mangler.map((m) => ({ ...m }))],
    malposter: [
      ...(db.malposter || []),
      ...initialMalposter.filter((p) => manglerIds.has(p.MalID)).map((p) => ({ ...p })),
    ],
    malTilleggsvakter: [
      ...(db.malTilleggsvakter || []),
      ...initialMalTilleggsvakter.filter((t) => manglerIds.has(t.MalID)).map((t) => ({ ...t })),
    ],
  };
}

export function omskrivMalPostRekkefolge(linjer: MalPost[]): MalPost[] {
  const now = dagensDatoFelt();
  return linjer.map((m, i) => ({ ...m, Rekkefolge: i + 1, SistEndret: now }));
}

export function nyMalPost(eksisterende: MalPost[], malId: string): MalPost {
  const now = dagensDatoFelt();
  const iMal = eksisterende.filter((p) => p.MalID === malId);
  const maxRekke = iMal.reduce((acc, m) => Math.max(acc, m.Rekkefolge || 0), 0);
  return {
    MalPostID: nesteNummerertId(eksisterende, "MalPostID", "MP"),
    MalID: malId,
    Rekkefolge: maxRekke + 1,
    Tittel: "Ny aktivitet",
    VarighetMin: 5,
    RolleID: "",
    ForStart: false,
    Merknad: "",
    OpprettetDato: now,
    SistEndret: now,
  };
}

export function oppdaterMalNavn(db: DatabaseState, malId: string, navn: string): DatabaseState {
  const trimmet = navn.trim();
  if (!malId || !trimmet) return db;
  const now = dagensDatoFelt();
  return {
    ...db,
    maler: (db.maler || []).map((m) => (m.MalID === malId ? { ...m, Navn: trimmet, SistEndret: now } : m)),
  };
}

export function leggTilMalTilleggsvakt(db: DatabaseState, malId: string, rolleId: string): DatabaseState {
  const id = String(rolleId || "").trim();
  if (!malId || !id) return db;
  if (kjoreplanRolleIder(db, malId).includes(id)) return db;
  const finnes = (db.malTilleggsvakter || []).some(
    (t) => t.MalID === malId && t.RolleID === id && t.Aktiv !== false
  );
  if (finnes) return db;
  const rolle = (db.roller || []).find((r) => r.RolleID === id);
  const now = dagensDatoFelt();
  const ny: MalTilleggsvakt = {
    MalTilleggsvaktID: nesteNummerertId(db.malTilleggsvakter || [], "MalTilleggsvaktID", "MTV"),
    MalID: malId,
    RolleID: id,
    Antall: Math.max(0, Number(rolle?.Behov) || 1),
    Aktiv: true,
    OpprettetDato: now,
    SistEndret: now,
  };
  return { ...db, malTilleggsvakter: [...(db.malTilleggsvakter || []), ny] };
}

export function oppdaterMalTilleggsvaktAntall(
  db: DatabaseState,
  tilleggsvaktId: string,
  antall: number
): DatabaseState {
  const now = dagensDatoFelt();
  return {
    ...db,
    malTilleggsvakter: (db.malTilleggsvakter || []).map((t) =>
      t.MalTilleggsvaktID === tilleggsvaktId
        ? { ...t, Antall: Math.max(0, antall), SistEndret: now }
        : t
    ),
  };
}

export function slettMalTilleggsvakt(db: DatabaseState, tilleggsvaktId: string): DatabaseState {
  return {
    ...db,
    malTilleggsvakter: (db.malTilleggsvakter || []).filter((t) => t.MalTilleggsvaktID !== tilleggsvaktId),
  };
}

export function sikreTjenestebehovFraMal(db: DatabaseState, arrangementId: string): DatabaseState {
  const arr = (db.arrangementer || []).find((a) => a.ArrangementID === arrangementId);
  if (!arr?.MalID) return db;
  let neste = db;
  for (const rad of bemanningFraMal(db, arr.MalID)) {
    neste = settTjenestebehov(neste, rad.rolleId, rad.antall, "", arrangementId);
  }
  return neste;
}

export function opprettMal(db: DatabaseState, navn: string): { db: DatabaseState; malId: string } {
  const trimmet = navn.trim() || "Ny mal";
  const now = dagensDatoFelt();
  const malId = nesteNummerertId(db.maler || [], "MalID", "MAL");
  const ny: Mal = {
    MalID: malId,
    Navn: trimmet,
    Aktiv: true,
    OpprettetDato: now,
    SistEndret: now,
  };
  return { db: { ...db, maler: [...(db.maler || []), ny] }, malId };
}

export function kopierMal(
  db: DatabaseState,
  fraMalId: string,
  nyttNavn?: string
): { db: DatabaseState; malId: string } {
  const kilde = (db.maler || []).find((m) => m.MalID === fraMalId);
  if (!kilde) return { db, malId: "" };
  const opprettet = opprettMal(db, (nyttNavn || `${kilde.Navn} (kopi)`).trim());
  const now = dagensDatoFelt();
  let poster = [...(opprettet.db.malposter || [])];
  const kopiertePoster = sortertMalposter(db, fraMalId).map((p) => {
    const id = nesteNummerertId(poster, "MalPostID", "MP");
    const rad: MalPost = {
      ...p,
      MalPostID: id,
      MalID: opprettet.malId,
      OpprettetDato: now,
      SistEndret: now,
    };
    poster = [...poster, rad];
    return rad;
  });
  let vakter = [...(opprettet.db.malTilleggsvakter || [])];
  const kopierteVakter = (db.malTilleggsvakter || [])
    .filter((t) => t.MalID === fraMalId && t.Aktiv !== false)
    .map((t) => {
      const id = nesteNummerertId(vakter, "MalTilleggsvaktID", "MTV");
      const rad: MalTilleggsvakt = {
        ...t,
        MalTilleggsvaktID: id,
        MalID: opprettet.malId,
        OpprettetDato: now,
        SistEndret: now,
      };
      vakter = [...vakter, rad];
      return rad;
    });
  return {
    malId: opprettet.malId,
    db: {
      ...opprettet.db,
      malposter: [...(opprettet.db.malposter || []), ...kopiertePoster],
      malTilleggsvakter: [...(opprettet.db.malTilleggsvakter || []), ...kopierteVakter],
    },
  };
}

export function kjoreplanRolleIderForArrangement(db: DatabaseState, arrangementId: string): string[] {
  const sett = new Set<string>();
  const ordered: string[] = [];
  const poster = (db.programaktiviteter || [])
    .filter((p) => p.ArrangementID === arrangementId)
    .sort((a, b) => a.Rekkefolge - b.Rekkefolge);
  for (const p of poster) {
    const id = String(p.RolleID || "").trim();
    if (!id || sett.has(id)) continue;
    sett.add(id);
    ordered.push(id);
  }
  return ordered;
}

export type ArrangementBemanningRad = {
  rolleId: string;
  kilde: MalBemanningKilde;
};

/** null = gammelt arrangement uten MalID (vis alle tjenesteroller). */
export function bemanningForArrangement(
  db: DatabaseState,
  arrangementId: string
): ArrangementBemanningRad[] | null {
  const arr = (db.arrangementer || []).find((a) => a.ArrangementID === arrangementId);
  if (!arr?.MalID) return null;
  const sett = new Set<string>();
  const rader: ArrangementBemanningRad[] = [];
  const push = (rolleId: string, kilde: MalBemanningKilde) => {
    if (!rolleId || sett.has(rolleId)) return;
    sett.add(rolleId);
    rader.push({ rolleId, kilde });
  };
  for (const id of kjoreplanRolleIderForArrangement(db, arrangementId)) push(id, "kjoreplan");
  const mal = bemanningFraMal(db, arr.MalID);
  if (kjoreplanRolleIderForArrangement(db, arrangementId).length === 0) {
    for (const rad of mal.filter((r) => r.kilde === "kjoreplan")) push(rad.rolleId, "kjoreplan");
  }
  for (const rad of mal.filter((r) => r.kilde === "tillegg")) push(rad.rolleId, "tillegg");
  for (const tb of db.tjenestebehov || []) {
    if (tb.ArrangementID !== arrangementId || tb.Aktiv === false) continue;
    push(String(tb.RolleID || "").trim(), "tillegg");
  }
  return rader;
}

export function leggTilArrangementVakt(db: DatabaseState, arrangementId: string, rolleId: string): DatabaseState {
  const id = String(rolleId || "").trim();
  if (!arrangementId || !id) return db;
  const rader = bemanningForArrangement(db, arrangementId);
  if (rader?.some((r) => r.rolleId === id)) return db;
  const rolle = (db.roller || []).find((r) => r.RolleID === id);
  return settTjenestebehov(db, id, Math.max(0, Number(rolle?.Behov) || 1), "", arrangementId);
}

export function fjernArrangementVakt(db: DatabaseState, arrangementId: string, rolleId: string): DatabaseState {
  const rader = bemanningForArrangement(db, arrangementId);
  const rad = rader?.find((r) => r.rolleId === rolleId);
  if (!rad || rad.kilde !== "tillegg") return db;
  const arr = (db.arrangementer || []).find((a) => a.ArrangementID === arrangementId);
  if (arr?.MalID && bemanningFraMal(db, arr.MalID).some((r) => r.rolleId === rolleId)) return db;
  const tildelingIder = new Set(
    (db.tildelinger || [])
      .filter((t) => t.ArrangementID === arrangementId && t.RolleID === rolleId)
      .map((t) => t.TildelingID)
  );
  return {
    ...db,
    tjenestebehov: (db.tjenestebehov || []).filter(
      (tb) => !(tb.ArrangementID === arrangementId && tb.RolleID === rolleId)
    ),
    tildelinger: (db.tildelinger || []).filter((t) => !tildelingIder.has(t.TildelingID)),
    svar: (db.svar || []).filter((s) => !tildelingIder.has(s.TildelingID)),
  };
}
