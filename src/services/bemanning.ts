import {
  Person,
  Rolle,
  Tildeling,
  Svar,
  SvarStatus,
  LedigOppgave,
  GudstjenesterImport,
} from "../types/database";
import type { DatabaseState } from "../types/database";
import { nesteNummerertId } from "./ids";
import { saveDatabase } from "./persistens";
import { finnTjenestegrupperForPerson, synkGruppeledergruppe } from "./grupper";
import { erGudstjenesteBemanningRolle } from "./roller";
import { hentPåmeldingsRoller, tjenesteGruppenavnForPerson } from "./interesse";
import { hentTilgang } from "./tilgang";

/** Arrangement-rader har ArrangementID og tom GudstjenesteID — aldri omvendt. */
export function erHendelseRad(
  row: { GudstjenesteID?: string; ArrangementID?: string },
  gudstjenesteId: string,
  arrangementId?: string
): boolean {
  if (arrangementId) return row.ArrangementID === arrangementId;
  return row.GudstjenesteID === gudstjenesteId && !row.ArrangementID;
}

/**
 * Beregner effektivt behov for en rolle på en bestemt gudstjeneste
 * Regel: Hvis Tjenestebehov har en aktiv rad for GudstjenesteID + RolleID, brukes Antall.
 * Hvis ikke, brukes Roller.Behov.
 */
export function getEffektivtBehov(
  db: DatabaseState,
  gudstjenesteId: string,
  rolle: Rolle,
  arrangementId?: string
): number {
  const overstyring = (db.tjenestebehov || []).find(
    (tb) =>
      erHendelseRad(tb, gudstjenesteId, arrangementId) &&
      tb.RolleID === rolle.RolleID &&
      tb.Aktiv
  );
  return overstyring !== undefined ? overstyring.Antall : rolle.Behov;
}

/** Roller som normalt bare skal ha én person — brukes når MaksAntall ikke er satt. */
const STANDARD_HARD_MAKS: Record<string, number> = {
  møteleder: 1,
  taler: 1,
  lyd: 1,
  bilde: 1,
};

/**
 * Hard maks for påmelding/tildeling.
 * - Eksplisitt ≥1: den grensen
 * - Eksplisitt 0: ubegrenset (overbooking tillatt)
 * - Udefinert/null: standard for møteleder/taler/lyd/bilde (=1), ellers ubegrenset
 */
export function getMaksAntall(rolle: Rolle): number | null {
  if (rolle.MaksAntall !== undefined && rolle.MaksAntall !== null) {
    const n = Number(rolle.MaksAntall);
    if (!Number.isFinite(n) || n < 1) return null;
    return Math.round(n);
  }
  const key = String(rolle.Rollenavn || "")
    .trim()
    .toLowerCase();
  return STANDARD_HARD_MAKS[key] ?? null;
}

/** Antall aktive (ikke avviste) tildelinger for rolle på gudstjeneste. */
export function tellAktivePaaRolle(
  db: DatabaseState,
  gudstjenesteId: string,
  rolleId: string,
  arrangementId?: string
): number {
  return db.tildelinger.filter((t) => {
    if (!erHendelseRad(t, gudstjenesteId, arrangementId) || t.RolleID !== rolleId) return false;
    return hentSvarStatus(db, t.TildelingID) !== "Avvist";
  }).length;
}

/** True når hard maks er satt og allerede er nådd. */
export function erRolleHardFull(
  db: DatabaseState,
  gudstjenesteId: string,
  rolle: Rolle,
  arrangementId?: string
): boolean {
  const maks = getMaksAntall(rolle);
  if (maks == null) return false;
  return tellAktivePaaRolle(db, gudstjenesteId, rolle.RolleID, arrangementId) >= maks;
}

function avvisHvisHardFull(
  db: DatabaseState,
  gudstjenesteId: string,
  rolleId: string,
  arrangementId?: string
): { success: false; message: string } | null {
  const rolle = db.roller.find((r) => r.RolleID === rolleId);
  if (!rolle || !erRolleHardFull(db, gudstjenesteId, rolle, arrangementId)) return null;
  const maks = getMaksAntall(rolle);
  return {
    success: false,
    message: `Rollen ${rolle.Rollenavn} er full (maks ${maks}).`,
  };
}

function avvisHvisPassertDato(
  db: DatabaseState,
  gudstjenesteId: string,
  arrangementId?: string
): { success: false; message: string } | null {
  const dato = arrangementId
    ? db.arrangementer?.find((a) => a.ArrangementID === arrangementId)?.Dato
    : db.gudstjenester.find((g) => g.GudstjenesteID === gudstjenesteId)?.Dato;
  if (!dato) {
    return { success: false, message: arrangementId ? "Arrangementet finnes ikke." : "Gudstjenesten finnes ikke." };
  }
  const iDag = new Date().toISOString().split("T")[0];
  if (dato < iDag) {
    return {
      success: false,
      message: "Du kan ikke melde deg på en gudstjeneste som allerede er passert.",
    };
  }
  return null;
}

export function hentSvarStatus(db: DatabaseState, tildelingId: string): SvarStatus {
  const kandidater = db.svar.filter((s) => s.TildelingID === tildelingId);
  if (kandidater.length === 0) return "Venter";

  const tildeling = db.tildelinger.find((t) => t.TildelingID === tildelingId);
  const relevante = tildeling?.PersonID
    ? kandidater.filter((s) => s.PersonID === tildeling.PersonID)
    : kandidater;
  const liste = relevante.length > 0 ? relevante : kandidater;

  const avgjort = liste.find((s) => s.Svar === "Bekreftet" || s.Svar === "Avvist");
  if (avgjort) return avgjort.Svar;

  const sortert = [...liste].sort((a, b) =>
    String(b.SvartDato || "").localeCompare(String(a.SvartDato || ""))
  );
  return sortert[0]?.Svar || "Venter";
}

export function erEksternPersonId(personId: string): boolean {
  return /^EXT\d+$/i.test(personId || "");
}

export function tildelingVisningsnavn(
  db: DatabaseState,
  t: { PersonID: string; EksternNavn?: string }
): string {
  if (t.EksternNavn) return t.EksternNavn;
  const p = db.personer.find((pers) => pers.PersonID === t.PersonID);
  return p?.Fornavn || p?.Navn || "Ukjent";
}

const SITUASJON_ROLLE_REKKEFOLGE = [
  "møteleder",
  "taler",
  "forbønn",
  "barnekirke",
  "lovsang",
  "lyd",
  "bilde",
  "møtevert",
  "rigging",
  "kjøkken",
  "baking",
  "pynting",
  "kollekt",
];

function rolleRang(navn: string): number {
  const n = navn.trim().toLowerCase();
  const i = SITUASJON_ROLLE_REKKEFOLGE.findIndex((x) => n.includes(x));
  return i < 0 ? 100 + n.charCodeAt(0) : i;
}

