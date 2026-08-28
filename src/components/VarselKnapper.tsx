import React, { useState } from "react";
import { Check, Copy, Mail, MessageSquare } from "lucide-react";
import type { VarselKanal, VarselUtkast } from "../services/dataService";
import {
  kanSendeEpost,
  kanSendeSms,
  sendVarselManuelt,
  sendVarselManueltGruppe,
} from "../services/dataService";

interface VarselKnapperProps {
  utkast: VarselUtkast[];
  /** Én mottaker: vis SMS per person. Flere: gruppe-epost / kopier alle. */
  modus?: "enkel" | "gruppe";
  onVarslet?: (kanal: VarselKanal) => void;
  kompakt?: boolean;
  visSms?: boolean;
  visEpost?: boolean;
}

export const VarselKnapper: React.FC<VarselKnapperProps> = ({
  utkast,
  modus = "gruppe",
  onVarslet,
  kompakt = false,
  visSms = true,
  visEpost = true,
}) => {
  const [kopiert, setKopiert] = useState(false);

  if (utkast.length === 0) return null;

  const enkelt = modus === "enkel" ? utkast[0] : null;
  const harSms =
    visSms &&
    (modus === "enkel" ? kanSendeSms(enkelt?.telefon) : utkast.some((u) => kanSendeSms(u.telefon)));
  const harEpost =
    visEpost &&
    (modus === "enkel"
      ? kanSendeEpost(enkelt?.epost)
      : utkast.some((u) => kanSendeEpost(u.epost)));

  const kopier = async () => {
    const resultat =
      modus === "enkel" && enkelt
        ? sendVarselManuelt(enkelt, "kopier")
        : sendVarselManueltGruppe(utkast, "kopier");
    await navigator.clipboard.writeText(resultat.tekstTilKopiering);
    setKopiert(true);
    setTimeout(() => setKopiert(false), 2500);
    onVarslet?.("kopier");
  };

  const apneSms = () => {
    if (modus === "enkel" && enkelt) {
      const { href } = sendVarselManuelt(enkelt, "sms");
      if (href) window.location.href = href;
      onVarslet?.("sms");
      return;
    }
    const medTelefon = utkast.find((u) => kanSendeSms(u.telefon));
    if (!medTelefon) return;
    const { href } = sendVarselManuelt(medTelefon, "sms");
    if (href) window.location.href = href;
    onVarslet?.("sms");
  };

  const apneEpost = () => {
    const resultat =
      modus === "enkel" && enkelt
        ? sendVarselManuelt(enkelt, "epost")
        : sendVarselManueltGruppe(utkast, "epost");
    if (resultat.href) window.location.href = resultat.href;
    onVarslet?.("epost");
  };

  const knappKlasse = kompakt
    ? "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg cursor-pointer"
    : "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl cursor-pointer";

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={kopier}
        className={`${knappKlasse} text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200`}
      >
        {kopiert ? <Check className="w-3.5 h-3.5 text-[#2d5a3f]" /> : <Copy className="w-3.5 h-3.5" />}
        {kopiert ? "Kopiert" : "Kopier varsel"}
      </button>
      {harSms ? (
        <button
          type="button"
          onClick={apneSms}
          className={`${knappKlasse} text-[#2d5a3f] bg-[#eef5f1] hover:bg-[#dceee3] border border-[#d2e8d9]`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          SMS
        </button>
      ) : null}
      {harEpost ? (
        <button
          type="button"
          onClick={apneEpost}
          className={`${knappKlasse} text-[#2d5a3f] bg-[#eef5f1] hover:bg-[#dceee3] border border-[#d2e8d9]`}
        >
          <Mail className="w-3.5 h-3.5" />
          {modus === "gruppe" ? `E-post (${utkast.filter((u) => kanSendeEpost(u.epost)).length})` : "E-post"}
        </button>
      ) : null}
    </div>
  );
};
