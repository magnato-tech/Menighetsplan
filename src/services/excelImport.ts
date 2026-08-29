import * as XLSX from "xlsx";
import type { DatabaseState } from "../types/database";
import { tilIsoDato, tilIsoTid } from "./dato";

type ArkSpec = {
  key: keyof DatabaseState;
  name: string;
  columns: string[];
  booleans?: string[];
  falseBooleans?: string[];
  numbers?: string[];
};

const HEADER_ALIASES: Record<string, string[]> = {
  Tema: ["Tema", "Tittel"],
  Bibeltekst: ["Bibeltekst", "Bibel", "Tekst"],
  Merknad: ["Merknad", "Notat", "Kommentar"],
  Tid: ["Tid", "Klokkeslett", "Kl"],
  Epost: ["Epost", "E-post", "E-postadresse", "Email", "E-mail", "Mail"],
  SikkerhetsToken: ["SikkerhetsToken", "Sikkerhetstoken", "Token"],
};

const MASTER_ARK: ArkSpec[] = [
  {
    key: "gruppetyper",
    name: "Gruppetyper",
    columns: ["GruppetypeID", "Navn", "Beskrivelse", "Aktiv", "OpprettetDato", "SistEndret"],
    booleans: ["Aktiv"],
  },
  {
    key: "personer",
    name: "Personer",
    columns: [
      "PersonID", "Navn", "Fornavn", "Etternavn", "Epost", "Telefon", "BildeURL",
      "Fødselsår", "Fødselsdato", "Kjønn", "Adresse", "Postnummer", "Poststed",
      "Notat", "SikkerhetsToken", "Tilgangsnivå", "Aktiv", "OpprettetDato", "SistEndret",
    ],
    booleans: ["Aktiv"],
    numbers: ["Fødselsår"],
  },
  {
    key: "grupper",
    name: "Grupper",
    columns: [
      "GruppeID", "Gruppenavn", "GruppetypeID", "GruppelederID", "NestlederID",
      "Beskrivelse", "Aktiv", "OpprettetDato", "SistEndret",
    ],
    booleans: ["Aktiv"],
  },
  {
    key: "gruppemedlemmer",
    name: "Gruppemedlemmer",
    columns: [
      "GruppeMedlemID", "GruppeID", "PersonID", "Medlemsrolle", "Aktiv",
      "FraDato", "TilDato", "Notat", "OpprettetDato", "SistEndret",
    ],
    booleans: ["Aktiv"],
  },
  {
    key: "roller",
    name: "Roller",
    columns: [
      "RolleID", "Rollenavn", "Beskrivelse", "BidraPreposisjon", "Aktiv", "Behov", "MaksAntall", "GruppeID",
      "OpprettetDato", "SistEndret",
    ],
    booleans: ["Aktiv"],
    numbers: ["Behov", "MaksAntall"],
  },
  {
    key: "personroller",
    name: "Personroller",
    columns: [
      "PersonRolleID", "PersonID", "RolleID", "Aktiv", "FraDato", "TilDato",
      "Notat", "OpprettetDato", "SistEndret",
    ],
    booleans: ["Aktiv"],
  },
  {
    key: "rollebeskrivelser",
    name: "Rollebeskrivelser",
    columns: ["RolleID", "Rollebeskrivelse", "Aktiv", "OpprettetDato", "SistEndret"],
    booleans: ["Aktiv"],
  },
  {
    key: "gudstjenester",
    name: "Gudstjenester",
    columns: [
      "GudstjenesteID", "Dato", "Tid", "Sted", "Tema", "Bibeltekst", "Kollekt",
      "Kunngjøringer", "Merknad", "EksternKalenderID",
    ],
  },
  {
    key: "arrangementer",
    name: "Arrangementer",
    columns: [
      "ArrangementID", "Dato", "Tid", "Sted", "Tittel", "Beskrivelse", "GruppeID",
      "OpprettetAv", "EksternKalenderID", "MalID", "Aktiv", "OpprettetDato", "SistEndret",
    ],
    booleans: ["Aktiv"],
  },
  {
    key: "kalenderoppgaver",
    name: "Kalenderoppgaver",
    columns: [
      "KalenderoppgaveID", "EksternUID", "Dato", "Tid", "Sted", "Tittel", "Beskrivelse",
      "Status", "ArrangementID", "OpprettetDato", "SistEndret",
    ],
  },
  {
    key: "tjenestebehov",
    name: "Tjenestebehov",
    columns: [
      "TjenestebehovID", "GudstjenesteID", "ArrangementID", "RolleID", "Antall", "Aktiv",
      "Notat", "OpprettetDato", "SistEndret",
    ],
    booleans: ["Aktiv"],
    numbers: ["Antall"],
  },
  {
    key: "tildelinger",
    name: "Tildelinger",
    columns: [
      "TildelingID", "GudstjenesteID", "ArrangementID", "RolleID", "PersonID",
      "EksternNavn", "OpprettetDato", "SistEndret",
    ],
  },
  {
    key: "svar",
    name: "Svar",
    columns: ["SvarID", "TildelingID", "PersonID", "Svar", "Kommentar", "SvartDato"],
  },
  {
    key: "malaktiviteter",
    name: "Malaktiviteter",
    columns: [
      "MalAktivitetID", "Rekkefolge", "Tittel", "VarighetMin", "RolleID",
      "ForStart", "Merknad", "OpprettetDato", "SistEndret",
    ],
    booleans: ["ForStart"],
    falseBooleans: ["ForStart"],
    numbers: ["Rekkefolge", "VarighetMin"],
  },
  {
    key: "maler",
    name: "Maler",
    columns: ["MalID", "Navn", "Aktiv", "OpprettetDato", "SistEndret"],
    booleans: ["Aktiv"],
  },
  {
    key: "malposter",
    name: "Malposter",
    columns: [
      "MalPostID", "MalID", "Rekkefolge", "Tittel", "VarighetMin", "RolleID",
      "ForStart", "Merknad", "OpprettetDato", "SistEndret",
    ],
    booleans: ["ForStart"],
    falseBooleans: ["ForStart"],
    numbers: ["Rekkefolge", "VarighetMin"],
  },
  {
    key: "malTilleggsvakter",
    name: "MalTilleggsvakter",
    columns: [
      "MalTilleggsvaktID", "MalID", "RolleID", "Antall", "Aktiv",
      "OpprettetDato", "SistEndret",
    ],
    booleans: ["Aktiv"],
    numbers: ["Antall"],
  },
  {
    key: "programaktiviteter",
    name: "Programaktiviteter",
    columns: [
      "ProgramAktivitetID", "GudstjenesteID", "ArrangementID", "Rekkefolge", "Tittel",
      "VarighetMin", "RolleID", "ForStart", "Merknad", "OpprettetDato", "SistEndret",
    ],
    booleans: ["ForStart"],
    falseBooleans: ["ForStart"],
    numbers: ["Rekkefolge", "VarighetMin"],
  },
  {
    key: "programinstanser",
    name: "Programinstanser",
    columns: [
      "GudstjenesteID", "ArrangementID", "Status", "PublisertDato", "PublisertAv",
      "OpprettetDato", "SistEndret",
    ],
  },
  {
    key: "innstillinger",
    name: "Innstillinger",
    columns: ["Nøkkel", "Verdi"],
  },
  {
    key: "personerImport",
    name: "Personer_import",
    columns: [
      "PersonID", "Navn", "Epost", "Telefon",
      "Tjenesteområde1", "Tjenesteområde2", "Tjenesteområde3",
      "Tjenesteområde4", "Tjenesteområde5", "Aktiv",
    ],
    booleans: ["Aktiv"],
  },
  {
    key: "gudstjenesterImport",
    name: "Gudstjenester_import",
    columns: [
      "GudstjenesteID", "Dato", "Tid", "Sted", "Tema", "Bibeltekst", "Kollekt", "Merknad",
      "Leder", "Taler", "Forbønn", "Barnekirke", "Lovsang", "Lyd", "Bilde",
      "Møtevert", "Rigging", "Kjøkken", "Baking", "Pynting",
    ],
  },
  {
    key: "rollebeskrivelseImport",
    name: "Rollebeskrivelse_import",
    columns: ["RolleID", "Rollenavn", "FullBeskrivelse", "SjekklisteGammel"],
  },
];

