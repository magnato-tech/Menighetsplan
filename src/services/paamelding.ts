import type { DatabaseState, Gudstjeneste, Rolle } from "../types/database";
import {
  erRolleHardFull,
  getEffektivtBehov,
  getMaksAntall,
  hentSvarStatus,
  summerBemanning,
  svarPaaTildeling,
  velgDatoForPerson,
} from "./bemanning";
import { erTjenestegruppe } from "./grupper";
import {
  erMedITjenestegruppe,
  erMedlemAvGruppe,
  hentPåmeldingsRoller,
  tjenesteRoller,
} from "./interesse";

export type PåmeldingsStatus = "ledig" | "min-venter" | "min-bekreftet" | "full" | "stengt";

export type PåmeldingsPerson = {
  personId: string;
  navn: string;
  status: "Bekreftet" | "Venter" | "Avvist";
  forfallMelding?: string;
  forfallDato?: string;
  erSystemmelding?: boolean;
};

export type PåmeldingsRad = {
  gudstjeneste: Gudstjeneste;
  rolle: Rolle;
  behov: number;
  maks: number | null;
  ledige: number;
  bekreftetAntall: number;
  venterAntall: number;
  forfallAntall: number;
  aktiveAntall: number;
  hardFull: boolean;
  personerPå: PåmeldingsPerson[];
  status: PåmeldingsStatus;
  harHuketRolle: boolean;
  /** Tildeling for innlogget person på denne søndagen, når relevant. */
  minTildelingId?: string;
};

export type PersonligSondag = {
  gudstjeneste: Gudstjeneste;
  roller: PåmeldingsRad[];
};

export type GruppeRolleStatus = {
  rolle: Rolle;
  gruppeId: string;
  gruppenavn: string;
  behov: number;
  bekreftet: number;
  venter: number;
  forfall: number;
  ledige: number;
  personerPå: PåmeldingsPerson[];
};

export type GruppeSondagStatus = {
  gruppeId: string;
  gruppenavn: string;
  roller: GruppeRolleStatus[];
};

export type ForesporselRad = {
  gudstjenesteId: string;
  gudstjenesteDato: string;
  gudstjenesteTid: string;
  gudstjenesteTema: string;
  rolleId: string;
  rollenavn: string;
  gruppeId: string;
  gruppenavn: string;
  tildelingId: string;
};

function iDagIso(): string {
  return new Date().toISOString().split("T")[0];
}

function visningsnavnForPerson(
  db: DatabaseState,
  personId: string,
  eksternNavn?: string
): string {
  if (eksternNavn) return eksternNavn;
  const p = db.personer.find((pers) => pers.PersonID === personId);
  return p?.Fornavn || p?.Navn || personId;
}

function mapTildelingTilPerson(
  db: DatabaseState,
  t: { PersonID: string; TildelingID: string; EksternNavn?: string }
): PåmeldingsPerson {
  const rawStatus = hentSvarStatus(db, t.TildelingID);
  const status: PåmeldingsPerson["status"] =
    rawStatus === "Bekreftet"
      ? "Bekreftet"
      : rawStatus === "Avvist"
        ? "Avvist"
        : "Venter";
  const forfallMelding = (db.gruppeMeldinger || []).find(
    (m) => m.TildelingID === t.TildelingID && m.HendelseType === "forfall"
  );
  return {
    personId: t.PersonID,
    navn: visningsnavnForPerson(db, t.PersonID, t.EksternNavn),
    status,
    forfallMelding: forfallMelding?.Tekst,
    forfallDato: forfallMelding?.OpprettetDato,
    erSystemmelding: forfallMelding?.Kilde === "system",
  };
}

function tjenesteGruppeIdsForPerson(db: DatabaseState, personId: string): Set<string> {
  const ids = new Set<string>();
  for (const g of db.grupper || []) {
    if (!g.Aktiv || !erTjenestegruppe(db, g)) continue;
    if (erMedlemAvGruppe(db, personId, g.GruppeID)) ids.add(g.GruppeID);
  }
  return ids;
}

