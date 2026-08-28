import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  LayoutGrid,
  SquareStack,
  Share2,
  UserPlus,
  Users,
  CalendarDays,
  X,
} from "lucide-react";
import type { ArkVisning } from "./Planleggingsark";

export const GRUPPELEDER_VEILEDNING_KEY = "gruppeleder-veiledning-sett";

export type GuideStegSignal = {
  visning: ArkVisning;
  apneKort?: boolean;
};

export type GruppeGuideType = "tjenestegruppe" | "husgruppe" | "gruppeledergruppe" | "annet";

type Steg = {
  target: string | null;
  tittel: string;
  tekst: string;
  Icon: React.ComponentType<{ className?: string }>;
  visning: ArkVisning;
  apneKort?: boolean;
};

const BEMANNING_STEG: Steg[] = [
  {
    target: "liste-ark",
    visning: "liste",
    tittel: "Kort eller Ark — samme data",
    tekst: "Bytt mellom Kort og Ark etter smak. Innholdet er det samme. Ark ligner et Excel-ark: kolonner er roller, rader er søndager, tom rute er ledig. Kort viser ett åpent gudstjenestekort om gangen.",
    Icon: SquareStack,
  },
  {
    target: "sett-opp",
    visning: "liste",
    apneKort: true,
    tittel: "Sett forespørsel i det åpne kortet",
    tekst: "Åpne en søndag i Kort-visningen. Trykk pluss ved en rolle, søk fram et medlem og sett forespørsel. Personen blir gul til de svarer. Flere enn veiledende antall er helt greit.",
    Icon: UserPlus,
  },
  {
    target: "status",
    visning: "liste",
    apneKort: true,
    tittel: "Gul venter, grønn er klart",
    tekst: "Gul prikk betyr forespurt og venter på svar. Grønn betyr bekreftet. Medlemmet takker ja på Min side — med mindre du bekrefter etter avtale.",
    Icon: Circle,
  },
  {
    target: "liste-ark",
    visning: "ark",
    tittel: "Fyll i Arket",
    tekst: "Bytt til Ark. En tom celle er ledig. Skriv navn i cellen og trykk Enter for å sette opp. Samme tildeling som i Kort-visningen, bare i rutenett.",
    Icon: LayoutGrid,
  },
  {
    target: "del-lenke",
    visning: "liste",
    tittel: "Send Min side-lenken",
    tekst: "Kopier lenken til et medlem og send den på SMS, e-post eller melding. De kommer rett til sin side og ser gudstjenester fremover.",
    Icon: Share2,
  },
];

const HUSGRUPPE_STEG: Steg[] = [
  {
    target: "neste-samling",
    visning: "liste",
    tittel: "Se neste samling først",
    tekst: "På forsiden ser du når gruppen møtes neste gang. Ingen samling planlagt? Trykk «Ny samling» og opprett i kalenderen.",
    Icon: CalendarDays,
  },
  {
    target: "medlemmer",
    visning: "liste",
    tittel: "Hold oversikt over menneskene",
    tekst: "Medlemslisten er hjertet i gruppen. Legg til fra menighetsregisteret, eller opprett en ny person som admin bekrefter senere.",
    Icon: Users,
  },
  {
    target: "del-lenke",
    visning: "liste",
    tittel: "Send Min side-lenken",
    tekst: "Kopier personlenken og send den til medlemmer som ikke har fått den ennå. De kan da se egne oppgaver og kalender.",
    Icon: Share2,
  },
  {
    target: "samlinger",
    visning: "liste",
    tittel: "Registrer oppmøte",
    tekst: "Etter en samling kan du krysse av hvem som var der. Da ser du lettere hvem som trenger oppfølging.",
    Icon: UserPlus,
  },
];

