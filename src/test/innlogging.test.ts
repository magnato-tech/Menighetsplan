import "./polyfill";
import assert from "node:assert/strict";
import {
  DatabaseState,
  finnAdministratorMedEpost,
  hentTilgang,
  loadLocalDatabase,
} from "../services/dataService";
import { epostFraGoogleJwt, tolkInnlimtLenke, erMagiskLenkeToken, lesMagiskTokenFraUrl, lagreMagiskToken, slettMagiskToken, hentApiIdentitet } from "../services/innlogging";

const db: DatabaseState = loadLocalDatabase();
const admin = db.personer.find((p) => hentTilgang(db, p.PersonID).isAdmin);
assert.ok(admin, "mock-data skal ha en administrator");

const treff = finnAdministratorMedEpost(db, admin!.Epost);
assert.equal(treff?.PersonID, admin!.PersonID);

assert.equal(finnAdministratorMedEpost(db, "ukjent@example.com"), undefined);
assert.equal(finnAdministratorMedEpost(db, ""), undefined);

const ikkeAdmin = db.personer.find((p) => !hentTilgang(db, p.PersonID).isAdmin && p.Epost);
if (ikkeAdmin) {
  assert.equal(finnAdministratorMedEpost(db, ikkeAdmin.Epost), undefined);
}

function jwtMed(payload: object): string {
  const json = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `hdr.${json}.sig`;
}

assert.equal(epostFraGoogleJwt(jwtMed({ email: "Magnar@Example.com", email_verified: true })), "magnar@example.com");
assert.equal(epostFraGoogleJwt("ugyldig"), null);
assert.equal(epostFraGoogleJwt(jwtMed({ email: "x@y.z", email_verified: false })), null);

assert.equal(
  tolkInnlimtLenke("https://eksempel.no/app?t=abc123&view=admin", "/"),
  "/?t=abc123&view=admin"
);
assert.equal(tolkInnlimtLenke("mk_tokenverdi", "/plan"), "/plan?t=mk_tokenverdi");
assert.equal(tolkInnlimtLenke("", "/"), null);

assert.equal(erMagiskLenkeToken("mk_abc123"), true);
assert.equal(erMagiskLenkeToken("P001"), false);
assert.equal(lesMagiskTokenFraUrl("?t=P001"), null);
assert.equal(lesMagiskTokenFraUrl("?t=mk_abc123xyz"), "mk_abc123xyz");

lagreMagiskToken("mk_testhash000");
assert.equal(hentApiIdentitet().token, "mk_testhash000");
slettMagiskToken();
assert.deepEqual(hentApiIdentitet(), {});

console.log("innlogging.test.ts: alle tester ok");
