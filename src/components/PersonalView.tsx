import React, { useState, useEffect, useLayoutEffect } from "react";
import {
  DatabaseState,
  getEffektivtBehov,
  getMaksAntall,
  erRolleHardFull,
  hentSvarStatus,
  hentPåmeldingsRoller,
  trengerForstereise,
  svarPaaTildeling,
  velgDatoForPerson,
  kanRedigereProgram,
  visProgramIkon,
  visKalenderForPerson,
  mineGrupperForPerson,
} from "../services/dataService";
import { Rolle } from "../types/database";
import { RoleDescriptionModal } from "./RoleDescriptionModal";
import { RolleIkon } from "./RolleIkon";
import { IkonHandling } from "./IkonHandling";
import { GudstjenesteRolleOversikt } from "./GudstjenesteRolleOversikt";
import { ProgramLeserModal } from "./ProgramLeserModal";
import { InteresseSkjema } from "./InteresseSkjema";
import { MineGrupperArk } from "./MineGrupperArk";
import { KalenderView } from "./KalenderView";
import {
  Clock3,
  Check,
  X,
  Plus,
  Info,
  Pencil,
  ScrollText,
  ChevronDown,
  Users,
} from "lucide-react";

interface PersonalViewProps {
  db: DatabaseState;
  selectedPersonId: string;
  onUpdateDb: (updatedDb: DatabaseState) => void;
  datePickerRolle: Rolle | null;
  onDatePickerRolleChange: (rolle: Rolle | null) => void;
  visOppgaverArk?: boolean;
  onOppgaverArkChange?: (apen: boolean) => void;
}

type PåmeldingsStatus = "ledig" | "min-venter" | "min-bekreftet" | "full" | "stengt";

