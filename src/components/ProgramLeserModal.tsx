import React, { useState } from "react";
import { FileDown, X } from "lucide-react";
import { Gudstjeneste } from "../types/database";
import { DatabaseState } from "../services/dataService";
import { GudstjenesteProgramView } from "./GudstjenesteProgramView";
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
  const [visPdf, setVisPdf] = useState(false);

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
            <button
              type="button"
              onClick={() => setVisPdf((v) => !v)}
              className="min-h-11 px-3 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              {visPdf ? "Vis kjøreplan" : "Forhåndsvis PDF"}
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
          <div className={visPdf ? "hidden no-print" : "block no-print"}>
            <GudstjenesteProgramView
              db={db}
              gudstjeneste={gudstjeneste}
              redigerbar={redigerbar}
              iDialog
              uthevPersonId={uthevPersonId}
              selectedPersonId={selectedPersonId}
              onUpdateDb={onUpdateDb}
            />
          </div>
          <div className={visPdf ? "p-4 sm:p-6" : "program-pdf-print-only"}>
            <ProgramPdfArk db={db} gudstjeneste={gudstjeneste} />
          </div>
        </div>
      </div>
    </div>
  );
};
