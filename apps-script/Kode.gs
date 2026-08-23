/**
 * Gudstjenesteplanlegger 2.0 — Google Apps Script backend
 *
 * Leser og skriver det eksisterende regnearket. Frontend (React) skal kalle
 * denne Web App-en som JSON-API. Import-faner skrives aldri.
 *
 * Publisering: Distribuer → Ny distribusjon → Nettapp
 * Kjør som: Meg
 * Hvem har tilgang: Alle
 */

var SPREADSHEET_ID = "15RPvcvccYA3yO8-8v_H1OatSgyx8WzXGqq0N4cJI0dU";

var MASTER_SHEETS = {
  gruppetyper: {
    name: "Gruppetyper",
    columns: ["GruppetypeID", "Navn", "Beskrivelse", "Aktiv", "OpprettetDato", "SistEndret"],
    booleans: ["Aktiv"],
  },
  personer: {
    name: "Personer",
    columns: [
      "PersonID", "Navn", "Fornavn", "Etternavn", "Epost", "Telefon", "BildeURL",
      "Fødselsår", "Fødselsdato", "Kjønn", "Adresse", "Postnummer", "Poststed",
      "Notat", "SikkerhetsToken", "Aktiv", "OpprettetDato", "SistEndret",
    ],
    booleans: ["Aktiv"],
    numbers: ["Fødselsår"],
  },
  grupper: {
    name: "Grupper",
    columns: [
      "GruppeID", "Gruppenavn", "GruppetypeID", "GruppelederID", "NestlederID",
      "Beskrivelse", "Aktiv", "OpprettetDato", "SistEndret",
    ],
    booleans: ["Aktiv"],
  },
  gruppemedlemmer: {
    name: "Gruppemedlemmer",
    columns: [
      "GruppeMedlemID", "GruppeID", "PersonID", "Medlemsrolle", "Aktiv",
      "FraDato", "TilDato", "Notat", "OpprettetDato", "SistEndret",
    ],
    booleans: ["Aktiv"],
  },
  roller: {
    name: "Roller",
    columns: [
      "RolleID", "Rollenavn", "Beskrivelse", "Aktiv", "Behov", "GruppeID",
      "OpprettetDato", "SistEndret",
    ],
    booleans: ["Aktiv"],
    numbers: ["Behov"],
  },
  personroller: {
    name: "Personroller",
    columns: [
      "PersonRolleID", "PersonID", "RolleID", "Aktiv", "FraDato", "TilDato",
      "Notat", "OpprettetDato", "SistEndret",
    ],
    booleans: ["Aktiv"],
  },
  rollebeskrivelser: {
    name: "Rollebeskrivelser",
    columns: ["RolleID", "Rollebeskrivelse", "Aktiv", "OpprettetDato", "SistEndret"],
    booleans: ["Aktiv"],
  },
  gudstjenester: {
    name: "Gudstjenester",
    columns: ["GudstjenesteID", "Dato", "Tid", "Sted", "Tema", "Bibeltekst", "Kollekt", "Merknad"],
  },
  tjenestebehov: {
    name: "Tjenestebehov",
    columns: [
      "TjenestebehovID", "GudstjenesteID", "RolleID", "Antall", "Aktiv",
      "Notat", "OpprettetDato", "SistEndret",
    ],
    booleans: ["Aktiv"],
    numbers: ["Antall"],
  },
  tildelinger: {
    name: "Tildelinger",
    columns: ["TildelingID", "GudstjenesteID", "RolleID", "PersonID", "EksternNavn", "OpprettetDato", "SistEndret"],
  },
  svar: {
    name: "Svar",
    columns: ["SvarID", "TildelingID", "PersonID", "Svar", "Kommentar", "SvartDato"],
  },
  malaktiviteter: {
    name: "Malaktiviteter",
    columns: [
      "MalAktivitetID", "Rekkefolge", "Tittel", "VarighetMin", "RolleID",
      "ForStart", "Merknad", "OpprettetDato", "SistEndret",
    ],
    booleans: ["ForStart"],
    falseBooleans: ["ForStart"],
    numbers: ["Rekkefolge", "VarighetMin"],
  },
  programaktiviteter: {
    name: "Programaktiviteter",
    columns: [
      "ProgramAktivitetID", "GudstjenesteID", "Rekkefolge", "Tittel", "VarighetMin",
      "RolleID", "ForStart", "Merknad", "OpprettetDato", "SistEndret",
    ],
    booleans: ["ForStart"],
    falseBooleans: ["ForStart"],
    numbers: ["Rekkefolge", "VarighetMin"],
  },
  programinstanser: {
    name: "Programinstanser",
    columns: [
      "GudstjenesteID", "Status", "PublisertDato", "PublisertAv",
      "OpprettetDato", "SistEndret",
    ],
  },
};

