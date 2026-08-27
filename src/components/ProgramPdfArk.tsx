import React from "react";
import { Gudstjeneste } from "../types/database";
import {
  DatabaseState,
  beregnProgramtider,
  formatRolleOgPersoner,
  hentAnsvarForBrikke,
  programForGudstjeneste,
  øvrigBemanningForProgram,
} from "../services/dataService";

function formatDatoLang(dato: string): string {
  const parsed = new Date(`${dato}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dato;
  return parsed.toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatKlOverskrift(tid: string): string {
  const t = String(tid || "").trim();
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (m) return `kl ${parseInt(m[1], 10)}.${m[2]}`;
  return t ? `kl ${t}` : "";
}

interface ProgramPdfArkProps {
  db: DatabaseState;
  gudstjeneste: Gudstjeneste;
  kompakt?: boolean;
  visOvrigBemanning?: boolean;
}

export const ProgramPdfArk: React.FC<ProgramPdfArkProps> = ({
  db,
  gudstjeneste,
  kompakt = false,
  visOvrigBemanning = false,
}) => {
  const linjer = programForGudstjeneste(db, gudstjeneste.GudstjenesteID);
  const medTid = beregnProgramtider(linjer, gudstjeneste.Tid || "11:00");
  const startTid =
    gudstjeneste.Tid || medTid.find((p) => !p.ForStart)?.start || "11:00";
  const klokke = formatKlOverskrift(startTid);
  const ovrig = visOvrigBemanning
    ? øvrigBemanningForProgram(db, gudstjeneste.GudstjenesteID)
    : [];

  return (
    <article
      className={`program-pdf-ark bg-white text-slate-900 ${kompakt ? "program-pdf-ark--kompakt" : ""}`}
    >
      <header className={kompakt ? "border-b border-[#2d5a3f] pb-2 mb-2" : "border-b-2 border-[#2d5a3f] pb-3 mb-3"}>
        <p
          className={`font-bold uppercase tracking-[0.2em] text-[#2d5a3f] ${
            kompakt ? "text-[9px]" : "text-[11px]"
          }`}
        >
          Gudstjenesteprogram
        </p>
        <h1 className={`font-bold leading-tight ${kompakt ? "text-lg mt-0.5" : "text-xl mt-1"}`}>
          {gudstjeneste.Tema || "Gudstjeneste"}
        </h1>
        <p className={`text-slate-700 ${kompakt ? "text-xs mt-1" : "text-sm mt-1.5"}`}>
          {formatDatoLang(gudstjeneste.Dato)}
          {klokke ? ` · ${klokke}` : ""}
          {gudstjeneste.Sted ? ` · ${gudstjeneste.Sted}` : ""}
        </p>
        {gudstjeneste.Bibeltekst && (
          <p className={`italic text-slate-600 ${kompakt ? "text-xs mt-1" : "text-sm mt-1.5"}`}>
            «{gudstjeneste.Bibeltekst}»
          </p>
        )}
      </header>

      <ol className="space-y-0">
        {medTid.map((p) => {
          const ansvar = hentAnsvarForBrikke(db, gudstjeneste.GudstjenesteID, p.RolleID);
          const meta = formatRolleOgPersoner(ansvar.rolle?.Rollenavn, ansvar.personer);

          if (kompakt) {
            return (
              <li
                key={p.ProgramAktivitetID}
                className="flex items-baseline gap-3 py-0.5 border-b border-slate-100 leading-tight break-inside-avoid"
              >
                <span className="w-10 shrink-0 text-[11px] font-bold tabular-nums text-slate-700">
                  {p.start}
                </span>
                <span className="min-w-0 flex-1 text-[12px]">
                  <span className="font-semibold">{p.Tittel}</span>
                  {meta ? <span className="text-slate-500"> · {meta}</span> : null}
                </span>
              </li>
            );
          }

          return (
            <li
              key={p.ProgramAktivitetID}
              className="flex gap-4 py-1.5 border-b border-slate-100 break-inside-avoid"
            >
              <div className="w-12 shrink-0 text-[#2d5a3f]">
                <div className="text-sm font-bold tabular-nums leading-none pt-0.5">{p.start}</div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm leading-snug">{p.Tittel}</p>
                {meta ? <p className="text-xs text-slate-500 mt-0.5">{meta}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>

      {ovrig.length > 0 && (
        <section className="mt-4 pt-3 border-t-2 border-[#2d5a3f]">
          <h2
            className={`font-bold uppercase tracking-[0.14em] text-[#2d5a3f] ${
              kompakt ? "text-[9px] mb-1.5" : "text-[11px] mb-2"
            }`}
          >
            Øvrig bemanning
          </h2>
          <ul className="grid grid-cols-2 gap-x-4">
            {ovrig.map((rad) => (
              <li
                key={rad.rolleId}
                className={
                  kompakt
                    ? "text-[11px] text-slate-800 py-0.5 leading-tight"
                    : "text-sm text-slate-800 py-1 leading-snug"
                }
              >
                {rad.tekst}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
};
