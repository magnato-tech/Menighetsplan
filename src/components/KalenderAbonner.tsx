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

  const logAbonner = () => {
    // #region agent log
    fetch("http://127.0.0.1:7773/ingest/22f8ce1a-6ae6-4b39-94db-6128c87cda21", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "c1c83b" },
      body: JSON.stringify({
        sessionId: "c1c83b",
        hypothesisId: "E",
        location: "KalenderAbonner.tsx",
        message: "Abonner clicked",
        data: { icsUrl, googleUrlLen: googleUrl.length },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  };

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
        onClick={logAbonner}
        title="Abonner i Google Kalender"
        className="min-h-11 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl inline-flex items-center gap-1.5"
      >
        <CalendarPlus className="w-3.5 h-3.5" />
        Abonner
      </a>
      <button
        type="button"
        onClick={() => void kopier()}
        title="Kopier https-lenken. Hvis Abonner gir tom kalender: Innstillinger → Legg til kalender → Fra URL, og lim inn."
        className="min-h-11 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl inline-flex items-center gap-1.5"
      >
        <Copy className="w-3.5 h-3.5" />
        {kopiert ? "Kopiert" : "Kopier lenke"}
      </button>
    </span>
  );
};
