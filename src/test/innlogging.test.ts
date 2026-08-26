import "./polyfill";
import assert from "node:assert/strict";
import {
  DatabaseState,
  finnAdministratorMedEpost,
  finnAdministratorMedPersonId,
  finnPersonForGoogleSesjon,
  sikreMagnarGoogleAdminIMinne,
  finnPersonMedMagiskToken,
  genererTilfeldigSikkerhetsToken,
  rensPersondataForKlient,
  startvisningForTilgang,
  fornySikkerhetsToken,
  hentTilgang,
  visningErTillatt,
  loadLocalDatabase,
  oppdaterPersonIRegister,
  tilgangsnivaaForPerson,
  stateForRemoteSave,
} from "../services/dataService";
import { epostFraGoogleJwt, tolkInnlimtLenke, erMagiskLenkeToken, lesMagiskTokenFraUrl, lagreMagiskToken, slettMagiskToken, hentApiIdentitet } from "../services/innlogging";

const db: DatabaseState = loadLocalDatabase();
const admin = db.personer.find((p) => hentTilgang(db, p.PersonID).isAdmin);
assert.ok(admin, "mock-data skal ha en administrator");

const treff = finnAdministratorMedEpost(db, admin!.Epost);
assert.equal(treff?.PersonID, admin!.PersonID);
assert.equal(finnAdministratorMedEpost(db, "magnartotland@gmail.com")?.PersonID, admin!.PersonID);

assert.equal(finnAdministratorMedEpost(db, "ukjent@example.com"), undefined);
assert.equal(finnAdministratorMedEpost(db, ""), undefined);
assert.equal(finnAdministratorMedPersonId(db, admin!.PersonID)?.PersonID, admin!.PersonID);
assert.equal(finnAdministratorMedPersonId(db, "P999"), undefined);

const tomAktiv = {
  ...db,
  personer: db.personer.map((p) =>
    p.PersonID === admin!.PersonID ? { ...p, Aktiv: "" as unknown as boolean } : p
  ),
};
assert.equal(finnAdministratorMedEpost(tomAktiv, admin!.Epost)?.PersonID, admin!.PersonID);

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
  tolkInnlimtLenke("https://eksempel.no/app?t=mk_abc123xyz&view=admin", "/"),
  "/?t=mk_abc123xyz"
);
assert.equal(tolkInnlimtLenke("mk_tokenverdi", "/plan"), "/plan?t=mk_tokenverdi");
assert.equal(tolkInnlimtLenke("", "/"), null);
assert.equal(tolkInnlimtLenke("https://eksempel.no/app?personId=P001", "/"), null);
assert.equal(tolkInnlimtLenke("P001", "/"), null);

assert.equal(erMagiskLenkeToken("mk_abc123"), true);
assert.equal(erMagiskLenkeToken("P001"), false);
assert.equal(lesMagiskTokenFraUrl("?t=P001"), null);
assert.equal(lesMagiskTokenFraUrl("?t=mk_abc123xyz"), "mk_abc123xyz");
assert.equal(lesMagiskTokenFraUrl("?personId=P001"), null);

assert.equal(finnPersonMedMagiskToken(db, "P001"), undefined);
assert.equal(finnPersonMedMagiskToken(db, admin!.PersonID), undefined);
assert.equal(finnPersonMedMagiskToken(db, "mk_0ph37tc1uch9a6"), undefined);
assert.ok(admin!.SikkerhetsToken && !/^mk_[0-9a-z]{14}$/i.test(admin!.SikkerhetsToken));
assert.equal(finnPersonMedMagiskToken(db, admin!.SikkerhetsToken!)?.PersonID, admin!.PersonID);

const tilfeldigA = genererTilfeldigSikkerhetsToken();
const tilfeldigB = genererTilfeldigSikkerhetsToken();
assert.equal(erMagiskLenkeToken(tilfeldigA), true);
assert.notEqual(tilfeldigA, tilfeldigB);
const medLagret: DatabaseState = {
  ...db,
  personer: db.personer.map((p) =>
    p.PersonID === admin!.PersonID ? { ...p, SikkerhetsToken: "mk_aabbccddeeff00112233445566778899" } : p
  ),
};
assert.equal(
  finnPersonMedMagiskToken(medLagret, "mk_aabbccddeeff00112233445566778899")?.PersonID,
  admin!.PersonID
);

lagreMagiskToken("mk_testhash000");
assert.equal(hentApiIdentitet().token, "mk_testhash000");
slettMagiskToken();
assert.deepEqual(hentApiIdentitet(), {});

const adminTilgang = hentTilgang(db, admin!.PersonID);
assert.deepEqual(adminTilgang.views, ["personal", "leader", "admin"]);
assert.equal(startvisningForTilgang(adminTilgang), "admin");
assert.equal(visningErTillatt(adminTilgang, "admin"), true);

const leder = db.personer.find((p) => {
  const t = hentTilgang(db, p.PersonID);
  return t.isLeader && !t.isAdmin;
});
assert.ok(leder, "mock-data skal ha en tjenestegruppeleder");
assert.equal(hentTilgang(db, "P009").isAdmin, false);
assert.equal(admin!.Tilgangsnivå, "admin");
assert.equal(tilgangsnivaaForPerson(db, admin!.PersonID), "admin");