/** Kolonner F–Q i Gudstjenester_import → Roller.RolleID */
var IMPORT_ROLE_COLUMNS = [
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
  { col: "Pynting", rolleId: "R012" },
];

var IMPORT_SHEETS = {
  personerImport: {
    name: "Personer_import",
    columns: [
      "PersonID", "Navn", "Epost", "Telefon",
      "Tjenesteområde1", "Tjenesteområde2", "Tjenesteområde3",
      "Tjenesteområde4", "Tjenesteområde5", "Aktiv",
    ],
    booleans: ["Aktiv"],
  },
  gudstjenesterImport: {
    name: "Gudstjenester_import",
    columns: [
      "GudstjenesteID", "Dato", "Tid", "Sted", "Tema", "Bibeltekst", "Kollekt", "Merknad",
      "Leder", "Taler", "Forbønn", "Barnekirke", "Lovsang", "Lyd", "Bilde",
      "Møtevert", "Rigging", "Kjøkken", "Baking", "Pynting",
    ],
  },
  rollebeskrivelseImport: {
    name: "Rollebeskrivelse_import",
    columns: ["RolleID", "Rollenavn", "FullBeskrivelse", "SjekklisteGammel"],
  },
};

/**
 * API-auth: load/save krever magisk token (mk_…) eller Google-ID-token.
 * migrateImport krever administrator.
 * Sett Script Properties → GOOGLE_CLIENT_ID (samme som VITE_GOOGLE_CLIENT_ID).
 */
function generateRandomMagicToken_() {
  var hex = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  return "mk_" + hex.slice(0, 24).toLowerCase();
}

function isMagicLinkToken_(token) {
  return /^mk_[0-9a-z]+$/i.test(String(token || "").trim());
}

function isLegacyHashToken_(token) {
  return /^mk_[0-9a-z]{14}$/i.test(String(token || "").trim());
}

function isUsableStoredToken_(token) {
  return isMagicLinkToken_(token) && !isLegacyHashToken_(token);
}

function normalizeEmail_(epost) {
  return String(epost || "").trim().toLowerCase();
}

function isAdministrator_(state, personId) {
  var personer = state.personer || [];
  var person = null;
  var i;
  for (i = 0; i < personer.length; i++) {
    if (personer[i].PersonID === personId) {
      person = personer[i];
      break;
    }
  }
  if (!person || person.Aktiv === false) return false;

  var roller = state.roller || [];
  var adminRolleId = "";
  for (i = 0; i < roller.length; i++) {
    if (roller[i].Aktiv !== false && String(roller[i].Rollenavn || "").trim().toLowerCase() === "administrator") {
      adminRolleId = roller[i].RolleID;
      break;
    }
  }
  if (adminRolleId) {
    var pr = state.personroller || [];
    for (i = 0; i < pr.length; i++) {
      if (pr[i].Aktiv !== false && pr[i].PersonID === personId && pr[i].RolleID === adminRolleId) {
        return true;
      }
    }
  }
  if (person.PersonID === "P009") return true;
  var navn = String(person.Navn || "").trim().toLowerCase();
  var fornavn = String(person.Fornavn || "").trim().toLowerCase();
  return fornavn === "magnar" || navn === "magnar" || navn.indexOf("magnar ") === 0;
}

function findPersonByMagicToken_(state, token) {
  var t = String(token || "").trim();
  if (!isUsableStoredToken_(t)) return null;
  var personer = state.personer || [];
  var i;
  for (i = 0; i < personer.length; i++) {
    if (String(personer[i].SikkerhetsToken || "").trim() === t) return personer[i];
  }
  return null;
}

function ensurePersonTokens_(personer) {
  if (!personer || !personer.length) return false;
  var changed = false;
  var i;
  for (i = 0; i < personer.length; i++) {
    var stored = String(personer[i].SikkerhetsToken || "").trim();
    if (isUsableStoredToken_(stored)) continue;
    personer[i].SikkerhetsToken = generateRandomMagicToken_();
    changed = true;
  }
  return changed;
}

