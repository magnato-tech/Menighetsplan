import React, { useState } from "react";
import {
  DatabaseState,
  fornySikkerhetsToken,
  genererPersonligLenke,
  hentTilgang,
  saveDatabase,
} from "../services/dataService";
import { lagreMagiskToken } from "../services/innlogging";
import { Copy, KeyRound, RefreshCw } from "lucide-react";

const LIVE_APP_URL_KEY = "gudstjenesteplanlegger_live_app_url";

function lesLiveAppUrl(): string {
  try {
    return localStorage.getItem(LIVE_APP_URL_KEY) || "";
  } catch {
    return "";
  }
}

function byggLenke(personId: string, db: DatabaseState, liveAppUrl: string): string {
  const tokenPerson = db.personer.find((p) => p.PersonID === personId);
  const token = String(tokenPerson?.SikkerhetsToken || "").trim();
  const base = liveAppUrl.trim().replace(/\/+$/, "").split("?")[0];
  if (base && token) return `${base}?t=${encodeURIComponent(token)}`;
  return genererPersonligLenke(personId, db);
}

interface PersonlenkeInnstillingerProps {
  db: DatabaseState;
  personId: string;
  onUpdateDb: (updatedDb: DatabaseState) => void;
}

export const PersonlenkeInnstillinger: React.FC<PersonlenkeInnstillingerProps> = ({
  db,
  personId,
  onUpdateDb,
}) => {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [liveAppUrl, setLiveAppUrl] = useState(lesLiveAppUrl);
  const person = db.personer.find((p) => p.PersonID === personId);
  const tilgang = hentTilgang(db, personId);

  const copyLink = (nextDb = db) => {
    const link = byggLenke(personId, nextDb, liveAppUrl);
    void navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleForny = () => {
    if (
      !window.confirm(
        "Lage ny personlenke? Den gamle slutter å virke med en gang. Bokmerker og SMS med den gamle lenken må byttes."
      )
    ) {
      return;
    }
    const next = fornySikkerhetsToken(db, personId);
    const nyToken = next.personer.find((p) => p.PersonID === personId)?.SikkerhetsToken;
    if (nyToken) lagreMagiskToken(nyToken);
    saveDatabase(next);
    onUpdateDb(next);
    copyLink(next);
    setStatus("Ny lenke er lagret og kopiert. Den gamle virker ikke lenger.");
    setTimeout(() => setStatus(null), 6000);
  };

  if (!person) return null;

  const rolle = tilgang.isAdmin
    ? "Administrator (Min side, gruppeledere og admin)"
    : tilgang.isLeader
      ? "Gruppeleder (Min side og gruppeoversikt)"
      : "Vanlig bruker (bare Min side)";

  return (
    <div className="rounded-2xl border border-[#d2e8d9] bg-[#eef5f1] p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-white border border-[#d2e8d9] text-[#2d5a3f] flex items-center justify-center shrink-0">
          <KeyRound className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900">Din personlenke</h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Én lenke per person. {person.Navn}: {rolle}.
          </p>
        </div>
      </div>
      <label className="block space-y-1">
        <span className="text-[11px] font-semibold text-slate-600">
          Live-adresse (valgfritt, brukes når du kopierer fra localhost)
        </span>
        <input
          type="url"
          value={liveAppUrl}
          onChange={(e) => {
            const v = e.target.value;
            setLiveAppUrl(v);
            try {
              localStorage.setItem(LIVE_APP_URL_KEY, v);
            } catch {
              // ignore
            }
          }}
          placeholder="https://www.menighetsplan.no"
          className="w-full px-3 py-2 rounded-xl border border-[#d2e8d9] bg-white text-xs text-slate-800"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copyLink()}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2d5a3f] hover:bg-[#234731] text-white text-xs font-semibold cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" />
          {copied ? "Kopiert" : "Kopier min lenke"}
        </button>
        <button
          type="button"
          onClick={handleForny}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Lag ny lenke
        </button>
      </div>
      {status && <p className="text-xs text-emerald-800 font-medium">{status}</p>}
      <p className="text-[11px] text-slate-500 leading-relaxed">
        Utestengt fra live-siden? Live bruker alltid Google-arket (ingen Datakilde-fane). Lokalt:
        Innstillinger, øverst: Datakilde → Ekte data. Kopier lenken her, og lim den inn mot
        live-adressen. Du kan også lese kolonnen <strong>SikkerhetsToken</strong> i arket Personer og
        åpne <span className="font-mono">?t=mk_…</span> på live-adressen.
      </p>
    </div>
  );
};
