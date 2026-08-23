import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTema } from "../services/tema";

export const TemaBryter: React.FC<{ kompakt?: boolean }> = ({ kompakt = false }) => {
  const { erMork, veksleTema } = useTema();
  const label = erMork ? "Bytt til lyst tema" : "Bytt til mørkt tema";

  return (
    <button
      type="button"
      onClick={veksleTema}
      title={label}
      aria-label={label}
      aria-pressed={erMork}
      className={`inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer ${
        kompakt ? "p-2" : "px-3 py-1.5 gap-1.5"
      }`}
    >
      {erMork ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      {!kompakt && (
        <span className="text-xs font-semibold hidden sm:inline">{erMork ? "Lyst" : "Mørkt"}</span>
      )}
    </button>
  );
};