function formatDato(dato: string): string {
  const parsed = new Date(`${dato}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dato;
  return parsed.toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function byggPåmeldingsrader(
  db: DatabaseState,
  personId: string,
  rolle: Rolle
) {
  const iDag = new Date().toISOString().split("T")[0];
  return db.gudstjenester
    .filter((g) => g.Dato >= iDag)
    .slice()
    .sort((a, b) => `${a.Dato} ${a.Tid}`.localeCompare(`${b.Dato} ${b.Tid}`))
    .map((g) => {
      const tildelinger = db.tildelinger.filter(
        (t) => t.GudstjenesteID === g.GudstjenesteID && t.RolleID === rolle.RolleID
      );
      const personerPå = tildelinger
        .map((t) => {
          const rawStatus = hentSvarStatus(db, t.TildelingID);
          if (rawStatus === "Avvist") return null;
          const status = rawStatus === "Bekreftet" ? ("Bekreftet" as const) : ("Venter" as const);
          const p = db.personer.find((pers) => pers.PersonID === t.PersonID);
          return {
            personId: t.PersonID,
            navn: p?.Fornavn || p?.Navn || t.PersonID,
            status,
          };
        })
        .filter((x): x is { personId: string; navn: string; status: "Bekreftet" | "Venter" } => x !== null);

      const behov = getEffektivtBehov(db, g.GudstjenesteID, rolle);
      const maks = getMaksAntall(rolle);
      const bekreftetAntall = personerPå.filter((p) => p.status === "Bekreftet").length;
      const aktiveAntall = personerPå.length;
      const ledige = Math.max(0, behov - bekreftetAntall);
      const hardFull = erRolleHardFull(db, g.GudstjenesteID, rolle);
      const min = personerPå.find((p) => p.personId === personId);
      const minAvvist = tildelinger.some((t) => {
        if (t.PersonID !== personId) return false;
        return hentSvarStatus(db, t.TildelingID) === "Avvist";
      });

      let status: PåmeldingsStatus =
        hardFull && !min ? "stengt" : ledige > 0 || minAvvist ? "ledig" : "full";
      if (min?.status === "Bekreftet") status = "min-bekreftet";
      else if (min) status = "min-venter";

      return {
        gudstjeneste: g,
        behov,
        maks,
        ledige,
        bekreftetAntall,
        aktiveAntall,
        hardFull,
        personerPå,
        status,
      };
    });
}

export const PersonalView: React.FC<PersonalViewProps> = ({
  db,
  selectedPersonId,
  onUpdateDb,
  datePickerRolle,
  onDatePickerRolleChange,
  visOppgaverArk = false,
  onOppgaverArkChange,
}) => {
  const [selectedRolleForModal, setSelectedRolleForModal] = useState<Rolle | null>(null);
  const [visHeleBemanningFor, setVisHeleBemanningFor] = useState<Record<string, boolean>>({});
  const [leserGudstjenesteId, setLeserGudstjenesteId] = useState<string | null>(null);
  const [visAlleSondager, setVisAlleSondager] = useState(false);
  const [minSideFane, setMinSideFane] = useState<"oppgaver" | "kalender">("oppgaver");
  const [visMineGrupper, setVisMineGrupper] = useState(false);
  const [harLukketForsteDatoer, setHarLukketForsteDatoer] = useState(false);

  const openDatePicker = (rolle: Rolle) => {
    if (!hentPåmeldingsRoller(db, selectedPersonId).some((r) => r.RolleID === rolle.RolleID)) {
      return;
    }
    onDatePickerRolleChange(rolle);
  };

  const lukkDatoer = () => {
    setHarLukketForsteDatoer(true);
    onDatePickerRolleChange(null);
  };

  useEffect(() => {
    setHarLukketForsteDatoer(false);
  }, [selectedPersonId]);

  useLayoutEffect(() => {
    if (harLukketForsteDatoer) return;
    if (datePickerRolle) return;
    if (!trengerForstereise(db, selectedPersonId)) return;
    const roller = hentPåmeldingsRoller(db, selectedPersonId);
    if (roller.length === 1) onDatePickerRolleChange(roller[0]);
  }, [
    db,
    selectedPersonId,
    datePickerRolle,
    harLukketForsteDatoer,
    onDatePickerRolleChange,
  ]);

  const person = db.personer.find((p) => p.PersonID === selectedPersonId);

  if (!person) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 text-center">
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 inline-block mb-3">
          <Info className="w-8 h-8 text-amber-600 mx-auto" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Ingen person valgt</h2>
        <p className="text-sm text-slate-600 mt-1">Velg en person øverst til høyre for å se Min side.</p>
      </div>
    );
  }

  const visningsRoller = hentPåmeldingsRoller(db, person.PersonID);
  const personensRoller = visningsRoller;
  const personensGrupper = mineGrupperForPerson(db, person.PersonID);
  const visKalenderFane =
    visKalenderForPerson(db, person.PersonID, "minSide") ||
    visKalenderForPerson(db, person.PersonID, "ical");

  // Formater listen over roller i hilsningsteksten ("Møtevert, Nattverd og Kirkekaffe")
  const rolleNavnTekst = (() => {
    if (personensRoller.length === 0) return "oppgaver";
    if (personensRoller.length === 1) return personensRoller[0].Rollenavn;
    if (personensRoller.length === 2) {
      return `${personensRoller[0].Rollenavn} og ${personensRoller[1].Rollenavn}`;
    }
    const forste = personensRoller.slice(0, -1).map((r) => r.Rollenavn).join(", ");
    const siste = personensRoller[personensRoller.length - 1].Rollenavn;
    return `${forste} og ${siste}`;
  })();

  // 2. Personens egne tildelinger
  const personensTildelinger = db.tildelinger
    .filter((t) => t.PersonID === person.PersonID)
    .map((t) => {
      const gudstjeneste = db.gudstjenester.find((g) => g.GudstjenesteID === t.GudstjenesteID);
      const rolle = db.roller.find((r) => r.RolleID === t.RolleID);
      const status = hentSvarStatus(db, t.TildelingID);
      return {
        tildeling: t,
        gudstjeneste,
        rolle,
        svar: db.svar.find((s) => s.TildelingID === t.TildelingID),
        status,
      };
    })
    .filter((item) => item.gudstjeneste !== undefined && item.rolle !== undefined)
    .sort((a, b) => {
      const dateA = a.gudstjeneste!.Dato + " " + a.gudstjeneste!.Tid;
      const dateB = b.gudstjeneste!.Dato + " " + b.gudstjeneste!.Tid;
      return dateA.localeCompare(dateB);
    });

  const handleBekreft = (tildelingId: string, trekkTilbake?: boolean) => {
    onUpdateDb(
      svarPaaTildeling(
        db,
        tildelingId,
        person.PersonID,
        trekkTilbake ? "Venter" : "Bekreftet",
        trekkTilbake ? "Bekreftelse trukket av frivillig" : "Bekreftet av frivillig"
      )
    );
  };

  const handleAvkreft = (tildelingId: string) => {
    onUpdateDb(
      svarPaaTildeling(db, tildelingId, person.PersonID, "Avvist", "Meldt forfall")
    );
  };

  const handleVelgAnnenDato = (gudstjenesteId: string, rolle: Rolle) => {
    const result = velgDatoForPerson(db, person.PersonID, gudstjenesteId, rolle.RolleID);
    if (result.success && result.updatedDb) {
      onUpdateDb(result.updatedDb);
    }
  };

  const forstereise = trengerForstereise(db, person.PersonID);
  const trengerOppgavevalg = forstereise && visningsRoller.length === 0;
  if (trengerOppgavevalg) {
    return (
      <InteresseSkjema
        landing
        db={db}
        personId={person.PersonID}
        onUpdateDb={onUpdateDb}
        onFerdig={() => onOppgaverArkChange?.(false)}
      />
    );
  }

  if (forstereise && visningsRoller.length === 1 && !datePickerRolle && !harLukketForsteDatoer) {
    return <div className="min-h-[40vh]" aria-busy="true" />;
  }

  if (forstereise && visningsRoller.length > 1 && !datePickerRolle && !harLukketForsteDatoer) {
    return (
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-3xl p-4 sm:p-8 border border-slate-200/90 shadow-xs space-y-4">
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Hei {person.Fornavn}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Hvilken oppgave vil du sette deg opp på nå?
          </p>
          <div className="space-y-2">
            {visningsRoller.map((rolle) => (
              <button
                key={rolle.RolleID}
                type="button"
                onClick={() => openDatePicker(rolle)}
                className="w-full min-h-14 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#2d5a3f] hover:bg-[#234731] text-white text-left cursor-pointer"
              >
                <RolleIkon rollenavn={rolle.Rollenavn} className="w-10 h-10" />
                <span className="text-base font-bold">{rolle.Rollenavn}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* 1. TOPP-KORT: Hilsen og velkomst som i referansebildet BekreftOppgave.png */}
      <div className="bg-white rounded-3xl p-4 sm:p-8 border border-slate-200/90 shadow-xs space-y-3 sm:space-y-4">
        <div>
          <span className="hidden sm:block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Lillesand Misjonskirke
          </span>
          <h2 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Hei {person.Fornavn}</span>
            <span className="text-xl sm:text-3xl">👋</span>
          </h2>
          <p className="hidden sm:block text-sm text-slate-600 mt-1">
            Takk for at du vil bidra i menigheten.
          </p>
          <p className="sm:hidden text-sm text-slate-600 mt-1">
            Du bidrar med {rolleNavnTekst}.
          </p>
        </div>
        {visningsRoller.length > 0 && (
          <p className="sm:hidden text-sm text-slate-600">
            Velg dato ved å klikke på fanene nederst.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {visningsRoller.map((rolle) => (
            <button
              key={rolle.RolleID}
              type="button"
              onClick={() => openDatePicker(rolle)}
              className="hidden sm:inline-flex min-h-11 flex-1 sm:flex-none items-center justify-center gap-1.5 px-4 text-sm font-semibold text-white bg-[#2d5a3f] hover:bg-[#234731] rounded-xl cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>
                {visningsRoller.length === 1
                  ? `Velg dato for ${rolle.Rollenavn}`
                  : rolle.Rollenavn}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => onOppgaverArkChange?.(true)}
            className="min-h-11 w-full sm:w-auto px-3.5 text-sm font-semibold text-[#2d5a3f] bg-[#eef5f1] hover:bg-[#d2e8d9] border border-[#d2e8d9] rounded-xl cursor-pointer"
          >
            Velg tjeneste
          </button>
          <button
            type="button"
            onClick={() => setVisMineGrupper(true)}
            className="min-h-11 w-full sm:w-auto px-3.5 text-sm font-semibold text-[#2d5a3f] bg-[#eef5f1] hover:bg-[#d2e8d9] border border-[#d2e8d9] rounded-xl cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            <Users className="w-4 h-4 shrink-0" />
            {personensGrupper.length === 1 ? "Min gruppe" : "Mine grupper"}
          </button>
        </div>

        <div className="bg-[#f4f8f5] border-l-4 border-[#2d5a3f] rounded-2xl p-4 sm:p-5 text-xs sm:text-sm text-slate-700 leading-relaxed shadow-2xs">
          <p>
            Du har sagt ja til å bidra med{" "}
            <strong className="text-[#1e3e2b] font-bold">{rolleNavnTekst}</strong> i menigheten.
            Du kan sette deg opp der det passer. Oppgavene hører til tjenestegrupper — åpne{" "}
            {personensGrupper.length === 1 ? "Min gruppe" : "Mine grupper"} for å se hvem som er
            leder.
          </p>
        </div>
      </div>

      {visKalenderFane && (
        <div className="flex gap-2">
          {(
            [
              ["oppgaver", "Oppgaver"],
              ["kalender", "Kalender"],
            ] as const
          ).map(([id, merke]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMinSideFane(id)}
              className={`min-h-11 px-3 py-1.5 text-xs font-semibold rounded-xl cursor-pointer ${
                minSideFane === id ? "bg-[#2d5a3f] text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {merke}
            </button>
          ))}
        </div>
      )}

      {visKalenderFane && minSideFane === "kalender" ? (
        <KalenderView
          db={db}
          onUpdateDb={onUpdateDb}
          vis
          modus="les"
          selectedPersonId={person.PersonID}
          visAbonner={visKalenderForPerson(db, person.PersonID, "ical")}
          onApneGudstjeneste={(id) => {
            if (visProgramIkon(db, person.PersonID, id)) setLeserGudstjenesteId(id);
          }}
        />
      ) : (
      <>
      {/* Oppgaver gruppert per gudstjeneste-dato */}
      {(() => {
        const iDag = new Date().toISOString().split("T")[0];
        const kommende = db.gudstjenester
          .filter((g) => g.Dato >= iDag)
          .slice()
          .sort((a, b) => `${a.Dato} ${a.Tid}`.localeCompare(`${b.Dato} ${b.Tid}`));

        if (kommende.length === 0) {
          return (
            <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-2">
              <Info className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">Ingen kommende gudstjenester</h3>
            </div>
          );
        }

        return (
          <div className="space-y-2">
            {(() => {
              const medOppgave = kommende.filter((g) =>
                personensTildelinger.some((item) => item.gudstjeneste?.GudstjenesteID === g.GudstjenesteID)
              );
              const visGudstjenester = visAlleSondager || medOppgave.length === 0 ? kommende : medOppgave;
              return (
                <>
                  {medOppgave.length > 0 && medOppgave.length < kommende.length && (
                    <div className="flex items-center justify-between gap-2 px-1">
                      <p className="text-xs font-semibold text-slate-500">
                        {visAlleSondager ? "Alle kommende gudstjenester" : "Dine oppgaver"}
                      </p>
                      <button
                        type="button"
                        onClick={() => setVisAlleSondager((v) => !v)}
                        className="text-xs font-semibold text-[#2d5a3f] min-h-11 px-2 cursor-pointer"
                      >
                        {visAlleSondager ? "Vis bare mine" : `Vis alle (${kommende.length})`}
                      </button>
                    </div>
                  )}
                  {visGudstjenester.map((gudstjeneste) => {
              const mine = personensTildelinger.filter(
                (item) => item.gudstjeneste?.GudstjenesteID === gudstjeneste.GudstjenesteID
              );
              const visHele = Boolean(visHeleBemanningFor[gudstjeneste.GudstjenesteID]);
              const rollerIOversikt = db.roller.filter((r) => r.Aktiv);
              const vekselKort = () =>
                setVisHeleBemanningFor((prev) => ({
                  ...prev,
                  [gudstjeneste.GudstjenesteID]: !visHele,
                }));

              return (
                <div
                  key={gudstjeneste.GudstjenesteID}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden text-left"
                >
                  <div className="px-4 sm:px-5 pt-2.5 pb-1.5 flex items-start justify-between gap-2">
                    <p className="text-xs sm:text-sm text-slate-700 min-w-0">
                      <span className="font-semibold text-[#2d5a3f]">
                        {formatDato(gudstjeneste.Dato)}
                        {gudstjeneste.Tid ? ` · kl. ${gudstjeneste.Tid}` : ""}
                      </span>
                      <span className="font-semibold text-slate-900">
                        {" · "}
                        {gudstjeneste.Tema || "Gudstjeneste"}
                      </span>
                      {gudstjeneste.Sted ? (
                        <span className="text-slate-500"> · {gudstjeneste.Sted}</span>
                      ) : null}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                    {visProgramIkon(db, person.PersonID, gudstjeneste.GudstjenesteID) && (
                      <IkonHandling
                        label={
                          kanRedigereProgram(db, person.PersonID, gudstjeneste.GudstjenesteID)
                            ? "Rediger gudstjenesteprogram"
                            : "Åpne gudstjenesteprogram"
                        }
                        Icon={
                          kanRedigereProgram(db, person.PersonID, gudstjeneste.GudstjenesteID)
                            ? Pencil
                            : ScrollText
                        }
                        variant="sky"
                        onClick={() => setLeserGudstjenesteId(gudstjeneste.GudstjenesteID)}
                      />
                    )}
                    <button
                      type="button"
                      onClick={vekselKort}
                      aria-expanded={visHele}
                      aria-label={visHele ? "Skjul bemanning" : "Vis bemanning"}
                      className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-xl text-slate-500 cursor-pointer"
                    >
                      <ChevronDown className={`w-5 h-5 transition ${visHele ? "" : "rotate-180"}`} />
                    </button>
                    </div>
                  </div>

                  {!visHele && mine.length > 0 && (
                    <div className="px-4 sm:px-5">
                      {mine.map((item) => {
                        const isBekreftet = item.status === "Bekreftet";
                        const isAvvist = item.status === "Avvist";
                        return (
                          <div
                            key={item.tildeling.TildelingID}
                            className="flex items-center gap-2 py-1.5 border-t border-slate-100 min-w-0"
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                item.rolle && setSelectedRolleForModal(item.rolle);
                              }}
                              title="Se instruks"
                              className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer rounded-lg hover:bg-slate-50 px-0.5 py-0.5"
                            >
                              <RolleIkon rollenavn={item.rolle?.Rollenavn || ""} />
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 truncate">
                                {item.rolle?.Rollenavn}
                              </span>
                            </button>
                            <span className="text-sm font-semibold text-slate-800 inline-flex items-center gap-1.5 shrink-0">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  isBekreftet
                                    ? "bg-emerald-500"
                                    : isAvvist
                                    ? "bg-rose-500"
                                    : "bg-amber-400"
                                }`}
                                aria-hidden
                              />
                              <span className={isAvvist ? "line-through opacity-75" : ""}>
                                {person.Fornavn || person.Navn}
                              </span>
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <IkonHandling
                                label={isBekreftet ? "Trekk tilbake" : "Dette passer"}
                                Icon={Check}
                                variant="confirm"
                                active={isBekreftet}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleBekreft(item.tildeling.TildelingID, isBekreftet);
                                }}
                              />
                              <IkonHandling
                                label={isAvvist ? "Meldt forfall" : "Kan ikke"}
                                variant="decline"
                                Icon={X}
                                active={isAvvist}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAvkreft(item.tildeling.TildelingID);
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {visHele && (
                    <div className="px-4 sm:px-5 pb-2.5 pt-1">
                      <GudstjenesteRolleOversikt
                        db={db}
                        gudstjenesteId={gudstjeneste.GudstjenesteID}
                        roller={rollerIOversikt}
                        onSelectRolle={setSelectedRolleForModal}
                        skjulUbekreftet
                        skjulTommeRoller
                        inkluderPersonId={person.PersonID}
                      />
                    </div>
                  )}
                </div>
              );
            })}
                </>
              );
            })()}
          </div>
        );
      })()}
      </>
      )}

      {/* Påmelding: nesten fullskjerm */}
      {datePickerRolle && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white w-full sheet-panel sm:h-auto sm:max-h-[100dvh] sm:max-w-5xl sm:my-4 sm:rounded-3xl shadow-2xl border-0 sm:border sm:border-slate-200 flex flex-col overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Hvilke søndager kan du være på {datePickerRolle.Rollenavn}?
                </h3>
                {(() => {
                  const gruppe = datePickerRolle.GruppeID
                    ? db.grupper.find((g) => g.GruppeID === datePickerRolle.GruppeID)
                    : undefined;
                  const leder = gruppe?.GruppelederID
                    ? db.personer.find((p) => p.PersonID === gruppe.GruppelederID)
                    : undefined;
                  const lederNavn = leder?.Fornavn || leder?.Navn;
                  return lederNavn ? (
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                      Gruppeleder {lederNavn} får beskjed når du melder deg på.
                    </p>
                  ) : (
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                      Gruppeleder får beskjed når du melder deg på.
                    </p>
                  );
                })()}
              </div>
              <button
                type="button"
                onClick={lukkDatoer}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer shrink-0"
                aria-label="Lukk"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {(() => {
              const rader = byggPåmeldingsrader(db, person.PersonID, datePickerRolle);

              return (
                <>
                  <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-2">
                    {rader.length === 0 ? (
                      <div className="text-center py-12 text-sm text-slate-500">
                        Ingen kommende gudstjenester.
                      </div>
                    ) : (
                      rader.map((rad) => {
                        const {
                          gudstjeneste: g,
                          personerPå,
                          status,
                        } = rad;
                        const kanMelde = status === "ledig" || status === "full";
                        return (
                          <div
                            key={g.GudstjenesteID}
                            className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              status === "ledig"
                                ? "bg-[#f4f8f5] border-[#d2e8d9]"
                                : status === "stengt"
                                ? "bg-slate-100 border-slate-200 opacity-90"
                                : status === "full"
                                ? "bg-slate-50 border-slate-200"
                                : "bg-white border-slate-200"
                            }`}
                          >
                            <div className="min-w-0 space-y-1.5">
                              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                                <span className="text-base font-bold text-slate-900">
                                  {formatDato(g.Dato)}
                                </span>
                                {g.Tid && (
                                  <span className="text-sm text-slate-500">kl. {g.Tid}</span>
                                )}
                              </div>
                              <div className="text-sm text-slate-600">
                                {g.Tema || "Gudstjeneste"}
                                {g.Sted ? ` · ${g.Sted}` : ""}
                              </div>
                              {personerPå.filter(
                                (p) =>
                                  p.status === "Bekreftet" || p.personId === person.PersonID
                              ).length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                  {personerPå
                                    .filter(
                                      (p) =>
                                        p.status === "Bekreftet" ||
                                        p.personId === person.PersonID
                                    )
                                    .map((p) => (
                                    <span
                                      key={p.personId}
                                      className={`text-[11px] font-medium px-2 py-0.5 rounded-lg ${
                                        p.status === "Bekreftet"
                                          ? "bg-[#eef5f1] text-[#1e3e2b] border border-[#d2e8d9]"
                                          : "bg-amber-50 text-amber-800 border border-amber-200"
                                      }`}
                                    >
                                      {p.navn}
                                      {p.status === "Venter" ? " (venter)" : ""}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="shrink-0 self-stretch sm:self-center">
                              {kanMelde ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleVelgAnnenDato(g.GudstjenesteID, datePickerRolle)
                                  }
                                  className="w-full sm:w-auto px-5 py-3 bg-[#2d5a3f] hover:bg-[#1e3e2b] text-white text-sm font-semibold rounded-2xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <Check className="w-4 h-4" />
                                  <span>Meld meg på</span>
                                </button>
                              ) : status === "min-bekreftet" ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1e3e2b] bg-[#eef5f1] border border-[#d2e8d9] px-3 py-2 rounded-xl">
                                  <Check className="w-4 h-4" />
                                  Du stiller
                                </span>
                              ) : status === "min-venter" ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
                                  <Clock3 className="w-4 h-4" />
                                  Ditt forslag venter
                                </span>
                              ) : (
                                <span className="inline-flex text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-2 rounded-xl">
                                  Fullt
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="px-4 sm:px-6 py-3 border-t border-slate-100 flex shrink-0 sheet-safe-bottom bg-white/95">
                    <button
                      type="button"
                      onClick={lukkDatoer}
                      className="min-h-11 w-full px-4 bg-[#2d5a3f] hover:bg-[#234731] text-white text-sm font-semibold rounded-xl transition cursor-pointer"
                    >
                      Ferdig
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Rollebeskrivelsesmodal */}
      {selectedRolleForModal && (
        <RoleDescriptionModal
          rolle={selectedRolleForModal}
          rollebeskrivelse={
            db.rollebeskrivelser.find(
              (rb) => rb.RolleID === selectedRolleForModal.RolleID
            ) || null
          }
          gruppe={
            selectedRolleForModal.GruppeID
              ? db.grupper.find((g) => g.GruppeID === selectedRolleForModal.GruppeID) || null
              : null
          }
          onClose={() => setSelectedRolleForModal(null)}
        />
      )}

      {leserGudstjenesteId &&
        (() => {
          const gud = db.gudstjenester.find((g) => g.GudstjenesteID === leserGudstjenesteId);
          if (!gud) return null;
          return (
            <ProgramLeserModal
              db={db}
              gudstjeneste={gud}
              uthevPersonId={person.PersonID}
              selectedPersonId={person.PersonID}
              redigerbar={kanRedigereProgram(db, person.PersonID, gud.GudstjenesteID)}
              onClose={() => setLeserGudstjenesteId(null)}
              onUpdateDb={onUpdateDb}
            />
          );
        })()}

      {visOppgaverArk && (
        <InteresseSkjema
          db={db}
          personId={person.PersonID}
          onUpdateDb={onUpdateDb}
          onFerdig={() => onOppgaverArkChange?.(false)}
        />
      )}
      {visMineGrupper && (
        <MineGrupperArk
          db={db}
          personId={person.PersonID}
          onLukk={() => setVisMineGrupper(false)}
        />
      )}
    </div>
  );
};