function erAdministratorRolle(rolle: Rolle): boolean {
  return String(rolle.Rollenavn || "")
    .trim()
    .toLowerCase()
    .includes("administrator");
}

/** 12 tjenesteroller for planleggingsarket. Administrator (Behov 0) skjules. */
export function arkRoller(db: DatabaseState, rolleIds?: string[]): Rolle[] {
  const tillat = rolleIds ? new Set(rolleIds) : null;
  return db.roller
    .filter((r) => r.Aktiv)
    .filter((r) => !erAdministratorRolle(r))
    .filter((r) => erGudstjenesteBemanningRolle(db, r))
    .filter((r) => !tillat || tillat.has(r.RolleID))
    .slice()
    .sort(
      (a, b) =>
        rolleRang(a.Rollenavn) - rolleRang(b.Rollenavn) ||
        a.Rollenavn.localeCompare(b.Rollenavn, "nb")
    );
}

/** Flat rolleliste for situasjonsvisning (uten gruppe/gruppeleder). */
export function situasjonRollerForGudstjeneste(
  db: DatabaseState,
  gudstjenesteId: string,
  rolleIds?: string[]
) {
  const tillat = rolleIds ? new Set(rolleIds) : null;
  const aktive = db.roller.filter(
    (r) =>
      r.Aktiv &&
      erGudstjenesteBemanningRolle(db, r) &&
      (!tillat || tillat.has(r.RolleID))
  );
  return aktive
    .slice()
    .sort(
      (a, b) =>
        rolleRang(a.Rollenavn) - rolleRang(b.Rollenavn) ||
        a.Rollenavn.localeCompare(b.Rollenavn, "nb")
    )
    .map((rolle) => {
      const personer = db.tildelinger
        .filter((t) => erHendelseRad(t, gudstjenesteId) && t.RolleID === rolle.RolleID)
        .filter((t) => hentSvarStatus(db, t.TildelingID) !== "Avvist")
        .map((t) => ({
          navn: tildelingVisningsnavn(db, t),
          status: hentSvarStatus(db, t.TildelingID),
        }));
      const behov = getEffektivtBehov(db, gudstjenesteId, rolle);
      return { rolle, personer, vis: behov > 0 || personer.length > 0 };
    })
    .filter((r) => r.vis);
}

export function finnMotelederRolle(db: DatabaseState): Rolle | undefined {
  const aktive = (db.roller || []).filter((r) => r.Aktiv);
  return (
    aktive.find((r) => String(r.Rollenavn || "").trim().toLowerCase() === "møteleder") ||
    aktive.find((r) => String(r.Rollenavn || "").trim().toLowerCase().includes("møteleder"))
  );
}

export type Bemanningstall = {
  bekreftet: number;
  venter: number;
  ledige: number;
  forfall: number;
  behov: number;
};

export function tomtBemanningstall(): Bemanningstall {
  return { bekreftet: 0, venter: 0, ledige: 0, forfall: 0, behov: 0 };
}

export function plusBemanningstall(a: Bemanningstall, b: Bemanningstall): Bemanningstall {
  return {
    bekreftet: a.bekreftet + b.bekreftet,
    venter: a.venter + b.venter,
    ledige: a.ledige + b.ledige,
    forfall: a.forfall + b.forfall,
    behov: a.behov + b.behov,
  };
}

/** Ledige plasser: kun bekreftet fyller. Venter og forfall teller som 0. */
export function ledigePlasserForRolle(behov: number, bekreftet: number): number {
  return Math.max(0, behov - bekreftet);
}

export function summerBemanning(
  db: DatabaseState,
  gudstjenesteId: string,
  roller: Rolle[],
  arrangementId?: string
): Bemanningstall {
  const totalt = tomtBemanningstall();
  for (const rolle of roller) {
    const behov = getEffektivtBehov(db, gudstjenesteId, rolle, arrangementId);
    totalt.behov += behov;
    const tildelinger = db.tildelinger.filter(
      (t) => erHendelseRad(t, gudstjenesteId, arrangementId) && t.RolleID === rolle.RolleID
    );
    let bekreftet = 0;
    let venter = 0;
    let forfall = 0;
    for (const t of tildelinger) {
      const svar = hentSvarStatus(db, t.TildelingID);
      if (svar === "Avvist") forfall += 1;
      else if (svar === "Bekreftet") bekreftet += 1;
      else venter += 1;
    }
    totalt.bekreftet += bekreftet;
    totalt.venter += venter;
    totalt.forfall += forfall;
    totalt.ledige += ledigePlasserForRolle(behov, bekreftet);
  }
  return totalt;
}

export type BelastningCelleOppgave = {
  rolleId: string;
  rollenavn: string;
  status: "Bekreftet" | "Venter";
};

export type BelastningPersonRad = {
  personId: string;
  navn: string;
  fornavn: string;
  gruppeIds: string[];
  oppgaver: number;
  gudstjenester: number;
  bekreftet: number;
  venter: number;
  harFlereSammeDag: boolean;
  celler: Record<string, BelastningCelleOppgave[]>;
};

export type BelastningSemester = {
  gudstjenester: { GudstjenesteID: string; Dato: string; Tid: string; Tema: string }[];
  rader: BelastningPersonRad[];
  hoyestLast: { personId: string; navn: string; oppgaver: number } | null;
  utenOppgaver: number;
  flereSammeDag: number;
};

function tellerSomBelastning(status: SvarStatus): status is "Bekreftet" | "Venter" {
  return status === "Bekreftet" || status === "Venter";
}

