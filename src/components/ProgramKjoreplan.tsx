import React, { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Rolle } from "../types/database";
import { BrikkeAnsvarPerson } from "../services/dataService";
import {
  KnyttneveHand,
  ProgramBrikke,
  ProgramBrikkeFelt,
  ProgramBrikkeGhost,
} from "./ProgramBrikke";

export type KjoreplanLinje = ProgramBrikkeFelt & {
  rolleNavn?: string;
  gruppeNavn?: string;
  personer?: BrikkeAnsvarPerson[];
  uthevet?: boolean;
  innkomstHint?: string;
};

interface ProgramKjoreplanProps {
  linjer: KjoreplanLinje[];
  roller: Rolle[];
  redigerbar: boolean;
  visKlokkeslett: boolean;
  visPersonHint?: boolean;
  onChangeLinje?: (id: string, patch: Partial<ProgramBrikkeFelt>) => void;
  onDeleteLinje?: (id: string) => void;
  onMove?: (fromIndex: number, toIndex: number) => void;
  onNyAktivitet?: () => void;
}

type DragState = {
  fromIndex: number;
  insertIndex: number;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
};

function insertionIndexFromY(clientY: number, rowEls: HTMLElement[]): number {
  for (let i = 0; i < rowEls.length; i++) {
    const rect = rowEls[i].getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) return i;
  }
  return rowEls.length;
}

function spliceTarget(fromIndex: number, insertIndex: number): number | null {
  if (insertIndex === fromIndex || insertIndex === fromIndex + 1) return null;
  return insertIndex > fromIndex ? insertIndex - 1 : insertIndex;
}

export const ProgramKjoreplan: React.FC<ProgramKjoreplanProps> = ({
  linjer,
  roller,
  redigerbar,
  visKlokkeslett,
  visPersonHint,
  onChangeLinje,
  onDeleteLinje,
  onMove,
  onNyAktivitet,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [lineTop, setLineTop] = useState<number | null>(null);
  const dragActive = drag !== null;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  useEffect(() => {
    if (!dragActive) {
      document.body.classList.remove("kjoreplan-hand-closed");
      return;
    }
    document.body.classList.add("kjoreplan-hand-closed");
    const forrige = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      document.body.classList.remove("kjoreplan-hand-closed");
      document.body.style.userSelect = forrige;
    };
  }, [dragActive]);

  const oppdaterLinje = (clientY: number) => {
    const current = dragRef.current;
    const list = listRef.current;
    if (!current || !list) return;
    const rows = rowRefs.current.filter((el): el is HTMLDivElement => Boolean(el));
    const insertIndex = insertionIndexFromY(clientY, rows);
    const listRect = list.getBoundingClientRect();
    let top: number;
    if (rows.length === 0) {
      top = 0;
    } else if (insertIndex >= rows.length) {
      const last = rows[rows.length - 1].getBoundingClientRect();
      top = last.bottom - listRect.top;
    } else {
      top = rows[insertIndex].getBoundingClientRect().top - listRect.top;
    }
    setLineTop(top);
    setDrag((prev) =>
      prev
        ? {
            ...prev,
            insertIndex,
            y: clientY,
          }
        : prev
    );
  };

  const avsluttDrag = (clientY?: number) => {
    const current = dragRef.current;
    if (!current) return;
    const y = clientY ?? current.y;
    const rows = rowRefs.current.filter((el): el is HTMLDivElement => Boolean(el));
    const insertIndex = insertionIndexFromY(y, rows);
    const to = spliceTarget(current.fromIndex, insertIndex);
    if (to != null) onMoveRef.current?.(current.fromIndex, to);
    dragRef.current = null;
    setDrag(null);
    setLineTop(null);
  };

  useEffect(() => {
    if (!dragActive) return;
    const onMovePtr = (e: PointerEvent) => {
      setDrag((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev));
      oppdaterLinje(e.clientY);
    };
    const onUp = (e: PointerEvent) => avsluttDrag(e.clientY);
    window.addEventListener("pointermove", onMovePtr);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMovePtr);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragActive]);

  const startDrag = (index: number, e: React.PointerEvent) => {
    if (!redigerbar || e.button !== 0) return;
    e.preventDefault();
    const row = rowRefs.current[index];
    if (!row) return;
    const rect = row.getBoundingClientRect();
    const neste: DragState = {
      fromIndex: index,
      insertIndex: index,
      x: e.clientX,
      y: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      width: rect.width,
    };
    dragRef.current = neste;
    setDrag(neste);
    setLineTop(rect.top - (listRef.current?.getBoundingClientRect().top ?? 0));
  };

  const aktivLinje = drag ? linjer[drag.fromIndex] : null;

  return (
    <div className="space-y-2">
      {redigerbar && onNyAktivitet && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onNyAktivitet}
            className="px-3 py-1.5 bg-[#2d5a3f] hover:bg-[#234731] text-white text-xs font-semibold rounded-xl cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Ny aktivitet
          </button>
        </div>
      )}
      {linjer.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-6">Ingen aktiviteter i kjøreplanen.</p>
      )}
      <div ref={listRef} className="relative space-y-2">
        {redigerbar && lineTop != null && (
          <div
            className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
            style={{
              top: lineTop,
              transform: "translateY(-50%)",
              transition: "top 80ms ease-out",
            }}
          >
            <span className="w-[3px] h-8 rounded-full bg-[#2d5a3f] shadow-[0_0_0_3px_rgba(45,90,63,0.18)] shrink-0" />
            <span className="h-[3px] flex-1 rounded-full bg-[#2d5a3f]" />
          </div>
        )}
        {linjer.map((linje, index) => (
          <div
            key={linje.id}
            ref={(el) => {
              rowRefs.current[index] = el;
            }}
          >
            <ProgramBrikke
              brikke={linje}
              rolleNavn={linje.rolleNavn}
              gruppeNavn={linje.gruppeNavn}
              personer={linje.personer}
              roller={roller}
              redigerbar={redigerbar}
              visKlokkeslett={visKlokkeslett}
              uthevet={linje.uthevet}
              innkomstHint={linje.innkomstHint}
              visPersonHint={visPersonHint}
              isPlaceholder={drag?.fromIndex === index}
              onChange={(patch) => onChangeLinje?.(linje.id, patch)}
              onDelete={() => onDeleteLinje?.(linje.id)}
              onMoveUp={() => index > 0 && onMove?.(index, index - 1)}
              onMoveDown={() => index < linjer.length - 1 && onMove?.(index, index + 1)}
              onGripPointerDown={(e) => startDrag(index, e)}
            />
          </div>
        ))}
      </div>

      {drag && aktivLinje && (
        <>
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: drag.x - drag.offsetX,
              top: drag.y - drag.offsetY,
              width: drag.width,
            }}
          >
            <ProgramBrikkeGhost
              tittel={aktivLinje.tittel}
              varighetMin={aktivLinje.varighetMin}
              rolleNavn={aktivLinje.rolleNavn}
              start={aktivLinje.start}
            />
          </div>
          <div
            className="fixed z-[60] pointer-events-none"
            style={{
              left: drag.x - 6,
              top: drag.y - 8,
            }}
          >
            <KnyttneveHand />
          </div>
        </>
      )}
    </div>
  );
};
