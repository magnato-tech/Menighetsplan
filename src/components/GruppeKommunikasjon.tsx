import React, { useState } from "react";
import { Copy, Mail, Check, MessageSquare, ChevronDown, Bot } from "lucide-react";
import type { DatabaseState } from "../types/database";
import {
  byggVarselForMelding,
  epostListe,
  erForfallSystemmeldingAktivert,
  hentForfallSystemmal,
  hentInnstillinger,
  loggManuelleVarsler,
  mailtoGruppe,
  medlemmerForGruppe,
  navnelisteTekst,
  opprettGruppeMelding,
  settGruppeForfallAutoAktivert,
  sisteMeldingerForGruppe,
  type VarselKanal,
} from "../services/dataService";
import { VarselKnapper } from "./VarselKnapper";
import { GruppeMeldingRad } from "./GruppeMeldingRad";

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
  const [visAutoMeldinger, setVisAutoMeldinger] = useState(false);
  const [sisteVarselUtkast, setSisteVarselUtkast] = useState<ReturnType<typeof byggVarselForMelding>>([]);

  const medlemmer = medlemmerForGruppe(db, gruppeId);
  const eposter = epostListe(medlemmer);
  const innstillinger = hentInnstillinger(db);
  const mailto = mailtoGruppe(medlemmer, gruppenavn ? `Melding til ${gruppenavn}` : "Melding til gruppen");
  const sisteMeldinger = sisteMeldingerForGruppe(db, gruppeId, 3);
  const autoAktivert = erForfallSystemmeldingAktivert(db, gruppeId);
  const adminMal = hentForfallSystemmal(db);

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
      kilde: "gruppeleder",
      hendelseType: "manuell",
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

  const settAutoForfall = (aktivert: boolean) => {
    onUpdateDb(settGruppeForfallAutoAktivert(db, gruppeId, aktivert));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4" data-guide="meldinger">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Meldinger til gruppen
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

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setVisAutoMeldinger((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 cursor-pointer"
        >
          <span className="inline-flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-slate-500" />
            Automatiske meldinger
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${visAutoMeldinger ? "rotate-180" : ""}`}
          />
        </button>
        {visAutoMeldinger ? (
          <div className="px-3 py-3 space-y-3 border-t border-slate-200 text-sm">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={autoAktivert}
                onChange={(e) => settAutoForfall(e.target.checked)}
              />
              <span className="text-xs text-slate-700">
                Send automatisk melding til gruppen når noen melder forfall uten egen tekst
              </span>
            </label>
            <div className="text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-500">Gjeldende mal (admin)</p>
              <p className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 whitespace-pre-wrap">
                {adminMal}
              </p>
              {innstillinger.systemmeldingForfallAktivert === false ? (
                <p className="text-amber-700">Automatiske forfall-meldinger er skrudd av globalt av admin.</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {sisteMeldinger.length > 0 ? (
        <ul className="space-y-2">
          {sisteMeldinger.map((m) => (
            <li key={m.GruppeMeldingID}>
              <GruppeMeldingRad
                db={db}
                melding={{ ...m, gruppenavn: gruppenavn || "Gruppe" }}
              />
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
