import React, { useCallback, useEffect, useMemo, useState } from "react";
import { LayoutGrid, SquareStack } from "lucide-react";
import { Rolle } from "../types/database";
import {
  DatabaseState,
  DeltakelseStatus,
  arkCelleInnhold,
  arkRoller,
  finnPersonMedVisningsnavn,
  fjernSisteFraCelle,
  foreslaPersonerForCelle,
  saveDatabase,
  settDeltakelseForPerson,
  tildelEksternPersonMedStatus,
  tildelNavnICelle,
  tomArkCelle,
} from "../services/dataService";
import { ArkCelle, sisteCelleFragment } from "./ArkCelle";

export type ArkVisning = "liste" | "ark";

export function ListeArkBryter({
  visning,
  onChange,
}: {
  visning: ArkVisning;
  onChange: (v: ArkVisning) => void;
}) {
  return (
    <div
      className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5"
      role="group"
      aria-label="Visning"
    >
      <button
        type="button"
        data-testid="ark-toggle-liste"
        title="Kort"
        aria-label="Kort"
        aria-pressed={visning === "liste"}
        onClick={() => onChange("liste")}
        className={`inline-flex items-center justify-center w-9 h-9 rounded-[10px] cursor-pointer ${
          visning === "liste"
            ? "bg-white text-[#2d5a3f] shadow-xs"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <SquareStack className="w-4 h-4" />
      </button>
      <button
        type="button"
        data-testid="ark-toggle-ark"
        title="Ark"
        aria-label="Ark"
        aria-pressed={visning === "ark"}
        onClick={() => onChange("ark")}
        className={`inline-flex items-center justify-center w-9 h-9 rounded-[10px] cursor-pointer ${
          visning === "ark"
            ? "bg-white text-[#2d5a3f] shadow-xs"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
    </div>
  );
}

function iDagIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatArkDato(iso: string): string {
  const parsed = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function cloneDb(db: DatabaseState): DatabaseState {
  return JSON.parse(JSON.stringify(db)) as DatabaseState;
}

function arkKommentar(status: DeltakelseStatus): string {
  return status === "Deltar" ? "Bekreftet i planleggingsark" : "Forespurt i planleggingsark";
}

interface PlanleggingsarkProps {
  db: DatabaseState;
  onUpdateDb: (updated: DatabaseState) => void;
  onVelgGudstjeneste?: (gudstjenesteId: string) => void;
  valgtGudstjenesteId?: string | null;
  rolleIds?: string[];
  gruppeId?: string;
  fullBredde?: boolean;
}

export const Planleggingsark: React.FC<PlanleggingsarkProps> = ({
  db,
  onUpdateDb,
  onVelgGudstjeneste,
  valgtGudstjenesteId,
  rolleIds,
  gruppeId,
  fullBredde = false,
}) => {
  const [nyStatus, setNyStatus] = useState<DeltakelseStatus>("Deltar");
  const [visBareHull, setVisBareHull] = useState(false);
  const [isolertRolleId, setIsolertRolleId] = useState<string | null>(null);
  const [rad, setRad] = useState(0);
  const [kol, setKol] = useState(0);
  const [redigerer, setRedigerer] = useState(false);
  const [sok, setSok] = useState("");
  const [forslagIndex, setForslagIndex] = useState(0);
  const [undoStack, setUndoStack] = useState<DatabaseState[]>([]);

  const iDag = iDagIso();
  const gudstjenester = useMemo(
    () =>
      db.gudstjenester
        .filter((g) => g.Dato >= iDag)
        .slice()
        .sort((a, b) => `${a.Dato} ${a.Tid}`.localeCompare(`${b.Dato} ${b.Tid}`)),
    [db.gudstjenester, iDag]
  );
  const alleRoller = useMemo(() => arkRoller(db, rolleIds), [db, rolleIds]);
  const roller = useMemo(
    () => (isolertRolleId ? alleRoller.filter((r) => r.RolleID === isolertRolleId) : alleRoller),
    [alleRoller, isolertRolleId]
  );

  const aktivGud = gudstjenester[rad];
  const aktivRolle = roller[kol];

  useEffect(() => {
    if (rad >= gudstjenester.length) setRad(Math.max(0, gudstjenester.length - 1));
  }, [rad, gudstjenester.length]);
  useEffect(() => {
    if (kol >= roller.length) setKol(Math.max(0, roller.length - 1));
  }, [kol, roller.length]);

  const lukkRediger = useCallback(() => {
    setRedigerer(false);
    setSok("");
    setForslagIndex(0);
  }, []);

  const flytt = useCallback(
    (dRad: number, dKol: number) => {
      setRad((r) => Math.max(0, Math.min(gudstjenester.length - 1, r + dRad)));
      setKol((k) => Math.max(0, Math.min(roller.length - 1, k + dKol)));
      setSok("");
      setForslagIndex(0);
      setRedigerer(true);
    },
    [gudstjenester.length, roller.length]
  );

  const commit = useCallback(
    (mutator: (current: DatabaseState) => DatabaseState) => {
      setUndoStack((prev) => {
        const neste = [...prev, cloneDb(db)];
        return neste.length > 40 ? neste.slice(neste.length - 40) : neste;
      });
      onUpdateDb(mutator(db));
    },
    [db, onUpdateDb]
  );

  const angre = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const kopi = [...prev];
      const forrige = kopi.pop()!;
      saveDatabase(forrige);
      onUpdateDb(forrige);
      return kopi;
    });
    lukkRediger();
  }, [lukkRediger, onUpdateDb]);

  const tildelPerson = useCallback(
    (personId: string, gudId?: string, rolleId?: string) => {
      const gud = gudId || aktivGud?.GudstjenesteID;
      const rolle = rolleId || aktivRolle?.RolleID;
      if (!gud || !rolle) return;
      commit((current) =>
        settDeltakelseForPerson(current, personId, gud, rolle, nyStatus, arkKommentar(nyStatus))
      );
      setSok("");
      setForslagIndex(0);
    },
    [aktivGud, aktivRolle, commit, nyStatus]
  );

  const tildelEkstern = useCallback(
    (navn: string, gudId?: string, rolleId?: string) => {
      const gud = gudId || aktivGud?.GudstjenesteID;
      const rolle = rolleId || aktivRolle?.RolleID;
      if (!gud || !rolle || !navn.trim()) return;
      commit((current) =>
        tildelEksternPersonMedStatus(
          current,
          gud,
          rolle,
          navn.trim(),
          nyStatus,
          arkKommentar(nyStatus)
        )
      );
      setSok("");
      setForslagIndex(0);
    },
    [aktivGud, aktivRolle, commit, nyStatus]
  );

  const tildelTekstICelle = useCallback(
    (gudId: string, rolle: Rolle, tekst: string) => {
      const raw = tekst.trim();
      if (!raw) return;
      if (/[,;]/.test(raw)) {
        commit((current) => tildelNavnICelle(current, gudId, rolle.RolleID, raw, nyStatus, arkKommentar(nyStatus)));
        return;
      }
      const unik = finnPersonMedVisningsnavn(db, raw);
      if (unik) {
        tildelPerson(unik.PersonID, gudId, rolle.RolleID);
        return;
      }
      const fragment = sisteCelleFragment(raw);
      const forslag = foreslaPersonerForCelle(db, gudId, rolle.RolleID, fragment, {
        gruppeId: gruppeId || rolle.GruppeID,
        limit: 10,
      });
      const visEkstern = fragment.length > 0;
      const menyAntall = forslag.length + (visEkstern ? 1 : 0);
      if (menyAntall > 0 && forslagIndex < forslag.length) {
        const f = forslag[forslagIndex];
        if (f) tildelPerson(f.personId, gudId, rolle.RolleID);
        return;
      }
      if (visEkstern) tildelEkstern(fragment, gudId, rolle.RolleID);
    },
    [commit, db, forslagIndex, gruppeId, nyStatus, tildelEkstern, tildelPerson]
  );

  const handleTildelTekst = useCallback(() => {
    if (!aktivGud || !aktivRolle) return;
    tildelTekstICelle(aktivGud.GudstjenesteID, aktivRolle, sok);
    setSok("");
  }, [aktivGud, aktivRolle, sok, tildelTekstICelle]);

  const fyllNed = useCallback(() => {
    if (!aktivGud || !aktivRolle || rad === 0) return;
    const over = gudstjenester[rad - 1];
    if (!over) return;
    const kilde = arkCelleInnhold(db, over.GudstjenesteID, aktivRolle);
    const navn = kilde.personer.filter((p) => p.status !== "Avvist").map((p) => p.navn);
    if (navn.length === 0) return;
    commit((current) =>
      tildelNavnICelle(
        current,
        aktivGud.GudstjenesteID,
        aktivRolle.RolleID,
        navn.join(", "),
        nyStatus,
        arkKommentar(nyStatus)
      )
    );
  }, [aktivGud, aktivRolle, commit, db, gudstjenester, nyStatus, rad]);

  const limInnMatrise = useCallback(
    (text: string) => {
      if (!aktivGud || !aktivRolle) return;
      const linjer = text.replace(/\r/g, "").split("\n");
      while (linjer.length && !linjer[linjer.length - 1].trim()) linjer.pop();
      if (linjer.length === 0) return;
      commit((current) => {
        let next = current;
        linjer.forEach((linje, rOff) => {
          const gud = gudstjenester[rad + rOff];
          if (!gud) return;
          linje.split("\t").forEach((celle, kOff) => {
            const rolle = roller[kol + kOff];
            const navn = celle.trim();
            if (!rolle || !navn) return;
            next = tildelNavnICelle(
              next,
              gud.GudstjenesteID,
              rolle.RolleID,
              navn,
              nyStatus,
              arkKommentar(nyStatus)
            );
          });
        });
        return next;
      });
    },
    [aktivGud, aktivRolle, commit, gudstjenester, kol, nyStatus, rad, roller]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const iArk = Boolean(target?.closest?.("[data-testid='planleggingsark']"));
      const skriverAnnetSted =
        !iArk &&
        (target?.tagName === "INPUT" ||
          target?.tagName === "TEXTAREA" ||
          target?.tagName === "SELECT" ||
          Boolean(target?.isContentEditable));
      if (skriverAnnetSted) return;

      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        angre();
        return;
      }
      if (meta && e.key.toLowerCase() === "d") {
        e.preventDefault();
        fyllNed();
        return;
      }
      if (redigerer) return;
      if (e.key === "Enter") {
        e.preventDefault();
        setRedigerer(true);
        return;
      }
      if (e.key === "Delete") {
        e.preventDefault();
        if (!aktivGud || !aktivRolle) return;
        commit((current) => tomArkCelle(current, aktivGud.GudstjenesteID, aktivRolle.RolleID));
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        if (!aktivGud || !aktivRolle) return;
        commit((current) => fjernSisteFraCelle(current, aktivGud.GudstjenesteID, aktivRolle.RolleID));
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        flytt(1, 0);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        flytt(-1, 0);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        flytt(0, -1);
      } else if (e.key === "ArrowRight" || e.key === "Tab") {
        e.preventDefault();
        flytt(0, e.shiftKey ? -1 : 1);
      } else if (e.key.length === 1 && !meta) {
        setRedigerer(true);
        setSok(e.key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aktivGud, aktivRolle, angre, commit, flytt, fyllNed, redigerer]);

  const startRediger = (r: number, k: number) => {
    setRad(r);
    setKol(k);
    setRedigerer(true);
    setSok("");
    setForslagIndex(0);
  };

  return (
    <div
      className="space-y-2"
      data-testid="planleggingsark"
      onPaste={(e) => {
        const text = e.clipboardData.getData("text");
        if (!text) return;
        if (text.includes("\n") || text.includes("\t")) {
          e.preventDefault();
          limInnMatrise(text);
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl border border-slate-200 px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Nye navn blir</span>
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
            <button
              type="button"
              aria-pressed={nyStatus === "Deltar"}
              onClick={() => setNyStatus("Deltar")}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                nyStatus === "Deltar"
                  ? "bg-emerald-100 text-emerald-900"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Bekreftet
            </button>
            <button
              type="button"
              aria-pressed={nyStatus === "Avventer"}
              onClick={() => setNyStatus("Avventer")}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer ${
                nyStatus === "Avventer"
                  ? "bg-amber-100 text-amber-950"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Forespurt
            </button>
          </div>
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={visBareHull}
            onChange={(e) => setVisBareHull(e.target.checked)}
            className="rounded border-slate-300"
          />
          Vis bare hull
        </label>
        <p className="text-[11px] text-slate-400 ml-auto hidden lg:block">
          Enter: neste søndag · Tab: neste rolle · Ctrl+D: fyll ned · Ctrl+Z: angre
        </p>
      </div>

      <div>
        <div className="bg-white rounded-md border border-slate-200 overflow-auto max-h-[calc(100dvh-11rem)]">
          {gudstjenester.length === 0 || roller.length === 0 ? (
            <p className="px-4 py-8 text-sm text-slate-500 text-center">
              {roller.length === 0
                ? "Ingen tjenesteroller å vise."
                : "Ingen kommende gudstjenester."}
            </p>
          ) : (
            <table
              className={`text-left text-sm border-separate border-spacing-0 w-full ${
                fullBredde ? "min-w-[70rem] table-fixed" : "min-w-0"
              }`}
            >
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className="px-1.5 py-1.5 sticky left-0 z-30 bg-slate-50 border-b border-r border-slate-200 w-[8.5rem]">
                    Dato
                  </th>
                  {roller.map((rolle) => {
                    const isolert = isolertRolleId === rolle.RolleID;
                    return (
                      <th
                        key={rolle.RolleID}
                        className={`px-1.5 py-1.5 border-b border-slate-200 bg-slate-50 font-semibold text-slate-700 cursor-pointer hover:text-[#2d5a3f] whitespace-normal break-words leading-tight ${
                          isolert ? "text-[#2d5a3f] bg-[#eef5f1]" : ""
                        }`}
                        title="Klikk for å vise bare denne rollen"
                        onClick={() =>
                          setIsolertRolleId((prev) =>
                            prev === rolle.RolleID ? null : rolle.RolleID
                          )
                        }
                      >
                        {rolle.Rollenavn}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {gudstjenester.map((gud, r) => {
                  const zebra = r % 2 === 1 ? "bg-[#eef5f1]" : "bg-white";
                  const valgt = valgtGudstjenesteId === gud.GudstjenesteID;
                  return (
                    <tr key={gud.GudstjenesteID} className={zebra}>
                      <th
                        className={`px-1.5 py-1 sticky left-0 z-10 border-b border-r border-slate-200 text-left font-semibold ${zebra} ${
                          valgt ? "text-[#2d5a3f]" : "text-slate-800"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onVelgGudstjeneste?.(gud.GudstjenesteID)}
                          className="text-left cursor-pointer hover:text-[#2d5a3f] w-full"
                        >
                          <span className="block whitespace-nowrap">{formatArkDato(gud.Dato)}</span>
                          {gud.Tema ? (
                            <span className="block text-[11px] font-medium text-slate-500 truncate">
                              {gud.Tema}
                            </span>
                          ) : null}
                        </button>
                      </th>
                      {roller.map((rolle, k) => {
                        const innhold = arkCelleInnhold(db, gud.GudstjenesteID, rolle);
                        const dimmet = visBareHull && innhold.ledige === 0;
                        const aktiv = r === rad && k === kol;
                        return (
                          <ArkCelle
                            key={rolle.RolleID}
                            db={db}
                            gudstjenesteId={gud.GudstjenesteID}
                            rolle={rolle}
                            aktiv={aktiv}
                            redigerer={aktiv && redigerer}
                            dimmet={dimmet}
                            bakgrunn={zebra}
                            gruppeId={gruppeId || rolle.GruppeID}
                            sok={aktiv ? sok : ""}
                            forslagIndex={aktiv ? forslagIndex : 0}
                            onSokChange={(v) => {
                              setSok(v);
                              setForslagIndex(0);
                            }}
                            onForslagIndex={setForslagIndex}
                            onStartRediger={() => startRediger(r, k)}
                            onAvbryt={lukkRediger}
                            onVelgPerson={(personId) => tildelPerson(personId)}
                            onVelgEkstern={(navn) => tildelEkstern(navn)}
                            onTildelTekst={handleTildelTekst}
                            onFjernSiste={() => {
                              if (!aktivGud || !aktivRolle) return;
                              commit((current) =>
                                fjernSisteFraCelle(
                                  current,
                                  aktivGud.GudstjenesteID,
                                  aktivRolle.RolleID
                                )
                              );
                            }}
                            onTomCelle={() => {
                              if (!aktivGud || !aktivRolle) return;
                              commit((current) =>
                                tomArkCelle(current, aktivGud.GudstjenesteID, aktivRolle.RolleID)
                              );
                            }}
                            onEnter={() => flytt(1, 0)}
                            onTab={(shift) => flytt(0, shift ? -1 : 1)}
                            onPil={(retning) => {
                              if (retning === "up") flytt(-1, 0);
                              else if (retning === "down") flytt(1, 0);
                              else if (retning === "left") flytt(0, -1);
                              else flytt(0, 1);
                            }}
                          />
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
};
