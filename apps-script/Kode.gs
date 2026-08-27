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
var SPREADSHEET_NAVN = "Menighetsplan";

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
      "Notat", "SikkerhetsToken", "Tilgangsnivå", "Aktiv", "OpprettetDato", "SistEndret",
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
      "RolleID", "Rollenavn", "Beskrivelse", "Aktiv", "Behov", "MaksAntall", "GruppeID",
      "OpprettetDato", "SistEndret",
    ],
    booleans: ["Aktiv"],
    numbers: ["Behov", "MaksAntall"],
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
    columns: ["GudstjenesteID", "Dato", "Tid", "Sted", "Tema", "Bibeltekst", "Kollekt", "Kunngjøringer", "Merknad", "EksternKalenderID"],
  },
  arrangementer: {
    name: "Arrangementer",
    columns: [
      "ArrangementID", "Dato", "Tid", "Sted", "Tittel", "Beskrivelse", "GruppeID",
      "OpprettetAv", "EksternKalenderID", "MalID", "Aktiv", "OpprettetDato", "SistEndret",
    ],
    booleans: ["Aktiv"],
  },
  kalenderoppgaver: {
    name: "Kalenderoppgaver",
    columns: [
      "KalenderoppgaveID", "EksternUID", "Dato", "Tid", "Sted", "Tittel", "Beskrivelse",
      "Status", "ArrangementID", "OpprettetDato", "SistEndret",
    ],
  },
  tjenestebehov: {
    name: "Tjenestebehov",
    columns: [
      "TjenestebehovID", "GudstjenesteID", "ArrangementID", "RolleID", "Antall", "Aktiv",
      "Notat", "OpprettetDato", "SistEndret",
    ],
    booleans: ["Aktiv"],
    numbers: ["Antall"],
  },
  tildelinger: {
    name: "Tildelinger",
    columns: ["TildelingID", "GudstjenesteID", "ArrangementID", "RolleID", "PersonID", "EksternNavn", "OpprettetDato", "SistEndret"],
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
  maler: {
    name: "Maler",
    columns: ["MalID", "Navn", "Aktiv", "OpprettetDato", "SistEndret"],
    booleans: ["Aktiv"],
  },
  malposter: {
    name: "Malposter",
    columns: [
      "MalPostID", "MalID", "Rekkefolge", "Tittel", "VarighetMin", "RolleID",
      "ForStart", "Merknad", "OpprettetDato", "SistEndret",
    ],
    booleans: ["ForStart"],
    falseBooleans: ["ForStart"],
    numbers: ["Rekkefolge", "VarighetMin"],
  },
  malTilleggsvakter: {
    name: "MalTilleggsvakter",
    columns: [
      "MalTilleggsvaktID", "MalID", "RolleID", "Antall", "Aktiv",
      "OpprettetDato", "SistEndret",
    ],
    booleans: ["Aktiv"],
    numbers: ["Antall"],
  },
  programaktiviteter: {
    name: "Programaktiviteter",
    columns: [
      "ProgramAktivitetID", "GudstjenesteID", "ArrangementID", "Rekkefolge", "Tittel", "VarighetMin",
      "RolleID", "ForStart", "Merknad", "OpprettetDato", "SistEndret",
    ],
    booleans: ["ForStart"],
    falseBooleans: ["ForStart"],
    numbers: ["Rekkefolge", "VarighetMin"],
  },
  programinstanser: {
    name: "Programinstanser",
    columns: [
      "GudstjenesteID", "ArrangementID", "Status", "PublisertDato", "PublisertAv",
      "OpprettetDato", "SistEndret",
    ],
  },
  innstillinger: {
    name: "Innstillinger",
    columns: ["Nøkkel", "Verdi"],
    // Rader: visKalenderMinSide, visKalenderGruppeleder, visKalenderIcal, eksternIcalUrl
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
  var e = String(epost || "").trim().toLowerCase();
  if (e.indexOf("mailto:") === 0) e = e.slice(7);
  return e.trim();
}

function normalizeEmailForMatch_(epost) {
  var e = normalizeEmail_(epost);
  if (!e) return "";
  var at = e.lastIndexOf("@");
  if (at < 1) return e;
  var local = e.substring(0, at);
  var domain = e.substring(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") {
    local = local.split("+")[0].replace(/\./g, "");
  }
  return local + "@" + domain;
}

function emailsEquivalent_(a, b) {
  var na = normalizeEmailForMatch_(a);
  var nb = normalizeEmailForMatch_(b);
  return Boolean(na && nb && na === nb);
}

function normalizeTilgangsnivaa_(verdi) {
  var v = String(verdi || "").trim().toLowerCase();
  if (v === "admin" || v === "administrator") return "admin";
  if (v === "gruppeleder") return "gruppeleder";
  if (v === "bruker" || v === "medlem") return "bruker";
  return "";
}

function looksLikeLegacyAdminName_(person) {
  var navn = String(person.Navn || "").trim().toLowerCase();
  var fornavn = String(person.Fornavn || "").trim().toLowerCase();
  return fornavn === "magnar" || navn === "magnar" || navn.indexOf("magnar ") === 0;
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
  if (normalizeTilgangsnivaa_(person.Tilgangsnivå) === "admin") return true;
  if (emailsEquivalent_(person.Epost, "magnar.totland@gmail.com")) return true;
  return looksLikeLegacyAdminName_(person);
}

function findPersonByMagicToken_(state, token) {
  var t = String(token || "").trim();
  if (!isMagicLinkToken_(t)) return null;
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
  if (emailsEquivalent_(needle, MAGNAR_GOOGLE_EPOST)) {
    var magnar = sikreMagnarGoogleKonto_(state);
    if (magnar) return magnar;
  }
  var personer = state.personer || [];
  var i;
  for (i = 0; i < personer.length; i++) {
    var p = personer[i];
    if (p.Aktiv === false) continue;
    if (emailsEquivalent_(p.Epost, needle) && isAdministrator_(state, p.PersonID)) {
      return p;
    }
  }
  return bindGoogleEmailToLegacyAdmin_(state, needle);
}

var MAGNAR_GOOGLE_EPOST = "magnar.totland@gmail.com";

function nesteNummerertId_(prefix, eksisterende) {
  var max = 0;
  var i;
  for (i = 0; i < eksisterende.length; i++) {
    var n = parseInt(String(eksisterende[i] || "").replace(/\D/g, ""), 10);
    if (n > max) max = n;
  }
  return prefix + ("000" + (max + 1)).slice(-3);
}

function finnMagnarPerson_(personer) {
  var i;
  for (i = 0; i < (personer || []).length; i++) {
    var p = personer[i];
    if (!p || p.Aktiv === false) continue;
    if (looksLikeLegacyAdminName_(p)) return p;
  }
  return null;
}

/** Magnar uten e-post: skriv inn Google-eposten slik innlogging treffer. Aldri P001 med annet navn. */
function bindGoogleEmailToLegacyAdmin_(state, email) {
  if (!emailsEquivalent_(email, MAGNAR_GOOGLE_EPOST)) return null;
  sikreMagnarGoogleKonto_(state);
  var p = finnMagnarPerson_(state.personer);
  return p || null;
}

/**
 * Sikrer at Magnar finnes i Personer med magnar.totland@gmail.com og Tilgangsnivå admin.
 * Skriver bare enkeltceller / nye rader — tømmer ikke fanen.
 */
function sikreMagnarGoogleKonto_(state) {
  var ss = getSpreadsheet_();
  var personer = state.personer || [];
  var p = finnMagnarPerson_(personer);
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Europe/Oslo", "yyyy-MM-dd");
  if (!p) {
    var ids = [];
    var i;
    for (i = 0; i < personer.length; i++) ids.push(personer[i].PersonID);
    p = {
      PersonID: nesteNummerertId_("P", ids),
      Navn: "Magnar Totland",
      Fornavn: "Magnar",
      Etternavn: "Totland",
      Epost: MAGNAR_GOOGLE_EPOST,
      Telefon: "",
      Notat: "",
      Tilgangsnivå: "admin",
      Aktiv: true,
      OpprettetDato: today,
      SistEndret: today,
      SikkerhetsToken: generateRandomMagicToken_(),
    };
    personer.push(p);
    state.personer = personer;
    appendSheetRecord_(ss, MASTER_SHEETS.personer, p);
  } else {
    p.Epost = MAGNAR_GOOGLE_EPOST;
    p.Tilgangsnivå = "admin";
    setPersonColumnCell_(p.PersonID, "Epost", MAGNAR_GOOGLE_EPOST);
    setPersonColumnCell_(p.PersonID, "Tilgangsnivå", "admin");
  }
  return p;
}

/** Kjør fra Apps Script (Kjør) eller clasp run: legger inn Magnar-epost i arket. */
function sikreMagnarGoogleKonto() {
  var state = loadDatabase();
  var p = sikreMagnarGoogleKonto_(state);
  return p ? p.PersonID + " " + p.Navn + " " + p.Epost : "ingen";
}

function appendSheetRecord_(ss, spec, rec) {
  var sheet = ss.getSheetByName(spec.name);
  if (!sheet) {
    sheet = ss.insertSheet(spec.name);
    sheet.getRange(1, 1, 1, spec.columns.length).setValues([spec.columns]);
    sheet.setFrozenRows(1);
  }
  var lastCol = Math.max(sheet.getLastColumn(), spec.columns.length);
  var lastRow = sheet.getLastRow();
  var headers = spec.columns;
  if (lastRow >= 1) {
    var headerValues = sheet.getRange(1, 1, Math.max(lastRow, 1), lastCol).getDisplayValues();
    var headerRow = findHeaderRow_(headerValues, spec.columns[0]);
    headers = headerValues[headerRow] || spec.columns;
    if (!headers.length) headers = spec.columns;
  }
  var row = [];
  var j;
  for (j = 0; j < headers.length; j++) {
    var col = String(headers[j] || "").trim();
    if (!col) {
      row.push("");
      continue;
    }
    row.push(serialize_(col, rec[col], spec));
  }
  sheet.appendRow(row);
}

/** Legger til manglende overskrift i Personer og returnerer 0-basert kolonneindeks. */
function ensurePersonHeaderColumn_(sheet, headerRow, headers, columnName) {
  var colIdx = headerIndex_(headers, columnName);
  if (colIdx >= 0) return colIdx;
  var newCol = sheet.getLastColumn() + 1;
  sheet.getRange(headerRow + 1, newCol).setValue(columnName);
  headers[newCol - 1] = columnName;
  return newCol - 1;
}

function setPersonColumnCell_(personId, columnName, value) {
  var ss = getSpreadsheet_();
  var spec = MASTER_SHEETS.personer;
  var sheet = ss.getSheetByName(spec.name);
  if (!sheet) return false;
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return false;
  var values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  var headerRow = findHeaderRow_(values, spec.columns[0]);
  var headers = values[headerRow] || [];
  var idIdx = headerIndex_(headers, "PersonID");
  if (idIdx < 0) return false;
  var colIdx = ensurePersonHeaderColumn_(sheet, headerRow, headers, columnName);
  var i;
  for (i = headerRow + 1; i < values.length; i++) {
    if (String(values[i][idIdx] || "").trim() === String(personId || "").trim()) {
      sheet.getRange(i + 1, colIdx + 1).setValue(value);
      return true;
    }
  }
  return false;
}

function setPersonEmailCell_(personId, email) {
  return setPersonColumnCell_(personId, "Epost", email);
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
    return { ok: true, state: state, isAdmin: true, personId: admin.PersonID };
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
    return { ok: true, state: state, isAdmin: isAdmin, personId: person.PersonID };
  }
  return { ok: false, error: "Mangler innlogging (token eller Google)." };
}