const LEDERFORUM_STEG: Steg[] = [
  {
    target: "neste-samling",
    visning: "liste",
    tittel: "Neste gruppeledersamling",
    tekst: "Her ser du når Gruppelederteamet møtes neste gang. Planlegg samlingen som for andre grupper.",
    Icon: CalendarDays,
  },
  {
    target: "medlemmer",
    visning: "liste",
    tittel: "Hvem er med i forumet",
    tekst: "Gruppelederteamet fylles automatisk med ledere og nestledere fra andre grupper. Du kan se hvem som er med.",
    Icon: Users,
  },
];

function stegForType(type: GruppeGuideType): Steg[] {
  if (type === "tjenestegruppe") return BEMANNING_STEG;
  if (type === "gruppeledergruppe") return LEDERFORUM_STEG;
  if (type === "husgruppe") return HUSGRUPPE_STEG;
  return HUSGRUPPE_STEG;
}

const FALLBACK_TARGET: Record<string, string> = {
  "sett-opp": "gudstjenester",
  status: "gudstjenester",
  "del-lenke": "medlemmer",
  "neste-samling": "neste-samling",
  samlinger: "samlinger",
};

interface GroupLeaderGuideProps {
  open: boolean;
  onClose: () => void;
  onSteg?: (signal: GuideStegSignal) => void;
  gruppeType?: GruppeGuideType;
}

function finnMal(target: string | null): HTMLElement | null {
  if (!target) return null;
  const direkte = document.querySelector<HTMLElement>(`[data-guide="${target}"]`);
  if (direkte) return direkte;
  const fallback = FALLBACK_TARGET[target];
  if (!fallback) return null;
  return document.querySelector<HTMLElement>(`[data-guide="${fallback}"]`);
}

