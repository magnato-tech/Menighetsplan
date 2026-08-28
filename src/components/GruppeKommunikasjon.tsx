import React, { useState } from "react";
import { Copy, Mail, Check, MessageSquare } from "lucide-react";
import type { DatabaseState } from "../types/database";
import {
  byggVarselForMelding,
  epostListe,
  hentInnstillinger,
  loggManuelleVarsler,
  mailtoGruppe,
  medlemmerForGruppe,
  navnelisteTekst,
  opprettGruppeMelding,
  sisteMeldingerForGruppe,
  type VarselKanal,
} from "../services/dataService";
import { VarselKnapper } from "./VarselKnapper";

interface GruppeKommunikasjonProps {
  db: DatabaseState;
  gruppeId: string;
  gruppenavn?: string;
  opprettetAvPersonId: string;
  onUpdateDb: (db: DatabaseState) => void;
}

export const GruppeKommunikasjon: React.FC<GruppeKommunikasjonProps> = ({
  db,
  gruppeId,
  gruppenavn,
  opprettetAvPersonId,
  onUpdateDb,
}) => {
  const [kopiert, setKopiert] = useState(false);
  const [nyMelding, setNyMelding] = useState("");
  const [sisteVarselUtkast, setSisteVarselUtkast] = useState<ReturnType<typeof byggVarselForMelding>>([]);

  const medlemmer = medlemmerForGruppe(db, gruppeId);
  const eposter = epostListe(medlemmer);
  const innstillinger = hentInnstillinger(db);
  const mailto = mailtoGruppe(medlemmer, gruppenavn ? `Melding til ${gruppenavn}` : "Melding til gruppen");
  const sisteMeldinger = sisteMeldingerForGruppe(db, gruppeId, 3);

  const kopierNavneliste = () => {
    navigator.clipboard.writeText(navnelisteTekst(medlemmer)).then(() => {
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2500);
    });
  };

  const publiserMelding = () => {
    const tekst = nyMelding.trim();
    if (!tekst) return;
    let neste = opprettGruppeMelding(db, {
      gruppeId,
      tekst,
      opprettetAvPersonId,
    });
    const melding = (neste.gruppeMeldinger || []).at(-1);
    if (!melding) return;
    setSisteVarselUtkast(byggVarselForMelding(neste, melding, medlemmer));
    setNyMelding("");
    onUpdateDb(neste);
  };

  const etterVarsel = (kanal: VarselKanal) => {
    if (sisteVarselUtkast.length === 0) return;
    onUpdateDb(loggManuelleVarsler(db, sisteVarselUtkast, kanal));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Kommunikasjon
        </h3>
        <div className="flex flex-wrap gap-2">
          {innstillinger.visVarselEpost ? (
            eposter.length > 0 ? (
              <a
                href={mailto}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2d5a3f] bg-[#eef5f1] hover:bg-[#dceee3] border border-[#d2e8d9] px-3 py-2 rounded-xl"
              >
                <Mail className="w-3.5 h-3.5" />
                E-post til alle ({eposter.length})
              </a>
            ) : (
              <span className="text-xs text-slate-500 py-2">Ingen e-postadresser i gruppen.</span>
            )
          ) : null}
          <button
            type="button"
            onClick={kopierNavneliste}
            disabled={medlemmer.length === 0}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-2 rounded-xl cursor-pointer disabled:opacity-40"
          >
            {kopiert ? <Check className="w-3.5 h-3.5 text-[#2d5a3f]" /> : <Copy className="w-3.5 h-3.5" />}
            {kopiert ? "Kopiert" : "Kopier navneliste"}
          </button>
        </div>
      </div>

      {sisteMeldinger.length > 0 ? (
        <ul className="space-y-2">
          {sisteMeldinger.map((m) => (
            <li key={m.GruppeMeldingID} className="text-sm text-slate-800 bg-slate-50 rounded-xl px-3 py-2">
              <span className="text-[10px] text-slate-400 block">{m.OpprettetDato}</span>
              {m.Tekst}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
          <MessageSquare className="w-3.5 h-3.5" />
          Ny melding til gruppen
        </label>
        <textarea
          value={nyMelding}
          onChange={(e) => setNyMelding(e.target.value)}
          rows={2}
          placeholder="Skriv en melding medlemmer ser på Min side"
          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-[#2d5a3f] focus:outline-hidden"
        />
        <button
          type="button"
          onClick={publiserMelding}
          disabled={!nyMelding.trim()}
          className="min-h-10 px-3 text-sm font-semibold text-white bg-[#2d5a3f] hover:bg-[#234731] rounded-xl cursor-pointer disabled:opacity-40"
        >
          Lagre og varsle
        </button>
      </div>

      {sisteVarselUtkast.length > 0 ? (
        <VarselKnapper
          utkast={sisteVarselUtkast}
          onVarslet={etterVarsel}
          visSms={innstillinger.visVarselSms}
          visEpost={innstillinger.visVarselEpost}
        />
      ) : null}
    </div>
  );
};
