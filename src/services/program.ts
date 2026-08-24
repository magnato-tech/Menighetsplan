import { MalAktivitet, ProgramAktivitet, Programinstans, Rolle, Gruppe, SvarStatus } from "../types/database";
import type { DatabaseState } from "../types/database";
import { initialMalaktiviteter } from "../data/initialData";
import { nesteNummerertId } from "./ids";
import { hentSvarStatus, tildelingVisningsnavn, finnMotelederRolle } from "./bemanning";
import { erAdministrator } from "./tilgang";

export function parseKlokkeMinutter(tid: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(tid || "").trim());
  if (!m) return 11 * 60;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function formatKlokkeMinutter(min: number): string {
  const wrapped = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const mm = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export type ProgramLinje = {
  Rekkefolge?: number;
  VarighetMin: number;
  ForStart?: boolean;
};

export type ProgramTidslinjeRad<T extends ProgramLinje> = T & {
  start: string;
  slutt: string;
};

/** Offisiell start minus ledende «Før start»-brikker, deretter kumulativ varighet. 0 min flytter ikke klokka. */
export function beregnProgramtider<T extends ProgramLinje>(
  aktiviteter: T[],
  startTid: string
): ProgramTidslinjeRad<T>[] {
  const sorted = [...aktiviteter].sort((a, b) => (a.Rekkefolge ?? 0) - (b.Rekkefolge ?? 0));
  let prefix = 0;
  for (const a of sorted) {
    if (!a.ForStart) break;
    prefix += Math.max(0, Number(a.VarighetMin) || 0);
  }
  let cursor = parseKlokkeMinutter(startTid) - prefix;
  return sorted.map((a) => {
    const dur = Math.max(0, Number(a.VarighetMin) || 0);
    const start = formatKlokkeMinutter(cursor);
    const slutt = formatKlokkeMinutter(cursor + dur);
    cursor += dur;
    return { ...a, start, slutt };
  });
}

export function sortertMalaktiviteter(db: DatabaseState): MalAktivitet[] {
  return [...(db.malaktiviteter || [])].sort((a, b) => a.Rekkefolge - b.Rekkefolge);
}

export function programForGudstjeneste(
  db: DatabaseState,
  gudstjenesteId: string
): ProgramAktivitet[] {
  return (db.programaktiviteter || [])
    .filter((p) => p.GudstjenesteID === gudstjenesteId)
    .sort((a, b) => a.Rekkefolge - b.Rekkefolge);
}

export type BrikkeAnsvarPerson = {
  personId: string;
  navn: string;
  status: SvarStatus;
};

export function hentAnsvarForBrikke(
  db: DatabaseState,
  gudstjenesteId: string,
  rolleId?: string
): { rolle?: Rolle; gruppe?: Gruppe; personer: BrikkeAnsvarPerson[] } {
  if (!rolleId) return { personer: [] };
  const rolle = (db.roller || []).find((r) => r.RolleID === rolleId);
  const gruppe = rolle?.GruppeID
    ? (db.grupper || []).find((g) => g.GruppeID === rolle.GruppeID)
    : undefined;
  const personer = (db.tildelinger || [])
    .filter((t) => t.GudstjenesteID === gudstjenesteId && t.RolleID === rolleId)
    .filter((t) => hentSvarStatus(db, t.TildelingID) !== "Avvist")
    .map((t) => ({
      personId: t.PersonID,
      navn: tildelingVisningsnavn(db, t),
      status: hentSvarStatus(db, t.TildelingID),
    }));
  return { rolle, gruppe, personer };
}

export function kanRedigereProgram(
  db: DatabaseState,
  personId: string,
  gudstjenesteId?: string
): boolean {
  if (erAdministrator(db, personId)) return true;
  if (!gudstjenesteId) return false;
  const rolle = finnMotelederRolle(db);
  if (!rolle) return false;
  const tildeling = (db.tildelinger || []).find(
    (t) =>
      t.GudstjenesteID === gudstjenesteId &&
      t.RolleID === rolle.RolleID &&
      t.PersonID === personId
  );
  if (!tildeling) return false;
  return hentSvarStatus(db, tildeling.TildelingID) !== "Avvist";
}

export function visProgramIkon(
  db: DatabaseState,
  personId: string,
  gudstjenesteId: string
): boolean {
  return kanRedigereProgram(db, personId, gudstjenesteId) || erProgramPublisert(db, gudstjenesteId);
}

export function hentPrograminstans(
  db: DatabaseState,
  gudstjenesteId: string
): Programinstans | undefined {
  return (db.programinstanser || []).find((p) => p.GudstjenesteID === gudstjenesteId);
}

export function erProgramPublisert(db: DatabaseState, gudstjenesteId: string): boolean {
  return hentPrograminstans(db, gudstjenesteId)?.Status === "Publisert";
}

function upsertPrograminstans(
  db: DatabaseState,
  gudstjenesteId: string,
  patch: Partial<Programinstans>
): DatabaseState {
  const now = dagensDatoFelt();
  const eksisterende = hentPrograminstans(db, gudstjenesteId);
  const rad: Programinstans = {
    Status: "Utkast",
    PublisertDato: "",
    PublisertAv: "",
    OpprettetDato: now,
    ...eksisterende,
    ...patch,
    GudstjenesteID: gudstjenesteId,
    SistEndret: now,
  };
  const uten = (db.programinstanser || []).filter((p) => p.GudstjenesteID !== gudstjenesteId);
  return { ...db, programinstanser: [...uten, rad] };
}

export function opprettProgramFraMal(db: DatabaseState, gudstjenesteId: string): DatabaseState {
  const kopiert = kopierMalTilGudstjeneste(db, gudstjenesteId);
  if (hentPrograminstans(kopiert, gudstjenesteId)) return kopiert;
  return upsertPrograminstans(kopiert, gudstjenesteId, { Status: "Utkast" });
}

export function publiserProgram(
  db: DatabaseState,
  gudstjenesteId: string,
  personId: string
): DatabaseState {
  if (programForGudstjeneste(db, gudstjenesteId).length === 0) return db;
  const now = dagensDatoFelt();
  return upsertPrograminstans(db, gudstjenesteId, {
    Status: "Publisert",
    PublisertDato: now,
    PublisertAv: personId,
  });
}

export function avpubliserProgram(db: DatabaseState, gudstjenesteId: string): DatabaseState {
  if (!hentPrograminstans(db, gudstjenesteId)) return db;
  return upsertPrograminstans(db, gudstjenesteId, {
    Status: "Utkast",
    PublisertDato: "",
    PublisertAv: "",
  });
}

function dagensDatoFelt(): string {
  return new Date().toISOString().split("T")[0];
}

export function kopierMalTilGudstjeneste(
  db: DatabaseState,
  gudstjenesteId: string
): DatabaseState {
  const now = dagensDatoFelt();
  const mal = sortertMalaktiviteter(db);
  const utenDenne = (db.programaktiviteter || []).filter((p) => p.GudstjenesteID !== gudstjenesteId);
  let neste = utenDenne;
  const nye: ProgramAktivitet[] = mal.map((m, index) => {
    const id = nesteNummerertId(neste, "ProgramAktivitetID", "PA");
    const rad: ProgramAktivitet = {
      ProgramAktivitetID: id,
      GudstjenesteID: gudstjenesteId,
      Rekkefolge: index + 1,
      Tittel: m.Tittel,
      VarighetMin: Number(m.VarighetMin) || 0,
      RolleID: m.RolleID || "",
      ForStart: Boolean(m.ForStart),
      Merknad: m.Merknad || "",
      OpprettetDato: now,
      SistEndret: now,
    };
    neste = [...neste, rad];
    return rad;
  });
  return { ...db, programaktiviteter: [...utenDenne, ...nye] };
}

export function tilbakestillProgramFraMal(
  db: DatabaseState,
  gudstjenesteId: string
): DatabaseState {
  return kopierMalTilGudstjeneste(db, gudstjenesteId);
}

export function fyllStandardMalaktiviteter(db: DatabaseState): DatabaseState {
  return { ...db, malaktiviteter: initialMalaktiviteter.map((m) => ({ ...m })) };
}

export function omskrivMalRekkefolge(linjer: MalAktivitet[]): MalAktivitet[] {
  const now = dagensDatoFelt();
  return linjer.map((m, i) => ({ ...m, Rekkefolge: i + 1, SistEndret: now }));
}

export function omskrivProgramRekkefolge(linjer: ProgramAktivitet[]): ProgramAktivitet[] {
  const now = dagensDatoFelt();
  return linjer.map((p, i) => ({ ...p, Rekkefolge: i + 1, SistEndret: now }));
}

export function nyMalAktivitet(eksisterende: MalAktivitet[]): MalAktivitet {
  const now = dagensDatoFelt();
  const maxRekke = eksisterende.reduce((acc, m) => Math.max(acc, m.Rekkefolge || 0), 0);
  return {
    MalAktivitetID: nesteNummerertId(eksisterende, "MalAktivitetID", "MA"),
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

export function nyProgramAktivitet(
  eksisterende: ProgramAktivitet[],
  gudstjenesteId: string
): ProgramAktivitet {
  const now = dagensDatoFelt();
  const iGud = eksisterende.filter((p) => p.GudstjenesteID === gudstjenesteId);
  const maxRekke = iGud.reduce((acc, p) => Math.max(acc, p.Rekkefolge || 0), 0);
  return {
    ProgramAktivitetID: nesteNummerertId(eksisterende, "ProgramAktivitetID", "PA"),
    GudstjenesteID: gudstjenesteId,
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
