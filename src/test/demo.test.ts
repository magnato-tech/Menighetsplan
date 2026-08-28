import "./polyfill";
import assert from "node:assert/strict";
import { erDemoVersjon } from "../services/demo";
import { shouldWriteToRemote, getDevDataSource } from "../services/persistens";
import { handleDbAction } from "../../server/dbCore";

assert.equal(erDemoVersjon(), false);
assert.equal(getDevDataSource(), "mock");
assert.equal(shouldWriteToRemote(), false);

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

console.log("demo.test.ts: ok");