const lederUtenKontakt = rensPersondataForKlient(db, leder!.PersonID, false);
function iLedersGrupper(personId: string): boolean {
  return db.grupper.some(
    (g) =>
      g.Aktiv &&
      (g.GruppelederID === leder!.PersonID || g.NestlederID === leder!.PersonID) &&
      (personId === g.GruppelederID ||
        personId === g.NestlederID ||
        db.gruppemedlemmer.some(
          (gm) => gm.Aktiv && gm.GruppeID === g.GruppeID && gm.PersonID === personId
        ))
  );
}
const annen = lederUtenKontakt.personer.find(
  (p) => p.PersonID !== leder!.PersonID && p.Aktiv && !iLedersGrupper(p.PersonID)
);
assert.ok(annen);
assert.equal(annen!.Epost, "");
assert.equal(annen!.Telefon, "");
assert.equal(annen!.SikkerhetsToken, "");
const iLag = db.personer.find(
  (p) => p.PersonID !== leder!.PersonID && iLedersGrupper(p.PersonID) && p.Epost
);
if (iLag) {
  const rensetLag = lederUtenKontakt.personer.find((p) => p.PersonID === iLag.PersonID);
  assert.equal(rensetLag?.Epost, iLag.Epost);
}
const meg = lederUtenKontakt.personer.find((p) => p.PersonID === leder!.PersonID);
assert.equal(meg?.Epost, leder!.Epost);
assert.equal(rensPersondataForKlient(db, admin!.PersonID, true).personer[0].Epost, db.personer[0].Epost);
const lederTilgang = hentTilgang(db, leder!.PersonID);
assert.deepEqual(lederTilgang.views, ["personal", "leader"]);
assert.equal(startvisningForTilgang(lederTilgang), "leader");
assert.equal(visningErTillatt(lederTilgang, "admin"), false);

const medlem = db.personer.find((p) => {
  const t = hentTilgang(db, p.PersonID);
  return !t.isLeader && !t.isAdmin;
});
if (medlem) {
  const medlemTilgang = hentTilgang(db, medlem.PersonID);
  assert.deepEqual(medlemTilgang.views, ["personal"]);
  assert.equal(visningErTillatt(medlemTilgang, "leader"), false);
}

const gammelToken = admin!.SikkerhetsToken;
const fornyet = fornySikkerhetsToken(db, admin!.PersonID);
const nyAdmin = fornyet.personer.find((p) => p.PersonID === admin!.PersonID);
assert.ok(nyAdmin?.SikkerhetsToken);
assert.notEqual(nyAdmin!.SikkerhetsToken, gammelToken);
assert.equal(finnPersonMedMagiskToken(fornyet, gammelToken!), undefined);
assert.equal(finnPersonMedMagiskToken(fornyet, nyAdmin!.SikkerhetsToken!)?.PersonID, admin!.PersonID);

const redigert = oppdaterPersonIRegister(db, admin!.PersonID, {
  Navn: "Magnar Testesen",
  Epost: "magnar.test@example.com",
  Telefon: "11111111",
  Aktiv: true,
});
const redigertPerson = redigert.personer.find((p) => p.PersonID === admin!.PersonID);
assert.equal(redigertPerson?.Navn, "Magnar Testesen");
assert.equal(redigertPerson?.Fornavn, "Magnar");
assert.equal(redigertPerson?.Etternavn, "Testesen");
assert.equal(redigertPerson?.Epost, "magnar.test@example.com");
assert.equal(redigertPerson?.Telefon, "11111111");
assert.equal(finnAdministratorMedEpost(redigert, "magnar.test@example.com")?.PersonID, admin!.PersonID);

const utenAdminNivaa = {
  ...db,
  personer: db.personer.map((p) =>
    p.PersonID === admin!.PersonID ? { ...p, Tilgangsnivå: "bruker" as const } : p
  ),
};
assert.equal(finnAdministratorMedEpost(utenAdminNivaa, admin!.Epost), undefined);
assert.equal(
  finnPersonForGoogleSesjon(utenAdminNivaa, admin!.Epost)?.PersonID,
  admin!.PersonID
);
const tomtRegister = { ...db, personer: [] as typeof db.personer, personroller: [] };
const sikret = sikreMagnarGoogleAdminIMinne(tomtRegister, "magnar.totland@gmail.com");
assert.equal(sikret.person.Fornavn, "Magnar");
assert.equal(sikret.person.Epost, "magnar.totland@gmail.com");
assert.equal(hentTilgang(sikret.db, sikret.person.PersonID).isAdmin, true);

const utenEpost: DatabaseState = {
  ...db,
  personer: db.personer.map((p) => ({ ...p, Epost: "", Tilgangsnivå: undefined })),
};
const lagretUtenAdmin = stateForRemoteSave(utenEpost, false);
assert.equal("personer" in lagretUtenAdmin, false);
const lagretSomAdmin = stateForRemoteSave(utenEpost, true);
assert.equal(lagretSomAdmin.personer.length, utenEpost.personer.length);

const magnarUtenNivaa = {
  ...db,
  personer: db.personer.map((p) =>
    p.PersonID === admin!.PersonID ? { ...p, Tilgangsnivå: undefined, Epost: "" } : p
  ),
};
assert.notEqual(tilgangsnivaaForPerson(magnarUtenNivaa, admin!.PersonID), "admin");

console.log("innlogging.test.ts: alle tester ok");
