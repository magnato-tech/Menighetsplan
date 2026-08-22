import React from "react";
import { Clock3, ChevronUp, ChevronDown, Trash2, Users, UserRound } from "lucide-react";
import { Rolle } from "../types/database";
import { BrikkeAnsvarPerson } from "../services/dataService";

export type ProgramBrikkeFelt = {
  id: string;
  tittel: string;
  varighetMin: number;
  rolleId?: string;
  forStart: boolean;
  merknad?: string;
  start?: string;
  slutt?: string;
};

interface ProgramBrikkeProps {
  brikke: ProgramBrikkeFelt;
  rolleNavn?: string;
  gruppeNavn?: string;
  personer?: BrikkeAnsvarPerson[];
  roller: Rolle[];
  redigerbar: boolean;
  visKlokkeslett: boolean;
  uthevet?: boolean;
  innkomstHint?: string;
  visPersonHint?: boolean;
  isPlaceholder?: boolean;
  onChange?: (patch: Partial<ProgramBrikkeFelt>) => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onGripPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
}

function SeksPrikkHandle({
  grabbing,
  onPointerDown,
}: {
  grabbing?: boolean;
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      className={`kjoreplan-hand-open shrink-0 self-center p-1.5 -ml-1 rounded-lg touch-none select-none ${
        grabbing ? "text-[#2d5a3f] bg-[#eef5f1]" : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
      }`}
      aria-label="Flytt aktivitet"
      title="Dra i prikkene for å flytte"
    >
      <span className="grid grid-cols-2 gap-[3px] w-3.5" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="w-[5px] h-[5px] rounded-full bg-current" />
        ))}
      </span>
    </button>
  );
}

