import React, { useCallback, useEffect, useState } from "react";
import {
  DatabaseState,
  finnGrupperSomLederEllerNestleder,
  finnMedlemmerIGruppe,
  genererPersonligLenke,
  gruppetypeForGruppe,
  erTjenestegruppe,
  erGruppeledergruppe,
  hentSvarStatus,
  saveDatabase,
  settDeltakelseForPerson,
  tildelEksternPerson,
  erEksternPersonId,
  sikreGruppemedlemskap,
  AppView,
  visKalenderForPerson,
  visProgramIkon,
  kanRedigereProgram,
  nesteSamlingInfo,
  nesteGruppeledersamling,
  kommendeArrangementerForGruppe,
  forrigeArrangementForGruppe,
  formatertArrangementDato,
  oppfølgingsSignaler,
  opprettNyPersonFraGruppeleder,
} from "../services/dataService";
import { Person } from "../types/database";
import { GruppeMedlemListe } from "./GruppeMedlemListe";
import { GroupLeaderGuide, type GuideStegSignal, type GruppeGuideType } from "./GroupLeaderGuide";
import { Samlingsplanlegging } from "./Samlingsplanlegging";
import {
  SondagBemanning,
  type OversiktFilter,
  type TildelForesporsel,
} from "./SondagBemanning";
import type { ArkVisning } from "./Planleggingsark";
import { KalenderView } from "./KalenderView";
import { ProgramLeserModal } from "./ProgramLeserModal";
import { NesteSamlingKort } from "./NesteSamlingKort";
import { GruppeKommunikasjon } from "./GruppeKommunikasjon";
import { GruppeRessurser } from "./GruppeRessurser";
import { SamlingOppmotePanel } from "./SamlingOppmotePanel";
import { SamlingMeldingPanel } from "./SamlingMeldingPanel";
import { Users, Shield, Search, HelpCircle, AlertCircle } from "lucide-react";
import type { LederSeksjon } from "./MobilBunnmeny";

const ALLE_GRUPPER = "";

interface GroupLeaderViewProps {
  db: DatabaseState;
  selectedPersonId: string;
  onUpdateDb: (updatedDb: DatabaseState) => void;
  onSelectPerson: (personId: string, view?: AppView) => void;
  onViewAsMember?: (personId: string, view?: AppView) => void;
  lederSeksjon?: LederSeksjon;
  onLederSeksjon?: (seksjon: LederSeksjon) => void;
  fokusMedlemmerNokkel?: number;
}

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

function personerIGrupper(db: DatabaseState, gruppeIds: string[]): Person[] {
  const byId = new Map<string, Person>();
  for (const gruppeId of gruppeIds) {
    const gruppe = db.grupper.find((g) => g.GruppeID === gruppeId);
    for (const m of finnMedlemmerIGruppe(db, gruppeId)) {
      byId.set(m.person.PersonID, m.person);
    }
    if (gruppe?.GruppelederID) {
      const leder = db.personer.find((p) => p.PersonID === gruppe.GruppelederID);
      if (leder) byId.set(leder.PersonID, leder);
    }
    if (gruppe?.NestlederID) {
      const nest = db.personer.find((p) => p.PersonID === gruppe.NestlederID);
      if (nest) byId.set(nest.PersonID, nest);
    }
  }
  return Array.from(byId.values());
}

function guideTypeForGruppe(db: DatabaseState, gruppe?: { GruppetypeID: string; GruppeID: string }): GruppeGuideType {
  if (!gruppe) return "annet";
  const full = db.grupper.find((g) => g.GruppeID === gruppe.GruppeID);
  if (!full) return "annet";
  if (erGruppeledergruppe(db, full)) return "gruppeledergruppe";
  if (erTjenestegruppe(db, full)) return "tjenestegruppe";
  const nøkkel = gruppetypeForGruppe(db, full)?.Navn?.toLowerCase() || "";
  if (nøkkel.includes("hus") || nøkkel.includes("interesse")) return "husgruppe";
  return "annet";
}

