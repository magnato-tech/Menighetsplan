import React, { useEffect, useState } from "react";
import type { Arrangement, DatabaseState } from "../types/database";
import {
  byggVarselForMelding,
  byggVarselForSamling,
  formatertArrangementDato,
  hentInnstillinger,
  loggManuelleVarsler,
  medlemmerForGruppe,
  oppdaterArrangementBeskrivelse,
  opprettGruppeMelding,
  sisteMeldingerForGruppe,
  type VarselKanal,
} from "../services/dataService";
import { VarselKnapper } from "./VarselKnapper";

interface SamlingMeldingPanelProps {
  db: DatabaseState;
  gruppeId: string;
  gruppenavn: string;
  arrangement: Arrangement;
  opprettetAvPersonId: string;
  onUpdateDb: (db: DatabaseState) => void;
}

export const SamlingMeldingPanel: React.FC<SamlingMeldingPanelProps> = ({
  db,
  gruppeId,
  gruppenavn,
  arrangement,
  opprettetAvPersonId,
  onUpdateDb,
}) => {
  const [detaljer, setDetaljer] = useState(arrangement.Beskrivelse || "");
  const [nyMelding, setNyMelding] = useState("");
  const [sisteVarselUtkast, setSisteVarselUtkast] = useState<ReturnType<typeof byggVarselForMelding>>([]);
  const [samlingVarselUtkast, setSamlingVarselUtkast] = useState<ReturnType<typeof byggVarselForSamling>>([]);

  useEffect(() => {
    setDetaljer(arrangement.Beskrivelse || "");
  }, [arrangement.ArrangementID, arrangement.Beskrivelse]);

  const meldinger = sisteMeldingerForGruppe(db, gruppeId, 3).filter(
    (m) => m.ArrangementID === arrangement.ArrangementID
  );
  const medlemmer = medlemmerForGruppe(db, gruppeId);
  const innstillinger = hentInnstillinger(db);

  const lagreDetaljer = () => {
    onUpdateDb(oppdaterArrangementBeskrivelse(db, arrangement.ArrangementID, detaljer));
  };

  const publiserMelding = () => {
    const tekst = nyMelding.trim();
    if (!tekst) return;
    let neste = opprettGruppeMelding(db, {
      gruppeId,
      tekst,
      opprettetAvPersonId,
      arrangementId: arrangement.ArrangementID,
    });
    const melding = (neste.gruppeMeldinger || []).at(-1);
    if (!melding) return;
    const utkast = byggVarselForMelding(neste, melding, medlemmer);
    setSisteVarselUtkast(utkast);
    setNyMelding("");
    onUpdateDb(neste);
  };

  const forberedSamlingVarsel = () => {
    setSamlingVarselUtkast(byggVarselForSamling(db, gruppeId, arrangement, medlemmer));
  };

  const etterVarsel = (kanal: VarselKanal) => {
    const utkast = sisteVarselUtkast.length > 0 ? sisteVarselUtkast : samlingVarselUtkast;
    if (utkast.length === 0) return;
    onUpdateDb(loggManuelleVarsler(db, utkast, kanal));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900">
          {formatertArrangementDato(arrangement.Dato, arrangement.Tid)}
        </h3>
        {arrangement.Sted ? (
          <p className="text-xs text-slate-500 mt-0.5">{arrangement.Sted}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-600">Detaljer til medlemmer</label>
        <textarea
          value={detaljer}
          onChange={(e) => setDetaljer(e.target.value)}
          onBlur={lagreDetaljer}
          rows={3}
          placeholder="Adresse, hva de skal ta med, parkering …"
          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-[#2d5a3f] focus:outline-hidden"
        />
        <p className="text-[11px] text-slate-500">Vises på Min side under kommende samlinger.</p>
      </div>

      {meldinger.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600">Siste meldinger</p>
          <ul className="space-y-2">
            {meldinger.map((m) => (
              <li key={m.GruppeMeldingID} className="text-sm text-slate-800 bg-slate-50 rounded-xl px-3 py-2">
                <span className="text-[10px] text-slate-400 block mb-0.5">{m.OpprettetDato}</span>
                {m.Tekst}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-600">Ny melding til {gruppenavn}</label>
        <textarea
          value={nyMelding}
          onChange={(e) => setNyMelding(e.target.value)}
          rows={3}
          placeholder="F.eks. vi starter med mat — ta med noe å dele"
          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-[#2d5a3f] focus:outline-hidden"
        />
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={publiserMelding}
            disabled={!nyMelding.trim()}
            className="min-h-10 px-3 text-sm font-semibold text-white bg-[#2d5a3f] hover:bg-[#234731] rounded-xl cursor-pointer disabled:opacity-40"
          >
            Lagre melding
          </button>
          <button
            type="button"
            onClick={forberedSamlingVarsel}
            className="min-h-10 px-3 text-sm font-semibold text-[#2d5a3f] bg-[#eef5f1] border border-[#d2e8d9] rounded-xl cursor-pointer"
          >
            Varsle om samling
          </button>
        </div>
      </div>

      {sisteVarselUtkast.length > 0 ? (
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-600">Melding lagret. Send varsel med lenke til Min side:</p>
          <VarselKnapper
            utkast={sisteVarselUtkast}
            onVarslet={etterVarsel}
            visSms={innstillinger.visVarselSms}
            visEpost={innstillinger.visVarselEpost}
          />
        </div>
      ) : null}

      {samlingVarselUtkast.length > 0 && sisteVarselUtkast.length === 0 ? (
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-600">Send påminnelse om samlingen:</p>
          <VarselKnapper
            utkast={samlingVarselUtkast}
            onVarslet={etterVarsel}
            visSms={innstillinger.visVarselSms}
            visEpost={innstillinger.visVarselEpost}
          />
        </div>
      ) : null}
    </div>
  );
};
