import React, { useMemo, useState } from "react";
import {
  DatabaseState,
  belastningForSemester,
  type BelastningPersonRad,
} from "../services/dataService";
import { Search, Filter, Gauge, Users, Layers } from "lucide-react";

interface BelastningViewProps {
  db: DatabaseState;
  onVelgGudstjeneste?: (gudstjenesteId: string, personId: string) => void;
}

function kortDato(iso: string): string {
  const [, m, d] = iso.split("-");
  if (!m || !d) return iso;
  return `${d}.${m}`;
}

function radBakgrunn(oppgaver: number): string {
  if (oppgaver >= 5) return "bg-[#eef5f1]";
  if (oppgaver >= 3) return "bg-[#f7faf8]";
  return "";
}

export const BelastningView: React.FC<BelastningViewProps> = ({
  db,
  onVelgGudstjeneste,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [gruppeFilter, setGruppeFilter] = useState("all");
  const [kunFlereSammeDag, setKunFlereSammeDag] = useState(true);
  const [skjulTomme, setSkjulTomme] = useState(true);

  const iDag = new Date().toISOString().split("T")[0];
  const semester = useMemo(() => belastningForSemester(db, iDag), [db, iDag]);

  const filtrert = semester.rader.filter((rad) => {
    if (kunFlereSammeDag && !rad.harFlereSammeDag) return false;
    if (skjulTomme && rad.oppgaver === 0) return false;
    if (gruppeFilter !== "all" && !rad.gruppeIds.includes(gruppeFilter)) return false;
    const q = searchTerm.trim().toLowerCase();
    if (q && !rad.navn.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Kommende gudstjenester
          </p>
          <p className="text-sm text-slate-600">
            Bekreftet og forespurt. Flere oppgaver samme søndag er greit — sjekk om de kan gjøres samtidig.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="text-left rounded-2xl border px-4 py-3 bg-emerald-50 border-emerald-100 text-emerald-900">
            <div className="flex items-start justify-between gap-2">
              <span className="text-3xl font-bold tabular-nums leading-none">
                {semester.hoyestLast?.oppgaver ?? 0}
              </span>
              <Gauge className="w-6 h-6 text-emerald-600 shrink-0" />
            </div>
            <p className="text-xs font-semibold mt-2 leading-snug">
              Høyest last
              {semester.hoyestLast ? ` · ${semester.hoyestLast.navn}` : " · ingen ennå"}
            </p>
          </div>
          <div className="text-left rounded-2xl border px-4 py-3 bg-sky-50 border-sky-100 text-sky-950">
            <div className="flex items-start justify-between gap-2">
              <span className="text-3xl font-bold tabular-nums leading-none">{semester.utenOppgaver}</span>
              <Users className="w-6 h-6 text-sky-600 shrink-0" />
            </div>
            <p className="text-xs font-semibold mt-2 leading-snug">Uten oppgaver</p>
          </div>
          <button
            type="button"
            onClick={() => setKunFlereSammeDag((v) => !v)}
            aria-pressed={kunFlereSammeDag}
            className={`text-left rounded-2xl border px-4 py-3 bg-amber-50 border-amber-100 text-amber-950 cursor-pointer transition ${
              kunFlereSammeDag ? "ring-2 ring-amber-400" : "hover:brightness-[0.98]"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-3xl font-bold tabular-nums leading-none">{semester.flereSammeDag}</span>
              <Layers className="w-6 h-6 text-amber-600 shrink-0" />
            </div>
            <p className="text-xs font-semibold mt-2 leading-snug">Flere oppgaver samme dag</p>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3.5 rounded-2xl border border-slate-200">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Søk på navn..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={gruppeFilter}
            onChange={(e) => setGruppeFilter(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-xl p-2 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
          >
            <option value="all">Alle grupper</option>
            {db.grupper
              .filter((g) => g.Aktiv)
              .map((g) => (
                <option key={g.GruppeID} value={g.GruppeID}>
                  {g.Gruppenavn}
                </option>
              ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={skjulTomme}
            onChange={(e) => setSkjulTomme(e.target.checked)}
            className="rounded border-slate-300"
          />
          Skjul personer uten oppgaver
        </label>
      </div>

      <div className="md:hidden space-y-2">
        {filtrert.map((rad) => (
          <div key={rad.personId} className="bg-white rounded-xl border border-slate-200 p-3">
            <div className="font-semibold text-slate-900">{rad.navn}</div>
            <p className="text-xs text-slate-600 mt-0.5">
              {rad.oppgaver} oppgaver · {rad.gudstjenester} gudstjenester
              {rad.harFlereSammeDag ? " · flere samme dag" : ""}
            </p>
          </div>
        ))}
        {filtrert.length === 0 && (
          <p className="px-2 py-6 text-sm text-slate-500 text-center">Ingen treff i dette utvalget.</p>
        )}
      </div>
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-auto max-h-[70vh]">
        <table className="text-left text-xs border-separate border-spacing-0 min-w-full">
          <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider sticky top-0 z-20">
            <tr>
              <th className="p-2.5 sticky left-0 z-30 bg-slate-50 border-b border-r border-slate-200 min-w-[9rem]">
                Navn
              </th>
              {semester.gudstjenester.map((g) => (
                <th
                  key={g.GudstjenesteID}
                  className="p-2.5 border-b border-slate-200 whitespace-nowrap font-semibold normal-case tracking-normal text-slate-700"
                  title={g.Tema}
                >
                  {kortDato(g.Dato)}
                </th>
              ))}
              <th className="p-2.5 sticky right-[3.5rem] z-30 bg-slate-50 border-b border-l border-slate-200 text-right min-w-[4.5rem]">
                Oppgaver
              </th>
              <th className="p-2.5 sticky right-0 z-30 bg-slate-50 border-b border-slate-200 text-right min-w-[3.5rem]">
                Gudstj.
              </th>
            </tr>
          </thead>
          <tbody>
            {filtrert.map((rad) => (
              <BelastningRad
                key={rad.personId}
                rad={rad}
                gudstjenesteIds={semester.gudstjenester.map((g) => g.GudstjenesteID)}
                onVelgGudstjeneste={onVelgGudstjeneste}
              />
            ))}
          </tbody>
        </table>
        {filtrert.length === 0 && (
          <p className="px-4 py-8 text-sm text-slate-500 text-center">Ingen personer i dette utvalget.</p>
        )}
      </div>
    </div>
  );
};

const BelastningRad: React.FC<{
  rad: BelastningPersonRad;
  gudstjenesteIds: string[];
  onVelgGudstjeneste?: (gudstjenesteId: string, personId: string) => void;
}> = ({ rad, gudstjenesteIds, onVelgGudstjeneste }) => {
  const bg = radBakgrunn(rad.oppgaver);
  return (
    <tr className={bg}>
      <td className={`p-2.5 sticky left-0 z-10 border-b border-r border-slate-100 ${bg || "bg-white"}`}>
        <span className="font-semibold text-slate-900">{rad.navn}</span>
      </td>
      {gudstjenesteIds.map((id) => {
        const oppgaver = rad.celler[id] || [];
        const flere = oppgaver.length >= 2;
        return (
          <td key={id} className="p-1.5 border-b border-slate-100 align-top">
            {oppgaver.length === 0 ? null : (
              <button
                type="button"
                disabled={!onVelgGudstjeneste}
                onClick={() => onVelgGudstjeneste?.(id, rad.personId)}
                title={
                  flere
                    ? "Flere oppgaver denne dagen — sjekk om de kan gjøres samtidig"
                    : oppgaver.map((o) => o.rollenavn).join(", ")
                }
                className={`w-full text-left rounded-lg px-1.5 py-1 ${
                  flere ? "border border-[#2d5a3f]/30 bg-[#eef5f1]" : ""
                } ${onVelgGudstjeneste ? "cursor-pointer hover:bg-slate-50" : ""}`}
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="space-y-0.5 min-w-0">
                    {oppgaver.map((o, i) => (
                      <div
                        key={`${o.rolleId}-${i}`}
                        className={`truncate ${
                          o.status === "Bekreftet" ? "text-emerald-800" : "text-amber-800"
                        }`}
                      >
                        {o.rollenavn}
                      </div>
                    ))}
                  </div>
                  {flere ? (
                    <span className="text-[10px] font-bold text-[#2d5a3f] bg-white border border-[#d2e8d9] rounded px-1 shrink-0">
                      {oppgaver.length}
                    </span>
                  ) : null}
                </div>
              </button>
            )}
          </td>
        );
      })}
      <td
        className={`p-2.5 sticky right-[3.5rem] z-10 border-b border-l border-slate-100 text-right tabular-nums font-semibold ${
          bg || "bg-white"
        }`}
      >
        {rad.oppgaver}
      </td>
      <td
        className={`p-2.5 sticky right-0 z-10 border-b border-slate-100 text-right tabular-nums font-semibold ${
          bg || "bg-white"
        }`}
      >
        {rad.gudstjenester}
      </td>
    </tr>
  );
};
