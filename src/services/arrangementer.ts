import { Arrangement } from "../types/database";
import type { DatabaseState } from "../types/database";
import { nesteNummerertId } from "./ids";
import { sikreTjenestebehovFraMal, sortertMalposter } from "./mal";
import { opprettProgramFraMal } from "./program";

export function nesteArrangementId(arrangementer: Arrangement[]): string {
  return nesteNummerertId(arrangementer, "ArrangementID", "AR");
}

export function opprettArrangement(
  db: DatabaseState,
  felt: {
    tittel: string;
    dato: string;
    tid: string;
    sted: string;
    beskrivelse?: string;
    opprettetAv?: string;
    eksternKalenderID?: string;
    malId?: string;
    gruppeId?: string;
  }
): DatabaseState {
  const tittel = felt.tittel.trim();
  const dato = felt.dato.trim();
  if (!tittel || !dato) return db;
  const now = new Date().toISOString().split("T")[0];
  const malId = String(felt.malId || "").trim() || undefined;
  const ny: Arrangement = {
    ArrangementID: nesteArrangementId(db.arrangementer || []),
    Dato: dato,
    Tid: felt.tid.trim() || "12:00",
    Sted: felt.sted.trim(),
    Tittel: tittel,
    Beskrivelse: (felt.beskrivelse || "").trim(),
    OpprettetAv: felt.opprettetAv,
    EksternKalenderID: felt.eksternKalenderID || undefined,
    MalID: malId,
    GruppeID: String(felt.gruppeId || "").trim() || undefined,
    Aktiv: true,
    OpprettetDato: now,
    SistEndret: now,
  };
  const medAr = { ...db, arrangementer: [...(db.arrangementer || []), ny] };
  if (!malId) return medAr;
  let neste = sikreTjenestebehovFraMal(medAr, ny.ArrangementID);
  if (sortertMalposter(neste, malId).length > 0) {
    neste = opprettProgramFraMal(neste, "", ny.ArrangementID);
  }
  return neste;
}

export function slettArrangement(db: DatabaseState, arrangementId: string): DatabaseState {
  if (!arrangementId) return db;
  const now = new Date().toISOString().split("T")[0];
  const slettet = (db.arrangementer || []).find((a) => a.ArrangementID === arrangementId);
  const eksternId = slettet?.EksternKalenderID;
  return {
    ...db,
    arrangementer: (db.arrangementer || []).map((a) =>
      a.ArrangementID === arrangementId ? { ...a, Aktiv: false, SistEndret: now } : a
    ),
    kalenderoppgaver: (db.kalenderoppgaver || []).map((o) => {
      const sammeArrangement = o.ArrangementID === arrangementId;
      const sammeEkstern = Boolean(eksternId && o.EksternUID === eksternId);
      if (!sammeArrangement && !sammeEkstern) return o;
      if (o.Status === "Avvist") return o;
      return {
        ...o,
        Status: "Åpen" as const,
        ArrangementID: undefined,
        SistEndret: now,
      };
    }),
  };
}
