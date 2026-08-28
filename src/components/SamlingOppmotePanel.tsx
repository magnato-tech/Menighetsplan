import React from "react";
import type { Arrangement, DatabaseState, Person } from "../types/database";
import { hentOppmoteForSamling, settSamlingOppmote, formatertArrangementDato } from "../services/dataService";

interface SamlingOppmotePanelProps {
  db: DatabaseState;
  arrangement: Arrangement;
  gruppeId: string;
  medlemmer: Person[];
  onUpdateDb: (updatedDb: DatabaseState) => void;
}

export const SamlingOppmotePanel: React.FC<SamlingOppmotePanelProps> = ({
  db,
  arrangement,
  gruppeId,
  medlemmer,
  onUpdateDb,
}) => {
  const oppmote = hentOppmoteForSamling(db, arrangement.ArrangementID);
  const oppmoteMap = new Map(oppmote.map((o) => [o.PersonID, o.Tilstede]));

  const toggle = (personId: string) => {
    const neste = settSamlingOppmote(
      db,
      arrangement.ArrangementID,
      gruppeId,
      personId,
      !oppmoteMap.get(personId)
    );
    onUpdateDb(neste);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
        Oppmøte
      </h3>
      <p className="text-sm font-semibold text-slate-900 mb-3">
        {formatertArrangementDato(arrangement.Dato, arrangement.Tid)}
      </p>
      <ul className="space-y-1">
        {medlemmer
          .slice()
          .sort((a, b) => a.Navn.localeCompare(b.Navn, "nb"))
          .map((m) => {
            const tilstede = oppmoteMap.get(m.PersonID) ?? false;
            return (
              <li key={m.PersonID}>
                <label className="flex items-center gap-2 py-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={tilstede}
                    onChange={() => toggle(m.PersonID)}
                    className="rounded border-slate-300 text-[#2d5a3f] focus:ring-[#2d5a3f]"
                  />
                  <span className="text-sm text-slate-800">{m.Navn}</span>
                </label>
              </li>
            );
          })}
      </ul>
    </div>
  );
};
