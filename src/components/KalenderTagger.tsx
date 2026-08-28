import React from "react";
import type { ArrangementTag } from "../types/database";

const KATEGORI_FARGE: Record<string, string> = {
  Gruppe: "bg-sky-100 text-sky-900 border-sky-200",
  "Type gruppe": "bg-violet-100 text-violet-900 border-violet-200",
};

function fargeForKategori(kategori: string): string {
  return KATEGORI_FARGE[kategori] || "bg-slate-100 text-slate-800 border-slate-200";
}

interface KalenderTaggerProps {
  tagger?: ArrangementTag[];
  kompakt?: boolean;
  className?: string;
}

export const KalenderTagger: React.FC<KalenderTaggerProps> = ({
  tagger,
  kompakt = false,
  className = "",
}) => {
  if (!tagger?.length) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {tagger.map((tag) => (
        <span
          key={`${tag.Kategori}:${tag.Verdi}`}
          className={`inline-flex items-center gap-1 rounded-full border font-semibold ${
            kompakt ? "text-[9px] px-1 py-0" : "text-[10px] px-1.5 py-0.5"
          } ${fargeForKategori(tag.Kategori)}`}
        >
          <span className="opacity-70">{tag.Kategori}</span>
          <span className="truncate max-w-[8rem]">{tag.Verdi}</span>
        </span>
      ))}
    </div>
  );
};

export function hentArrangementTagger(
  db: { arrangementer?: { ArrangementID: string; Tagger?: ArrangementTag[] }[] },
  arrangementId: string
): ArrangementTag[] | undefined {
  return (db.arrangementer || []).find((a) => a.ArrangementID === arrangementId)?.Tagger;
}
