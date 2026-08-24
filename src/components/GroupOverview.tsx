import React, { useMemo, useState } from "react";
import { LayoutGrid, List, Plus, Search, Share2, Star, Eye } from "lucide-react";
import { Gruppe } from "../types/database";
import {
  DatabaseState,
  AppView,
  erTjenestegruppe,
  gruppetypeNokkel,
} from "../services/dataService";
import { RolleIkon } from "./RolleIkon";
import { IkonHandling } from "./IkonHandling";

const GRUPPETYPE_PILLE_REKKEFOLGE = [
  "tjenestegruppe",
  "husgruppe",
  "barnekirke",
  "ledergruppe",
  "gruppeledergruppe",
];

const GRUPPETYPE_PILLE_LABEL: Record<string, string> = {
  tjenestegruppe: "Tjenestegrupper",
  husgruppe: "Husgrupper",
  barnekirke: "Barnekirke",
  ledergruppe: "Lederskap",
  gruppeledergruppe: "Gruppelederteam",
};

function pilleLabelForType(navn: string): string {
  const nøkkel = gruppetypeNokkel(navn);
  return GRUPPETYPE_PILLE_LABEL[nøkkel] || navn;
}

function antallAktiveForType(db: DatabaseState, gruppetypeId: string | "alle"): number {
  const aktive = db.grupper.filter((g) => g.Aktiv);
  if (gruppetypeId === "alle") return aktive.length;
  return aktive.filter((g) => g.GruppetypeID === gruppetypeId).length;
}

function antallMedlemmer(db: DatabaseState, gruppe: Gruppe): number {
  const ids = new Set(
    db.gruppemedlemmer
      .filter((gm) => gm.GruppeID === gruppe.GruppeID && gm.Aktiv)
      .map((gm) => gm.PersonID)
  );
  if (gruppe.GruppelederID) ids.add(gruppe.GruppelederID);
  if (gruppe.NestlederID) ids.add(gruppe.NestlederID);
  return ids.size;
}

function ikonNavn(db: DatabaseState, gruppe: Gruppe): string {
  const roller = db.roller.filter((r) => r.Aktiv && r.GruppeID === gruppe.GruppeID);
  if (roller[0]?.Rollenavn) return roller[0].Rollenavn;
  return gruppe.Gruppenavn;
}

interface GroupOverviewProps {
  db: DatabaseState;
  groupTypeFilter: string;
  onGroupTypeFilter: (id: string) => void;
  copiedPersonId: string | null;
  onCopyLink: (personId: string) => void;
  onOpenDetail: (gruppeId: string) => void;
  onNewGroup: () => void;
  onSelectPerson: (personId: string, view?: AppView) => void;
}

