import React, { useState } from "react";
import {
  DatabaseState,
  hentPåmeldingsRoller,
  trengerForstereise,
  visKalenderForPerson,
  mineGrupperForPerson,
} from "../services/dataService";
import { InteresseSkjema } from "./InteresseSkjema";
import { MineGrupperArk } from "./MineGrupperArk";
import { KalenderView } from "./KalenderView";
import { PersonligSondagsliste } from "./PersonligSondagsliste";
import { Info, Users } from "lucide-react";

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
  const [minSideFane, setMinSideFane] = useState<"oppgaver" | "kalender">("oppgaver");
  const [visMineGrupper, setVisMineGrupper] = useState(false);
  const [rolleFilterId, setRolleFilterId] = useState<string | null>(null);

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
  const personensGrupper = mineGrupperForPerson(db, person.PersonID);
  const visKalenderFane =
    visKalenderForPerson(db, person.PersonID, "minSide") ||
    visKalenderForPerson(db, person.PersonID, "ical");

  const rolleNavnTekst = (() => {
    if (visningsRoller.length === 0) return "oppgaver";
    if (visningsRoller.length === 1) return visningsRoller[0].Rollenavn;
    if (visningsRoller.length === 2) {
      return `${visningsRoller[0].Rollenavn} og ${visningsRoller[1].Rollenavn}`;
    }
    const forste = visningsRoller.slice(0, -1).map((r) => r.Rollenavn).join(", ");
    const siste = visningsRoller[visningsRoller.length - 1].Rollenavn;
    return `${forste} og ${siste}`;
  })();

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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
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

        {visningsRoller.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRolleFilterId(null)}
              className={`min-h-11 px-4 text-sm font-semibold rounded-xl cursor-pointer ${
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
                className={`min-h-11 px-4 text-sm font-semibold rounded-xl cursor-pointer ${
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

        <div className="flex flex-wrap gap-2">
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
            Huk av under hver søndag der du kan være med, og gå måned for måned gjennom semesteret.
            Oppgavene hører til tjenestegrupper — åpne{" "}
            {personensGrupper.length === 1 ? "Min gruppe" : "Mine grupper"} for å se hvem som er
            leder.
          </p>
        </div>
      </div>

      {visKalenderFane ? (
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
      ) : null}

      {visKalenderFane && minSideFane === "kalender" ? (
        <KalenderView
          db={db}
          onUpdateDb={onUpdateDb}
          vis
          modus="les"
          selectedPersonId={person.PersonID}
          visAbonner={visKalenderForPerson(db, person.PersonID, "ical")}
        />
      ) : (
        <PersonligSondagsliste
          db={db}
          personId={person.PersonID}
          rolleFilterId={rolleFilterId}
          onUpdateDb={onUpdateDb}
        />
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
