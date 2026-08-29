import React from "react";
import type { DatabaseState } from "../types/database";
import { GruppeMeldingerInnhold } from "./GruppeMeldingerInnhold";
import { MessageSquare, X } from "lucide-react";

interface GruppeMeldingerPanelProps {
  db: DatabaseState;
  personId: string;
  apen: boolean;
  onLukk: () => void;
}

/** Overlay-panel — beholdt for evt. gjenbruk; Min side bruker GruppeMeldingerInnhold i fane. */
export const GruppeMeldingerPanel: React.FC<GruppeMeldingerPanelProps> = ({
  db,
  personId,
  apen,
  onLukk,
}) => {
  if (!apen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 cursor-pointer"
        aria-label="Lukk meldinger"
        onClick={onLukk}
      />
      <div className="absolute inset-x-0 bottom-0 md:inset-y-0 md:left-auto md:right-0 md:w-[min(24rem,100vw)] md:max-w-full bg-white md:border-l border-slate-200 shadow-2xl flex flex-col max-h-[min(85dvh,100%)] md:max-h-full sheet-safe-bottom">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 shrink-0">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#2d5a3f]" />
            Meldinger fra gruppen
          </h2>
          <button
            type="button"
            onClick={onLukk}
            className="inline-flex items-center justify-center min-h-10 min-w-10 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
            aria-label="Lukk"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <GruppeMeldingerInnhold db={db} personId={personId} />
        </div>
      </div>
    </div>
  );
};