function findAdminByEmail_(state, epost) {
  var needle = normalizeEmail_(epost);
  if (!needle) return null;
  var personer = state.personer || [];
  var i;
  for (i = 0; i < personer.length; i++) {
    var p = personer[i];
    if (p.Aktiv === false) continue;
    if (normalizeEmail_(p.Epost) === needle && isAdministrator_(state, p.PersonID)) {
      return p;
    }
  }
  return null;
}

function verifyGoogleIdToken_(idToken) {
  var clientId = PropertiesService.getScriptProperties().getProperty("GOOGLE_CLIENT_ID");
  if (!clientId) return null;
  var resp = UrlFetchApp.fetch(
    "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken),
    { muteHttpExceptions: true }
  );
  if (resp.getResponseCode() >= 400) return null;
  var info = JSON.parse(resp.getContentText() || "{}");
  if (info.error || info.aud !== clientId) return null;
  if (info.email_verified === "false" || info.email_verified === false) return null;
  return normalizeEmail_(info.email);
}

function requireAuth_(body, needAdmin) {
  var state = loadDatabase();
  var googleCred = body && body.googleCredential;
  var token = body && body.token;
  if (googleCred) {
    var email = verifyGoogleIdToken_(String(googleCred));
    if (!email) {
      return { ok: false, error: "Ugyldig Google-innlogging." };
    }
    var admin = findAdminByEmail_(state, email);
    if (!admin) {
      return { ok: false, error: "Google-kontoen er ikke registrert som administrator." };
    }
    return { ok: true, state: state, isAdmin: true };
  }
  if (token) {
    var person = findPersonByMagicToken_(state, token);
    if (!person) {
      return { ok: false, error: "Ugyldig eller ukjent lenke." };
    }
    var isAdmin = isAdministrator_(state, person.PersonID);
    if (needAdmin && !isAdmin) {
      return { ok: false, error: "Denne handlingen krever administrator." };
    }
    return { ok: true, state: state, isAdmin: isAdmin };
  }
  return { ok: false, error: "Mangler innlogging (token eller Google)." };
}

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = String(params.action || "load");

    if (action === "ui") {
      return HtmlService.createHtmlOutputFromFile("Bruker")
        .setTitle("Gudstjenesteplanlegger 2.0 — API")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    if (action === "ping") {
      return json_({ ok: true, service: "Gudstjenesteplanlegger2.0", spreadsheetId: SPREADSHEET_ID });
    }

    if (action === "inspectImport") {
      return json_({ ok: false, error: "inspectImport krever innlogget POST." });
    }

    if (action === "load") {
      return json_({ ok: false, error: "Lasting krever innlogging. Bruk POST med token eller Google." });
    }

    if (action === "migrateImport") {
      return json_({ ok: false, error: "migrateImport krever innlogget administrator (POST)." });
    }

    return json_({ ok: false, error: "Ukjent action: " + action }, 400);
  } catch (err) {
    return json_({ ok: false, error: String(err) }, 500);
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var body = parseBody_(e);
    var action = String(body.action || ((e.parameter && e.parameter.action) || "save"));

    if (action === "load") {
      var loadAuth = requireAuth_(body, false);
      if (!loadAuth.ok) return json_({ ok: false, error: loadAuth.error });
      return json_({ ok: true, data: loadAuth.state });
    }

    if (action === "save") {
      var saveAuth = requireAuth_(body, false);
      if (!saveAuth.ok) return json_({ ok: false, error: saveAuth.error });
      if (!body.data) {
        return json_({ ok: false, error: "Mangler data" }, 400);
      }
      saveDatabase(body.data);
      return json_({ ok: true, data: loadDatabase() });
    }

    if (action === "inspectImport") {
      var inspectAuth = requireAuth_(body, true);
      if (!inspectAuth.ok) return json_({ ok: false, error: inspectAuth.error });
      return json_({ ok: true, info: inspectImportSheets_() });
    }

    if (action === "migrateImport") {
      var migAuth = requireAuth_(body, true);
      if (!migAuth.ok) return json_({ ok: false, error: migAuth.error });
      var dryPost = parseDryRun_(body.dryRun != null ? body.dryRun : (e.parameter && e.parameter.dryRun), true);
      var report = migrerGudstjenesterImport(dryPost);
      return json_({ ok: true, dryRun: dryPost, report: report });
    }

    return json_({ ok: false, error: "Ukjent action: " + action }, 400);
  } catch (err) {
    return json_({ ok: false, error: String(err) }, 500);
  } finally {
    lock.releaseLock();
  }
}

