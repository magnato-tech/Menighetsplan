import { Person, Rolle } from "../types/database";
import type { DatabaseState } from "../types/database";
import { erMagiskLenkeToken, hentApiIdentitet } from "./innlogging";

export type Tilgangsnivå = NonNullable<Person["Tilgangsnivå"]>;

/**
 * Tilfeldig magisk-lenke-token. Kan ikke regnes ut fra PersonID eller navn.
 */
export function genererTilfeldigSikkerhetsToken(): string {
  const bytes = new Uint8Array(16);
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `mk_${hex}`;
}

/** Gammel hash-lenke (14 tegn etter mk_). Skal ikke brukes som innlogging. */
export function erGammelHashLenke(token: string): boolean {
  return /^mk_[0-9a-z]{14}$/i.test(String(token || "").trim());
}

function harGyldigLagretToken(token: string | undefined): boolean {
  const t = String(token || "").trim();
  return erMagiskLenkeToken(t) && !erGammelHashLenke(t);
}

export function sikreSikkerhetsTokens(personer: Person[]): Person[] {
  if (!Array.isArray(personer)) return [];
  return personer.map((p) => {
    if (harGyldigLagretToken(p.SikkerhetsToken)) return p;
    return {
      ...p,
      SikkerhetsToken: genererTilfeldigSikkerhetsToken(),
    };
  });
}

/** Ny tilfeldig personlenke. Den gamle slutter å virke. */
export function fornySikkerhetsToken(db: DatabaseState, personId: string): DatabaseState {
  return {
    ...db,
    personer: db.personer.map((p) =>
      p.PersonID === personId
        ? { ...p, SikkerhetsToken: genererTilfeldigSikkerhetsToken() }
        : p
    ),
  };
}

/**
 * Finner person via magisk lenke-token (mk_…). PersonID og gamle hash-lenker er ikke innlogging.
 */
export function finnPersonMedMagiskToken(db: DatabaseState, token: string): Person | undefined {
  if (!token || !db?.personer) return undefined;
  const clean = token.trim();
  if (!erMagiskLenkeToken(clean)) return undefined;
  return db.personer.find((p) => String(p.SikkerhetsToken || "").trim() === clean);
}

/**
 * Fjerner andres innloggingsnøkler og kontaktfelt. Admin får uendret sett.
 */
function personIdsGruppelederKanSeKontaktFor(
  db: DatabaseState,
  personId: string
): Set<string> {
  const ids = new Set<string>([personId]);
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

export function rensPersondataForKlient(
  db: DatabaseState,
  personId: string | undefined,
  isAdmin: boolean
): DatabaseState {
  if (isAdmin) return db;
  const synligKontakt = personId
    ? personIdsGruppelederKanSeKontaktFor(db, personId)
    : new Set<string>();
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
        Fødselsår: undefined,
        Fødselsdato: "",
        Kjønn: "",
        Notat: "",
      };
    }),
  };
}

export function rensLastetPersondata(db: DatabaseState): DatabaseState {
  const ident = hentApiIdentitet();
  if (ident.googleCredential) return db;
  const token = ident.token;
  if (!token) return db;
  const meg = finnPersonMedMagiskToken(db, token);
  if (!meg) return db;
  // Kun eksplisitt Tilgangsnivå i arket — ikke navne-fallback (ellers ser Magnar ut som admin med renset state).
  if (lesTilgangsnivaa(meg.Tilgangsnivå) === "admin") return db;
  return rensPersondataForKlient(db, meg.PersonID, false);
}

export type AppView = "personal" | "leader" | "admin";

export interface PersonTilgang {
  isLeader: boolean;
  isAdmin: boolean;
  views: AppView[];
}

function erAktivRad(verdi: unknown): boolean {
  return verdi !== false && verdi !== "FALSE" && verdi !== "false";
}

export const MAGNAR_GOOGLE_EPOST = "magnar.totland@gmail.com";

function serUtSomMagnar(person: Person): boolean {
  const navn = String(person.Navn || "").trim().toLowerCase();
  const fornavn = String(person.Fornavn || "").trim().toLowerCase();
  return fornavn === "magnar" || navn === "magnar" || navn.startsWith("magnar ");
}