/** Person × kommende gudstjenester. Avvist og eksterne telles ikke. */
export function belastningForSemester(db: DatabaseState, fraDato: string): BelastningSemester {
  const gudstjenester = db.gudstjenester
    .filter((g) => g.Dato >= fraDato)
    .slice()
    .sort((a, b) => `${a.Dato} ${a.Tid}`.localeCompare(`${b.Dato} ${b.Tid}`))
    .map((g) => ({
      GudstjenesteID: g.GudstjenesteID,
      Dato: g.Dato,
      Tid: g.Tid,
      Tema: g.Tema || "",
    }));
  const gudIdSet = new Set(gudstjenester.map((g) => g.GudstjenesteID));
  const rolleNavn = new Map(db.roller.map((r) => [r.RolleID, r.Rollenavn]));

  const aktivePersoner = db.personer.filter(
    (p) => p.Aktiv && !erEksternPersonId(p.PersonID)
  );

  const rader: BelastningPersonRad[] = aktivePersoner.map((p) => {
    const gruppeIds = finnTjenestegrupperForPerson(db, p.PersonID).map((t) => t.gruppe.GruppeID);
    const celler: Record<string, BelastningCelleOppgave[]> = {};
    let bekreftet = 0;
    let venter = 0;

    for (const t of db.tildelinger) {
      if (t.PersonID !== p.PersonID) continue;
      if (t.EksternNavn || erEksternPersonId(t.PersonID)) continue;
      if (!gudIdSet.has(t.GudstjenesteID)) continue;
      const status = hentSvarStatus(db, t.TildelingID);
      if (!tellerSomBelastning(status)) continue;
      const oppgave: BelastningCelleOppgave = {
        rolleId: t.RolleID,
        rollenavn: rolleNavn.get(t.RolleID) || t.RolleID,
        status,
      };
      if (!celler[t.GudstjenesteID]) celler[t.GudstjenesteID] = [];
      celler[t.GudstjenesteID].push(oppgave);
      if (status === "Bekreftet") bekreftet += 1;
      else venter += 1;
    }

    const oppgaver = bekreftet + venter;
    const gudstjenesteAntall = Object.keys(celler).length;
    const harFlereSammeDag = Object.values(celler).some((liste) => liste.length >= 2);

    return {
      personId: p.PersonID,
      navn: p.Navn,
      fornavn: p.Fornavn || p.Navn,
      gruppeIds,
      oppgaver,
      gudstjenester: gudstjenesteAntall,
      bekreftet,
      venter,
      harFlereSammeDag,
      celler,
    };
  });

  rader.sort((a, b) => b.oppgaver - a.oppgaver || a.navn.localeCompare(b.navn, "nb"));

  const medLast = rader.filter((r) => r.oppgaver > 0);
  const hoyest = medLast[0];
  return {
    gudstjenester,
    rader,
    hoyestLast: hoyest
      ? { personId: hoyest.personId, navn: hoyest.navn, oppgaver: hoyest.oppgaver }
      : null,
    utenOppgaver: rader.filter((r) => r.oppgaver === 0).length,
    flereSammeDag: rader.filter((r) => r.harFlereSammeDag).length,
  };
}

/**
 * Beregner ledige oppgaver (avledet sannhet) for alle eller spesifikke gudstjenester
 */
export function beregnLedigeOppgaver(
  db: DatabaseState,
  gudstjenesteIDFilter?: string
): LedigOppgave[] {
  const result: LedigOppgave[] = [];

  const gudstjenester = gudstjenesteIDFilter
    ? db.gudstjenester.filter((g) => g.GudstjenesteID === gudstjenesteIDFilter)
    : db.gudstjenester;

  const aktiveRoller = db.roller.filter((r) => r.Aktiv);

  for (const g of gudstjenester) {
    for (const r of aktiveRoller) {
      const effektivtBehov = getEffektivtBehov(db, g.GudstjenesteID, r);

      // Finn tildelinger for denne gudstjenesten og rollen
      const tildelingerForRolle = db.tildelinger.filter(
        (t) => t.GudstjenesteID === g.GudstjenesteID && t.RolleID === r.RolleID
      );

      // Veiledende ledig: kun bekreftet fyller. Overbooking er tillatt.
      const bekreftetAntall = tildelingerForRolle.filter(
        (t) => hentSvarStatus(db, t.TildelingID) === "Bekreftet"
      ).length;
      const ledigePlasser = Math.max(0, effektivtBehov - bekreftetAntall);

      const gruppe = db.grupper.find((grp) => grp.GruppeID === r.GruppeID);

      result.push({
        GudstjenesteID: g.GudstjenesteID,
        RolleID: r.RolleID,
        Rollenavn: r.Rollenavn,
        Dato: g.Dato,
        Tid: g.Tid,
        Sted: g.Sted,
        Tema: g.Tema,
        EffektivtBehov: effektivtBehov,
        AntallTildelt: bekreftetAntall,
        LedigePlasser: ledigePlasser,
        AnsvarligGruppeID: r.GruppeID,
        AnsvarligGruppeNavn: gruppe ? gruppe.Gruppenavn : undefined,
      });
    }
  }

  return result;
}

/**
 * Frivillig påmelding:
 * Finner oppgaver som matcher personens aktive Personroller.
 * Behovstall er veiledende; overbooking er tillatt med mindre MaksAntall er satt.
 */
export function finnLedigeOppgaverForPerson(
  db: DatabaseState,
  personID: string
): LedigOppgave[] {
  const personensRoller = db.personroller
    .filter((pr) => pr.PersonID === personID && pr.Aktiv)
    .map((pr) => pr.RolleID);

  if (personensRoller.length === 0) return [];

  const alleLedige = beregnLedigeOppgaver(db);

  return alleLedige.filter((oppgave) => {
    // 1. Rollen må matche personens aktive roller
    if (!personensRoller.includes(oppgave.RolleID)) return false;

    // 2. Personen må ikke allerede være tildelt denne rollen på denne gudstjenesten
    const alleredeTildelt = db.tildelinger.some(
      (t) =>
        t.GudstjenesteID === oppgave.GudstjenesteID &&
        t.RolleID === oppgave.RolleID &&
        t.PersonID === personID
    );

    return !alleredeTildelt;
  });
}

/**
 * Atomisk frivillig påmelding:
 * 1. Validerer personrolle
 * 2. Oppretter Tildeling
 * 3. Oppretter Svar med "Bekreftet"
 * Behovstall er veiledende — overbooking er tillatt med mindre MaksAntall er satt.
 */
export function meldPaaFrivillig(
  db: DatabaseState,
  personID: string,
  gudstjenesteID: string,
  rolleID: string,
  kommentar?: string
): { success: boolean; message: string; updatedDb?: DatabaseState } {
  // 1. Valider person
  const person = db.personer.find((p) => p.PersonID === personID && p.Aktiv);
  if (!person) {
    return { success: false, message: "Personen finnes ikke eller er ikke aktiv." };
  }

  // 2. Valider at personen har huket av rollen (ikke bare medlemskap i gruppen)
  const kanVelgeRollen = hentPåmeldingsRoller(db, personID).some((r) => r.RolleID === rolleID);
  if (!kanVelgeRollen) {
    return {
      success: false,
      message: "Personen har ikke tilgang til denne oppgaven.",
    };
  }

  // 3. Valider at personen ikke allerede er tildelt denne rollen på denne datoen
  const eksisterende = db.tildelinger.find(
    (t) =>
      t.GudstjenesteID === gudstjenesteID &&
      t.RolleID === rolleID &&
      t.PersonID === personID
  );
  if (eksisterende) {
    return {
      success: false,
      message: "Du er allerede registrert på denne oppgaven.",
    };
  }

  const fullt = avvisHvisHardFull(db, gudstjenesteID, rolleID);
  if (fullt) return fullt;

  const passert = avvisHvisPassertDato(db, gudstjenesteID);
  if (passert) return passert;

  // Generer nye ID-er
  const maxTildelingNr = db.tildelinger.reduce((max, t) => {
    const num = parseInt(t.TildelingID.replace(/\D/g, ""), 10);
    return !isNaN(num) && num > max ? num : max;
  }, 0);
  const newTildelingID = `T${String(maxTildelingNr + 1).padStart(3, "0")}`;

  const maxSvarNr = db.svar.reduce((max, s) => {
    const num = parseInt(s.SvarID.replace(/\D/g, ""), 10);
    return !isNaN(num) && num > max ? num : max;
  }, 0);
  const newSvarID = `S${String(maxSvarNr + 1).padStart(3, "0")}`;

  const now = new Date().toISOString().split("T")[0];

  const nyTildeling: Tildeling = {
    TildelingID: newTildelingID,
    GudstjenesteID: gudstjenesteID,
    RolleID: rolleID,
    PersonID: personID,
    OpprettetDato: now,
    SistEndret: now,
  };

  const nyttSvar: Svar = {
    SvarID: newSvarID,
    TildelingID: newTildelingID,
    PersonID: personID,
    Svar: "Bekreftet",
    Kommentar: kommentar || "Frivillig påmeldt via personlig visning",
    SvartDato: now,
  };

  const updatedDb: DatabaseState = {
    ...db,
    tildelinger: [...db.tildelinger, nyTildeling],
    svar: [...db.svar, nyttSvar],
  };

  saveDatabase(updatedDb);

  return {
    success: true,
    message: "Du er nå bekreftet påmeldt til rollen!",
    updatedDb,
  };
}

