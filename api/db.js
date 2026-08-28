var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/db.ts
var db_exports = {};
__export(db_exports, {
  config: () => config,
  default: () => handler
});
module.exports = __toCommonJS(db_exports);

// src/services/innlogging.ts
function erMagiskLenkeToken(verdi) {
  return /^mk_[0-9a-z]+$/i.test(String(verdi || "").trim());
}

// src/services/tilgang.ts
function finnPersonMedMagiskToken(db, token) {
  if (!token || !db?.personer) return void 0;
  const clean = token.trim();
  if (!erMagiskLenkeToken(clean)) return void 0;
  return db.personer.find((p) => String(p.SikkerhetsToken || "").trim() === clean);
}
function personIdsGruppelederKanSeKontaktFor(db, personId) {
  const ids = /* @__PURE__ */ new Set([personId]);
  for (const g of db.grupper || []) {
    if (!g.Aktiv) continue;
    if (g.GruppelederID !== personId && g.NestlederID !== personId) continue;
    if (g.GruppelederID) ids.add(g.GruppelederID);
    if (g.NestlederID) ids.add(g.NestlederID);
    for (const gm of db.gruppemedlemmer || []) {
      if (gm.Aktiv && gm.GruppeID === g.GruppeID) ids.add(gm.PersonID);
    }
  }
  return ids;
}
function rensPersondataForKlient(db, personId, isAdmin) {
  if (isAdmin) return db;
  const synligKontakt = personId ? personIdsGruppelederKanSeKontaktFor(db, personId) : /* @__PURE__ */ new Set();
  return {
    ...db,
    personer: db.personer.map((p) => {
      if (personId && synligKontakt.has(p.PersonID)) return p;
      return {
        ...p,
        SikkerhetsToken: "",
        Epost: "",
        Telefon: "",
        Adresse: "",
        Postnummer: "",
        Poststed: "",
        F\u00F8dsels\u00E5r: void 0,
        F\u00F8dselsdato: "",
        Kj\u00F8nn: "",
        Notat: ""
      };
    })
  };
}
function erAktivRad(verdi) {
  return verdi !== false && verdi !== "FALSE" && verdi !== "false";
}
var MAGNAR_GOOGLE_EPOST = "magnar.totland@gmail.com";
function serUtSomMagnar(person) {
  const navn = String(person.Navn || "").trim().toLowerCase();
  const fornavn = String(person.Fornavn || "").trim().toLowerCase();
  return fornavn === "magnar" || navn === "magnar" || navn.startsWith("magnar ");
}
function lesTilgangsnivaa(verdi) {
  const v = String(verdi || "").trim().toLowerCase();
  if (v === "admin" || v === "administrator") return "admin";
  if (v === "gruppeleder") return "gruppeleder";
  if (v === "bruker" || v === "medlem") return "bruker";
  return "";
}
function lederPersonIder(db) {
  const ids = /* @__PURE__ */ new Set();
  for (const g of db.grupper || []) {
    if (!erAktivRad(g.Aktiv)) continue;
    const leder = String(g.GruppelederID || "").trim();
    const nest = String(g.NestlederID || "").trim();
    if (leder) ids.add(leder);
    if (nest) ids.add(nest);
  }
  return ids;
}
function tilgangsnivaaForPerson(db, personID) {
  const person = db.personer.find((p) => p.PersonID === personID);
  if (!person || !erAktivRad(person.Aktiv)) return "bruker";
  const lagret = lesTilgangsnivaa(person.Tilgangsniv\u00E5);
  if (lagret) return lagret;
  if (eposterMatcher(person.Epost, MAGNAR_GOOGLE_EPOST)) return "admin";
  if (lederPersonIder(db).has(person.PersonID)) return "gruppeleder";
  return "bruker";
}
function erAdministrator(db, personID) {
  const person = db.personer.find((p) => p.PersonID === personID);
  if (!person || !erAktivRad(person.Aktiv)) return false;
  return tilgangsnivaaForPerson(db, personID) === "admin";
}
function normaliserEpost(epost) {
  return String(epost || "").trim().toLowerCase();
}
function normaliserEpostForMatch(epost) {
  const e = normaliserEpost(epost);
  if (!e) return "";
  const at = e.lastIndexOf("@");
  if (at < 1) return e;
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") {
    local = local.split("+")[0].replace(/\./g, "");
  }
  return `${local}@${domain}`;
}
function eposterMatcher(a, b) {
  const na = normaliserEpostForMatch(a);
  const nb = normaliserEpostForMatch(b);
  return Boolean(na && nb && na === nb);
}
function finnPersonForGoogleSesjon(db, epost, personId) {
  const needle = normaliserEpost(epost);
  const id = String(personId || "").trim();
  const aktive = (db.personer || []).filter((p) => erAktivRad(p.Aktiv));
  if (needle) {
    const medEpost = aktive.find((p) => eposterMatcher(p.Epost, needle));
    if (medEpost) return medEpost;
  }
  if (id) {
    const medId = aktive.find((p) => String(p.PersonID) === id);
    if (medId) return medId;
  }
  if (needle && eposterMatcher(needle, MAGNAR_GOOGLE_EPOST)) {
    const magnar = aktive.find(serUtSomMagnar);
    if (magnar) return magnar;
  }
  return void 0;
}
function sikreMagnarGoogleAdminIMinne(db, epost) {
  const now = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  let neste = db;
  let person = finnPersonForGoogleSesjon(neste, epost);
  if (!person) {
    const n = Math.max(
      0,
      ...neste.personer.map((p) => parseInt(String(p.PersonID || "").replace(/\D/g, ""), 10) || 0)
    );
    person = {
      PersonID: `P${String(n + 1).padStart(3, "0")}`,
      Navn: "Magnar Totland",
      Fornavn: "Magnar",
      Etternavn: "Totland",
      Epost: MAGNAR_GOOGLE_EPOST,
      Telefon: "",
      Tilgangsniv\u00E5: "admin",
      Aktiv: true,
      OpprettetDato: now,
      SistEndret: now
    };
    neste = { ...neste, personer: [...neste.personer, person] };
  } else {
    person = {
      ...person,
      Epost: MAGNAR_GOOGLE_EPOST,
      Tilgangsniv\u00E5: "admin",
      SistEndret: now
    };
    neste = {
      ...neste,
      personer: neste.personer.map((p) => p.PersonID === person.PersonID ? person : p)
    };
  }
  return { db: neste, person };
}

