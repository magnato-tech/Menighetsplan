import React, { useState } from "react";
import { FileDown, RotateCcw, Upload } from "lucide-react";
import { Gudstjeneste } from "../types/database";
import {
  DatabaseState,
  avpubliserProgram,
  beregnProgramtider,
  erHendelseRad,
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
  sortertMalposter,
  tilbakestillProgramFraMal,
} from "../services/dataService";
import { ProgramKjoreplan } from "./ProgramKjoreplan";
import { ProgramBrikkeFelt } from "./ProgramBrikke";
import { ProgramLeserModal } from "./ProgramLeserModal";
import { GudstjenesteNotaterFelt } from "./GudstjenesteNotaterFelt";

interface GudstjenesteProgramViewProps {
  db: DatabaseState;
  gudstjeneste: Gudstjeneste;
  redigerbar: boolean;
  uthevPersonId?: string;
  selectedPersonId?: string;
  iDialog?: boolean;
  arrangementId?: string;
  hendelseEtikett?: string;
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
  arrangementId,
  hendelseEtikett = "gudstjenesten",
  onUpdateDb,
}) => {
  const [visLeser, setVisLeser] = useState(false);
  const gudId = gudstjeneste.GudstjenesteID;
  const linjer = programForGudstjeneste(db, gudId, arrangementId);
  const medTid = beregnProgramtider(linjer, gudstjeneste.Tid || "11:00");
  const sluttid = medTid.length > 0 ? medTid[medTid.length - 1].slutt : gudstjeneste.Tid;
  const arrangement = arrangementId
    ? (db.arrangementer || []).find((a) => a.ArrangementID === arrangementId)
    : undefined;
  const malLinjer = arrangement?.MalID
    ? sortertMalposter(db, arrangement.MalID)
    : sortertMalaktiviteter(db);
  const malTom = malLinjer.length === 0;
  const instans = hentPrograminstans(db, gudId, arrangementId);
  const publisert = erProgramPublisert(db, gudId, arrangementId);

  const persister = (updated: DatabaseState) => {
    saveDatabase(updated);
    onUpdateDb(updated);
  };

  const oppdaterLinjer = (neste: typeof linjer) => {
    const resten = db.programaktiviteter.filter((p) => !erHendelseRad(p, gudId, arrangementId));
    persister({
      ...db,
      programaktiviteter: [...resten, ...omskrivProgramRekkefolge(neste)],
    });
  };

  if (linjer.length === 0 && !instans) {
    return (
      <div className="px-4 py-6 text-center space-y-3">
        {redigerbar && !arrangementId && !iDialog && (
          <div className="text-left">
            <GudstjenesteNotaterFelt db={db} gudstjeneste={gudstjeneste} onUpdateDb={onUpdateDb} />
          </div>
        )}
        <p className="text-sm text-slate-600">
          Ingen kjøreplan for denne {hendelseEtikett} ennå.
        </p>
        {redigerbar && !malTom && (
          <button
            type="button"
            onClick={() => persister(opprettProgramFraMal(db, gudId, arrangementId))}
            className="px-3.5 py-2 bg-[#2d5a3f] hover:bg-[#234731] text-white text-xs font-semibold rounded-xl cursor-pointer"
          >
            Opprett program fra mal
          </button>
        )}
        {redigerbar && malTom && arrangement?.MalID && (
          <button
            type="button"
            onClick={() => persister(opprettProgramFraMal(db, gudId, arrangementId))}
            className="px-3.5 py-2 bg-[#2d5a3f] hover:bg-[#234731] text-white text-xs font-semibold rounded-xl cursor-pointer"
          >
            Opprett tom kjøreplan
          </button>
        )}
        {malTom && redigerbar && !arrangement?.MalID && (
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
                  onClick={() => persister(avpubliserProgram(db, gudId, arrangementId))}
                  className="text-xs font-semibold text-amber-800 hover:text-amber-950 cursor-pointer"
                >
                  Avpubliser
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    persister(publiserProgram(db, gudId, selectedPersonId, arrangementId))
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
                  persister(tilbakestillProgramFraMal(db, gudId, arrangementId));
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

      {redigerbar && !arrangementId && !iDialog && (
        <GudstjenesteNotaterFelt db={db} gudstjeneste={gudstjeneste} onUpdateDb={onUpdateDb} />
      )}

      <ProgramKjoreplan
        linjer={medTid.map((p) => {
          const ansvar = hentAnsvarForBrikke(db, gudId, p.RolleID, arrangementId);
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
                  nyProgramAktivitet(db.programaktiviteter, gudId, arrangementId),
                ])
            : undefined
        }
      />

      {visLeser && !iDialog && !arrangementId && (
        <ProgramLeserModal
          db={db}
          gudstjeneste={gudstjeneste}
          uthevPersonId={uthevPersonId}
          selectedPersonId={selectedPersonId}
          redigerbar={redigerbar}
          onClose={() => setVisLeser(false)}
          onUpdateDb={onUpdateDb}
        />
      )}
    </div>
  );
};