/** Roller personen ser på Min side: hukede + kommende tildelinger. */
export function hentMineOppgaveRoller(db: DatabaseState, personId: string): Rolle[] {
  const iDag = iDagIso();
  const sett = new Map<string, Rolle>();
  for (const rolle of hentPåmeldingsRoller(db, personId)) {
    sett.set(rolle.RolleID, rolle);
  }
  for (const t of db.tildelinger || []) {
    if (t.PersonID !== personId) continue;
    const gud = db.gudstjenester.find((g) => g.GudstjenesteID === t.GudstjenesteID);
    if (!gud || gud.Dato < iDag) continue;
    const rolle = db.roller.find((r) => r.RolleID === t.RolleID && r.Aktiv);
    if (!rolle) continue;
    sett.set(rolle.RolleID, rolle);
  }
  return Array.from(sett.values()).sort((a, b) =>
    a.Rollenavn.localeCompare(b.Rollenavn, "nb")
  );
}

export function hentKommendeForesporsler(
  db: DatabaseState,
  personId: string
): ForesporselRad[] {
  const iDag = iDagIso();
  const rader: ForesporselRad[] = [];
  for (const t of db.tildelinger || []) {
    if (t.PersonID !== personId) continue;
    if (hentSvarStatus(db, t.TildelingID) !== "Venter") continue;
    const gud = db.gudstjenester.find((g) => g.GudstjenesteID === t.GudstjenesteID);
    if (!gud || gud.Dato < iDag) continue;
    const rolle = db.roller.find((r) => r.RolleID === t.RolleID);
    if (!rolle) continue;
    const gruppe = rolle.GruppeID
      ? db.grupper.find((g) => g.GruppeID === rolle.GruppeID)
      : undefined;
    rader.push({
      gudstjenesteId: gud.GudstjenesteID,
      gudstjenesteDato: gud.Dato,
      gudstjenesteTid: gud.Tid,
      gudstjenesteTema: gud.Tema || "",
      rolleId: rolle.RolleID,
      rollenavn: rolle.Rollenavn,
      gruppeId: gruppe?.GruppeID || "",
      gruppenavn: gruppe?.Gruppenavn || "",
      tildelingId: t.TildelingID,
    });
  }
  return rader.sort((a, b) =>
    `${a.gudstjenesteDato} ${a.gudstjenesteTid}`.localeCompare(
      `${b.gudstjenesteDato} ${b.gudstjenesteTid}`
    )
  );
}

export function byggGruppeSondagStatus(
  db: DatabaseState,
  personId: string,
  gudstjenesteId: string
): GruppeSondagStatus[] {
  if (!erMedITjenestegruppe(db, personId)) return [];
  const gruppeIds = tjenesteGruppeIdsForPerson(db, personId);
  if (gruppeIds.size === 0) return [];

  const resultat: GruppeSondagStatus[] = [];
  for (const gruppeId of gruppeIds) {
    const gruppe = db.grupper.find((g) => g.GruppeID === gruppeId);
    if (!gruppe) continue;
    const gruppeRoller = tjenesteRoller(db).filter((r) => r.GruppeID === gruppeId);
    if (gruppeRoller.length === 0) continue;

    const roller: GruppeRolleStatus[] = [];
    for (const rolle of gruppeRoller) {
      const tildelinger = db.tildelinger.filter(
        (t) => t.GudstjenesteID === gudstjenesteId && t.RolleID === rolle.RolleID
      );
      const personerPå = tildelinger.map((t) => mapTildelingTilPerson(db, t));
      const tall = summerBemanning(db, gudstjenesteId, [rolle]);
      const harNoe =
        tall.behov > 0 ||
        tall.bekreftet > 0 ||
        tall.venter > 0 ||
        tall.forfall > 0;
      if (!harNoe) continue;
      roller.push({
        rolle,
        gruppeId,
        gruppenavn: gruppe.Gruppenavn,
        behov: tall.behov,
        bekreftet: tall.bekreftet,
        venter: tall.venter,
        forfall: tall.forfall,
        ledige: tall.ledige,
        personerPå,
      });
    }
    if (roller.length === 0) continue;
    resultat.push({
      gruppeId,
      gruppenavn: gruppe.Gruppenavn,
      roller,
    });
  }
  return resultat.sort((a, b) => a.gruppenavn.localeCompare(b.gruppenavn, "nb"));
}

