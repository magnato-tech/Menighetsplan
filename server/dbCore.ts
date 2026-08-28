import type { DatabaseState } from "../src/types/database";
import {
  MAGNAR_GOOGLE_EPOST,
  erAdministrator,
  finnPersonForGoogleSesjon,
  finnPersonMedMagiskToken,
  sikreMagnarGoogleAdminIMinne,
} from "../src/services/tilgang";
import { mergeIncomingState, sanitizeStateForViewer } from "../src/services/serverSanitize";

export type DbEnv = {
  supabaseUrl: string;
  supabaseKey: string;
  googleClientId: string;
  appsScriptUrl: string;
  migrateFromSheets: boolean;
};

type AuthBody = {
  action?: string;
  token?: string;
  googleCredential?: string;
  data?: Partial<DatabaseState>;
};

type AuthOk = {
  ok: true;
  state: DatabaseState;
  isAdmin: boolean;
  personId: string;
  persistState?: DatabaseState;
};

type AuthFail = { ok: false; error: string };

export type DbActionResult = {
  status: number;
  body: Record<string, unknown>;
};

function tomPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return true;
  const o = payload as Partial<DatabaseState>;
  return !Array.isArray(o.personer) || o.personer.length === 0;
}

function somState(payload: unknown): DatabaseState {
  return (payload && typeof payload === "object" ? payload : {}) as DatabaseState;
}

async function supabaseHent(env: DbEnv): Promise<{ payload: unknown; updated_at?: string }> {
  const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/app_state?id=eq.1&select=payload,updated_at`;
  const res = await fetch(url, {
    headers: {
      apikey: env.supabaseKey,
      Authorization: `Bearer ${env.supabaseKey}`,
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase-lesing feilet (${res.status}): ${t.slice(0, 200)}`);
  }
  const rader = (await res.json()) as Array<{ payload?: unknown; updated_at?: string }>;
  const rad = rader[0];
  if (!rad) return { payload: {} };
  return { payload: rad.payload ?? {}, updated_at: rad.updated_at };
}

async function supabaseLagre(env: DbEnv, payload: DatabaseState): Promise<string | undefined> {
  const url = `${env.supabaseUrl.replace(/\/$/, "")}/rest/v1/app_state?on_conflict=id`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: env.supabaseKey,
      Authorization: `Bearer ${env.supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({ id: 1, payload }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase-lagring feilet (${res.status}): ${t.slice(0, 200)}`);
  }
  const rader = (await res.json()) as Array<{ updated_at?: string }>;
  return rader[0]?.updated_at;
}

async function verifyGoogleEmail(
  env: DbEnv,
  idToken: string
): Promise<{ email: string } | { error: string }> {
  if (!env.googleClientId) {
    return { error: "Mangler GOOGLE_CLIENT_ID på serveren. Sett den i Vercel og redeploy." };
  }
  const res = await fetch("https://oauth2.googleapis.com/tokeninfo", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `id_token=${encodeURIComponent(idToken)}`,
  });
  if (!res.ok) {
    return {
      error:
        "Google-økten er utløpt eller ugyldig. Klikk «Logg på som Magnar» på nytt (ikke bare last siden).",
    };
  }
  const info = (await res.json()) as {
    error?: string;
    aud?: string;
    azp?: string;
    email?: string;
    email_verified?: boolean | string;
  };
  if (info.error) {
    return { error: "Google-økten er utløpt. Logg inn med Google på nytt." };
  }
  if (info.aud !== env.googleClientId && info.azp !== env.googleClientId) {
    return {
      error:
        "Google-klienten på serveren matcher ikke innloggingen. Sjekk at GOOGLE_CLIENT_ID i Vercel er den fra MasterChurchPlan, og at den gjelder Production (ikke bare Build).",
    };
  }
  if (info.email_verified === false || info.email_verified === "false") {
    return { error: "Google-kontoen har ikke bekreftet e-postadresse." };
  }
  const email = String(info.email || "").trim().toLowerCase();
  if (!email) return { error: "Google-innlogging ga ingen e-postadresse." };
  return { email };
}

function epostErMagnar(epost: string): boolean {
  return epost.trim().toLowerCase() === MAGNAR_GOOGLE_EPOST.toLowerCase();
}

async function lastFraSheets(env: DbEnv, body: AuthBody): Promise<DatabaseState> {
  if (!env.appsScriptUrl) {
    throw new Error("Mangler Apps Script-URL for å hente fra Google-arket.");
  }
  const res = await fetch(env.appsScriptUrl.replace(/\/$/, ""), {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "load",
      token: body.token,
      googleCredential: body.googleCredential,
    }),
  });
  const text = await res.text();
  const payload = JSON.parse(text || "{}") as { ok?: boolean; data?: DatabaseState; error?: string };
  if (!payload.ok || !payload.data) {
    throw new Error(payload.error || "Kunne ikke laste Google-arket.");
  }
  return payload.data;
}

async function requireAuth(env: DbEnv, body: AuthBody, state: DatabaseState): Promise<AuthOk | AuthFail> {
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
        persistState: sikret.db,
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

function manglerSupabase(env: DbEnv): string | null {
  if (!env.supabaseUrl || !env.supabaseKey) {
    return "Mangler SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY.";
  }
  return null;
}

function svarOk(state: DatabaseState, auth: AuthOk, updated_at?: string): DbActionResult {
  return {
    status: 200,
    body: {
      ok: true,
      data: sanitizeStateForViewer(state, auth.personId, auth.isAdmin),
      personId: auth.personId,
      isAdmin: auth.isAdmin,
      updated_at,
    },
  };
}

export async function handleDbAction(env: DbEnv, raw: unknown): Promise<DbActionResult> {
  const conf = manglerSupabase(env);
  if (conf) return { status: 500, body: { ok: false, error: conf } };

  const body = (raw && typeof raw === "object" ? raw : {}) as AuthBody;
  const action = String(body.action || "load");

  try {
    let { payload, updated_at } = await supabaseHent(env);
    let state = somState(payload);

    const tomOgSkalHenteArk =
      tomPayload(payload) &&
      (env.migrateFromSheets ||
        action === "migrateFromSheets" ||
        Boolean(body.googleCredential));
    if (tomOgSkalHenteArk) {
      state = await lastFraSheets(env, body);
      const authMig = await requireAuth(env, body, state);
      if (authMig.ok === false) return { status: 401, body: { ok: false, error: authMig.error } };
      if (!authMig.isAdmin) {
        return {
          status: 403,
          body: {
            ok: false,
            error:
              "Supabase er tom. En administrator må hente fra Google-arket til Supabase først.",
          },
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

    if (tomPayload(state) && action !== "save") {
      return {
        status: 409,
        body: {
          ok: false,
          error:
            "Supabase er tom. Logg inn som administrator og velg «Hent fra Google-arket til Supabase».",
        },
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
            error: "Supabase er tom. Hent først fra Google-arket til Supabase før du lagrer.",
          },
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
