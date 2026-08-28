import React, { useState, useEffect } from "react";
import {
  DatabaseState,
  getCustomScriptUrl,
  saveCustomScriptUrl,
  forceReloadFromRemote,
  migrerFraSheetsTilSupabase,
  uploadToGoogleSheets,
  eksporterTilImportfaner,
  DEFAULT_REMOTE_SCRIPT_URL,
  shouldWriteToRemote,
  useRemoteData,
  isSessionMockOverride,
  hentInnstillinger,
  oppdaterInnstillinger,
  saveDatabase,
  gyldigIcalHttpUrl,
  KIRKE_ICAL_KATEGORI_URL,
  hentSisteRemoteOppdatert,
  populerMedMockData,
} from "../services/dataService";
import { PersonlenkeInnstillinger } from "./PersonlenkeInnstillinger";
import {
  RefreshCw,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Save,
  Link,
  Database,
  FileSpreadsheet,
  FlaskConical,
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
  const [isMigrating, setIsMigrating] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [icalUrlUtkast, setIcalUrlUtkast] = useState(() => hentInnstillinger(db).eksternIcalUrl || "");

  useEffect(() => {
    setScriptUrl(getCustomScriptUrl());
  }, []);

  const lagretIcalUrl = hentInnstillinger(db).eksternIcalUrl || "";
  useEffect(() => {
    setIcalUrlUtkast(lagretIcalUrl);
  }, [lagretIcalUrl]);

  const handleSaveUrl = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    saveCustomScriptUrl(scriptUrl);
    setStatusMessage({
      type: "info",
      text: "Nettadressen til Google Apps Script er lagret.",
    });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleSaveIcalUrl = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmet = icalUrlUtkast.trim().replace(/^webcal:\/\//i, "https://");
    if (trimmet && !gyldigIcalHttpUrl(trimmet)) {
      setStatusMessage({
        type: "error",
        text: "Kalenderlenken må starte med http://, https:// eller webcal://.",
      });
      return;
    }
    const lagret = gyldigIcalHttpUrl(trimmet) || "";
    if (lagret === (hentInnstillinger(db).eksternIcalUrl || "")) {
      return;
    }
    const neste = oppdaterInnstillinger(db, { eksternIcalUrl: lagret });
    saveDatabase(neste);
    onUpdateDb(neste);
    setStatusMessage({
      type: "success",
      text: lagret
        ? "iCal-lenken er lagret. Synk i kalenderen bruker denne feeden."
        : "iCal-lenken er tømt. Synk bruker standardfeeden.",
    });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleReloadSupabase = async () => {
    if (!shouldWriteToRemote()) {
      setStatusMessage({
        type: "error",
        text: "Mock-modus er aktiv. Lasting fra Supabase er slått av.",
      });
      return;
    }
    setIsLoading(true);
    setStatusMessage({ type: "info", text: "Henter nyeste data fra Supabase …" });
    const res = await forceReloadFromRemote();
    setIsLoading(false);
    if (res.success && res.data) {
      onUpdateDb(res.data);
      setStatusMessage({
        type: "success",
        text: `Hentet ${res.data.personer.length} personer, ${res.data.gudstjenester.length} gudstjenester og ${res.data.grupper.length} grupper.`,
      });
    } else {
      setStatusMessage({
        type: "error",
        text: res.error || "Kunne ikke hente data fra Supabase.",
      });
    }
  };

  const handleMigrerFraArk = async () => {
    if (
      !window.confirm(
        "Overskrive dataene i Supabase med det som ligger i Google-arket nå? Endringer som bare finnes i appen går tapt."
      )
    ) {
      return;
    }
    setIsMigrating(true);
    setStatusMessage({ type: "info", text: "Henter Google-arket og skriver til Supabase …" });
    const res = await migrerFraSheetsTilSupabase();
    setIsMigrating(false);
    if (res.success && res.data) {
      onUpdateDb(res.data);
      setStatusMessage({
        type: "success",
        text: `Supabase er oppdatert fra arket: ${res.data.personer.length} personer, ${res.data.gudstjenester.length} gudstjenester.`,
      });
    } else {
      setStatusMessage({
        type: "error",
        text: res.error || "Kunne ikke hente fra Google-arket.",
      });
    }
  };

  const handlePopulerMock = async () => {
    const mal = remoteEnabled
      ? "Overskrive dataene i Supabase med testdata? Google-arket endres ikke. Du kan hente arket etterpå for å få tilbake den gamle databasen."
      : "Overskrive testdataene i denne nettleseren med standard mock? Supabase og Google-arket endres ikke.";
    if (!window.confirm(mal)) return;
    setIsSeeding(true);
    setStatusMessage({ type: "info", text: "Fyller med testdata …" });
    const res = await populerMedMockData();
    setIsSeeding(false);
    if (res.success && res.data) {
      onUpdateDb(res.data);
      setStatusMessage({
        type: "success",
        text: `Testdata er lastet inn: ${res.data.personer.length} personer, ${res.data.gudstjenester.length} gudstjenester og ${res.data.grupper.length} grupper.`,
      });
    } else {
      setStatusMessage({
        type: "error",
        text: res.error || "Kunne ikke laste testdata.",
      });
    }
  };

  const handleUploadToSheets = async () => {
    if (
      !window.confirm(
        "Skrive en full backup av appen (Supabase-tilstanden) til Google Sheets? Dette overskriver masterfanene i arket."
      )
    ) {
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

  const handleEksporterImportBackup = async () => {
    if (
      !window.confirm(
        "Overskrive Personer_import, Gudstjenester_import og Rollebeskrivelse_import med det som ligger i appen nå?\n\nMasterfanene (Personer, Gudstjenester, Tildelinger …) røres ikke. Den gamle Excel-kopien i importfanene erstattes."
      )
    ) {
      return;
    }
    setIsExporting(true);
    setStatusMessage({
      type: "info",
      text: "Skriver backup til importfanene …",
    });
    const res = await eksporterTilImportfaner(db);
    setIsExporting(false);
    if (res.success && res.report) {
      setStatusMessage({
        type: "success",
        text: `Backup skrevet: ${res.report.personer} personer, ${res.report.gudstjenester} gudstjenester og ${res.report.roller} roller i importfanene.`,
      });
    } else {
      setStatusMessage({
        type: "error",
        text: res.error || "Kunne ikke eksportere til importfanene.",
      });
    }
  };

  const isUsingDefault = scriptUrl === DEFAULT_REMOTE_SCRIPT_URL;
  const remoteEnabled = shouldWriteToRemote();
  const mockLocked = !useRemoteData() || isSessionMockOverride();

  return (
    <div className="space-y-6">
      {onSwitchDataSource && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Datakilde</h2>
          <p className="text-xs text-slate-700">
            Testdata lagres bare i denne nettleseren og treffer ikke Supabase eller Google-arket.
            Ekte data krever innlogging (Google eller personlenke).
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onSwitchDataSource("mock")}
              className={`text-left p-4 rounded-xl border cursor-pointer ${
                dataSource === "mock"
                  ? "border-amber-400 bg-white"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="text-sm font-bold text-slate-900">Testdata</div>
              <div className="text-xs text-slate-600 mt-1">
                Mock fra appen. Trygt å klikke rundt.
              </div>
            </button>
            <button
              type="button"
              onClick={() => onSwitchDataSource("remote")}
              className={`text-left p-4 rounded-xl border cursor-pointer ${
                dataSource === "remote"
                  ? "border-emerald-400 bg-emerald-50"
                  : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="text-sm font-bold text-slate-900">Ekte data</div>
              <div className="text-xs text-slate-600 mt-1">
                Supabase. Kan erstattes fra Google-arket.
              </div>
            </button>
          </div>
          <button
            type="button"
            disabled={isLoading || isUploading || isMigrating || isSeeding}
            onClick={() => void handlePopulerMock()}
            className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 text-xs font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <FlaskConical className={`w-4 h-4 ${isSeeding ? "opacity-50" : ""}`} />
            <span>{isSeeding ? "Fyller testdata..." : "Populer med testdata"}</span>
          </button>
        </div>
      )}
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
        <form className="space-y-2 pt-2 border-t border-slate-100" onSubmit={handleSaveIcalUrl}>
          <label htmlFor="ekstern-ical-url" className="block text-sm font-semibold text-slate-800">
            iCal-lenke for synk
          </label>
          <p className="text-xs text-slate-600">
            Offentlig ICS-adresse. Tomt felt bruker kirkens standardfeed. Lagres i fanen
            Innstillinger.
          </p>
          <input
            id="ekstern-ical-url"
            type="text"
            value={icalUrlUtkast}
            onChange={(e) => setIcalUrlUtkast(e.target.value)}
            onBlur={() => handleSaveIcalUrl()}
            placeholder={KIRKE_ICAL_KATEGORI_URL}
            className="w-full min-h-11 px-3 text-sm rounded-xl border border-slate-200"
          />
          <button
            type="submit"
            className="min-h-11 px-3.5 py-2 bg-[#2d5a3f] hover:bg-[#234731] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Lagre iCal-lenke
          </button>
        </form>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-6">
      {mockLocked && (
        <div className="p-4 rounded-xl bg-amber-50 text-amber-950 border border-amber-200 text-xs">
          Appen kjører i mock-modus. Synk mot Supabase og Google Sheets er slått av.
          Velg <strong>Ekte data</strong> over for å koble til.
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Data og backup</h2>
            <p className="text-xs text-slate-500">
              Appen lagrer til Supabase. Google Sheets er manuell backup og Excel-import.
              {hentSisteRemoteOppdatert()
                ? ` Sist lagret i Supabase: ${hentSisteRemoteOppdatert()}.`
                : ""}
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
            disabled={isLoading || isUploading || isMigrating || isSeeding}
            onClick={() => void handlePopulerMock()}
            className="px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 text-xs font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <FlaskConical className={`w-4 h-4 ${isSeeding ? "opacity-50" : ""}`} />
            <span>{isSeeding ? "Fyller testdata..." : "Populer med testdata"}</span>
          </button>
          <button
            type="button"
            disabled={isLoading || isUploading || isExporting || isMigrating || isSeeding || !remoteEnabled}
            onClick={() => void handleEksporterImportBackup()}
            className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <UploadCloud className={`w-4 h-4 ${isExporting ? "opacity-50" : ""}`} />
            <span>{isExporting ? "Eksporterer..." : "Eksporter backup til importfaner"}</span>
          </button>
          <button
            type="button"
            disabled={isLoading || isUploading || isMigrating || isExporting || isSeeding || !remoteEnabled}
            onClick={() => void handleReloadSupabase()}
            className="px-4 py-2.5 bg-[#2d5a3f] hover:bg-[#234731] disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            <span>{isLoading ? "Henter..." : "Last fra Supabase"}</span>
          </button>
          <button
            type="button"
            disabled={isLoading || isUploading || isMigrating || isSeeding || !remoteEnabled}
            onClick={() => void handleMigrerFraArk()}
            className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Database className={`w-4 h-4 ${isMigrating ? "opacity-50" : ""}`} />
            <span>{isMigrating ? "Henter arket..." : "Hent fra Google-arket til Supabase"}</span>
          </button>
          <button
            type="button"
            disabled={isLoading || isUploading || isMigrating || isSeeding || !remoteEnabled}
            onClick={() => void handleUploadToSheets()}
            className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <UploadCloud className={`w-4 h-4 ${isUploading ? "opacity-50" : ""}`} />
            <span>{isUploading ? "Skriver..." : "Eksporter backup til Google Sheets"}</span>
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
            <strong>Tips:</strong> Daglig lagring går til Supabase. Trykk{" "}
            <strong>«Hent fra Google-arket til Supabase»</strong> for å erstatte testdata med
            den gamle databasen i arket. Bruk <strong>«Eksporter backup til Google Sheets»</strong> når
            du vil ha en kopi tilbake i arket.
            Excel-importfanene leses via <strong>«Import fra Excel-faner»</strong>.
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