function erEksternIcalAction_(action) {
  var n = String(action || "").toLowerCase();
  return n === "eksternical" || n === "eksternicaljson" || n === "eksternlcal" || n === "eksternlcaljson";
}

function erEksternIcalJsonAction_(action) {
  return String(action || "").toLowerCase().indexOf("json") !== -1;
}

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = String(params.action || "load");

    if (action === "ui") {
      return HtmlService.createHtmlOutputFromFile("Bruker")
        .setTitle("Menighetsplan — API")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    if (action === "ping") {
      return json_({
        ok: true,
        service: "Menighetsplan",
        ical: true,
        icalActions: ["eksternIcal", "eksternIcalJson"],
      });
    }

    if (erEksternIcalAction_(action)) {
      if (erEksternIcalJsonAction_(action)) {
        return json_({ ok: true, ics: hentKorrigertEksternIcal_(params.icalUrl) });
      }
      return ContentService.createTextOutput(hentKorrigertEksternIcal_(params.icalUrl))
        .setMimeType(ContentService.MimeType.TEXT);
    }

    if (action === "minIcal") {
      return minIcalSvar_(params.t);
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
  var body = parseBody_(e);
  var action = String(body.action || ((e.parameter && e.parameter.action) || "save"));

  // Samme kontrakt som load/save: prod (AI Studio) poster, den poster ikke GET.
  if (erEksternIcalAction_(action)) {
    try {
      return json_({ ok: true, ics: hentKorrigertEksternIcal_(body.icalUrl) });
    } catch (icalErr) {
      return json_({ ok: false, error: String(icalErr) }, 500);
    }
  }

  var skrivende = action === "save" || action === "migrateImport" || action === "exportImportBackup";
  var lock = LockService.getScriptLock();
  var harLas = false;
  try {
    if (skrivende) {
      lock.waitLock(30000);
      harLas = true;
    }

    if (action === "load") {
      var loadAuth = requireAuth_(body, false);
      if (!loadAuth.ok) return json_({ ok: false, error: loadAuth.error });
      return json_({
        ok: true,
        data: sanitizeStateForViewer_(loadAuth.state, loadAuth.personId, loadAuth.isAdmin),
        personId: loadAuth.personId,
        isAdmin: loadAuth.isAdmin,
      });
    }

    if (action === "save") {
      var saveAuth = requireAuth_(body, false);
      if (!saveAuth.ok) return json_({ ok: false, error: saveAuth.error });
      if (!body.data) {
        return json_({ ok: false, error: "Mangler data" }, 400);
      }
      saveDatabase(body.data, saveAuth.isAdmin);
      if (harLas) {
        lock.releaseLock();
        harLas = false;
      }
      var saved = loadDatabase();
      return json_({
        ok: true,
        data: sanitizeStateForViewer_(saved, saveAuth.personId, saveAuth.isAdmin),
        personId: saveAuth.personId,
        isAdmin: saveAuth.isAdmin,
      });
    }

    if (action === "inspectImport") {
      var inspectAuth = requireAuth_(body, true);
      if (!inspectAuth.ok) return json_({ ok: false, error: inspectAuth.error });
      return json_({ ok: true, info: inspectImportSheets_() });
    }

    if (action === "migrateImport") {
      var migAuth = requireAuth_(body, true);
      if (!migAuth.ok) return json_({ ok: false, error: migAuth.error });
      var overwrite = body.overwrite === true || body.overwrite === "true";
      var dryDefault = overwrite ? false : true;
      var dryPost = parseDryRun_(body.dryRun != null ? body.dryRun : (e.parameter && e.parameter.dryRun), dryDefault);
      var report = migrerGudstjenesterImport(dryPost, overwrite);
      return json_({ ok: true, dryRun: dryPost, overwrite: overwrite, report: report });
    }

    if (action === "exportImportBackup") {
      var expAuth = requireAuth_(body, true);
      if (!expAuth.ok) return json_({ ok: false, error: expAuth.error });
      if (!body.data) {
        return json_({ ok: false, error: "Mangler data" }, 400);
      }
      var expReport = skrivImportBackup_(body.data);
      return json_({ ok: true, report: expReport });
    }

    return json_({ ok: false, error: "Ukjent action: " + action }, 400);
  } catch (err) {
    return json_({ ok: false, error: String(err) }, 500);
  } finally {
    if (harLas) lock.releaseLock();
  }
}

var NON_ADMIN_WRITABLE_SHEETS = {
  grupper: true,
  gruppemedlemmer: true,
  gudstjenester: true,
  arrangementer: true,
  kalenderoppgaver: true,
  tjenestebehov: true,
  tildelinger: true,
  svar: true,
  programaktiviteter: true,
  programinstanser: true,
};

function sanitizeStateForViewer_(state, personId, isAdmin) {
  if (isAdmin) return state;
  var personer = state.personer || [];
  var i;
  var renset = [];
  for (i = 0; i < personer.length; i++) {
    var p = personer[i];
    var kopi = {};
    var k;
    for (k in p) {
      if (Object.prototype.hasOwnProperty.call(p, k)) kopi[k] = p[k];
    }
    var erMeg = personId && kopi.PersonID === personId;
    if (!erMeg) {
      kopi.SikkerhetsToken = "";
      kopi.Epost = "";
      kopi.Telefon = "";
      kopi.Adresse = "";
      kopi.Postnummer = "";
      kopi.Poststed = "";
      kopi.Fødselsår = "";
      kopi.Fødselsdato = "";
      kopi.Kjønn = "";
      kopi.Notat = "";
    }
    renset.push(kopi);
  }
  state.personer = renset;
  var synlige = {};
  var arr = state.arrangementer || [];
  var a;
  var nesteArr = [];
  for (a = 0; a < arr.length; a++) {
    if (!arrangementMedIIcal_(state, personId, arr[a])) continue;
    nesteArr.push(arr[a]);
    synlige[arr[a].ArrangementID] = true;
  }
  state.arrangementer = nesteArr;
  state.kalenderoppgaver = [];
  state.tjenestebehov = (state.tjenestebehov || []).filter(function (r) {
    return !r.ArrangementID || synlige[r.ArrangementID];
  });
  state.tildelinger = (state.tildelinger || []).filter(function (r) {
    return !r.ArrangementID || synlige[r.ArrangementID];
  });
  state.programaktiviteter = (state.programaktiviteter || []).filter(function (r) {
    return !r.ArrangementID || synlige[r.ArrangementID];
  });
  state.programinstanser = (state.programinstanser || []).filter(function (r) {
    return !r.ArrangementID || synlige[r.ArrangementID];
  });
  return state;
}

function loadDatabase() {
  ensureSchema_();
  var ss = getSpreadsheet_();
  var state = {};
  var key;

  for (key in MASTER_SHEETS) {
    state[key] = readSheet_(ss, MASTER_SHEETS[key]);
  }
  for (key in IMPORT_SHEETS) {
    state[key] = [];
  }
  try {
    fillEmptySikkerhetsTokenCells_(ss, state.personer);
  } catch (tokenErr) {
    // Innlogging skal ikke feile fordi token-fylling feilet.
  }
  try {
    fillEmptyTilgangsnivaaCells_(ss, state);
  } catch (nivaaErr) {
    // Innlogging skal ikke feile fordi tilgangsnivå-fylling feilet.
  }
  try {
    sikreMagnarGoogleKonto_(state);
  } catch (magnarErr) {
    // Innlogging skal ikke feile om Magnar-cellen ikke kan oppdateres.
  }
  return state;
}

/** Fyller tomme Tilgangsnivå-celler én og én. Tømmer ikke fanen. */
function fillEmptyTilgangsnivaaCells_(ss, state) {
  var spec = MASTER_SHEETS.personer;
  var sheet = ss.getSheetByName(spec.name);
  var personer = state.personer || [];
  if (!sheet || !personer.length) return;
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return;
  var values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  var headerRow = findHeaderRow_(values, spec.columns[0]);
  var headers = values[headerRow] || [];
  var idIdx = headerIndex_(headers, "PersonID");
  if (idIdx < 0) return;
  var nivaaIdx = ensurePersonHeaderColumn_(sheet, headerRow, headers, "Tilgangsnivå");
  var lederIds = {};
  var grupper = state.grupper || [];
  var g;
  for (g = 0; g < grupper.length; g++) {
    if (grupper[g].Aktiv === false) continue;
    var leder = String(grupper[g].GruppelederID || "").trim();
    var nest = String(grupper[g].NestlederID || "").trim();
    if (leder) lederIds[leder] = true;
    if (nest) lederIds[nest] = true;
  }
  var byId = {};
  var i;
  for (i = 0; i < personer.length; i++) {
    byId[String(personer[i].PersonID || "").trim()] = personer[i];
  }
  for (i = headerRow + 1; i < values.length; i++) {
    var id = String(values[i][idIdx] || "").trim();
    if (!id) continue;
    var p = byId[id];
    if (!p) continue;
    var existing = normalizeTilgangsnivaa_(values[i][nivaaIdx]);
    if (existing) {
      p.Tilgangsnivå = existing;
      continue;
    }
    var nivaa = "bruker";
    if (looksLikeLegacyAdminName_(p) || emailsEquivalent_(p.Epost, MAGNAR_GOOGLE_EPOST)) {
      nivaa = "admin";
    } else if (lederIds[id]) {
      nivaa = "gruppeleder";
    }
    p.Tilgangsnivå = nivaa;
    sheet.getRange(i + 1, nivaaIdx + 1).setValue(nivaa);
  }
}

/** Fyller tomme SikkerhetsToken-celler én og én. Tømmer ikke fanen. */
function fillEmptySikkerhetsTokenCells_(ss, personer) {
  var spec = MASTER_SHEETS.personer;
  var sheet = ss.getSheetByName(spec.name);
  if (!sheet || !personer || !personer.length) return;
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return;
  var values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  var headerRow = findHeaderRow_(values, spec.columns[0]);
  var headers = values[headerRow] || [];
  var idIdx = headerIndex_(headers, "PersonID");
  var tokIdx = headerIndex_(headers, "SikkerhetsToken");
  if (idIdx < 0 || tokIdx < 0) return;
  var byId = {};
  var i;
  for (i = 0; i < personer.length; i++) {
    byId[String(personer[i].PersonID || "").trim()] = personer[i];
  }
  for (i = headerRow + 1; i < values.length; i++) {
    var id = String(values[i][idIdx] || "").trim();
    if (!id) continue;
    var p = byId[id];
    if (!p) continue;
    var existing = String(values[i][tokIdx] || "").trim();
    if (isUsableStoredToken_(existing)) {
      p.SikkerhetsToken = existing;
      continue;
    }
    var token = generateRandomMagicToken_();
    p.SikkerhetsToken = token;
    sheet.getRange(i + 1, tokIdx + 1).setValue(token);
  }
}

/** Kjør denne én gang fra Apps Script (Kjør): lager kolonne SikkerhetsToken og fyller mk_-verdier. */
function fyllSikkerhetsTokens() {
  var ss = getSpreadsheet_();
  var personer = readSheet_(ss, MASTER_SHEETS.personer);
  fillEmptySikkerhetsTokenCells_(ss, personer);
  return personer.length;
}

/** Tom klient-state skal ikke slette rader som allerede ligger i arket. */
function skalSkriveArk_(ss, key, spec, records) {
  if (!Array.isArray(records)) return false;
  if (records.length > 0) return true;
  if (
    key !== "arrangementer" &&
    key !== "kalenderoppgaver" &&
    key !== "maler" &&
    key !== "malposter" &&
    key !== "malTilleggsvakter" &&
    key !== "innstillinger"
  ) {
    return true;
  }
  var eksisterende = readSheet_(ss, spec);
  return !eksisterende || eksisterende.length === 0;
}

function saveDatabase(state, isAdmin) {
  ensureSchema_();
  var ss = getSpreadsheet_();
  if (isAdmin !== false && state.personer) {
    var existingPersoner = readSheet_(ss, MASTER_SHEETS.personer);
    mergePersonTokens_(state.personer, existingPersoner);
    // Klient kan ha fått persondata uten e-post/telefon (personvern-rensing).
    // Tomme felt i innkommende state skal ikke slette verdier som allerede ligger i arket.
    mergePersonKontaktFelt_(state.personer, existingPersoner);
    ensurePersonTokens_(state.personer);
  }
  if (isAdmin !== false) {
    if (state.maler) {
      state.maler = flettInnManglendeRader_(state.maler, readSheet_(ss, MASTER_SHEETS.maler), "MalID");
    }
    if (state.malposter) {
      state.malposter = flettInnManglendeRader_(
        state.malposter,
        readSheet_(ss, MASTER_SHEETS.malposter),
        "MalPostID"
      );
    }
    if (state.malTilleggsvakter) {
      state.malTilleggsvakter = flettInnManglendeRader_(
        state.malTilleggsvakter,
        readSheet_(ss, MASTER_SHEETS.malTilleggsvakter),
        "MalTilleggsvaktID"
      );
    }
    if (state.innstillinger) {
      state.innstillinger = flettInnManglendeRader_(
        state.innstillinger,
        readSheet_(ss, MASTER_SHEETS.innstillinger),
        "Nøkkel"
      );
    }
  }
  if (state.arrangementer) {
    state.arrangementer = flettInnManglendeRader_(
      state.arrangementer,
      readSheet_(ss, MASTER_SHEETS.arrangementer),
      "ArrangementID"
    );
  }
  if (state.kalenderoppgaver) {
    state.kalenderoppgaver = flettInnManglendeRader_(
      state.kalenderoppgaver,
      readSheet_(ss, MASTER_SHEETS.kalenderoppgaver),
      "KalenderoppgaveID"
    );
  }
  if (isAdmin === false && state.gudstjenester) {
    state.gudstjenester = mergeGudstjenesteInnhold_(
      state.gudstjenester,
      readSheet_(ss, MASTER_SHEETS.gudstjenester)
    );
  }
  var skrevet = {};
  var kalenderForst = ["arrangementer", "kalenderoppgaver"];
  var k;
  var key;
  for (k = 0; k < kalenderForst.length; k++) {
    key = kalenderForst[k];
    if (state[key] === undefined || state[key] === null) continue;
    if (isAdmin === false && !NON_ADMIN_WRITABLE_SHEETS[key]) continue;
    if (!skalSkriveArk_(ss, key, MASTER_SHEETS[key], state[key])) continue;
    writeSheet_(ss, MASTER_SHEETS[key], state[key]);
    skrevet[key] = true;
  }
  for (key in MASTER_SHEETS) {
    if (skrevet[key]) continue;
    if (state[key] === undefined || state[key] === null) continue;
    if (isAdmin === false && !NON_ADMIN_WRITABLE_SHEETS[key]) continue;
    if (!skalSkriveArk_(ss, key, MASTER_SHEETS[key], state[key])) continue;
    writeSheet_(ss, MASTER_SHEETS[key], state[key]);
  }
  // Import-faner skrives aldri av vanlig save — bare via exportImportBackup.
}

function skrivImportBackup_(data) {
  ensureSchema_();
  var ss = getSpreadsheet_();
  var personer = data.personerImport || [];
  var guds = data.gudstjenesterImport || [];
  var roller = data.rollebeskrivelseImport || [];
  if (!personer.length && !guds.length && !roller.length) {
    throw new Error("Ingenting å eksportere.");
  }
  writeSheet_(ss, IMPORT_SHEETS.personerImport, personer);
  writeSheet_(ss, IMPORT_SHEETS.gudstjenesterImport, guds);
  writeSheet_(ss, IMPORT_SHEETS.rollebeskrivelseImport, roller);
  return {
    personer: personer.length,
    gudstjenester: guds.length,
    roller: roller.length,
  };
}

function flettInnManglendeRader_(incoming, existing, idFelt) {
  var inn = incoming || [];
  var finnes = existing || [];
  if (!finnes.length) return inn;
  if (!inn.length) return finnes;
  var ids = {};
  var i;
  for (i = 0; i < inn.length; i++) {
    ids[String(inn[i][idFelt] || "")] = true;
  }
  var ut = inn.slice();
  for (i = 0; i < finnes.length; i++) {
    var id = String(finnes[i][idFelt] || "");
    if (id && !ids[id]) ut.push(finnes[i]);
  }
  return ut;
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

/** Bevarer kontaktfelt og Tilgangsnivå når klient sender tomme verdier (etter sanitize). */
function mergePersonKontaktFelt_(incoming, existing) {
  var felter = [
    "Epost", "Telefon", "Adresse", "Postnummer", "Poststed",
    "Fødselsår", "Fødselsdato", "Kjønn", "Notat", "Tilgangsnivå", "BildeURL",
  ];
  var byId = {};
  var i;
  var f;
  for (i = 0; i < (existing || []).length; i++) {
    byId[existing[i].PersonID] = existing[i];
  }
  for (i = 0; i < (incoming || []).length; i++) {
    var prev = byId[incoming[i].PersonID];
    if (!prev) continue;
    for (f = 0; f < felter.length; f++) {
      var key = felter[f];
      var ny = incoming[i][key];
      var gammel = prev[key];
      var nyTom = ny === null || ny === undefined || String(ny).trim() === "";
      var gammelHarVerdi = gammel !== null && gammel !== undefined && String(gammel).trim() !== "";
      if (nyTom && gammelHarVerdi) incoming[i][key] = gammel;
    }
  }
}

/** Møteleder kan bare oppdatere kollekt og kunngjøringer — ikke dato, tema eller sted. */
function mergeGudstjenesteInnhold_(incoming, existing) {
  var byId = {};
  var i;
  for (i = 0; i < (existing || []).length; i++) {
    byId[String(existing[i].GudstjenesteID || "").trim()] = existing[i];
  }
  for (i = 0; i < (incoming || []).length; i++) {
    var ny = incoming[i];
    var id = String(ny.GudstjenesteID || "").trim();
    if (!id || !byId[id]) continue;
    if (ny.Kollekt !== undefined) byId[id].Kollekt = ny.Kollekt;
    if (ny["Kunngjøringer"] !== undefined) byId[id]["Kunngjøringer"] = ny["Kunngjøringer"];
  }
  return existing;
}

function getSpreadsheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  try {
    if (ss.getName() !== SPREADSHEET_NAVN) {
      ss.rename(SPREADSHEET_NAVN);
    }
  } catch (renameErr) {
    // Innlogging skal ikke feile om omdøping er sperret.
  }
  return ss;
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
  var lastRow = sheet.getLastRow();
  var values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  var headerRow = findHeaderRow_(values, spec.columns[0]);
  var headers = values[headerRow] || [];
  var i;
  for (i = 0; i < spec.columns.length; i++) {
    if (headerIndex_(headers, spec.columns[i]) < 0) {
      sheet.getRange(headerRow + 1, sheet.getLastColumn() + 1).setValue(spec.columns[i]);
    }
  }
  sheet.setFrozenRows(Math.max(1, headerRow + 1));
}

function sheetLooksLikeGudstjenesteImport_(sheet) {
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 2) return false;
  var values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getDisplayValues();
  var headerRow = findHeaderRow_(values, "GudstjenesteID");
  var headers = values[headerRow] || [];
  return headerIndex_(headers, "GudstjenesteID") >= 0 && headerIndex_(headers, "Leder") >= 0;
}

