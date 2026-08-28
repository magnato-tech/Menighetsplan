import React, { useEffect, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import type { Samlingsplan } from "../types/database";
import {
  DatabaseState,
  genererSamlingshendelser,
  hentSamlingsplan,
  lagreSamlingsplan,
  planGjentas,
  saveDatabase,
  SAMLINGSPLAN_FREKVENS,
  SAMLINGSPLAN_INGEN_GJENTAKELSE,
  SAMLINGSPLAN_UKEDAGER,
} from "../services/dataService";

interface SamlingsplanleggingProps {
  db: DatabaseState;
  gruppeId: string;
  onUpdateDb: (updatedDb: DatabaseState) => void;
  opprettetAv?: string;
}

function feltLabel(id: string, tekst: string) {
  return (
    <label htmlFor={id} className="text-xs font-semibold text-slate-600 block mb-1">
      {tekst}
    </label>
  );
}

const feltKlasse =
  "w-full text-sm border border-slate-300 rounded-lg px-2.5 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]";

export const Samlingsplanlegging: React.FC<SamlingsplanleggingProps> = ({
  db,
  gruppeId,
  onUpdateDb,
  opprettetAv,
}) => {
  const [apen, setApen] = useState(false);
  const [plan, setPlan] = useState<Samlingsplan>(() => hentSamlingsplan(db, gruppeId));
  const [status, setStatus] = useState("");
  const gjentas = planGjentas(plan);

  useEffect(() => {
    setPlan(hentSamlingsplan(db, gruppeId));
  }, [db, gruppeId]);

  const oppdater = (felt: keyof Samlingsplan, verdi: string) => {
    setPlan((prev) => ({ ...prev, [felt]: verdi }));
    setStatus("");
  };

  const lagre = () => {
    const neste = lagreSamlingsplan(db, gruppeId, plan);
    saveDatabase(neste);
    onUpdateDb(neste);
    setStatus("Plan lagret.");
  };

  const opprettHendelser = () => {
    const lagret = lagreSamlingsplan(db, gruppeId, plan);
    const resultat = genererSamlingshendelser(lagret, gruppeId, plan, opprettetAv);
    if (!resultat.ok) {
      setStatus(resultat.feil);
      return;
    }
    saveDatabase(resultat.db);
    onUpdateDb(resultat.db);
    setPlan(hentSamlingsplan(resultat.db, gruppeId));
    setStatus(
      resultat.antall === 1
        ? "Én samling opprettet i kalenderen."
        : `${resultat.antall} samlinger opprettet i kalenderen.`
    );
  };

  return (
    <div
      className="border border-slate-200 rounded-xl overflow-hidden bg-white"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setApen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-slate-50 hover:bg-slate-100/80 cursor-pointer"
        aria-expanded={apen}
      >
        <span className="flex items-center gap-2 min-w-0">
          <CalendarDays className="w-4 h-4 shrink-0 text-slate-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Samlingsplanlegging
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${apen ? "rotate-180" : ""}`}
        />
      </button>

      {apen && (
        <div className="px-4 py-4 border-t border-slate-200 space-y-4">
          <p className="text-xs text-slate-500">
            Planlegg en samling for gruppen. Den kan være enkeltstående eller gjentas i en periode.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              {feltLabel(`samlingsplan-frekvens-${gruppeId}`, "Gjentakelse")}
              <select
                id={`samlingsplan-frekvens-${gruppeId}`}
                value={plan.Frekvens || SAMLINGSPLAN_INGEN_GJENTAKELSE}
                onChange={(e) => oppdater("Frekvens", e.target.value)}
                className={feltKlasse}
              >
                {SAMLINGSPLAN_FREKVENS.map((valg) => (
                  <option key={valg} value={valg}>
                    {valg}
                  </option>
                ))}
              </select>
            </div>
            {gjentas ? (
              <div>
                {feltLabel(`samlingsplan-ukedag-${gruppeId}`, "Ukedag")}
                <select
                  id={`samlingsplan-ukedag-${gruppeId}`}
                  value={plan.Ukedag || ""}
                  onChange={(e) => oppdater("Ukedag", e.target.value)}
                  className={feltKlasse}
                >
                  {SAMLINGSPLAN_UKEDAGER.map((dag) => (
                    <option key={dag} value={dag}>
                      {dag}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div>
              {feltLabel(`samlingsplan-startdato-${gruppeId}`, "Dato")}
              <input
                id={`samlingsplan-startdato-${gruppeId}`}
                type="date"
                value={plan.Startdato || ""}
                onChange={(e) => oppdater("Startdato", e.target.value)}
                className={feltKlasse}
              />
            </div>
            {gjentas ? (
              <div>
                {feltLabel(`samlingsplan-sluttdato-${gruppeId}`, "Sluttdato")}
                <input
                  id={`samlingsplan-sluttdato-${gruppeId}`}
                  type="date"
                  value={plan.Sluttdato || ""}
                  onChange={(e) => oppdater("Sluttdato", e.target.value)}
                  className={feltKlasse}
                />
              </div>
            ) : null}
            <div>
              {feltLabel(`samlingsplan-klokkeslett-${gruppeId}`, "Klokkeslett")}
              <input
                id={`samlingsplan-klokkeslett-${gruppeId}`}
                type="time"
                value={plan.Klokkeslett || ""}
                onChange={(e) => oppdater("Klokkeslett", e.target.value)}
                className={feltKlasse}
              />
            </div>
            <div>
              {feltLabel(`samlingsplan-sluttid-${gruppeId}`, "Sluttid")}
              <input
                id={`samlingsplan-sluttid-${gruppeId}`}
                type="time"
                value={plan.Sluttid || ""}
                onChange={(e) => oppdater("Sluttid", e.target.value)}
                className={feltKlasse}
              />
            </div>
          </div>
          {plan.SistGenerert ? (
            <p className="text-[11px] text-slate-500">
              Sist opprettet i kalenderen:{" "}
              {new Date(`${plan.SistGenerert}T12:00:00`).toLocaleDateString("nb-NO")}
            </p>
          ) : null}
          {status ? (
            <p
              className={`text-xs ${
                status.includes("opprettet") || status.includes("lagret")
                  ? "text-[#2d5a3f]"
                  : "text-rose-700"
              }`}
            >
              {status}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={lagre}
              className="px-4 py-2 text-xs font-semibold text-[#2d5a3f] bg-[#eef5f1] hover:bg-[#dceee3] border border-[#d2e8d9] rounded-xl cursor-pointer"
            >
              Lagre plan
            </button>
            <button
              type="button"
              onClick={opprettHendelser}
              className="px-4 py-2 text-xs font-semibold bg-[#2d5a3f] hover:bg-[#234731] text-white rounded-xl cursor-pointer"
            >
              Opprett i kalenderen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
