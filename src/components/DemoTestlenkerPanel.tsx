import React, { useState } from "react";
import { Link2, Copy, Check, ChevronDown } from "lucide-react";
import { DEMO_TESTLENKER, genererDemoTestlenke } from "../services/demo";

export const DemoTestlenkerPanel: React.FC<{ starterLukket?: boolean }> = ({
  starterLukket = false,
}) => {
  const [apen, setApen] = useState(!starterLukket);
  const [kopiert, setKopiert] = useState<string | null>(null);

  const kopier = (nokkel: string, personId: string, view?: "personal" | "leader" | "admin") => {
    const link = genererDemoTestlenke(personId, view);
    void navigator.clipboard.writeText(link).then(() => {
      setKopiert(nokkel);
      window.setTimeout(() => setKopiert(null), 2500);
    });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
      <button
        type="button"
        onClick={() => setApen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
        aria-expanded={apen}
      >
        <div className="flex items-start gap-2 min-w-0">
          <Link2 className="w-4 h-4 text-amber-800 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">Demo testlenker</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Stabile lenker til testpersoner — uten innlogging hos mottaker.
            </p>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-slate-500 shrink-0 transition ${apen ? "rotate-180" : ""}`}
        />
      </button>
      {apen ? (
        <>
          <p className="text-xs text-amber-900/80 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Kopier lenken og send til testpersoner. Virker på tvers av enheter.
          </p>
          <ul className="space-y-2">
        {DEMO_TESTLENKER.map((preset) => {
          const nokkel = `${preset.personId}-${preset.view || "auto"}`;
          const erKopiert = kopiert === nokkel;
          return (
            <li
              key={nokkel}
              className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-amber-200/80 bg-white/70 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">{preset.etikett}</div>
                <div className="text-xs text-slate-600">{preset.beskrivelse}</div>
                <code className="text-[11px] text-slate-500 break-all">
                  ?demo={preset.personId}
                  {preset.view ? `&view=${preset.view}` : ""}
                </code>
              </div>
              <button
                type="button"
                onClick={() => kopier(nokkel, preset.personId, preset.view)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 bg-white text-xs font-semibold text-amber-950 hover:bg-amber-50 cursor-pointer shrink-0"
              >
                {erKopiert ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {erKopiert ? "Kopiert" : "Kopier lenke"}
              </button>
            </li>
          );
        })}
          </ul>
        </>
      ) : null}
    </section>
  );
};