function resolveImportSheet_(ss, spec) {
  var exact = ss.getSheetByName(spec.name);
  if (exact && sheetLooksLikeGudstjenesteImport_(exact) && parseSheetRows_(exact, spec).length > 0) {
    return exact;
  }
  var sheets = ss.getSheets();
  var best = null;
  var bestCount = 0;
  var i;
  for (i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    if (!sheetLooksLikeGudstjenesteImport_(sh)) continue;
    var count = parseSheetRows_(sh, spec).length;
    if (count > bestCount) {
      best = sh;
      bestCount = count;
    }
  }
  return best || exact;
}

function readSheet_(ss, spec) {
  var sheet =
    spec.name === IMPORT_SHEETS.gudstjenesterImport.name
      ? resolveImportSheet_(ss, spec)
      : ss.getSheetByName(spec.name);
  if (!sheet) return [];
  return parseSheetRows_(sheet, spec);
}

function parseSheetRows_(sheet, spec) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return [];

  var values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  if (!values.length) return [];

  var headerRow = findHeaderRow_(values, spec.columns[0]);
  var headers = values[headerRow].map(function (h) {
    return String(h).trim();
  });
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
      var idx = headerIndex_(headers, col);
      var val = idx >= 0 ? raw[idx] : "";
      obj[col] = coerce_(col, val, spec);
    }

    if (isBlankRecord_(obj, spec)) continue;
    enrichRecord_(obj, spec);
    rows.push(obj);
  }
  return rows;
}