function loadDatabase() {
  var ss = getSpreadsheet_();
  var state = {};
  var key;

  for (key in MASTER_SHEETS) {
    state[key] = readSheet_(ss, MASTER_SHEETS[key]);
  }
  for (key in IMPORT_SHEETS) {
    state[key] = [];
  }
  return state;
}

/** Kjør denne én gang fra Apps Script (Kjør): lager kolonne SikkerhetsToken og fyller mk_-verdier. */
function fyllSikkerhetsTokens() {
  ensureSchema_();
  var ss = getSpreadsheet_();
  var personer = readSheet_(ss, MASTER_SHEETS.personer);
  ensurePersonTokens_(personer);
  writeSheet_(ss, MASTER_SHEETS.personer, personer);
  return personer.length;
}

function saveDatabase(state) {
  ensureSchema_();
  var ss = getSpreadsheet_();
  if (state.personer) {
    mergePersonTokens_(state.personer, readSheet_(ss, MASTER_SHEETS.personer));
    ensurePersonTokens_(state.personer);
  }
  var key;
  for (key in MASTER_SHEETS) {
    if (state[key]) {
      writeSheet_(ss, MASTER_SHEETS[key], state[key]);
    }
  }
  // Import-faner skrives aldri.
}

function mergePersonTokens_(incoming, existing) {
  var byId = {};
  var i;
  for (i = 0; i < (existing || []).length; i++) {
    byId[existing[i].PersonID] = existing[i].SikkerhetsToken;
  }
  for (i = 0; i < (incoming || []).length; i++) {
    if (isUsableStoredToken_(incoming[i].SikkerhetsToken)) continue;
    var prev = byId[incoming[i].PersonID];
    if (isUsableStoredToken_(prev)) incoming[i].SikkerhetsToken = prev;
  }
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function ensureSchema_() {
  var ss = getSpreadsheet_();
  var key;
  for (key in MASTER_SHEETS) {
    ensureSheet_(ss, MASTER_SHEETS[key]);
  }
  for (key in IMPORT_SHEETS) {
    ensureSheet_(ss, IMPORT_SHEETS[key]);
  }
}

function ensureSheet_(ss, spec) {
  var sheet = ss.getSheetByName(spec.name);
  if (!sheet) {
    sheet = ss.insertSheet(spec.name);
    sheet.getRange(1, 1, 1, spec.columns.length).setValues([spec.columns]);
    sheet.setFrozenRows(1);
    return;
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, spec.columns.length).setValues([spec.columns]);
    sheet.setFrozenRows(1);
    return;
  }
  var lastCol = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var i;
  for (i = 0; i < spec.columns.length; i++) {
    if (headers.indexOf(spec.columns[i]) < 0) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(spec.columns[i]);
    }
  }
  sheet.setFrozenRows(1);
}

function readSheet_(ss, spec) {
  var sheet = ss.getSheetByName(spec.name);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return [];

  var values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  if (!values.length) return [];

  var headerRow = 0;
  if (spec.name === "Gudstjenester_import") {
    headerRow = findHeaderRow_(values, "GudstjenesteID");
  }

  var headers = values[headerRow].map(function (h) { return String(h).trim(); });
  var rows = [];
  var i;
  var j;

  for (i = headerRow + 1; i < values.length; i++) {
    var raw = values[i];
    var empty = true;
    for (j = 0; j < raw.length; j++) {
      if (String(raw[j]).trim() !== "") {
        empty = false;
        break;
      }
    }
    if (empty) continue;

    var obj = {};
    for (j = 0; j < spec.columns.length; j++) {
      var col = spec.columns[j];
      var idx = headers.indexOf(col);
      var val = idx >= 0 ? raw[idx] : "";
      obj[col] = coerce_(col, val, spec);
    }

    if (isBlankRecord_(obj, spec)) continue;
    enrichRecord_(obj, spec);
    rows.push(obj);
  }
  return rows;
}

function findHeaderRow_(values, requiredHeader) {
  var want = String(requiredHeader).trim().toLowerCase();
  var i;
  var j;
  for (i = 0; i < values.length; i++) {
    for (j = 0; j < values[i].length; j++) {
      if (String(values[i][j]).trim().toLowerCase() === want) return i;
    }
  }
  return 0;
}

