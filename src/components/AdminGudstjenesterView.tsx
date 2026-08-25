import React, { useEffect, useState } from "react";
import {
  DatabaseState,
  genererPersonligLenke,
  opprettPersonIRegister,
  rensSted,
  saveDatabase,
  settDeltakelseForPerson,
  personHarAktivTildeling,
  finnPersonMedVisningsnavn,
  AppView,
  gruppetypeNokkel,
} from "../services/dataService";
import { Gudstjeneste, Person } from "../types/database";
import { IkonHandling } from "./IkonHandling";
import {
  SondagBemanning,
  gruppeRaderForGudstjeneste,
  type OversiktFilter,
  type TildelForesporsel,
} from "./SondagBemanning";
import { Share2, Search } from "lucide-react";

interface AdminGudstjenesterViewProps {
  db: DatabaseState;
  onUpdateDb: (updatedDb: DatabaseState) => void;
  vis: boolean;
  onByttTilGrupper: (gruppetypeId: string) => void;
  hoppTil?: { gudstjenesteId: string; personId: string } | null;
  onSelectPerson: (personId: string, view?: AppView) => void;
  selectedPersonId?: string;
}

function iDagIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function unikeTjenestemedlemmer(db: DatabaseState): number {
  const gruppeIds = new Set(
    db.roller.filter((r) => r.Aktiv && r.GruppeID).map((r) => r.GruppeID as string)
  );
  const ids = new Set<string>();
  for (const gruppe of db.grupper) {
    if (!gruppeIds.has(gruppe.GruppeID)) continue;
    for (const gm of db.gruppemedlemmer) {
      if (gm.GruppeID === gruppe.GruppeID && gm.Aktiv) ids.add(gm.PersonID);
    }
    if (gruppe.GruppelederID) ids.add(gruppe.GruppelederID);
    if (gruppe.NestlederID) ids.add(gruppe.NestlederID);
  }
  return ids.size;
}

