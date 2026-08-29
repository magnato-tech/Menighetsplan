import React, { useState } from "react";
import type { DatabaseState } from "../types/database";
import {
  hentKommendeForesporsler,
  svarPaForesporsel,
  type ForesporselRad,
} from "../services/dataService";
import { Bell, Check, X } from "lucide-react";

interface ForesporslerPanelProps {
  db: DatabaseState;
  personId: string;
  onUpdateDb: (db: DatabaseState) => void;
}

function formatDato(dato: string): string {
  const parsed = new Date(`${dato}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dato;
  return parsed.toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const ForesporselKort: React.FC<{
  rad: ForesporselRad;
  onSvar: (svar: "Bekreftet" | "Avvist", melding?: string) => void;
}> = ({ rad, onSvar }) => {
  const [visNei, setVisNei] = useState(false);
  const [melding, setMelding] = useState("");

  return (
    <li className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-3 space-y-2">
      <div>
        <p className="text-sm font-semibold text-slate-900">
          {rad.rollenavn}
          {rad.gruppenavn ? ` · ${rad.gruppenavn}` : ""}
        </p>
        <p className="text-xs text-slate-600 mt-0.5">
          {formatDato(rad.gudstjenesteDato)}
          {rad.gudstjenesteTid ? ` · kl. ${rad.gudstjenesteTid}` : ""}
          {rad.gudstjenesteTema ? ` · ${rad.gudstjenesteTema}` : ""}
        </p>
        <p className="text-xs text-amber-800 font-medium mt-1">Du er forespurt — svar når du kan</p>
      </div>
      {!visNei ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSvar("Bekreftet")}
            className="inline-flex items-center gap-1.5 min-h-10 px-3 text-sm font-semibold text-white bg-[#2d5a3f] hover:bg-[#234731] rounded-xl cursor-pointer"
          >
            <Check className="w-4 h-4" />
            Ja, jeg kan
          </button>
          <button
            type="button"
            onClick={() => setVisNei(true)}
            className="inline-flex items-center gap-1.5 min-h-10 px-3 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer"
          >
            <X className="w-4 h-4" />
            Nei, dessverre
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={melding}
            onChange={(e) => setMelding(e.target.value)}
            rows={2}
            placeholder="Si kort til gruppa (valgfritt)"
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-[#2d5a3f] focus:outline-hidden"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onSvar("Avvist", melding.trim() || undefined)}
              className="min-h-10 px-3 text-sm font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-xl cursor-pointer"
            >
              Send avslag
            </button>
            <button
              type="button"
              onClick={() => {
                setVisNei(false);
                setMelding("");
              }}
              className="min-h-10 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}
    </li>
  );
};

export const ForesporslerPanel: React.FC<ForesporslerPanelProps> = ({
  db,
  personId,
  onUpdateDb,
}) => {
  const foresporsler = hentKommendeForesporsler(db, personId);
  if (foresporsler.length === 0) return null;

  const handleSvar = (
    rad: ForesporselRad,
    svar: "Bekreftet" | "Avvist",
    melding?: string
  ) => {
    const neste = svarPaForesporsel(
      db,
      personId,
      rad.gudstjenesteId,
      rad.rolleId,
      svar,
      melding
    );
    if (neste) onUpdateDb(neste);
  };

  return (
    <section className="bg-white rounded-2xl border border-amber-200 p-4 sm:p-5 shadow-xs">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-800 flex items-center gap-1.5 mb-3">
        <Bell className="w-4 h-4" />
        Forespørsler ({foresporsler.length})
      </h3>
      <ul className="space-y-2">
        {foresporsler.map((rad) => (
          <ForesporselKort
            key={rad.tildelingId}
            rad={rad}
            onSvar={(svar, melding) => handleSvar(rad, svar, melding)}
          />
        ))}
      </ul>
    </section>
  );
};
