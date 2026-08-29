import React, { useState } from "react";
import {
  AppView,
  DatabaseState,
  hentTilgang,
} from "../services/dataService";
import {
  Ellipsis,
  ShieldCheck,
  UserCheck,
  Users,
  CalendarDays,
  Home,
  ClipboardList,
  ClipboardCheck,
} from "lucide-react";

export type LederSeksjon = "hjem" | "medlemmer" | "samlinger" | "bemanning" | "kalender";

export type LederNavTilstand = {
  visMedlemmer: boolean;
  visBemanning: boolean;
  visSamlinger: boolean;
  visKalender: boolean;
  visHjem: boolean;
  primarSeksjon: LederSeksjon;
};

interface MobilBunnmenyProps {
  db: DatabaseState;
  personId: string;
  activeView: AppView;
  lederSeksjon: LederSeksjon;
  lederNavTilstand?: LederNavTilstand;
  onNavigate: (view: AppView) => void;
  onFokusHjem: () => void;
  onFokusMedlemmer: () => void;
  onFokusSamlinger?: () => void;
  onFokusBemanning?: () => void;
  onFokusKalender?: () => void;
}

type BunnPost =
  | { id: string; kind: "nav"; view: AppView; etikett: string }
  | { id: string; kind: "hjem"; etikett: string }
  | { id: string; kind: "medlemmer"; etikett: string }
  | { id: string; kind: "samlinger"; etikett: string }
  | { id: string; kind: "bemanning"; etikett: string }
  | { id: string; kind: "kalender"; etikett: string };

function PostIkon({ post, aktiv }: { post: BunnPost; aktiv: boolean }) {
  const farge = aktiv ? "text-[#2d5a3f]" : "text-slate-500";
  if (post.kind === "hjem") return <Home className={`w-5 h-5 ${farge}`} />;
  if (post.kind === "medlemmer") return <Users className={`w-5 h-5 ${farge}`} />;
  if (post.kind === "samlinger") return <ClipboardList className={`w-5 h-5 ${farge}`} />;
  if (post.kind === "bemanning") return <ClipboardCheck className={`w-5 h-5 ${farge}`} />;
  if (post.kind === "kalender") return <CalendarDays className={`w-5 h-5 ${farge}`} />;
  if (post.view === "admin") return <ShieldCheck className={`w-5 h-5 ${farge}`} />;
  if (post.view === "leader") return <Users className={`w-5 h-5 ${farge}`} />;
  return <UserCheck className={`w-5 h-5 ${farge}`} />;
}

