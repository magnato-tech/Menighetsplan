import React from "react";
import { Users, X } from "lucide-react";
import { DatabaseState, mineGrupperForPerson } from "../services/dataService";

interface MineGrupperArkProps {
  db: DatabaseState;
  personId: string;
  onLukk: () => void;
}

function lederTekst(kort: ReturnType<typeof mineGrupperForPerson>[number]): string {
  if (kort.tilknytning === "Leder") {
    return kort.nestlederNavn
      ? `Du er gruppeleder. Nestleder er ${kort.nestlederNavn}.`
      : "Du er gruppeleder for denne gruppen.";
  }
  if (kort.tilknytning === "Nestleder") {
    return kort.lederNavn
      ? `Du er nestleder. Gruppeleder er ${kort.lederNavn}.`
      : "Du er nestleder. Gruppen har ingen registrert gruppeleder.";
  }
  if (kort.lederNavn && kort.nestlederNavn) {
    return `Gruppeleder er ${kort.lederNavn}. Nestleder er ${kort.nestlederNavn}.`;
  }
  if (kort.lederNavn) return `Gruppeleder er ${kort.lederNavn}.`;
  return "Gruppen har ingen registrert gruppeleder ennå.";
}

export const MineGrupperArk: React.FC<MineGrupperArkProps> = ({ db, personId, onLukk }) => {
  const grupper = mineGrupperForPerson(db, personId);
  const tittel = grupper.length === 1 ? "Min gruppe" : "Mine grupper";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex justify-center items-end sm:items-center p-0 sm:p-4 animate-fadeIn">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer"
        aria-label="Lukk"
        onClick={onLukk}
      />
      <div className="relative bg-white w-full sheet-panel sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:rounded-3xl shadow-2xl border-0 sm:border sm:border-slate-200 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <span className="text-sm font-bold text-slate-900">{tittel}</span>
          <button
            type="button"
            onClick={onLukk}
            className="p-2 min-h-11 min-w-11 text-slate-500 hover:bg-slate-100 rounded-xl cursor-pointer"
            aria-label="Lukk"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <p className="text-sm text-slate-600 leading-relaxed">
            Oppgavene du huker av hører til en tjenestegruppe. Her ser du gruppene du er med i, og
            hvem som er leder.
          </p>
          {grupper.length === 0 ? (
            <p className="text-sm text-slate-500">Du er ikke med i noen gruppe ennå.</p>
          ) : (
            grupper.map((kort) => (
              <section
                key={kort.gruppeId}
                className="rounded-2xl border border-[#d2e8d9] bg-[#eef5f1] px-4 py-3"
              >
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-[#2d5a3f] mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900">{kort.gruppenavn}</h3>
                    <p className="text-sm text-slate-700 mt-1 leading-snug">{lederTekst(kort)}</p>
                    {kort.mineOppgaver.length > 0 ? (
                      <p className="text-xs text-slate-600 mt-1.5">
                        Dine oppgaver: {kort.mineOppgaver.join(", ")}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 mt-1.5">Ingen hukede oppgaver i gruppen.</p>
                    )}
                  </div>
                </div>
              </section>
            ))
          )}
        </div>
        <div className="px-4 py-3 border-t border-slate-100 sheet-safe-bottom">
          <button
            type="button"
            onClick={onLukk}
            className="min-h-11 w-full sm:w-auto px-4 text-sm font-semibold text-white bg-[#2d5a3f] hover:bg-[#234731] rounded-xl cursor-pointer"
          >
            Lukk
          </button>
        </div>
      </div>
    </div>
  );
};
