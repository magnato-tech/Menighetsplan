import React, { useState } from "react";
import { CalendarPlus, Copy } from "lucide-react";
import {
  DatabaseState,
  googleKalenderAbonnerUrl,
  minIcalOffentligUrl,
} from "../services/dataService";

interface KalenderAbonnerProps {
  db: DatabaseState;
  personId: string;
}

export const KalenderAbonner: React.FC<KalenderAbonnerProps> = ({ db, personId }) => {
  const person = db.personer.find((p) => p.PersonID === personId);
  const icsUrl = minIcalOffentligUrl(String(person?.SikkerhetsToken || "").trim());
  const googleUrl = googleKalenderAbonnerUrl(icsUrl);
  const [kopiert, setKopiert] = useState(false);

  if (!googleUrl) return null;

  const kopier = async () => {
    try {
      await navigator.clipboard.writeText(icsUrl);
      setKopiert(true);
      window.setTimeout(() => setKopiert(false), 2000);
    } catch {
      setKopiert(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-0.5">
      <a
        href={googleUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Abonner i Google Kalender"
        className="min-h-11 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl inline-flex items-center gap-1.5"
      >
        <CalendarPlus className="w-3.5 h-3.5" />
        Abonner
      </a>
      <button
        type="button"
        onClick={() => void kopier()}
        title="Kopier kalenderlenke. Hvis Google sier «sjekk nettadressen»: Innstillinger → Legg til kalender → Fra URL, og lim inn."
        className="min-h-11 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl inline-flex items-center gap-1.5"
      >
        <Copy className="w-3.5 h-3.5" />
        {kopiert ? "Kopiert" : "Kopier lenke"}
      </button>
    </span>
  );
};