// src/services/serverSanitize.ts
function sanitizeStateForViewer(db, personId, isAdmin) {
  return rensPersondataForKlient(db, personId, isAdmin);
}
var PERSON_KONTAKT = [
  "Epost",
  "Telefon",
  "Adresse",
  "Postnummer",
  "Poststed",
  "F\xF8dsels\xE5r",
  "F\xF8dselsdato",
  "Kj\xF8nn",
  "Notat",
  "Tilgangsniv\xE5",
  "BildeURL",
  "SikkerhetsToken"
];
function tomVerdi(v) {
  return v === null || v === void 0 || String(v).trim() === "";
}
function flettPersoner(incoming, existing) {
  if (!incoming) return existing;
  const byId = new Map(existing.map((p) => [p.PersonID, p]));
  return incoming.map((p) => {
    const prev = byId.get(p.PersonID);
    if (!prev) return p;
    const neste = { ...p };
    for (const felt of PERSON_KONTAKT) {
      if (tomVerdi(neste[felt]) && !tomVerdi(prev[felt])) {
        neste[felt] = prev[felt];
      }
    }
    return neste;
  });
}
function flettGudstjenesterIkkeAdmin(incoming, existing) {
  if (!incoming) return existing;
  const byId = new Map(existing.map((g) => [g.GudstjenesteID, { ...g }]));
  for (const ny of incoming) {
    const id = String(ny.GudstjenesteID || "").trim();
    const prev = byId.get(id);
    if (!id || !prev) continue;
    if (ny.Kollekt !== void 0) prev.Kollekt = ny.Kollekt;
    if (ny.Merknad !== void 0) prev.Merknad = ny.Merknad;
  }
  return [...byId.values()];
}
function mergeIncomingState(existing, incoming, isAdmin) {
  if (!isAdmin) {
    return {
      ...existing,
      grupper: incoming.grupper ?? existing.grupper,
      gruppemedlemmer: incoming.gruppemedlemmer ?? existing.gruppemedlemmer,
      gudstjenester: flettGudstjenesterIkkeAdmin(incoming.gudstjenester, existing.gudstjenester),
      tjenestebehov: incoming.tjenestebehov ?? existing.tjenestebehov,
      tildelinger: incoming.tildelinger ?? existing.tildelinger,
      svar: incoming.svar ?? existing.svar,
      programaktiviteter: incoming.programaktiviteter ?? existing.programaktiviteter,
      programinstanser: incoming.programinstanser ?? existing.programinstanser
    };
  }
  const neste = { ...existing };
  const n\u00F8kler = Object.keys(existing);
  for (const key of n\u00F8kler) {
    if (incoming[key] === void 0 || incoming[key] === null) continue;
    if (key === "personer") continue;
    neste[key] = incoming[key];
  }
  neste.personer = flettPersoner(incoming.personer, existing.personer);
  return neste;
}

