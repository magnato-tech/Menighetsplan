import React, { useMemo, useState } from "react";
import { LayoutGrid, List, Plus, Search, Share2, Star, Eye, Trash2 } from "lucide-react";
import { Gruppe } from "../types/database";
import {
  DatabaseState,
  AppView,
  erTjenestegruppe,
  gruppetypeNokkel,
  toggleGruppetypeFilter,
} from "../services/dataService";
import { RolleIkon } from "./RolleIkon";
import { IkonHandling } from "./IkonHandling";
import { Samlingsplanlegging } from "./Samlingsplanlegging";

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

function aktiveRollerIGruppe(db: DatabaseState, gruppeId: string) {
  return db.roller
    .filter((r) => r.Aktiv && r.GruppeID === gruppeId)
    .slice()
    .sort((a, b) => a.Rollenavn.localeCompare(b.Rollenavn, "nb"));
}

function RolleChips({ navn, visTomHint }: { navn: string[]; visTomHint: boolean }) {
  if (navn.length === 0) {
    if (!visTomHint) return null;
    return (
      <span className="text-[11px] text-slate-400">Ingen oppgaver knyttet</span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      {navn.map((n) => (
        <span
          key={n}
          className="text-[10px] font-semibold text-[#2d5a3f] bg-[#eef5f1] border border-[#d2e8d9] px-1.5 py-0.5 rounded-full"
        >
          {n}
        </span>
      ))}
    </div>
  );
}

function ikonNavn(db: DatabaseState, gruppe: Gruppe): string {
  const roller = db.roller.filter((r) => r.Aktiv && r.GruppeID === gruppe.GruppeID);
  if (roller[0]?.Rollenavn) return roller[0].Rollenavn;
  return gruppe.Gruppenavn;
}

interface GroupOverviewProps {
  db: DatabaseState;
  groupTypeFilter: string[];
  onGroupTypeFilter: (ids: string[]) => void;
  copiedPersonId: string | null;
  onCopyLink: (personId: string) => void;
  onOpenEdit: (gruppeId: string) => void;
  onNewGroup: () => void;
  onSelectPerson: (personId: string, view?: AppView) => void;
  onSlettGruppe: (gruppeId: string) => void;
  onNyKategori: (navn: string) => void;
  onUpdateDb: (updatedDb: DatabaseState) => void;
}

export const GroupOverview: React.FC<GroupOverviewProps> = ({
  db,
  groupTypeFilter,
  onGroupTypeFilter,
  copiedPersonId,
  onCopyLink,
  onOpenEdit,
  onNewGroup,
  onSelectPerson,
  onSlettGruppe,
  onNyKategori,
  onUpdateDb,
}) => {
  const [sok, setSok] = useState("");
  const [visning, setVisning] = useState<"grid" | "list">("grid");
  const [slettGruppe, setSlettGruppe] = useState<Gruppe | null>(null);
  const [nyKategoriApen, setNyKategoriApen] = useState(false);
  const [nyKategoriNavn, setNyKategoriNavn] = useState("");

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
      .filter((g) => groupTypeFilter.length === 0 || groupTypeFilter.includes(g.GruppetypeID))
      .filter((g) => {
        if (!q) return true;
        const typeNavn = db.gruppetyper.find((gt) => gt.GruppetypeID === g.GruppetypeID)?.Navn || "";
        const leder = db.personer.find((p) => p.PersonID === g.GruppelederID);
        const nestleder = db.personer.find((p) => p.PersonID === g.NestlederID);
        const roller = aktiveRollerIGruppe(db, g.GruppeID).map((r) => r.Rollenavn);
        return [g.Gruppenavn, g.Beskrivelse, typeNavn, leder?.Navn, nestleder?.Navn, ...roller]
          .filter(Boolean)
          .some((t) => String(t).toLowerCase().includes(q));
      })
      .sort((a, b) => a.Gruppenavn.localeCompare(b.Gruppenavn, "nb"));
  }, [db, groupTypeFilter, sok]);

  const visAlle = groupTypeFilter.length === 0;

  const velgType = (id: string) => {
    onGroupTypeFilter(toggleGruppetypeFilter(groupTypeFilter, id));
  };

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
        <div className="flex flex-wrap items-center gap-1.5" data-testid="gruppe-piller" role="group" aria-label="Filtrer gruppetype">
          <button
            type="button"
            aria-pressed={visAlle}
            onClick={() => velgType("alle")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
              visAlle
                ? "bg-[#2d5a3f] text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:border-[#2d5a3f]/40"
            }`}
          >
            Alle ({antallAktiveForType(db, "alle")})
          </button>
          {typer.map((gt) => {
            const n = antallAktiveForType(db, gt.GruppetypeID);
            const valgt = groupTypeFilter.includes(gt.GruppetypeID);
            return (
              <button
                key={gt.GruppetypeID}
                type="button"
                aria-pressed={valgt}
                onClick={() => velgType(gt.GruppetypeID)}
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
          <button
            type="button"
            onClick={() => {
              setNyKategoriNavn("");
              setNyKategoriApen(true);
            }}
            className="w-7 h-7 rounded-full border border-slate-200 bg-white text-slate-500 hover:border-[#2d5a3f]/40 hover:text-[#2d5a3f] flex items-center justify-center cursor-pointer"
            title="Ny kategori"
            aria-label="Ny kategori"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
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
            const visLederknapp = Boolean(leder);
            const rolleNavn = aktiveRollerIGruppe(db, gruppe.GruppeID).map((r) => r.Rollenavn);
            const visTomRoller = erTjenestegruppe(db, gruppe);

            const apne = () => onOpenEdit(gruppe.GruppeID);
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
                    <span className="truncate">{nestleder ? nestleder.Navn : "Ingen nestleder"}</span>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 border-l border-slate-200 pl-2.5 shrink-0">
                    {medlemstall} MEDL.
                  </span>
                  <div className="min-w-0 flex-1">
                    <RolleChips navn={rolleNavn} visTomHint={visTomRoller} />
                  </div>
                  <div className="flex items-center gap-1 ml-auto">
                    {leder && (
                      <>
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
                      </>
                    )}
                    <IkonHandling
                      label="Slett gruppe"
                      Icon={Trash2}
                      variant="decline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSlettGruppe(gruppe);
                      }}
                    />
                  </div>
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
                <p className="text-xs text-slate-500 mt-3">
                  {gruppe.Beskrivelse?.trim() || "Ingen beskrivelse tilgjengelig"}
                </p>
                <div className="mt-2.5 flex-1">
                  <RolleChips navn={rolleNavn} visTomHint={visTomRoller} />
                </div>
                <div className="mt-3">
                  <Samlingsplanlegging
                    db={db}
                    gruppeId={gruppe.GruppeID}
                    onUpdateDb={onUpdateDb}
                  />
                </div>
                <div className="flex items-end justify-between gap-2 mt-3 pt-3 border-t border-slate-100">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1 text-xs text-slate-800">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-500 shrink-0" />
                      <span className="truncate font-medium">
                        {leder ? leder.Fornavn || leder.Navn : "Ingen leder"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-600">
                      <Star className="w-3 h-3 fill-sky-500 text-sky-500 shrink-0" />
                      <span className="truncate">
                        {nestleder
                          ? `${nestleder.Fornavn || nestleder.Navn} (Nestleder)`
                          : "Ingen nestleder"}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {medlemstall} MEDL.
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {leder && (
                      <>
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
                      </>
                    )}
                    <IkonHandling
                      label="Slett gruppe"
                      Icon={Trash2}
                      variant="decline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSlettGruppe(gruppe);
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {slettGruppe && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          onClick={() => setSlettGruppe(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-slate-900 text-lg">Slett gruppe?</h3>
            <p className="text-sm text-slate-600 mt-2">
              Er du sikker på at du vil slette <strong>{slettGruppe.Gruppenavn}</strong>? Denne
              handlingen kan ikke angres.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setSlettGruppe(null)}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={() => {
                  onSlettGruppe(slettGruppe.GruppeID);
                  setSlettGruppe(null);
                }}
                className="px-3 py-1.5 text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer"
              >
                Slett
              </button>
            </div>
          </div>
        </div>
      )}

      {nyKategoriApen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          onClick={() => setNyKategoriApen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-slate-900 text-lg">Ny kategori</h3>
            <p className="text-sm text-slate-600 mt-2">
              Kategorien vises som en egen fane i gruppeoversikten, og kan brukes når du oppretter
              grupper.
            </p>
            <label className="block text-xs font-semibold text-slate-500 mt-4 mb-1" htmlFor="ny-kategori-navn">
              Navn
            </label>
            <input
              id="ny-kategori-navn"
              type="text"
              autoFocus
              value={nyKategoriNavn}
              onChange={(e) => setNyKategoriNavn(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && nyKategoriNavn.trim()) {
                  onNyKategori(nyKategoriNavn);
                  setNyKategoriApen(false);
                  setNyKategoriNavn("");
                }
              }}
              placeholder="F.eks. Ungdom"
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
            />
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setNyKategoriApen(false)}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Avbryt
              </button>
              <button
                type="button"
                disabled={!nyKategoriNavn.trim()}
                onClick={() => {
                  onNyKategori(nyKategoriNavn);
                  setNyKategoriApen(false);
                  setNyKategoriNavn("");
                }}
                className="px-3 py-1.5 text-sm font-semibold bg-[#2d5a3f] hover:bg-[#234731] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg cursor-pointer"
              >
                Opprett
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
