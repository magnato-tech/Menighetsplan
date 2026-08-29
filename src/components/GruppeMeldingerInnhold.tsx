import React from "react";
import type { DatabaseState } from "../types/database";
import {
  formatertArrangementDato,
  kommendeSamlingerForPerson,
  meldingerForPerson,
} from "../services/dataService";
import { GruppeMeldingRad } from "./GruppeMeldingRad";

interface GruppeMeldingerInnholdProps {
  db: DatabaseState;
  personId: string;
  meldingAntall?: number;
}

export const GruppeMeldingerInnhold: React.FC<GruppeMeldingerInnholdProps> = ({
  db,
  personId,
  meldingAntall = 50,
}) => {
  const meldinger = meldingerForPerson(db, personId, meldingAntall);
  const samlinger = kommendeSamlingerForPerson(db, personId, 6);

  if (meldinger.length === 0 && samlinger.length === 0) {
    return (
      <p className="text-sm text-slate-500 text-center py-8 bg-white rounded-2xl border border-slate-200 p-6">
        Ingen meldinger fra gruppen ennå.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {meldinger.length > 0 ? (
        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <ul className="space-y-3">
            {meldinger.map((m) => (
              <li key={m.GruppeMeldingID}>
                <GruppeMeldingRad db={db} melding={m} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {samlinger.length > 0 ? (
        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Kommende gruppesamlinger
          </h3>
          <ul className="space-y-3">
            {samlinger.map(({ gruppenavn, arrangement }) => (
              <li key={arrangement.ArrangementID} className="text-sm">
                <p className="font-semibold text-slate-900">
                  {gruppenavn} · {formatertArrangementDato(arrangement.Dato, arrangement.Tid)}
                </p>
                {arrangement.Sted ? (
                  <p className="text-xs text-slate-500 mt-0.5">{arrangement.Sted}</p>
                ) : null}
                {arrangement.Beskrivelse ? (
                  <p className="text-slate-700 mt-1 whitespace-pre-wrap text-sm">
                    {arrangement.Beskrivelse}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};