export function lesTilgangsnivaa(verdi: unknown): Tilgangsnivå | "" {
  const v = String(verdi || "").trim().toLowerCase();
  if (v === "admin" || v === "administrator") return "admin";
  if (v === "gruppeleder") return "gruppeleder";
  if (v === "bruker" || v === "medlem") return "bruker";
  return "";
}

export function lederPersonIder(db: DatabaseState): Set<string> {
  const ids = new Set<string>();
  for (const g of db.grupper || []) {
    if (!erAktivRad(g.Aktiv)) continue;
    const leder = String(g.GruppelederID || "").trim();
    const nest = String(g.NestlederID || "").trim();
    if (leder) ids.add(leder);
    if (nest) ids.add(nest);
  }
  return ids;
}

/** Lagret verdi, eller utledet når cellen er tom (før arket er fylt). */
export function tilgangsnivaaForPerson(db: DatabaseState, personID: string): Tilgangsnivå {
  const person = db.personer.find((p) => p.PersonID === personID);
  if (!person || !erAktivRad(person.Aktiv)) return "bruker";
  const lagret = lesTilgangsnivaa(person.Tilgangsnivå);
  if (lagret) return lagret;
  if (eposterMatcher(person.Epost, MAGNAR_GOOGLE_EPOST)) return "admin";
  if (lederPersonIder(db).has(person.PersonID)) return "gruppeleder";
  return "bruker";
}

export function fyllManglendeTilgangsnivaa(db: DatabaseState): DatabaseState {
  const ledere = lederPersonIder(db);
  let endret = false;
  const personer = db.personer.map((p) => {
    if (lesTilgangsnivaa(p.Tilgangsnivå)) return p;
    let neste: Tilgangsnivå = "bruker";
    if (eposterMatcher(p.Epost, MAGNAR_GOOGLE_EPOST)) neste = "admin";
    else if (ledere.has(p.PersonID)) neste = "gruppeleder";
    endret = true;
    return { ...p, Tilgangsnivå: neste };
  });
  return endret ? { ...db, personer } : db;
}

/** Oppgrader/nedgrader bruker↔gruppeleder etter Grupper. Rører ikke admin. */
export function synkTilgangsnivaaEtterGruppeledere(db: DatabaseState): DatabaseState {
  const ledere = lederPersonIder(db);
  return {
    ...db,
    personer: db.personer.map((p) => {
      const nivå = lesTilgangsnivaa(p.Tilgangsnivå) || tilgangsnivaaForPerson(db, p.PersonID);
      if (nivå === "admin") return { ...p, Tilgangsnivå: "admin" };
      const neste: Tilgangsnivå = ledere.has(p.PersonID) ? "gruppeleder" : "bruker";
      if (nivå === neste && p.Tilgangsnivå === neste) return p;
      return { ...p, Tilgangsnivå: neste };
    }),
  };
}

export function erAdministrator(db: DatabaseState, personID: string): boolean {
  const person = db.personer.find((p) => p.PersonID === personID);
  if (!person || !erAktivRad(person.Aktiv)) return false;
  return tilgangsnivaaForPerson(db, personID) === "admin";
}

/** Tilgang for aktiv person: vanlige brukere, gruppeledere og administrator. */
export function hentTilgang(db: DatabaseState, personID: string): PersonTilgang {
  const nivå = tilgangsnivaaForPerson(db, personID);
  const isAdmin = nivå === "admin";
  const isLeader = nivå === "gruppeleder" || isAdmin;
  const views: AppView[] = ["personal"];
  if (isLeader) views.push("leader");
  if (isAdmin) views.push("admin");
  return { isLeader, isAdmin, views };
}

export function visningErTillatt(tilgang: PersonTilgang, view: AppView): boolean {
  return tilgang.views.indexOf(view) >= 0;
}

/** Første visning etter innlogging. Faner ellers styres av tilgang. */
export function startvisningForTilgang(tilgang: PersonTilgang): AppView {
  if (tilgang.isAdmin) return "admin";
  if (tilgang.isLeader) return "leader";
  return "personal";
}