export const GroupOverview: React.FC<GroupOverviewProps> = ({
  db,
  groupTypeFilter,
  onGroupTypeFilter,
  copiedPersonId,
  onCopyLink,
  onOpenDetail,
  onNewGroup,
  onSelectPerson,
}) => {
  const [sok, setSok] = useState("");
  const [visning, setVisning] = useState<"grid" | "list">("grid");

  const typer = useMemo(
    () =>
      db.gruppetyper
        .filter((gt) => gt.Aktiv)
        .slice()
        .sort((a, b) => {
          const ia = GRUPPETYPE_PILLE_REKKEFOLGE.indexOf(gruppetypeNokkel(a.Navn));
          const ib = GRUPPETYPE_PILLE_REKKEFOLGE.indexOf(gruppetypeNokkel(b.Navn));
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        }),
    [db.gruppetyper]
  );

  const synlige = useMemo(() => {
    const q = sok.trim().toLowerCase();
    return db.grupper
      .filter((g) => g.Aktiv)
      .filter((g) => groupTypeFilter === "alle" || g.GruppetypeID === groupTypeFilter)
      .filter((g) => {
        if (!q) return true;
        const typeNavn = db.gruppetyper.find((gt) => gt.GruppetypeID === g.GruppetypeID)?.Navn || "";
        const leder = db.personer.find((p) => p.PersonID === g.GruppelederID);
        const nestleder = db.personer.find((p) => p.PersonID === g.NestlederID);
        return [g.Gruppenavn, g.Beskrivelse, typeNavn, leder?.Navn, nestleder?.Navn]
          .filter(Boolean)
          .some((t) => String(t).toLowerCase().includes(q));
      })
      .sort((a, b) => a.Gruppenavn.localeCompare(b.Gruppenavn, "nb"));
  }, [db, groupTypeFilter, sok]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            data-testid="gruppe-sok"
            value={sok}
            onChange={(e) => setSok(e.target.value)}
            placeholder="Søk i grupper..."
            className="w-full text-sm border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
          />
        </div>
        <button
          type="button"
          onClick={onNewGroup}
          className="px-3.5 py-2.5 bg-[#2d5a3f] hover:bg-[#234731] text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Ny gruppe</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5" data-testid="gruppe-piller" role="tablist" aria-label="Gruppetype">
          <button
            type="button"
            role="tab"
            aria-selected={groupTypeFilter === "alle"}
            onClick={() => onGroupTypeFilter("alle")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
              groupTypeFilter === "alle"
                ? "bg-[#2d5a3f] text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:border-[#2d5a3f]/40"
            }`}
          >
            Alle ({antallAktiveForType(db, "alle")})
          </button>
          {typer.map((gt) => {
            const n = antallAktiveForType(db, gt.GruppetypeID);
            const valgt = groupTypeFilter === gt.GruppetypeID;
            return (
              <button
                key={gt.GruppetypeID}
                type="button"
                role="tab"
                aria-selected={valgt}
                onClick={() => onGroupTypeFilter(gt.GruppetypeID)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
                  valgt
                    ? "bg-[#2d5a3f] text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:border-[#2d5a3f]/40"
                }`}
              >
                {pilleLabelForType(gt.Navn)} ({n})
              </button>
            );
          })}
        </div>
        <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200 ml-auto">
          <button
            type="button"
            onClick={() => setVisning("grid")}
            className={`p-1.5 rounded-lg cursor-pointer ${
              visning === "grid" ? "bg-white text-[#2d5a3f] shadow-xs" : "text-slate-400 hover:text-slate-600"
            }`}
            title="Rutenett"
            aria-label="Rutenett"
            aria-pressed={visning === "grid"}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setVisning("list")}
            className={`p-1.5 rounded-lg cursor-pointer ${
              visning === "list" ? "bg-white text-[#2d5a3f] shadow-xs" : "text-slate-400 hover:text-slate-600"
            }`}
            title="Liste"
            aria-label="Liste"
            aria-pressed={visning === "list"}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {synlige.length === 0 ? (
        <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl px-4 py-8 text-center">
          Ingen grupper matcher søket eller filteret.
        </p>
      ) : (
        <div
          className={
            visning === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" : "flex flex-col gap-2"
          }
        >
          {synlige.map((gruppe) => {
            const leder = db.personer.find((p) => p.PersonID === gruppe.GruppelederID);
            const nestleder = db.personer.find((p) => p.PersonID === gruppe.NestlederID);
            const medlemstall = antallMedlemmer(db, gruppe);
            const typeNavn =
              db.gruppetyper.find((gt) => gt.GruppetypeID === gruppe.GruppetypeID)?.Navn || "";
            const isCopiedLeder = leder && copiedPersonId === leder.PersonID;
            const visLederknapp = Boolean(leder && erTjenestegruppe(db, gruppe));

            const apne = () => onOpenDetail(gruppe.GruppeID);
            const tast = (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                apne();
              }
            };

            if (visning === "list") {
              return (
                <div
                  key={gruppe.GruppeID}
                  role="button"
                  tabIndex={0}
                  onClick={apne}
                  onKeyDown={tast}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 hover:border-[#2d5a3f]/40 cursor-pointer text-left shadow-xs"
                >
                  <div className="flex items-center gap-2 min-w-[140px] flex-1">
                    <RolleIkon rollenavn={ikonNavn(db, gruppe)} />
                    <div className="min-w-0">
                      <span className="font-bold text-slate-900 text-sm block truncate">{gruppe.Gruppenavn}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {pilleLabelForType(typeNavn)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-700 min-w-[140px]">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0" />
                    <span className="truncate">{leder ? leder.Navn : "Ingen leder"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-700 min-w-[140px]">
                    <Star className="w-3.5 h-3.5 fill-sky-500 text-sky-500 shrink-0" />
                    <span className="truncate">{nestleder ? nestleder.Navn : "—"}</span>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 border-l border-slate-200 pl-2.5 shrink-0">
                    {medlemstall} MEDL.
                  </span>
                  {leder && (
                    <div className="flex items-center gap-1 ml-auto">
                      <IkonHandling
                        label="Kopier personlenke"
                        Icon={Share2}
                        variant="sky"
                        copied={Boolean(isCopiedLeder)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onCopyLink(leder.PersonID);
                        }}
                      />
                      {visLederknapp && (
                        <IkonHandling
                          label="Se som denne lederen"
                          Icon={Eye}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPerson(leder.PersonID, "leader");
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div
                key={gruppe.GruppeID}
                role="button"
                tabIndex={0}
                onClick={apne}
                onKeyDown={tast}
                className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col min-h-[11.5rem] hover:border-[#2d5a3f]/40 cursor-pointer text-left shadow-xs"
              >
                <div className="flex items-start gap-2.5">
                  <RolleIkon rollenavn={ikonNavn(db, gruppe)} className="w-10 h-10" />
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-sm truncate">{gruppe.Gruppenavn}</div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      {pilleLabelForType(typeNavn)}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-3 flex-1">
                  {gruppe.Beskrivelse?.trim() || "Ingen beskrivelse tilgjengelig"}
                </p>
                <div className="flex items-end justify-between gap-2 mt-3 pt-3 border-t border-slate-100">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {medlemstall} MEDL.
                  </span>
                  <div className="text-right space-y-0.5 min-w-0">
                    <div className="flex items-center justify-end gap-1 text-xs text-slate-800">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-500 shrink-0" />
                      <span className="truncate font-medium">{leder ? leder.Fornavn || leder.Navn : "—"}</span>
                    </div>
                    {nestleder && (
                      <div className="flex items-center justify-end gap-1 text-[11px] text-slate-600">
                        <Star className="w-3 h-3 fill-sky-500 text-sky-500 shrink-0" />
                        <span className="truncate">
                          {nestleder.Fornavn || nestleder.Navn} (Nestleder)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