var HEADER_ALIASES_ = {
  Tema: ["Tema", "Tittel"],
  Bibeltekst: ["Bibeltekst", "Bibeltekst", "Bibel", "Tekst"],
  Merknad: ["Merknad", "Notat", "Kommentar"],
  Tid: ["Tid", "Klokkeslett", "Kl"],
  Forbønn: ["Forbønn", "Forbønn"],
  Barnekirke: ["Barnekirke", "Barnekirke"],
  Epost: ["Epost", "E-post", "E-postadresse", "Email", "E-mail", "Mail"],
  SikkerhetsToken: ["SikkerhetsToken", "Sikkerhetstoken", "Token"],
};

function headerIndex_(headers, col) {
  var aliases = HEADER_ALIASES_[col] || [col];
  var a;
  var j;
  for (a = 0; a < aliases.length; a++) {
    var want = String(aliases[a]).trim().toLowerCase().replace(/\s+/g, "");
    for (j = 0; j < headers.length; j++) {
      if (String(headers[j] || "").trim().toLowerCase().replace(/\s+/g, "") === want) {
        return j;
      }
    }
  }
  return -1;
}

function findHeaderRow_(values, requiredHeader) {
  var want = String(requiredHeader).trim().toLowerCase().replace(/\s+/g, "");
  var i;
  var j;
  for (i = 0; i < values.length; i++) {
    for (j = 0; j < values[i].length; j++) {
      if (String(values[i][j]).trim().toLowerCase().replace(/\s+/g, "") === want) return i;
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
    // Tom MaksAntall = ikke satt (bruk app-standard). 0 = eksplisitt ubegrenset.
    if (text === "") return col === "Fødselsår" || col === "MaksAntall" ? null : 0;
    var n = Number(String(text).replace(",", "."));
    return isNaN(n) ? (col === "MaksAntall" ? null : 0) : n;
  }
  if (col === "Dato") {
    var isoDato = normalizeDate_(text);
    return isoDato || text;
  }
  if (col === "Tid") {
    var isoTid = normalizeTime_(text);
    return isoTid || text;
  }
  return text;
}

function serialize_(col, val, spec) {
  var booleans = spec.booleans || [];
  if (booleans.indexOf(col) >= 0) {
    return asBool_(val) ? "TRUE" : "FALSE";
  }
  if (val === null || val === undefined) return "";
  if (col === "Dato") {
    var iso = normalizeDate_(val);
    return iso || val;
  }
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

/** Sammenlign Dato/Tema i Gudstjenester_import mot master (ingen skriving). */
function sammenlignImportMotMaster() {
  ensureSchema_();
  var ss = getSpreadsheet_();
  var importRows = readSheet_(ss, IMPORT_SHEETS.gudstjenesterImport);
  var master = readSheet_(ss, MASTER_SHEETS.gudstjenester);
  var gudById = indexBy_(master, "GudstjenesteID");
  var avvik = [];
  var i;
  for (i = 0; i < importRows.length && avvik.length < 12; i++) {
    var row = importRows[i];
    var id = String(row.GudstjenesteID || "").trim();
    if (!id) continue;
    var g = gudById[id];
    var dato = normalizeDate_(row.Dato);
    var tema = String(row.Tema || "").trim();
    if (!g) {
      avvik.push({ id: id, type: "mangler_i_master", importDato: dato, importTema: tema });
      continue;
    }
    if (String(g.Dato || "") !== dato || String(g.Tema || "").trim() !== tema) {
      avvik.push({
        id: id,
        masterDato: g.Dato,
        importDato: dato,
        masterTema: g.Tema,
        importTema: tema,
      });
    }
  }
  return { importRader: importRows.length, masterRader: master.length, avvik: avvik };
}

/** Dry-run overwrite uten å skrive til arket. */
function dryRunOverwriteImport() {
  return migrerGudstjenesterImport(true, true);
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
    var report = migrerGudstjenesterImport(dryRun, false);
    return { ok: true, dryRun: !!dryRun, report: report };
  } catch (err) {
    return { ok: false, dryRun: !!dryRun, error: String(err) };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Les Gudstjenester_import (B–E + Leder–Pynting) og fyll mastertabeller.
 * Importfanen skrives aldri.
 * @param {boolean} dryRun hvis true, skriv ingenting
 * @param {boolean} overwrite hvis true, overskriv dato/tema/sted og tildelinger for importerte gudstjenester
 */
function migrerGudstjenesterImport(dryRun, overwrite) {
  overwrite = !!overwrite;
  ensureSchema_();
  var ss = getSpreadsheet_();
  var importSheet = resolveImportSheet_(ss, IMPORT_SHEETS.gudstjenesterImport);
  var importRows = importSheet ? parseSheetRows_(importSheet, IMPORT_SHEETS.gudstjenesterImport) : [];
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
    tildelingerFjernet: 0,
    gudstjenesterFjernet: 0,
    overwrite: overwrite,
    faneNavn: importSheet ? importSheet.getName() : "",
  };

  if (!importRows.length) {
    var faneNavn = ss.getSheets().map(function (s) {
      return s.getName();
    }).join(", ");
    report.feil =
      "Fant ingen rader å importere. Slett tittelraden («Høsten 2026») slik at GudstjenesteID står i rad 1. Fanen bør hete Gudstjenester_import. Faner i arket: " +
      faneNavn;
    return report;
  }

  var programaktiviteter = [];
  var programinstanser = [];
  var i;
  if (overwrite) {
    report.gudstjenesterFjernet = gudstjenester.length;
    report.tildelingerFjernet = tildelinger.length;
    gudstjenester = [];
    tildelinger = [];
    svar = [];
    tjenestebehov = [];
    programaktiviteter = [];
    programinstanser = [];
  }

  var gudById = indexBy_(gudstjenester, "GudstjenesteID");
  var tildelingKeys = {};
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
    if (!gudId) continue;
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
    } else if (overwrite) {
      existingGud.Dato = dato;
      existingGud.Tid = tid;
      existingGud.Sted = sted;
      existingGud.Tema = tema;
      existingGud.Bibeltekst = bibel;
      existingGud.Kollekt = kollekt;
      existingGud.Merknad = merknad;
      report.gudstjenesterOppdatert++;
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
        if (!overwrite && !personrolleKeys[prKey]) {
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
    if (overwrite) {
      writeSheet_(ss, MASTER_SHEETS.programaktiviteter, programaktiviteter);
      writeSheet_(ss, MASTER_SHEETS.programinstanser, programinstanser);
    } else {
      writeSheet_(ss, MASTER_SHEETS.personroller, personroller);
    }
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
  var compact = t.match(/^(\d{4})(\d{2})(\d{2})(?:$|T)/);
  if (compact) return compact[1] + "-" + compact[2] + "-" + compact[3];
  var nordic = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (nordic) {
    var year = parseInt(nordic[3], 10);
    if (year < 100) year += 2000;
    return String(year) + "-" + pad2_(nordic[2]) + "-" + pad2_(nordic[1]);
  }
  var maneder = {
    januar: "01", jan: "01",
    februar: "02", feb: "02",
    mars: "03", mar: "03",
    april: "04", apr: "04",
    mai: "05",
    juni: "06", jun: "06",
    juli: "07", jul: "07",
    august: "08", aug: "08",
    september: "09", sept: "09", sep: "09",
    oktober: "10", okt: "10",
    november: "11", nov: "11",
    desember: "12", des: "12"
  };
  var navn = t.toLowerCase().match(/^(\d{1,2})\.?\s*([a-zæøå.]+)\s+(\d{4})/);
  if (navn) {
    var mo = maneder[navn[2].replace(/\./g, "")];
    if (mo) return navn[3] + "-" + mo + "-" + pad2_(navn[1]);
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

var EKSTERN_ICAL_URL =
  "https://lillesandmisjonskirke.no/er/functions/calendar/shareplanneritems.aspx?categoryid=81";

function gyldigIcalHttpUrl_(url) {
  var t = String(url || "").trim().replace(/^webcal:\/\//i, "https://");
  if (!/^https?:\/\//i.test(t)) return "";
  return t;
}

function icalCacheNokkel_(url) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, url);
  var hex = "";
  for (var i = 0; i < digest.length; i++) {
    var b = digest[i];
    if (b < 0) b += 256;
    var h = b.toString(16);
    hex += h.length === 1 ? "0" + h : h;
  }
  return "eIcal_" + hex;
}

function korrigerIcalHeldagsTilKlokkeslett_(ics) {
  var tekst = String(ics || "").replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
  return tekst.replace(/^(DT(?:START|END));VALUE=DATE:(\d{8}T\d{6}(?:Z)?)$/gm, "$1:$2");
}

function hentKorrigertEksternIcal_(onsketUrl) {
  var url = gyldigIcalHttpUrl_(onsketUrl) || EKSTERN_ICAL_URL;
  var cache = CacheService.getScriptCache();
  var nokkel = icalCacheNokkel_(url);
  var cached = cache.get(nokkel);
  if (cached) return cached;
  var res = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    followRedirects: true,
  });
  if (res.getResponseCode() >= 400) {
    throw new Error("Kunne ikke hente ekstern kalender (" + res.getResponseCode() + ")");
  }
  var ics = korrigerIcalHeldagsTilKlokkeslett_(res.getContentText());
  cache.put(nokkel, ics, 600);
  return ics;
}

function icsVtimezoneOslo_() {
  return [
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Oslo",
    "X-LIC-LOCATION:Europe/Oslo",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0200",
    "TZNAME:CEST",
    "DTSTART:19700329T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0100",
    "TZNAME:CET",
    "DTSTART:19701025T030000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
}

function tomIcs_() {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Menighetsplan//NO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Menighetsplan",
    "X-WR-TIMEZONE:Europe/Oslo",
  ]
    .concat(icsVtimezoneOslo_())
    .concat(["END:VCALENDAR", ""])
    .join("\r\n");
}

function icsSvar_(ics) {
  var mime = ContentService.MimeType.ICAL || ContentService.MimeType.TEXT;
  return ContentService.createTextOutput(ics).setMimeType(mime);
}

function loadDatabaseForIcal_() {
  var ss = getSpreadsheet_();
  var keys = [
    "personer",
    "gudstjenester",
    "arrangementer",
    "grupper",
    "gruppemedlemmer",
    "programaktiviteter",
  ];
  var state = {};
  var i;
  for (i = 0; i < keys.length; i++) {
    state[keys[i]] = readSheet_(ss, MASTER_SHEETS[keys[i]]);
  }
  return state;
}

function minIcalSvar_(token) {
  try {
    var t = String(token || "").trim().replace(/\.ics$/i, "");
    if (!isMagicLinkToken_(t)) {
      return icsSvar_(tomIcs_());
    }
    var cache = CacheService.getScriptCache();
    var nokkel = "minIcal_v6_" + t;
    var cached = cache.get(nokkel);
    if (cached) return icsSvar_(cached);
    var state = loadDatabaseForIcal_();
    var person = findPersonByMagicToken_(state, t);
    if (!person) {
      return icsSvar_(tomIcs_());
    }
    var ics = byggPersonIcs_(state, person.PersonID);
    if (ics.indexOf("BEGIN:VEVENT") >= 0) {
      try {
        cache.put(nokkel, ics, 60);
      } catch (cacheErr) {
        // Cache er valgfri — for stor ICS skal fortsatt leveres.
      }
    }
    return icsSvar_(ics);
  } catch (err) {
    Logger.log("minIcal: " + err);
    return icsSvar_(tomIcs_());
  }
}

function innstillingErSan_(state, nokkel) {
  var rader = state.innstillinger || [];
  var i;
  for (i = 0; i < rader.length; i++) {
    if (String(rader[i].Nøkkel || "").trim() === nokkel) {
      return String(rader[i].Verdi || "").trim().toLowerCase() === "true";
    }
  }
  return false;
}

function erMedlemAvGruppe_(state, personId, gruppeId) {
  var grupper = state.grupper || [];
  var i;
  for (i = 0; i < grupper.length; i++) {
    if (grupper[i].GruppeID !== gruppeId) continue;
    if (grupper[i].GruppelederID === personId || grupper[i].NestlederID === personId) return true;
  }
  var gm = state.gruppemedlemmer || [];
  for (i = 0; i < gm.length; i++) {
    if (gm[i].Aktiv === false) continue;
    if (gm[i].PersonID === personId && gm[i].GruppeID === gruppeId) return true;
  }
  return false;
}

function arrangementSynligForPerson_(state, personId, arrangement) {
  if (!arrangement || arrangement.Aktiv === false) return false;
  var gruppeId = String(arrangement.GruppeID || "").trim();
  if (!gruppeId) return true;
  return erMedlemAvGruppe_(state, personId, gruppeId);
}

function arrangementMedIIcal_(state, personId, arrangement) {
  if (!arrangement || arrangement.Aktiv === false) return false;
  if (String(arrangement.EksternKalenderID || "").trim()) return true;
  return arrangementSynligForPerson_(state, personId, arrangement);
}

function parseKlokkeMin_(tid) {
  var m = /^(\d{1,2}):(\d{2})/.exec(String(tid || "").trim());
  if (!m) return 11 * 60;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function formatKlokkeMin_(min) {
  var wrapped = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  var h = Math.floor(wrapped / 60);
  var mm = wrapped % 60;
  return (h < 10 ? "0" : "") + h + ":" + (mm < 10 ? "0" : "") + mm;
}

function programForHendelse_(state, gudId, arrId) {
  var rader = state.programaktiviteter || [];
  var ut = [];
  var i;
  for (i = 0; i < rader.length; i++) {
    var p = rader[i];
    if (arrId) {
      if (p.ArrangementID === arrId) ut.push(p);
    } else if (p.GudstjenesteID === gudId && !p.ArrangementID) {
      ut.push(p);
    }
  }
  ut.sort(function (a, b) {
    return (a.Rekkefolge || 0) - (b.Rekkefolge || 0);
  });
  return ut;
}

function beregnSisteSlutt_(linjer, startTid) {
  var sorted = linjer.slice().sort(function (a, b) {
    return (a.Rekkefolge || 0) - (b.Rekkefolge || 0);
  });
  var prefix = 0;
  var i;
  for (i = 0; i < sorted.length; i++) {
    if (!sorted[i].ForStart) break;
    prefix += Math.max(0, Number(sorted[i].VarighetMin) || 0);
  }
  var cursor = parseKlokkeMin_(startTid) - prefix;
  var slutt = formatKlokkeMin_(cursor);
  for (i = 0; i < sorted.length; i++) {
    var dur = Math.max(0, Number(sorted[i].VarighetMin) || 0);
    cursor += dur;
    slutt = formatKlokkeMin_(cursor);
  }
  return slutt;
}

function hendelseSluttTid_(state, kind, id, startTid) {
  var linjer = kind === "gudstjeneste" ? programForHendelse_(state, id, "") : programForHendelse_(state, "", id);
  if (linjer.length) return beregnSisteSlutt_(linjer, startTid);
  return formatKlokkeMin_(parseKlokkeMin_(startTid) + (kind === "gudstjeneste" ? 90 : 60));
}

function icsEscape_(tekst) {
  return String(tekst || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function icsDatoTid_(dato, tid) {
  var iso = normalizeDate_(dato);
  var d = String(iso || "").replace(/-/g, "");
  if (!/^\d{8}$/.test(d)) return "";
  var kl = normalizeTime_(tid) || "11:00";
  var m = /^(\d{1,2}):(\d{2})/.exec(kl);
  var hh = m ? pad2_(m[1]) : "11";
  var mm = m ? m[2] : "00";
  return d + "T" + hh + mm + "00";
}

function byggPersonIcs_(state, personId) {
  var linjer = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Menighetsplan//NO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Menighetsplan",
    "X-WR-TIMEZONE:Europe/Oslo",
  ].concat(icsVtimezoneOslo_());
  var stamp = Utilities.formatDate(new Date(), "UTC", "yyyyMMdd'T'HHmmss'Z'");
  var guds = state.gudstjenester || [];
  var i;
  for (i = 0; i < guds.length; i++) {
    var g = guds[i];
    var start = g.Tid || "11:00";
    var slutt = hendelseSluttTid_(state, "gudstjeneste", g.GudstjenesteID, start);
    var gStart = icsDatoTid_(g.Dato, start);
    var gSlutt = icsDatoTid_(g.Dato, slutt);
    if (!gStart || !gSlutt) continue;
    linjer.push(
      "BEGIN:VEVENT",
      "UID:gudstjeneste-" + g.GudstjenesteID + "@menighetsplan",
      "DTSTAMP:" + stamp,
      "DTSTART;TZID=Europe/Oslo:" + gStart,
      "DTEND;TZID=Europe/Oslo:" + gSlutt,
      "SUMMARY:" + icsEscape_(g.Tema || "Gudstjeneste")
    );
    if (g.Sted) linjer.push("LOCATION:" + icsEscape_(g.Sted));
    linjer.push("END:VEVENT");
  }
  var arr = state.arrangementer || [];
  for (i = 0; i < arr.length; i++) {
    if (!arrangementMedIIcal_(state, personId, arr[i])) continue;
    var a = arr[i];
    var aStart = a.Tid || "12:00";
    var aSlutt = hendelseSluttTid_(state, "arrangement", a.ArrangementID, aStart);
    var arrStart = icsDatoTid_(a.Dato, aStart);
    var arrSlutt = icsDatoTid_(a.Dato, aSlutt);
    if (!arrStart || !arrSlutt) continue;
    linjer.push(
      "BEGIN:VEVENT",
      "UID:arrangement-" + a.ArrangementID + "@menighetsplan",
      "DTSTAMP:" + stamp,
      "DTSTART;TZID=Europe/Oslo:" + arrStart,
      "DTEND;TZID=Europe/Oslo:" + arrSlutt,
      "SUMMARY:" + icsEscape_(a.Tittel)
    );
    if (a.Sted) linjer.push("LOCATION:" + icsEscape_(a.Sted));
    linjer.push("END:VEVENT");
  }
  linjer.push("END:VCALENDAR", "");
  return linjer.join("\r\n");
}


