import React, { useState } from "react";
import {
  AppView,
  DatabaseState,
  hentTilgang,
  hentVisningsRoller,
} from "../services/dataService";
import { Rolle } from "../types/database";
import { RolleIkon } from "./RolleIkon";
import { Ellipsis, ShieldCheck, UserCheck, Users } from "lucide-react";

export type LederSeksjon = "gruppe" | "medlemmer";

interface MobilBunnmenyProps {
  db: DatabaseState;
  personId: string;
  activeView: AppView;
  datePickerRolle: Rolle | null;
  lederSeksjon: LederSeksjon;
  onNavigate: (view: AppView) => void;
  onVelgDato: (rolle: Rolle) => void;
  onFokusMedlemmer: () => void;
}

type BunnPost =
  | { id: string; kind: "rolle"; rolle: Rolle; etikett: string }
  | { id: string; kind: "nav"; view: AppView; etikett: string }
  | { id: string; kind: "medlemmer"; etikett: string };

function kortEtikett(navn: string): string {
  const trimmet = navn.trim();
  if (trimmet.length <= 12) return trimmet;
  return `${trimmet.slice(0, 11)}…`;
}

function PostIkon({ post, aktiv }: { post: BunnPost; aktiv: boolean }) {
  const farge = aktiv ? "text-[#2d5a3f]" : "text-slate-500";
  if (post.kind === "rolle") {
    return <RolleIkon rollenavn={post.rolle.Rollenavn} className="w-7 h-7" />;
  }
  if (post.kind === "medlemmer") {
    return <Users className={`w-5 h-5 ${farge}`} />;
  }
  if (post.view === "admin") return <ShieldCheck className={`w-5 h-5 ${farge}`} />;
  if (post.view === "leader") return <Users className={`w-5 h-5 ${farge}`} />;
  return <UserCheck className={`w-5 h-5 ${farge}`} />;
}

export const MobilBunnmeny: React.FC<MobilBunnmenyProps> = ({
  db,
  personId,
  activeView,
  datePickerRolle,
  lederSeksjon,
  onNavigate,
  onVelgDato,
  onFokusMedlemmer,
}) => {
  const [flereApen, setFlereApen] = useState(false);
  const tilgang = hentTilgang(db, personId);
  const roller = hentVisningsRoller(db, personId);

  const poster: BunnPost[] = [];
  if (activeView === "personal") {
    for (const rolle of roller) {
      poster.push({
        id: `rolle-${rolle.RolleID}`,
        kind: "rolle",
        rolle,
        etikett: roller.length === 1 ? "Velg dato" : kortEtikett(rolle.Rollenavn),
      });
    }
    if (tilgang.views.includes("leader")) {
      poster.push({ id: "nav-leader", kind: "nav", view: "leader", etikett: "Gruppe" });
    }
    if (tilgang.views.includes("admin")) {
      poster.push({ id: "nav-admin", kind: "nav", view: "admin", etikett: "Admin" });
    }
  } else if (activeView === "leader") {
    poster.push({ id: "nav-personal", kind: "nav", view: "personal", etikett: "Min side" });
    poster.push({ id: "nav-leader", kind: "nav", view: "leader", etikett: "Gruppe" });
    poster.push({ id: "medlemmer", kind: "medlemmer", etikett: "Medlemmer" });
    if (tilgang.views.includes("admin")) {
      poster.push({ id: "nav-admin", kind: "nav", view: "admin", etikett: "Admin" });
    }
  } else {
    poster.push({ id: "nav-personal", kind: "nav", view: "personal", etikett: "Min side" });
    if (tilgang.views.includes("leader")) {
      poster.push({ id: "nav-leader", kind: "nav", view: "leader", etikett: "Gruppe" });
    }
    poster.push({ id: "nav-admin", kind: "nav", view: "admin", etikett: "Admin" });
  }

  const maksSynlige = 5;
  const harFlere = poster.length > maksSynlige;
  const synlige = harFlere ? poster.slice(0, maksSynlige - 1) : poster;
  const skjulte = harFlere ? poster.slice(maksSynlige - 1) : [];

  const erAktiv = (post: BunnPost) => {
    if (post.kind === "rolle") return datePickerRolle?.RolleID === post.rolle.RolleID;
    if (post.kind === "medlemmer") return activeView === "leader" && lederSeksjon === "medlemmer";
    if (post.view === "leader") return activeView === "leader" && lederSeksjon === "gruppe";
    return activeView === post.view;
  };

  const aktiver = (post: BunnPost) => {
    setFlereApen(false);
    if (post.kind === "rolle") {
      onVelgDato(post.rolle);
      return;
    }
    if (post.kind === "medlemmer") {
      onFokusMedlemmer();
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
          aria-label={post.kind === "rolle" ? `Velg dato for ${post.rolle.Rollenavn}` : post.etikett}
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
              {post.kind === "rolle" ? `Velg dato · ${post.rolle.Rollenavn}` : post.etikett}
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