/**
 * Velg eller legg til en dato for en person på en rolle
 */
export function velgDatoForPerson(
  db: DatabaseState,
  personID: string,
  gudstjenesteID: string,
  rolleID: string
): { success: boolean; message: string; updatedDb?: DatabaseState } {
  const passert = avvisHvisPassertDato(db, gudstjenesteID);
  if (passert) return passert;

  // Sjekk om det allerede finnes en tildeling for personen på denne gudstjenesten og rollen
  const eksisterendeTildeling = db.tildelinger.find(
    (t) =>
      t.GudstjenesteID === gudstjenesteID &&
      t.RolleID === rolleID &&
      t.PersonID === personID
  );

  if (eksisterendeTildeling) {
    const updatedDb = svarPaaTildeling(
      db,
      eksisterendeTildeling.TildelingID,
      personID,
      "Bekreftet",
      "Valgt av person via Min side"
    );
    return {
      success: true,
      message: "Datoen er nå bekreftet for din oppgave!",
      updatedDb,
    };
  }

  const kanVelgeRollen = hentPåmeldingsRoller(db, personID).some((r) => r.RolleID === rolleID);
  if (!kanVelgeRollen) {
    return {
      success: false,
      message: "Du kan bare velge oppgaver du har meldt deg på.",
    };
  }

  const fullt = avvisHvisHardFull(db, gudstjenesteID, rolleID);
  if (fullt) return fullt;

  // Hvis ingen tildeling finnes fra før, opprett ny tildeling og bekreftet svar
  const maxTildelingNr = db.tildelinger.reduce((max, t) => {
    const num = parseInt(t.TildelingID.replace(/\D/g, ""), 10);
    return !isNaN(num) && num > max ? num : max;
  }, 0);
  const newTildelingID = `T${String(maxTildelingNr + 1).padStart(3, "0")}`;

  const maxSvarNr = db.svar.reduce((max, s) => {
    const num = parseInt(s.SvarID.replace(/\D/g, ""), 10);
    return !isNaN(num) && num > max ? num : max;
  }, 0);
  const newSvarID = `S${String(maxSvarNr + 1).padStart(3, "0")}`;

  const now = new Date().toISOString().split("T")[0];

  const nyTildeling: Tildeling = {
    TildelingID: newTildelingID,
    GudstjenesteID: gudstjenesteID,
    RolleID: rolleID,
    PersonID: personID,
    OpprettetDato: now,
    SistEndret: now,
  };

  const nyttSvar: Svar = {
    SvarID: newSvarID,
    TildelingID: newTildelingID,
    PersonID: personID,
    Svar: "Bekreftet",
    Kommentar: "Valgt av person via Min side",
    SvartDato: now,
  };

  const updatedDb: DatabaseState = {
    ...db,
    tildelinger: [...db.tildelinger, nyTildeling],
    svar: [...db.svar, nyttSvar],
  };

  saveDatabase(updatedDb);

  return {
    success: true,
    message: "Datoen er lagt til og bekreftet for din oppgave!",
    updatedDb,
  };
}

/**
 * Oppdaterer eller oppretter svar på en tildeling (Bekreftet / Avvist)
 */
export function svarPaaTildeling(
  db: DatabaseState,
  tildelingID: string,
  personID: string,
  nyttSvarStatus: SvarStatus,
  kommentar?: string
): DatabaseState {
  const now = new Date().toISOString().split("T")[0];
  const tildeling = db.tildelinger.find((t) => t.TildelingID === tildelingID);
  const faktiskPersonId = tildeling?.PersonID || personID;
  const eksisterende = db.svar.filter((s) => s.TildelingID === tildelingID);
  const behold =
    eksisterende.find((s) => s.PersonID === faktiskPersonId) || eksisterende[0];

  const oppdatert: Svar = behold
    ? {
        ...behold,
        PersonID: faktiskPersonId,
        Svar: nyttSvarStatus,
        Kommentar:
          kommentar !== undefined ? kommentar : behold.Kommentar,
        SvartDato: now,
      }
    : {
        SvarID: nesteNummerertId(db.svar, "SvarID", "S"),
        TildelingID: tildelingID,
        PersonID: faktiskPersonId,
        Svar: nyttSvarStatus,
        Kommentar: kommentar || "",
        SvartDato: now,
      };

  const updatedDb: DatabaseState = {
    ...db,
    svar: [...db.svar.filter((s) => s.TildelingID !== tildelingID), oppdatert],
  };

  saveDatabase(updatedDb);
  return updatedDb;
}

export type DeltakelseStatus = "Deltar" | "Avventer" | "Deltar ikke" | "Avvist";

/** Rolle å bruke når leder setter status: personens personrolle i gruppen, ellers gruppens eneste/første rolle. */
export function velgRolleForGruppemedlem(
  db: DatabaseState,
  personId: string,
  gruppeRoller: Rolle[]
): Rolle | undefined {
  if (gruppeRoller.length === 0) return undefined;
  if (gruppeRoller.length === 1) return gruppeRoller[0];
  const personRolleIds = new Set(
    db.personroller
      .filter((pr) => pr.PersonID === personId && pr.Aktiv)
      .map((pr) => pr.RolleID)
  );
  return gruppeRoller.find((r) => personRolleIds.has(r.RolleID)) || gruppeRoller[0];
}

