import React, { useState } from "react";
import { DatabaseState, saveDatabase } from "../services/dataService";
import { Rolle } from "../types/database";
import { RoleDescriptionModal, oppsummerInstruks } from "./RoleDescriptionModal";
import { RolleIkon } from "./RolleIkon";
import { Layers } from "lucide-react";

interface RollerAdminViewProps {
  db: DatabaseState;
  onUpdateDb: (updatedDb: DatabaseState) => void;
}

export const RollerAdminView: React.FC<RollerAdminViewProps> = ({ db, onUpdateDb }) => {
  const [selectedRolleForModal, setSelectedRolleForModal] = useState<Rolle | null>(null);

  const handleOppdaterRolle = (
    rolleId: string,
    patch: { GruppeID?: string; Behov?: number }
  ) => {
    const now = new Date().toISOString().split("T")[0];
    const updatedDb: DatabaseState = {
      ...db,
      roller: db.roller.map((r) =>
        r.RolleID === rolleId
          ? {
              ...r,
              ...("GruppeID" in patch ? { GruppeID: patch.GruppeID || undefined } : {}),
              ...("Behov" in patch && patch.Behov !== undefined ? { Behov: patch.Behov } : {}),
              SistEndret: now,
            }
          : r
      ),
    };
    saveDatabase(updatedDb);
    onUpdateDb(updatedDb);
  };

  const handleLagreRolleinstruks = (rolleId: string, tekst: string) => {
    const now = new Date().toISOString().split("T")[0];
    const eksisterer = db.rollebeskrivelser.some((rb) => rb.RolleID === rolleId);
    const rollebeskrivelser = eksisterer
      ? db.rollebeskrivelser.map((rb) =>
          rb.RolleID === rolleId
            ? { ...rb, Rollebeskrivelse: tekst, SistEndret: now }
            : rb
        )
      : [
          ...db.rollebeskrivelser,
          {
            RolleID: rolleId,
            Rollebeskrivelse: tekst,
            Aktiv: true,
            OpprettetDato: now,
            SistEndret: now,
          },
        ];
    const updatedDb: DatabaseState = { ...db, rollebeskrivelser };
    saveDatabase(updatedDb);
    onUpdateDb(updatedDb);
  };

  return (
    <>
      <div className="space-y-4 max-w-2xl">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#2d5a3f]" />
          <span>Roller ({db.roller.length})</span>
        </h3>

        <div className="space-y-3">
          {db.roller.map((rolle) => {
            const instruks =
              db.rollebeskrivelser.find((rb) => rb.RolleID === rolle.RolleID)
                ?.Rollebeskrivelse || rolle.Beskrivelse;
            const sammendrag = oppsummerInstruks(instruks);

            return (
              <div
                key={rolle.RolleID}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedRolleForModal(rolle)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedRolleForModal(rolle);
                  }
                }}
                className="w-full text-left bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-[#2d5a3f]/40 cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <RolleIkon rollenavn={rolle.Rollenavn} className="w-10 h-10" />
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 text-sm">{rolle.Rollenavn}</h4>
                    {sammendrag ? (
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{sammendrag}</p>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1">Ingen instruks registrert</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedRolleForModal && (() => {
        const liveRolle = db.roller.find(
          (r) => r.RolleID === selectedRolleForModal.RolleID
        );
        if (!liveRolle) return null;
        return (
          <RoleDescriptionModal
            rolle={liveRolle}
            rollebeskrivelse={
              db.rollebeskrivelser.find((rb) => rb.RolleID === liveRolle.RolleID) ||
              null
            }
            gruppe={
              liveRolle.GruppeID
                ? db.grupper.find((g) => g.GruppeID === liveRolle.GruppeID) || null
                : null
            }
            grupper={db.grupper}
            antallKvalifiserte={
              db.personroller.filter(
                (pr) => pr.RolleID === liveRolle.RolleID && pr.Aktiv
              ).length
            }
            editable
            onUpdateRolle={(patch) => handleOppdaterRolle(liveRolle.RolleID, patch)}
            onSaveInstruks={(tekst) => handleLagreRolleinstruks(liveRolle.RolleID, tekst)}
            onClose={() => setSelectedRolleForModal(null)}
          />
        );
      })()}
    </>
  );
};