// server/dbCore.ts
function tomPayload(payload) {
  if (!payload || typeof payload !== "object") return true;
  const o = payload;
  return !Array.isArray(o.personer) || o.personer.length === 0;
}
function somState(payload) {
  return payload && typeof payload === "object" ? payload : {};
}
async function supabaseHent(env) {
  const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/app_state?id=eq.1&select=payload,updated_at`;
  const res = await fetch(url, {
    headers: {
      apikey: env.supabaseKey,
      Authorization: `Bearer ${env.supabaseKey}`
    }
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase-lesing feilet (${res.status}): ${t.slice(0, 200)}`);
  }
  const rader = await res.json();
  const rad = rader[0];
  if (!rad) return { payload: {} };
  return { payload: rad.payload ?? {}, updated_at: rad.updated_at };
}
async function supabaseLagre(env, payload) {
  const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/app_state?on_conflict=id`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: env.supabaseKey,
      Authorization: `Bearer ${env.supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify({ id: 1, payload })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase-lagring feilet (${res.status}): ${t.slice(0, 200)}`);
  }
  const rader = await res.json();
  return rader[0]?.updated_at;
}
async function verifyGoogleEmail(env, idToken) {
  if (!env.googleClientId) {
    return { error: "Mangler GOOGLE_CLIENT_ID p\xE5 serveren. Sett den i Vercel og redeploy." };
  }
  const res = await fetch("https://oauth2.googleapis.com/tokeninfo", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `id_token=${encodeURIComponent(idToken)}`
  });
  if (!res.ok) {
    return {
      error: "Google-\xF8kten er utl\xF8pt eller ugyldig. Klikk \xABLogg p\xE5 som Magnar\xBB p\xE5 nytt (ikke bare last siden)."
    };
  }
  const info = await res.json();
  if (info.error) {
    return { error: "Google-\xF8kten er utl\xF8pt. Logg inn med Google p\xE5 nytt." };
  }
  if (info.aud !== env.googleClientId && info.azp !== env.googleClientId) {
    return {
      error: "Google-klienten p\xE5 serveren matcher ikke innloggingen. Sjekk at GOOGLE_CLIENT_ID i Vercel er den fra MasterChurchPlan, og at den gjelder Production (ikke bare Build)."
    };
  }
  if (info.email_verified === false || info.email_verified === "false") {
    return { error: "Google-kontoen har ikke bekreftet e-postadresse." };
  }
  const email = String(info.email || "").trim().toLowerCase();
  if (!email) return { error: "Google-innlogging ga ingen e-postadresse." };
  return { email };
}
function epostErMagnar(epost) {
  return epost.trim().toLowerCase() === MAGNAR_GOOGLE_EPOST.toLowerCase();
}
async function lastFraSheets(env, body) {
  if (!env.appsScriptUrl) {
    throw new Error("Mangler Apps Script-URL for \xE5 hente fra Google-arket.");
  }
  const res = await fetch(env.appsScriptUrl.replace(/\/$/, ""), {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "load",
      token: body.token,
      googleCredential: body.googleCredential
    })
  });
  const text = await res.text();
  const payload = JSON.parse(text || "{}");
  if (!payload.ok || !payload.data) {
    throw new Error(payload.error || "Kunne ikke laste Google-arket.");
  }
  return payload.data;
}
async function requireAuth(env, body, state) {
  if (body.googleCredential) {
    const google = await verifyGoogleEmail(env, String(body.googleCredential));
    if ("error" in google) return { ok: false, error: google.error };
    const email = google.email;
    const db = state;
    const person = finnPersonForGoogleSesjon(db, email);
    if (epostErMagnar(email) && (!person || !erAdministrator(db, person.PersonID))) {
      const sikret = sikreMagnarGoogleAdminIMinne(db, email);
      return {
        ok: true,
        state: sikret.db,
        isAdmin: true,
        personId: sikret.person.PersonID,
        persistState: sikret.db
      };
    }
    if (!person || !erAdministrator(db, person.PersonID)) {
      return { ok: false, error: "Google-kontoen er ikke registrert som administrator." };
    }
    return { ok: true, state: db, isAdmin: true, personId: person.PersonID };
  }
  if (body.token) {
    const person = finnPersonMedMagiskToken(state, String(body.token));
    if (!person) return { ok: false, error: "Ugyldig eller ukjent lenke." };
    const isAdmin = erAdministrator(state, person.PersonID);
    return { ok: true, state, isAdmin, personId: person.PersonID };
  }
  return { ok: false, error: "Mangler innlogging (token eller Google)." };
}
function manglerSupabase(env) {
  if (!env.supabaseUrl || !env.supabaseKey) {
    return "Mangler SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY.";
  }
  return null;
}
function svarOk(state, auth, updated_at) {
  return {
    status: 200,
    body: {
      ok: true,
      data: sanitizeStateForViewer(state, auth.personId, auth.isAdmin),
      personId: auth.personId,
      isAdmin: auth.isAdmin,
      updated_at
    }
  };
}
async function handleDbAction(env, raw) {
  if (env.demoMode) {
    return {
      status: 403,
      body: { ok: false, error: "Demoversjonen skriver ikke til menighetens database." }
    };
  }
  const conf = manglerSupabase(env);
  if (conf) return { status: 500, body: { ok: false, error: conf } };
  const body = raw && typeof raw === "object" ? raw : {};
  const action = String(body.action || "load");
  try {
    let { payload, updated_at } = await supabaseHent(env);
    let state = somState(payload);
    const tomOgSkalHenteArk = tomPayload(payload) && (env.migrateFromSheets || action === "migrateFromSheets" || Boolean(body.googleCredential));
    if (tomOgSkalHenteArk) {
      state = await lastFraSheets(env, body);
      const authMig = await requireAuth(env, body, state);
      if (authMig.ok === false) return { status: 401, body: { ok: false, error: authMig.error } };
      if (!authMig.isAdmin) {
        return {
          status: 403,
          body: {
            ok: false,
            error: "Supabase er tom. En administrator m\xE5 hente fra Google-arket til Supabase f\xF8rst."
          }
        };
      }
      const lagre = authMig.persistState || state;
      updated_at = await supabaseLagre(env, lagre);
      state = lagre;
      if (action === "load" || action === "migrateFromSheets") {
        return svarOk(state, { ...authMig, state }, updated_at);
      }
    } else if (action === "migrateFromSheets") {
      const auth = await requireAuth(env, body, state);
      if (auth.ok === false) return { status: 401, body: { ok: false, error: auth.error } };
      if (!auth.isAdmin) {
        return { status: 403, body: { ok: false, error: "Denne handlingen krever administrator." } };
      }
      state = await lastFraSheets(env, body);
      updated_at = await supabaseLagre(env, state);
      return svarOk(state, { ...auth, state, isAdmin: true }, updated_at);
    }
    if (action === "replace") {
      if (!body.data) return { status: 400, body: { ok: false, error: "Mangler data" } };
      const authBase = tomPayload(state) ? somState(body.data) : state;
      const auth = await requireAuth(env, body, authBase);
      if (auth.ok === false) return { status: 401, body: { ok: false, error: auth.error } };
      if (!auth.isAdmin) {
        return { status: 403, body: { ok: false, error: "Denne handlingen krever administrator." } };
      }
      const neste = somState(body.data);
      if (tomPayload(neste)) {
        return { status: 400, body: { ok: false, error: "Kan ikke overskrive Supabase med tomt personregister." } };
      }
      updated_at = await supabaseLagre(env, neste);
      return svarOk(neste, { ...auth, state: neste, isAdmin: true }, updated_at);
    }
    if (tomPayload(state) && action !== "save") {
      return {
        status: 409,
        body: {
          ok: false,
          error: "Supabase er tom. Logg inn som administrator og velg \xABHent fra Google-arket til Supabase\xBB."
        }
      };
    }
    if (action === "load") {
      const auth = await requireAuth(env, body, state);
      if (auth.ok === false) return { status: 401, body: { ok: false, error: auth.error } };
      if (auth.persistState) {
        updated_at = await supabaseLagre(env, auth.persistState);
        state = auth.persistState;
      }
      return svarOk(state, auth, updated_at);
    }
    if (action === "save") {
      if (tomPayload(state)) {
        return {
          status: 409,
          body: {
            ok: false,
            error: "Supabase er tom. Hent f\xF8rst fra Google-arket til Supabase f\xF8r du lagrer."
          }
        };
      }
      const auth = await requireAuth(env, body, state);
      if (auth.ok === false) return { status: 401, body: { ok: false, error: auth.error } };
      if (!body.data) return { status: 400, body: { ok: false, error: "Mangler data" } };
      const grunnlag = auth.persistState || state;
      const merget = mergeIncomingState(grunnlag, body.data, auth.isAdmin);
      updated_at = await supabaseLagre(env, merget);
      return svarOk(merget, auth, updated_at);
    }
    return { status: 400, body: { ok: false, error: `Ukjent action: ${action}` } };
  } catch (err) {
    return { status: 500, body: { ok: false, error: err instanceof Error ? err.message : String(err) } };
  }
}

// server/db.ts
var config = { maxDuration: 60 };
function erDemoForesporsel(req) {
  if (String(process.env.VITE_DEMO || process.env.DEMO_MODE || "").toLowerCase() === "true") {
    return true;
  }
  const raw = req.headers?.host;
  const host = String(Array.isArray(raw) ? raw[0] : raw || "").split(":")[0].toLowerCase();
  return host === "demo.menighetsplan.no" || host.endsWith(".demo.menighetsplan.no");
}
function lesEnv() {
  return {
    supabaseUrl: String(process.env.SUPABASE_URL || "").trim(),
    supabaseKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
    googleClientId: String(
      process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || ""
    ).trim(),
    appsScriptUrl: String(
      process.env.APPS_SCRIPT_URL || process.env.VITE_APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbznLoq62orP53izSEA0wnA7VdQHiNWpP3upTo2nd1owcL3LDZp13gK8LxrAdsjxWwt7vw/exec"
    ).trim(),
    migrateFromSheets: String(process.env.MIGRATE_FROM_SHEETS || "").toLowerCase() === "true",
    demoMode: false
  };
}
async function lesBody(req) {
  if (req.body == null || req.body === "") return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}
async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if ((req.method || "GET").toUpperCase() !== "POST") {
    res.status(405).json({ ok: false, error: "Bruk POST." });
    return;
  }
  const body = await lesBody(req);
  const result = await handleDbAction({ ...lesEnv(), demoMode: erDemoForesporsel(req) }, body);
  res.status(result.status).json(result.body);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  config
});
module.exports = handler; module.exports.config = config;