/** Roller personen kan melde seg på: aktive personroller, pluss tildelte roller uten medlemskap. */
export function hentVisningsRoller(db: DatabaseState, personId: string): Rolle[] {
  const personensRolleIds = db.personroller
    .filter((pr) => pr.PersonID === personId && pr.Aktiv)
    .map((pr) => pr.RolleID);
  const visningsRoller: Rolle[] = [];
  const sett = new Set<string>();
  for (const rolle of db.roller) {
    if (!personensRolleIds.includes(rolle.RolleID) || sett.has(rolle.RolleID)) continue;
    visningsRoller.push(rolle);
    sett.add(rolle.RolleID);
  }
  for (const t of db.tildelinger) {
    if (t.PersonID !== personId || sett.has(t.RolleID)) continue;
    const rolle = db.roller.find((r) => r.RolleID === t.RolleID);
    if (!rolle) continue;
    visningsRoller.push(rolle);
    sett.add(rolle.RolleID);
  }
  return visningsRoller;
}

function normaliserEpost(epost: string): string {
  return String(epost || "").trim().toLowerCase();
}

function normaliserEpostForMatch(epost: string): string {
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

function eposterMatcher(a: string, b: string): boolean {
  const na = normaliserEpostForMatch(a);
  const nb = normaliserEpostForMatch(b);
  return Boolean(na && nb && na === nb);
}

/** Person som matcher Google-sesjonen — uten å kreve at admin-rollen allerede ligger i arket. */
export function finnPersonForGoogleSesjon(
  db: DatabaseState,
  epost: string,
  personId?: string | null
): Person | undefined {
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
  return undefined;
}

/** Sørg for at Magnars Google-konto kan åpne appen selv om arket mangler e-post eller admin-rad. */
export function sikreMagnarGoogleAdminIMinne(
  db: DatabaseState,
  epost: string
): { db: DatabaseState; person: Person } {
  const now = new Date().toISOString().split("T")[0];
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
      Tilgangsnivå: "admin",
      Aktiv: true,
      OpprettetDato: now,
      SistEndret: now,
    };
    neste = { ...neste, personer: [...neste.personer, person] };
  } else {
    person = {
      ...person,
      Epost: MAGNAR_GOOGLE_EPOST,
      Tilgangsnivå: "admin",
      SistEndret: now,
    };
    neste = {
      ...neste,
      personer: neste.personer.map((p) => (p.PersonID === person!.PersonID ? person! : p)),
    };
  }
  return { db: neste, person };
}

/** Administrator som matcher Google-epost i personregisteret. */
export function finnAdministratorMedEpost(
  db: DatabaseState,
  epost: string
): Person | undefined {
  const needle = normaliserEpost(epost);
  if (!needle) return undefined;
  const person = db.personer.find(
    (p) => erAktivRad(p.Aktiv) && eposterMatcher(p.Epost, needle)
  );
  if (!person) return undefined;
  return hentTilgang(db, person.PersonID).isAdmin ? person : undefined;
}

export function finnAdministratorMedPersonId(
  db: DatabaseState,
  personId: string | null | undefined
): Person | undefined {
  const id = String(personId || "").trim();
  if (!id) return undefined;
  const person = db.personer.find((p) => String(p.PersonID) === id);
  if (!person || !erAktivRad(person.Aktiv)) return undefined;
  return hentTilgang(db, person.PersonID).isAdmin ? person : undefined;
}

/**
 * Genererer en personlig, ugjettelig direktelenke (Magic Link)
 */
export function genererPersonligLenke(
  personIDOrObj: string | Person,
  db?: DatabaseState
): string {
  const origin = window.location.origin;
  const path = window.location.pathname;
  const params = new URLSearchParams();

  let token = "";

  if (typeof personIDOrObj === "string") {
    if (db) {
      const person = db.personer.find((p) => p.PersonID === personIDOrObj);
      if (person) {
        if (!harGyldigLagretToken(person.SikkerhetsToken)) {
          person.SikkerhetsToken = genererTilfeldigSikkerhetsToken();
        }
        token = person.SikkerhetsToken;
      }
    }
    if (!token) {
      token = genererTilfeldigSikkerhetsToken();
    }
  } else if (personIDOrObj && typeof personIDOrObj === "object") {
    if (!harGyldigLagretToken(personIDOrObj.SikkerhetsToken)) {
      personIDOrObj.SikkerhetsToken = genererTilfeldigSikkerhetsToken();
    }
    token = personIDOrObj.SikkerhetsToken;
  }

  params.set("t", token);

  return `${origin}${path}?${params.toString()}`;
}
