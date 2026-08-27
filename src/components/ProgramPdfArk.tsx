import React from "react";
import { Gudstjeneste } from "../types/database";
import {
  DatabaseState,
  beregnProgramtider,
  hentAnsvarForBrikke,
  programForGudstjeneste,
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

interface ProgramPdfArkProps {
  db: DatabaseState;
  gudstjeneste: Gudstjeneste;
  kompakt?: boolean;
}

export const ProgramPdfArk: React.FC<ProgramPdfArkProps> = ({
  db,
  gudstjeneste,
  kompakt = false,
}) => {
  const linjer = programForGudstjeneste(db, gudstjeneste.GudstjenesteID);
  const medTid = beregnProgramtider(linjer, gudstjeneste.Tid || "11:00");
  const sluttid = medTid.length > 0 ? medTid[medTid.length - 1].slutt : gudstjeneste.Tid;

  return (
    <article
      className={`program-pdf-ark bg-white text-slate-900 ${kompakt ? "program-pdf-ark--kompakt" : ""}`}
    >
      <header className={kompakt ? "border-b border-[#2d5a3f] pb-2 mb-2" : "border-b-2 border-[#2d5a3f] pb-4 mb-5"}>
        <p
          className={`font-bold uppercase tracking-[0.2em] text-[#2d5a3f] ${
            kompakt ? "text-[9px]" : "text-[11px]"
          }`}
        >
          Gudstjenesteprogram
        </p>
        <h1 className={`font-bold leading-tight ${kompakt ? "text-lg mt-0.5" : "text-2xl mt-1"}`}>
          {gudstjeneste.Tema || "Gudstjeneste"}
        </h1>
        <p className={`text-slate-700 ${kompakt ? "text-xs mt-1" : "text-sm mt-2"}`}>
          {formatDatoLang(gudstjeneste.Dato)}
          {gudstjeneste.Tid ? ` · ${gudstjeneste.Tid}` : ""}
          {sluttid ? `–${sluttid}` : ""}
          {gudstjeneste.Sted ? ` · ${gudstjeneste.Sted}` : ""}
        </p>
        {gudstjeneste.Bibeltekst && (
          <p className={`italic text-slate-600 ${kompakt ? "text-xs mt-1" : "text-sm mt-2"}`}>
            «{gudstjeneste.Bibeltekst}»
          </p>
        )}
      </header>

      <ol className="space-y-0">
        {medTid.map((p) => {
          const ansvar = hentAnsvarForBrikke(db, gudstjeneste.GudstjenesteID, p.RolleID);
          const navn = ansvar.personer.map((pers) => pers.navn).join(", ");
          const meta = [ansvar.rolle?.Rollenavn, ansvar.gruppe?.Gruppenavn, navn]
            .filter(Boolean)
            .join(" · ");

          if (kompakt) {
            return (
              <li
                key={p.ProgramAktivitetID}
                className="flex items-baseline gap-2 py-0.5 border-b border-slate-100 leading-tight break-inside-avoid"
              >
                <span className="w-10 shrink-0 text-[11px] font-bold tabular-nums text-slate-700">
                  {p.start}
                </span>
                <span className="min-w-0 flex-1 text-[12px]">
                  <span className="font-semibold">{p.Tittel}</span>
                  {meta ? <span className="text-slate-500"> · {meta}</span> : null}
                </span>
                <span className="shrink-0 text-[9px] uppercase tracking-wide text-slate-500">
                  {p.VarighetMin} min
                </span>
              </li>
            );
          }

          return (
            <li
              key={p.ProgramAktivitetID}
              className="flex gap-3 py-2.5 border-b border-slate-100 break-inside-avoid"
            >
              <div className="w-14 shrink-0 rounded-md bg-[#5b4b8a] text-white text-center py-1.5 h-fit">
                <div className="text-sm font-bold tabular-nums leading-none">{p.start}</div>
                <div className="text-[9px] uppercase mt-1 opacity-90">{p.VarighetMin} min</div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm leading-snug">{p.Tittel}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{meta}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
};
