import { MalAktivitet, ProgramAktivitet, Programinstans, Rolle, Gruppe, SvarStatus } from "../types/database";
import type { DatabaseState } from "../types/database";
import { initialMalaktiviteter } from "../data/initialData";
import { nesteNummerertId } from "./ids";
import {
  hentSvarStatus,
  tildelingVisningsnavn,
  finnMotelederRolle,
  erHendelseRad,
  situasjonRollerForGudstjeneste,
} from "./bemanning";
import { erAdministrator } from "./tilgang";
import { sortertMalposter, sikreTjenestebehovFraMal } from "./mal";

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
  gudstjenesteId: string,
  arrangementId?: string
): ProgramAktivitet[] {
  return (db.programaktiviteter || [])
    .filter((p) => erHendelseRad(p, gudstjenesteId, arrangementId))
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
  rolleId?: string,
  arrangementId?: string
): { rolle?: Rolle; gruppe?: Gruppe; personer: BrikkeAnsvarPerson[] } {
  if (!rolleId) return { personer: [] };
  const rolle = (db.roller || []).find((r) => r.RolleID === rolleId);
  const gruppe = rolle?.GruppeID
    ? (db.grupper || []).find((g) => g.GruppeID === rolle.GruppeID)
    : undefined;
  const personer = (db.tildelinger || [])
    .filter((t) => erHendelseRad(t, gudstjenesteId, arrangementId) && t.RolleID === rolleId)
    .filter((t) => hentSvarStatus(db, t.TildelingID) !== "Avvist")
    .map((t) => ({
      personId: t.PersonID,
      navn: tildelingVisningsnavn(db, t),
      status: hentSvarStatus(db, t.TildelingID),
    }));
  return { rolle, gruppe, personer };
}

/** Publisert program: rolle og navn, uten gruppenavn. «Taler: Magnar», «Lovsang: Ola». */
export function formatRolleOgPersoner(
  rolleNavn?: string,
  personer?: { navn: string }[]
): string {
  const rolle = String(rolleNavn || "").trim();
  const navn = (personer || [])
    .map((p) => String(p.navn || "").trim())
    .filter(Boolean)
    .join(", ");
  if (rolle && navn) return `${rolle}: ${navn}`;
  return rolle || navn;
}

export type OvrigBemanningRad = {
  rolleId: string;
  tekst: string;
};

/** Roller med behov (eller tildeling) som ikke allerede står på en programpost. */
export function øvrigBemanningForProgram(
  db: DatabaseState,
  gudstjenesteId: string
): OvrigBemanningRad[] {
  const iProgram = new Set(
    programForGudstjeneste(db, gudstjenesteId)
      .map((p) => p.RolleID)
      .filter((id): id is string => Boolean(id))
  );
  return situasjonRollerForGudstjeneste(db, gudstjenesteId)
    .filter((rad) => !iProgram.has(rad.rolle.RolleID))
    .map((rad) => ({
      rolleId: rad.rolle.RolleID,
      tekst: formatRolleOgPersoner(
        rad.rolle.Rollenavn,
        rad.personer.length > 0 ? rad.personer : [{ navn: "—" }]
      ),
    }));
}

