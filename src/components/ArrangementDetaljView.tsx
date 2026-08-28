import React, { useState } from "react";
import { Check, Sliders, Trash2, UserPlus, X } from "lucide-react";
import {
  DatabaseState,
  bemanningForArrangement,
  bemanningFraMal,
  erGudstjenesteBemanningRolle,
  erHendelseRad,
  fjernArrangementVakt,
  getEffektivtBehov,
  hentSvarStatus,
  leggTilArrangementVakt,
  personHarAktivTildeling,
  saveDatabase,
  settDeltakelseForPerson,
  settTjenestebehov,
  slettArrangement,
  svarPaaTildeling,
  tildelingVisningsnavn,
} from "../services/dataService";
import { Arrangement, Person, Rolle } from "../types/database";
import { RolleIkon } from "./RolleIkon";
import { IkonHandling } from "./IkonHandling";
import { GudstjenesteProgramView } from "./GudstjenesteProgramView";
import { KalenderTagger } from "./KalenderTagger";
import { Plus, Search } from "lucide-react";

interface ArrangementDetaljViewProps {
  db: DatabaseState;
  arrangement: Arrangement;
  selectedPersonId?: string;
  onUpdateDb: (updatedDb: DatabaseState) => void;
  onClose: () => void;
  lese?: boolean;
}

