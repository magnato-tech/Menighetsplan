import React, { useState } from "react";
import { DatabaseState, AppView, genererPersonligLenke } from "../services/dataService";
import { ImportMigrationModal } from "./ImportMigrationModal";
import { GroupAdminModal } from "./GroupAdminModal";
import { GoogleSheetsSync } from "./GoogleSheetsSync";
import { NewGroupModal } from "./NewGroupModal";
import { GroupOverview } from "./GroupOverview";
import { BelastningView } from "./BelastningView";
import { ProgrammalAdminView } from "./ProgrammalAdminView";
import { PersonregisterView } from "./PersonregisterView";
import { RollerAdminView } from "./RollerAdminView";
import { AdminGudstjenesterView } from "./AdminGudstjenesterView";
import {
  Calendar,
  Users,
  UsersRound,
  Layers,
  Settings,
  Clock,
  Gauge,
  Ellipsis,
} from "lucide-react";

interface AdminViewProps {
  db: DatabaseState;
  onUpdateDb: (updatedDb: DatabaseState) => void;
  onSelectPerson: (personId: string, view?: AppView) => void;
  selectedPersonId?: string;
  dataSource?: "mock" | "remote";
  onSwitchDataSource?: (source: "mock" | "remote") => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  db,
  onUpdateDb,
  onSelectPerson,
  selectedPersonId,
  dataSource = "mock",
  onSwitchDataSource,
}) => {
  const [activeTab, setActiveTab] = useState<
    "services" | "belastning" | "people" | "groups" | "roles" | "programmal" | "sync"
  >("services");
  const [groupTypeFilter, setGroupTypeFilter] = useState("alle");
  const [editingGruppeId, setEditingGruppeId] = useState<string | null>(null);
  const [newGroupModal, setNewGroupModal] = useState(false);
  const [copiedPersonId, setCopiedPersonId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [hoppTil, setHoppTil] = useState<{ gudstjenesteId: string; personId: string } | null>(
    null
  );
  const [flereFaner, setFlereFaner] = useState(false);

  const faner: {
    id: typeof activeTab;
    Icon: typeof Calendar;
    kort: string;
    lang: string;
    antall?: number;
  }[] = [
    { id: "services", Icon: Calendar, kort: "Søndager", lang: "Gudstjenester & Bemanningsstatus", antall: db.gudstjenester.length },
    { id: "belastning", Icon: Gauge, kort: "Last", lang: "Belastning" },
    { id: "people", Icon: Users, kort: "Folk", lang: "Personregister", antall: db.personer.length },
    { id: "groups", Icon: UsersRound, kort: "Grupper", lang: "Grupper", antall: db.grupper.length },
    { id: "roles", Icon: Layers, kort: "Roller", lang: "Roller", antall: db.roller.length },
    { id: "programmal", Icon: Clock, kort: "Mal", lang: "Programmal", antall: db.malaktiviteter.length },
    { id: "sync", Icon: Settings, kort: "Sync", lang: "Innstillinger" },
  ];
  const primaere = faner.slice(0, 4);
  const avanserte = faner.slice(4);

  const handleCopyLink = (personId: string) => {
    const link = genererPersonligLenke(personId, db);
    navigator.clipboard.writeText(link).then(() => {
      setCopiedPersonId(personId);
      setTimeout(() => setCopiedPersonId(null), 2500);
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="relative">
        <div className="flex border-b border-slate-200 gap-1 overflow-x-auto">
          {primaere.map((fane) => {
            const aktiv = activeTab === fane.id;
            return (
              <button
                key={fane.id}
                type="button"
                onClick={() => setActiveTab(fane.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm font-semibold border-b-2 cursor-pointer shrink-0 ${
                  aktiv ? "border-[#2d5a3f] text-[#2d5a3f]" : "border-transparent text-slate-600"
                }`}
              >
                <fane.Icon className="w-4 h-4" />
                <span className="md:hidden">{fane.kort}</span>
                <span className="hidden md:inline">
                  {fane.lang}
                  {fane.antall != null ? ` (${fane.antall})` : ""}
                </span>
              </button>
            );
          })}
          <div className="hidden md:flex">
            {avanserte.map((fane) => {
              const aktiv = activeTab === fane.id;
              return (
                <button
                  key={fane.id}
                  type="button"
                  onClick={() => setActiveTab(fane.id)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold border-b-2 cursor-pointer shrink-0 ${
                    aktiv ? "border-[#2d5a3f] text-[#2d5a3f]" : "border-transparent text-slate-600"
                  }`}
                >
                  <fane.Icon className="w-4 h-4" />
                  <span>
                    {fane.lang}
                    {fane.antall != null ? ` (${fane.antall})` : ""}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setFlereFaner((v) => !v)}
            className={`md:hidden flex items-center gap-1 px-3 py-2.5 text-xs font-semibold border-b-2 cursor-pointer ${
              avanserte.some((f) => f.id === activeTab)
                ? "border-[#2d5a3f] text-[#2d5a3f]"
                : "border-transparent text-slate-600"
            }`}
          >
            <Ellipsis className="w-4 h-4" />
            Mer
          </button>
        </div>
        {flereFaner && (
          <div className="md:hidden absolute right-0 mt-1 z-20 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1">
            {avanserte.map((fane) => (
              <button
                key={fane.id}
                type="button"
                onClick={() => {
                  setActiveTab(fane.id);
                  setFlereFaner(false);
                }}
                className="w-full text-left px-3 py-3 min-h-11 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                {fane.lang}
              </button>
            ))}
          </div>
        )}
      </div>

      <PersonregisterView
        db={db}
        onUpdateDb={onUpdateDb}
        visTabell={activeTab === "people"}
      />

      <AdminGudstjenesterView
        db={db}
        onUpdateDb={onUpdateDb}
        vis={activeTab === "services"}
        hoppTil={hoppTil}
        onSelectPerson={onSelectPerson}
        selectedPersonId={selectedPersonId}
      />

      {activeTab === "belastning" && (
        <BelastningView
          db={db}
          onVelgGudstjeneste={(gudstjenesteId, personId) => {
            setHoppTil({ gudstjenesteId, personId });
            setActiveTab("services");
          }}
        />
      )}

      {activeTab === "groups" && (
        <GroupOverview
          db={db}
          groupTypeFilter={groupTypeFilter}
          onGroupTypeFilter={setGroupTypeFilter}
          copiedPersonId={copiedPersonId}
          onCopyLink={handleCopyLink}
          onOpenEdit={setEditingGruppeId}
          onNewGroup={() => setNewGroupModal(true)}
          onSelectPerson={onSelectPerson}
        />
      )}

      {activeTab === "roles" && <RollerAdminView db={db} onUpdateDb={onUpdateDb} />}

      {activeTab === "programmal" && (
        <ProgrammalAdminView db={db} onUpdateDb={onUpdateDb} />
      )}

      {activeTab === "sync" && (
        <GoogleSheetsSync
          db={db}
          onUpdateDb={onUpdateDb}
          selectedPersonId={selectedPersonId}
          dataSource={dataSource}
          onSwitchDataSource={onSwitchDataSource}
          onOpenImport={() => setShowImportModal(true)}
        />
      )}

      {newGroupModal && (
        <NewGroupModal
          db={db}
          onUpdateDb={onUpdateDb}
          onClose={() => setNewGroupModal(false)}
        />
      )}

      {editingGruppeId && (
        <GroupAdminModal
          key={editingGruppeId}
          gruppeId={editingGruppeId}
          db={db}
          onUpdateDb={onUpdateDb}
          onClose={() => setEditingGruppeId(null)}
        />
      )}

      {showImportModal && (
        <ImportMigrationModal
          db={db}
          onClose={() => setShowImportModal(false)}
          onUpdateDb={onUpdateDb}
        />
      )}
    </div>
  );
};