export const MobilBunnmeny: React.FC<MobilBunnmenyProps> = ({
  db,
  personId,
  activeView,
  lederSeksjon,
  lederNavTilstand,
  onNavigate,
  onFokusHjem,
  onFokusMedlemmer,
  onFokusSamlinger,
  onFokusBemanning,
  onFokusKalender,
}) => {
  const [flereApen, setFlereApen] = useState(false);
  const tilgang = hentTilgang(db, personId);

  const poster: BunnPost[] = [];
  if (activeView === "personal") {
    if (tilgang.views.includes("leader")) {
      poster.push({ id: "nav-leader", kind: "nav", view: "leader", etikett: "Ledere" });
    }
    if (tilgang.views.includes("admin")) {
      poster.push({ id: "nav-admin", kind: "nav", view: "admin", etikett: "Admin" });
    }
  } else if (activeView === "leader") {
    poster.push({ id: "nav-personal", kind: "nav", view: "personal", etikett: "Min side" });

    const primar = lederNavTilstand?.primarSeksjon;
    const lederPoster: BunnPost[] = [];
    if (lederNavTilstand?.visBemanning) {
      lederPoster.push({ id: "bemanning", kind: "bemanning", etikett: "Bemanning" });
    }
    if (lederNavTilstand?.visSamlinger) {
      lederPoster.push({ id: "samlinger", kind: "samlinger", etikett: "Samlinger" });
    }
    if (lederNavTilstand?.visMedlemmer) {
      lederPoster.push({ id: "medlemmer", kind: "medlemmer", etikett: "Medlemmer" });
    }
    if (lederNavTilstand?.visHjem !== false) {
      lederPoster.push({ id: "hjem", kind: "hjem", etikett: "Hjem" });
    }
    if (lederNavTilstand?.visKalender) {
      lederPoster.push({ id: "kalender", kind: "kalender", etikett: "Kalender" });
    }
    if (primar && primar !== "hjem") {
      lederPoster.sort((a, b) => {
        const aErPrimar = a.kind === primar ? 0 : 1;
        const bErPrimar = b.kind === primar ? 0 : 1;
        return aErPrimar - bErPrimar;
      });
    }
    poster.push(...lederPoster);
    if (tilgang.views.includes("admin")) {
      poster.push({ id: "nav-admin", kind: "nav", view: "admin", etikett: "Admin" });
    }
  } else {
    poster.push({ id: "nav-personal", kind: "nav", view: "personal", etikett: "Min side" });
    if (tilgang.views.includes("leader")) {
      poster.push({ id: "nav-leader", kind: "nav", view: "leader", etikett: "Ledere" });
    }
    poster.push({ id: "nav-admin", kind: "nav", view: "admin", etikett: "Admin" });
  }

  const maksSynlige = 5;
  const harFlere = poster.length > maksSynlige;
  const synlige = harFlere ? poster.slice(0, maksSynlige - 1) : poster;
  const skjulte = harFlere ? poster.slice(maksSynlige - 1) : [];

  const erAktiv = (post: BunnPost) => {
    if (activeView !== "leader") {
      return post.kind === "nav" && activeView === post.view;
    }
    if (post.kind === "hjem") return lederSeksjon === "hjem";
    if (post.kind === "medlemmer") return lederSeksjon === "medlemmer";
    if (post.kind === "samlinger") return lederSeksjon === "samlinger";
    if (post.kind === "bemanning") return lederSeksjon === "bemanning";
    if (post.kind === "kalender") return lederSeksjon === "kalender";
    if (post.kind === "nav" && post.view === "leader") return lederSeksjon === "hjem";
    return post.kind === "nav" && activeView === post.view;
  };

  const aktiver = (post: BunnPost) => {
    setFlereApen(false);
    if (post.kind === "hjem") {
      onFokusHjem();
      return;
    }
    if (post.kind === "medlemmer") {
      onFokusMedlemmer();
      return;
    }
    if (post.kind === "samlinger") {
      onFokusSamlinger?.();
      return;
    }
    if (post.kind === "bemanning") {
      onFokusBemanning?.();
      return;
    }
    if (post.kind === "kalender") {
      onFokusKalender?.();
      return;
    }
    onNavigate(post.view);
  };

  if (poster.length === 0) return null;

  const knapper = (liste: BunnPost[]) =>
    liste.map((post) => {
      const aktiv = erAktiv(post);
      return (
        <button
          key={post.id}
          type="button"
          onClick={() => aktiver(post)}
          className={`flex flex-col items-center justify-center gap-0.5 min-h-11 min-w-0 flex-1 px-1 py-1 rounded-xl cursor-pointer ${
            aktiv ? "text-[#1e3e2b]" : "text-slate-600"
          }`}
          aria-label={post.etikett}
        >
          <PostIkon post={post} aktiv={aktiv} />
          <span className={`text-[10px] font-semibold leading-tight text-center truncate max-w-full ${
            aktiv ? "text-[#2d5a3f]" : "text-slate-500"
          }`}>
            {post.etikett}
          </span>
        </button>
      );
    });

  return (
    <>
      {flereApen && (
        <button
          type="button"
          className="md:hidden fixed inset-0 z-40 bg-slate-900/40 cursor-pointer"
          aria-label="Lukk flere valg"
          onClick={() => setFlereApen(false)}
        />
      )}
      {flereApen && (
        <div className="md:hidden fixed left-2 right-2 z-50 rounded-2xl border border-slate-200 bg-white shadow-xl p-2"
          style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Flere
          </p>
          {skjulte.map((post) => (
            <button
              key={post.id}
              type="button"
              onClick={() => aktiver(post)}
              className="w-full flex items-center gap-3 px-3 py-3 min-h-11 rounded-xl text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <PostIkon post={post} aktiv={erAktiv(post)} />
              {post.etikett}
            </button>
          ))}
        </div>
      )}
      <nav
        className="mobil-bunnmeny no-print md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 border-t border-slate-200 shadow-[0_-4px_16px_rgba(15,23,42,0.06)]"
        aria-label="Hovedmeny"
      >
        <div className="flex items-stretch justify-around px-1 pt-1">
          {knapper(synlige)}
          {harFlere && (
            <button
              type="button"
              onClick={() => setFlereApen((v) => !v)}
              className="flex flex-col items-center justify-center gap-0.5 min-h-11 min-w-0 flex-1 px-1 py-1 rounded-xl cursor-pointer text-slate-600"
              aria-expanded={flereApen}
            >
              <Ellipsis className="w-5 h-5" />
              <span className="text-[10px] font-semibold leading-tight">Flere</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
};
