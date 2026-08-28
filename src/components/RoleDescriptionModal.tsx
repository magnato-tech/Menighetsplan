import React, { useEffect, useState } from "react";
import { Rolle, Rollebeskrivelse, Gruppe } from "../types/database";
import { RolleIkon } from "./RolleIkon";
import { AlertTriangle, Clock, Pencil, Users, X } from "lucide-react";
import { IkonHandling } from "./IkonHandling";
import { getMaksAntall } from "../services/dataService";

interface RoleDescriptionModalProps {
  rolle: Rolle | null;
  rollebeskrivelse: Rollebeskrivelse | null;
  gruppe: Gruppe | null;
  onClose: () => void;
  editable?: boolean;
  grupper?: Gruppe[];
  antallKvalifiserte?: number;
  onUpdateRolle?: (patch: {
    Rollenavn?: string;
    Beskrivelse?: string;
    GruppeID?: string;
    Behov?: number;
    MaksAntall?: number | null;
    Aktiv?: boolean;
  }) => void;
  onSaveInstruks?: (tekst: string) => void;
}

const FORKORTELSER = new Set([
  "kl",
  "ca",
  "f.eks",
  "bl.a",
  "m.m",
  "t.d",
  "osv",
  "evt",
]);

/** Del instruks-tekst i lesbare punkter uten å kreve ny tabell. */
export function splittInstruks(tekst: string): string[] {
  const raw = String(tekst || "").replace(/\r\n/g, "\n").trim();
  if (!raw) return [];

  const linjer = raw
    .split(/\n+/)
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-•*])\s*/, "").trim())
    .filter(Boolean);
  if (linjer.length > 1) return linjer;

  const enLinje = linjer[0] || raw;
  if (enLinje.includes(";")) {
    const deler = enLinje
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    if (deler.length > 1) return deler;
  }

  const setninger: string[] = [];
  let buf = "";
  const parts = enLinje.split(/(\.\s+)/);
  for (let i = 0; i < parts.length; i++) {
    buf += parts[i];
    if (!/^\.\s+$/.test(parts[i])) continue;
    const forrigeOrd = buf.replace(/\.\s+$/, "").split(/\s+/).pop() || "";
    const neste = (parts[i + 1] || "").trim();
    const nesteStart = neste.charAt(0);
    if (
      neste &&
      /[A-ZÆØÅ]/.test(nesteStart) &&
      !FORKORTELSER.has(forrigeOrd.replace(/\.$/, "").toLowerCase())
    ) {
      setninger.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) setninger.push(buf.trim());
  return setninger.length > 1 ? setninger : [enLinje];
}

export function oppsummerInstruks(tekst: string, maks = 140): string {
  const første = (splittInstruks(tekst)[0] || tekst || "").trim();
  if (!første) return "";
  if (første.length <= maks) return første;
  return `${første.slice(0, maks).replace(/\s+\S*$/, "")}…`;
}

/** Én setning til instruks-knapp på Min side — resten i modal. */
export function forsteInstruksSetning(tekst: string): string {
  const førsteBlokk = (splittInstruks(tekst)[0] || String(tekst || "")).trim();
  if (!førsteBlokk) return "";
  const førstePunkt = førsteBlokk.split(/\s*•\s*/)[0]?.trim() || førsteBlokk;
  const setning = førstePunkt.match(/^[^.!?]+[.!?]/)?.[0]?.trim();
  return setning || førstePunkt;
}