export function svarPaForesporsel(
  db: DatabaseState,
  personId: string,
  gudstjenesteId: string,
  rolleId: string,
  svar: "Bekreftet" | "Avvist",
  kommentar?: string,
  tildelingId?: string
): DatabaseState | undefined {
  const tildeling = tildelingId
    ? db.tildelinger.find((t) => t.TildelingID === tildelingId && t.PersonID === personId)
    : db.tildelinger.find(
        (t) =>
          t.GudstjenesteID === gudstjenesteId &&
          t.RolleID === rolleId &&
          t.PersonID === personId
      );
  if (!tildeling) return undefined;
  const melding =
    svar === "Bekreftet"
      ? kommentar || "Bekreftet via Min side"
      : kommentar || "Avslått via Min side";
  return svarPaaTildeling(db, tildeling.TildelingID, personId, svar, melding, {
    meldingTilGruppe: svar === "Avvist" ? kommentar?.trim() || undefined : undefined,
  });
}

export function meldForfall(
  db: DatabaseState,
  personId: string,
  gudstjenesteId: string,
  rolleId: string,
  meldingTilGruppe?: string
): DatabaseState | undefined {
  const tildeling = db.tildelinger.find(
    (t) =>
      t.GudstjenesteID === gudstjenesteId &&
      t.RolleID === rolleId &&
      t.PersonID === personId
  );
  if (!tildeling) return undefined;

  return svarPaaTildeling(db, tildeling.TildelingID, personId, "Avvist", "Meldt forfall", {
    meldingTilGruppe,
  });
}

export function byggPåmeldingsrader(
  db: DatabaseState,
  personId: string,
  rolle: Rolle
): Omit<PåmeldingsRad, "rolle">[] {
  const hukedeIds = new Set(hentPåmeldingsRoller(db, personId).map((r) => r.RolleID));
  const harHuketRolle = hukedeIds.has(rolle.RolleID);

  return db.gudstjenester
    .filter((g) => g.Dato >= iDagIso())
    .slice()
    .sort((a, b) => `${a.Dato} ${a.Tid}`.localeCompare(`${b.Dato} ${b.Tid}`))
    .map((g) => {
      const tildelinger = db.tildelinger.filter(
        (t) => t.GudstjenesteID === g.GudstjenesteID && t.RolleID === rolle.RolleID
      );
      const personerPå = tildelinger.map((t) => mapTildelingTilPerson(db, t));

      const behov = getEffektivtBehov(db, g.GudstjenesteID, rolle);
      const maks = getMaksAntall(rolle);
      const bekreftetAntall = personerPå.filter((p) => p.status === "Bekreftet").length;
      const venterAntall = personerPå.filter((p) => p.status === "Venter").length;
      const forfallAntall = personerPå.filter((p) => p.status === "Avvist").length;
      const ledige = Math.max(0, behov - bekreftetAntall);
      const hardFull = erRolleHardFull(db, g.GudstjenesteID, rolle);

      const minTildeling = tildelinger.find((t) => t.PersonID === personId);
      const minStatus = minTildeling
        ? hentSvarStatus(db, minTildeling.TildelingID)
        : null;
      const minPerson = minTildeling
        ? personerPå.find((p) => p.personId === personId)
        : undefined;

      const minAvvist = minStatus === "Avvist";

      let status: PåmeldingsStatus =
        hardFull && !minPerson ? "stengt" : ledige > 0 || minAvvist ? "ledig" : "full";
      if (minPerson?.status === "Bekreftet") status = "min-bekreftet";
      else if (minPerson?.status === "Venter") status = "min-venter";

      return {
        gudstjeneste: g,
        behov,
        maks,
        ledige,
        bekreftetAntall,
        venterAntall,
        forfallAntall,
        aktiveAntall: personerPå.filter((p) => p.status !== "Avvist").length,
        hardFull,
        personerPå,
        status,
        harHuketRolle,
        minTildelingId: minTildeling?.TildelingID,
      };
    });
}