function isBlankRecord_(obj, spec) {
  var idCol = spec.columns[0];
  var idVal = obj[idCol];
  if (idVal !== "" && idVal !== 0 && idVal !== false && idVal != null) return false;
  if (obj.Navn && String(obj.Navn).trim()) return false;
  if (obj.PersonID && String(obj.PersonID).trim()) return false;
  if (obj.GruppeID && String(obj.GruppeID).trim()) return false;
  if (obj.RolleID && String(obj.RolleID).trim()) return false;
  if (obj.Dato && String(obj.Dato).trim()) return false;
  return true;
}

function enrichRecord_(obj, spec) {
  if (spec.columns.indexOf("Fornavn") < 0) return;
  if (obj.Navn && !obj.Fornavn) {
    var parts = String(obj.Navn).trim().split(/\s+/);
    obj.Fornavn = parts[0] || "";
    if (!obj.Etternavn) obj.Etternavn = parts.slice(1).join(" ");
  }
}

function writeSheet_(ss, spec, records) {
  var sheet = ss.getSheetByName(spec.name);
  if (!sheet) {
    sheet = ss.insertSheet(spec.name);
  }

  var existingRows = Math.max(sheet.getMaxRows(), 1);
  var existingCols = Math.max(sheet.getMaxColumns(), spec.columns.length);
  sheet.clearContents();
  if (existingCols < spec.columns.length) {
    sheet.insertColumnsAfter(existingCols, spec.columns.length - existingCols);
  }

  var output = [spec.columns];
  var i;
  var j;
  for (i = 0; i < records.length; i++) {
    var rec = records[i] || {};
    var row = [];
    for (j = 0; j < spec.columns.length; j++) {
      row.push(serialize_(spec.columns[j], rec[spec.columns[j]], spec));
    }
    output.push(row);
  }

  sheet.getRange(1, 1, output.length, spec.columns.length).setValues(output);
  sheet.setFrozenRows(1);
}

function coerce_(col, val, spec) {
  if (val === null || val === undefined) return "";
  var text = String(val).trim();
  var booleans = spec.booleans || [];
  var falseBooleans = spec.falseBooleans || [];
  var numbers = spec.numbers || [];

  if (booleans.indexOf(col) >= 0) {
    // Tom Aktiv-celle i arket betyr «ikke satt» — da er raden aktiv.
    // ForStart og liknende flagg skal være false når cellen er tom.
    var emptyDefault = falseBooleans.indexOf(col) >= 0 ? false : true;
    return asBool_(text, emptyDefault);
  }
  if (numbers.indexOf(col) >= 0) {
    if (text === "") return col === "Fødselsår" ? "" : 0;
    var n = Number(String(text).replace(",", "."));
    return isNaN(n) ? 0 : n;
  }
  return text;
}

function serialize_(col, val, spec) {
  var booleans = spec.booleans || [];
  if (booleans.indexOf(col) >= 0) {
    return asBool_(val) ? "TRUE" : "FALSE";
  }
  if (val === null || val === undefined) return "";
  return val;
}

function asBool_(val, defaultIfEmpty) {
  if (val === true || val === 1) return true;
  if (val === false || val === 0) return false;
  if (val === "" || val === null || val === undefined) {
    return defaultIfEmpty === undefined ? false : defaultIfEmpty;
  }
  var s = String(val).trim().toUpperCase();
  if (s === "TRUE" || s === "JA" || s === "1" || s === "X") return true;
  if (s === "FALSE" || s === "NEI" || s === "0") return false;
  return defaultIfEmpty === undefined ? false : defaultIfEmpty;
}

