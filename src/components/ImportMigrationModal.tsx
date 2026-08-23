import React, { useState } from "react";
import {
  DatabaseState,
  overskrivFraGudstjenesterImport,
  forceSyncFromGoogleSheets,
} from "../services/dataService";
import { AlertTriangle, CheckCircle2, Database, Loader2, X } from "lucide-react";

interface ImportMigrationModalProps {
  db: DatabaseState;
  onClose: () => void;
  onUpdateDb: (updatedDb: DatabaseState) => void;
}

export const ImportMigrationModal: React.FC<ImportMigrationModalProps> = ({
  onClose,
  onUpdateDb,
}) => {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ type: "ok" | "error" | "info"; text: string } | null>(
    null
  );

  const handleOverwrite = async () => {
    if (
      !window.confirm(
        "Slette ALLE gudstjenester i master og importere rent fra Gudstjenester_import?\n\nPersoner, roller og tilgang beholdes. Alle tildelinger og svar på gudstjenester slettes og lages på nytt fra importfanen."
      )
    ) {
      return;
    }
    setBusy(true);
    setStatus({ type: "info", text: "Leser Gudstjenester_import og skriver til masterfanene …" });
    const res = await overskrivFraGudstjenesterImport();
    if (!res.success) {
      setBusy(false);
      setStatus({ type: "error", text: res.error || "Importen feilet." });
      return;
    }
    const sync = await forceSyncFromGoogleSheets();
    setBusy(false);
    if (sync.success && sync.data) {
      onUpdateDb(sync.data);
    }
    const r = res.report || {};
    if (r.feil || Number(r.importRader || 0) === 0) {
      setStatus({
        type: "error",
        text: String(
          r.feil ||
            "Ingen rader ble lest fra importfanen. Slett tittelraden slik at GudstjenesteID står i rad 1, og sjekk at fanen heter Gudstjenester_import."
        ),
      });
      return;
    }
    const unmatchedList = Array.isArray(r.umatchedeNavn) ? r.umatchedeNavn : [];
    const unmatched = unmatchedList.length;
    const unmatchedTxt = unmatched
      ? ` ${unmatched} navn fant ikke person: ${unmatchedList
          .slice(0, 8)
          .map((u) => (typeof u === "object" && u && "navn" in u ? String((u as { navn: string }).navn) : String(u)))
          .join(", ")}${unmatched > 8 ? "…" : ""}.`
      : "";
    const fane = r.faneNavn ? ` (fane: ${r.faneNavn})` : "";
    setStatus({
      type: "ok",
      text: `Import ferdig${fane}. Slettet ${r.gudstjenesterFjernet ?? 0} gamle gudstjenester. ${r.importRader ?? 0} rader lest, ${r.gudstjenesterNye ?? 0} nye. ${r.tildelingerNye ?? 0} tildelinger lagt inn.${unmatchedTxt}`,
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#eef5f1] text-[#2d5a3f] rounded-xl border border-[#d2e8d9]">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#2d5a3f]">
                Engangsimport
              </p>
              <h2 className="text-lg font-bold text-slate-900">Fra Gudstjenester_import</h2>
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

        <div className="text-sm text-slate-700 space-y-3">
          <p>
            <strong>Last masterdata på nytt</strong> henter det appen allerede bruker: fanene
            Personer, Gudstjenester, Tildelinger og så videre. Den leser <em>ikke</em>{" "}
            Excel-importfanene.
          </p>
          <p>
            Her slettes først alle rader i fanen Gudstjenester (og tilhørende tildelinger/svar).
            Deretter leses{" "}
            <code className="text-xs bg-slate-100 px-1 rounded">Gudstjenester_import</code> og
            planen legges inn på nytt. Personer, roller og tilgang røres ikke.
          </p>
          <div className="flex items-start gap-2 text-xs text-amber-950 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Alle eksisterende gudstjenester slettes før import. Svar på gamle tildelinger følger
              ikke med.
            </span>
          </div>
        </div>

        {status && (
          <div
            className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
              status.type === "ok"
                ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                : status.type === "error"
                  ? "bg-rose-50 text-rose-900 border border-rose-200"
                  : "bg-slate-50 text-slate-700 border border-slate-200"
            }`}
          >
            {status.type === "ok" && <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
            {busy && <Loader2 className="w-4 h-4 shrink-0 mt-0.5 animate-spin" />}
            <span>{status.text}</span>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
          >
            Lukk
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleOverwrite()}
            className="px-4 py-2 rounded-xl bg-[#2d5a3f] hover:bg-[#234731] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
          >
            {busy ? "Importerer …" : "Skriv over fra Gudstjenester_import"}
          </button>
        </div>
      </div>
    </div>
  );
};