/** Gruppeleder eller medlem: sett deltakelse for én person på én gudstjeneste+rolle. */
export function settDeltakelseForPerson(
  db: DatabaseState,
  personId: string,
  gudstjenesteId: string,
  rolleId: string,
  status: DeltakelseStatus,
  kommentar?: string,
  arrangementId?: string
): DatabaseState {
  const now = new Date().toISOString().split("T")[0];
  const eksisterende = db.tildelinger.filter(
    (t) =>
      erHendelseRad(t, gudstjenesteId, arrangementId) &&
      t.PersonID === personId &&
      t.RolleID === rolleId
  );

  if (status === "Deltar ikke") {
    const fjernIds = new Set(eksisterende.map((t) => t.TildelingID));
    const updatedDb: DatabaseState = {
      ...db,
      tildelinger: db.tildelinger.filter((t) => !fjernIds.has(t.TildelingID)),
      svar: db.svar.filter((s) => !fjernIds.has(s.TildelingID)),
    };
    saveDatabase(updatedDb);
    return updatedDb;
  }

  let tildelinger = db.tildelinger;
  let tildelingId = eksisterende[0]?.TildelingID;
  if (!tildelingId) {
    const rolle = db.roller.find((r) => r.RolleID === rolleId);
    if (rolle && erRolleHardFull(db, gudstjenesteId, rolle, arrangementId)) {
      return db;
    }
    tildelingId = nesteNummerertId(tildelinger, "TildelingID", "T");
    tildelinger = [
      ...tildelinger,
      {
        TildelingID: tildelingId,
        GudstjenesteID: arrangementId ? "" : gudstjenesteId,
        ArrangementID: arrangementId,
        RolleID: rolleId,
        PersonID: personId,
        OpprettetDato: now,
        SistEndret: now,
      },
    ];
  }

  const svarStatus: SvarStatus =
    status === "Deltar" ? "Bekreftet" : status === "Avvist" ? "Avvist" : "Venter";

  const utenSave: DatabaseState = { ...db, tildelinger };
  const eksisterendeSvarIndex = utenSave.svar.findIndex(
    (s) => s.TildelingID === tildelingId && s.PersonID === personId
  );
  let svar = [...utenSave.svar];
  if (eksisterendeSvarIndex >= 0) {
    svar[eksisterendeSvarIndex] = {
      ...svar[eksisterendeSvarIndex],
      Svar: svarStatus,
      Kommentar: kommentar !== undefined ? kommentar : svar[eksisterendeSvarIndex].Kommentar,
      SvartDato: now,
    };
  } else {
    svar = [
      ...svar,
      {
        SvarID: nesteNummerertId(svar, "SvarID", "S"),
        TildelingID: tildelingId,
        PersonID: personId,
        Svar: svarStatus,
        Kommentar: kommentar || "",
        SvartDato: now,
      },
    ];
  }

  const updatedDb: DatabaseState = { ...utenSave, svar };
  saveDatabase(updatedDb);
  return updatedDb;
}

function nesteEksternPersonId(tildelinger: Tildeling[]): string {
  const max = tildelinger.reduce((acc, t) => {
    const m = /^EXT(\d+)$/i.exec(t.PersonID || "");
    if (!m) return acc;
    const n = parseInt(m[1], 10);
    return !isNaN(n) && n > acc ? n : acc;
  }, 0);
  return `EXT${String(max + 1).padStart(3, "0")}`;
}

/** Gjest på én gudstjeneste. Skrives ikke til Personer. */
export function tildelEksternPerson(
  db: DatabaseState,
  gudstjenesteId: string,
  rolleId: string,
  navn: string,
  kommentar?: string,
  arrangementId?: string
): DatabaseState {
  const visningsnavn = navn.trim();
  if (!visningsnavn) return db;
  const nøkkel = visningsnavn.toLowerCase();
  const allerede = db.tildelinger.find(
    (t) =>
      erHendelseRad(t, gudstjenesteId, arrangementId) &&
      t.RolleID === rolleId &&
      (t.EksternNavn || "").trim().toLowerCase() === nøkkel &&
      hentSvarStatus(db, t.TildelingID) !== "Avvist"
  );
  if (allerede) return db;

  const rolle = db.roller.find((r) => r.RolleID === rolleId);
  if (rolle && erRolleHardFull(db, gudstjenesteId, rolle, arrangementId)) return db;

  const now = new Date().toISOString().split("T")[0];
  const personId = nesteEksternPersonId(db.tildelinger);
  const tildelingId = nesteNummerertId(db.tildelinger, "TildelingID", "T");
  const nyTildeling: Tildeling = {
    TildelingID: tildelingId,
    GudstjenesteID: arrangementId ? "" : gudstjenesteId,
    ArrangementID: arrangementId,
    RolleID: rolleId,
    PersonID: personId,
    EksternNavn: visningsnavn,
    OpprettetDato: now,
    SistEndret: now,
  };
  const utenSave: DatabaseState = {
    ...db,
    tildelinger: [...db.tildelinger, nyTildeling],
  };
  return settDeltakelseForPerson(
    utenSave,
    personId,
    gudstjenesteId,
    rolleId,
    "Avventer",
    kommentar || "Ekstern person (ikke i menighetsregisteret)",
    arrangementId
  );
}

const IMPORT_ROLE_COLUMNS: { col: keyof GudstjenesterImport; rolleId: string }[] = [
  { col: "Leder", rolleId: "R001" },
  { col: "Taler", rolleId: "R002" },
  { col: "Forbønn", rolleId: "R003" },
  { col: "Barnekirke", rolleId: "R004" },
  { col: "Lovsang", rolleId: "R005" },
  { col: "Lyd", rolleId: "R006" },
  { col: "Bilde", rolleId: "R007" },
  { col: "Møtevert", rolleId: "R008" },
  { col: "Rigging", rolleId: "R009" },
  { col: "Kjøkken", rolleId: "R010" },
  { col: "Baking", rolleId: "R011" },
  { col: "Pynting", rolleId: "R013" },
];