function parseBody_(e) {
  if (!e) return {};
  if (e.postData && e.postData.contents) {
    var raw = e.postData.contents;
    try {
      return JSON.parse(raw);
    } catch (err) {
      return { raw: raw };
    }
  }
  return (e.parameter) ? e.parameter : {};
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function inspectImportSheets_() {
  var ss = getSpreadsheet_();
  var sheets = ss.getSheets().map(function (s) {
    return {
      name: s.getName(),
      lastRow: s.getLastRow(),
      lastCol: s.getLastColumn(),
    };
  });
  var name = IMPORT_SHEETS.gudstjenesterImport.name;
  var sheet = ss.getSheetByName(name);
  var headers = [];
  var sample = [];
  if (sheet && sheet.getLastRow() >= 1 && sheet.getLastColumn() >= 1) {
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    var rows = Math.min(3, Math.max(0, sheet.getLastRow() - 1));
    if (rows > 0) {
      sample = sheet.getRange(2, 1, rows, sheet.getLastColumn()).getDisplayValues();
    }
  }
  return {
    sheets: sheets,
    importName: name,
    found: !!sheet,
    headers: headers,
    sample: sample,
  };
}

function parseDryRun_(val, defaultValue) {
  if (val === undefined || val === null || val === "") return defaultValue;
  if (val === true || val === false) return val;
  var s = String(val).trim().toLowerCase();
  if (s === "false" || s === "0" || s === "nei" || s === "no") return false;
  if (s === "true" || s === "1" || s === "ja" || s === "yes") return true;
  return defaultValue;
}

function runMigrateImportLocked_(dryRun) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    var report = migrerGudstjenesterImport(dryRun);
    return { ok: true, dryRun: !!dryRun, report: report };
  } catch (err) {
    return { ok: false, dryRun: !!dryRun, error: String(err) };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Les Gudstjenester_import (B–E + Leder–Pynting) og fyll mastertabeller.
 * Importfanen skrives aldri. Idempotent for tildelinger og Tjenestebehov.
 * @param {boolean} dryRun hvis true, skriv ingenting
 */
function migrerGudstjenesterImport(dryRun) {
  ensureSchema_();
  var ss = getSpreadsheet_();
  var importRows = readSheet_(ss, IMPORT_SHEETS.gudstjenesterImport);
  var personer = readSheet_(ss, MASTER_SHEETS.personer);
  var roller = readSheet_(ss, MASTER_SHEETS.roller);
  var gudstjenester = readSheet_(ss, MASTER_SHEETS.gudstjenester);
  var tildelinger = readSheet_(ss, MASTER_SHEETS.tildelinger);
  var svar = readSheet_(ss, MASTER_SHEETS.svar);
  var tjenestebehov = readSheet_(ss, MASTER_SHEETS.tjenestebehov);
  var personroller = readSheet_(ss, MASTER_SHEETS.personroller);

  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Europe/Oslo", "yyyy-MM-dd");
  var nameIndex = buildPersonNameIndex_(personer);

  var report = {
    importRader: importRows.length,
    gudstjenesterNye: 0,
    gudstjenesterOppdatert: 0,
    tildelingerNye: 0,
    tildelingerHoppetOver: 0,
    svarNye: 0,
    tjenestebehovNye: 0,
    personrollerNye: 0,
    umatchedeNavn: [],
    tvetydigeNavn: [],
    tommeCeller: 0,
  };

  var gudById = indexBy_(gudstjenester, "GudstjenesteID");
  var tildelingKeys = {};
  var i;
  for (i = 0; i < tildelinger.length; i++) {
    tildelingKeys[tildelingKey_(tildelinger[i])] = true;
  }
  var svarByTildeling = {};
  for (i = 0; i < svar.length; i++) {
    svarByTildeling[String(svar[i].TildelingID)] = true;
  }
  var behovKeys = {};
  for (i = 0; i < tjenestebehov.length; i++) {
    behovKeys[String(tjenestebehov[i].GudstjenesteID) + "|" + String(tjenestebehov[i].RolleID)] = true;
  }
  var personrolleKeys = {};
  for (i = 0; i < personroller.length; i++) {
    personrolleKeys[String(personroller[i].PersonID) + "|" + String(personroller[i].RolleID)] = true;
  }

  var unmatchedSeen = {};
  var ambiguousSeen = {};

  for (i = 0; i < importRows.length; i++) {
    var row = importRows[i];
    var gudId = String(row.GudstjenesteID || "").trim();
    if (!gudId) {
      gudId = nextId_(gudstjenester, "GudstjenesteID", "GUD");
    }
    var dato = normalizeDate_(row.Dato);
    var tid = normalizeTime_(row.Tid);
    var tema = String(row.Tema || "").trim();
    var sted = String(row.Sted || "").trim();
    var bibel = String(row.Bibeltekst || "").trim();
    var kollekt = String(row.Kollekt || "").trim();
    var merknad = String(row.Merknad || "").trim();

    var existingGud = gudById[gudId];
    if (!existingGud) {
      var nyGud = {
        GudstjenesteID: gudId,
        Dato: dato,
        Tid: tid,
        Sted: sted,
        Tema: tema,
        Bibeltekst: bibel,
        Kollekt: kollekt,
        Merknad: merknad,
      };
      gudstjenester.push(nyGud);
      gudById[gudId] = nyGud;
      report.gudstjenesterNye++;
    } else {
      var changed = false;
      if (dato && existingGud.Dato !== dato) {
        existingGud.Dato = dato;
        changed = true;
      }
      if (tid && existingGud.Tid !== tid) {
        existingGud.Tid = tid;
        changed = true;
      }
      if (tema && existingGud.Tema !== tema) {
        existingGud.Tema = tema;
        changed = true;
      }
      if (sted && existingGud.Sted !== sted) {
        existingGud.Sted = sted;
        changed = true;
      }
      if (bibel && existingGud.Bibeltekst !== bibel) {
        existingGud.Bibeltekst = bibel;
        changed = true;
      }
      if (kollekt && existingGud.Kollekt !== kollekt) {
        existingGud.Kollekt = kollekt;
        changed = true;
      }
      if (merknad && existingGud.Merknad !== merknad) {
        existingGud.Merknad = merknad;
        changed = true;
      }
      if (changed) report.gudstjenesterOppdatert++;
    }

    var r;
    for (r = 0; r < IMPORT_ROLE_COLUMNS.length; r++) {
      var mapping = IMPORT_ROLE_COLUMNS[r];
      var names = splitNames_(row[mapping.col]);
      if (!names.length) {
        report.tommeCeller++;
        continue;
      }
      var n;
      for (n = 0; n < names.length; n++) {
        var rawName = names[n];
        var match = matchPerson_(rawName, nameIndex);
        if (match.status === "unmatched") {
          if (!unmatchedSeen[rawName]) {
            unmatchedSeen[rawName] = true;
            report.umatchedeNavn.push({ navn: rawName, gudstjenesteId: gudId, rolle: mapping.col });
          }
          continue;
        }
        if (match.status === "ambiguous") {
          if (!ambiguousSeen[rawName]) {
            ambiguousSeen[rawName] = true;
            report.tvetydigeNavn.push({ navn: rawName, gudstjenesteId: gudId, rolle: mapping.col });
          }
          continue;
        }

        var personId = match.person.PersonID;
        var key = gudId + "|" + mapping.rolleId + "|" + personId;
        if (tildelingKeys[key]) {
          report.tildelingerHoppetOver++;
          continue;
        }

        var tildelingId = nextId_(tildelinger, "TildelingID", "T");
        var nyTildeling = {
          TildelingID: tildelingId,
          GudstjenesteID: gudId,
          RolleID: mapping.rolleId,
          PersonID: personId,
          OpprettetDato: today,
          SistEndret: today,
        };
        tildelinger.push(nyTildeling);
        tildelingKeys[key] = true;
        report.tildelingerNye++;

        if (!svarByTildeling[tildelingId]) {
          svar.push({
            SvarID: nextId_(svar, "SvarID", "S"),
            TildelingID: tildelingId,
            PersonID: personId,
            Svar: "Venter",
            Kommentar: "",
            SvartDato: "",
          });
          svarByTildeling[tildelingId] = true;
          report.svarNye++;
        }

        var prKey = personId + "|" + mapping.rolleId;
        if (!personrolleKeys[prKey]) {
          personroller.push({
            PersonRolleID: nextId_(personroller, "PersonRolleID", "PR"),
            PersonID: personId,
            RolleID: mapping.rolleId,
            Aktiv: true,
            FraDato: today,
            TilDato: "",
            Notat: "Opprettet fra Gudstjenester_import",
            OpprettetDato: today,
            SistEndret: today,
          });
          personrolleKeys[prKey] = true;
          report.personrollerNye++;
        }
      }
    }
  }

  var g;
  var rolle;
  for (g = 0; g < gudstjenester.length; g++) {
    var gid = String(gudstjenester[g].GudstjenesteID || "").trim();
    if (!gid) continue;
    for (rolle = 0; rolle < roller.length; rolle++) {
      var rolleRec = roller[rolle];
      if (rolleRec.Aktiv === false) continue;
      var rid = String(rolleRec.RolleID || "").trim();
      if (!rid) continue;
      var bKey = gid + "|" + rid;
      if (behovKeys[bKey]) continue;
      var antall = Number(rolleRec.Behov);
      if (isNaN(antall) || antall < 1) antall = 1;
      tjenestebehov.push({
        TjenestebehovID: nextId_(tjenestebehov, "TjenestebehovID", "TB"),
        GudstjenesteID: gid,
        RolleID: rid,
        Antall: antall,
        Aktiv: true,
        Notat: "",
        OpprettetDato: today,
        SistEndret: today,
      });
      behovKeys[bKey] = true;
      report.tjenestebehovNye++;
    }
  }

  if (!dryRun) {
    writeSheet_(ss, MASTER_SHEETS.gudstjenester, gudstjenester);
    writeSheet_(ss, MASTER_SHEETS.tildelinger, tildelinger);
    writeSheet_(ss, MASTER_SHEETS.svar, svar);
    writeSheet_(ss, MASTER_SHEETS.tjenestebehov, tjenestebehov);
    writeSheet_(ss, MASTER_SHEETS.personroller, personroller);
  }

  report.skrevet = !dryRun;
  return report;
}

function buildPersonNameIndex_(personer) {
  var byNavn = {};
  var byFornavn = {};
  var i;
  for (i = 0; i < personer.length; i++) {
    var p = personer[i];
    var navn = normalizeName_(p.Navn);
    if (navn) {
      if (!byNavn[navn]) byNavn[navn] = [];
      byNavn[navn].push(p);
    }
    var fn = normalizeName_(p.Fornavn);
    if (!fn && p.Navn) fn = normalizeName_(String(p.Navn).trim().split(/\s+/)[0]);
    if (fn) {
      if (!byFornavn[fn]) byFornavn[fn] = [];
      byFornavn[fn].push(p);
    }
  }
  return { byNavn: byNavn, byFornavn: byFornavn };
}

function matchPerson_(rawName, index) {
  var key = normalizeName_(rawName);
  if (!key) return { status: "unmatched" };
  var navnHits = index.byNavn[key] || [];
  if (navnHits.length === 1) return { status: "ok", person: navnHits[0] };
  if (navnHits.length > 1) return { status: "ambiguous" };
  var fnHits = index.byFornavn[key] || [];
  if (fnHits.length === 1) return { status: "ok", person: fnHits[0] };
  if (fnHits.length > 1) return { status: "ambiguous" };
  return { status: "unmatched" };
}

function splitNames_(val) {
  var text = String(val == null ? "" : val).trim();
  if (!text) return [];
  var parts = text.split(/[,;]+/);
  var out = [];
  var i;
  for (i = 0; i < parts.length; i++) {
    var n = String(parts[i]).trim();
    if (n) out.push(n);
  }
  return out;
}

function normalizeName_(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeDate_(s) {
  var t = String(s || "").trim();
  if (!t) return "";
  var iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3];
  var nordic = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (nordic) {
    var year = parseInt(nordic[3], 10);
    if (year < 100) year += 2000;
    return String(year) + "-" + pad2_(nordic[2]) + "-" + pad2_(nordic[1]);
  }
  return t;
}

function normalizeTime_(s) {
  var t = String(s || "").trim();
  if (!t) return "";
  var m = t.match(/^(\d{1,2})[:.](\d{2})/);
  if (m) return pad2_(m[1]) + ":" + m[2];
  return t;
}

function pad2_(n) {
  var s = String(n);
  return s.length < 2 ? "0" + s : s;
}

function nextId_(records, field, prefix) {
  var max = 0;
  var i;
  for (i = 0; i < records.length; i++) {
    var m = String(records[i][field] || "").match(/(\d+)\s*$/);
    if (m) {
      var n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  var num = String(max + 1);
  while (num.length < 3) num = "0" + num;
  return prefix + num;
}

function indexBy_(records, field) {
  var map = {};
  var i;
  for (i = 0; i < records.length; i++) {
    var id = String(records[i][field] || "").trim();
    if (id) map[id] = records[i];
  }
  return map;
}

function tildelingKey_(t) {
  return String(t.GudstjenesteID) + "|" + String(t.RolleID) + "|" + String(t.PersonID);
}

/** Test fra editor: Kjør loadDatabase */
function testLoad() {
  var data = loadDatabase();
  Logger.log("Personer: " + data.personer.length);
  Logger.log("Gudstjenester: " + data.gudstjenester.length);
  Logger.log("Tildelinger: " + data.tildelinger.length);
  return data;
}

/** Test fra editor: dry-run av importmigrering */
function testMigrateDryRun() {
  var report = migrerGudstjenesterImport(true);
  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