export function byggPersonligSondagsliste(
  db: DatabaseState,
  personId: string,
  rolleFilterId: string | null = null
): PersonligSondag[] {
  const roller = hentMineOppgaveRoller(db, personId).filter(
    (r) => !rolleFilterId || r.RolleID === rolleFilterId
  );

  const perGud = new Map<string, PersonligSondag>();

  for (const rolle of roller) {
    for (const rad of byggPåmeldingsrader(db, personId, rolle)) {
      const minTildeling = db.tildelinger.some(
        (t) =>
          t.GudstjenesteID === rad.gudstjeneste.GudstjenesteID &&
          t.RolleID === rolle.RolleID &&
          t.PersonID === personId
      );
      const minInvolvert =
        minTildeling ||
        rad.status === "min-bekreftet" ||
        rad.status === "min-venter" ||
        rad.status === "ledig" ||
        rad.status === "full";
      if (!minInvolvert && !rad.harHuketRolle) continue;

      const id = rad.gudstjeneste.GudstjenesteID;
      const eksisterende = perGud.get(id);
      const fullRad: PåmeldingsRad = { ...rad, rolle };
      if (eksisterende) {
        eksisterende.roller.push(fullRad);
      } else {
        perGud.set(id, { gudstjeneste: rad.gudstjeneste, roller: [fullRad] });
      }
    }
  }

  return Array.from(perGud.values()).sort((a, b) =>
    `${a.gudstjeneste.Dato} ${a.gudstjeneste.Tid}`.localeCompare(
      `${b.gudstjeneste.Dato} ${b.gudstjeneste.Tid}`
    )
  );
}

export type PersonligMaaned = {
  nokkel: string;
  etikett: string;
  aar: number;
  maaned: number;
  sondager: PersonligSondag[];
  harLedige: boolean;
};

export type SemesterFremdrift = {
  besvart: number;
  totalt: number;
  tekst: string;
};

export const SEMESTER_HORISONT_MND = 6;

export function maanedNokkelFraDato(dato: string): string {
  return dato.slice(0, 7);
}

function maanedEtikett(aar: number, maaned: number): string {
  const d = new Date(aar, maaned - 1, 1);
  const etikett = d.toLocaleDateString("nb-NO", { month: "short" }).replace(".", "");
  return etikett.charAt(0).toUpperCase() + etikett.slice(1);
}

function tomPersonligMaaned(nokkel: string): PersonligMaaned {
  const [aarStr, maanedStr] = nokkel.split("-");
  const aar = Number(aarStr);
  const maaned = Number(maanedStr);
  return {
    nokkel,
    etikett: maanedEtikett(aar, maaned),
    aar,
    maaned,
    sondager: [],
    harLedige: false,
  };
}

export function byggMaanedshorisont(fraNokkel: string, antall = SEMESTER_HORISONT_MND): string[] {
  const [aarStr, maanedStr] = fraNokkel.split("-");
  let aar = Number(aarStr);
  let maaned = Number(maanedStr);
  const result: string[] = [];
  for (let i = 0; i < antall; i++) {
    result.push(`${aar}-${String(maaned).padStart(2, "0")}`);
    maaned += 1;
    if (maaned > 12) {
      maaned = 1;
      aar += 1;
    }
  }
  return result;
}

export function startMaanedNokkelForHorisont(
  sondager: PersonligSondag[],
  iDag = iDagIso()
): string {
  const denne = maanedNokkelFraDato(iDag);
  if (sondager.length === 0) return denne;
  const forste = maanedNokkelFraDato(sondager[0].gudstjeneste.Dato);
  return denne.localeCompare(forste) > 0 ? denne : forste;
}

export function grupperSondagerPerMaaned(sondager: PersonligSondag[]): PersonligMaaned[] {
  const perMaaned = new Map<string, PersonligSondag[]>();

  for (const sondag of sondager) {
    const nokkel = maanedNokkelFraDato(sondag.gudstjeneste.Dato);
    const liste = perMaaned.get(nokkel);
    if (liste) liste.push(sondag);
    else perMaaned.set(nokkel, [sondag]);
  }

  return Array.from(perMaaned.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([nokkel, maanedSondager]) => {
      const [aarStr, maanedStr] = nokkel.split("-");
      const aar = Number(aarStr);
      const maaned = Number(maanedStr);
      const harLedige = maanedSondager.some((s) =>
        s.roller.some((r) => r.status === "ledig")
      );
      return {
        nokkel,
        etikett: maanedEtikett(aar, maaned),
        aar,
        maaned,
        sondager: maanedSondager,
        harLedige,
      };
    });
}

export function byggPersonligMaanedsliste(
  sondager: PersonligSondag[],
  antallMaaneder = SEMESTER_HORISONT_MND,
  iDag = iDagIso()
): PersonligMaaned[] {
  const grupperte = new Map(grupperSondagerPerMaaned(sondager).map((m) => [m.nokkel, m]));
  const start = startMaanedNokkelForHorisont(sondager, iDag);
  return byggMaanedshorisont(start, antallMaaneder).map(
    (nokkel) => grupperte.get(nokkel) ?? tomPersonligMaaned(nokkel)
  );
}

