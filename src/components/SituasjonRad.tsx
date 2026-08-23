import React from "react";
import { DatabaseState, situasjonRollerForGudstjeneste } from "../services/dataService";

interface SituasjonRadProps {
  db: DatabaseState;
  gudstjenesteId: string;
  rolleIds?: string[];
}

export const SituasjonRad: React.FC<SituasjonRadProps> = ({
  db,
  gudstjenesteId,
  rolleIds,
}) => {
  const rader = situasjonRollerForGudstjeneste(db, gudstjenesteId, rolleIds);
  if (rader.length === 0) return null;
  return (
    <div className="px-4 py-2 border-t border-slate-100 flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
      {rader.map(({ rolle, personer }, idx) => (
        <span
          key={rolle.RolleID}
          className="text-xs inline-flex items-baseline gap-1 flex-wrap max-w-full"
        >
          {idx > 0 ? <span className="text-slate-300 mr-0.5">·</span> : null}
          <span className="font-semibold text-slate-500">{rolle.Rollenavn}:</span>
          {personer.length === 0 ? (
            <span className="text-slate-400">—</span>
          ) : (
            personer.map((p, i) => (
              <React.Fragment key={`${p.navn}-${i}`}>
                {i > 0 ? <span className="text-slate-400">,</span> : null}
                <span
                  className={`rounded-md px-1.5 py-0.5 font-medium ${
                    p.status === "Bekreftet"
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-amber-50 text-amber-900"
                  }`}
                >
                  {p.navn}
                </span>
              </React.Fragment>
            ))
          )}
        </span>
      ))}
    </div>
  );
};
