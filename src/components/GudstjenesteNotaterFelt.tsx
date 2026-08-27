import React, { useEffect, useState } from "react";
import { Gudstjeneste } from "../types/database";
import {
  DatabaseState,
  oppdaterGudstjenesteInnhold,
  saveDatabase,
} from "../services/dataService";

interface GudstjenesteNotaterFeltProps {
  db: DatabaseState;
  gudstjeneste: Gudstjeneste;
  onUpdateDb: (updatedDb: DatabaseState) => void;
}

export const GudstjenesteNotaterFelt: React.FC<GudstjenesteNotaterFeltProps> = ({
  db,
  gudstjeneste,
  onUpdateDb,
}) => {
  const [kollekt, setKollekt] = useState(gudstjeneste.Kollekt || "");
  const [kunngjoringer, setKunngjoringer] = useState(gudstjeneste.Kunngjøringer || "");

  useEffect(() => {
    setKollekt(gudstjeneste.Kollekt || "");
    setKunngjoringer(gudstjeneste.Kunngjøringer || "");
  }, [gudstjeneste.GudstjenesteID, gudstjeneste.Kollekt, gudstjeneste.Kunngjøringer]);

  const lagre = (nesteKollekt: string, nesteKunngjoringer: string) => {
    const updated = oppdaterGudstjenesteInnhold(db, gudstjeneste.GudstjenesteID, {
      Kollekt: nesteKollekt.trim(),
      Kunngjøringer: nesteKunngjoringer.trim(),
    });
    if (updated === db) return;
    saveDatabase(updated);
    onUpdateDb(updated);
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Til programmet
      </p>
      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1">Kollekt</label>
        <input
          type="text"
          value={kollekt}
          onChange={(e) => setKollekt(e.target.value)}
          onBlur={() => lagre(kollekt, kunngjoringer)}
          placeholder="Hva kollekten går til"
          className="w-full text-sm border border-slate-300 rounded-xl p-2 bg-white"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1">Kunngjøringer</label>
        <textarea
          value={kunngjoringer}
          onChange={(e) => setKunngjoringer(e.target.value)}
          onBlur={() => lagre(kollekt, kunngjoringer)}
          rows={3}
          placeholder="Det møteleder skal lese opp"
          className="w-full text-sm border border-slate-300 rounded-xl p-2 bg-white resize-y min-h-[4.5rem]"
        />
      </div>
    </div>
  );
};
