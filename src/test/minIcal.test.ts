import "./polyfill";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseMinIcalToken, TOM_ICS, byggIcsForToken } from "../../server/minIcal";
import { byggPersonIcs } from "../services/kalender";
import type { DatabaseState } from "../types/database";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const handler = require(join(__dirname, "../../api/min-ical.js")) as (
  req: { query?: Record<string, string | string[] | undefined>; url?: string },
  res: {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => { send: (body: string) => void };
  }
) => Promise<void>;

function mockRes() {
  const state = {
    headers: {} as Record<string, string>,
    statusCode: 0,
    body: "",
  };
  return {
    state,
    res: {
      setHeader(name: string, value: string) {
        state.headers[name] = value;
      },
      status(code: number) {
        state.statusCode = code;
        return {
          send(body: string) {
            state.body = body;
          },
        };
      },
    },
  };
}

function tomDb(): DatabaseState {
  return {
    gruppetyper: [],
    personer: [],
    grupper: [],
    gruppemedlemmer: [],
    roller: [],
    personroller: [],
    rollebeskrivelser: [],
    gudstjenester: [
      {
        GudstjenesteID: "G001",
        Dato: "2026-09-07",
        Tid: "11:00",
        Tema: "Høstgudstjeneste",
        Sted: "Bedehuset",
      },
    ],
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
    samlingoppmote: [],
    gruppeMeldinger: [],
    varselLogg: [],
    personerImport: [],
    gudstjenesterImport: [],
    rollebeskrivelseImport: [],
  };
}

{
  assert.equal(parseMinIcalToken({ query: { t: "mk_abc123" } }), "mk_abc123");
  assert.equal(parseMinIcalToken({ query: { t: "mk_abc123.ics" } }), "mk_abc123");
  assert.equal(
    parseMinIcalToken({ url: "https://www.menighetsplan.no/kalender/mk_xyz.ics" }),
    "mk_xyz"
  );
  assert.equal(parseMinIcalToken({ url: "/api/min-ical?t=mk_fraquery" }), "mk_fraquery");
  assert.equal(parseMinIcalToken({}), "");
}

{
  const ics = byggPersonIcs(tomDb(), "P001");
  assert.ok(ics.includes("BEGIN:VCALENDAR"));
  assert.ok(ics.includes("BEGIN:VEVENT"));
  assert.ok(ics.includes("X-WR-CALNAME:Menighetsplan"));
  assert.ok(ics.includes("Høstgudstjeneste"));
}

{
  assert.ok(existsSync(join(__dirname, "../../api/min-ical.js")));
  const kilde = readFileSync(join(__dirname, "../../api/min-ical.js"), "utf8");
  assert.ok(kilde.includes("module.exports = handler"), "api/min-ical.js må eksportere handler for Vercel");
  assert.equal(typeof handler, "function");
  assert.equal((handler as { config?: { maxDuration: number } }).config?.maxDuration, 60);
}

{
  const { res, state } = mockRes();
  await handler({ query: {} }, res);
  assert.equal(state.statusCode, 200);
  assert.equal(state.headers["Content-Type"], "text/calendar; charset=utf-8");
  assert.equal(state.body, TOM_ICS);
}

{
  const sampleIcs =
    "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nX-WR-CALNAME:Menighetsplan\r\nBEGIN:VEVENT\r\nSUMMARY:Test\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
  const orig = globalThis.fetch;
  const origSupabaseUrl = process.env.SUPABASE_URL;
  const origSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  globalThis.fetch = async () =>
    ({
      ok: true,
      text: async () => sampleIcs,
    }) as Response;
  try {
    const { res, state } = mockRes();
    await handler({ query: { t: "mk_testtoken" } }, res);
    assert.equal(state.statusCode, 200);
    assert.equal(state.body, sampleIcs);
  } finally {
    globalThis.fetch = orig;
    if (origSupabaseUrl) process.env.SUPABASE_URL = origSupabaseUrl;
    else delete process.env.SUPABASE_URL;
    if (origSupabaseKey) process.env.SUPABASE_SERVICE_ROLE_KEY = origSupabaseKey;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
}

{
  const origSupabaseUrl = process.env.SUPABASE_URL;
  const origSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  const db = tomDb();
  db.personer = [
    {
      PersonID: "P001",
      Navn: "Test Bruker",
      Fornavn: "Test",
      Etternavn: "Bruker",
      Epost: "",
      Telefon: "",
      Aktiv: true,
      OpprettetDato: "2026-01-01",
      SistEndret: "2026-01-01",
      SikkerhetsToken: "mk_abc123def",
    },
  ];
  const orig = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/rest/v1/app_state")) {
      return {
        ok: true,
        json: async () => [{ payload: db }],
      } as Response;
    }
    throw new Error(`Uventet fetch: ${url}`);
  };
  try {
    const ics = await byggIcsForToken("mk_abc123def");
    assert.ok(ics);
    assert.ok(ics!.includes("BEGIN:VEVENT"));
    assert.ok(ics!.includes("Høstgudstjeneste"));
  } finally {
    globalThis.fetch = orig;
    if (origSupabaseUrl) process.env.SUPABASE_URL = origSupabaseUrl;
    else delete process.env.SUPABASE_URL;
    if (origSupabaseKey) process.env.SUPABASE_SERVICE_ROLE_KEY = origSupabaseKey;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
}

{
  const orig = globalThis.fetch;
  const origSupabaseUrl = process.env.SUPABASE_URL;
  const origSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  globalThis.fetch = async () =>
    ({
      ok: false,
      text: async () => "error",
    }) as Response;
  try {
    const { res, state } = mockRes();
    await handler({ query: { t: "mk_fail" } }, res);
    assert.equal(state.statusCode, 200);
    assert.equal(state.body, TOM_ICS);
  } finally {
    globalThis.fetch = orig;
    if (origSupabaseUrl) process.env.SUPABASE_URL = origSupabaseUrl;
    else delete process.env.SUPABASE_URL;
    if (origSupabaseKey) process.env.SUPABASE_SERVICE_ROLE_KEY = origSupabaseKey;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
}

{
  const orig = globalThis.fetch;
  const origSupabaseUrl = process.env.SUPABASE_URL;
  const origSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  globalThis.fetch = async () => {
    throw new Error("nettverksfeil");
  };
  try {
    const { res, state } = mockRes();
    await handler({ query: { t: "mk_nett" } }, res);
    assert.equal(state.statusCode, 200);
    assert.equal(state.body, TOM_ICS);
  } finally {
    globalThis.fetch = orig;
    if (origSupabaseUrl) process.env.SUPABASE_URL = origSupabaseUrl;
    else delete process.env.SUPABASE_URL;
    if (origSupabaseKey) process.env.SUPABASE_SERVICE_ROLE_KEY = origSupabaseKey;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
}

console.log("minIcal.test.ts: ok");
