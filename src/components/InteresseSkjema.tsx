import React, { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import {
  DatabaseState,
  aktiveTjenesteRolleIds,
  bekreftelseKonsekvensTekst,
  erMedITjenestegruppe,
  grupperAFølge,
  oppsummerRolleendring,
  settPersonroller,
  tjenesteRollerGruppert,
  velkomstForGrupper,
  type GruppeVelkomst,
  type RolleEndringOppsummering,
} from "../services/dataService";

type Steg = "velg" | "bekreft" | "velkomst";

interface InteresseSkjemaProps {
  db: DatabaseState;
  personId: string;
  onUpdateDb: (updatedDb: DatabaseState) => void;
  onFerdig?: () => void;
  landing?: boolean;
}

function sammeSett(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((id) => s.has(id));
}

export const InteresseSkjema: React.FC<InteresseSkjemaProps> = ({
  db,
  personId,
  onUpdateDb,
  onFerdig,
  landing = false,
}) => {
  const person = db.personer.find((p) => p.PersonID === personId);
  const grupper = useMemo(() => tjenesteRollerGruppert(db), [db]);
  const opprinnelige = useMemo(() => aktiveTjenesteRolleIds(db, personId), [db, personId]);
  const [valgte, setValgte] = useState<string[]>(() => aktiveTjenesteRolleIds(db, personId));
  const [steg, setSteg] = useState<Steg>("velg");
  const [oppsummering, setOppsummering] = useState<RolleEndringOppsummering | null>(null);
  const [velkomst, setVelkomst] = useState<GruppeVelkomst[]>([]);

  const uendret = sammeSett(valgte, opprinnelige);
  const minstEnRolle = valgte.length > 0;
  const grupperUtenMedlemskap = useMemo(
    () => grupperAFølge(db, personId, valgte),
    [db, personId, valgte]
  );
  const kanGaVidere = landing
    ? minstEnRolle && (!uendret || grupperUtenMedlemskap.length > 0)
    : !uendret;

  const veksle = (rolleId: string) => {
    setValgte((forrige) =>
      forrige.includes(rolleId) ? forrige.filter((id) => id !== rolleId) : [...forrige, rolleId]
    );
  };

  const visBekreft = () => {
    if (!kanGaVidere) return;
    if (uendret && grupperUtenMedlemskap.length > 0) {
      const etter = settPersonroller(db, personId, valgte);
      onUpdateDb(etter);
      setVelkomst(velkomstForGrupper(etter, grupperUtenMedlemskap));
      setSteg("velkomst");
      return;
    }
    setOppsummering(oppsummerRolleendring(db, personId, valgte));
    setSteg("bekreft");
  };

  const lagreOgOnskVelkommen = () => {
    const nyeRolleIds = (oppsummering?.lagtTil || []).map((linje) => linje.rolleId);
    const nyeGrupper = grupperAFølge(
      db,
      personId,
      nyeRolleIds.length ? nyeRolleIds : valgte
    );
    const etter = settPersonroller(db, personId, valgte);
    onUpdateDb(etter);
    if (nyeGrupper.length === 0) {
      onFerdig?.();
      return;
    }
    setVelkomst(velkomstForGrupper(etter, nyeGrupper));
    setSteg("velkomst");
  };

  const innhold = (
    <>
      {steg === "velg" && (
        <>
          {landing && person && (
            <div className="mb-4">
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Hei {person.Fornavn}</span>
                <span className="text-2xl">👋</span>
              </h2>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Takk for at du vil bidra i menigheten. Velg hvilke oppgaver du kan tenke deg i
                gudstjenesten. Du kan endre dette senere.
              </p>
            </div>
          )}
          {!landing && (
            <h2 className="text-lg font-bold text-slate-900 mb-1">Mine oppgaver</h2>
          )}
          <p className="text-xs text-slate-500 mb-4">
            Huk av minst én oppgave i tjenestegruppen du vil bidra i. Du kan siden velge alle
            oppgavene som hører til den gruppen.
          </p>
          <div className="space-y-5">
            {grupper.map(({ gruppe, roller }) => (
              <section key={gruppe.GruppeID}>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  {gruppe.Gruppenavn}
                </h3>
                <div className="space-y-1">
                  {roller.map((rolle) => {
                    const huket = valgte.includes(rolle.RolleID);
                    return (
                      <label
                        key={rolle.RolleID}
                        className={`flex items-start gap-3 min-h-11 px-3 py-2 rounded-xl border cursor-pointer ${
                          huket
                            ? "bg-[#eef5f1] border-[#d2e8d9]"
                            : "bg-white border-slate-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={huket}
                          onChange={() => veksle(rolle.RolleID)}
                          className="mt-1 w-4 h-4 accent-[#2d5a3f] cursor-pointer"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-slate-900">
                            {rolle.Rollenavn}
                          </span>
                          {rolle.Beskrivelse && (
                            <span className="block text-xs text-slate-500 leading-snug">
                              {rolle.Beskrivelse}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      {steg === "bekreft" && oppsummering && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Vil du lagre endringene?</h2>
          {oppsummering.lagtTil.length > 0 && (
            <p className="text-sm text-slate-600">
              {bekreftelseKonsekvensTekst(
                new Set(oppsummering.lagtTil.map((linje) => linje.gruppeId).filter(Boolean)).size
              )}
            </p>
          )}
          {oppsummering.lagtTil.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-1">
                Legges til
              </p>
              <ul className="text-sm text-slate-800 space-y-1">
                {oppsummering.lagtTil.map((linje) => (
                  <li key={linje.rolleId}>
                    {linje.rollenavn}
                    {linje.gruppenavn ? ` (${linje.gruppenavn})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {oppsummering.fjernet.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700 mb-1">
                Fjernes
              </p>
              <ul className="text-sm text-slate-800 space-y-1">
                {oppsummering.fjernet.map((linje) => (
                  <li key={linje.rolleId}>
                    {linje.rollenavn}
                    {linje.gruppenavn ? ` (${linje.gruppenavn})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {oppsummering.forlaterGrupper.length > 0 && (
            <p className="text-sm text-slate-700">
              Du forlater {oppsummering.forlaterGrupper.map((g) => g.gruppenavn).join(", ")}.
            </p>
          )}
        </div>
      )}

      {steg === "velkomst" && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Velkommen</h2>
          {velkomst.map(({ gruppe, lederNavn }) => (
            <div
              key={gruppe.GruppeID}
              className="rounded-2xl border border-[#d2e8d9] bg-[#eef5f1] px-4 py-3"
            >
              <p className="text-sm font-semibold text-slate-900">
                Velkommen til {gruppe.Gruppenavn}
              </p>
              <p className="text-sm text-slate-600 mt-1">
                {lederNavn
                  ? `Gruppeleder er ${lederNavn}.`
                  : "Gruppen har foreløpig ingen registrert gruppeleder."}{" "}
                Du kan nå velge oppgaver fra denne tjenestegruppen.
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const handlinger = (
    <div className="flex flex-wrap justify-end gap-2 pt-4 sheet-safe-bottom">
      {steg === "velg" && (
        <>
          {!landing && (
            <button
              type="button"
              onClick={() => onFerdig?.()}
              className="min-h-11 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Avbryt
            </button>
          )}
          <button
            type="button"
            onClick={visBekreft}
            disabled={!kanGaVidere}
            className="min-h-11 px-4 bg-[#2d5a3f] hover:bg-[#234731] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl cursor-pointer inline-flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Lagre
          </button>
        </>
      )}
      {steg === "bekreft" && (
        <>
          <button
            type="button"
            onClick={() => setSteg("velg")}
            className="min-h-11 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={lagreOgOnskVelkommen}
            className="min-h-11 px-4 bg-[#2d5a3f] hover:bg-[#234731] text-white text-sm font-semibold rounded-xl cursor-pointer"
          >
            Ja, endre
          </button>
        </>
      )}
      {steg === "velkomst" && (
        <button
          type="button"
          onClick={() => onFerdig?.()}
          className="min-h-11 px-4 bg-[#2d5a3f] hover:bg-[#234731] text-white text-sm font-semibold rounded-xl cursor-pointer"
        >
          Fortsett
        </button>
      )}
    </div>
  );

  if (landing) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-white rounded-3xl p-4 sm:p-8 border border-slate-200/90 shadow-xs">
          {innhold}
          {handlinger}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 flex justify-center items-end sm:items-center p-0 sm:p-4 animate-fadeIn">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer"
        aria-label="Lukk"
        onClick={() => onFerdig?.()}
      />
      <div className="relative bg-white w-full sheet-panel sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:rounded-3xl shadow-2xl border-0 sm:border sm:border-slate-200 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <span className="text-sm font-bold text-slate-900">Gudstjenesteroller</span>
          <button
            type="button"
            onClick={() => onFerdig?.()}
            className="p-2 min-h-11 min-w-11 text-slate-500 hover:bg-slate-100 rounded-xl cursor-pointer"
            aria-label="Lukk"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{innhold}</div>
        <div className="px-4 border-t border-slate-100">{handlinger}</div>
      </div>
    </div>
  );
};
