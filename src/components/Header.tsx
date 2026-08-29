import React, { useState } from "react";
import { DatabaseState, genererDelbarLenke, hentTilgang, AppView } from "../services/dataService";
import {
  Users,
  ShieldCheck,
  UserCheck,
  Share2,
  Check,
  ChevronDown,
  Church,
  MoreVertical,
} from "lucide-react";
import { IkonHandling } from "./IkonHandling";
import { TemaBryter } from "./TemaBryter";

interface HeaderProps {
  db: DatabaseState;
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  selectedPersonId: string;
  setSelectedPersonId: (id: string) => void;
  onResetData: () => void;
  isAdminUser?: boolean;
  isMagicLinkUser?: boolean;
  onLoggUt?: () => void;
  onMineOppgaver?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  db,
  activeView,
  setActiveView,
  selectedPersonId,
  setSelectedPersonId,
  onResetData,
  isAdminUser = false,
  isMagicLinkUser = false,
  onLoggUt,
  onMineOppgaver,
}) => {
  const [copied, setCopied] = useState(false);
  const [copyFeil, setCopyFeil] = useState(false);
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);
  const [showMer, setShowMer] = useState(false);
  const selectedPerson = db.personer.find((p) => p.PersonID === selectedPersonId);
  const tilgang = hentTilgang(db, selectedPersonId);
  const canSwitchPerson = isAdminUser || import.meta.env.DEV;

  const handleCopyLink = () => {
    const link = genererDelbarLenke(selectedPersonId, db);
    navigator.clipboard.writeText(link).then(() => {
      setCopyFeil(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      setCopied(false);
      setCopyFeil(true);
      setTimeout(() => setCopyFeil(false), 3500);
    });
  };

  return (
    <header className="mobil-header-safe bg-white border-b border-slate-200/90 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12 md:h-16 gap-2 md:gap-4">
          {/* Logo & Tittel som i referansebildet */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-[#eef5f1] border border-[#d2e8d9] text-[#2d5a3f] flex items-center justify-center shadow-2xs shrink-0">
              <Church className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <div className="min-w-0">
              <div className="hidden sm:block text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Lillesand Misjonskirke
              </div>
              <h1 className="text-sm md:text-base sm:text-lg font-bold text-slate-900 leading-tight truncate">
                Menighetsplan
              </h1>
            </div>
          </div>

          {/* Høyre del: Person-velger & handlinger */}
          <div className="flex items-center gap-2">
            {canSwitchPerson ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPersonDropdown(!showPersonDropdown)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-100 text-slate-800 text-sm font-medium transition cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-full bg-[#eef5f1] text-[#2d5a3f] border border-[#d2e8d9] flex items-center justify-center text-xs font-bold">
                    {selectedPerson ? selectedPerson.Fornavn[0] : "P"}
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] text-slate-400 font-normal leading-none mb-0.5">
                      {isAdminUser ? "Aktiv person (Admin):" : "Innlogget som:"}
                    </div>
                    <div className="text-xs sm:text-sm font-semibold truncate max-w-[120px] sm:max-w-[180px] text-slate-900 leading-tight">
                      {selectedPerson?.Navn || "Velg person"}
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {showPersonDropdown && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 max-h-96 overflow-y-auto">
                    <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      {isAdminUser ? "Velg person (Admin-oversikt)" : "Velg person (utvikling)"}
                    </div>
                    {db.personer
                      .filter((p) => p.Aktiv)
                      .map((person) => {
                        const personTilgang = hentTilgang(db, person.PersonID);

                        return (
                          <button
                            key={person.PersonID}
                            type="button"
                            onClick={() => {
                              setSelectedPersonId(person.PersonID);
                              setShowPersonDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 flex items-center justify-between text-sm hover:bg-[#eef5f1]/60 transition cursor-pointer ${
                              selectedPersonId === person.PersonID
                                ? "bg-[#eef5f1] font-semibold text-[#1e3e2b]"
                                : "text-slate-700"
                            }`}
                          >
                            <div>
                              <div className="font-medium text-slate-900">
                                {person.Navn}
                              </div>
                              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                                {personTilgang.isAdmin && (
                                  <span className="bg-slate-100 text-slate-800 text-[10px] px-1.5 py-0.5 rounded font-medium border border-slate-200">
                                    Admin
                                  </span>
                                )}
                                {personTilgang.isLeader && (
                                  <span className="bg-[#eef5f1] text-[#2d5a3f] text-[10px] px-1.5 py-0.5 rounded font-medium border border-[#d2e8d9]">
                                    Gruppeleder
                                  </span>
                                )}
                              </div>
                            </div>
                            {selectedPersonId === person.PersonID && (
                              <Check className="w-4 h-4 text-[#2d5a3f]" />
                            )}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            ) : (
              selectedPerson && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/80 bg-slate-50 text-slate-800 text-sm">
                  <div className="w-6 h-6 rounded-full bg-[#eef5f1] text-[#2d5a3f] border border-[#d2e8d9] flex items-center justify-center text-xs font-bold">
                    {selectedPerson.Fornavn[0]}
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] text-slate-400 font-normal leading-none mb-0.5">Innlogget som:</div>
                    <div className="text-xs sm:text-sm font-semibold truncate max-w-[120px] sm:max-w-[180px] text-slate-900 leading-tight">
                      {selectedPerson.Navn}
                    </div>
                  </div>
                </div>
              )
            )}

            <div className="hidden md:flex items-center gap-2">
            {onMineOppgaver && (
              <button
                type="button"
                onClick={onMineOppgaver}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Tjeneste
              </button>
            )}
            <TemaBryter kompakt />
            <IkonHandling
              label="Kopier min lenke"
              Icon={Share2}
              onClick={() => handleCopyLink()}
              copied={copied}
              size="md"
            />
            {onLoggUt && (
              <button
                type="button"
                onClick={onLoggUt}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Logg ut
              </button>
            )}
            </div>
            <div className="relative md:hidden">
              <button
                type="button"
                onClick={() => {
                  setShowMer((v) => !v);
                  setShowPersonDropdown(false);
                }}
                className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-xl border border-slate-200 bg-white text-slate-700 cursor-pointer"
                aria-label="Mer"
                aria-expanded={showMer}
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {showMer && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50">
                  {onMineOppgaver && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMer(false);
                        onMineOppgaver();
                      }}
                      className="w-full text-left px-3 py-3 min-h-11 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                    >
                      Tjeneste
                    </button>
                  )}
                  <div className="px-3 py-2">
                    <TemaBryter />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handleCopyLink();
                    }}
                    className="w-full text-left px-3 py-3 min-h-11 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                  >
                    {copied ? "Lenke kopiert" : copyFeil ? "Kunne ikke kopiere" : "Kopier min lenke"}
                  </button>
                  {onLoggUt && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMer(false);
                        onLoggUt();
                      }}
                      className="w-full text-left px-3 py-3 min-h-11 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                    >
                      Logg ut
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hovednavigasjon / Faner etter referansebildet med mørkegrønn aktiv knapp */}
        <nav className="hidden md:flex space-x-1 border-t border-slate-100 py-2 overflow-x-auto">
          <button
            onClick={() => setActiveView("personal")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition cursor-pointer ${
              activeView === "personal"
                ? "bg-[#2d5a3f] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Min side ({selectedPerson?.Fornavn})</span>
          </button>

          {tilgang.views.includes("leader") && (
          <button
            onClick={() => setActiveView("leader")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition cursor-pointer ${
              activeView === "leader"
                ? "bg-[#2d5a3f] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Gruppeledere</span>
            {tilgang.isLeader && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  activeView === "leader"
                    ? "bg-[#1e3e2b] text-white"
                    : "bg-[#eef5f1] text-[#2d5a3f] border border-[#d2e8d9]"
                }`}
              >
                Aktiv
              </span>
            )}
          </button>
          )}

          {tilgang.views.includes("admin") && (
          <button
            onClick={() => setActiveView("admin")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition cursor-pointer ${
              activeView === "admin"
                ? "bg-[#2d5a3f] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Administrator</span>
          </button>
          )}
        </nav>
      </div>
    </header>
  );
};
