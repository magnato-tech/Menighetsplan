import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  DatabaseState,
  CelleForslag,
  arkCelleInnhold,
  foreslaPersonerForCelle,
} from "../services/dataService";
import { Rolle } from "../types/database";

export function sisteCelleFragment(raw: string): string {
  const parts = String(raw || "").split(/[,;]+/);
  return (parts[parts.length - 1] || "").replace(/^\s+/, "");
}

interface ArkCelleProps {
  db: DatabaseState;
  gudstjenesteId: string;
  rolle: Rolle;
  aktiv: boolean;
  redigerer: boolean;
  dimmet?: boolean;
  bakgrunn?: string;
  gruppeId?: string;
  sok: string;
  forslagIndex: number;
  onSokChange: (verdi: string) => void;
  onForslagIndex: (index: number) => void;
  onStartRediger: () => void;
  onAvbryt: () => void;
  onVelgPerson: (personId: string) => void;
  onVelgEkstern: (navn: string) => void;
  onTildelTekst: () => void;
  onFjernSiste: () => void;
  onTomCelle: () => void;
  onEnter: () => void;
  onTab: (shift: boolean) => void;
  onPil: (retning: "up" | "down" | "left" | "right") => void;
}

export const ArkCelle: React.FC<ArkCelleProps> = ({
  db,
  gudstjenesteId,
  rolle,
  aktiv,
  redigerer,
  dimmet,
  bakgrunn,
  gruppeId,
  sok,
  forslagIndex,
  onSokChange,
  onForslagIndex,
  onStartRediger,
  onAvbryt,
  onVelgPerson,
  onVelgEkstern,
  onTildelTekst,
  onFjernSiste,
  onTomCelle,
  onEnter,
  onTab,
  onPil,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const celleRef = useRef<HTMLTableCellElement>(null);
  const menyRef = useRef<HTMLUListElement>(null);
  const [menyPos, setMenyPos] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const innhold = useMemo(
    () => arkCelleInnhold(db, gudstjenesteId, rolle),
    [db, gudstjenesteId, rolle]
  );
  const fragment = sisteCelleFragment(sok);
  const forslag: CelleForslag[] = useMemo(() => {
    if (!redigerer) return [];
    return foreslaPersonerForCelle(db, gudstjenesteId, rolle.RolleID, fragment, {
      gruppeId: gruppeId || rolle.GruppeID,
      limit: 10,
    });
  }, [redigerer, db, gudstjenesteId, rolle.RolleID, rolle.GruppeID, fragment, gruppeId]);
  const visEkstern = redigerer && fragment.length > 0;
  const menyAntall = forslag.length + (visEkstern ? 1 : 0);

  useEffect(() => {
    if (redigerer) inputRef.current?.focus();
  }, [redigerer, gudstjenesteId, rolle.RolleID]);

  useEffect(() => {
    if (!redigerer) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (celleRef.current?.contains(t) || menyRef.current?.contains(t)) return;
      onAvbryt();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [redigerer, onAvbryt]);

  useLayoutEffect(() => {
    if (!redigerer || menyAntall === 0) {
      setMenyPos(null);
      return;
    }
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenyPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 220) });
  }, [redigerer, menyAntall, sok]);

  const statusKlasse = (status: string) =>
    status === "Bekreftet"
      ? "bg-emerald-50 text-emerald-800"
      : status === "Avvist"
        ? "text-rose-800 line-through opacity-75"
        : "bg-amber-50 text-amber-900";

  return (
    <td
      ref={celleRef}
      data-testid={`ark-celle-${gudstjenesteId}-${rolle.RolleID}`}
      onMouseDown={(e) => {
        if (!redigerer) {
          e.preventDefault();
          onStartRediger();
        }
      }}
      className={`px-1 py-0.5 align-top border-b border-slate-200 cursor-text ${
        bakgrunn || ""
      } ${
        aktiv ? "ring-2 ring-inset ring-[#2d5a3f]" : ""
      } ${dimmet ? "opacity-35" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-0.5 min-h-[1.6rem]">
        {innhold.personer.map((p) => (
          <span
            key={p.tildelingId}
            className={`inline-flex items-center rounded px-1 py-px text-xs font-medium leading-tight ${statusKlasse(
              p.status
            )}`}
            title={p.ekstern ? `${p.navn} (ekstern)` : p.navn}
          >
            {p.navn}
          </span>
        ))}
        {Array.from({ length: innhold.ledige }).map((_, i) => (
          <span
            key={`ghost-${i}`}
            className="inline-block w-7 h-4 rounded border border-dashed border-slate-300/90 bg-white/40"
            title="Ledig plass"
          />
        ))}
        {redigerer ? (
          <input
            ref={inputRef}
            value={sok}
            onChange={(e) => onSokChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onAvbryt();
                return;
              }
              if (e.key === "Tab") {
                e.preventDefault();
                onTildelTekst();
                onTab(e.shiftKey);
                return;
              }
              if (e.key === "Enter") {
                e.preventDefault();
                onTildelTekst();
                onEnter();
                return;
              }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                if (menyAntall > 0) {
                  onForslagIndex((forslagIndex + 1 + menyAntall) % menyAntall);
                } else {
                  onPil("down");
                }
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                if (menyAntall > 0) {
                  onForslagIndex((forslagIndex - 1 + menyAntall) % menyAntall);
                } else {
                  onPil("up");
                }
                return;
              }
              if (e.key === "ArrowLeft" && (sok === "" || inputRef.current?.selectionStart === 0)) {
                e.preventDefault();
                onPil("left");
                return;
              }
              if (
                e.key === "ArrowRight" &&
                (sok === "" || inputRef.current?.selectionStart === sok.length)
              ) {
                e.preventDefault();
                onPil("right");
                return;
              }
              if (e.key === "Delete" && sok === "") {
                e.preventDefault();
                onTomCelle();
                return;
              }
              if (e.key === "Backspace" && sok === "") {
                e.preventDefault();
                onFjernSiste();
              }
            }}
            placeholder={innhold.personer.length === 0 ? "Navn…" : ""}
            onBlur={(e) => {
              const neste = e.relatedTarget as Node | null;
              if (neste && (celleRef.current?.contains(neste) || menyRef.current?.contains(neste))) {
                return;
              }
              onAvbryt();
            }}
            className="min-w-[3.5rem] flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
        ) : null}
      </div>
      {redigerer && menyPos && menyAntall > 0 && (
        <ul
          ref={menyRef}
          data-testid="ark-forslagsmeny"
          className="fixed z-50 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg py-1 text-sm"
          style={{ top: menyPos.top, left: menyPos.left, width: menyPos.width }}
        >
          {forslag.map((f, i) => {
            const aktivRad = i === forslagIndex;
            const advarsel =
              f.sammeDagAndreRoller.length > 0
                ? `Også ${f.sammeDagAndreRoller.join(", ")} denne søndagen`
                : f.oppgaverSemester > 0
                  ? `${f.oppgaverSemester} oppgaver dette semesteret`
                  : "";
            const radTittel =
              f.tjenesteGrupper.length > 0 ? f.tjenesteGrupper.join(", ") : undefined;
            return (
              <li key={f.personId}>
                <button
                  type="button"
                  title={radTittel}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onVelgPerson(f.personId);
                  }}
                  className={`w-full text-left px-3 py-1.5 cursor-pointer ${
                    aktivRad ? "bg-[#eef5f1]" : "hover:bg-slate-50"
                  } ${f.alleredeTildelt ? "opacity-60" : ""} ${
                    f.iGruppen ? "ring-1 ring-inset ring-[#2d5a3f]/35" : ""
                  }`}
                >
                  <span className="inline-flex items-center gap-0.5 w-4 shrink-0 mr-1.5 align-middle" aria-hidden>
                    {f.iGruppen ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2d5a3f]" />
                    ) : (
                      <span className="w-1.5 h-1.5" />
                    )}
                    {f.harOppgaveSammeDag ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    ) : (
                      <span className="w-1.5 h-1.5" />
                    )}
                  </span>
                  <span className="font-medium text-slate-900">{f.visningsnavn}</span>
                  {f.visningsnavn !== f.fulltNavn && (
                    <span className="text-slate-500"> {f.fulltNavn}</span>
                  )}
                  {advarsel && (
                    <span className="block text-[10px] text-amber-800">{advarsel}</span>
                  )}
                </button>
              </li>
            );
          })}
          {visEkstern && (
            <li>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onVelgEkstern(fragment);
                }}
                className={`w-full text-left px-3 py-1.5 cursor-pointer font-semibold text-[#2d5a3f] ${
                  forslagIndex === forslag.length ? "bg-[#eef5f1]" : "hover:bg-slate-50"
                }`}
              >
                Ekstern: {fragment}
              </button>
            </li>
          )}
        </ul>
      )}
    </td>
  );
};
