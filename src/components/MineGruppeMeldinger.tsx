import React from "react";
import type { DatabaseState } from "../types/database";
import {
  formatertArrangementDato,
  kommendeSamlingerForPerson,
  meldingerForPerson,
} from "../services/dataService";
import { MessageSquare } from "lucide-react";

interface MineGruppeMeldingerProps {
  db: DatabaseState;
  personId: string;
}

export const MineGruppeMeldinger: React.FC<MineGruppeMeldingerProps> = ({ db, personId }) => {
  const meldinger = meldingerForPerson(db, personId, 5);
  const samlinger = kommendeSamlingerForPerson(db, personId, 4);

  if (meldinger.length === 0 && samlinger.length === 0) return null;

  return (
    <div className="space-y-4">
      {meldinger.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-3">
            <MessageSquare className="w-4 h-4" />
            Meldinger fra gruppen
          </h3>
          <ul className="space-y-3">
            {meldinger.map((m) => (
              <li key={m.GruppeMeldingID} className="text-sm">
                <p className="text-[11px] font-semibold text-[#2d5a3f]">
                  {m.gruppenavn}
                  {m.arrangement
                    ? ` · ${formatertArrangementDato(m.arrangement.Dato, m.arrangement.Tid)}`
                    : ""}
                  <span className="text-slate-400 font-normal"> · {m.OpprettetDato}</span>
                </p>
                <p className="text-slate-800 mt-0.5 whitespace-pre-wrap">{m.Tekst}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {samlinger.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
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
                  <p className="text-slate-700 mt-1 whitespace-pre-wrap">{arrangement.Beskrivelse}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};
