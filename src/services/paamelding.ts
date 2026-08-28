import type { DatabaseState, Gudstjeneste, Rolle } from "../types/database";
import {
  erRolleHardFull,
  getEffektivtBehov,
  getMaksAntall,
  hentSvarStatus,
  svarPaaTildeling,
  velgDatoForPerson,
} from "./bemanning";
import { hentPåmeldingsRoller } from "./interesse";

export type PåmeldingsStatus = "ledig" | "min-venter" | "min-bekreftet" | "full" | "stengt";

export type PåmeldingsPerson = {
  personId: string;
  navn: string;
  status: "Bekreftet" | "Venter";
};

export type PåmeldingsRad = {
  gudstjeneste: Gudstjeneste;
  rolle: Rolle;
  behov: number;
  maks: number | null;
  ledige: number;
  bekreftetAntall: number;
  aktiveAntall: number;
  hardFull: boolean;
  personerPå: PåmeldingsPerson[];
  status: PåmeldingsStatus;
};

export type PersonligSondag = {
  gudstjeneste: Gudstjeneste;
  roller: PåmeldingsRad[];
};

function iDagIso(): string {
  return new Date().toISOString().split("T")[0];
}

export function byggPåmeldingsrader(
  db: DatabaseState,
  personId: string,
  rolle: Rolle
): Omit<PåmeldingsRad, "rolle">[] {
  return db.gudstjenester
    .filter((g) => g.Dato >= iDagIso())
    .slice()
    .sort((a, b) => `${a.Dato} ${a.Tid}`.localeCompare(`${b.Dato} ${b.Tid}`))
    .map((g) => {
      const tildelinger = db.tildelinger.filter(
        (t) => t.GudstjenesteID === g.GudstjenesteID && t.RolleID === rolle.RolleID
      );
      const personerPå = tildelinger
        .map((t) => {
          const rawStatus = hentSvarStatus(db, t.TildelingID);
          if (rawStatus === "Avvist") return null;
          const status = rawStatus === "Bekreftet" ? ("Bekreftet" as const) : ("Venter" as const);
          const p = db.personer.find((pers) => pers.PersonID === t.PersonID);
          return {
            personId: t.PersonID,
            navn: p?.Fornavn || p?.Navn || t.PersonID,
            status,
          };
        })
        .filter(
          (x): x is PåmeldingsPerson => x !== null
        );

      const behov = getEffektivtBehov(db, g.GudstjenesteID, rolle);
      const maks = getMaksAntall(rolle);
      const bekreftetAntall = personerPå.filter((p) => p.status === "Bekreftet").length;
      const ledige = Math.max(0, behov - bekreftetAntall);
      const hardFull = erRolleHardFull(db, g.GudstjenesteID, rolle);
      const min = personerPå.find((p) => p.personId === personId);
      const minAvvist = tildelinger.some((t) => {
        if (t.PersonID !== personId) return false;
        return hentSvarStatus(db, t.TildelingID) === "Avvist";
      });

      let status: PåmeldingsStatus =
        hardFull && !min ? "stengt" : ledige > 0 || minAvvist ? "ledig" : "full";
      if (min?.status === "Bekreftet") status = "min-bekreftet";
      else if (min) status = "min-venter";

      return {
        gudstjeneste: g,
        behov,
        maks,
        ledige,
        bekreftetAntall,
        aktiveAntall: personerPå.length,
        hardFull,
        personerPå,
        status,
      };
    });
}

export function byggPersonligSondagsliste(
  db: DatabaseState,
  personId: string,
  rolleFilterId: string | null = null
): PersonligSondag[] {
  const roller = hentPåmeldingsRoller(db, personId).filter(
    (r) => !rolleFilterId || r.RolleID === rolleFilterId
  );

  const perGud = new Map<string, PersonligSondag>();

  for (const rolle of roller) {
    for (const rad of byggPåmeldingsrader(db, personId, rolle)) {
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

export function maanedNokkelFraDato(dato: string): string {
  return dato.slice(0, 7);
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
      const d = new Date(aar, maaned - 1, 1);
      const etikett = d.toLocaleDateString("nb-NO", { month: "short" }).replace(".", "");
      const harLedige = maanedSondager.some((s) =>
        s.roller.some((r) => r.status === "ledig")
      );
      return {
        nokkel,
        etikett: etikett.charAt(0).toUpperCase() + etikett.slice(1),
        aar,
        maaned,
        sondager: maanedSondager,
        harLedige,
      };
    });
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
  return status === "min-bekreftet" || status === "min-venter";
}

export function kanPaameldingEndres(status: PåmeldingsStatus): boolean {
  return status !== "stengt";
}

export function togglePaamelding(
  db: DatabaseState,
  personId: string,
  gudstjenesteId: string,
  rolleId: string,
  skalPa: boolean
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
  return svarPaaTildeling(db, tildeling.TildelingID, personId, "Avvist", "Meldt forfall");
}
