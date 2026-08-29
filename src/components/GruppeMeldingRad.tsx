import React from "react";
import { Bot, User } from "lucide-react";
import type { DatabaseState, GruppeMelding } from "../types/database";
import { tolkeGruppeMeldingKilde } from "../services/dataService";

export type GruppeMeldingVisning = GruppeMelding & {
  gruppenavn?: string;
  avsenderNavn?: string;
};

type GruppeMeldingRadProps = {
  db: DatabaseState;
  melding: GruppeMeldingVisning;
  kompakt?: boolean;
};

function avsenderNavn(db: DatabaseState, melding: GruppeMelding): string {
  const kilde = tolkeGruppeMeldingKilde(melding);
  if (kilde === "system") {
    const utloser = db.personer.find(
      (p) => p.PersonID === (melding.UtlostAvPersonID || melding.OpprettetAvPersonID)
    );
    return utloser?.Fornavn || utloser?.Navn || "Noen";
  }
  const person = db.personer.find((p) => p.PersonID === melding.OpprettetAvPersonID);
  return person?.Fornavn || person?.Navn || "Ukjent";
}

export const GruppeMeldingRad: React.FC<GruppeMeldingRadProps> = ({
  db,
  melding,
  kompakt = false,
}) => {
  const kilde = tolkeGruppeMeldingKilde(melding);
  const erSystem = kilde === "system";
  const navn = melding.avsenderNavn || avsenderNavn(db, melding);

  return (
    <div className={`text-sm ${kompakt ? "" : "bg-slate-50 rounded-xl px-3 py-2"}`}>
      <div className="flex items-start gap-2">
        {erSystem ? (
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-200 text-slate-700 shrink-0"
            title="Systemmelding"
          >
            <Bot className="w-4 h-4" />
          </span>
        ) : (
          <span
            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#eef5f1] text-[#2d5a3f] shrink-0"
            title={kilde === "gruppeleder" ? "Gruppeleder" : "Medlem"}
          >
            <User className="w-4 h-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-[#2d5a3f]">
            {melding.gruppenavn || "Gruppe"}
            {erSystem ? (
              <span className="text-slate-500 font-normal"> · Systemmelding</span>
            ) : (
              <span className="text-slate-500 font-normal"> · {navn}</span>
            )}
            <span className="text-slate-400 font-normal"> · {melding.OpprettetDato}</span>
          </p>
          {erSystem ? (
            <p className="text-[10px] text-slate-500 mt-0.5">Utløst av {navn}</p>
          ) : null}
          <p className="text-slate-800 mt-0.5 whitespace-pre-wrap">{melding.Tekst}</p>
        </div>
      </div>
    </div>
  );
};
