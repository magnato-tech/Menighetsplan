import React, { useEffect, useState } from "react";
import {
  DatabaseState,
  hentPåmeldingsRoller,
  trengerForstereise,
  visKalenderForPerson,
  visMeldingerForPerson,
  mineGrupperForPerson,
  antallUlesteMeldinger,
  markerMeldingerSomLest,
  formatBidraRoller,
} from "../services/dataService";
import { InteresseSkjema } from "./InteresseSkjema";
import { MineGrupperArk } from "./MineGrupperArk";
import { KalenderView } from "./KalenderView";
import { ForesporslerPanel } from "./ForesporslerPanel";
import { PersonligSondagsliste } from "./PersonligSondagsliste";
import { GruppeMeldingerInnhold } from "./GruppeMeldingerInnhold";
import { Info, Users } from "lucide-react";

type MinSideFane = "oppgaver" | "meldinger" | "kalender";

interface PersonalViewProps {
  db: DatabaseState;
  selectedPersonId: string;
  onUpdateDb: (updatedDb: DatabaseState) => void;
  visOppgaverArk?: boolean;
  onOppgaverArkChange?: (apen: boolean) => void;
}

export const PersonalView: React.FC<PersonalViewProps> = ({
  db,
  selectedPersonId,
  onUpdateDb,
  visOppgaverArk = false,
  onOppgaverArkChange,
}) => {
  const [minSideFane, setMinSideFane] = useState<MinSideFane>("oppgaver");
  const [visMineGrupper, setVisMineGrupper] = useState(false);
  const [rolleFilterId, setRolleFilterId] = useState<string | null>(null);
  const [ulestAntall, setUlestAntall] = useState(0);

  const person = db.personer.find((p) => p.PersonID === selectedPersonId);

  const visningsRoller = person ? hentPåmeldingsRoller(db, person.PersonID) : [];
  const personensGrupper = person ? mineGrupperForPerson(db, person.PersonID) : [];
  const visKalenderFane = person
    ? visKalenderForPerson(db, person.PersonID, "minSide") ||
      visKalenderForPerson(db, person.PersonID, "ical")
    : false;
  const visKalenderInnhold = person
    ? visKalenderForPerson(db, person.PersonID, "minSide")
    : false;
  const visMeldingerFane = person ? visMeldingerForPerson(db, person.PersonID) : false;
  const visFaneRad = visMeldingerFane || visKalenderInnhold;

  useEffect(() => {
    if (!person) return;
    setUlestAntall(antallUlesteMeldinger(db, person.PersonID));
  }, [db, person?.PersonID]);

  useEffect(() => {
    if (minSideFane === "meldinger" && !visMeldingerFane) {
      setMinSideFane("oppgaver");
    }
    if (minSideFane === "kalender" && !visKalenderInnhold) {
      setMinSideFane("oppgaver");
    }
  }, [minSideFane, visMeldingerFane, visKalenderInnhold]);

  useEffect(() => {
    if (!person || minSideFane !== "meldinger" || !visMeldingerFane) return;
    markerMeldingerSomLest(db, person.PersonID);
    setUlestAntall(0);
  }, [minSideFane, visMeldingerFane, db, person?.PersonID]);

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

  const bidraTekst = formatBidraRoller(visningsRoller);

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

  const faneKnapper: { id: MinSideFane; merke: string; ulest?: number }[] = [
    { id: "oppgaver", merke: "Oppgaver" },
  ];
  if (visMeldingerFane) {
    faneKnapper.push({ id: "meldinger", merke: "Meldinger", ulest: ulestAntall });
  }
  if (visKalenderInnhold) {
    faneKnapper.push({ id: "kalender", merke: "Kalender" });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4 space-y-3 sm:space-y-4">
      <div className="bg-white rounded-3xl p-3 sm:p-5 border border-slate-200/90 shadow-xs space-y-2.5 sm:space-y-3">
        <div>
          <span className="hidden sm:block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
            Lillesand Misjonskirke
          </span>
          <h2 className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Hei {person.Fornavn}</span>
            <span className="text-lg sm:text-2xl">👋</span>
          </h2>
          <p className="hidden sm:block text-xs sm:text-sm text-slate-600 mt-0.5">
            Takk for at du vil bidra i menigheten.
          </p>
          <p className="sm:hidden text-xs sm:text-sm text-slate-600 mt-0.5">
            {bidraTekst ? `Du bidrar ${bidraTekst}.` : "Du bidrar i menigheten."}
          </p>
        </div>

        {visningsRoller.length > 0 ? (
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 scrollbar-thin">
            <button
              type="button"
              onClick={() => setRolleFilterId(null)}
              className={`shrink-0 min-h-9 px-3 text-xs sm:text-sm font-semibold rounded-xl cursor-pointer ${
                rolleFilterId === null
                  ? "bg-[#2d5a3f] text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Alle
            </button>
            {visningsRoller.map((rolle) => (
              <button
                key={rolle.RolleID}
                type="button"
                onClick={() => setRolleFilterId(rolle.RolleID)}
                className={`shrink-0 min-h-9 px-3 text-xs sm:text-sm font-semibold rounded-xl cursor-pointer ${
                  rolleFilterId === rolle.RolleID
                    ? "bg-[#2d5a3f] text-white"
                    : "bg-[#eef5f1] text-[#2d5a3f] hover:bg-[#dceee3] border border-[#d2e8d9]"
                }`}
              >
                {rolle.Rollenavn}
              </button>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={() => onOppgaverArkChange?.(true)}
            className="min-h-9 w-full sm:w-auto px-3 text-xs sm:text-sm font-semibold text-[#2d5a3f] bg-[#eef5f1] hover:bg-[#d2e8d9] border border-[#d2e8d9] rounded-xl cursor-pointer"
          >
            Tjeneste
          </button>
          <button
            type="button"
            onClick={() => setVisMineGrupper(true)}
            className="min-h-9 w-full sm:w-auto px-3 text-xs sm:text-sm font-semibold text-[#2d5a3f] bg-[#eef5f1] hover:bg-[#d2e8d9] border border-[#d2e8d9] rounded-xl cursor-pointer inline-flex items-center justify-center gap-1.5"
          >
            <Users className="w-4 h-4 shrink-0" />
            {personensGrupper.length === 1 ? "Min gruppe" : "Mine grupper"}
          </button>
        </div>

        <div className="hidden md:block bg-[#f4f8f5] border-l-4 border-[#2d5a3f] rounded-2xl p-3 text-xs sm:text-sm text-slate-700 leading-relaxed shadow-2xs">
          <p>
            {bidraTekst ? (
              <>
                Du har sagt ja til å bidra{" "}
                <strong className="text-[#1e3e2b] font-bold">{bidraTekst}</strong> i menigheten.
              </>
            ) : (
              <>Du har sagt ja til å bidra i menigheten.</>
            )}{" "}
            Huk av under hver søndag der du kan være med, og gå måned for måned gjennom semesteret.
            Oppgavene hører til tjenestegrupper — åpne{" "}
            {personensGrupper.length === 1 ? "Min gruppe" : "Mine grupper"} for å se hvem som er
            leder.
          </p>
        </div>
      </div>

      {visFaneRad ? (
        <div className="flex gap-2 flex-wrap">
          {faneKnapper.map(({ id, merke, ulest }) => (
            <button
              key={id}
              type="button"
              onClick={() => setMinSideFane(id)}
              className={`min-h-9 px-3 py-1 text-xs font-semibold rounded-xl cursor-pointer inline-flex items-center gap-1.5 ${
                minSideFane === id ? "bg-[#2d5a3f] text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {merke}
              {ulest != null && ulest > 0 ? (
                <span
                  className={`inline-flex items-center justify-center min-w-[1.125rem] h-[1.125rem] px-1 text-[10px] font-bold rounded-full ${
                    minSideFane === id
                      ? "bg-white text-[#2d5a3f]"
                      : "bg-rose-500 text-white"
                  }`}
                  aria-label={`${ulest} uleste meldinger`}
                >
                  {ulest}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {minSideFane === "kalender" && visKalenderInnhold ? (
        <KalenderView
          db={db}
          onUpdateDb={onUpdateDb}
          vis
          modus="les"
          selectedPersonId={person.PersonID}
          visAbonner={visKalenderForPerson(db, person.PersonID, "ical")}
        />
      ) : minSideFane === "meldinger" && visMeldingerFane ? (
        <GruppeMeldingerInnhold db={db} personId={person.PersonID} />
      ) : (
        <>
          <ForesporslerPanel
            db={db}
            personId={person.PersonID}
            onUpdateDb={onUpdateDb}
          />
          <PersonligSondagsliste
            db={db}
            personId={person.PersonID}
            rolleFilterId={rolleFilterId}
            onUpdateDb={onUpdateDb}
          />
        </>
      )}

      {visOppgaverArk ? (
        <InteresseSkjema
          db={db}
          personId={person.PersonID}
          onUpdateDb={onUpdateDb}
          onFerdig={() => onOppgaverArkChange?.(false)}
        />
      ) : null}
      {visMineGrupper ? (
        <MineGrupperArk
          db={db}
          personId={person.PersonID}
          onLukk={() => setVisMineGrupper(false)}
        />
      ) : null}
    </div>
  );
};

