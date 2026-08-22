import React, { useState } from "react";
import {
  DatabaseState,
  getEffektivtBehov,
  hentSvarStatus,
  svarPaaTildeling,
  velgDatoForPerson,
  kanRedigereProgram,
  visProgramIkon,
} from "../services/dataService";
import { Rolle } from "../types/database";
import { RoleDescriptionModal } from "./RoleDescriptionModal";
import { RolleIkon } from "./RolleIkon";
import { IkonHandling } from "./IkonHandling";
import { GudstjenesteRolleOversikt } from "./GudstjenesteRolleOversikt";
import { ProgramLeserModal } from "./ProgramLeserModal";
import {
  Clock3,
  Check,
  X,
  Plus,
  Info,
  Pencil,
  ScrollText,
} from "lucide-react";

interface PersonalViewProps {
  db: DatabaseState;
  selectedPersonId: string;
  onUpdateDb: (updatedDb: DatabaseState) => void;
}

type PåmeldingsFilter = "ledige" | "mine" | "alle";
type PåmeldingsStatus = "ledig" | "min-venter" | "min-bekreftet" | "full";

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
  return db.gudstjenester
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

      const behov = getEffektivtBehov(g.GudstjenesteID, rolle, db.tjenestebehov);
      const bekreftetAntall = personerPå.filter((p) => p.status === "Bekreftet").length;
      const ledige = Math.max(0, behov - bekreftetAntall);
      const min = personerPå.find((p) => p.personId === personId);
      const minAvvist = tildelinger.some((t) => {
        if (t.PersonID !== personId) return false;
        return hentSvarStatus(db, t.TildelingID) === "Avvist";
      });

      let status: PåmeldingsStatus = ledige > 0 || minAvvist ? "ledig" : "full";
      if (min?.status === "Bekreftet") status = "min-bekreftet";
      else if (min) status = "min-venter";

      return { gudstjeneste: g, behov, ledige, bekreftetAntall, personerPå, status };
    });
}