export const GroupLeaderView: React.FC<GroupLeaderViewProps> = ({
  db,
  selectedPersonId,
  onUpdateDb,
  onSelectPerson,
  onViewAsMember,
  lederSeksjon = "hjem",
  onLederSeksjon,
  fokusMedlemmerNokkel = 0,
}) => {
  const [copiedPersonId, setCopiedPersonId] = useState<string | null>(null);
  const [assignModal, setAssignModal] = useState<TildelForesporsel | null>(null);
  const [assignSok, setAssignSok] = useState("");
  const [eksternForesporsel, setEksternForesporsel] = useState<string | null>(null);
  const [oversiktFilter, setOversiktFilter] = useState<OversiktFilter>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [leserGudstjenesteId, setLeserGudstjenesteId] = useState<string | null>(null);
  const [guideVisning, setGuideVisning] = useState<ArkVisning | undefined>(undefined);
  const [guideApneForsteKort, setGuideApneForsteKort] = useState(false);
  const [activeGruppeId, setActiveGruppeId] = useState(ALLE_GRUPPER);
  const [nySamlingApen, setNySamlingApen] = useState(false);

  const person = db.personer.find((p) => p.PersonID === selectedPersonId);
  const lededeGrupper = person
    ? finnGrupperSomLederEllerNestleder(db, person.PersonID)
    : [];
  const alleGruppeledere = db.personer.filter(
    (p) => finnGrupperSomLederEllerNestleder(db, p.PersonID).length > 0
  );

  useEffect(() => {
    if (lededeGrupper.length === 1) {
      setActiveGruppeId(lededeGrupper[0].GruppeID);
    } else {
      setActiveGruppeId(ALLE_GRUPPER);
    }
  }, [selectedPersonId, lededeGrupper.length]);

  const visOversiktFilter = oversiktFilter;

  useEffect(() => {
    if (!fokusMedlemmerNokkel) return;
    onLederSeksjon?.("medlemmer");
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>("[data-guide='medlemmer']")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [fokusMedlemmerNokkel, onLederSeksjon]);

  useEffect(() => {
    if (
      activeGruppeId &&
      activeGruppeId !== ALLE_GRUPPER &&
      !lededeGrupper.some((g) => g.GruppeID === activeGruppeId)
    ) {
      setActiveGruppeId(lededeGrupper.length === 1 ? lededeGrupper[0].GruppeID : ALLE_GRUPPER);
    }
  }, [lededeGrupper, activeGruppeId]);

  const visGrupper =
    activeGruppeId === ALLE_GRUPPER
      ? lededeGrupper
      : lededeGrupper.filter((g) => g.GruppeID === activeGruppeId);
  const currentGruppe = visGrupper.length === 1 ? visGrupper[0] : undefined;
  const visGruppeIds = visGrupper.map((g) => g.GruppeID);

  const handleCopyLink = (targetPersonId: string) => {
    const link = genererPersonligLenke(targetPersonId, db);
    navigator.clipboard.writeText(link).then(() => {
      setCopiedPersonId(targetPersonId);
      setTimeout(() => setCopiedPersonId(null), 2500);
    });
  };

  const handleAssignPerson = (personId: string) => {
    if (!assignModal) return;
    const updated = settDeltakelseForPerson(
      db,
      personId,
      assignModal.gudstjenesteId,
      assignModal.rolleId,
      "Avventer",
      "Forespurt av gruppeleder"
    );
    onUpdateDb(updated);
    if (!erEksternPersonId(personId)) {
      handleCopyLink(personId);
    }
    setAssignSok("");
    setEksternForesporsel(null);
    setAssignModal(null);
  };

  const handleAssignEkstern = () => {
    if (!assignModal || !eksternForesporsel) return;
    const updated = tildelEksternPerson(
      db,
      assignModal.gudstjenesteId,
      assignModal.rolleId,
      eksternForesporsel,
      "Ekstern person (ikke i menighetsregisteret)"
    );
    onUpdateDb(updated);
    setAssignSok("");
    setEksternForesporsel(null);
    setAssignModal(null);
  };

  const handleGuideSteg = useCallback((signal: GuideStegSignal) => {
    setGuideVisning(signal.visning);
    setGuideApneForsteKort(Boolean(signal.apneKort));
  }, []);

  if (lededeGrupper.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs text-center">
          <Shield className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-900">
            {person?.Navn || "Valgt person"} er ikke registrert som gruppeleder
          </h2>
          <p className="text-slate-600 text-sm mt-1 max-w-md mx-auto">
            I Menighetsplan får gruppeledere oversikt over gruppen de leder og medlemmene.
            Tjenestegrupper får i tillegg bemanning til gudstjenester. Sett personen som leder
            eller nestleder på gruppekortet under Administrator.
          </p>
          <div className="mt-6 pt-6 border-t border-slate-100 max-w-lg mx-auto">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-3">
              Velg en gruppeleder for å teste visningen:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {alleGruppeledere.map((leder) => {
                const gruppenavn = finnGrupperSomLederEllerNestleder(db, leder.PersonID)
                  .map((g) => g.Gruppenavn)
                  .join(", ");
                return (
                  <button
                    key={leder.PersonID}
                    type="button"
                    onClick={() => onSelectPerson(leder.PersonID)}
                    className="p-3 text-left bg-[#eef5f1]/70 hover:bg-[#eef5f1] border border-[#d2e8d9] rounded-xl transition cursor-pointer"
                  >
                    <div className="font-bold text-[#1e3e2b] text-sm">{leder.Navn}</div>
                    <div className="text-xs text-[#2d5a3f] mt-0.5 truncate">{gruppenavn}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const oversiktPersoner = personerIGrupper(db, visGruppeIds);
  const tildelGruppeId = assignModal
    ? db.roller.find((r) => r.RolleID === assignModal.rolleId)?.GruppeID
    : undefined;
  const tildelPersoner = tildelGruppeId
    ? personerIGrupper(db, [tildelGruppeId])
    : oversiktPersoner;

  const gruppensRoller = db.roller.filter(
    (r) => r.Aktiv && visGruppeIds.includes(r.GruppeID)
  );
  const visGudstjenesteBemanning = visGrupper.some((g) => erTjenestegruppe(db, g));
  const erLederforum = currentGruppe ? erGruppeledergruppe(db, currentGruppe) : false;

  const tittel =
    currentGruppe?.Gruppenavn ||
    (visGrupper.length > 1
      ? `Velg gruppe (${visGrupper.length})`
      : "Gruppe");
  const typeNavn = currentGruppe
    ? gruppetypeForGruppe(db, currentGruppe)?.Navn
    : undefined;
  const beskrivelse =
    currentGruppe?.Beskrivelse ||
    visGrupper.map((g) => g.Gruppenavn).join(" · ");

  const iDag = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const venterPersonIds = new Set(
    db.gudstjenester
      .filter((gud) => gud.Dato >= iDag)
      .flatMap((gud) =>
        db.tildelinger
          .filter(
            (t) =>
              t.GudstjenesteID === gud.GudstjenesteID &&
              gruppensRoller.some((r) => r.RolleID === t.RolleID) &&
              hentSvarStatus(db, t.TildelingID) === "Venter"
          )
          .map((t) => t.PersonID)
      )
  );

  const handleLeggTilMedlem = (personId: string) => {
    if (!currentGruppe) return;
    const updatedDb: DatabaseState = {
      ...db,
      gruppemedlemmer: sikreGruppemedlemskap(
        db.gruppemedlemmer,
        currentGruppe.GruppeID,
        personId,
        "Medlem"
      ),
    };
    saveDatabase(updatedDb);
    onUpdateDb(updatedDb);
  };

  const handleOpprettNyPerson = (navn: string) => {
    if (!currentGruppe) return;
    const updated = opprettNyPersonFraGruppeleder(db, navn, currentGruppe.GruppeID);
    saveDatabase(updated);
    onUpdateDb(updated);
  };

  const nesteSamling = currentGruppe
    ? nesteSamlingInfo(db, currentGruppe.GruppeID)
    : undefined;
  const nesteLederforum = !erLederforum ? nesteGruppeledersamling(db) : undefined;
  const kommendeSamlinger = currentGruppe
    ? kommendeArrangementerForGruppe(db, currentGruppe.GruppeID, 8)
    : [];
  const forrigeSamling = currentGruppe
    ? forrigeArrangementForGruppe(db, currentGruppe.GruppeID)
    : undefined;
  const signaler = currentGruppe
    ? oppfølgingsSignaler(
        db,
        currentGruppe.GruppeID,
        oversiktPersoner,
        visGudstjenesteBemanning ? gruppensRoller.map((r) => r.RolleID) : []
      )
    : [];
  const guideType = guideTypeForGruppe(db, currentGruppe);

  const seksjonsFaner: { id: LederSeksjon; merke: string; skjul?: boolean }[] = [
    { id: "hjem", merke: "Hjem" },
    { id: "medlemmer", merke: "Medlemmer" },
    { id: "samlinger", merke: "Samlinger" },
    { id: "bemanning", merke: "Bemanning", skjul: !visGudstjenesteBemanning },
    {
      id: "kalender",
      merke: "Kalender",
      skjul: !visKalenderForPerson(db, selectedPersonId, "gruppeleder"),
    },
  ];

  const visSeksjon = lederSeksjon;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Topp */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#2d5a3f] uppercase tracking-wider">
              <Users className="w-4 h-4" />
              <span>
                Gruppeleder
                {person?.Fornavn ? ` · ${person.Fornavn}` : ""}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">{tittel}</h2>
            {typeNavn ? (
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mt-0.5">
                {typeNavn}
              </p>
            ) : null}
            <p className="hidden sm:block text-xs sm:text-sm text-slate-500 mt-0.5">{beskrivelse}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2d5a3f] bg-[#eef5f1] hover:bg-[#dceee3] border border-[#d2e8d9] px-3 py-1.5 rounded-xl cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Slik gjør du det</span>
              <span className="sm:hidden">Guide</span>
            </button>
            {lededeGrupper.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                  Gruppe:
                </span>
                <select
                  value={activeGruppeId}
                  onChange={(e) => setActiveGruppeId(e.target.value)}
                  className="text-sm font-medium border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:ring-2 focus:ring-[#2d5a3f] focus:outline-hidden"
                >
                  {lededeGrupper.map((g) => (
                    <option key={g.GruppeID} value={g.GruppeID}>
                      {g.Gruppenavn}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {lededeGrupper.length > 1 && !currentGruppe && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {lededeGrupper.map((g) => (
              <button
                key={g.GruppeID}
                type="button"
                onClick={() => setActiveGruppeId(g.GruppeID)}
                className="text-left p-4 rounded-xl border border-slate-200 hover:border-[#d2e8d9] hover:bg-[#eef5f1]/50 cursor-pointer"
              >
                <p className="font-bold text-slate-900">{g.Gruppenavn}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {gruppetypeForGruppe(db, g)?.Navn || "Gruppe"}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {currentGruppe && (
        <>
          {/* Neste gruppeledersamling (global stripe) */}
          {nesteLederforum && (
            <div data-guide="gruppeledersamling">
              <NesteSamlingKort
                tittel="Neste gruppeledersamling"
                info={{ kilde: "arrangement", arrangement: nesteLederforum }}
                undertittel="Gruppelederteam"
                variant="sekundær"
              />
            </div>
          )}

          {/* Desktop seksjonsfaner */}
          <div className="hidden md:flex gap-2 flex-wrap">
            {seksjonsFaner
              .filter((f) => !f.skjul)
              .map(({ id, merke }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onLederSeksjon?.(id)}
                  className={`min-h-11 px-3 py-1.5 text-xs font-semibold rounded-xl cursor-pointer ${
                    visSeksjon === id
                      ? "bg-[#2d5a3f] text-white"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {merke}
                </button>
              ))}
          </div>

          {/* HJEM */}
          {visSeksjon === "hjem" && (
            <div className="space-y-6">
              <div
                className="grid grid-cols-1 lg:grid-cols-2 gap-4"
                data-guide="neste-samling"
              >
                <NesteSamlingKort
                  tittel={`Neste samling i ${currentGruppe.Gruppenavn}`}
                  info={nesteSamling}
                  onNySamling={() => {
                    onLederSeksjon?.("samlinger");
                    setNySamlingApen(true);
                  }}
                />
                {signaler.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-800 flex items-center gap-1.5 mb-2">
                      <AlertCircle className="w-4 h-4" />
                      Trenger oppfølging ({signaler.length})
                    </h3>
                    <ul className="space-y-1.5">
                      {signaler.slice(0, 5).map((s) => (
                        <li key={`${s.personId}-${s.type}`} className="text-sm text-amber-900">
                          <span className="font-semibold">{s.navn}</span>
                          <span className="text-amber-800"> — {s.beskrivelse}</span>
                        </li>
                      ))}
                    </ul>
                    {signaler.length > 5 && (
                      <button
                        type="button"
                        onClick={() => onLederSeksjon?.("medlemmer")}
                        className="text-xs font-semibold text-amber-800 mt-2 hover:underline cursor-pointer"
                      >
                        Se alle i Medlemmer
                      </button>
                    )}
                  </div>
                )}
              </div>

              {kommendeSamlinger.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                    Kommende samlinger
                  </h3>
                  <ul className="space-y-2">
                    {kommendeSamlinger.slice(0, 4).map((a) => (
                      <li key={a.ArrangementID} className="text-sm text-slate-800">
                        {formatertArrangementDato(a.Dato, a.Tid)}
                        {a.Sted ? (
                          <span className="text-slate-500"> · {a.Sted}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  {kommendeSamlinger.length > 4 && (
                    <button
                      type="button"
                      onClick={() => onLederSeksjon?.("samlinger")}
                      className="text-xs font-semibold text-[#2d5a3f] mt-2 hover:underline cursor-pointer"
                    >
                      Se alle samlinger
                    </button>
                  )}
                </div>
              )}

              <GruppeRessurser ressurser={currentGruppe.Ressurser} />

              {visGudstjenesteBemanning && gruppensRoller.length > 0 && (
                <div className="text-sm">
                  <button
                    type="button"
                    onClick={() => onLederSeksjon?.("bemanning")}
                    className="text-[#2d5a3f] font-semibold hover:underline cursor-pointer"
                  >
                    Gå til bemanning →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* MEDLEMMER */}
          {visSeksjon === "medlemmer" && (
            <div className="space-y-4">
              <GruppeKommunikasjon
                db={db}
                gruppeId={currentGruppe.GruppeID}
                gruppenavn={currentGruppe.Gruppenavn}
                opprettetAvPersonId={selectedPersonId}
                onUpdateDb={onUpdateDb}
              />
              <GruppeMedlemListe
                db={db}
                medlemmer={oversiktPersoner}
                venterPersonIds={venterPersonIds}
                uthevMedlemmer={visOversiktFilter === "medlemmer"}
                copiedPersonId={copiedPersonId}
                onCopyLink={handleCopyLink}
                onSelectPerson={onSelectPerson}
                onViewAsMember={onViewAsMember}
                onLeggTilMedlem={handleLeggTilMedlem}
                onOpprettNyPerson={handleOpprettNyPerson}
              />
            </div>
          )}

          {/* SAMLINGER */}
          {visSeksjon === "samlinger" && (
            <div className="space-y-6" data-guide="samlinger">
              <Samlingsplanlegging
                db={db}
                gruppeId={currentGruppe.GruppeID}
                onUpdateDb={onUpdateDb}
                opprettetAv={selectedPersonId}
                apen={nySamlingApen}
                onApenChange={setNySamlingApen}
              />
              {kommendeSamlinger.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Kommende samlinger
                  </h3>
                  {kommendeSamlinger.map((a) => (
                    <SamlingMeldingPanel
                      key={a.ArrangementID}
                      db={db}
                      gruppeId={currentGruppe.GruppeID}
                      gruppenavn={currentGruppe.Gruppenavn}
                      arrangement={a}
                      opprettetAvPersonId={selectedPersonId}
                      onUpdateDb={onUpdateDb}
                    />
                  ))}
                </div>
              )}
              {forrigeSamling && (
                <SamlingOppmotePanel
                  db={db}
                  arrangement={forrigeSamling}
                  gruppeId={currentGruppe.GruppeID}
                  medlemmer={oversiktPersoner}
                  onUpdateDb={onUpdateDb}
                />
              )}
            </div>
          )}

          {/* BEMANNING */}
          {visSeksjon === "bemanning" && visGudstjenesteBemanning && gruppensRoller.length > 0 && (
            <SondagBemanning
              db={db}
              onUpdateDb={onUpdateDb}
              rolleIds={gruppensRoller.map((r) => r.RolleID)}
              gruppeId={currentGruppe.GruppeID}
              medlemstall={oversiktPersoner.length}
              kpiTittel="Semesteret totalt"
              kpiBeskrivelse={`Tallene gjelder ${currentGruppe.Gruppenavn}.`}
              visKpiAlltid
              visKjoreplan="programrett"
              skjulGruppehode
              listeTittel="Kommende gudstjenester"
              oversiktFilter={visOversiktFilter}
              onOversiktFilter={setOversiktFilter}
              medlemmerPanel={
                currentGruppe ? (
                  <GruppeMedlemListe
                    db={db}
                    medlemmer={oversiktPersoner}
                    venterPersonIds={venterPersonIds}
                    uthevMedlemmer={false}
                    copiedPersonId={copiedPersonId}
                    onCopyLink={handleCopyLink}
                    onSelectPerson={onSelectPerson}
                    onViewAsMember={onViewAsMember}
                    onLeggTilMedlem={handleLeggTilMedlem}
                    onOpprettNyPerson={handleOpprettNyPerson}
                    utenRamme
                  />
                ) : undefined
              }
              onGaTilMedlemmerFane={() => onLederSeksjon?.("medlemmer")}
              onSelectPerson={onSelectPerson}
              selectedPersonId={selectedPersonId}
              onTildel={(foresporsel) => {
                setAssignSok("");
                setEksternForesporsel(null);
                setAssignModal(foresporsel);
              }}
              statusAktor="gruppeleder"
              guideVisning={guideOpen ? guideVisning : undefined}
              guideApneForsteKort={guideOpen && guideApneForsteKort}
              apneForsteKort
            />
          )}

          {/* KALENDER */}
          {visSeksjon === "kalender" &&
            visKalenderForPerson(db, selectedPersonId, "gruppeleder") && (
              <KalenderView
                db={db}
                onUpdateDb={onUpdateDb}
                vis
                modus="les"
                selectedPersonId={selectedPersonId}
                visAbonner={visKalenderForPerson(db, selectedPersonId, "ical")}
                onApneGudstjeneste={(id) => {
                  if (visProgramIkon(db, selectedPersonId, id)) setLeserGudstjenesteId(id);
                }}
              />
            )}
        </>
      )}

      {assignModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 animate-fadeIn flex items-end sm:items-center justify-center sm:p-4">
          <button type="button" className="absolute inset-0 cursor-pointer" aria-label="Lukk" onClick={() => { setAssignSok(""); setEksternForesporsel(null); setAssignModal(null); }} />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 sheet-safe-bottom max-h-[90dvh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-0.5">
              Sett opp {assignModal.rolleNavn}
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              {formatDato(assignModal.gudstjenesteDato)}
            </p>
            {eksternForesporsel ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-700">
                  <strong>{eksternForesporsel}</strong> finnes ikke i personregisteret. Vil du
                  sette personen opp som ekstern på denne gudstjenesten?
                </p>
                <p className="text-xs text-slate-500">
                  Eksterne lagres ikke i menighetens personregister.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEksternForesporsel(null)}
                    className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Nei
                  </button>
                  <button
                    type="button"
                    onClick={handleAssignEkstern}
                    className="px-4 py-2 text-sm bg-[#2d5a3f] hover:bg-[#234731] text-white font-semibold rounded-xl cursor-pointer"
                  >
                    Ja, ekstern person
                  </button>
                </div>
              </div>
            ) : (
              <>
                {(() => {
                  const opptatt = new Set(
                    db.tildelinger
                      .filter(
                        (t) =>
                          t.GudstjenesteID === assignModal.gudstjenesteId &&
                          t.RolleID === assignModal.rolleId &&
                          hentSvarStatus(db, t.TildelingID) !== "Avvist"
                      )
                      .map((t) => t.PersonID)
                  );
                  const q = assignSok.trim().toLowerCase();
                  const treffer = (p: Person) => {
                    if (!q) return true;
                    const navn = `${p.Fornavn || ""} ${p.Etternavn || ""} ${p.Navn || ""}`.toLowerCase();
                    return navn.includes(q);
                  };
                  const iGruppen = tildelPersoner
                    .filter((p) => !opptatt.has(p.PersonID) && treffer(p))
                    .slice()
                    .sort((a, b) =>
                      (a.Fornavn || a.Navn).localeCompare(b.Fornavn || b.Navn, "nb")
                    );
                  const gruppeIds = new Set(tildelPersoner.map((p) => p.PersonID));
                  const iMenigheten = q
                    ? db.personer
                        .filter(
                          (p) =>
                            p.Aktiv !== false &&
                            !gruppeIds.has(p.PersonID) &&
                            !opptatt.has(p.PersonID) &&
                            treffer(p)
                        )
                        .slice()
                        .sort((a, b) =>
                          (a.Fornavn || a.Navn).localeCompare(b.Fornavn || b.Navn, "nb")
                        )
                        .slice(0, 12)
                    : [];
                  const ingenTreff = q.length > 0 && iGruppen.length === 0 && iMenigheten.length === 0;
                  return (
                    <>
                      <div className="relative mb-3">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="search"
                          value={assignSok}
                          onChange={(e) => setAssignSok(e.target.value)}
                          placeholder="Søk i gruppen eller menigheten…"
                          autoFocus
                          className="w-full text-sm border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
                        />
                      </div>
                      <div className="max-h-64 overflow-y-auto space-y-3">
                        <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                          {iGruppen.length === 0 ? (
                            <li className="px-4 py-3 text-sm text-slate-500">
                              {q ? "Ingen i gruppen matcher." : "Ingen ledige i gruppen."}
                            </li>
                          ) : (
                            iGruppen.map((p) => (
                              <li key={p.PersonID}>
                                <button
                                  type="button"
                                  onClick={() => handleAssignPerson(p.PersonID)}
                                  className="w-full text-left px-4 py-3 text-sm font-medium text-slate-900 hover:bg-[#eef5f1] cursor-pointer"
                                >
                                  {p.Fornavn || p.Navn}
                                </button>
                              </li>
                            ))
                          )}
                        </ul>
                        {iMenigheten.length > 0 && (
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1 px-1">
                              Fra menigheten
                            </p>
                            <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                              {iMenigheten.map((p) => (
                                <li key={p.PersonID}>
                                  <button
                                    type="button"
                                    onClick={() => handleAssignPerson(p.PersonID)}
                                    className="w-full text-left px-4 py-3 text-sm font-medium text-slate-900 hover:bg-[#eef5f1] cursor-pointer"
                                  >
                                    {p.Navn || `${p.Fornavn} ${p.Etternavn}`.trim()}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {ingenTreff && (
                          <button
                            type="button"
                            onClick={() => setEksternForesporsel(assignSok.trim())}
                            className="w-full text-left px-4 py-3 text-sm border border-dashed border-slate-200 rounded-xl text-[#2d5a3f] font-semibold hover:bg-[#eef5f1] cursor-pointer"
                          >
                            Legge til «{assignSok.trim()}» som ekstern person?
                          </button>
                        )}
                      </div>
                    </>
                  );
                })()}
                <div className="flex justify-end mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setAssignSok("");
                      setEksternForesporsel(null);
                      setAssignModal(null);
                    }}
                    className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  >
                    Avbryt
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {leserGudstjenesteId &&
        (() => {
          const gud = db.gudstjenester.find((g) => g.GudstjenesteID === leserGudstjenesteId);
          if (!gud) return null;
          return (
            <ProgramLeserModal
              db={db}
              gudstjeneste={gud}
              selectedPersonId={selectedPersonId}
              redigerbar={kanRedigereProgram(db, selectedPersonId, gud.GudstjenesteID)}
              onClose={() => setLeserGudstjenesteId(null)}
              onUpdateDb={onUpdateDb}
            />
          );
        })()}

      <GroupLeaderGuide
        open={guideOpen}
        onClose={() => {
          setGuideOpen(false);
          setGuideVisning(undefined);
          setGuideApneForsteKort(false);
        }}
        onSteg={handleGuideSteg}
        gruppeType={guideType}
      />
    </div>
  );
};
