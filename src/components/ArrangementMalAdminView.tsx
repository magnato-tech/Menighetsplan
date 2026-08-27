import React, { useMemo, useState } from "react";
import { ClipboardList, Clock3, Copy, Plus, Trash2 } from "lucide-react";
import {
  DatabaseState,
  aktiveMaler,
  bemanningFraMal,
  kjoreplanRolleIder,
  kopierMal,
  leggTilMalTilleggsvakt,
  nyMalPost,
  omskrivMalPostRekkefolge,
  oppdaterMalNavn,
  oppdaterMalTilleggsvaktAntall,
  opprettMal,
  saveDatabase,
  slettMalTilleggsvakt,
  sortertMalposter,
} from "../services/dataService";
import { ProgramKjoreplan } from "./ProgramKjoreplan";
import { ProgramBrikkeFelt } from "./ProgramBrikke";
import { RolleIkon } from "./RolleIkon";

interface ArrangementMalAdminViewProps {
  db: DatabaseState;
  onUpdateDb: (updatedDb: DatabaseState) => void;
}

export const ArrangementMalAdminView: React.FC<ArrangementMalAdminViewProps> = ({ db, onUpdateDb }) => {
  const maler = aktiveMaler(db);
  const [malId, setMalId] = useState(maler[0]?.MalID || "");
  const [fane, setFane] = useState<"kjoreplan" | "bemanning">("kjoreplan");
  const valgt = maler.find((m) => m.MalID === malId) || maler[0];
  const aktivMalId = valgt?.MalID || "";
  const poster = sortertMalposter(db, aktivMalId);
  const bemanning = bemanningFraMal(db, aktivMalId);
  const kjoreIder = new Set(kjoreplanRolleIder(db, aktivMalId));
  const tilleggsvakter = (db.malTilleggsvakter || []).filter(
    (t) => t.MalID === aktivMalId && t.Aktiv !== false && !kjoreIder.has(t.RolleID)
  );
  const rollerSomKanLegges = useMemo(
    () =>
      db.roller.filter(
        (r) =>
          r.Aktiv !== false &&
          !kjoreIder.has(r.RolleID) &&
          !tilleggsvakter.some((t) => t.RolleID === r.RolleID)
      ),
    [db.roller, kjoreIder, tilleggsvakter]
  );

  const persister = (updated: DatabaseState) => {
    saveDatabase(updated);
    onUpdateDb(updated);
  };

  const lagNyMal = () => {
    const { db: neste, malId: id } = opprettMal(db, "Ny mal");
    persister(neste);
    setMalId(id);
    setFane("kjoreplan");
  };

  const lagKopi = () => {
    if (!aktivMalId) return;
    const { db: neste, malId: id } = kopierMal(db, aktivMalId);
    if (!id) return;
    persister(neste);
    setMalId(id);
    setFane("kjoreplan");
  };

  const oppdaterPoster = (neste: typeof poster) => {
    const resten = (db.malposter || []).filter((p) => p.MalID !== aktivMalId);
    persister({ ...db, malposter: [...resten, ...omskrivMalPostRekkefolge(neste)] });
  };

  if (!valgt) {
    return (
      <div className="space-y-3 max-w-3xl">
        <p className="text-sm text-slate-600">Ingen arrangementmaler er lastet inn ennå.</p>
        <button
          type="button"
          onClick={lagNyMal}
          className="min-h-11 px-3 py-2 bg-[#2d5a3f] text-white text-xs font-semibold rounded-xl cursor-pointer inline-flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Ny mal
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Arrangementmaler</h3>
        <p className="text-sm text-slate-600 mt-1">
          Brukes når du oppretter nye arrangementer. Søndagens standard kjøreplan ligger uendret under
          Programmal.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-xs font-semibold text-slate-600">
          Mal
          <select
            value={aktivMalId}
            onChange={(e) => {
              setMalId(e.target.value);
              setFane("kjoreplan");
            }}
            className="mt-1 block border border-slate-300 rounded-xl px-3 py-2 text-sm font-normal text-slate-900"
          >
            {maler.map((m) => (
              <option key={m.MalID} value={m.MalID}>
                {m.Navn}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600 flex-1 min-w-48">
          Navn
          <input
            type="text"
            value={valgt.Navn}
            onChange={(e) => persister(oppdaterMalNavn(db, aktivMalId, e.target.value))}
            className="mt-1 w-full border border-slate-300 rounded-xl px-3 py-2 text-sm font-normal text-slate-900"
          />
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
          className="min-h-11 px-3 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer inline-flex items-center gap-1.5"
        >
          <Copy className="w-3.5 h-3.5" />
          Kopier mal
        </button>
      </div>

      <div className="flex gap-2">
        {(
          [
            ["kjoreplan", "Kjøreplan", Clock3],
            ["bemanning", "Bemanning", ClipboardList],
          ] as const
        ).map(([id, merke, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFane(id)}
            className={`min-h-11 px-3 py-1.5 text-xs font-semibold rounded-xl cursor-pointer inline-flex items-center gap-1.5 ${
              fane === id ? "bg-[#2d5a3f] text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {merke}
          </button>
        ))}
      </div>

      {fane === "kjoreplan" ? (
        <ProgramKjoreplan
          linjer={poster.map((m) => {
            const rolle = m.RolleID ? db.roller.find((r) => r.RolleID === m.RolleID) : undefined;
            const gruppe = rolle?.GruppeID
              ? db.grupper.find((g) => g.GruppeID === rolle.GruppeID)
              : undefined;
            return {
              id: m.MalPostID,
              tittel: m.Tittel,
              varighetMin: m.VarighetMin,
              rolleId: m.RolleID || "",
              forStart: Boolean(m.ForStart),
              merknad: m.Merknad,
              rolleNavn: rolle?.Rollenavn,
              gruppeNavn: gruppe?.Gruppenavn,
              personer: [],
            };
          })}
          roller={db.roller}
          redigerbar
          visKlokkeslett={false}
          visPersonHint
          onChangeLinje={(id, patch: Partial<ProgramBrikkeFelt>) => {
            oppdaterPoster(
              poster.map((m) =>
                m.MalPostID === id
                  ? {
                      ...m,
                      Tittel: patch.tittel ?? m.Tittel,
                      VarighetMin: patch.varighetMin ?? m.VarighetMin,
                      RolleID: patch.rolleId !== undefined ? patch.rolleId : m.RolleID,
                      ForStart: patch.forStart ?? m.ForStart,
                      Merknad: patch.merknad ?? m.Merknad,
                    }
                  : m
              )
            );
          }}
          onDeleteLinje={(id) => oppdaterPoster(poster.filter((m) => m.MalPostID !== id))}
          onMove={(from, to) => {
            const neste = [...poster];
            const [item] = neste.splice(from, 1);
            neste.splice(to, 0, item);
            oppdaterPoster(neste);
          }}
          onNyAktivitet={() => oppdaterPoster([...poster, nyMalPost(db.malposter || [], aktivMalId)])}
        />
      ) : (
        <div className="space-y-6">
          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Standard bemanning</h4>
            <p className="text-xs text-slate-500 mb-2">Oppgaver fra kjøreplanen (ikke redigerbar her)</p>
            <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {bemanning.filter((r) => r.kilde === "kjoreplan").length === 0 ? (
                <li className="px-4 py-3 text-sm text-slate-500">Ingen roller i kjøreplanen.</li>
              ) : (
                bemanning
                  .filter((r) => r.kilde === "kjoreplan")
                  .map((rad) => {
                    const rolle = db.roller.find((r) => r.RolleID === rad.rolleId);
                    return (
                      <li key={rad.rolleId} className="px-4 py-2.5 flex items-center gap-2 text-sm">
                        <RolleIkon rollenavn={rolle?.Rollenavn || ""} />
                        <span className="font-medium text-slate-800">{rolle?.Rollenavn || rad.rolleId}</span>
                        <span className="ml-auto text-xs text-slate-500">behov {rad.antall}</span>
                      </li>
                    );
                  })
              )}
            </ul>
          </section>

          <section>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Tilleggsvakter</h4>
            <p className="text-xs text-slate-500 mb-2">Manuelt lagt til (kan redigeres)</p>
            <ul className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {tilleggsvakter.length === 0 ? (
                <li className="px-4 py-3 text-sm text-slate-500">Ingen tilleggsvakter.</li>
              ) : (
                tilleggsvakter.map((t) => {
                  const rolle = db.roller.find((r) => r.RolleID === t.RolleID);
                  return (
                    <li key={t.MalTilleggsvaktID} className="px-4 py-2.5 flex items-center gap-2 text-sm">
                      <RolleIkon rollenavn={rolle?.Rollenavn || ""} />
                      <span className="flex-1 font-medium text-slate-800">{rolle?.Rollenavn || t.RolleID}</span>
                      <input
                        type="number"
                        min={0}
                        value={t.Antall}
                        onChange={(e) =>
                          persister(oppdaterMalTilleggsvaktAntall(db, t.MalTilleggsvaktID, Number(e.target.value) || 0))
                        }
                        className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-xs"
                        aria-label="Behov"
                      />
                      <button
                        type="button"
                        onClick={() => persister(slettMalTilleggsvakt(db, t.MalTilleggsvaktID))}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                        aria-label="Fjern tilleggsvakt"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
            {rollerSomKanLegges.length > 0 && (
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <Plus className="w-3.5 h-3.5" />
                Legg til tilleggsvakt
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) return;
                    persister(leggTilMalTilleggsvakt(db, aktivMalId, id));
                    e.target.value = "";
                  }}
                  className="border border-slate-300 rounded-xl px-2 py-1.5 text-sm"
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
          </section>
        </div>
      )}
    </div>
  );
};
