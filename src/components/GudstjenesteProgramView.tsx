import React, { useState } from "react";
import { FileDown, RotateCcw, Upload } from "lucide-react";
import { Gudstjeneste } from "../types/database";
import {
  DatabaseState,
  avpubliserProgram,
  beregnProgramtider,
  erProgramPublisert,
  hentAnsvarForBrikke,
  hentPrograminstans,
  nyProgramAktivitet,
  omskrivProgramRekkefolge,
  opprettProgramFraMal,
  programForGudstjeneste,
  publiserProgram,
  saveDatabase,
  sortertMalaktiviteter,
  tilbakestillProgramFraMal,
} from "../services/dataService";
import { ProgramKjoreplan } from "./ProgramKjoreplan";
import { ProgramBrikkeFelt } from "./ProgramBrikke";
import { ProgramLeserModal } from "./ProgramLeserModal";

interface GudstjenesteProgramViewProps {
  db: DatabaseState;
  gudstjeneste: Gudstjeneste;
  redigerbar: boolean;
  uthevPersonId?: string;
  selectedPersonId?: string;
  iDialog?: boolean;
  onUpdateDb: (updatedDb: DatabaseState) => void;
}

function formatDato(dato: string): string {
  const parsed = new Date(`${dato}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dato;
  return parsed.toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export const GudstjenesteProgramView: React.FC<GudstjenesteProgramViewProps> = ({
  db,
  gudstjeneste,
  redigerbar,
  uthevPersonId,
  selectedPersonId,
  iDialog,
  onUpdateDb,
}) => {
  const [visLeser, setVisLeser] = useState(false);
  const linjer = programForGudstjeneste(db, gudstjeneste.GudstjenesteID);
  const medTid = beregnProgramtider(linjer, gudstjeneste.Tid || "11:00");
  const sluttid = medTid.length > 0 ? medTid[medTid.length - 1].slutt : gudstjeneste.Tid;
  const malTom = sortertMalaktiviteter(db).length === 0;
  const instans = hentPrograminstans(db, gudstjeneste.GudstjenesteID);
  const publisert = erProgramPublisert(db, gudstjeneste.GudstjenesteID);

  const persister = (updated: DatabaseState) => {
    saveDatabase(updated);
    onUpdateDb(updated);
  };

  const oppdaterLinjer = (neste: typeof linjer) => {
    const resten = db.programaktiviteter.filter(
      (p) => p.GudstjenesteID !== gudstjeneste.GudstjenesteID
    );
    persister({
      ...db,
      programaktiviteter: [...resten, ...omskrivProgramRekkefolge(neste)],
    });
  };

  if (linjer.length === 0) {
    return (
      <div className="px-4 py-6 text-center space-y-3">
        <p className="text-sm text-slate-600">
          Ingen kjøreplan for denne gudstjenesten ennå.
        </p>
        {redigerbar && (
          <button
            type="button"
            disabled={malTom}
            onClick={() => persister(opprettProgramFraMal(db, gudstjeneste.GudstjenesteID))}
            className="px-3.5 py-2 bg-[#2d5a3f] hover:bg-[#234731] disabled:opacity-50 text-white text-xs font-semibold rounded-xl cursor-pointer"
          >
            Opprett program fra mal
          </button>
        )}
        {malTom && redigerbar && (
          <p className="text-xs text-slate-500">Admin må først lage en programmal.</p>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Kjøreplan
            </p>
            {instans && (
              <span
                className={`text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ${
                  publisert
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-amber-50 text-amber-800"
                }`}
              >
                {publisert ? "Publisert" : "Utkast"}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-[#2d5a3f]">{formatDato(gudstjeneste.Dato)}</span>
            {gudstjeneste.Tid ? ` · ${gudstjeneste.Tid}` : ""}
            {sluttid ? `–${sluttid}` : ""}
            {gudstjeneste.Sted ? ` · ${gudstjeneste.Sted}` : ""}
          </p>
          {gudstjeneste.Tema && (
            <p className="text-sm font-bold text-slate-900">{gudstjeneste.Tema}</p>
          )}
          {gudstjeneste.Bibeltekst && (
            <p className="text-xs italic text-slate-600 mt-0.5">{gudstjeneste.Bibeltekst}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {redigerbar && selectedPersonId && (
            <>
              {publisert ? (
                <button
                  type="button"
                  onClick={() => persister(avpubliserProgram(db, gudstjeneste.GudstjenesteID))}
                  className="text-xs font-semibold text-amber-800 hover:text-amber-950 cursor-pointer"
                >
                  Avpubliser
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    persister(publiserProgram(db, gudstjeneste.GudstjenesteID, selectedPersonId))
                  }
                  className="px-2.5 py-1 bg-[#2d5a3f] hover:bg-[#234731] text-white text-xs font-semibold rounded-lg cursor-pointer inline-flex items-center gap-1"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Publiser
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm("Erstatte denne kjøreplanen med standardmalen?")) return;
                  persister(tilbakestillProgramFraMal(db, gudstjeneste.GudstjenesteID));
                }}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Tilbakestill fra mal
              </button>
            </>
          )}
          {redigerbar && !iDialog && (
          <button
            type="button"
            onClick={() => setVisLeser(true)}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" />
            Forhåndsvis / last ned PDF
          </button>
          )}
        </div>
      </div>

      <ProgramKjoreplan
        linjer={medTid.map((p) => {
          const ansvar = hentAnsvarForBrikke(db, gudstjeneste.GudstjenesteID, p.RolleID);
          const uthevet = Boolean(
            uthevPersonId && ansvar.personer.some((pers) => pers.personId === uthevPersonId)
          );
          return {
            id: p.ProgramAktivitetID,
            tittel: p.Tittel,
            varighetMin: p.VarighetMin,
            rolleId: p.RolleID || "",
            forStart: Boolean(p.ForStart),
            merknad: p.Merknad,
            start: p.start,
            slutt: p.slutt,
            rolleNavn: ansvar.rolle?.Rollenavn,
            gruppeNavn: ansvar.gruppe?.Gruppenavn,
            personer: ansvar.personer,
            uthevet,
            innkomstHint: uthevet && p.start ? `kom inn kl. ${p.start}` : undefined,
          };
        })}
        roller={db.roller}
        redigerbar={redigerbar}
        visKlokkeslett
        onChangeLinje={(id, patch: Partial<ProgramBrikkeFelt>) => {
          oppdaterLinjer(
            linjer.map((p) =>
              p.ProgramAktivitetID === id
                ? {
                    ...p,
                    Tittel: patch.tittel ?? p.Tittel,
                    VarighetMin: patch.varighetMin ?? p.VarighetMin,
                    RolleID: patch.rolleId !== undefined ? patch.rolleId : p.RolleID,
                    ForStart: patch.forStart ?? p.ForStart,
                    Merknad: patch.merknad ?? p.Merknad,
                  }
                : p
            )
          );
        }}
        onDeleteLinje={(id) => oppdaterLinjer(linjer.filter((p) => p.ProgramAktivitetID !== id))}
        onMove={(from, to) => {
          const neste = [...linjer];
          const [item] = neste.splice(from, 1);
          neste.splice(to, 0, item);
          oppdaterLinjer(neste);
        }}
        onNyAktivitet={
          redigerbar
            ? () =>
                oppdaterLinjer([
                  ...linjer,
                  nyProgramAktivitet(db.programaktiviteter, gudstjeneste.GudstjenesteID),
                ])
            : undefined
        }
      />

      {visLeser && !iDialog && (
        <ProgramLeserModal
          db={db}
          gudstjeneste={gudstjeneste}
          uthevPersonId={uthevPersonId}
          onClose={() => setVisLeser(false)}
          onUpdateDb={onUpdateDb}
        />
      )}
    </div>
  );
};