function formatDatoNo(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export const ArrangementDetaljView: React.FC<ArrangementDetaljViewProps> = ({
  db,
  arrangement,
  selectedPersonId,
  onUpdateDb,
  onClose,
  lese = false,
}) => {
  const [fane, setFane] = useState<"bemanning" | "kjoreplan">(lese ? "kjoreplan" : "bemanning");
  const [behovRolle, setBehovRolle] = useState<Rolle | null>(null);
  const [behovTall, setBehovTall] = useState(1);
  const [tildelRolle, setTildelRolle] = useState<Rolle | null>(null);
  const [sok, setSok] = useState("");

  const arId = arrangement.ArrangementID;
  const arrBemanning = bemanningForArrangement(db, arId);
  const malRolleIder = new Set(
    arrangement.MalID ? bemanningFraMal(db, arrangement.MalID).map((r) => r.rolleId) : []
  );
  const roller =
    arrBemanning === null
      ? db.roller.filter((r) => r.Aktiv && erGudstjenesteBemanningRolle(db, r))
      : arrBemanning
          .map((rad) => db.roller.find((r) => r.RolleID === rad.rolleId))
          .filter((r): r is Rolle => Boolean(r && r.Aktiv));
  const visLeggTilVakt = arrBemanning !== null;
  const rollerSomKanLegges = visLeggTilVakt
    ? db.roller.filter((r) => r.Aktiv !== false && !roller.some((x) => x.RolleID === r.RolleID))
    : [];

  const persister = (neste: typeof db) => {
    saveDatabase(neste);
    onUpdateDb(neste);
  };

  const visningsGud = {
    GudstjenesteID: "",
    Dato: arrangement.Dato,
    Tid: arrangement.Tid,
    Sted: arrangement.Sted,
    Tema: arrangement.Tittel,
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center sm:p-4">
      <button type="button" className="absolute inset-0 cursor-pointer" aria-label="Lukk" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl max-w-2xl w-full max-h-[92dvh] overflow-y-auto shadow-2xl border border-slate-200">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Arrangement</p>
            <h3 className="text-lg font-bold text-slate-900">{arrangement.Tittel}</h3>
            <p className="text-sm text-slate-600 capitalize">{formatDatoNo(arrangement.Dato)}</p>
            <p className="text-sm text-slate-600">
              {arrangement.Tid}
              {arrangement.Sted ? ` · ${arrangement.Sted}` : ""}
            </p>
            {arrangement.Tagger?.length ? (
              <KalenderTagger tagger={arrangement.Tagger} className="mt-2" />
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            {!lese && (
            <button
              type="button"
              onClick={() => {
                if (!window.confirm("Slette dette arrangementet?")) return;
                persister(slettArrangement(db, arId));
                onClose();
              }}
              className="p-2 min-h-11 min-w-11 text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
              aria-label="Slett"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 min-h-11 min-w-11 text-slate-500 hover:bg-slate-100 rounded-xl cursor-pointer"
              aria-label="Lukk"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-5 pt-3 flex gap-2">
          {(
            [
              ["bemanning", "Bemanning"],
              ["kjoreplan", "Kjøreplan"],
            ] as const
          ).map(([id, merke]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFane(id)}
              className={`min-h-11 px-3 py-1.5 text-xs font-semibold rounded-xl cursor-pointer ${
                fane === id ? "bg-[#2d5a3f] text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {merke}
            </button>
          ))}
        </div>

        {fane === "bemanning" ? (
          <div className="px-2 py-3">
            {arrangement.MalID && (
              <p className="px-3 py-2 text-xs text-slate-500">
                Mal: {db.maler.find((m) => m.MalID === arrangement.MalID)?.Navn || arrangement.MalID}
              </p>
            )}
            <div className="divide-y divide-slate-100">
            {roller.length === 0 ? (
              <p className="px-3 py-6 text-sm text-slate-500 text-center">
                {lese
                  ? "Ingen bemanning er satt på dette arrangementet ennå."
                  : "Ingen bemanning ennå. Legg til en vakt under, eller sett rolle på en programpost."}
              </p>
            ) : (
            roller.map((rolle) => {
              const behov = getEffektivtBehov(db, "", rolle, arId);
              const tildelinger = db.tildelinger.filter(
                (t) => erHendelseRad(t, "", arId) && t.RolleID === rolle.RolleID
              );
              const rad = arrBemanning?.find((r) => r.rolleId === rolle.RolleID);
              const kanFjernes = rad?.kilde === "tillegg" && !malRolleIder.has(rolle.RolleID);
              return (
                <div key={rolle.RolleID} className="px-3 py-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <RolleIkon rollenavn={rolle.Rollenavn} />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                      {rolle.Rollenavn}
                    </span>
                    <span className="text-xs text-slate-500">behov {behov}</span>
                    <div className="ml-auto flex gap-1">
                      {!lese && (
                        <>
                      <IkonHandling
                        label="Juster behov"
                        Icon={Sliders}
                        onClick={() => {
                          setBehovRolle(rolle);
                          setBehovTall(behov);
                        }}
                      />
                      <IkonHandling
                        label="Tildel"
                        Icon={UserPlus}
                        onClick={() => {
                          setTildelRolle(rolle);
                          setSok("");
                        }}
                      />
                      {kanFjernes && (
                        <IkonHandling
                          label="Fjern vakt"
                          Icon={Trash2}
                          variant="decline"
                          onClick={() => persister(fjernArrangementVakt(db, arId, rolle.RolleID))}
                        />
                      )}
                        </>
                      )}
                    </div>
                  </div>
                  {tildelinger.length === 0 ? (
                    <p className="text-xs text-slate-400 pl-8">Ingen tildelt</p>
                  ) : (
                    <ul className="pl-8 space-y-1">
                      {tildelinger.map((t) => {
                        const status = hentSvarStatus(db, t.TildelingID);
                        return (
                          <li key={t.TildelingID} className="flex items-center gap-2 text-sm">
                            <span className="flex-1">{tildelingVisningsnavn(db, t)}</span>
                            {!lese && (
                              <>
                            <IkonHandling
                              label="Bekreft"
                              Icon={Check}
                              variant="confirm"
                              active={status === "Bekreftet"}
                              onClick={() =>
                                persister(
                                  svarPaaTildeling(db, t.TildelingID, t.PersonID, "Bekreftet", "Bekreftet av administrator")
                                )
                              }
                            />
                            <IkonHandling
                              label="Fjern"
                              Icon={Trash2}
                              variant="decline"
                              onClick={() =>
                                persister({
                                  ...db,
                                  tildelinger: db.tildelinger.filter((x) => x.TildelingID !== t.TildelingID),
                                  svar: db.svar.filter((s) => s.TildelingID !== t.TildelingID),
                                })
                              }
                            />
                              </>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })
            )}
            </div>
            {visLeggTilVakt && !lese && rollerSomKanLegges.length > 0 && (
              <label className="mt-3 px-3 flex items-center gap-2 text-xs text-slate-600">
                <Plus className="w-3.5 h-3.5" />
                Legg til vakt
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) return;
                    persister(leggTilArrangementVakt(db, arId, id));
                    e.target.value = "";
                  }}
                  className="border border-slate-300 rounded-xl px-2 py-1.5 text-sm text-slate-900"
                >
                  <option value="">Velg rolle…</option>
                  {rollerSomKanLegges.map((r) => (
                    <option key={r.RolleID} value={r.RolleID}>
                      {r.Rollenavn}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        ) : (
          <GudstjenesteProgramView
            db={db}
            gudstjeneste={visningsGud}
            redigerbar={!lese}
            selectedPersonId={selectedPersonId}
            iDialog
            arrangementId={arId}
            hendelseEtikett="arrangementet"
            onUpdateDb={onUpdateDb}
          />
        )}
      </div>

      {behovRolle && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/40 cursor-pointer" onClick={() => setBehovRolle(null)} />
          <div className="relative bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h4 className="font-bold text-slate-900 mb-3">Behov · {behovRolle.Rollenavn}</h4>
            <input
              type="number"
              min={0}
              value={behovTall}
              onChange={(e) => setBehovTall(Number(e.target.value) || 0)}
              className="w-full border border-slate-300 rounded-xl p-2 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="px-3 py-2 text-xs cursor-pointer" onClick={() => setBehovRolle(null)}>
                Avbryt
              </button>
              <button
                type="button"
                className="px-3 py-2 bg-[#2d5a3f] text-white text-xs font-semibold rounded-xl cursor-pointer"
                onClick={() => {
                  persister(settTjenestebehov(db, behovRolle.RolleID, behovTall, "", arId));
                  setBehovRolle(null);
                }}
              >
                Lagre
              </button>
            </div>
          </div>
        </div>
      )}

      {tildelRolle && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 cursor-pointer"
            onClick={() => setTildelRolle(null)}
          />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl p-5 w-full max-w-md shadow-xl max-h-[80dvh] overflow-y-auto">
            <h4 className="font-bold text-slate-900 mb-1">Tildel · {tildelRolle.Rollenavn}</h4>
            <div className="relative my-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={sok}
                onChange={(e) => setSok(e.target.value)}
                placeholder="Søk i registeret…"
                className="w-full text-sm border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 bg-slate-50"
              />
            </div>
            <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl max-h-56 overflow-y-auto">
              {db.personer
                .filter((p) => p.Aktiv !== false)
                .filter(
                  (p) =>
                    !personHarAktivTildeling(db, p.PersonID, "", tildelRolle.RolleID, arId) &&
                    (!sok.trim() ||
                      p.Navn.toLowerCase().includes(sok.trim().toLowerCase()) ||
                      (p.Fornavn || "").toLowerCase().includes(sok.trim().toLowerCase()))
                )
                .slice(0, 20)
                .map((p: Person) => (
                  <li key={p.PersonID}>
                    <button
                      type="button"
                      className="w-full text-left px-4 py-3 text-sm cursor-pointer hover:bg-[#eef5f1]"
                      onClick={() => {
                        persister(
                          settDeltakelseForPerson(
                            db,
                            p.PersonID,
                            "",
                            tildelRolle.RolleID,
                            "Avventer",
                            "Forespurt av administrator",
                            arId
                          )
                        );
                        setTildelRolle(null);
                      }}
                    >
                      {p.Fornavn || p.Navn}
                    </button>
                  </li>
                ))}
            </ul>
            <button
              type="button"
              className="mt-3 text-xs text-slate-600 cursor-pointer"
              onClick={() => setTildelRolle(null)}
            >
              Avbryt
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