export const AdminGudstjenesterView: React.FC<AdminGudstjenesterViewProps> = ({
  db,
  onUpdateDb,
  vis,
  onByttTilGrupper,
  hoppTil = null,
  onSelectPerson,
  selectedPersonId,
}) => {
  const [copiedPersonId, setCopiedPersonId] = useState<string | null>(null);
  const [newServiceModal, setNewServiceModal] = useState(false);
  const [newServiceData, setNewServiceData] = useState<Partial<Gudstjeneste>>({
    Dato: "",
    Tid: "11:00",
    Sted: "Bedehuset",
    Tema: "",
    Bibeltekst: "",
    Kollekt: "",
    Merknad: "",
  });
  const [assignNewFornavn, setAssignNewFornavn] = useState("");
  const [assignModal, setAssignModal] = useState<TildelForesporsel | null>(null);
  const [personToAssign, setPersonToAssign] = useState("");
  const [folgOppLederId, setFolgOppLederId] = useState<string | null>(null);
  const [oversiktFilter, setOversiktFilter] = useState<OversiktFilter>(null);
  const [filterGruppeId, setFilterGruppeId] = useState("");
  const [assignSok, setAssignSok] = useState("");

  const iDag = iDagIso();
  const kommendeGudstjenester = db.gudstjenester.filter((g) => g.Dato >= iDag);

  const lederOppfolging = (() => {
    const perLeder = new Map<
      string,
      { personId: string; fornavn: string; navn: string; sondager: Set<string> }
    >();
    for (const gud of kommendeGudstjenester) {
      for (const rad of gruppeRaderForGudstjeneste(db, gud.GudstjenesteID)) {
        if (rad.tall.ledige <= 0 || !rad.lederId) continue;
        const eksisterende = perLeder.get(rad.lederId);
        if (eksisterende) {
          eksisterende.sondager.add(gud.GudstjenesteID);
        } else {
          perLeder.set(rad.lederId, {
            personId: rad.lederId,
            fornavn: rad.lederFornavn || rad.lederNavn || "Leder",
            navn: rad.lederNavn || rad.lederFornavn || "Leder",
            sondager: new Set([gud.GudstjenesteID]),
          });
        }
      }
    }
    return Array.from(perLeder.values()).sort((a, b) => b.sondager.size - a.sondager.size);
  })();

  const handleCopyLink = (personId: string) => {
    const link = genererPersonligLenke(personId, db);
    navigator.clipboard.writeText(link).then(() => {
      setCopiedPersonId(personId);
      setTimeout(() => setCopiedPersonId(null), 2500);
    });
  };

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
      Merknad: "",
    });
  };

  const handleCreateAndAssign = () => {
    if (!assignModal) return;
    const fornavn = assignNewFornavn.trim();
    if (!fornavn) return;
    const eksisterende = finnPersonMedVisningsnavn(db, fornavn);
    if (eksisterende) {
      const updated = settDeltakelseForPerson(
        db,
        eksisterende.PersonID,
        assignModal.gudstjenesteId,
        assignModal.rolleId,
        "Avventer",
        "Forespurt av administrator"
      );
      saveDatabase(updated);
      onUpdateDb(updated);
      setAssignModal(null);
      setPersonToAssign("");
      setAssignNewFornavn("");
      return;
    }
    const gud = db.gudstjenester.find((g) => g.GudstjenesteID === assignModal.gudstjenesteId);
    const updatedDb = opprettPersonIRegister(db, { Navn: fornavn }, [
      {
        gudstjenesteId: assignModal.gudstjenesteId,
        rolleId: assignModal.rolleId,
        rolleNavn: assignModal.rolleNavn,
        dato: gud?.Dato || "",
      },
    ]);
    saveDatabase(updatedDb);
    onUpdateDb(updatedDb);
    setAssignModal(null);
    setPersonToAssign("");
    setAssignNewFornavn("");
  };

  const handleAssignPerson = () => {
    if (!assignModal || !personToAssign) return;
    if (
      personHarAktivTildeling(
        db,
        personToAssign,
        assignModal.gudstjenesteId,
        assignModal.rolleId
      )
    ) {
      setAssignModal(null);
      setPersonToAssign("");
      return;
    }
    const updated = settDeltakelseForPerson(
      db,
      personToAssign,
      assignModal.gudstjenesteId,
      assignModal.rolleId,
      "Avventer",
      "Forespurt av administrator"
    );
    saveDatabase(updated);
    onUpdateDb(updated);
    setAssignModal(null);
    setPersonToAssign("");
  };

  useEffect(() => {
    if (!hoppTil) return;
    setOversiktFilter(null);
    setFolgOppLederId(null);
  }, [hoppTil]);

  return (
    <>
      <div className={vis ? undefined : "hidden"} hidden={!vis}>
      <div className="mb-3">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tjenestegruppe</label>
        <select
          value={filterGruppeId}
          onChange={(e) => setFilterGruppeId(e.target.value)}
          className="mt-1 w-full sm:max-w-xs text-sm border border-slate-300 rounded-xl px-3 py-2.5 bg-white"
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
        medlemstall={unikeTjenestemedlemmer(db)}
        kpiTittel="Semesteret totalt"
        kpiBeskrivelse="Alle tjenestegrupper på kommende gudstjenester. Trykk et kort for å filtrere."
        kanOpprettGudstjeneste
        onNyGudstjeneste={() => setNewServiceModal(true)}
        kanSeSomLeder
        visKjoreplan="alltid"
        visBibeltekst
        oversiktFilter={oversiktFilter}
        onOversiktFilter={setOversiktFilter}
        onMedlemmer={() => {
          const tjeneste = db.gruppetyper.find(
            (gt) => gruppetypeNokkel(gt.Navn) === "tjenestegruppe"
          );
          onByttTilGrupper(tjeneste?.GruppetypeID || "alle");
        }}
        folgOppLederId={folgOppLederId}
        hoppTil={hoppTil}
        vis={vis}
        onSelectPerson={onSelectPerson}
        selectedPersonId={selectedPersonId}
        onTildel={setAssignModal}
        onCopyLink={handleCopyLink}
        copiedPersonId={copiedPersonId}
        statusAktor="administrator"
        rolleInstruksRedigerbar
        afterKpi={
          lederOppfolging.length > 0 ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
                  Følg opp
                </span>
                {lederOppfolging.map((leder) => {
                  const valgt = folgOppLederId === leder.personId;
                  return (
                    <span
                      key={leder.personId}
                      className={`inline-flex items-center gap-1 rounded-lg pl-1.5 pr-0.5 py-0.5 ${
                        valgt ? "bg-[#eef5f1] ring-2 ring-[#2d5a3f]/35" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setFolgOppLederId((prev) =>
                            prev === leder.personId ? null : leder.personId
                          )
                        }
                        aria-pressed={valgt}
                        title={
                          valgt
                            ? "Vis alle kommende gudstjenester"
                            : `Vis søndager der ${leder.navn} har ledige plasser`
                        }
                        className="text-sm font-semibold text-slate-900 cursor-pointer hover:text-[#2d5a3f]"
                      >
                        {leder.fornavn}
                        <span className="text-slate-500 font-medium"> ({leder.sondager.size})</span>
                      </button>
                      <IkonHandling
                        label={`Kopier personlenke til ${leder.navn}`}
                        Icon={Share2}
                        variant="sky"
                        copied={copiedPersonId === leder.personId}
                        onClick={() => handleCopyLink(leder.personId)}
                      />
                    </span>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Alle grupper er dekket på kommende søndager.</p>
          )
        }
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
              setAssignNewFornavn("");
              setAssignSok("");
            }}
          />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 sheet-safe-bottom max-h-[90dvh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Tildel person til {assignModal.rolleNavn}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Gudstjeneste: {assignModal.gudstjenesteDato}
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
                setPersonToAssign(personId);
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
                setPersonToAssign("");
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
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <label className="text-xs font-semibold text-slate-600 block">
                Eller opprett ny person
              </label>
              <input
                type="text"
                placeholder="Fornavn, eller fornavn etternavn"
                value={assignNewFornavn}
                onChange={(e) => setAssignNewFornavn(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-xl p-2.5 bg-slate-50"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAssignModal(null);
                  setAssignNewFornavn("");
                }}
                className="px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Avbryt
              </button>
              {assignNewFornavn.trim() ? (
                <button
                  type="button"
                  onClick={handleCreateAndAssign}
                  className="px-4 py-2 text-xs bg-[#2d5a3f] hover:bg-[#234731] text-white font-semibold rounded-xl shadow-xs transition cursor-pointer"
                >
                  Opprett og tildel
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!personToAssign}
                  onClick={handleAssignPerson}
                  className="px-4 py-2 text-xs bg-[#2d5a3f] hover:bg-[#234731] disabled:opacity-50 text-white font-semibold rounded-xl shadow-xs transition cursor-pointer"
                >
                  Lagre tildeling
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
