import React, { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw, X } from "lucide-react";
import {
  DatabaseState,
  avvisKalenderoppgave,
  aktiveMaler,
  foreslaMalId,
  getCustomScriptUrl,
  hentEksternIcalTekst,
  leggInnKalenderoppgave,
  opprettArrangement,
  saveDatabase,
  synkKalenderoppgaver,
  kalenderHendelserForPerson,
} from "../services/dataService";
import { ArrangementDetaljView } from "./ArrangementDetaljView";
import { KalenderAbonner } from "./KalenderAbonner";

type KalenderFilter = "alle" | "arrangement" | "gudstjeneste";
type Visning = "maaned" | "liste";

const UKEDAGER = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

function isoDato(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function startMandag(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const d = new Date(first);
  d.setDate(first.getDate() - offset);
  return d;
}

function maanedRutenett(year: number, month: number): Date[] {
  const start = startMandag(year, month);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function formatDatoNo(iso: string): string {
  return parseIso(iso).toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type KalenderRad = {
  kind: "gudstjeneste" | "arrangement";
  id: string;
  dato: string;
  tid: string;
  tittel: string;
  sted: string;
};

interface KalenderViewProps {
  db: DatabaseState;
  onUpdateDb: (updatedDb: DatabaseState) => void;
  vis: boolean;
  selectedPersonId?: string;
  onApneGudstjeneste?: (gudstjenesteId: string) => void;
  modus?: "admin" | "les";
  visAbonner?: boolean;
}

export const KalenderView: React.FC<KalenderViewProps> = ({
  db,
  onUpdateDb,
  vis,
  selectedPersonId,
  onApneGudstjeneste,
  modus = "admin",
  visAbonner = false,
}) => {
  const [nå, setNå] = useState(() => new Date());
  const [visning, setVisning] = useState<Visning>("maaned");
  const [filter, setFilter] = useState<KalenderFilter>("alle");
  const [laster, setLaster] = useState(false);
  const [feil, setFeil] = useState("");
  const [synkStatus, setSynkStatus] = useState("");
  const [nyApen, setNyApen] = useState(false);
  const [nyFelt, setNyFelt] = useState({
    tittel: "",
    dato: isoDato(new Date()),
    tid: "18:00",
    sted: "Bedehuset",
    beskrivelse: "",
    malId: "",
    gruppeId: "",
  });
  const [oppgaveMal, setOppgaveMal] = useState<Record<string, string>>({});
  const [apentArrangementId, setApentArrangementId] = useState<string | null>(null);

  const year = nå.getFullYear();
  const month = nå.getMonth();

  const hendelser = useMemo((): KalenderRad[] => {
    if (modus === "les" && selectedPersonId) {
      return kalenderHendelserForPerson(db, selectedPersonId);
    }
    const guds: KalenderRad[] = (db.gudstjenester || []).map((g) => ({
      kind: "gudstjeneste" as const,
      id: g.GudstjenesteID,
      dato: g.Dato,
      tid: g.Tid,
      tittel: g.Tema || "Gudstjeneste",
      sted: g.Sted,
    }));
    const ar: KalenderRad[] = (db.arrangementer || [])
      .filter((a) => a.Aktiv !== false)
      .map((a) => ({
        kind: "arrangement" as const,
        id: a.ArrangementID,
        dato: a.Dato,
        tid: a.Tid,
        tittel: a.Tittel,
        sted: a.Sted,
      }));
    return [...guds, ...ar].sort((a, b) => a.dato.localeCompare(b.dato) || a.tid.localeCompare(b.tid));
  }, [db, modus, selectedPersonId]);

  const filtrert = useMemo(
    () => hendelser.filter((h) => filter === "alle" || h.kind === filter),
    [hendelser, filter]
  );
  const perDato = useMemo(() => {
    const map = new Map<string, KalenderRad[]>();
    for (const h of filtrert) {
      const liste = map.get(h.dato) || [];
      liste.push(h);
      map.set(h.dato, liste);
    }
    return map;
  }, [filtrert]);

  const rutenett = useMemo(() => maanedRutenett(year, month), [year, month]);
  const apneOppgaver = modus === "admin" ? (db.kalenderoppgaver || []).filter((o) => o.Status === "Åpen") : [];
  const apentArrangement = (db.arrangementer || []).find((a) => a.ArrangementID === apentArrangementId);
  const maler = aktiveMaler(db);

  const persister = (neste: DatabaseState) => {
    saveDatabase(neste);
    onUpdateDb(neste);
  };

  const kjorSynk = async () => {
    setLaster(true);
    setFeil("");
    setSynkStatus("");
    try {
      const ics = await hentEksternIcalTekst(getCustomScriptUrl());
      const resultat = synkKalenderoppgaver(db, ics);
      persister(resultat.db);
      setSynkStatus(
        resultat.nye
          ? `${resultat.nye} hendelse(r) fra kirkekalenderen mangler i appen.`
          : "App-kalenderen dekker kirkekalenderen. Ingen nye oppgaver."
      );
    } catch (err) {
      const raa = String((err as Error)?.message || err);
      setFeil(raa === "Failed to fetch" ? "Kunne ikke hente kalenderen fra nettsiden. Prøv igjen." : raa);
    } finally {
      setLaster(false);
    }
  };

  const lagreNytt = () => {
    const malId = nyFelt.malId || foreslaMalId(db, nyFelt.tittel);
    const neste = opprettArrangement(db, { ...nyFelt, malId, opprettetAv: selectedPersonId });
    if (neste === db) return;
    persister(neste);
    setNyApen(false);
    setNyFelt((prev) => ({ ...prev, tittel: "", beskrivelse: "", malId: "", gruppeId: "" }));
  };

  const apneHendelse = (h: KalenderRad) => {
    if (h.kind === "gudstjeneste") {
      onApneGudstjeneste?.(h.id);
      return;
    }
    setApentArrangementId(h.id);
  };

  if (!vis) return null;

  const maanedTittel = nå.toLocaleDateString("nb-NO", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-[#2d5a3f]" />
          <h2 className="text-lg font-bold text-slate-900 capitalize">{maanedTittel}</h2>
          <div className="flex items-center gap-1 ml-1">
            <button
              type="button"
              onClick={() => setNå(new Date(year, month - 1, 1))}
              className="p-2 min-h-11 min-w-11 rounded-xl hover:bg-slate-100 cursor-pointer"
              aria-label="Forrige måned"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setNå(new Date())}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              I dag
            </button>
            <button
              type="button"
              onClick={() => setNå(new Date(year, month + 1, 1))}
              className="p-2 min-h-11 min-w-11 rounded-xl hover:bg-slate-100 cursor-pointer"
              aria-label="Neste måned"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {modus === "admin" && (
            <>
          <button
            type="button"
            onClick={() => {
              setNyFelt((prev) => ({
                ...prev,
                dato: isoDato(new Date()),
                malId: foreslaMalId(db, prev.tittel),
              }));
              setNyApen(true);
            }}
            className="min-h-11 px-3.5 py-2 bg-[#2d5a3f] hover:bg-[#234731] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Nytt arrangement
          </button>
          <button
            type="button"
            disabled={laster}
            onClick={() => void kjorSynk()}
            className="min-h-11 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${laster ? "animate-spin" : ""}`} />
            Synk mot kirkekalenderen
          </button>
            </>
          )}
          {visAbonner && selectedPersonId && (
            <KalenderAbonner db={db} personId={selectedPersonId} />
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["alle", "Alle"],
            ["gudstjeneste", "Gudstjenester"],
            ["arrangement", "Arrangementer"],
          ] as const
        ).map(([id, merke]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`min-h-11 px-3 py-1.5 text-xs font-semibold rounded-xl cursor-pointer ${
              filter === id ? "bg-[#2d5a3f] text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {merke}
          </button>
        ))}
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => setVisning("maaned")}
            className={`min-h-11 px-3 py-1.5 text-xs font-semibold rounded-xl cursor-pointer ${
              visning === "maaned" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            Måned
          </button>
          <button
            type="button"
            onClick={() => setVisning("liste")}
            className={`min-h-11 px-3 py-1.5 text-xs font-semibold rounded-xl cursor-pointer ${
              visning === "liste" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            Liste
          </button>
        </div>
      </div>

      {synkStatus && !feil && <p className="text-sm text-slate-600">{synkStatus}</p>}
      {feil && (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{feil}</div>
      )}

      {apneOppgaver.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-amber-950">Ikke i app-kalenderen</h3>
          <p className="text-xs text-amber-900">
            Kirkekalenderen har hendelser som ikke ligger i appen. Velg mal fra Arrangementmaler og legg inn, eller hopp over.
          </p>
          <ul className="space-y-2">
            {apneOppgaver.map((o) => {
              const valgtMal = oppgaveMal[o.KalenderoppgaveID] || foreslaMalId(db, o.Tittel);
              const malNavn = maler.find((m) => m.MalID === valgtMal)?.Navn || "mal";
              return (
              <li
                key={o.KalenderoppgaveID}
                className="bg-white border border-amber-100 rounded-xl px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2"
              >
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-slate-900">{o.Tittel}</p>
                  <p className="text-xs text-slate-600">
                    {formatDatoNo(o.Dato)} · {o.Tid}
                    {o.Sted ? ` · ${o.Sted}` : ""}
                  </p>
                  {maler.length > 0 && (
                    <label className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      Annen mal
                      <select
                        value={valgtMal}
                        onChange={(e) =>
                          setOppgaveMal((prev) => ({ ...prev, [o.KalenderoppgaveID]: e.target.value }))
                        }
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-900"
                        aria-label="Annen mal"
                      >
                        {maler.map((m) => (
                          <option key={m.MalID} value={m.MalID}>
                            {m.Navn}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => persister(leggInnKalenderoppgave(db, o.KalenderoppgaveID, selectedPersonId, valgtMal))}
                    className="min-h-11 px-3 py-1.5 bg-[#2d5a3f] text-white text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Ja, {malNavn}
                  </button>
                  <button
                    type="button"
                    onClick={() => persister(avvisKalenderoppgave(db, o.KalenderoppgaveID))}
                    className="min-h-11 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Ikke nå
                  </button>
                </div>
              </li>
              );
            })}
          </ul>
        </div>
      )}

      {visning === "maaned" ? (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {UKEDAGER.map((dag) => (
              <div key={dag} className="px-1 py-2 text-center text-[11px] font-bold text-slate-500 uppercase">
                {dag}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {rutenett.map((dag) => {
              const iso = isoDato(dag);
              const iMnd = dag.getMonth() === month;
              const liste = perDato.get(iso) || [];
              return (
                <div
                  key={iso}
                  className={`min-h-24 border-t border-r border-slate-100 p-1 ${iMnd ? "bg-white" : "bg-slate-50"}`}
                >
                  <p className={`text-[11px] font-semibold px-1 ${iMnd ? "text-slate-700" : "text-slate-400"}`}>
                    {dag.getDate()}
                  </p>
                  <div className="space-y-0.5">
                    {liste.map((h) => (
                      <button
                        key={`${h.kind}-${h.id}`}
                        type="button"
                        onClick={() => apneHendelse(h)}
                        className={`w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded-md cursor-pointer truncate ${
                          h.kind === "arrangement"
                            ? "bg-amber-100 text-amber-900"
                            : "bg-[#eef5f1] text-[#234731]"
                        }`}
                      >
                        {h.tid} {h.tittel}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <ul className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
          {filtrert.length === 0 ? (
            <li className="px-4 py-6 text-sm text-slate-500">Ingen hendelser i appen for dette filteret.</li>
          ) : (
            filtrert.map((h) => (
              <li key={`${h.kind}-${h.id}`}>
                <button
                  type="button"
                  onClick={() => apneHendelse(h)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer"
                >
                  <p className="text-sm font-semibold text-slate-900">{h.tittel}</p>
                  <p className="text-xs text-slate-600">
                    {formatDatoNo(h.dato)} · {h.tid}
                    {h.sted ? ` · ${h.sted}` : ""} · {h.kind === "arrangement" ? "Arrangement" : "Gudstjeneste"}
                  </p>
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      {nyApen && modus === "admin" && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Nytt arrangement</h3>
              <button type="button" onClick={() => setNyApen(false)} className="p-2 cursor-pointer" aria-label="Lukk">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <input
                type="text"
                placeholder="Tittel"
                value={nyFelt.tittel}
                onChange={(e) => setNyFelt((p) => ({ ...p, tittel: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl p-2"
              />
              <input
                type="date"
                value={nyFelt.dato}
                onChange={(e) => setNyFelt((p) => ({ ...p, dato: e.target.value }))}
                className="w-full border border-slate-300 rounded-xl p-2"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={nyFelt.tid}
                  onChange={(e) => setNyFelt((p) => ({ ...p, tid: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl p-2"
                />
                <input
                  type="text"
                  value={nyFelt.sted}
                  onChange={(e) => setNyFelt((p) => ({ ...p, sted: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl p-2"
                />
              </div>
              {maler.length > 0 && (
                <label className="block text-slate-600">
                  Mal
                  <select
                    value={nyFelt.malId || foreslaMalId(db, nyFelt.tittel)}
                    onChange={(e) => setNyFelt((p) => ({ ...p, malId: e.target.value }))}
                    className="mt-1 w-full border border-slate-300 rounded-xl p-2 text-sm text-slate-900"
                  >
                    {maler.map((m) => (
                      <option key={m.MalID} value={m.MalID}>
                        {m.Navn}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block text-slate-600">
                Gruppe (valgfritt — tom = synlig for alle når kalender er på)
                <select
                  value={nyFelt.gruppeId}
                  onChange={(e) => setNyFelt((p) => ({ ...p, gruppeId: e.target.value }))}
                  className="mt-1 w-full border border-slate-300 rounded-xl p-2 text-sm text-slate-900"
                >
                  <option value="">Åpent arrangement</option>
                  {(db.grupper || [])
                    .filter((g) => g.Aktiv !== false)
                    .map((g) => (
                      <option key={g.GruppeID} value={g.GruppeID}>
                        {g.Gruppenavn}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setNyApen(false)} className="px-3 py-2 text-xs cursor-pointer">
                Avbryt
              </button>
              <button
                type="button"
                onClick={lagreNytt}
                className="px-3 py-2 bg-[#2d5a3f] text-white text-xs font-semibold rounded-xl cursor-pointer"
              >
                Lagre
              </button>
            </div>
          </div>
        </div>
      )}

      {apentArrangement && (
        <ArrangementDetaljView
          db={db}
          arrangement={apentArrangement}
          selectedPersonId={selectedPersonId}
          onUpdateDb={onUpdateDb}
          onClose={() => setApentArrangementId(null)}
          lese={modus === "les"}
        />
      )}
    </div>
  );
};
