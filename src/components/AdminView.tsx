import React, { useState } from "react";
import { DatabaseState, AppView, genererPersonligLenke } from "../services/dataService";
import { ImportMigrationModal } from "./ImportMigrationModal";
import { GroupAdminModal } from "./GroupAdminModal";
import { GoogleSheetsSync } from "./GoogleSheetsSync";
import { GroupDetailModal } from "./GroupDetailModal";
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
  const [detailGruppeId, setDetailGruppeId] = useState<string | null>(null);
  const [editingGruppeId, setEditingGruppeId] = useState<string | null>(null);
  const [newGroupModal, setNewGroupModal] = useState(false);
  const [copiedPersonId, setCopiedPersonId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [hoppTil, setHoppTil] = useState<{ gudstjenesteId: string; personId: string } | null>(
    null
  );

  const handleCopyLink = (personId: string) => {
    const link = genererPersonligLenke(personId, db);
    navigator.clipboard.writeText(link).then(() => {
      setCopiedPersonId(personId);
      setTimeout(() => setCopiedPersonId(null), 2500);
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex border-b border-slate-200 space-x-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("services")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 cursor-pointer transition ${
            activeTab === "services"
              ? "border-[#2d5a3f] text-[#2d5a3f]"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Gudstjenester & Bemanningsstatus ({db.gudstjenester.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("belastning")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 cursor-pointer transition ${
            activeTab === "belastning"
              ? "border-[#2d5a3f] text-[#2d5a3f]"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Gauge className="w-4 h-4" />
          <span>Belastning</span>
        </button>

        <button
          onClick={() => setActiveTab("people")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 cursor-pointer transition ${
            activeTab === "people"
              ? "border-[#2d5a3f] text-[#2d5a3f]"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Personregister ({db.personer.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("groups")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 cursor-pointer transition ${
            activeTab === "groups"
              ? "border-[#2d5a3f] text-[#2d5a3f]"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <UsersRound className="w-4 h-4" />
          <span>Grupper ({db.grupper.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("roles")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 cursor-pointer transition ${
            activeTab === "roles"
              ? "border-[#2d5a3f] text-[#2d5a3f]"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Roller ({db.roller.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("programmal")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 cursor-pointer transition ${
            activeTab === "programmal"
              ? "border-[#2d5a3f] text-[#2d5a3f]"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Programmal ({db.malaktiviteter.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("sync")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 cursor-pointer transition ${
            activeTab === "sync"
              ? "border-[#2d5a3f] text-[#2d5a3f]"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Innstillinger</span>
        </button>
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
        onByttTilGrupper={(gruppetypeId) => {
          setGroupTypeFilter(gruppetypeId);
          setActiveTab("groups");
        }}
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
          onOpenDetail={setDetailGruppeId}
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

      {detailGruppeId && db.grupper.find((g) => g.GruppeID === detailGruppeId) && (
        <GroupDetailModal
          gruppe={db.grupper.find((g) => g.GruppeID === detailGruppeId)!}
          db={db}
          onClose={() => setDetailGruppeId(null)}
          onEdit={() => {
            setEditingGruppeId(detailGruppeId);
            setDetailGruppeId(null);
          }}
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