export function sondagErBesvart(sondag: PersonligSondag): boolean {
  if (sondag.roller.length === 0) return false;
  return sondag.roller.every((r) => r.status !== "ledig" && r.status !== "min-venter");
}

export function maanedErGjennomgaatt(
  maaned: PersonligMaaned,
  manueltFerdig: ReadonlySet<string>
): boolean {
  if (manueltFerdig.has(maaned.nokkel)) return true;
  if (maaned.sondager.length === 0) return false;
  return maaned.sondager.every(sondagErBesvart);
}

export function semesterFremdrift(
  maaneder: PersonligMaaned[],
  manueltFerdig: ReadonlySet<string> = new Set()
): SemesterFremdrift {
  let totalt = 0;
  let besvart = 0;
  for (const m of maaneder) {
    for (const s of m.sondager) {
      totalt += 1;
      if (sondagErBesvart(s)) besvart += 1;
    }
  }
  const gjennomgaatte = maaneder.filter((m) => maanedErGjennomgaatt(m, manueltFerdig)).length;
  const tekst =
    totalt === 0
      ? `${gjennomgaatte} av ${maaneder.length} måneder gjennomgått`
      : `${besvart} av ${totalt} søndager besvart`;
  return { besvart, totalt, tekst };
}

export function antallGjenstaendeMaaneder(
  maaneder: PersonligMaaned[],
  manueltFerdig: ReadonlySet<string> = new Set()
): number {
  return maaneder.filter((m) => !maanedErGjennomgaatt(m, manueltFerdig)).length;
}

export function forsteUferdigeMaaned(
  maaneder: PersonligMaaned[],
  manueltFerdig: ReadonlySet<string> = new Set()
): PersonligMaaned | null {
  return maaneder.find((m) => !maanedErGjennomgaatt(m, manueltFerdig)) ?? null;
}

export function nesteMaanedNokkel(
  maaneder: PersonligMaaned[],
  aktiv: string
): string | null {
  const idx = maaneder.findIndex((m) => m.nokkel === aktiv);
  if (idx < 0 || idx >= maaneder.length - 1) return null;
  return maaneder[idx + 1].nokkel;
}

export function forrigeMaanedNokkel(
  maaneder: PersonligMaaned[],
  aktiv: string
): string | null {
  const idx = maaneder.findIndex((m) => m.nokkel === aktiv);
  if (idx <= 0) return null;
  return maaneder[idx - 1].nokkel;
}

export function standardMaanedNokkel(maaneder: PersonligMaaned[], iDag = iDagIso()): string | null {
  if (maaneder.length === 0) return null;
  const denne = maanedNokkelFraDato(iDag);
  if (maaneder.some((m) => m.nokkel === denne)) return denne;
  return maaneder[0].nokkel;
}

export function velgMaanedNokkel(
  maaneder: PersonligMaaned[],
  onsket: string | null,
  iDag = iDagIso()
): string | null {
  if (maaneder.length === 0) return null;
  if (onsket && maaneder.some((m) => m.nokkel === onsket)) return onsket;
  return standardMaanedNokkel(maaneder, iDag);
}

export function erPaameldingValgt(status: PåmeldingsStatus): boolean {
  return status === "min-bekreftet";
}

export function kanPaameldingEndres(status: PåmeldingsStatus): boolean {
  return status !== "stengt";
}

export function togglePaamelding(
  db: DatabaseState,
  personId: string,
  gudstjenesteId: string,
  rolleId: string,
  skalPa: boolean,
  meldingTilGruppe?: string
): DatabaseState | undefined {
  const tildeling = db.tildelinger.find(
    (t) =>
      t.GudstjenesteID === gudstjenesteId &&
      t.RolleID === rolleId &&
      t.PersonID === personId
  );

  if (skalPa) {
    const result = velgDatoForPerson(db, personId, gudstjenesteId, rolleId);
    return result.success ? result.updatedDb : undefined;
  }

  if (!tildeling) return undefined;
  return meldForfall(db, personId, gudstjenesteId, rolleId, meldingTilGruppe);
}