export const RoleDescriptionModal: React.FC<RoleDescriptionModalProps> = ({
  rolle,
  rollebeskrivelse,
  gruppe,
  onClose,
  editable = false,
  grupper = [],
  antallKvalifiserte,
  onUpdateRolle,
  onSaveInstruks,
}) => {
  const gjeldendeTekst = rollebeskrivelse?.Rollebeskrivelse || "";
  const [redigererInstruks, setRedigererInstruks] = useState(false);
  const [utkastInstruks, setUtkastInstruks] = useState(gjeldendeTekst);
  const [visBekreftInstruks, setVisBekreftInstruks] = useState(false);
  const [utkastNavn, setUtkastNavn] = useState(rolle?.Rollenavn || "");
  const [utkastBeskrivelse, setUtkastBeskrivelse] = useState(rolle?.Beskrivelse || "");

  useEffect(() => {
    setRedigererInstruks(false);
    setUtkastInstruks(gjeldendeTekst);
    setVisBekreftInstruks(false);
    setUtkastNavn(rolle?.Rollenavn || "");
    setUtkastBeskrivelse(rolle?.Beskrivelse || "");
  }, [rolle?.RolleID, gjeldendeTekst, rolle?.Rollenavn, rolle?.Beskrivelse]);

  if (!rolle) return null;

  const punkter = splittInstruks(gjeldendeTekst);

  const avbrytInstruks = () => {
    setUtkastInstruks(gjeldendeTekst);
    setRedigererInstruks(false);
    setVisBekreftInstruks(false);
  };

  const bekreftLagreInstruks = () => {
    onSaveInstruks?.(utkastInstruks.trim());
    setRedigererInstruks(false);
    setVisBekreftInstruks(false);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-3">
            <RolleIkon rollenavn={rolle.Rollenavn} className="w-11 h-11" />
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#2d5a3f]">
                Rolle
              </span>
              {editable && onUpdateRolle ? (
                <input
                  type="text"
                  value={utkastNavn}
                  onChange={(e) => setUtkastNavn(e.target.value)}
                  onBlur={() => {
                    const navn = utkastNavn.trim();
                    if (!navn || navn === rolle.Rollenavn) {
                      setUtkastNavn(rolle.Rollenavn);
                      return;
                    }
                    onUpdateRolle({ Rollenavn: navn });
                  }}
                  className="block w-full text-xl font-bold text-slate-900 border border-slate-200 rounded-lg px-2 py-1 mt-0.5 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
                  aria-label="Rollenavn"
                />
              ) : (
                <h2 className="text-xl font-bold text-slate-900">{rolle.Rollenavn}</h2>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              <span>Tjenestegruppe</span>
            </div>
            {editable && onUpdateRolle ? (
              <select
                value={rolle.GruppeID || ""}
                onChange={(e) => onUpdateRolle({ GruppeID: e.target.value })}
                className="w-full text-sm font-semibold text-slate-900 border border-slate-200 rounded-lg p-1.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
              >
                <option value="">Ingen</option>
                {grupper
                  .filter((g) => g.Aktiv)
                  .slice()
                  .sort((a, b) => a.Gruppenavn.localeCompare(b.Gruppenavn, "nb"))
                  .map((g) => (
                    <option key={g.GruppeID} value={g.GruppeID}>
                      {g.Gruppenavn}
                    </option>
                  ))}
              </select>
            ) : (
              <div className="font-semibold text-slate-900 text-sm">
                {gruppe ? gruppe.Gruppenavn : "Ikke spesifisert"}
              </div>
            )}
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Standard behov</span>
            </div>
            {editable && onUpdateRolle ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={rolle.Behov}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n) || n < 1) return;
                    onUpdateRolle({ Behov: Math.round(n) });
                  }}
                  className="w-20 text-sm font-semibold text-slate-900 border border-slate-200 rounded-lg p-1.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
                />
                <span className="text-xs text-slate-500">
                  {rolle.Behov === 1 ? "person" : "personer"}
                </span>
              </div>
            ) : (
              <div className="font-semibold text-slate-900 text-sm">
                {rolle.Behov} {rolle.Behov === 1 ? "person" : "personer"}
              </div>
            )}
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
              <Users className="w-3.5 h-3.5 text-[#2d5a3f]" />
              <span>Maks antall</span>
            </div>
            {editable && onUpdateRolle ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={20}
                    placeholder="∞"
                    value={
                      rolle.MaksAntall === undefined || rolle.MaksAntall === null
                        ? getMaksAntall(rolle) ?? ""
                        : rolle.MaksAntall === 0
                        ? ""
                        : rolle.MaksAntall
                    }
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      if (raw === "") {
                        onUpdateRolle({ MaksAntall: 0 });
                        return;
                      }
                      const n = Number(raw);
                      if (!Number.isFinite(n) || n < 0) return;
                      onUpdateRolle({ MaksAntall: Math.round(n) });
                    }}
                    className="w-20 text-sm font-semibold text-slate-900 border border-slate-200 rounded-lg p-1.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
                  />
                  <span className="text-xs text-slate-500">
                    {getMaksAntall(rolle) == null
                      ? "ubegrenset (overbooking OK)"
                      : getMaksAntall(rolle) === 1
                      ? "person (hard grense)"
                      : "personer (hard grense)"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Tomt felt = ubegrenset. Sett 1 for roller som taler, møteleder, lyd og bilde.
                </p>
              </div>
            ) : (
              <div className="font-semibold text-slate-900 text-sm">
                {getMaksAntall(rolle) == null
                  ? "Ubegrenset"
                  : `${getMaksAntall(rolle)} ${
                      getMaksAntall(rolle) === 1 ? "person" : "personer"
                    }`}
              </div>
            )}
          </div>
        </div>

        {typeof antallKvalifiserte === "number" && (
          <p className="text-xs text-slate-500 mb-4">
            {antallKvalifiserte} {antallKvalifiserte === 1 ? "person" : "personer"} har denne
            rollen.
          </p>
        )}

        {editable && onUpdateRolle && (
          <label className="flex items-center gap-2 mb-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={rolle.Aktiv}
              onChange={(e) => onUpdateRolle({ Aktiv: e.target.checked })}
              className="rounded border-slate-300"
            />
            Aktiv (vises i påmelding og bemanning når den hører til en tjenestegruppe)
          </label>
        )}

        {editable && onUpdateRolle ? (
          <label className="block mb-4">
            <span className="text-xs font-semibold text-slate-500">Kort beskrivelse</span>
            <textarea
              value={utkastBeskrivelse}
              onChange={(e) => setUtkastBeskrivelse(e.target.value)}
              onBlur={() => {
                if (utkastBeskrivelse.trim() === (rolle.Beskrivelse || "").trim()) return;
                onUpdateRolle({ Beskrivelse: utkastBeskrivelse.trim() });
              }}
              rows={2}
              className="mt-1 w-full text-sm text-slate-700 border border-slate-200 rounded-xl p-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
            />
          </label>
        ) : (
          rolle.Beskrivelse && (
            <p className="text-sm text-slate-600 leading-relaxed mb-4">{rolle.Beskrivelse}</p>
          )
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Instruks
            </h3>
            {editable && onSaveInstruks && !redigererInstruks && (
              <IkonHandling
                label="Rediger instruks"
                Icon={Pencil}
                onClick={() => setRedigererInstruks(true)}
              />
            )}
          </div>

          {redigererInstruks ? (
            <div className="space-y-3">
              <textarea
                value={utkastInstruks}
                onChange={(e) => setUtkastInstruks(e.target.value)}
                rows={8}
                className="w-full text-sm text-slate-800 border border-slate-200 rounded-xl p-3 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f] resize-y"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={avbrytInstruks}
                  className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  onClick={() => setVisBekreftInstruks(true)}
                  disabled={utkastInstruks.trim() === gjeldendeTekst.trim()}
                  className="px-3 py-1.5 text-sm font-semibold bg-[#2d5a3f] hover:bg-[#234731] disabled:opacity-50 text-white rounded-lg cursor-pointer"
                >
                  Lagre instruks
                </button>
              </div>
            </div>
          ) : punkter.length > 0 ? (
            <ol className="space-y-3">
              {punkter.map((punkt, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-sky-50 text-sky-700 text-xs font-bold flex items-center justify-center shrink-0 border border-sky-100">
                    {i + 1}
                  </span>
                  <span className="text-sm text-slate-800 leading-relaxed pt-0.5">
                    {punkt.replace(/\.$/, "")}.
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-500">
              Ingen utvidet instruks er registrert for denne rollen ennå.
            </p>
          )}
        </div>

        {!editable && (
          <div className="flex justify-end pt-4 mt-5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg cursor-pointer"
            >
              Lukk
            </button>
          </div>
        )}
      </div>

      {visBekreftInstruks && (
        <div
          className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[60]"
          onClick={(e) => {
            e.stopPropagation();
            setVisBekreftInstruks(false);
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Endre instruks?</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Ønsker du virkelig å endre instruksen. Dette blir da endret for alle som har
                  denne rollen.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVisBekreftInstruks(false)}
                className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={bekreftLagreInstruks}
                className="px-3 py-1.5 text-sm font-semibold bg-[#2d5a3f] hover:bg-[#234731] text-white rounded-lg cursor-pointer"
              >
                Ja, lagre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
