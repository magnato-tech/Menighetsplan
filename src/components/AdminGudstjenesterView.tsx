import React, { useEffect, useState } from "react";
import {
  DatabaseState,
  rensSted,
  saveDatabase,
  settDeltakelseForPerson,
  personHarAktivTildeling,
  AppView,
} from "../services/dataService";
import { Gudstjeneste, Person } from "../types/database";
import {
  SondagBemanning,
  type OversiktFilter,
  type TildelForesporsel,
} from "./SondagBemanning";
import { Search } from "lucide-react";

interface AdminGudstjenesterViewProps {
  db: DatabaseState;
  onUpdateDb: (updatedDb: DatabaseState) => void;
  vis: boolean;
  hoppTil?: { gudstjenesteId: string; personId: string } | null;
  onSelectPerson: (personId: string, view?: AppView) => void;
  selectedPersonId?: string;
}

export const AdminGudstjenesterView: React.FC<AdminGudstjenesterViewProps> = ({
  db,
  onUpdateDb,
  vis,
  hoppTil = null,
  onSelectPerson,
  selectedPersonId,
}) => {
  const [newServiceModal, setNewServiceModal] = useState(false);
  const [newServiceData, setNewServiceData] = useState<Partial<Gudstjeneste>>({
    Dato: "",
    Tid: "11:00",
    Sted: "Bedehuset",
    Tema: "",
    Bibeltekst: "",
    Kollekt: "",
    Kunngjøringer: "",
    Merknad: "",
  });
  const [assignModal, setAssignModal] = useState<TildelForesporsel | null>(null);
  const [oversiktFilter, setOversiktFilter] = useState<OversiktFilter>(null);
  const [filterGruppeId, setFilterGruppeId] = useState("");
  const [assignSok, setAssignSok] = useState("");

  const handleSaveNewService = () => {
    if (!newServiceData.Dato || !newServiceData.Tema) return;
    const maxGudstjenesteNr = db.gudstjenester.reduce((max, g) => {
      const num = parseInt(g.GudstjenesteID.replace(/\D/g, ""), 10);
      return !isNaN(num) && num > max ? num : max;
    }, 0);
    const newID = `GUD${String(maxGudstjenesteNr + 1).padStart(3, "0")}`;
    const newGudstjeneste: Gudstjeneste = {
      GudstjenesteID: newID,
      Dato: newServiceData.Dato,
      Tid: newServiceData.Tid || "11:00",
      Sted: rensSted(newServiceData.Sted) || "Bedehuset",
      Tema: newServiceData.Tema,
      Bibeltekst: newServiceData.Bibeltekst || "",
      Kollekt: newServiceData.Kollekt || "",
      Kunngjøringer: newServiceData.Kunngjøringer || "",
      Merknad: newServiceData.Merknad || "",
    };
    const updatedDb: DatabaseState = {
      ...db,
      gudstjenester: [...db.gudstjenester, newGudstjeneste],
    };
    saveDatabase(updatedDb);
    onUpdateDb(updatedDb);
    setNewServiceModal(false);
    setNewServiceData({
      Dato: "",
      Tid: "11:00",
      Sted: "Bedehuset",
      Tema: "",
      Bibeltekst: "",
      Kollekt: "",
      Kunngjøringer: "",
      Merknad: "",
    });
  };

  useEffect(() => {
    if (!hoppTil) return;
    setOversiktFilter(null);
  }, [hoppTil]);

  return (
    <>
      <div className={vis ? undefined : "hidden"} hidden={!vis}>
      <SondagBemanning
        db={db}
        onUpdateDb={onUpdateDb}
        rolleIds={
          filterGruppeId
            ? db.roller.filter((r) => r.Aktiv && r.GruppeID === filterGruppeId).map((r) => r.RolleID)
            : undefined
        }
        gruppeId={filterGruppeId || undefined}
        skjulGruppehode={Boolean(filterGruppeId)}
        medlemstall={0}
        visMedlemmerKpi={false}
        kpiTetthet="kompakt"
        verktoyVenstre={
          <div className="min-w-0">
            <label htmlFor="admin-tjenestegruppe" className="sr-only">
              Tjenestegruppe
            </label>
            <select
              id="admin-tjenestegruppe"
              value={filterGruppeId}
              onChange={(e) => setFilterGruppeId(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white h-10"
            >
              <option value="">Alle grupper</option>
              {db.grupper
                .filter((g) => g.Aktiv !== false)
                .map((g) => (
                  <option key={g.GruppeID} value={g.GruppeID}>
                    {g.Gruppenavn}
                  </option>
                ))}
            </select>
          </div>
        }
        kanOpprettGudstjeneste
        onNyGudstjeneste={() => setNewServiceModal(true)}
        visKjoreplan="alltid"
        visBibeltekst
        oversiktFilter={oversiktFilter}
        onOversiktFilter={setOversiktFilter}
        hoppTil={hoppTil}
        vis={vis}
        onSelectPerson={onSelectPerson}
        selectedPersonId={selectedPersonId}
        onTildel={setAssignModal}
        statusAktor="administrator"
        rolleInstruksRedigerbar
      />
      </div>

      {newServiceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-3">Opprett ny gudstjeneste</h3>
            <div className="space-y-3 mb-6 text-xs">
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Dato (YYYY-MM-DD)*:</label>
                <input
                  type="date"
                  value={newServiceData.Dato}
                  onChange={(e) =>
                    setNewServiceData((prev) => ({ ...prev, Dato: e.target.value }))
                  }
                  className="w-full border border-slate-300 rounded-xl p-2 bg-slate-50"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Tema / Tittel*:</label>
                <input
                  type="text"
                  placeholder="e.g. Bønn og faste"
                  value={newServiceData.Tema}
                  onChange={(e) =>
                    setNewServiceData((prev) => ({ ...prev, Tema: e.target.value }))
                  }
                  className="w-full border border-slate-300 rounded-xl p-2 bg-slate-50"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Klokkeslett:</label>
                  <input
                    type="text"
                    value={newServiceData.Tid}
                    onChange={(e) =>
                      setNewServiceData((prev) => ({ ...prev, Tid: e.target.value }))
                    }
                    className="w-full border border-slate-300 rounded-xl p-2 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">Sted:</label>
                  <input
                    type="text"
                    value={newServiceData.Sted}
                    onChange={(e) =>
                      setNewServiceData((prev) => ({ ...prev, Sted: e.target.value }))
                    }
                    className="w-full border border-slate-300 rounded-xl p-2 bg-slate-50"
                  />
                </div>
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Bibeltekst:</label>
                <input
                  type="text"
                  placeholder="e.g. Johannes 3:16"
                  value={newServiceData.Bibeltekst}
                  onChange={(e) =>
                    setNewServiceData((prev) => ({ ...prev, Bibeltekst: e.target.value }))
                  }
                  className="w-full border border-slate-300 rounded-xl p-2 bg-slate-50"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Kollekt:</label>
                <input
                  type="text"
                  placeholder="Hva kollekten går til"
                  value={newServiceData.Kollekt}
                  onChange={(e) =>
                    setNewServiceData((prev) => ({ ...prev, Kollekt: e.target.value }))
                  }
                  className="w-full border border-slate-300 rounded-xl p-2 bg-slate-50"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Kunngjøringer:</label>
                <textarea
                  placeholder="Valgfritt — kan fylles inn senere av møteleder"
                  value={newServiceData.Kunngjøringer}
                  onChange={(e) =>
                    setNewServiceData((prev) => ({ ...prev, Kunngjøringer: e.target.value }))
                  }
                  rows={3}
                  className="w-full border border-slate-300 rounded-xl p-2 bg-slate-50"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewServiceModal(false)}
                className="px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Avbryt
              </button>
              <button
                type="button"
                disabled={!newServiceData.Dato || !newServiceData.Tema}
                onClick={handleSaveNewService}
                className="px-4 py-2 text-xs bg-[#2d5a3f] hover:bg-[#234731] disabled:opacity-50 text-white font-semibold rounded-xl shadow-xs transition cursor-pointer"
              >
                Opprett gudstjeneste
              </button>
            </div>
          </div>
        </div>
      )}

      {assignModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 animate-fadeIn flex items-end sm:items-center justify-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-pointer"
            aria-label="Lukk"
            onClick={() => {
              setAssignModal(null);
              setAssignSok("");
            }}
          />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 sheet-safe-bottom max-h-[90dvh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Tildel person til {assignModal.rolleNavn}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Gudstjeneste: {assignModal.gudstjenesteDato}. Velg en person som allerede ligger i
              personregisteret.
            </p>
            {(() => {
              const q = assignSok.trim().toLowerCase();
              const opptatt = (p: { PersonID: string }) =>
                personHarAktivTildeling(db, p.PersonID, assignModal.gudstjenesteId, assignModal.rolleId);
              const iRollen = db.personer.filter(
                (p) =>
                  !opptatt(p) &&
                  db.personroller.some(
                    (pr) => pr.PersonID === p.PersonID && pr.RolleID === assignModal.rolleId && pr.Aktiv
                  ) &&
                  (!q || p.Navn.toLowerCase().includes(q) || (p.Fornavn || "").toLowerCase().includes(q))
              );
              const ovrige = db.personer.filter(
                (p) =>
                  p.Aktiv !== false &&
                  !opptatt(p) &&
                  !iRollen.some((x) => x.PersonID === p.PersonID) &&
                  q &&
                  (p.Navn.toLowerCase().includes(q) || (p.Fornavn || "").toLowerCase().includes(q))
              ).slice(0, 12);
              const velg = (personId: string) => {
                const updated = settDeltakelseForPerson(
                  db,
                  personId,
                  assignModal.gudstjenesteId,
                  assignModal.rolleId,
                  "Avventer",
                  "Forespurt av administrator"
                );
                saveDatabase(updated);
                onUpdateDb(updated);
                setAssignModal(null);
                setAssignSok("");
              };
              return (
                <div className="space-y-3 mb-4">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={assignSok}
                      onChange={(e) => setAssignSok(e.target.value)}
                      placeholder="Søk i registeret…"
                      autoFocus
                      className="w-full text-base md:text-sm border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 bg-slate-50"
                    />
                  </div>
                  <ul className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
                    {iRollen.length === 0 ? (
                      <li className="px-4 py-3 text-sm text-slate-500">Ingen med denne rollen ledige.</li>
                    ) : (
                      iRollen.map((p: Person) => (
                        <li key={p.PersonID}>
                          <button
                            type="button"
                            onClick={() => velg(p.PersonID)}
                            className="w-full text-left px-4 py-3 text-sm font-medium cursor-pointer hover:bg-[#eef5f1]"
                          >
                            {p.Fornavn || p.Navn}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                  {ovrige.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Øvrige</p>
                      <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
                        {ovrige.map((p) => (
                          <li key={p.PersonID}>
                            <button
                              type="button"
                              onClick={() => velg(p.PersonID)}
                              className="w-full text-left px-4 py-3 text-sm cursor-pointer hover:bg-[#eef5f1]"
                            >
                              {p.Navn}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}
            <p className="text-xs text-slate-500 border-t border-slate-100 pt-3">
              Ny person opprettes under Personregister. Deretter kan du søke dem frem her.
            </p>
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={() => {
                  setAssignModal(null);
                  setAssignSok("");
                }}
                className="px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