function normHeader(h: string): string {
  return String(h || "").trim().toLowerCase().replace(/\s+/g, "");
}

function headerIndex(headers: string[], col: string): number {
  const aliases = HEADER_ALIASES[col] || [col];
  for (const alias of aliases) {
    const want = normHeader(alias);
    const idx = headers.findIndex((h) => normHeader(h) === want);
    if (idx >= 0) return idx;
  }
  return -1;
}

function findHeaderRow(values: string[][], requiredHeader: string): number {
  const want = normHeader(requiredHeader);
  for (let i = 0; i < values.length; i++) {
    if (values[i].some((cell) => normHeader(cell) === want)) return i;
  }
  return 0;
}

function asBool(val: unknown, emptyDefault: boolean): boolean {
  if (val === true || val === 1) return true;
  if (val === false || val === 0) return false;
  if (val === "" || val == null) return emptyDefault;
  const s = String(val).trim().toUpperCase();
  if (s === "TRUE" || s === "JA" || s === "1" || s === "X") return true;
  if (s === "FALSE" || s === "NEI" || s === "0") return false;
  return emptyDefault;
}

function cellText(val: unknown): string {
  if (val == null) return "";
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    const hh = String(val.getHours()).padStart(2, "0");
    const mm = String(val.getMinutes()).padStart(2, "0");
    return hh === "00" && mm === "00" ? `${y}-${m}-${d}` : `${y}-${m}-${d} ${hh}:${mm}`;
  }
  return String(val).trim();
}

