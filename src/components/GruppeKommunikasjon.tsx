import React, { useState } from "react";
import { Copy, Mail, Check } from "lucide-react";
import type { Person } from "../types/database";
import { epostListe, mailtoGruppe, navnelisteTekst } from "../services/dataService";

interface GruppeKommunikasjonProps {
  medlemmer: Person[];
  gruppenavn?: string;
}

export const GruppeKommunikasjon: React.FC<GruppeKommunikasjonProps> = ({
  medlemmer,
  gruppenavn,
}) => {
  const [kopiert, setKopiert] = useState(false);
  const eposter = epostListe(medlemmer);
  const mailto = mailtoGruppe(medlemmer, gruppenavn ? `Melding til ${gruppenavn}` : "Melding til gruppen");

  const kopierNavneliste = () => {
    navigator.clipboard.writeText(navnelisteTekst(medlemmer)).then(() => {
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2500);
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {eposter.length > 0 ? (
        <a
          href={mailto}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2d5a3f] bg-[#eef5f1] hover:bg-[#dceee3] border border-[#d2e8d9] px-3 py-2 rounded-xl"
        >
          <Mail className="w-3.5 h-3.5" />
          E-post til alle ({eposter.length})
        </a>
      ) : (
        <span className="text-xs text-slate-500 py-2">
          Ingen e-postadresser i gruppen.
        </span>
      )}
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
  );
};
