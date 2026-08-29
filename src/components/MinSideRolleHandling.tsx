import React, { useState } from "react";
import { Check, X } from "lucide-react";
import { IkonHandling } from "./IkonHandling";

export type MinSideRolleHandlingState = {
  rollenavn: string;
  erForespurt: boolean;
  erBekreftet: boolean;
  kanMeldPa: boolean;
  erStengt: boolean;
};

type MinSideRolleHandlingProps = MinSideRolleHandlingState & {
  onMeldPa: () => void;
  onMeldForfall: (melding?: string) => void;
  onSvarForesporsel: (svar: "Bekreftet" | "Avvist", melding?: string) => void;
  /** Kun ikonknappene — dialog rendres under raden. */
  bareKnapper?: boolean;
  visFrafall?: boolean;
  onVisFrafallChange?: (vis: boolean) => void;
};

export const MinSideRolleKnapper: React.FC<
  MinSideRolleHandlingState & {
    onMeldPa: () => void;
    onMeldForfallClick: () => void;
    onSvarForesporsel: (svar: "Bekreftet" | "Avvist") => void;
  }
> = ({
  rollenavn,
  erForespurt,
  erBekreftet,
  kanMeldPa,
  erStengt,
  onMeldPa,
  onMeldForfallClick,
  onSvarForesporsel,
}) => {
  if (erStengt && !erBekreftet && !erForespurt) {
    return <span className="text-[10px] font-semibold text-slate-500">Fullt</span>;
  }

  if (erForespurt) {
    return (
      <div className="flex flex-wrap gap-1 justify-end">
        <button
          type="button"
          onClick={() => onSvarForesporsel("Bekreftet")}
          className="min-h-9 px-2.5 text-[11px] font-semibold text-white bg-[#2d5a3f] rounded-lg cursor-pointer"
        >
          Ja
        </button>
        <button
          type="button"
          onClick={() => onSvarForesporsel("Avvist")}
          className="min-h-9 px-2.5 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg cursor-pointer"
        >
          Nei
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      {(kanMeldPa || erBekreftet) && (
        <IkonHandling
          label={erBekreftet ? `Du er påmeldt ${rollenavn}` : `Meld meg på ${rollenavn}`}
          Icon={Check}
          variant="confirm"
          active={erBekreftet}
          onClick={() => {
            if (!erBekreftet) onMeldPa();
          }}
        />
      )}
      {erBekreftet && (
        <IkonHandling
          label={`Meld forfall ${rollenavn}`}
          Icon={X}
          variant="decline"
          onClick={onMeldForfallClick}
        />
      )}
    </div>
  );
};

export const MinSideFrafallDialog: React.FC<{
  rollenavn: string;
  open: boolean;
  onLukk: () => void;
  onBekreft: (melding?: string) => void;
}> = ({ rollenavn, open, onLukk, onBekreft }) => {
  const [frafallMelding, setFrafallMelding] = useState(false);
  const [melding, setMelding] = useState("");

  if (!open) return null;

  const lukk = () => {
    setMelding("");
    setFrafallMelding(false);
    onLukk();
  };

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-rose-100 bg-rose-50/50 p-3">
      <p className="text-xs font-semibold text-rose-900">Meld forfall for {rollenavn}</p>
      <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          checked={frafallMelding}
          onChange={(e) => setFrafallMelding(e.target.checked)}
          className="rounded border-slate-300"
        />
        Si kort til gruppa
      </label>
      {frafallMelding ? (
        <textarea
          value={melding}
          onChange={(e) => setMelding(e.target.value)}
          rows={2}
          placeholder="F.eks. kan ikke denne søndagen"
          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-rose-300 focus:outline-hidden"
        />
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            onBekreft(frafallMelding ? melding.trim() || undefined : undefined);
            lukk();
          }}
          className="min-h-9 px-3 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg cursor-pointer"
        >
          Bekreft forfall
        </button>
        <button
          type="button"
          onClick={lukk}
          className="min-h-9 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
        >
          Avbryt
        </button>
      </div>
    </div>
  );
};

export const MinSideRolleHandling: React.FC<MinSideRolleHandlingProps> = ({
  rollenavn,
  erForespurt,
  erBekreftet,
  kanMeldPa,
  erStengt,
  onMeldPa,
  onMeldForfall,
  onSvarForesporsel,
  bareKnapper = false,
  visFrafall: visFrafallProp,
  onVisFrafallChange,
}) => {
  const [visFrafallLokal, setVisFrafallLokal] = useState(false);
  const visFrafall = visFrafallProp ?? visFrafallLokal;
  const setVisFrafall = onVisFrafallChange ?? setVisFrafallLokal;

  const knapper = (
    <MinSideRolleKnapper
      rollenavn={rollenavn}
      erForespurt={erForespurt}
      erBekreftet={erBekreftet}
      kanMeldPa={kanMeldPa}
      erStengt={erStengt}
      onMeldPa={onMeldPa}
      onMeldForfallClick={() => setVisFrafall(true)}
      onSvarForesporsel={onSvarForesporsel}
    />
  );

  if (bareKnapper) return knapper;

  return (
    <div className="space-y-2">
      {knapper}
      {erForespurt ? (
        <p className="text-[11px] text-amber-800 font-medium">Forespurt — svar ja eller nei</p>
      ) : null}
      <MinSideFrafallDialog
        rollenavn={rollenavn}
        open={visFrafall}
        onLukk={() => setVisFrafall(false)}
        onBekreft={onMeldForfall}
      />
    </div>
  );
};
