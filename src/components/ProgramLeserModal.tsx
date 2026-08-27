import React, { useState } from "react";
import { FileDown, X } from "lucide-react";
import { Gudstjeneste } from "../types/database";
import { DatabaseState } from "../services/dataService";
import { GudstjenesteProgramView } from "./GudstjenesteProgramView";
import { GudstjenesteNotaterFelt } from "./GudstjenesteNotaterFelt";
import { ProgramPdfArk } from "./ProgramPdfArk";

interface ProgramLeserModalProps {
  db: DatabaseState;
  gudstjeneste: Gudstjeneste;
  uthevPersonId?: string;
  selectedPersonId?: string;
  redigerbar?: boolean;
  onClose: () => void;
  onUpdateDb: (updatedDb: DatabaseState) => void;
}

export function lastNedProgramPdf() {
  const kilde = document.querySelector(".program-pdf-ark");
  if (!kilde) return;

  const eksisterende = document.querySelector(".program-pdf-print-root");
  eksisterende?.remove();

  const holder = document.createElement("div");
  holder.className = "program-pdf-print-root";
  holder.appendChild(kilde.cloneNode(true));
  document.body.appendChild(holder);
  document.body.classList.add("printing-program");

  const rydd = () => {
    holder.remove();
    document.body.classList.remove("printing-program");
    window.removeEventListener("afterprint", rydd);
  };
  window.addEventListener("afterprint", rydd);
  window.print();
}

export const ProgramLeserModal: React.FC<ProgramLeserModalProps> = ({
  db,
  gudstjeneste,
  uthevPersonId,
  selectedPersonId,
  redigerbar = false,
  onClose,
  onUpdateDb,
}) => {
  const [visPdf, setVisPdf] = useState(!redigerbar);
  const [kompakt, setKompakt] = useState(false);
  const [visOvrigBemanning, setVisOvrigBemanning] = useState(false);
  const visKjoreplan = redigerbar;
  const gud =
    db.gudstjenester.find((g) => g.GudstjenesteID === gudstjeneste.GudstjenesteID) || gudstjeneste;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full sheet-panel sm:h-auto sm:max-h-[100dvh] sm:max-w-3xl sm:my-4 sm:rounded-3xl shadow-2xl border-0 sm:border sm:border-slate-200 flex flex-col overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex flex-col gap-2 shrink-0 no-print">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">
              {redigerbar ? "Rediger program" : "Gudstjenesteprogram"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 min-h-11 min-w-11 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl cursor-pointer"
              aria-label="Lukk"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {visKjoreplan && (
              <button
                type="button"
                onClick={() => setVisPdf((v) => !v)}
                className="min-h-11 px-3 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                {visPdf ? "Vis kjøreplan" : "Forhåndsvis PDF"}
              </button>
            )}
            <div className="inline-flex rounded-xl border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setKompakt(true);
                  if (visKjoreplan) setVisPdf(true);
                }}
                className={`min-h-11 px-3 text-xs font-semibold cursor-pointer ${
                  kompakt ? "bg-[#2d5a3f] text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Kompakt
              </button>
              <button
                type="button"
                onClick={() => {
                  setKompakt(false);
                  if (visKjoreplan) setVisPdf(true);
                }}
                className={`min-h-11 px-3 text-xs font-semibold cursor-pointer ${
                  !kompakt ? "bg-[#2d5a3f] text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                Med luft
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setVisOvrigBemanning((v) => !v);
                if (visKjoreplan) setVisPdf(true);
              }}
              className={`min-h-11 px-3 text-xs font-semibold rounded-xl cursor-pointer border ${
                visOvrigBemanning
                  ? "bg-[#2d5a3f] text-white border-[#2d5a3f]"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Øvrig bemanning
            </button>
            <button
              type="button"
              onClick={lastNedProgramPdf}
              className="min-h-11 px-3 py-1.5 bg-[#2d5a3f] hover:bg-[#234731] text-white text-xs font-semibold rounded-xl cursor-pointer inline-flex items-center gap-1.5"
            >
              <FileDown className="w-3.5 h-3.5" />
              Last ned PDF
            </button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {redigerbar && (
            <div className="px-4 sm:px-6 pt-4 no-print">
              <GudstjenesteNotaterFelt db={db} gudstjeneste={gud} onUpdateDb={onUpdateDb} />
            </div>
          )}
          {visKjoreplan && (
            <div className={visPdf ? "hidden no-print" : "block no-print"}>
              <GudstjenesteProgramView
                db={db}
                gudstjeneste={gud}
                redigerbar={redigerbar}
                iDialog
                uthevPersonId={uthevPersonId}
                selectedPersonId={selectedPersonId}
                onUpdateDb={onUpdateDb}
              />
            </div>
          )}
          <div className={visKjoreplan && !visPdf ? "program-pdf-print-only" : "p-4 sm:p-6"}>
            <ProgramPdfArk
              db={db}
              gudstjeneste={gud}
              kompakt={kompakt}
              visOvrigBemanning={visOvrigBemanning}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
