import "./polyfill";
import assert from "node:assert/strict";
import {
  demoTokenForPerson,
  erDemoVersjon,
  finnPersonFraDemoParam,
  genererDemoTestlenke,
  genererDelbarLenke,
  tolkVisningFraUrl,
} from "../services/demo";
import { shouldWriteToRemote, getDevDataSource, loadLocalDatabase } from "../services/persistens";
import { finnPersonMedMagiskToken, hentTilgang } from "../services/tilgang";
import { tolkInnlimtLenke } from "../services/innlogging";
import { handleDbAction } from "../../server/dbCore";

assert.equal(erDemoVersjon(), false);
assert.equal(getDevDataSource(), "mock");
assert.equal(shouldWriteToRemote(), false);

const db = loadLocalDatabase();
const p007 = db.personer.find((p) => p.PersonID === "P007");
const p015 = db.personer.find((p) => p.PersonID === "P015");
assert.ok(p007 && p015);

assert.match(demoTokenForPerson("P007"), /^mk_demo007/);
assert.notEqual(demoTokenForPerson("P007"), demoTokenForPerson("P001"));

const medDemoTokens = {
  ...db,
  personer: db.personer.map((p) =>
    p.PersonID === "P007" ? { ...p, SikkerhetsToken: demoTokenForPerson("P007") } : p
  ),
};
assert.equal(
  finnPersonMedMagiskToken(medDemoTokens, demoTokenForPerson("P007"))?.PersonID,
  "P007"
);

assert.equal(
  genererDemoTestlenke("P007", "personal", "https://demo.menighetsplan.no", "/"),
  "https://demo.menighetsplan.no/?demo=P007&view=personal"
);

assert.equal(finnPersonFraDemoParam(db, "P007"), undefined, "demo-param kun utenfor demo-host");

const p015Tilgang = hentTilgang(db, "P015");
assert.equal(p015Tilgang.isLeader, false, "P015 skal være vanlig medlem i testdata");
assert.equal(tolkVisningFraUrl("personal", db, "P007"), "personal");

const sperretReplace = await handleDbAction(
  {
    supabaseUrl: "https://example.supabase.co",
    supabaseKey: "hemmelig",
    googleClientId: "x",
    appsScriptUrl: "",
    migrateFromSheets: false,
    demoMode: true,
  },
  { action: "replace", data: { personer: [{ PersonID: "P1" }] } }
);
assert.equal(sperretReplace.status, 403);
assert.match(String(sperretReplace.body.error), /Demoversjonen/);

const sperret = await handleDbAction(
  {
    supabaseUrl: "https://example.supabase.co",
    supabaseKey: "hemmelig",
    googleClientId: "x",
    appsScriptUrl: "",
    migrateFromSheets: false,
    demoMode: true,
  },
  { action: "save", data: { personer: [] } }
);
assert.equal(sperret.status, 403);
assert.match(String(sperret.body.error), /Demoversjonen/);

assert.equal(genererDelbarLenke("P007", db).includes("?t=mk_"), true, "lokalt prod-format");

console.log("demo.test.ts: ok");
