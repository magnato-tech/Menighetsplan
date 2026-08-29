import { Rolle } from "../types/database";
import type { DatabaseState } from "../types/database";
import { nesteNummerertId } from "./ids";
import { gruppetypeForGruppe, gruppetypeNokkel } from "./grupper";

export function nesteRolleId(roller: Rolle[]): string {
  return nesteNummerertId(roller, "RolleID", "R");
}

export function erSmagruppelederRolle(rolle: Rolle): boolean {
  const n = String(rolle.Rollenavn || "")
    .trim()
    .toLowerCase()
    .replace(/å/g, "a");
  return n.includes("smagruppeleder") || n.includes("smågruppeleder");
}

/** Søndagsbemanning: roller i tjenestegruppe, eller uten kjent gruppetype. */
export function erGudstjenesteBemanningRolle(db: DatabaseState, rolle: Rolle): boolean {
  if (!rolle.GruppeID) return true;
  const gruppe = (db.grupper || []).find((g) => g.GruppeID === rolle.GruppeID);
  if (!gruppe) return true;
  const nøkkel = gruppetypeNokkel(gruppetypeForGruppe(db, gruppe)?.Navn);
  return !nøkkel || nøkkel === "tjenestegruppe";
}

function førsteHusgruppeId(db: DatabaseState): string | undefined {
  const hus = (db.grupper || []).find((g) => {
    if (!g.Aktiv) return false;
    return gruppetypeNokkel(gruppetypeForGruppe(db, g)?.Navn) === "husgruppe";
  });
  return hus?.GruppeID;
}

/** Legger inn rollen Smågruppeleder én gang hvis den mangler. */
export function sikreSmagruppelederRolle(db: DatabaseState): DatabaseState {
  if ((db.roller || []).some(erSmagruppelederRolle)) return db;
  const now = new Date().toISOString().split("T")[0];
  const rolleId = nesteRolleId(db.roller || []);
  const ny: Rolle = {
    RolleID: rolleId,
    Rollenavn: "Smågruppeleder",
    Beskrivelse: "Leder en smågruppe i menigheten med samling, bønn og oppfølging av medlemmene.",
    BidraPreposisjon: "som",
    Aktiv: true,
    Behov: 0,
    MaksAntall: 0,
    GruppeID: førsteHusgruppeId(db),
    OpprettetDato: now,
    SistEndret: now,
  };
  const harBeskrivelse = (db.rollebeskrivelser || []).some((rb) => rb.RolleID === rolleId);
  const rollebeskrivelser = harBeskrivelse
    ? db.rollebeskrivelser
    : [
        ...(db.rollebeskrivelser || []),
        {
          RolleID: rolleId,
          Rollebeskrivelse:
            "Forberede og lede smågruppesamlingen. Følge opp deltakerne mellom samlingene. Være bindeledd mot menigheten og gruppelederteamet.",
          Aktiv: true,
          OpprettetDato: now,
          SistEndret: now,
        },
      ];
  return {
    ...db,
    roller: [...(db.roller || []), ny],
    rollebeskrivelser,
  };
}