function coerce(col: string, val: unknown, spec: ArkSpec): unknown {
  const text = cellText(val);
  const booleans = spec.booleans || [];
  const falseBooleans = spec.falseBooleans || [];
  const numbers = spec.numbers || [];
  if (booleans.includes(col)) {
    const emptyDefault = falseBooleans.includes(col) ? false : true;
    return asBool(text, emptyDefault);
  }
  if (numbers.includes(col)) {
    if (text === "") return col === "Fødselsår" || col === "MaksAntall" ? null : 0;
    const n = Number(String(text).replace(",", "."));
    return Number.isNaN(n) ? (col === "MaksAntall" ? null : 0) : n;
  }
  if (col === "Dato") return tilIsoDato(text) || text;
  if (col === "Tid") {
    const iso = tilIsoTid(text, "");
    return iso || text;
  }
  return text;
}

function isBlankRecord(obj: Record<string, unknown>, spec: ArkSpec): boolean {
  const idVal = obj[spec.columns[0]];
  if (idVal !== "" && idVal !== 0 && idVal !== false && idVal != null) return false;
  if (obj.Navn && String(obj.Navn).trim()) return false;
  if (obj.PersonID && String(obj.PersonID).trim()) return false;
  if (obj.GruppeID && String(obj.GruppeID).trim()) return false;
  if (obj.RolleID && String(obj.RolleID).trim()) return false;
  if (obj.Dato && String(obj.Dato).trim()) return false;
  return true;
}

function enrich(obj: Record<string, unknown>, spec: ArkSpec): void {
  if (!spec.columns.includes("Fornavn")) return;
  if (obj.Navn && !obj.Fornavn) {
    const parts = String(obj.Navn).trim().split(/\s+/);
    obj.Fornavn = parts[0] || "";
    if (!obj.Etternavn) obj.Etternavn = parts.slice(1).join(" ");
  }
}

function parseSheet(wb: XLSX.WorkBook, spec: ArkSpec): Record<string, unknown>[] {
  const sheet = wb.Sheets[spec.name];
  if (!sheet) return [];
  const values = XLSX.utils.sheet_to_json<(string | number | Date | boolean | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  }) as unknown[][];
  if (!values.length) return [];
  const asText = values.map((row) => (row || []).map((c) => cellText(c)));
  const headerRow = findHeaderRow(asText, spec.columns[0]);
  const headers = asText[headerRow] || [];
  const rows: Record<string, unknown>[] = [];
  for (let i = headerRow + 1; i < asText.length; i++) {
    const raw = asText[i];
    if (!raw.some((c) => String(c).trim() !== "")) continue;
    const obj: Record<string, unknown> = {};
    for (const col of spec.columns) {
      const idx = headerIndex(headers, col);
      obj[col] = coerce(col, idx >= 0 ? raw[idx] : "", spec);
    }
    if (isBlankRecord(obj, spec)) continue;
    enrich(obj, spec);
    rows.push(obj);
  }
  return rows;
}

export function parseMenighetsplanWorkbook(data: ArrayBuffer): Partial<DatabaseState> {
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const state: Partial<DatabaseState> = {};
  for (const spec of MASTER_ARK) {
    (state as Record<string, unknown>)[spec.key] = parseSheet(wb, spec);
  }
  return state;
}

export async function parseMenighetsplanExcelFil(file: File): Promise<Partial<DatabaseState>> {
  const buf = await file.arrayBuffer();
  return parseMenighetsplanWorkbook(dataBuffer(buf));
}

function dataBuffer(buf: ArrayBuffer): ArrayBuffer {
  return buf;
}

export function excelImportSammendrag(state: Partial<DatabaseState>): string {
  return `${state.personer?.length ?? 0} personer, ${state.gudstjenester?.length ?? 0} gudstjenester, ${state.tildelinger?.length ?? 0} tildelinger`;
}