function normalizePersonName(value: string): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function splitImportNames(value: unknown): string[] {
  return String(value ?? "")
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function matchPersonByName(db: DatabaseState, rawName: string): Person | null {
  const key = normalizePersonName(rawName);
  if (!key) return null;
  const byNavn = db.personer.filter((p) => normalizePersonName(p.Navn) === key);
  if (byNavn.length === 1) return byNavn[0];
  if (byNavn.length > 1) return null;
  const byFornavn = db.personer.filter((p) => {
    const fn = normalizePersonName(p.Fornavn) || normalizePersonName(p.Navn).split(" ")[0];
    return fn === key;
  });
  return byFornavn.length === 1 ? byFornavn[0] : null;
}

export interface UkjentImportSlot {
  gudstjenesteId: string;
  rolleId: string;
  rolleNavn: string;
  dato: string;
}

export interface UkjentImportnavn {
  navn: string;
  slots: UkjentImportSlot[];
}

/** Navn i Gudstjenester_import som ikke matcher Personer — admin kan opprette dem. */
export function finnUkjenteImportnavn(db: DatabaseState): UkjentImportnavn[] {
  const grouped = new Map<string, UkjentImportnavn>();

  for (const row of db.gudstjenesterImport || []) {
    const gudstjenesteId = String(row.GudstjenesteID || "").trim();
    if (!gudstjenesteId) continue;
    const gud = db.gudstjenester.find((g) => g.GudstjenesteID === gudstjenesteId);

    for (const mapping of IMPORT_ROLE_COLUMNS) {
      const names = splitImportNames(row[mapping.col]);
      const rolle = db.roller.find((r) => r.RolleID === mapping.rolleId);
      for (const navn of names) {
        if (matchPersonByName(db, navn)) continue;
        const key = normalizePersonName(navn);
        const existing = grouped.get(key) || { navn, slots: [] };
        const already = existing.slots.some(
          (s) => s.gudstjenesteId === gudstjenesteId && s.rolleId === mapping.rolleId
        );
        if (!already) {
          existing.slots.push({
            gudstjenesteId,
            rolleId: mapping.rolleId,
            rolleNavn: rolle?.Rollenavn || mapping.col,
            dato: gud?.Dato || row.Dato || "",
          });
        }
        grouped.set(key, existing);
      }
    }
  }

  return Array.from(grouped.values());
}

export function personHarAktivTildeling(
  db: DatabaseState,
  personId: string,
  gudstjenesteId: string,
  rolleId: string,
  arrangementId?: string
): boolean {
  return db.tildelinger.some(
    (t) =>
      erHendelseRad(t, gudstjenesteId, arrangementId) &&
      t.RolleID === rolleId &&
      t.PersonID === personId &&
      hentSvarStatus(db, t.TildelingID) !== "Avvist"
  );
}

export function settTjenestebehov(
  db: DatabaseState,
  rolleId: string,
  antall: number,
  gudstjenesteId: string,
  arrangementId?: string
): DatabaseState {
  const now = new Date().toISOString().split("T")[0];
  const existingIndex = db.tjenestebehov.findIndex(
    (tb) => erHendelseRad(tb, gudstjenesteId, arrangementId) && tb.RolleID === rolleId
  );
  const tjenestebehov =
    existingIndex >= 0
      ? db.tjenestebehov.map((tb, i) =>
          i === existingIndex ? { ...tb, Antall: antall, Aktiv: true, SistEndret: now } : tb
        )
      : [
          ...db.tjenestebehov,
          {
            TjenestebehovID: nesteNummerertId(db.tjenestebehov, "TjenestebehovID", "TB"),
            GudstjenesteID: arrangementId ? "" : gudstjenesteId,
            ArrangementID: arrangementId,
            RolleID: rolleId,
            Antall: antall,
            Aktiv: true,
            OpprettetDato: now,
            SistEndret: now,
          },
        ];
  return { ...db, tjenestebehov };
}

/** Ett felt: fornavn alene, eller fornavn + etternavn når det står i kilden / skrives inn. */
export function splittVisningsnavn(raw: string): { Navn: string; Fornavn: string; Etternavn: string } {
  const parts = String(raw || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { Navn: "", Fornavn: "", Etternavn: "" };
  if (parts.length === 1) {
    return { Navn: parts[0], Fornavn: parts[0], Etternavn: "" };
  }
  const etternavn = parts[parts.length - 1];
  const fornavn = parts.slice(0, -1).join(" ");
  return { Navn: `${fornavn} ${etternavn}`.trim(), Fornavn: fornavn, Etternavn: etternavn };
}

/** Unikt navnetreff — brukes for å unngå ny person med samme visningsnavn. */
export function finnPersonMedVisningsnavn(
  db: DatabaseState,
  raw: string
): { PersonID: string; Navn: string; Fornavn: string; Etternavn: string } | undefined {
  const n = splittVisningsnavn(raw);
  const full = n.Navn.toLowerCase();
  const aktive = db.personer.filter((p) => p.Aktiv !== false);
  const eksakt = aktive.filter((p) => (p.Navn || "").trim().toLowerCase() === full);
  if (eksakt.length === 1) return eksakt[0];
  if (n.Etternavn) {
    const begge = aktive.filter(
      (p) =>
        (p.Fornavn || "").trim().toLowerCase() === n.Fornavn.toLowerCase() &&
        (p.Etternavn || "").trim().toLowerCase() === n.Etternavn.toLowerCase()
    );
    if (begge.length === 1) return begge[0];
  }
  const kunFornavn = aktive.filter(
    (p) => (p.Fornavn || "").trim().toLowerCase() === n.Fornavn.toLowerCase()
  );
  if (kunFornavn.length === 1) return kunFornavn[0];
  return undefined;
}

export function splittCelleNavn(raw: string): string[] {
  return String(raw || "")
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function uniktVisningsnavn(
  db: DatabaseState,
  person: { PersonID: string; Navn: string; Fornavn: string }
): string {
  const fn = (person.Fornavn || person.Navn || "").trim();
  if (!fn) return person.Navn || "Ukjent";
  const aktive = db.personer.filter(
    (p) => p.Aktiv !== false && !erEksternPersonId(p.PersonID)
  );
  const like = aktive.filter(
    (p) => (p.Fornavn || p.Navn || "").trim().toLowerCase() === fn.toLowerCase()
  );
  return like.length === 1 ? fn : person.Navn || fn;
}

export type ArkCellePerson = {
  tildelingId: string;
  personId: string;
  navn: string;
  status: SvarStatus;
  ekstern: boolean;
};

export type ArkCelleInnhold = {
  personer: ArkCellePerson[];
  behov: number;
  bekreftet: number;
  venter: number;
  forfall: number;
  ledige: number;
};

/** Inkluderer Avvist (strikethrough) og ghost-plasser = behov − bekreftet. */
export function arkCelleInnhold(
  db: DatabaseState,
  gudstjenesteId: string,
  rolle: Rolle
): ArkCelleInnhold {
  const behov = getEffektivtBehov(db, gudstjenesteId, rolle);
  const tildelinger = db.tildelinger.filter(
    (t) => t.GudstjenesteID === gudstjenesteId && t.RolleID === rolle.RolleID
  );
  let bekreftet = 0;
  let venter = 0;
  let forfall = 0;
  const personer: ArkCellePerson[] = tildelinger.map((t) => {
    const status = hentSvarStatus(db, t.TildelingID);
    if (status === "Avvist") forfall += 1;
    else if (status === "Bekreftet") bekreftet += 1;
    else venter += 1;
    const p = db.personer.find((pers) => pers.PersonID === t.PersonID);
    const ekstern = Boolean(t.EksternNavn) || erEksternPersonId(t.PersonID);
    return {
      tildelingId: t.TildelingID,
      personId: t.PersonID,
      navn: t.EksternNavn || (p ? uniktVisningsnavn(db, p) : tildelingVisningsnavn(db, t)),
      status,
      ekstern,
    };
  });
  return {
    personer,
    behov,
    bekreftet,
    venter,
    forfall,
    ledige: ledigePlasserForRolle(behov, bekreftet),
  };
}

export type CelleForslag = {
  personId: string;
  visningsnavn: string;
  fulltNavn: string;
  iGruppen: boolean;
  /** Annen aktiv rolle samme gudstjeneste (ikke denne cellen). */
  harOppgaveSammeDag: boolean;
  alleredeTildelt: boolean;
  sammeDagAndreRoller: string[];
  oppgaverSemester: number;
  harFlereSammeDag: boolean;
  /** Tjenestegrupper personen har valgt under Tjeneste på Min side. */
  tjenesteGrupper: string[];
};

/** Typeahead for en ark-celle. Krever ikke personrolle. */
export function foreslaPersonerForCelle(
  db: DatabaseState,
  gudstjenesteId: string,
  rolleId: string,
  query: string,
  opts?: { gruppeId?: string; limit?: number }
): CelleForslag[] {
  const q = query.trim().toLowerCase();
  const limit = opts?.limit ?? 12;
  const gud = db.gudstjenester.find((g) => g.GudstjenesteID === gudstjenesteId);
  const fraDato = gud?.Dato || new Date().toISOString().split("T")[0];
  const semester = belastningForSemester(db, fraDato);
  const gruppeMedlemIds = new Set<string>();
  if (opts?.gruppeId) {
    for (const gm of db.gruppemedlemmer || []) {
      if (gm.Aktiv && gm.GruppeID === opts.gruppeId) gruppeMedlemIds.add(gm.PersonID);
    }
    const gruppe = db.grupper.find((g) => g.GruppeID === opts.gruppeId);
    if (gruppe?.GruppelederID) gruppeMedlemIds.add(gruppe.GruppelederID);
    if (gruppe?.NestlederID) gruppeMedlemIds.add(gruppe.NestlederID);
  }
  const opptatt = new Set(
    db.tildelinger
      .filter(
        (t) =>
          t.GudstjenesteID === gudstjenesteId &&
          t.RolleID === rolleId &&
          hentSvarStatus(db, t.TildelingID) !== "Avvist"
      )
      .map((t) => t.PersonID)
  );

  const treffer = (p: Person) => {
    if (!q) return true;
    const navn = `${p.Fornavn || ""} ${p.Etternavn || ""} ${p.Navn || ""}`.toLowerCase();
    return navn.includes(q);
  };

  const kandidater = db.personer.filter(
    (p) => p.Aktiv !== false && !erEksternPersonId(p.PersonID) && treffer(p)
  );

  kandidater.sort((a, b) => {
    const aG = gruppeMedlemIds.has(a.PersonID) ? 0 : 1;
    const bG = gruppeMedlemIds.has(b.PersonID) ? 0 : 1;
    if (aG !== bG) return aG - bG;
    return (a.Fornavn || a.Navn).localeCompare(b.Fornavn || b.Navn, "nb");
  });

  return kandidater.slice(0, limit).map((p) => {
    const rad = semester.rader.find((r) => r.personId === p.PersonID);
    const celler = rad?.celler[gudstjenesteId] || [];
    const sammeDagAndreRoller = celler
      .filter((c) => c.rolleId !== rolleId)
      .map((c) => c.rollenavn);
    return {
      personId: p.PersonID,
      visningsnavn: uniktVisningsnavn(db, p),
      fulltNavn: p.Navn,
      iGruppen: gruppeMedlemIds.has(p.PersonID),
      harOppgaveSammeDag: sammeDagAndreRoller.length > 0,
      alleredeTildelt: opptatt.has(p.PersonID),
      sammeDagAndreRoller,
      oppgaverSemester: rad?.oppgaver ?? 0,
      harFlereSammeDag: Boolean(rad?.harFlereSammeDag) || sammeDagAndreRoller.length > 0,
      tjenesteGrupper: tjenesteGruppenavnForPerson(db, p.PersonID),
    };
  });
}

export function tildelEksternPersonMedStatus(
  db: DatabaseState,
  gudstjenesteId: string,
  rolleId: string,
  navn: string,
  status: DeltakelseStatus,
  kommentar?: string
): DatabaseState {
  const visningsnavn = navn.trim();
  if (!visningsnavn) return db;
  const nøkkel = visningsnavn.toLowerCase();
  const eksisterende = db.tildelinger.find(
    (t) =>
      t.GudstjenesteID === gudstjenesteId &&
      t.RolleID === rolleId &&
      (t.EksternNavn || "").trim().toLowerCase() === nøkkel
  );
  let next = db;
  if (eksisterende) {
    next = settDeltakelseForPerson(
      db,
      eksisterende.PersonID,
      gudstjenesteId,
      rolleId,
      status === "Deltar" ? "Deltar" : status === "Avvist" ? "Avvist" : "Avventer",
      kommentar
    );
    return next;
  }
  next = tildelEksternPerson(db, gudstjenesteId, rolleId, visningsnavn, kommentar);
  if (status === "Deltar") {
    const t = next.tildelinger.find(
      (x) =>
        x.GudstjenesteID === gudstjenesteId &&
        x.RolleID === rolleId &&
        (x.EksternNavn || "").trim().toLowerCase() === nøkkel
    );
    if (t) {
      next = settDeltakelseForPerson(
        next,
        t.PersonID,
        gudstjenesteId,
        rolleId,
        "Deltar",
        kommentar
      );
    }
  }
  return next;
}

/** Komma-separerte navn → tildelinger. Unikt fornavn treffer registeret. */
export function tildelNavnICelle(
  db: DatabaseState,
  gudstjenesteId: string,
  rolleId: string,
  raw: string,
  status: DeltakelseStatus,
  kommentar?: string
): DatabaseState {
  const navn = splittCelleNavn(raw);
  let next = db;
  for (const n of navn) {
    const person = finnPersonMedVisningsnavn(next, n);
    if (person) {
      next = settDeltakelseForPerson(
        next,
        person.PersonID,
        gudstjenesteId,
        rolleId,
        status,
        kommentar
      );
    } else {
      next = tildelEksternPersonMedStatus(
        next,
        gudstjenesteId,
        rolleId,
        n,
        status,
        kommentar
      );
    }
  }
  return next;
}

export function fjernSisteFraCelle(
  db: DatabaseState,
  gudstjenesteId: string,
  rolleId: string
): DatabaseState {
  const tildelinger = db.tildelinger.filter(
    (t) => t.GudstjenesteID === gudstjenesteId && t.RolleID === rolleId
  );
  const siste = tildelinger[tildelinger.length - 1];
  if (!siste) return db;
  return settDeltakelseForPerson(
    db,
    siste.PersonID,
    gudstjenesteId,
    rolleId,
    "Deltar ikke"
  );
}

export function tomArkCelle(
  db: DatabaseState,
  gudstjenesteId: string,
  rolleId: string
): DatabaseState {
  const tildelinger = db.tildelinger.filter(
    (t) => t.GudstjenesteID === gudstjenesteId && t.RolleID === rolleId
  );
  let next = db;
  for (const t of tildelinger) {
    next = settDeltakelseForPerson(
      next,
      t.PersonID,
      gudstjenesteId,
      rolleId,
      "Deltar ikke"
    );
  }
  return next;
}

/** Opprett person. Etternavn lagres bare hvis navnet har mer enn ett ord. */
export function opprettPersonIRegister(
  db: DatabaseState,
  input: { Navn: string },
  slots: UkjentImportSlot[] = []
): DatabaseState {
  const now = new Date().toISOString().split("T")[0];
  const navn = splittVisningsnavn(input.Navn);
  const person: Person = {
    PersonID: nesteNummerertId(db.personer, "PersonID", "P"),
    Navn: navn.Navn,
    Fornavn: navn.Fornavn,
    Etternavn: navn.Etternavn,
    Epost: "",
    Telefon: "",
    Notat: "",
    Tilgangsnivå: "bruker",
    Aktiv: true,
    OpprettetDato: now,
    SistEndret: now,
  };

  let tildelinger = [...db.tildelinger];
  let svar = [...db.svar];
  let personroller = [...db.personroller];

  for (const slot of slots) {
    const alreadyAssigned = tildelinger.some(
      (t) =>
        t.GudstjenesteID === slot.gudstjenesteId &&
        t.RolleID === slot.rolleId &&
        t.PersonID === person.PersonID
    );
    if (alreadyAssigned) continue;

    const tildelingId = nesteNummerertId(tildelinger, "TildelingID", "T");
    tildelinger = [
      ...tildelinger,
      {
        TildelingID: tildelingId,
        GudstjenesteID: slot.gudstjenesteId,
        RolleID: slot.rolleId,
        PersonID: person.PersonID,
        OpprettetDato: now,
        SistEndret: now,
      },
    ];
    svar = [
      ...svar,
      {
        SvarID: nesteNummerertId(svar, "SvarID", "S"),
        TildelingID: tildelingId,
        PersonID: person.PersonID,
        Svar: "Venter",
        Kommentar: "",
        SvartDato: "",
      },
    ];

    const hasRolle = personroller.some(
      (pr) => pr.PersonID === person.PersonID && pr.RolleID === slot.rolleId && pr.Aktiv
    );
    if (!hasRolle) {
      personroller = [
        ...personroller,
        {
          PersonRolleID: nesteNummerertId(personroller, "PersonRolleID", "PR"),
          PersonID: person.PersonID,
          RolleID: slot.rolleId,
          Aktiv: true,
          FraDato: now,
          TilDato: "",
          Notat: "",
          OpprettetDato: now,
          SistEndret: now,
        },
      ];
    }
  }

  return {
    ...db,
    personer: [...db.personer, person],
    tildelinger,
    svar,
    personroller,
  };
}

/** Oppdater navn, e-post, telefon og aktiv-status for en eksisterende person. */
export function oppdaterPersonIRegister(
  db: DatabaseState,
  personId: string,
  input: {
    Navn: string;
    Epost: string;
    Telefon: string;
    Aktiv: boolean;
    Tilgangsnivå?: Person["Tilgangsnivå"];
  }
): DatabaseState {
  const navn = splittVisningsnavn(input.Navn);
  if (!navn.Navn) return db;
  const now = new Date().toISOString().split("T")[0];
  const epost = String(input.Epost || "").trim();
  const telefon = String(input.Telefon || "").trim();
  return {
    ...db,
    personer: db.personer.map((p) =>
      p.PersonID === personId
        ? {
            ...p,
            Navn: navn.Navn,
            Fornavn: navn.Fornavn,
            Etternavn: navn.Etternavn,
            Epost: epost,
            Telefon: telefon,
            Aktiv: input.Aktiv,
            Tilgangsnivå: input.Tilgangsnivå || p.Tilgangsnivå || "bruker",
            SistEndret: now,
          }
        : p
    ),
  };
}

function normaliserSletteNavn(navn: string): string {
  return String(navn || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("nb");
}

export function navnBekrefterSletting(skrevet: string, person: Person): boolean {
  const a = normaliserSletteNavn(skrevet);
  if (!a) return false;
  if (a === normaliserSletteNavn(person.Navn)) return true;
  const fullt = normaliserSletteNavn(`${person.Fornavn || ""} ${person.Etternavn || ""}`);
  return Boolean(fullt) && a === fullt;
}

/** Hard slett person. Krever at bekreftetNavn matcher personens navn. */
export function slettPersonIRegister(
  db: DatabaseState,
  personId: string,
  bekreftetNavn: string
): { success: boolean; message: string; updatedDb?: DatabaseState } {
  const person = db.personer.find((p) => p.PersonID === personId);
  if (!person) {
    return { success: false, message: "Personen finnes ikke." };
  }
  if (!navnBekrefterSletting(bekreftetNavn, person)) {
    return {
      success: false,
      message: "Navnet stemmer ikke. Skriv hele navnet slik det står i registeret.",
    };
  }
  if (hentTilgang(db, personId).isAdmin) {
    const adminAntall = db.personer.filter((p) => hentTilgang(db, p.PersonID).isAdmin).length;
    if (adminAntall <= 1) {
      return { success: false, message: "Du kan ikke slette den siste administratoren." };
    }
  }

  const tildelingIds = new Set(
    (db.tildelinger || [])
      .filter((t) => t.PersonID === personId)
      .map((t) => t.TildelingID)
  );
  const now = new Date().toISOString().split("T")[0];
  const grupper = (db.grupper || []).map((g) => {
    const leder = g.GruppelederID === personId;
    const nest = g.NestlederID === personId;
    if (!leder && !nest) return g;
    return {
      ...g,
      GruppelederID: leder ? undefined : g.GruppelederID,
      NestlederID: nest ? undefined : g.NestlederID,
      SistEndret: now,
    };
  });

  let neste: DatabaseState = {
    ...db,
    personer: db.personer.filter((p) => p.PersonID !== personId),
    personroller: (db.personroller || []).filter((pr) => pr.PersonID !== personId),
    gruppemedlemmer: (db.gruppemedlemmer || []).filter((gm) => gm.PersonID !== personId),
    tildelinger: (db.tildelinger || []).filter((t) => t.PersonID !== personId),
    svar: (db.svar || []).filter(
      (s) => s.PersonID !== personId && !tildelingIds.has(s.TildelingID)
    ),
    grupper,
    programinstanser: (db.programinstanser || []).map((pi) =>
      pi.PublisertAv === personId ? { ...pi, PublisertAv: "" } : pi
    ),
  };
  neste = synkGruppeledergruppe(neste);
  return {
    success: true,
    message: `${person.Navn} er slettet, inkludert alle tildelte oppgaver.`,
    updatedDb: neste,
  };
}
