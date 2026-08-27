import React, { useState } from "react";
import { Copy, Plus } from "lucide-react";
import { DatabaseState, aktiveMaler, kopierMal, opprettMal, saveDatabase } from "../services/dataService";
import { ProgrammalAdminView } from "./ProgrammalAdminView";
import { ArrangementMalAdminView } from "./ArrangementMalAdminView";

const SONDAG = "sondag";

interface MalerAdminViewProps {
  db: DatabaseState;
  onUpdateDb: (updatedDb: DatabaseState) => void;
}

export const MalerAdminView: React.FC<MalerAdminViewProps> = ({ db, onUpdateDb }) => {
  const maler = aktiveMaler(db);
  const [valg, setValg] = useState(SONDAG);
  const erSondag = valg === SONDAG;

  const persister = (updated: DatabaseState) => {
    saveDatabase(updated);
    onUpdateDb(updated);
  };

  const lagNyMal = () => {
    const { db: neste, malId: id } = opprettMal(db, "Ny mal");
    persister(neste);
    setValg(id);
  };

  const lagKopi = () => {
    if (erSondag) return;
    const { db: neste, malId: id } = kopierMal(db, valg);
    if (!id) return;
    persister(neste);
    setValg(id);
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Maler</h3>
        <p className="text-sm text-slate-600 mt-1">
          Søndagens standard brukes av gudstjenestene. Gudstjeneste, gruppemøte og arrangement
          ligger inne som standard. Egne maler lager du med «Ny mal» — de lagres i arket sammen
          med de tre.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-xs font-semibold text-slate-600">
          Mal
          <select
            value={erSondag || maler.some((m) => m.MalID === valg) ? valg : SONDAG}
            onChange={(e) => setValg(e.target.value)}
            className="mt-1 block border border-slate-300 rounded-xl px-3 py-2 text-sm font-normal text-slate-900 min-w-56"
          >
            <option value={SONDAG}>Søndag — standard kjøreplan</option>
            {maler.map((m) => (
              <option key={m.MalID} value={m.MalID}>
                {m.Navn}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={lagNyMal}
          className="min-h-11 px-3 py-2 bg-[#2d5a3f] text-white text-xs font-semibold rounded-xl cursor-pointer inline-flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Ny mal
        </button>
        <button
          type="button"
          onClick={lagKopi}
          disabled={erSondag}
          className="min-h-11 px-3 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Copy className="w-3.5 h-3.5" />
          Kopier mal
        </button>
      </div>

      {erSondag ? (
        <ProgrammalAdminView db={db} onUpdateDb={onUpdateDb} innebygd />
      ) : (
        <ArrangementMalAdminView
          db={db}
          onUpdateDb={onUpdateDb}
          malId={valg}
          onMalIdChange={setValg}
          innebygd
        />
      )}
    </div>
  );
};