export function kanRedigereProgram(
  db: DatabaseState,
  personId: string,
  gudstjenesteId?: string,
  arrangementId?: string
): boolean {
  if (erAdministrator(db, personId)) return true;
  if (arrangementId) return false;
  if (!gudstjenesteId) return false;
  const rolle = finnMotelederRolle(db);
  if (!rolle) return false;
  const tildeling = (db.tildelinger || []).find(
    (t) =>
      erHendelseRad(t, gudstjenesteId) &&
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
  gudstjenesteId: string,
  arrangementId?: string
): Programinstans | undefined {
  return (db.programinstanser || []).find((p) => erHendelseRad(p, gudstjenesteId, arrangementId));
}

export function erProgramPublisert(
  db: DatabaseState,
  gudstjenesteId: string,
  arrangementId?: string
): boolean {
  return hentPrograminstans(db, gudstjenesteId, arrangementId)?.Status === "Publisert";
}

function upsertPrograminstans(
  db: DatabaseState,
  gudstjenesteId: string,
  patch: Partial<Programinstans>,
  arrangementId?: string
): DatabaseState {
  const now = dagensDatoFelt();
  const eksisterende = hentPrograminstans(db, gudstjenesteId, arrangementId);
  const rad: Programinstans = {
    Status: "Utkast",
    PublisertDato: "",
    PublisertAv: "",
    OpprettetDato: now,
    ...eksisterende,
    ...patch,
    GudstjenesteID: arrangementId ? "" : gudstjenesteId,
    ArrangementID: arrangementId,
    SistEndret: now,
  };
  const uten = (db.programinstanser || []).filter(
    (p) => !erHendelseRad(p, gudstjenesteId, arrangementId)
  );
  return { ...db, programinstanser: [...uten, rad] };
}

export function opprettProgramFraMal(
  db: DatabaseState,
  gudstjenesteId: string,
  arrangementId?: string
): DatabaseState {
  let kopiert = kopierMalTilGudstjeneste(db, gudstjenesteId, arrangementId);
  if (arrangementId) kopiert = sikreTjenestebehovFraMal(kopiert, arrangementId);
  if (hentPrograminstans(kopiert, gudstjenesteId, arrangementId)) return kopiert;
  return upsertPrograminstans(kopiert, gudstjenesteId, { Status: "Utkast" }, arrangementId);
}

export function publiserProgram(
  db: DatabaseState,
  gudstjenesteId: string,
  personId: string,
  arrangementId?: string
): DatabaseState {
  if (programForGudstjeneste(db, gudstjenesteId, arrangementId).length === 0) return db;
  const now = dagensDatoFelt();
  return upsertPrograminstans(
    db,
    gudstjenesteId,
    {
      Status: "Publisert",
      PublisertDato: now,
      PublisertAv: personId,
    },
    arrangementId
  );
}

export function avpubliserProgram(
  db: DatabaseState,
  gudstjenesteId: string,
  arrangementId?: string
): DatabaseState {
  if (!hentPrograminstans(db, gudstjenesteId, arrangementId)) return db;
  return upsertPrograminstans(
    db,
    gudstjenesteId,
    {
      Status: "Utkast",
      PublisertDato: "",
      PublisertAv: "",
    },
    arrangementId
  );
}

function dagensDatoFelt(): string {
  return new Date().toISOString().split("T")[0];
}

function posterForProgramKopi(
  db: DatabaseState,
  arrangementId?: string
): Array<{ Tittel: string; VarighetMin: number; RolleID?: string; ForStart: boolean; Merknad?: string }> {
  if (arrangementId) {
    const arr = (db.arrangementer || []).find((a) => a.ArrangementID === arrangementId);
    if (arr?.MalID) return sortertMalposter(db, arr.MalID);
  }
  return sortertMalaktiviteter(db);
}

export function kopierMalTilGudstjeneste(
  db: DatabaseState,
  gudstjenesteId: string,
  arrangementId?: string
): DatabaseState {
  const now = dagensDatoFelt();
  const mal = posterForProgramKopi(db, arrangementId);
  const utenDenne = (db.programaktiviteter || []).filter(
    (p) => !erHendelseRad(p, gudstjenesteId, arrangementId)
  );
  let neste = utenDenne;
  const nye: ProgramAktivitet[] = mal.map((m, index) => {
    const id = nesteNummerertId(neste, "ProgramAktivitetID", "PA");
    const rad: ProgramAktivitet = {
      ProgramAktivitetID: id,
      GudstjenesteID: arrangementId ? "" : gudstjenesteId,
      ArrangementID: arrangementId,
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
  gudstjenesteId: string,
  arrangementId?: string
): DatabaseState {
  return kopierMalTilGudstjeneste(db, gudstjenesteId, arrangementId);
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
  gudstjenesteId: string,
  arrangementId?: string
): ProgramAktivitet {
  const now = dagensDatoFelt();
  const iGud = eksisterende.filter((p) => erHendelseRad(p, gudstjenesteId, arrangementId));
  const maxRekke = iGud.reduce((acc, p) => Math.max(acc, p.Rekkefolge || 0), 0);
  return {
    ProgramAktivitetID: nesteNummerertId(eksisterende, "ProgramAktivitetID", "PA"),
    GudstjenesteID: arrangementId ? "" : gudstjenesteId,
    ArrangementID: arrangementId,
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
