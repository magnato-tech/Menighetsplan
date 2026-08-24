import { Person } from "../types/database";
import type { DatabaseState } from "../types/database";
import { erMagiskLenkeToken, hentApiIdentitet } from "./innlogging";
import { finnGrupperForGruppeleder } from "./grupper";

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
  if (!erMagiskLenkeToken(clean) || erGammelHashLenke(clean)) return undefined;
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
  if (hentTilgang(db, meg.PersonID).isAdmin) return db;
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

export function erAdministrator(db: DatabaseState, personID: string): boolean {
  const person = db.personer.find((p) => p.PersonID === personID);
  if (!person || !erAktivRad(person.Aktiv)) return false;

  const adminRolle = (db.roller || []).find(
    (r) =>
      erAktivRad(r.Aktiv) && String(r.Rollenavn || "").trim().toLowerCase() === "administrator"
  );
  if (!adminRolle) return false;
  return (db.personroller || []).some(
    (pr) => erAktivRad(pr.Aktiv) && pr.PersonID === personID && pr.RolleID === adminRolle.RolleID
  );
}

/** Tilgang for aktiv person: vanlige brukere, gruppeledere og administrator. */
export function hentTilgang(db: DatabaseState, personID: string): PersonTilgang {
  const isAdmin = erAdministrator(db, personID);
  const isLeader = finnGrupperForGruppeleder(db, personID).length > 0;
  const views: AppView[] = ["personal"];
  if (isLeader || isAdmin) views.push("leader");
  if (isAdmin) views.push("admin");
  return { isLeader, isAdmin, views };
}

export function visningErTillatt(tilgang: PersonTilgang, view: AppView): boolean {
  return tilgang.views.indexOf(view) >= 0;
}

/** Første visning etter innlogging. Faner ellers styres av tilgang. */
export function startvisningForTilgang(tilgang: PersonTilgang): AppView {
  if (tilgang.isAdmin) return "admin";
  return "personal";
}

function normaliserEpost(epost: string): string {
  return String(epost || "").trim().toLowerCase();
}

/** Administrator som matcher Google-epost i personregisteret. */
export function finnAdministratorMedEpost(
  db: DatabaseState,
  epost: string
): Person | undefined {
  const needle = normaliserEpost(epost);
  if (!needle) return undefined;
  const person = db.personer.find(
    (p) => erAktivRad(p.Aktiv) && normaliserEpost(p.Epost) === needle
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
  const person = db.personer.find((p) => p.PersonID === id);
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