export const GroupLeaderGuide: React.FC<GroupLeaderGuideProps> = ({
  open,
  onClose,
  onSteg,
  gruppeType = "tjenestegruppe" as GruppeGuideType,
}) => {
  const [stegIndex, setStegIndex] = useState(0);
  const [malRect, setMalRect] = useState<DOMRect | null>(null);
  const [kortPos, setKortPos] = useState<{
    top: number;
    left: number;
    plassering: "above" | "below" | "center";
  }>({ top: 80, left: 16, plassering: "center" });
  const kortRef = useRef<HTMLDivElement>(null);

  const stegListe = stegForType(gruppeType);
  const steg = stegListe[stegIndex];
  const totalt = stegListe.length;

  useEffect(() => {
    if (!open) {
      setStegIndex(0);
      return;
    }
    const gjeldende = stegListe[stegIndex];
    onSteg?.({ visning: gjeldende.visning, apneKort: gjeldende.apneKort });
  }, [open, stegIndex, onSteg, stegListe]);

  useEffect(() => {
    if (!open) return;
    const mal = finnMal(steg.target);
    mal?.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
  }, [open, stegIndex, steg.target]);

  useLayoutEffect(() => {
    if (!open) return;

    const oppdater = () => {
      const mal = finnMal(steg.target);
      const rect = mal?.getBoundingClientRect() ?? null;
      setMalRect(rect && rect.width > 0 && rect.height > 0 ? rect : null);

      const kort = kortRef.current?.getBoundingClientRect();
      const kortBredde = kort?.width || Math.min(360, window.innerWidth - 32);
      const kortHoyde = kort?.height || 220;
      const margin = 16;
      const gap = 14;

      if (!rect) {
        setKortPos({
          top: Math.max(margin, (window.innerHeight - kortHoyde) / 2),
          left: Math.max(margin, (window.innerWidth - kortBredde) / 2),
          plassering: "center",
        });
        return;
      }

      let plassering: "above" | "below" = "below";
      let top = rect.bottom + gap;
      if (top + kortHoyde > window.innerHeight - margin) {
        plassering = "above";
        top = rect.top - gap - kortHoyde;
      }
      if (top < margin) top = margin;
      if (top + kortHoyde > window.innerHeight - margin) {
        top = Math.max(margin, window.innerHeight - kortHoyde - margin);
      }

      let left = rect.left + rect.width / 2 - kortBredde / 2;
      left = Math.max(margin, Math.min(left, window.innerWidth - kortBredde - margin));
      setKortPos({ top, left, plassering });
    };

    const timer = window.setTimeout(oppdater, 200);
    window.addEventListener("resize", oppdater);
    window.addEventListener("scroll", oppdater, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", oppdater);
      window.removeEventListener("scroll", oppdater, true);
    };
  }, [open, stegIndex, steg.target]);

  if (!open) return null;

  const pad = 8;
  const highlight = malRect
    ? {
        top: malRect.top - pad,
        left: malRect.left - pad,
        width: malRect.width + pad * 2,
        height: malRect.height + pad * 2,
      }
    : null;

  const pilVenstre = highlight
    ? Math.min(
        Math.max(24, highlight.left + highlight.width / 2 - kortPos.left - 8),
        320
      )
    : 24;

  const dim = "absolute bg-slate-900/55";

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="gruppeleder-veiledning-tittel">
      {highlight ? (
        <>
          <button type="button" aria-label="Lukk veiledning" className={`${dim} top-0 left-0 right-0 cursor-default`} style={{ height: highlight.top }} onClick={onClose} />
          <button type="button" aria-label="Lukk veiledning" className={`${dim} left-0 cursor-default`} style={{ top: highlight.top, width: highlight.left, height: highlight.height }} onClick={onClose} />
          <button type="button" aria-label="Lukk veiledning" className={`${dim} right-0 cursor-default`} style={{ top: highlight.top, left: highlight.left + highlight.width, height: highlight.height }} onClick={onClose} />
          <button type="button" aria-label="Lukk veiledning" className={`${dim} bottom-0 left-0 right-0 cursor-default`} style={{ top: highlight.top + highlight.height }} onClick={onClose} />
          <div
            className="absolute rounded-2xl ring-2 ring-[#2d5a3f] pointer-events-auto"
            style={{
              top: highlight.top,
              left: highlight.left,
              width: highlight.width,
              height: highlight.height,
            }}
          />
        </>
      ) : (
        <button type="button" aria-label="Lukk veiledning" className="absolute inset-0 bg-slate-900/55 cursor-default" onClick={onClose} />
      )}

      <div
        ref={kortRef}
        className="absolute w-[min(22rem,calc(100vw-2rem))] bg-white rounded-2xl shadow-2xl border border-slate-200 p-4"
        style={{ top: kortPos.top, left: kortPos.left }}
      >
        {kortPos.plassering === "below" && highlight && (
          <span
            className="absolute -top-2 w-4 h-4 bg-white border-l border-t border-slate-200 rotate-45"
            style={{ left: pilVenstre }}
          />
        )}
        {kortPos.plassering === "above" && highlight && (
          <span
            className="absolute -bottom-2 w-4 h-4 bg-white border-r border-b border-slate-200 rotate-45"
            style={{ left: pilVenstre }}
          />
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[#eef5f1] text-[#2d5a3f] shrink-0">
              {steg.target === "status" ? (
                <span className="flex items-center gap-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </span>
              ) : (
                <steg.Icon className="w-5 h-5" />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#2d5a3f]">
                Slik gjør du det · {stegIndex + 1} av {totalt}
              </p>
              <h3 id="gruppeleder-veiledning-tittel" className="text-base font-bold text-slate-900">
                {steg.tittel}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer shrink-0"
            aria-label="Lukk veiledning"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{steg.tekst}</p>

        <div className="flex items-center justify-between gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer px-1 py-1"
          >
            Hopp over
          </button>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={stegIndex === 0}
              onClick={() => setStegIndex((i) => Math.max(0, i - 1))}
              className="inline-flex items-center gap-0.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-40 cursor-pointer disabled:cursor-default"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Forrige
            </button>
            {stegIndex < totalt - 1 ? (
              <button
                type="button"
                onClick={() => setStegIndex((i) => Math.min(totalt - 1, i + 1))}
                className="inline-flex items-center gap-0.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#2d5a3f] hover:bg-[#234731] rounded-lg cursor-pointer"
              >
                Neste
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#2d5a3f] hover:bg-[#234731] rounded-lg cursor-pointer"
              >
                Ferdig
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
