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
}

export const ProgramPdfArk: React.FC<ProgramPdfArkProps> = ({ db, gudstjeneste }) => {
  const linjer = programForGudstjeneste(db, gudstjeneste.GudstjenesteID);
  const medTid = beregnProgramtider(linjer, gudstjeneste.Tid || "11:00");
  const sluttid = medTid.length > 0 ? medTid[medTid.length - 1].slutt : gudstjeneste.Tid;

  return (
    <article className="program-pdf-ark bg-white text-slate-900">
      <header className="border-b-2 border-[#2d5a3f] pb-4 mb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#2d5a3f]">
          Gudstjenesteprogram
        </p>
        <h1 className="text-2xl font-bold mt-1 leading-tight">
          {gudstjeneste.Tema || "Gudstjeneste"}
        </h1>
        <p className="text-sm mt-2 text-slate-700">
          {formatDatoLang(gudstjeneste.Dato)}
          {gudstjeneste.Tid ? ` · ${gudstjeneste.Tid}` : ""}
          {sluttid ? `–${sluttid}` : ""}
          {gudstjeneste.Sted ? ` · ${gudstjeneste.Sted}` : ""}
        </p>
        {gudstjeneste.Bibeltekst && (
          <p className="text-sm italic text-slate-600 mt-2">«{gudstjeneste.Bibeltekst}»</p>
        )}
      </header>

      <ol className="space-y-0">
        {medTid.map((p) => {
          const ansvar = hentAnsvarForBrikke(db, gudstjeneste.GudstjenesteID, p.RolleID);
          const navn = ansvar.personer.map((pers) => pers.navn).join(", ");
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
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {[ansvar.rolle?.Rollenavn, ansvar.gruppe?.Gruppenavn, navn]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </article>
  );
};