export const PersonalView: React.FC<PersonalViewProps> = ({
  db,
  selectedPersonId,
  onUpdateDb,
}) => {
  const [selectedRolleForModal, setSelectedRolleForModal] = useState<Rolle | null>(null);
  const [showDatePickerForRolle, setShowDatePickerForRolle] = useState<Rolle | null>(null);
  const [datePickerFilter, setDatePickerFilter] = useState<"ledige" | "mine" | "alle">("alle");
  const [visAlleFor, setVisAlleFor] = useState<Record<string, boolean>>({});
  const [leserGudstjenesteId, setLeserGudstjenesteId] = useState<string | null>(null);

  const openDatePicker = (rolle: Rolle) => {
    setDatePickerFilter("alle");
    setShowDatePickerForRolle(rolle);
  };

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

  // 1. Personens aktive personroller
  const personensRolleIds = db.personroller
    .filter((pr) => pr.PersonID === person.PersonID && pr.Aktiv)
    .map((pr) => pr.RolleID);
  
  const personensRoller = db.roller.filter((r) => personensRolleIds.includes(r.RolleID));

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

  // Samle alle unike roller som personen enten har i personroller ELLER har tildelinger for
  const visningsRoller: Rolle[] = [];
  const visningsRolleIds = new Set<string>();

  // Legg til personens registrerte roller først
  personensRoller.forEach((r) => {
    visningsRoller.push(r);
    visningsRolleIds.add(r.RolleID);
  });

  // Legg til eventuelle roller personen er tildelt men ikke har i personroller
  personensTildelinger.forEach((item) => {
    if (item.rolle && !visningsRolleIds.has(item.rolle.RolleID)) {
      visningsRoller.push(item.rolle);
      visningsRolleIds.add(item.rolle.RolleID);
    }
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* 1. TOPP-KORT: Hilsen og velkomst som i referansebildet BekreftOppgave.png */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-4">
        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Lillesand Misjonskirke
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Hei {person.Fornavn}</span>
            <span className="text-2xl sm:text-3xl">👋</span>
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Takk for at du vil bidra i menigheten. Her ser du forslagene vi har laget for deg.
          </p>
        </div>

        {/* Lys grønn infoboks */}
        <div className="bg-[#f4f8f5] border-l-4 border-[#2d5a3f] rounded-2xl p-4 sm:p-5 text-xs sm:text-sm text-slate-700 leading-relaxed shadow-2xs">
          <p>
            Du har sagt ja til å bidra med{" "}
            <strong className="text-[#1e3e2b] font-bold">{rolleNavnTekst}</strong> i menigheten.
            Vi har satt opp et forslag til datoer ut fra gudstjenesteplanen, men forslagene er ikke
            bindende. Det er helt opp til deg å vurdere hvilke datoer som passer.
          </p>
        </div>
      </div>

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
            {visningsRoller.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {visningsRoller.map((rolle) => (
                  <button
                    key={rolle.RolleID}
                    type="button"
                    onClick={() => openDatePicker(rolle)}
                    className="text-xs font-semibold text-[#2d5a3f] bg-white hover:bg-[#eef5f1] border border-[#d2e8d9] px-3 py-1.5 rounded-full cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 inline mr-1" />
                    Velg dato for {rolle.Rollenavn}
                  </button>
                ))}
              </div>
            )}

            {kommende.map((gudstjeneste) => {
              const mine = personensTildelinger.filter(
                (item) => item.gudstjeneste?.GudstjenesteID === gudstjeneste.GudstjenesteID
              );
              const visAlle = Boolean(visAlleFor[gudstjeneste.GudstjenesteID]);
              const rollerIOversikt = db.roller.filter((r) => r.Aktiv);

              return (
                <div
                  key={gudstjeneste.GudstjenesteID}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
                >
                  <div className="px-4 sm:px-5 pt-2.5 pb-1.5 flex items-start justify-between gap-2">
                    <p className="text-xs sm:text-sm text-slate-700 truncate min-w-0">
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
                  </div>

                  {mine.length > 0 && (
                    <div className="px-4 sm:px-5">
                      {mine.map((item) => {
                        const isBekreftet = item.status === "Bekreftet";
                        const isAvvist = item.status === "Avvist";
                        return (
                          <div
                            key={item.tildeling.TildelingID}
                            className="flex items-center gap-2 py-1.5 border-t border-slate-100 overflow-x-auto"
                          >
                            <button
                              type="button"
                              onClick={() => item.rolle && setSelectedRolleForModal(item.rolle)}
                              title="Se instruks"
                              className="flex items-center gap-2 shrink-0 text-left cursor-pointer rounded-lg hover:bg-slate-50 px-0.5 py-0.5"
                            >
                              <RolleIkon rollenavn={item.rolle?.Rollenavn || ""} />
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                {item.rolle?.Rollenavn}
                              </span>
                            </button>
                            <span className="text-sm font-semibold text-slate-800 inline-flex items-center gap-1.5 min-w-[4rem] shrink-0">
                              {isAvvist ? null : (
                                <>
                                  <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${
                                      isBekreftet ? "bg-emerald-500" : "bg-amber-400"
                                    }`}
                                    title={isBekreftet ? "Bekreftet" : "Forespurt"}
                                    aria-hidden
                                  />
                                  {person.Fornavn || person.Navn}
                                </>
                              )}
                            </span>
                            <div className="flex items-center gap-1 ml-auto shrink-0">
                            <IkonHandling
                              label={isBekreftet ? "Sett tilbake til forespurt" : "Dette passer"}
                              Icon={Check}
                              variant="confirm"
                              active={isBekreftet}
                              onClick={() => {
                                handleBekreft(item.tildeling.TildelingID, isBekreftet);
                              }}
                            />
                            <IkonHandling
                              label={isAvvist ? "Meldt forfall" : "Kan ikke"}
                              variant="decline"
                              Icon={X}
                              active={isAvvist}
                              onClick={() => handleAvkreft(item.tildeling.TildelingID)}
                            />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="px-4 sm:px-5 pb-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setVisAlleFor((prev) => ({
                          ...prev,
                          [gudstjeneste.GudstjenesteID]: !visAlle,
                        }))
                      }
                      className="text-[11px] font-semibold text-[#2d5a3f] hover:underline cursor-pointer"
                    >
                      {visAlle ? "Skjul alle" : "Vis alle"}
                    </button>

                    {visAlle && (
                      <div className="mt-1">
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
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Påmelding: nesten fullskjerm */}
      {showDatePickerForRolle && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex justify-center p-0 sm:p-4 animate-fadeIn">
          <div className="bg-white w-full h-full sm:h-auto sm:max-h-[100dvh] sm:max-w-5xl sm:my-4 sm:rounded-3xl shadow-2xl border-0 sm:border sm:border-slate-200 flex flex-col overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-3 shrink-0">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Meld deg på
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                  {showDatePickerForRolle.Rollenavn}
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  Se ledige og dine søndager. Behovstallet er veiledende — du kan melde deg på selv om det er nok folk.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDatePickerForRolle(null)}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer shrink-0"
                aria-label="Lukk"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {(() => {
              const rader = byggPåmeldingsrader(db, person.PersonID, showDatePickerForRolle);
              const antallLedige = rader.filter((r) => r.status === "ledig").length;
              const antallMine = rader.filter(
                (r) => r.status === "min-venter" || r.status === "min-bekreftet"
              ).length;
              const antallFulle = rader.filter((r) => r.status === "full").length;
              const filtrert = rader.filter((r) => {
                if (datePickerFilter === "ledige") return r.status === "ledig";
                if (datePickerFilter === "mine") {
                  return r.status === "min-venter" || r.status === "min-bekreftet";
                }
                return true;
              });

              return (
                <>
                  <div className="px-4 sm:px-6 py-3 flex flex-wrap gap-2 shrink-0">
                    {(
                      [
                        ["alle", `Alle (${rader.length})`],
                        ["ledige", `Ledige (${antallLedige})`],
                        ["mine", `Mine (${antallMine})`],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setDatePickerFilter(id)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition ${
                          datePickerFilter === id
                            ? "bg-[#2d5a3f] text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                    <span className="text-xs text-slate-400 self-center ml-auto">
                      {antallFulle} med dekket veiledende behov
                    </span>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 space-y-2">
                    {filtrert.length === 0 ? (
                      <div className="text-center py-12 text-sm text-slate-500">
                        Ingen gudstjenester i dette filteret.
                      </div>
                    ) : (
                      filtrert.map((rad) => {
                        const { gudstjeneste: g, behov, ledige, bekreftetAntall, personerPå, status } = rad;
                        const kanMelde = status === "ledig" || status === "full";
                        return (
                          <div
                            key={g.GudstjenesteID}
                            className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              status === "ledig"
                                ? "bg-[#f4f8f5] border-[#d2e8d9]"
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
                              <div className="text-xs text-slate-500">
                                {bekreftetAntall} av {behov} bekreftet (veiledende)
                                {ledige > 0 ? ` · ${ledige} ledig` : " · kan overbookes"}
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
                                    handleVelgAnnenDato(g.GudstjenesteID, showDatePickerForRolle)
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

                  <div className="px-4 sm:px-6 py-3 border-t border-slate-100 flex justify-end shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowDatePickerForRolle(null)}
                      className="px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
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
    </div>
  );
};
