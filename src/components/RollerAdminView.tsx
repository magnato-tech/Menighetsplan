import React, { useMemo, useState } from "react";
import { DatabaseState, nesteRolleId, saveDatabase } from "../services/dataService";
import { BidraPreposisjon, Rolle } from "../types/database";
import { BIDRA_PREPOSISJON_VALG, gjetBidraPreposisjon } from "../services/rollerTekst";
import { RoleDescriptionModal, oppsummerInstruks } from "./RoleDescriptionModal";
import { RolleIkon } from "./RolleIkon";
import { Layers, Plus, X } from "lucide-react";

interface RollerAdminViewProps {
  db: DatabaseState;
  onUpdateDb: (updatedDb: DatabaseState) => void;
}

type RollePatch = {
  Rollenavn?: string;
  Beskrivelse?: string;
  GruppeID?: string;
  Behov?: number;
  MaksAntall?: number | null;
  Aktiv?: boolean;
  BidraPreposisjon?: BidraPreposisjon;
};

export const RollerAdminView: React.FC<RollerAdminViewProps> = ({ db, onUpdateDb }) => {
  const [selectedRolleForModal, setSelectedRolleForModal] = useState<Rolle | null>(null);
  const [viserNyRolle, setViserNyRolle] = useState(false);

  const sorterteRoller = useMemo(
    () =>
      [...db.roller].sort((a, b) => a.Rollenavn.localeCompare(b.Rollenavn, "nb")),
    [db.roller]
  );

  const persist = (updatedDb: DatabaseState) => {
    saveDatabase(updatedDb);
    onUpdateDb(updatedDb);
  };

  const handleOppdaterRolle = (rolleId: string, patch: RollePatch) => {
    const now = new Date().toISOString().split("T")[0];
    persist({
      ...db,
      roller: db.roller.map((r) =>
        r.RolleID === rolleId
          ? {
              ...r,
              ...("Rollenavn" in patch && patch.Rollenavn !== undefined
                ? { Rollenavn: patch.Rollenavn }
                : {}),
              ...("Beskrivelse" in patch && patch.Beskrivelse !== undefined
                ? { Beskrivelse: patch.Beskrivelse }
                : {}),
              ...("GruppeID" in patch ? { GruppeID: patch.GruppeID || undefined } : {}),
              ...("Behov" in patch && patch.Behov !== undefined ? { Behov: patch.Behov } : {}),
              ...("MaksAntall" in patch ? { MaksAntall: patch.MaksAntall } : {}),
              ...("Aktiv" in patch && patch.Aktiv !== undefined ? { Aktiv: patch.Aktiv } : {}),
              ...("BidraPreposisjon" in patch && patch.BidraPreposisjon !== undefined
                ? { BidraPreposisjon: patch.BidraPreposisjon }
                : {}),
              SistEndret: now,
            }
          : r
      ),
    });
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
    persist({ ...db, rollebeskrivelser });
  };

  const handleOpprettRolle = (felt: {
    Rollenavn: string;
    Beskrivelse: string;
    GruppeID: string;
    Behov: number;
    BidraPreposisjon: BidraPreposisjon;
  }) => {
    const now = new Date().toISOString().split("T")[0];
    const ny: Rolle = {
      RolleID: nesteRolleId(db.roller),
      Rollenavn: felt.Rollenavn,
      Beskrivelse: felt.Beskrivelse,
      BidraPreposisjon: felt.BidraPreposisjon,
      Aktiv: true,
      Behov: felt.Behov,
      GruppeID: felt.GruppeID || undefined,
      OpprettetDato: now,
      SistEndret: now,
    };
    const updatedDb: DatabaseState = { ...db, roller: [...db.roller, ny] };
    persist(updatedDb);
    setViserNyRolle(false);
    setSelectedRolleForModal(ny);
  };

  return (
    <>
      <div className="space-y-4 max-w-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#2d5a3f]" />
              <span>Roller ({db.roller.length})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Klikk en rolle for å endre navn, gruppe, behov og instruks.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setViserNyRolle(true)}
            className="px-3.5 py-2 bg-[#2d5a3f] hover:bg-[#234731] text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Ny rolle</span>
          </button>
        </div>

        <div className="space-y-3">
          {sorterteRoller.map((rolle) => {
            const instruks =
              db.rollebeskrivelser.find((rb) => rb.RolleID === rolle.RolleID)
                ?.Rollebeskrivelse || rolle.Beskrivelse;
            const sammendrag = oppsummerInstruks(instruks);
            const gruppeNavn = rolle.GruppeID
              ? db.grupper.find((g) => g.GruppeID === rolle.GruppeID)?.Gruppenavn
              : "";

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
                className={`w-full text-left bg-white p-4 rounded-2xl border shadow-xs hover:border-[#2d5a3f]/40 cursor-pointer ${
                  rolle.Aktiv ? "border-slate-200" : "border-slate-200 opacity-60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <RolleIkon rollenavn={rolle.Rollenavn} className="w-10 h-10" />
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 text-sm">
                      {rolle.Rollenavn}
                      {!rolle.Aktiv && (
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          Inaktiv
                        </span>
                      )}
                    </h4>
                    {gruppeNavn && (
                      <p className="text-[11px] font-semibold text-[#2d5a3f] mt-0.5">{gruppeNavn}</p>
                    )}
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

      {viserNyRolle && (
        <NyRolleModal
          db={db}
          onClose={() => setViserNyRolle(false)}
          onOpprett={handleOpprettRolle}
        />
      )}

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

function NyRolleModal({
  db,
  onClose,
  onOpprett,
}: {
  db: DatabaseState;
  onClose: () => void;
  onOpprett: (felt: {
    Rollenavn: string;
    Beskrivelse: string;
    GruppeID: string;
    Behov: number;
    BidraPreposisjon: BidraPreposisjon;
  }) => void;
}) {
  const [navn, setNavn] = useState("");
  const [beskrivelse, setBeskrivelse] = useState("");
  const [gruppeId, setGruppeId] = useState("");
  const [behov, setBehov] = useState(1);
  const [bidraPreposisjon, setBidraPreposisjon] = useState<BidraPreposisjon>("med");

  const lagre = () => {
    const Rollenavn = navn.trim();
    if (!Rollenavn) return;
    onOpprett({
      Rollenavn,
      Beskrivelse: beskrivelse.trim(),
      GruppeID: gruppeId,
      Behov: behov,
      BidraPreposisjon: bidraPreposisjon,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 mb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#2d5a3f]">
              Rolle
            </span>
            <h2 className="text-xl font-bold text-slate-900">Ny rolle</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Rollenavn</span>
            <input
              type="text"
              value={navn}
              onChange={(e) => {
                const Rollenavn = e.target.value;
                setNavn(Rollenavn);
                if (Rollenavn.trim()) {
                  setBidraPreposisjon(gjetBidraPreposisjon({ Rollenavn }));
                }
              }}
              className="mt-1 w-full text-sm border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
              placeholder="F.eks. Smågruppeleder"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Tjenestegruppe</span>
            <select
              value={gruppeId}
              onChange={(e) => setGruppeId(e.target.value)}
              className="mt-1 w-full text-sm border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
            >
              <option value="">Ingen</option>
              {db.grupper
                .filter((g) => g.Aktiv)
                .slice()
                .sort((a, b) => a.Gruppenavn.localeCompare(b.Gruppenavn, "nb"))
                .map((g) => (
                  <option key={g.GruppeID} value={g.GruppeID}>
                    {g.Gruppenavn}
                  </option>
                ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Standard behov per gudstjeneste</span>
            <input
              type="number"
              min={0}
              max={20}
              value={behov}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n) || n < 0) return;
                setBehov(Math.round(n));
              }}
              className="mt-1 w-24 text-sm border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Sett 0 for roller som ikke inngår i søndagsbemanning, f.eks. smågruppeleder.
            </p>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Bidra-tekst på Min side</span>
            <select
              value={bidraPreposisjon}
              onChange={(e) => setBidraPreposisjon(e.target.value as BidraPreposisjon)}
              className="mt-1 w-full text-sm border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
            >
              {BIDRA_PREPOSISJON_VALG.map(({ id, eksempel }) => (
                <option key={id} value={id}>
                  {eksempel}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600">Kort beskrivelse</span>
            <textarea
              value={beskrivelse}
              onChange={(e) => setBeskrivelse(e.target.value)}
              rows={3}
              className="mt-1 w-full text-sm border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={lagre}
            disabled={!navn.trim()}
            className="px-3 py-1.5 text-sm font-semibold bg-[#2d5a3f] hover:bg-[#234731] disabled:opacity-50 text-white rounded-lg cursor-pointer"
          >
            Opprett
          </button>
        </div>
      </div>
    </div>
  );
}
