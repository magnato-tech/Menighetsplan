import React from "react";
import { ExternalLink, BookOpen } from "lucide-react";
import type { GruppeRessurs } from "../types/database";

interface GruppeRessurserProps {
  ressurser?: GruppeRessurs[];
}

export const GruppeRessurser: React.FC<GruppeRessurserProps> = ({ ressurser }) => {
  const liste = (ressurser || []).filter((r) => r.Tittel?.trim() || r.Tekst?.trim() || r.Url?.trim());
  if (liste.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
        <BookOpen className="w-4 h-4" />
        Ressurser
      </h3>
      <ul className="space-y-2">
        {liste.map((r, i) => (
          <li key={`${r.Tittel}-${i}`} className="text-sm">
            {r.Url ? (
              <a
                href={r.Url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#2d5a3f] hover:underline inline-flex items-center gap-1"
              >
                {r.Tittel || r.Url}
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span className="font-semibold text-slate-800">{r.Tittel}</span>
            )}
            {r.Tekst ? <p className="text-xs text-slate-600 mt-0.5">{r.Tekst}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
};