export const ProgramBrikke: React.FC<ProgramBrikkeProps> = ({
  brikke,
  rolleNavn,
  gruppeNavn,
  personer = [],
  roller,
  redigerbar,
  visKlokkeslett,
  uthevet,
  innkomstHint,
  visPersonHint,
  isPlaceholder,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  onGripPointerDown,
}) => {
  return (
    <div
      className={`bg-white rounded-xl border px-3 py-2.5 flex items-stretch gap-2 transition-opacity duration-150 ${
        isPlaceholder
          ? "opacity-35 border-dashed border-[#2d5a3f]/50 bg-slate-50 shadow-none"
          : uthevet
            ? "border-[#2d5a3f] ring-1 ring-[#2d5a3f]/30 bg-[#f4faf6] shadow-xs"
            : "border-slate-200 shadow-xs"
      }`}
    >
      {redigerbar && <SeksPrikkHandle grabbing={isPlaceholder} onPointerDown={onGripPointerDown} />}

      {visKlokkeslett && brikke.start && (
        <div className="shrink-0 w-14 rounded-lg bg-[#5b4b8a] text-white flex flex-col items-center justify-center py-1.5 px-1">
          <span className="text-sm font-bold tabular-nums leading-none">{brikke.start}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide mt-1 opacity-90">
            {brikke.varighetMin}m
          </span>
        </div>
      )}

      <div className="min-w-0 flex-1 space-y-1.5">
        {redigerbar ? (
          <input
            value={brikke.tittel}
            onChange={(e) => onChange?.({ tittel: e.target.value })}
            className="w-full text-sm font-bold text-slate-900 bg-transparent border-b border-transparent focus:border-slate-300 outline-none"
          />
        ) : (
          <h4 className="text-sm font-bold text-slate-900">{brikke.tittel}</h4>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {!visKlokkeslett && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
              <Clock3 className="w-3 h-3" />
              {redigerbar ? (
                <input
                  type="number"
                  min={0}
                  value={brikke.varighetMin}
                  onChange={(e) => onChange?.({ varighetMin: parseInt(e.target.value, 10) || 0 })}
                  className="w-12 border border-slate-200 rounded-md px-1 py-0.5 text-[11px] font-semibold"
                />
              ) : (
                <span>{brikke.varighetMin} min</span>
              )}
            </span>
          )}
          {visKlokkeslett && redigerbar && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
              <Clock3 className="w-3 h-3" />
              <input
                type="number"
                min={0}
                value={brikke.varighetMin}
                onChange={(e) => onChange?.({ varighetMin: parseInt(e.target.value, 10) || 0 })}
                className="w-12 border border-slate-200 rounded-md px-1 py-0.5 text-[11px] font-semibold"
              />
              min
            </span>
          )}

          {redigerbar ? (
            <select
              value={brikke.rolleId || ""}
              onChange={(e) => onChange?.({ rolleId: e.target.value })}
              className="text-[10px] font-bold uppercase tracking-wide bg-violet-50 text-violet-800 border border-violet-100 rounded-full px-2 py-0.5"
            >
              <option value="">Ingen rolle</option>
              {roller.filter((r) => r.Aktiv).map((r) => (
                <option key={r.RolleID} value={r.RolleID}>
                  {r.Rollenavn}
                </option>
              ))}
            </select>
          ) : (
            rolleNavn && (
              <span className="text-[10px] font-bold uppercase tracking-wide bg-violet-50 text-violet-800 rounded-full px-2 py-0.5">
                {rolleNavn}
              </span>
            )
          )}

          {gruppeNavn && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-sky-50 text-sky-800 rounded-full px-2 py-0.5">
              <Users className="w-3 h-3" />
              {gruppeNavn}
            </span>
          )}

          {personer.map((p) => (
            <span
              key={p.personId}
              className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-800 rounded-full px-2 py-0.5"
            >
              <UserRound className="w-3 h-3" />
              {p.navn}
            </span>
          ))}

          {visPersonHint && personer.length === 0 && (
            <span className="text-[10px] text-slate-400 italic">fylles fra tildelinger</span>
          )}

          {innkomstHint && (
            <span className="text-[11px] font-semibold text-[#2d5a3f]">{innkomstHint}</span>
          )}
        </div>

        {redigerbar && (
          <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <input
              type="checkbox"
              checked={brikke.forStart}
              onChange={(e) => onChange?.({ forStart: e.target.checked })}
            />
            Før start
          </label>
        )}
        {redigerbar && (
          <input
            value={brikke.merknad || ""}
            onChange={(e) => onChange?.({ merknad: e.target.value })}
            placeholder="Merknad (valgfritt)"
            className="w-full text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 outline-none focus:border-slate-300"
          />
        )}
      </div>

      {redigerbar && (
        <div className="flex flex-col items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
            aria-label="Flytt opp"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer"
            aria-label="Flytt ned"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-0.5 text-rose-400 hover:text-rose-700 cursor-pointer mt-1"
            aria-label="Slett"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export function ProgramBrikkeGhost({
  tittel,
  varighetMin,
  rolleNavn,
  start,
}: {
  tittel: string;
  varighetMin: number;
  rolleNavn?: string;
  start?: string;
}) {
  return (
    <div className="kjoreplan-ghost bg-white/90 backdrop-blur-[2px] rounded-xl border border-[#2d5a3f]/30 px-3 py-2.5 flex items-center gap-2 pointer-events-none min-w-[260px] max-w-[min(420px,70vw)]">
      <span className="grid grid-cols-2 gap-[3px] w-3.5 text-[#2d5a3f] shrink-0" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="w-[5px] h-[5px] rounded-full bg-current" />
        ))}
      </span>
      {start && (
        <div className="shrink-0 w-12 rounded-md bg-[#5b4b8a] text-white text-center py-1">
          <span className="text-xs font-bold tabular-nums">{start}</span>
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900 truncate">{tittel}</p>
        <p className="text-[11px] text-slate-500">
          {varighetMin} min{rolleNavn ? ` · ${rolleNavn}` : ""}
        </p>
      </div>
    </div>
  );
}

export function KnyttneveHand({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="34"
      height="34"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      style={{ animation: "kjoreplan-hand-knytt 140ms ease-out" }}
    >
      <path
        d="M10.8 16.4v-3.2a1.5 1.5 0 0 1 3 0v2.4h.2v-4.2a1.5 1.5 0 0 1 3 0v4h.2v-3.4a1.5 1.5 0 0 1 3 0v3.4h.2v-2a1.5 1.5 0 0 1 3 0v5.4c0 3.4-2.2 6.2-6.4 6.2h-1.4c-3.6 0-6.6-2.4-7.4-5.6-.4-1.6.6-2.8 1.8-3.2 1-.3 2 .2 2.4 1.2l.4 1z"
        fill="#1e293b"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
