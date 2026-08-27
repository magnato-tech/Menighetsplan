import React from "react";
import { CalendarPlus } from "lucide-react";
import {
  DatabaseState,
  getCustomScriptUrl,
  googleKalenderAbonnerUrl,
  minIcalHttpsUrl,
} from "../services/dataService";

interface KalenderAbonnerProps {
  db: DatabaseState;
  personId: string;
}

export const KalenderAbonner: React.FC<KalenderAbonnerProps> = ({ db, personId }) => {
  const person = db.personer.find((p) => p.PersonID === personId);
  const icsUrl = minIcalHttpsUrl(getCustomScriptUrl(), String(person?.SikkerhetsToken || "").trim());
  const googleUrl = googleKalenderAbonnerUrl(icsUrl);

  if (!googleUrl) return null;

  return (
    <a
      href={googleUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="Åpner Google Kalender med din personlige feed"
      className="min-h-11 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl inline-flex items-center gap-1.5"
    >
      <CalendarPlus className="w-3.5 h-3.5" />
      Abonner
    </a>
  );
};
