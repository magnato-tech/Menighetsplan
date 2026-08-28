import React from "react";
import { CalendarDays, MapPin, Plus } from "lucide-react";
import type { Arrangement } from "../types/database";
import {
  formatertArrangementDato,
  type NesteSamlingInfo,
} from "../services/dataService";

interface NesteSamlingKortProps {
  tittel: string;
  info?: NesteSamlingInfo;
  undertittel?: string;
  onNySamling?: () => void;
  variant?: "primær" | "sekundær";
}

function arrangementTekst(arr: Arrangement): string {
  return formatertArrangementDato(arr.Dato, arr.Tid);
}

export const NesteSamlingKort: React.FC<NesteSamlingKortProps> = ({
  tittel,
  info,
  undertittel,
  onNySamling,
  variant = "primær",
}) => {
  const erPrimær = variant === "primær";

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 ${
        erPrimær
          ? "bg-[#eef5f1] border-[#d2e8d9]"
          : "bg-white border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#2d5a3f]">
            {tittel}
          </p>
          {info ? (
            <>
              <p className="text-base sm:text-lg font-bold text-slate-900 mt-1">
                {info.kilde === "arrangement"
                  ? arrangementTekst(info.arrangement)
                  : formatertArrangementDato(info.dato, info.tid)}
              </p>
              {info.kilde === "arrangement" && info.arrangement.Sted ? (
                <p className="text-xs text-slate-600 mt-1 inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3 shrink-0" />
                  {info.arrangement.Sted}
                </p>
              ) : info.kilde === "plan" ? (
                <p className="text-xs text-slate-500 mt-1">
                  Planlagt rytme — ikke opprettet i kalenderen ennå
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-slate-600 mt-1">
              Ingen kommende samling planlagt.
            </p>
          )}
          {undertittel ? (
            <p className="text-xs text-slate-500 mt-1">{undertittel}</p>
          ) : null}
        </div>
        <CalendarDays
          className={`w-8 h-8 shrink-0 ${erPrimær ? "text-[#2d5a3f]/70" : "text-slate-400"}`}
        />
      </div>
      {onNySamling ? (
        <button
          type="button"
          onClick={onNySamling}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#2d5a3f] hover:bg-[#234731] px-3 py-2 rounded-xl cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Ny samling
        </button>
      ) : null}
    </div>
  );
};
