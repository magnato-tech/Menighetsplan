import React, { useState, useEffect } from "react";
import {
  DatabaseState,
  getCustomScriptUrl,
  saveCustomScriptUrl,
  forceSyncFromGoogleSheets,
  uploadToGoogleSheets,
  DEFAULT_REMOTE_SCRIPT_URL,
  shouldWriteToRemote,
  useRemoteData,
  isSessionMockOverride,
  hentInnstillinger,
  oppdaterInnstillinger,
  saveDatabase,
} from "../services/dataService";
import { PersonlenkeInnstillinger } from "./PersonlenkeInnstillinger";
import {
  RefreshCw,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Save,
  Link,
  Layers,
  Database,
  FileSpreadsheet,
} from "lucide-react";

interface GoogleSheetsSyncProps {
  db: DatabaseState;
  onUpdateDb: (updatedDb: DatabaseState) => void;
  selectedPersonId?: string;
  dataSource?: "mock" | "remote";
  onSwitchDataSource?: (source: "mock" | "remote") => void;
  onOpenImport?: () => void;
}

export const GoogleSheetsSync: React.FC<GoogleSheetsSyncProps> = ({
  db,
  onUpdateDb,
  selectedPersonId,
  dataSource = "mock",
  onSwitchDataSource,
  onOpenImport,
}) => {
  const [scriptUrl, setScriptUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  useEffect(() => {
    setScriptUrl(getCustomScriptUrl());
  }, []);

  const handleSaveUrl = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    saveCustomScriptUrl(scriptUrl);
    setStatusMessage({
      type: "info",
      text: "Nettadressen til Google Apps Script er lagret.",
    });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleSyncFromSheets = async () => {
    if (!shouldWriteToRemote()) {
      setStatusMessage({
        type: "error",
        text: "Mock-modus er aktiv. Synk mot Google Sheets er slått av.",
      });
      return;
    }
    setIsLoading(true);
    setStatusMessage({
      type: "info",
      text: "Kontakter Google Sheets og henter nyeste data...",
    });

    const res = await forceSyncFromGoogleSheets(scriptUrl);
    setIsLoading(false);

    if (res.success && res.data) {
      onUpdateDb(res.data);
      setStatusMessage({
        type: "success",
        text: `Vellykket! Hentet ${res.data.personer.length} personer, ${res.data.gudstjenester.length} gudstjenester og ${res.data.grupper.length} grupper fra Google Sheets.`,
      });
    } else {
      setStatusMessage({
        type: "error",
        text: res.error || "Kunne ikke hente data fra Google Sheets.",
      });
    }
  };

  const handleUploadToSheets = async () => {
    if (!window.confirm("Er du sikker på at du vil overskrive dataene i Google Sheets med gjeldende data fra appen?")) {
      return;
    }
    setIsUploading(true);
    setStatusMessage({
      type: "info",
      text: "Laster opp gjeldende endringer til Google Sheets...",
    });

    const res = await uploadToGoogleSheets(db, scriptUrl);
    setIsUploading(false);

    if (res.success) {
      setStatusMessage({
        type: "success",
        text: "Dataene ble lagret og oppdatert i Google Sheets!",
      });
    } else {
      setStatusMessage({
        type: "error",
        text: res.error || "Kunne ikke lagre til Google Sheets.",
      });
    }
  };

  const isUsingDefault = scriptUrl === DEFAULT_REMOTE_SCRIPT_URL;
  const remoteEnabled = shouldWriteToRemote();
  const mockLocked = !useRemoteData() || isSessionMockOverride();

  return (
    <div className="space-y-6">
      {selectedPersonId && (
        <PersonlenkeInnstillinger
          db={db}
          personId={selectedPersonId}
          onUpdateDb={onUpdateDb}
        />
      )}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Kalender for andre</h2>
        <p className="text-xs text-slate-600">
          Av som standard. Når du skrur på, får brukere lesekalender og/eller abonnement med
          gudstjenester, åpne treff og egne gruppemøter — ikke kirkesynk og ikke opprette/slette.
        </p>
        {(
          [
            ["visKalenderMinSide", "Vis kalender på Min side"],
            ["visKalenderGruppeleder", "Vis kalender hos gruppeleder"],
            ["visKalenderIcal", "Tillat abonnement på personlig kalender (iCal)"],
          ] as const
        ).map(([felt, merke]) => {
          const i = hentInnstillinger(db);
          return (
            <label key={felt} className="flex items-start gap-3 text-sm text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={i[felt]}
                onChange={(e) => {
                  const neste = oppdaterInnstillinger(db, { [felt]: e.target.checked });
                  saveDatabase(neste);
                  onUpdateDb(neste);
                }}
              />
              <span>{merke}</span>
            </label>
          );
        })}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-6">
      {import.meta.env.DEV && onSwitchDataSource && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-800">Datakilde (utvikling)</h3>
          <p className="text-xs text-slate-600">
            Mock-data fyller appen med testdata og leser/skriver aldri Google Sheets. Ekte data
            henter menighetsarket — da må du være innlogget med personlig admin-lenke (eller
            Google). Uten lenke kommer innloggingsskjermen.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onSwitchDataSource("mock")}
              className={`text-left p-4 rounded-xl border cursor-pointer ${
                dataSource === "mock"
                  ? "border-amber-300 bg-amber-50"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="text-sm font-bold text-slate-900">Mock-data</div>
              <div className="text-xs text-slate-600 mt-1">
                Populerer med innebygd testdata. Ingen Sheets-trafikk.
              </div>
            </button>
            <button
              type="button"
              onClick={() => onSwitchDataSource("remote")}
              className={`text-left p-4 rounded-xl border cursor-pointer ${
                dataSource === "remote"
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="text-sm font-bold text-slate-900">Ekte data</div>
              <div className="text-xs text-slate-600 mt-1">
                Leser Google Sheets. Krever personlig admin-lenke.
              </div>
            </button>
          </div>
        </div>
      )}
      {mockLocked && (
        <div className="p-4 rounded-xl bg-amber-50 text-amber-950 border border-amber-200 text-xs">
          Appen kjører i mock-modus. Synk og opplasting mot Google Sheets er slått av.
          Velg <strong>Ekte data</strong> over for å koble til arket.
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Google Sheets — masterdata</h2>
            <p className="text-xs text-slate-500">
              Appen leser og skriver masterfanene Personer, Gudstjenester, Tildelinger m.m.
              «Last masterdata på nytt» er samme lesing som auto-synk — ikke import fra
              Excel-fanene. Bruk «Import fra Excel-faner» når Gudstjenester_import skal skrive over planen.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenImport && (
            <button
              type="button"
              onClick={onOpenImport}
              className="px-3.5 py-2.5 bg-[#eef5f1] hover:bg-[#dff0e6] text-[#2d5a3f] border border-[#d2e8d9] text-xs font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              <Database className="w-4 h-4" />
              <span>Import fra Excel-faner</span>
            </button>
          )}
          <button
            type="button"
            disabled={isLoading || isUploading || !remoteEnabled}
            onClick={handleSyncFromSheets}
            className="px-4 py-2.5 bg-[#2d5a3f] hover:bg-[#234731] disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            <span>{isLoading ? "Henter..." : "Last masterdata på nytt"}</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-start gap-2.5 ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : statusMessage.type === "error"
              ? "bg-rose-50 text-rose-900 border border-rose-200"
              : "bg-blue-50 text-blue-900 border border-blue-200"
          }`}
        >
          {statusMessage.type === "success" && (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          )}
          {statusMessage.type === "error" && (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          )}
          {statusMessage.type === "info" && (
            <RefreshCw className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          )}
          <span className="font-medium">{statusMessage.text}</span>
        </div>
      )}

      {/* Oppsett av Apps Script Web App URL */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-800">
              Google Apps Script Web App URL
            </h3>
          </div>
          {isUsingDefault && (
            <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-medium border border-emerald-200">
              Aktiv standard-URL for menigheten
            </span>
          )}
        </div>

        <form onSubmit={handleSaveUrl} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Web App URL (slutter normalt på <code>/exec</code>):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={scriptUrl}
                onChange={(e) => setScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 px-3.5 py-2.5 text-xs font-mono bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lagre URL</span>
              </button>
            </div>
          </div>
        </form>

        <div className="text-[11px] text-slate-500 space-y-1">
          <p>
            <strong>Tips:</strong> Denne lenken knytter appen til Google-arket. Trykk{" "}
            <strong>«Last masterdata på nytt»</strong> for å hente det som allerede ligger i
            masterfanene. Excel-importfanene leses bare via <strong>«Import fra Excel-faner»</strong>.
          </p>
        </div>
      </div>

      {/* Datastatistikk nå */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 p-4 rounded-xl">
          <div className="text-xs text-slate-500 font-medium">Personer i minne</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{db.personer.length}</div>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-xl">
          <div className="text-xs text-slate-500 font-medium">Gudstjenester</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{db.gudstjenester.length}</div>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-xl">
          <div className="text-xs text-slate-500 font-medium">Grupper</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{db.grupper.length}</div>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-xl">
          <div className="text-xs text-slate-500 font-medium">Tildelinger & Svar</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{db.tildelinger.length}</div>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-xl">
          <div className="text-xs text-slate-500 font-medium">Malaktiviteter</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{db.malaktiviteter.length}</div>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-xl">
          <div className="text-xs text-slate-500 font-medium">Programaktiviteter</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{db.programaktiviteter.length}</div>
        </div>
      </div>
    </div>
    </div>
  );
};
