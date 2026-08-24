import React, { useMemo, useState } from "react";
import { Users, X } from "lucide-react";
import { Gruppe } from "../types/database";
import {
  DatabaseState,
  synkGruppeledergruppe,
  nesteGruppeId,
  saveDatabase,
  sikreGruppemedlemskap,
} from "../services/dataService";

interface NewGroupModalProps {
  db: DatabaseState;
  onClose: () => void;
  onUpdateDb: (updatedDb: DatabaseState) => void;
  onCreated?: (gruppeId: string) => void;
}

export const NewGroupModal: React.FC<NewGroupModalProps> = ({
  db,
  onClose,
  onUpdateDb,
  onCreated,
}) => {
  const defaultType =
    db.gruppetyper.find((gt) => gt.Navn.trim().toLowerCase() === "tjenestegruppe")
      ?.GruppetypeID ||
    db.gruppetyper.find((gt) => gt.Aktiv)?.GruppetypeID ||
    "";

  const [gruppenavn, setGruppenavn] = useState("");
  const [gruppetypeID, setGruppetypeID] = useState(defaultType);
  const [beskrivelse, setBeskrivelse] = useState("");
  const [gruppelederID, setGruppelederID] = useState("");
  const [nestlederID, setNestlederID] = useState("");

  const personer = useMemo(
    () =>
      db.personer
        .filter((p) => p.Aktiv)
        .slice()
        .sort((a, b) => a.Navn.localeCompare(b.Navn, "nb")),
    [db.personer]
  );

  const handleOpprett = () => {
    const navn = gruppenavn.trim();
    if (!navn || !gruppetypeID) return;
    const now = new Date().toISOString().split("T")[0];
    const gruppeId = nesteGruppeId(db.grupper);
    const ny: Gruppe = {
      GruppeID: gruppeId,
      Gruppenavn: navn,
      GruppetypeID: gruppetypeID,
      Beskrivelse: beskrivelse.trim(),
      GruppelederID: gruppelederID || undefined,
      NestlederID:
        nestlederID && nestlederID !== gruppelederID ? nestlederID : undefined,
      Aktiv: true,
      OpprettetDato: now,
      SistEndret: now,
    };

    let gruppemedlemmer = db.gruppemedlemmer;
    if (ny.GruppelederID) {
      gruppemedlemmer = sikreGruppemedlemskap(
        gruppemedlemmer,
        gruppeId,
        ny.GruppelederID,
        "Leder"
      );
    }
    if (ny.NestlederID) {
      gruppemedlemmer = sikreGruppemedlemskap(
        gruppemedlemmer,
        gruppeId,
        ny.NestlederID,
        "Nestleder"
      );
    }

    const updated = synkGruppeledergruppe({
      ...db,
      grupper: [...db.grupper, ny],
      gruppemedlemmer,
    });
    saveDatabase(updated);
    onUpdateDb(updated);
    onCreated?.(gruppeId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#eef5f1] text-[#2d5a3f] rounded-xl border border-[#d2e8d9]">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#2d5a3f]">
                Gruppe
              </span>
              <h2 className="text-xl font-bold text-slate-900">Ny gruppe</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="font-semibold text-slate-600 block mb-1">Gruppenavn *</label>
            <input
              type="text"
              value={gruppenavn}
              onChange={(e) => setGruppenavn(e.target.value)}
              placeholder="F.eks. Velkomst"
              className="w-full text-sm border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-600 block mb-1">Kategori *</label>
            <select
              value={gruppetypeID}
              onChange={(e) => setGruppetypeID(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
            >
              {db.gruppetyper
                .filter((gt) => gt.Aktiv)
                .map((gt) => (
                  <option key={gt.GruppetypeID} value={gt.GruppetypeID}>
                    {gt.Navn}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="font-semibold text-slate-600 block mb-1">Beskrivelse</label>
            <textarea
              value={beskrivelse}
              onChange={(e) => setBeskrivelse(e.target.value)}
              rows={3}
              className="w-full text-sm border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f] resize-y"
            />
          </div>
          <div>
            <label className="font-semibold text-slate-600 block mb-1">Gruppeleder</label>
            <select
              value={gruppelederID}
              onChange={(e) => setGruppelederID(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
            >
              <option value="">Ikke satt</option>
              {personer.map((p) => (
                <option key={p.PersonID} value={p.PersonID}>
                  {p.Navn}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-semibold text-slate-600 block mb-1">Nestleder</label>
            <select
              value={nestlederID}
              onChange={(e) => setNestlederID(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
            >
              <option value="">Ikke satt</option>
              {personer.map((p) => (
                <option key={p.PersonID} value={p.PersonID}>
                  {p.Navn}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
          >
            Avbryt
          </button>
          <button
            type="button"
            disabled={!gruppenavn.trim() || !gruppetypeID}
            onClick={handleOpprett}
            className="px-4 py-2 text-xs bg-[#2d5a3f] hover:bg-[#234731] disabled:opacity-50 text-white font-semibold rounded-xl cursor-pointer"
          >
            Opprett gruppe
          </button>
        </div>
      </div>
    </div>
  );
};
