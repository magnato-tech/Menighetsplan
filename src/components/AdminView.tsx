import React, { useEffect, useState } from "react";
import {
  DatabaseState,
  UkjentImportSlot,
  finnUkjenteImportnavn,
  finnTjenestegrupperForPerson,
  getEffektivtBehov,
  hentSvarStatus,
  summerBemanning,
  tomtBemanningstall,
  plusBemanningstall,
  Bemanningstall,
  genererPersonligLenke,
  opprettPersonIRegister,
  saveDatabase,
  hentTilgang,
  svarPaaTildeling,
  settDeltakelseForPerson,
  personHarAktivTildeling,
  finnPersonMedVisningsnavn,
  tildelingVisningsnavn,
  AppView,
} from "../services/dataService";
import {
  Rolle,
  Gudstjeneste,
  Tjenestebehov,
  SvarStatus,
} from "../types/database";
import { RoleDescriptionModal, oppsummerInstruks } from "./RoleDescriptionModal";
import { ImportMigrationModal } from "./ImportMigrationModal";
import { GroupAdminModal } from "./GroupAdminModal";
import { GoogleSheetsSync } from "./GoogleSheetsSync";
import { GroupDetailModal } from "./GroupDetailModal";
import { NewGroupModal } from "./NewGroupModal";
import { RolleIkon } from "./RolleIkon";
import { IkonHandling } from "./IkonHandling";
import { BelastningView } from "./BelastningView";
import { ProgrammalAdminView } from "./ProgrammalAdminView";
import { GudstjenesteProgramView } from "./GudstjenesteProgramView";
import {
  Calendar,
  Users,
  UsersRound,
  Shield,
  Layers,
  Plus,
  Trash2,
  Share2,
  Check,
  Search,
  Filter,
  Star,
  Sliders,
  AlertTriangle,
  FileSpreadsheet,
  Clock,
  Eye,
  LayoutGrid,
  List,
  X,
  UserPlus,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CircleHelp,
  CheckCircle2,
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

const GRUPPEFILTER = [
  { id: "tjenestegruppe", label: "Tjenestegrupper", aliases: ["tjenestegruppe", "tjenestegrupper"], seksjon: null as string | null },
  { id: "husgruppe", label: "Husgruppe", aliases: ["husgruppe"], seksjon: null },
  { id: "lederskap", label: "Lederskap", aliases: ["lederskap", "ledergruppe"], seksjon: "Ledelse" },
  { id: "gruppeledergruppe", label: "Gruppeledergruppe", aliases: ["gruppeledergruppe"], seksjon: "Ledelse" },
  { id: "strategigrupper", label: "Strategigrupper", aliases: ["strategigruppe", "strategigrupper"], seksjon: "Ledelse" },
];

function gruppetypeIderForFilter(db: DatabaseState, filterId: string): string[] {
  const filter = GRUPPEFILTER.find((f) => f.id === filterId);
  if (!filter) return [];
  return db.gruppetyper
    .filter((gt) => filter.aliases.includes(String(gt.Navn || "").trim().toLowerCase()))
    .map((gt) => gt.GruppetypeID);
}

function antallGrupperForFilter(db: DatabaseState, filterId: string): number {
  const ids = gruppetypeIderForFilter(db, filterId);
  if (ids.length === 0) {
    return filterId === "tjenestegruppe" ? db.grupper.length : 0;
  }
  return db.grupper.filter((g) => ids.includes(g.GruppetypeID)).length;
}

function antallMedlemmerIGruppe(db: DatabaseState, gruppe: { GruppeID: string; GruppelederID?: string; NestlederID?: string }): number {
  const ids = new Set(
    db.gruppemedlemmer
      .filter((gm) => gm.GruppeID === gruppe.GruppeID && gm.Aktiv)
      .map((gm) => gm.PersonID)
  );
  if (gruppe.GruppelederID) ids.add(gruppe.GruppelederID);
  if (gruppe.NestlederID) ids.add(gruppe.NestlederID);
  return ids.size;
}

function ikonNavnForGruppe(
  db: DatabaseState,
  gruppe: { GruppeID: string; Gruppenavn: string }
): string {
  const roller = db.roller.filter((r) => r.Aktiv && r.GruppeID === gruppe.GruppeID);
  if (roller.length === 1) return roller[0].Rollenavn;
  if (roller.length > 1) {
    const nøkkel = gruppe.Gruppenavn.toLowerCase();
    const treff = roller.find(
      (r) =>
        nøkkel.includes(r.Rollenavn.toLowerCase()) ||
        r.Rollenavn.toLowerCase().split(/\s+/).some((ord) => ord.length > 2 && nøkkel.includes(ord))
    );
    return treff?.Rollenavn || roller[0].Rollenavn;
  }
  return gruppe.Gruppenavn;
}

const UTEN_GRUPPE = "__uten__";

type OversiktFilter = "bekreftet" | "venter" | "ledige" | "medlemmer" | null;

function iDagIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDatoKort(dato: string): string {
  const parsed = new Date(`${dato}T12:00:00`);
  if (isNaN(parsed.getTime())) return dato;
  return parsed.toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function bemanningForRolle(
  db: DatabaseState,
  gudstjenesteId: string,
  rolle: Rolle
): Bemanningstall {
  return summerBemanning(db, gudstjenesteId, [rolle]);
}

function unikeTjenestemedlemmer(db: DatabaseState): number {
  const gruppeIds = new Set(
    db.roller.filter((r) => r.Aktiv && r.GruppeID).map((r) => r.GruppeID as string)
  );
  const ids = new Set<string>();
  for (const gruppe of db.grupper) {
    if (!gruppeIds.has(gruppe.GruppeID)) continue;
    for (const gm of db.gruppemedlemmer) {
      if (gm.GruppeID === gruppe.GruppeID && gm.Aktiv) ids.add(gm.PersonID);
    }
    if (gruppe.GruppelederID) ids.add(gruppe.GruppelederID);
    if (gruppe.NestlederID) ids.add(gruppe.NestlederID);
  }
  return ids.size;
}

function trefferOversiktFilter(tall: Bemanningstall, filter: OversiktFilter): boolean {
  if (!filter || filter === "medlemmer") return true;
  if (filter === "ledige") return tall.ledige > 0;
  if (filter === "venter") return tall.venter > 0;
  return tall.bekreftet > 0;
}

type GruppeRad = {
  gruppeId: string;
  gruppenavn: string;
  lederId?: string;
  lederNavn?: string;
  lederFornavn?: string;
  tall: Bemanningstall;
  roller: Rolle[];
};

function gruppeRaderForGudstjeneste(
  db: DatabaseState,
  gudstjenesteId: string,
  alleRoller = false
): GruppeRad[] {
  const byId = new Map<string, GruppeRad>();
  for (const rolle of db.roller.filter((r) => r.Aktiv)) {
    const tall = bemanningForRolle(db, gudstjenesteId, rolle);
    const harNoe =
      tall.behov > 0 || tall.bekreftet > 0 || tall.venter > 0 || tall.forfall > 0;
    if (!alleRoller && !harNoe) continue;
    const gruppeId = rolle.GruppeID || UTEN_GRUPPE;
    const eksisterende = byId.get(gruppeId);
    if (eksisterende) {
      eksisterende.tall = plusBemanningstall(eksisterende.tall, tall);
      eksisterende.roller.push(rolle);
      continue;
    }
    const gruppe = db.grupper.find((g) => g.GruppeID === gruppeId);
    const leder = gruppe?.GruppelederID
      ? db.personer.find((p) => p.PersonID === gruppe.GruppelederID)
      : undefined;
    byId.set(gruppeId, {
      gruppeId,
      gruppenavn: gruppe?.Gruppenavn || "Uten gruppe",
      lederId: leder?.PersonID,
      lederNavn: leder?.Navn,
      lederFornavn: leder?.Fornavn || leder?.Navn,
      tall,
      roller: [rolle],
    });
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.gruppenavn.localeCompare(b.gruppenavn, "nb")
  );
}

function summerGruppeRader(rader: GruppeRad[]): Bemanningstall {
  return rader.reduce((acc, rad) => plusBemanningstall(acc, rad.tall), tomtBemanningstall());
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
  const [groupTypeFilter, setGroupTypeFilter] = useState("tjenestegruppe");
  const [detailGruppeId, setDetailGruppeId] = useState<string | null>(null);
  const [editingGruppeId, setEditingGruppeId] = useState<string | null>(null);
  const [newGroupModal, setNewGroupModal] = useState(false);
  const [groupOverviewView, setGroupOverviewView] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState<"all" | "leaders" | "admins" | "members">("all");
  const [copiedPersonId, setCopiedPersonId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedRolleForModal, setSelectedRolleForModal] = useState<Rolle | null>(null);

  // Modaler for oppretting/redigering
  const [newServiceModal, setNewServiceModal] = useState(false);
  const [newServiceData, setNewServiceData] = useState<Partial<Gudstjeneste>>({
    Dato: "",
    Tid: "11:00",
    Sted: "Hovedsalen, Sentrumskirken",
    Tema: "",
    Bibeltekst: "",
    Kollekt: "",
    Merknad: "",
  });

  const [newPersonModal, setNewPersonModal] = useState(false);
  const [newFornavn, setNewFornavn] = useState("");
  const [newPersonSlots, setNewPersonSlots] = useState<UkjentImportSlot[]>([]);
  const [newPersonGudstjenesteId, setNewPersonGudstjenesteId] = useState("");
  const [newPersonRolleId, setNewPersonRolleId] = useState("");
  const [assignNewFornavn, setAssignNewFornavn] = useState("");

  const [editNeedModal, setEditNeedModal] = useState<{
    gudstjenesteId: string;
    rolleId: string;
    currentBehov: number;
    rolleNavn: string;
  } | null>(null);
  const [customNeedInput, setCustomNeedInput] = useState<number>(1);

  const [assignModal, setAssignModal] = useState<{
    gudstjenesteId: string;
    rolleId: string;
    rolleNavn: string;
  } | null>(null);
  const [personToAssign, setPersonToAssign] = useState<string>("");
  const [apneGudstjenester, setApneGudstjenester] = useState<string[]>([]);
  const [uthevPersonId, setUthevPersonId] = useState<string | null>(null);
  const [scrollTilGudstjenesteId, setScrollTilGudstjenesteId] = useState<string | null>(null);
  const [visTidligere, setVisTidligere] = useState(false);
  const [folgOppLederId, setFolgOppLederId] = useState<string | null>(null);
  const [oversiktFilter, setOversiktFilter] = useState<OversiktFilter>(null);
  const [gudstjenesteKortFane, setGudstjenesteKortFane] = useState<
    Record<string, "bemanning" | "kjoreplan">
  >({});

  const ukjenteImportnavn = finnUkjenteImportnavn(db);

  const openNewPersonModal = (prefill?: { fornavn?: string; slots?: UkjentImportSlot[] }) => {
    setNewFornavn(prefill?.fornavn || "");
    setNewPersonSlots(prefill?.slots || []);
    setNewPersonGudstjenesteId(prefill?.slots?.[0]?.gudstjenesteId || "");
    setNewPersonRolleId(prefill?.slots?.[0]?.rolleId || "");
    setNewPersonModal(true);
  };

  const handleCopyLink = (personId: string, view?: AppView) => {
    const link = genererPersonligLenke(personId, view, db);
    navigator.clipboard.writeText(link).then(() => {
      const key = view ? `${personId}-${view}` : personId;
      setCopiedPersonId(key);
      setTimeout(() => setCopiedPersonId(null), 2500);
    });
  };

  // 1. Opprett Gudstjeneste
  const handleSaveNewService = () => {
    if (!newServiceData.Dato || !newServiceData.Tema) return;

    const maxGudstjenesteNr = db.gudstjenester.reduce((max, g) => {
      const num = parseInt(g.GudstjenesteID.replace(/\D/g, ""), 10);
      return !isNaN(num) && num > max ? num : max;
    }, 0);
    const newID = `GUD${String(maxGudstjenesteNr + 1).padStart(3, "0")}`;

    const newGudstjeneste: Gudstjeneste = {
      GudstjenesteID: newID,
      Dato: newServiceData.Dato,
      Tid: newServiceData.Tid || "11:00",
      Sted: newServiceData.Sted || "Sentrumskirken",
      Tema: newServiceData.Tema,
      Bibeltekst: newServiceData.Bibeltekst || "",
      Kollekt: newServiceData.Kollekt || "",
      Merknad: newServiceData.Merknad || "",
    };

    const updatedDb: DatabaseState = {
      ...db,
      gudstjenester: [...db.gudstjenester, newGudstjeneste],
    };

    saveDatabase(updatedDb);
    onUpdateDb(updatedDb);
    setNewServiceModal(false);
    setNewServiceData({
      Dato: "",
      Tid: "11:00",
      Sted: "Hovedsalen, Sentrumskirken",
      Tema: "",
      Bibeltekst: "",
      Kollekt: "",
      Merknad: "",
    });
  };

  const handleSaveNewPerson = () => {
    const fornavn = newFornavn.trim();
    if (!fornavn) return;

    let slots = newPersonSlots;
    if (slots.length === 0 && newPersonGudstjenesteId && newPersonRolleId) {
      const rolle = db.roller.find((r) => r.RolleID === newPersonRolleId);
      const gud = db.gudstjenester.find((g) => g.GudstjenesteID === newPersonGudstjenesteId);
      slots = [
        {
          gudstjenesteId: newPersonGudstjenesteId,
          rolleId: newPersonRolleId,
          rolleNavn: rolle?.Rollenavn || "",
          dato: gud?.Dato || "",
        },
      ];
    }

    const updatedDb = opprettPersonIRegister(db, { Navn: fornavn }, slots);
    saveDatabase(updatedDb);
    onUpdateDb(updatedDb);
    setNewPersonModal(false);
    setNewFornavn("");
    setNewPersonSlots([]);
    setNewPersonGudstjenesteId("");
    setNewPersonRolleId("");
  };

  const handleCreateAndAssign = () => {
    if (!assignModal) return;
    const fornavn = assignNewFornavn.trim();
    if (!fornavn) return;
    const eksisterende = finnPersonMedVisningsnavn(db, fornavn);
    if (eksisterende) {
      const updated = settDeltakelseForPerson(
        db,
        eksisterende.PersonID,
        assignModal.gudstjenesteId,
        assignModal.rolleId,
        "Avventer",
        "Forespurt av administrator"
      );
      saveDatabase(updated);
      onUpdateDb(updated);
      setAssignModal(null);
      setPersonToAssign("");
      setAssignNewFornavn("");
      return;
    }
    const gud = db.gudstjenester.find((g) => g.GudstjenesteID === assignModal.gudstjenesteId);
    const updatedDb = opprettPersonIRegister(db, { Navn: fornavn }, [
      {
        gudstjenesteId: assignModal.gudstjenesteId,
        rolleId: assignModal.rolleId,
        rolleNavn: assignModal.rolleNavn,
        dato: gud?.Dato || "",
      },
    ]);
    saveDatabase(updatedDb);
    onUpdateDb(updatedDb);
    setAssignModal(null);
    setPersonToAssign("");
    setAssignNewFornavn("");
  };

  // 3. Overstyr Tjenestebehov
  const handleSaveCustomNeed = () => {
    if (!editNeedModal) return;

    const now = new Date().toISOString().split("T")[0];
    const existingIndex = db.tjenestebehov.findIndex(
      (tb) =>
        tb.GudstjenesteID === editNeedModal.gudstjenesteId &&
        tb.RolleID === editNeedModal.rolleId
    );

    let updatedTjenestebehov: Tjenestebehov[];

    if (existingIndex >= 0) {
      updatedTjenestebehov = [...db.tjenestebehov];
      updatedTjenestebehov[existingIndex] = {
        ...updatedTjenestebehov[existingIndex],
        Antall: customNeedInput,
        Aktiv: true,
        SistEndret: now,
      };
    } else {
      const maxNr = db.tjenestebehov.reduce((max, tb) => {
        const num = parseInt(tb.TjenestebehovID.replace(/\D/g, ""), 10);
        return !isNaN(num) && num > max ? num : max;
      }, 0);
      const newID = `TB${String(maxNr + 1).padStart(3, "0")}`;

      const newTB: Tjenestebehov = {
        TjenestebehovID: newID,
        GudstjenesteID: editNeedModal.gudstjenesteId,
        RolleID: editNeedModal.rolleId,
        Antall: customNeedInput,
        Aktiv: true,
        OpprettetDato: now,
        SistEndret: now,
      };
      updatedTjenestebehov = [...db.tjenestebehov, newTB];
    }

    const updatedDb: DatabaseState = {
      ...db,
      tjenestebehov: updatedTjenestebehov,
    };

    saveDatabase(updatedDb);
    onUpdateDb(updatedDb);
    setEditNeedModal(null);
  };

  // 4. Manuell Tildeling
  const handleAssignPerson = () => {
    if (!assignModal || !personToAssign) return;
    if (
      personHarAktivTildeling(
        db,
        personToAssign,
        assignModal.gudstjenesteId,
        assignModal.rolleId
      )
    ) {
      setAssignModal(null);
      setPersonToAssign("");
      return;
    }
    const updated = settDeltakelseForPerson(
      db,
      personToAssign,
      assignModal.gudstjenesteId,
      assignModal.rolleId,
      "Avventer",
      "Forespurt av administrator"
    );
    saveDatabase(updated);
    onUpdateDb(updated);
    setAssignModal(null);
    setPersonToAssign("");
  };

  // 5. Fjern Tildeling
  const handleRemoveTildeling = (tildelingId: string) => {
    const updatedDb: DatabaseState = {
      ...db,
      tildelinger: db.tildelinger.filter((t) => t.TildelingID !== tildelingId),
      svar: db.svar.filter((s) => s.TildelingID !== tildelingId),
    };

    saveDatabase(updatedDb);
    onUpdateDb(updatedDb);
  };

  // 6. Oppdater status for tildeling (Bekreftet / Venter / Avvist)
  const handleUpdatePersonStatus = (
    tildelingId: string,
    personId: string,
    nyttSvar: "Bekreftet" | "Venter" | "Avvist"
  ) => {
    const kommentar =
      nyttSvar === "Bekreftet"
        ? "Bekreftet av administrator (muntlig/ja)"
        : nyttSvar === "Avvist"
        ? "Meldt forfall via administrator"
        : "Forespurt av administrator";
    const updatedDb = svarPaaTildeling(db, tildelingId, personId, nyttSvar, kommentar);
    saveDatabase(updatedDb);
    onUpdateDb(updatedDb);
  };

  const handleOppdaterRolle = (
    rolleId: string,
    patch: { GruppeID?: string; Behov?: number }
  ) => {
    const now = new Date().toISOString().split("T")[0];
    const updatedDb: DatabaseState = {
      ...db,
      roller: db.roller.map((r) =>
        r.RolleID === rolleId
          ? {
              ...r,
              ...("GruppeID" in patch ? { GruppeID: patch.GruppeID || undefined } : {}),
              ...("Behov" in patch && patch.Behov !== undefined ? { Behov: patch.Behov } : {}),
              SistEndret: now,
            }
          : r
      ),
    };
    saveDatabase(updatedDb);
    onUpdateDb(updatedDb);
  };

  const handleLagreRolleinstruks = (rolleId: string, tekst: string) => {
    const now = new Date().toISOString().split("T")[0];
    const eksisterer = db.rollebeskrivelser.some((rb) => rb.RolleID === rolleId);
    const rollebeskrivelser = eksisterer
      ? db.rollebeskrivelser.map((rb) =>
          rb.RolleID === rolleId
            ? { ...rb, Rollebeskrivelse: tekst, SistEndret: now }
            : rb
        )
      : [
          ...db.rollebeskrivelser,
          {
            RolleID: rolleId,
            Rollebeskrivelse: tekst,
            Aktiv: true,
            OpprettetDato: now,
            SistEndret: now,
          },
        ];
    const updatedDb: DatabaseState = { ...db, rollebeskrivelser };
    saveDatabase(updatedDb);
    onUpdateDb(updatedDb);
  };

  // Filtrering for personer
  const filteredPersoner = db.personer.filter((p) => {
    const matchesSearch =
      p.Navn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.Epost || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.PersonID.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedGroupFilter !== "all") {
      const tilknyttet = finnTjenestegrupperForPerson(db, p.PersonID).some(
        (t) => t.gruppe.GruppeID === selectedGroupFilter
      );
      if (!tilknyttet) return false;
    }

    if (roleFilter !== "all") {
      const tilgang = hentTilgang(db, p.PersonID);
      if (roleFilter === "leaders" && !tilgang.isLeader) return false;
      if (roleFilter === "admins" && !tilgang.isAdmin) return false;
      if (roleFilter === "members" && (tilgang.isLeader || tilgang.isAdmin)) return false;
    }

    return true;
  });

  const iDag = iDagIso();
  const sorterteGudstjenester = db.gudstjenester.slice().sort((a, b) =>
    `${a.Dato} ${a.Tid}`.localeCompare(`${b.Dato} ${b.Tid}`)
  );
  const kommendeGudstjenester = sorterteGudstjenester.filter((g) => g.Dato >= iDag);
  const tidligereGudstjenester = sorterteGudstjenester.filter((g) => g.Dato < iDag).reverse();

  const lederOppfolging = (() => {
    const perLeder = new Map<
      string,
      { personId: string; fornavn: string; navn: string; sondager: Set<string> }
    >();
    for (const gud of kommendeGudstjenester) {
      for (const rad of gruppeRaderForGudstjeneste(db, gud.GudstjenesteID)) {
        if (rad.tall.ledige <= 0 || !rad.lederId) continue;
        const eksisterende = perLeder.get(rad.lederId);
        if (eksisterende) {
          eksisterende.sondager.add(gud.GudstjenesteID);
        } else {
          perLeder.set(rad.lederId, {
            personId: rad.lederId,
            fornavn: rad.lederFornavn || rad.lederNavn || "Leder",
            navn: rad.lederNavn || rad.lederFornavn || "Leder",
            sondager: new Set([gud.GudstjenesteID]),
          });
        }
      }
    }
    return Array.from(perLeder.values()).sort((a, b) => b.sondager.size - a.sondager.size);
  })();

  const semesterOversikt = kommendeGudstjenester.reduce(
    (acc, gud) =>
      plusBemanningstall(
        acc,
        summerBemanning(
          db,
          gud.GudstjenesteID,
          db.roller.filter((r) => r.Aktiv)
        )
      ),
    tomtBemanningstall()
  );
  const ledigeOgForfall = semesterOversikt.ledige;
  const bekreftetProsent =
    semesterOversikt.behov > 0
      ? Math.round((semesterOversikt.bekreftet / semesterOversikt.behov) * 100)
      : 0;
  const medlemstall = unikeTjenestemedlemmer(db);

  const visKommendeGudstjenester = kommendeGudstjenester.filter((gud) => {
    const rader = gruppeRaderForGudstjeneste(db, gud.GudstjenesteID);
    const totalt = summerGruppeRader(rader);
    if (folgOppLederId) {
      const lederTreff = rader.some(
        (rad) => rad.lederId === folgOppLederId && rad.tall.ledige > 0
      );
      if (!lederTreff) return false;
    }
    return trefferOversiktFilter(totalt, oversiktFilter);
  });

  const visTidligereFiltrert = tidligereGudstjenester.filter((gud) => {
    const totalt = summerGruppeRader(gruppeRaderForGudstjeneste(db, gud.GudstjenesteID));
    return trefferOversiktFilter(totalt, oversiktFilter);
  });

  useEffect(() => {
    if (oversiktFilter !== "venter") return;
    const ids = db.gudstjenester
      .filter((gud) => gud.Dato >= iDag)
      .filter((gud) =>
        trefferOversiktFilter(
          summerGruppeRader(gruppeRaderForGudstjeneste(db, gud.GudstjenesteID)),
          "venter"
        )
      )
      .map((gud) => gud.GudstjenesteID);
    setApneGudstjenester(ids);
  }, [oversiktFilter, db, iDag]);

  useEffect(() => {
    if (activeTab !== "services" || !scrollTilGudstjenesteId) return;
    const id = scrollTilGudstjenesteId;
    const t = window.setTimeout(() => {
      document.getElementById(`gudstjeneste-${id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setScrollTilGudstjenesteId(null);
    }, 50);
    return () => window.clearTimeout(t);
  }, [activeTab, scrollTilGudstjenesteId]);

  useEffect(() => {
    if (!uthevPersonId) return;
    const t = window.setTimeout(() => setUthevPersonId(null), 8000);
    return () => window.clearTimeout(t);
  }, [uthevPersonId]);

  const velgOversiktFilter = (neste: Exclude<OversiktFilter, null>) => {
    const aktiv: OversiktFilter = oversiktFilter === neste ? null : neste;
    setOversiktFilter(aktiv);
    if (aktiv === "medlemmer") {
      setActiveTab("groups");
      setGroupTypeFilter("tjenestegruppe");
    }
  };

  const vekselFolgOppLeder = (personId: string) => {
    setFolgOppLederId((prev) => (prev === personId ? null : personId));
  };

  const vekselApne = (id: string) => {
    setApneGudstjenester((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const renderRolleRad = (gudstjenesteId: string, rolle: Rolle) => {
    const effektivtBehov = getEffektivtBehov(gudstjenesteId, rolle, db.tjenestebehov);
    const isOverridden = db.tjenestebehov.some(
      (tb) =>
        tb.GudstjenesteID === gudstjenesteId && tb.RolleID === rolle.RolleID && tb.Aktiv
    );
    const tildelinger = db.tildelinger.filter(
      (t) => t.GudstjenesteID === gudstjenesteId && t.RolleID === rolle.RolleID
    );
    const antallBekreftet = tildelinger.filter(
      (t) => hentSvarStatus(db, t.TildelingID) === "Bekreftet"
    ).length;
    const erFull = antallBekreftet >= effektivtBehov;

    return (
      <div
        key={rolle.RolleID}
        className="px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2"
      >
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setSelectedRolleForModal(rolle)}
            title="Se instruks"
            className="flex items-center gap-3 min-w-0 text-left cursor-pointer rounded-xl hover:bg-slate-100/80 -ml-1 px-1 py-0.5"
          >
            <RolleIkon rollenavn={rolle.Rollenavn} />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
              {rolle.Rollenavn}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEditNeedModal({
                gudstjenesteId,
                rolleId: rolle.RolleID,
                currentBehov: effektivtBehov,
                rolleNavn: rolle.Rollenavn,
              });
              setCustomNeedInput(effektivtBehov);
            }}
            title="Veiledende antall. Overbooking er greit."
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition shrink-0 ${
              erFull
                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                : "bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-800"
            }`}
          >
            <span>
              {antallBekreftet} / {effektivtBehov}
            </span>
            <Sliders className="w-2.5 h-2.5 opacity-60" />
          </button>
          {isOverridden && (
            <span className="text-[9px] text-[#2d5a3f] bg-[#eef5f1] border border-[#d2e8d9] px-1 rounded shrink-0">
              Std: {rolle.Behov}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5 sm:ml-auto min-w-0">
          {tildelinger.map((t) => {
            const p = db.personer.find((pers) => pers.PersonID === t.PersonID);
            const status = hentSvarStatus(db, t.TildelingID);
            const isBekreftet = status === "Bekreftet";
            const isAvvist = status === "Avvist";
            const visningsnavn = tildelingVisningsnavn(db, t);
            return (
              <div
                key={t.TildelingID}
                className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-xl text-xs border ${
                  uthevPersonId === t.PersonID ? "ring-2 ring-[#2d5a3f] ring-offset-1" : ""
                } ${
                  isBekreftet
                    ? "bg-emerald-50/80 border-emerald-200 text-emerald-950 font-medium"
                    : isAvvist
                    ? "bg-rose-50/80 border-rose-200 text-rose-800"
                    : "bg-amber-50/80 border-amber-200 text-amber-950 font-medium"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isBekreftet ? "bg-emerald-500" : isAvvist ? "bg-rose-500" : "bg-amber-400"
                  }`}
                  title={
                    isBekreftet
                      ? "Bekreftet"
                      : isAvvist
                      ? "Meldt forfall / Kan ikke"
                      : "Forespurt (venter svar)"
                  }
                />
                <span
                  className={`max-w-[120px] truncate ${isAvvist ? "line-through opacity-75" : ""}`}
                  title={p?.Navn || visningsnavn}
                >
                  {visningsnavn}
                </span>
                {t.EksternNavn ? (
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                    Ekstern
                  </span>
                ) : null}
                <IkonHandling
                  label="Bekreft (personen har sagt ja)"
                  Icon={Check}
                  variant="confirm"
                  active={isBekreftet}
                  onClick={() => handleUpdatePersonStatus(t.TildelingID, t.PersonID, "Bekreftet")}
                />
                <IkonHandling
                  label="Sett status til forespurt / venter svar"
                  Icon={Clock}
                  variant="wait"
                  active={status === "Venter"}
                  onClick={() => handleUpdatePersonStatus(t.TildelingID, t.PersonID, "Venter")}
                />
                <IkonHandling
                  label="Marker som forfall / kan ikke"
                  Icon={X}
                  variant="decline"
                  active={isAvvist}
                  onClick={() => handleUpdatePersonStatus(t.TildelingID, t.PersonID, "Avvist")}
                />
                <IkonHandling
                  label="Fjern tildeling"
                  Icon={Trash2}
                  variant="decline"
                  onClick={() => handleRemoveTildeling(t.TildelingID)}
                />
              </div>
            );
          })}
          <button
            type="button"
            onClick={() =>
              setAssignModal({
                gudstjenesteId,
                rolleId: rolle.RolleID,
                rolleNavn: rolle.Rollenavn,
              })
            }
            className="p-1.5 bg-[#eef5f1] hover:bg-[#dff0e6] text-[#2d5a3f] border border-[#d2e8d9] rounded-lg cursor-pointer transition shadow-2xs shrink-0"
            title="Tildel"
            aria-label="Tildel"
          >
            <UserPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const renderGudstjenesteKort = (gudstjeneste: Gudstjeneste) => {
    const visAlleTall = !oversiktFilter || oversiktFilter === "medlemmer";
    const alleRader = gruppeRaderForGudstjeneste(
      db,
      gudstjeneste.GudstjenesteID,
      visAlleTall
    );
    const totalt = summerGruppeRader(
      gruppeRaderForGudstjeneste(db, gudstjeneste.GudstjenesteID, false)
    );
    const rader = visAlleTall
      ? alleRader
      : alleRader.filter((rad) => trefferOversiktFilter(rad.tall, oversiktFilter));
    const hullGrupper = alleRader.filter((r) => r.tall.ledige > 0);
    const venterGrupper = alleRader.filter((r) => r.tall.venter > 0);
    const erApen = apneGudstjenester.includes(gudstjeneste.GudstjenesteID);
    const kant = visAlleTall
      ? totalt.ledige > 0
        ? "border-l-[3px] border-l-rose-400"
        : totalt.venter > 0
          ? "border-l-[3px] border-l-amber-400"
          : "border-l-[3px] border-l-transparent opacity-80"
      : oversiktFilter === "ledige"
        ? "border-l-[3px] border-l-rose-400"
        : oversiktFilter === "venter"
          ? "border-l-[3px] border-l-amber-400"
          : "border-l-[3px] border-l-emerald-400";

    return (
      <div
        key={gudstjeneste.GudstjenesteID}
        id={`gudstjeneste-${gudstjeneste.GudstjenesteID}`}
        className={`bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden ${kant}`}
      >
        <button
          type="button"
          onClick={() => vekselApne(gudstjeneste.GudstjenesteID)}
          aria-expanded={erApen}
          className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50/80 cursor-pointer"
        >
          {erApen ? (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
              <span className="font-semibold text-[#2d5a3f]">
                {formatDatoKort(gudstjeneste.Dato)}
                {gudstjeneste.Tid ? ` · kl. ${gudstjeneste.Tid}` : ""}
              </span>
              <span className="font-bold text-slate-900 truncate">
                {gudstjeneste.Tema || "Gudstjeneste"}
              </span>
              {gudstjeneste.Sted && (
                <span className="hidden sm:inline text-xs text-slate-500 truncate">
                  · {gudstjeneste.Sted}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              {visAlleTall ? (
                hullGrupper.length > 0 ? (
                  <>
                    <span className="font-semibold text-rose-800">
                      {totalt.ledige} ledige
                    </span>
                    <span className="text-slate-500">
                      {" · "}
                      {hullGrupper.map((g) => g.gruppenavn).join(", ")}
                    </span>
                  </>
                ) : totalt.venter > 0 ? (
                  <span className="font-semibold text-amber-800">{totalt.venter} venter</span>
                ) : (
                  <span className="text-emerald-700 font-medium">Komplett</span>
                )
              ) : oversiktFilter === "ledige" ? (
                <span className="font-semibold text-rose-800">
                  {totalt.ledige} ledige
                  {hullGrupper.length > 0 ? ` · ${hullGrupper.map((g) => g.gruppenavn).join(", ")}` : ""}
                </span>
              ) : oversiktFilter === "venter" ? (
                <span className="font-semibold text-amber-800">
                  {totalt.venter} venter
                  {venterGrupper.length > 0
                    ? ` · ${venterGrupper.map((g) => g.gruppenavn).join(", ")}`
                    : ""}
                </span>
              ) : (
                <span className="font-semibold text-emerald-800">{totalt.bekreftet} bekreftet</span>
              )}
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-[11px] tabular-nums font-semibold shrink-0">
            {visAlleTall ? (
              <>
                <span className={totalt.bekreftet ? "text-emerald-700" : "text-slate-400"}>
                  {totalt.bekreftet} bekr.
                </span>
                <span className={totalt.venter ? "text-amber-800" : "text-slate-400"}>
                  {totalt.venter} venter
                </span>
                <span className={totalt.ledige ? "text-rose-800" : "text-slate-400"}>
                  {totalt.ledige} ledige
                </span>
              </>
            ) : oversiktFilter === "bekreftet" ? (
              <span className="text-emerald-700">{totalt.bekreftet} bekr.</span>
            ) : oversiktFilter === "venter" ? (
              <span className="text-amber-800">{totalt.venter} venter</span>
            ) : (
              <span className="text-rose-800">{totalt.ledige} ledige</span>
            )}
          </div>
        </button>

        {erApen && (
          <div className="border-t border-slate-100">
            <div className="flex border-b border-slate-100 px-2">
              {(
                [
                  ["bemanning", "Bemanning"],
                  ["kjoreplan", "Kjøreplan"],
                ] as const
              ).map(([id, label]) => {
                const aktiv = (gudstjenesteKortFane[gudstjeneste.GudstjenesteID] || "bemanning") === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setGudstjenesteKortFane((prev) => ({
                        ...prev,
                        [gudstjeneste.GudstjenesteID]: id,
                      }));
                    }}
                    className={`px-3 py-2 text-xs font-semibold cursor-pointer ${
                      aktiv
                        ? "text-[#2d5a3f] border-b-2 border-[#2d5a3f]"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {(gudstjenesteKortFane[gudstjeneste.GudstjenesteID] || "bemanning") === "kjoreplan" ? (
              <GudstjenesteProgramView
                db={db}
                gudstjeneste={gudstjeneste}
                redigerbar
                selectedPersonId={selectedPersonId}
                onUpdateDb={onUpdateDb}
              />
            ) : (
              <>
            {(gudstjeneste.Bibeltekst || gudstjeneste.Kollekt) && (
              <div className="px-4 py-2 text-xs text-slate-600 flex flex-wrap gap-3 bg-slate-50/50">
                {gudstjeneste.Bibeltekst && (
                  <span>
                    Bibeltekst:{" "}
                    <span className="font-medium text-slate-800">{gudstjeneste.Bibeltekst}</span>
                  </span>
                )}
                {gudstjeneste.Kollekt && (
                  <span>
                    Kollekt:{" "}
                    <span className="font-medium text-[#2d5a3f]">{gudstjeneste.Kollekt}</span>
                  </span>
                )}
              </div>
            )}
            <div className="divide-y divide-slate-100">
              {rader.map((rad) => {
                const komplett = rad.tall.ledige === 0 && rad.tall.venter === 0;
                const visRoller = visAlleTall
                  ? rad.roller
                  : rad.roller.filter((rolle) =>
                      trefferOversiktFilter(
                        bemanningForRolle(db, gudstjeneste.GudstjenesteID, rolle),
                        oversiktFilter
                      )
                    );
                return (
                  <div
                    key={rad.gruppeId}
                    className={`px-4 py-2.5 ${visAlleTall && komplett ? "opacity-70" : ""}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 min-w-[7rem]">
                        {rad.gruppenavn}
                      </span>
                      <span className="text-xs text-slate-600 min-w-[6rem]">
                        {rad.lederNavn || "Ingen leder"}
                      </span>
                      <span className="text-[11px] tabular-nums font-semibold flex items-center gap-2">
                        <span className={rad.tall.bekreftet ? "text-emerald-700" : "text-slate-400"}>
                          {rad.tall.bekreftet} bekr.
                        </span>
                        <span className={rad.tall.venter ? "text-amber-800" : "text-slate-400"}>
                          {rad.tall.venter} venter
                        </span>
                        <span className={rad.tall.ledige ? "text-rose-800" : "text-slate-400"}>
                          {rad.tall.ledige} ledige
                        </span>
                      </span>
                      <div className="flex items-center gap-1 ml-auto">
                        {rad.lederId && (
                          <>
                            <IkonHandling
                              label="Kopier leder-lenke"
                              Icon={Share2}
                              variant="sky"
                              copied={copiedPersonId === `${rad.lederId}-leader`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyLink(rad.lederId!, "leader");
                              }}
                            />
                            <IkonHandling
                              label="Se som denne lederen"
                              Icon={Eye}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectPerson(rad.lederId!, "leader");
                              }}
                            />
                          </>
                        )}
                      </div>
                    </div>
                    {visRoller.length > 0 && (
                      <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/60 divide-y divide-slate-100">
                        {visRoller.map((rolle) =>
                          renderRolleRad(gudstjeneste.GudstjenesteID, rolle)
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {rader.length === 0 && (
                <p className="px-4 py-4 text-sm text-slate-500">Ingen roller med behov denne dagen.</p>
              )}
            </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {ukjenteImportnavn.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-950">
                Ukjente navn i oppgavefordelingen
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                Disse står i importen, men ikke i personregisteret. Etternavn tas med hvis det står i tabellen. Opprett og tildel herfra — uten å redigere arket.
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {ukjenteImportnavn.map((item) => (
              <li
                key={item.navn}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white/70 rounded-xl px-3 py-2 border border-amber-100"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900">{item.navn}</div>
                  <div className="text-xs text-slate-600">
                    {item.slots
                      .map((s) => (s.dato ? `${s.rolleNavn} · ${s.dato}` : s.rolleNavn))
                      .join(" · ")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openNewPersonModal({ fornavn: item.navn, slots: item.slots })}
                  className="px-3 py-1.5 bg-[#2d5a3f] hover:bg-[#234731] text-white text-xs font-semibold rounded-lg cursor-pointer self-start"
                >
                  Opprett person
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Admin Faner */}
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
          <FileSpreadsheet className="w-4 h-4" />
          <span>Google Sheets & Data</span>
        </button>
      </div>

      {/* FANE 1: GUDSTJENESTER & OPPGAVEPLAN (LISTEFORM MED ADMIN-KONTROLLER) */}
      {activeTab === "services" && (
        <div className="space-y-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Semesteret totalt
                </p>
                <p className="text-sm text-slate-600">
                  Alle tjenestegrupper på kommende gudstjenester. Trykk et kort for å filtrere.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNewServiceModal(true)}
                className="px-3.5 py-2 bg-[#2d5a3f] hover:bg-[#234731] text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Ny gudstjeneste</span>
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(
                [
                  {
                    id: "ledige" as const,
                    tall: ledigeOgForfall,
                    label: "Ledige slotter / Forfall",
                    Icon: AlertCircle,
                    wrap: "bg-rose-50 border-rose-100 text-rose-950",
                    icon: "text-rose-500",
                    aktiv: "ring-2 ring-rose-400",
                  },
                  {
                    id: "venter" as const,
                    tall: semesterOversikt.venter,
                    label: "Venter på svar",
                    Icon: CircleHelp,
                    wrap: "bg-amber-50 border-amber-100 text-amber-950",
                    icon: "text-amber-500",
                    aktiv: "ring-2 ring-amber-400",
                  },
                  {
                    id: "bekreftet" as const,
                    tall: semesterOversikt.bekreftet,
                    label: `Bekreftet (${bekreftetProsent}%)`,
                    Icon: CheckCircle2,
                    wrap: "bg-emerald-50 border-emerald-100 text-emerald-900",
                    icon: "text-emerald-600",
                    aktiv: "ring-2 ring-emerald-400",
                  },
                  {
                    id: "medlemmer" as const,
                    tall: medlemstall,
                    label: "Medlemmer",
                    Icon: Users,
                    wrap: "bg-sky-50 border-sky-100 text-sky-950",
                    icon: "text-sky-600",
                    aktiv: "ring-2 ring-sky-300",
                  },
                ]
              ).map((kort) => {
                const valgt = oversiktFilter === kort.id;
                return (
                  <button
                    key={kort.id}
                    type="button"
                    onClick={() => velgOversiktFilter(kort.id)}
                    aria-pressed={valgt}
                    className={`text-left rounded-2xl border px-4 py-3 transition cursor-pointer ${kort.wrap} ${
                      valgt ? kort.aktiv : "hover:brightness-[0.98]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-3xl font-bold tabular-nums leading-none">{kort.tall}</span>
                      <kort.Icon className={`w-6 h-6 ${kort.icon} shrink-0`} />
                    </div>
                    <p className="text-xs font-semibold mt-2 leading-snug">{kort.label}</p>
                  </button>
                );
              })}
            </div>
            {oversiktFilter && oversiktFilter !== "medlemmer" && (
              <p className="text-[11px] text-slate-500">
                Viser{" "}
                {oversiktFilter === "bekreftet"
                  ? "søndager med bekreftede oppgaver"
                  : oversiktFilter === "venter"
                    ? "søndager der noen venter på å svare"
                    : "søndager med ledige plasser"}
                . Trykk kortet igjen for å vise alle.
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {lederOppfolging.length > 0 ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
                  Følg opp
                </span>
                {lederOppfolging.map((leder) => {
                  const valgt = folgOppLederId === leder.personId;
                  return (
                  <span
                    key={leder.personId}
                    className={`inline-flex items-center gap-1 rounded-lg pl-1.5 pr-0.5 py-0.5 ${
                      valgt ? "bg-[#eef5f1] ring-2 ring-[#2d5a3f]/35" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => vekselFolgOppLeder(leder.personId)}
                      aria-pressed={valgt}
                      title={
                        valgt
                          ? "Vis alle kommende gudstjenester"
                          : `Vis søndager der ${leder.navn} har ledige plasser`
                      }
                      className="text-sm font-semibold text-slate-900 cursor-pointer hover:text-[#2d5a3f]"
                    >
                      {leder.fornavn}
                      <span className="text-slate-500 font-medium"> ({leder.sondager.size})</span>
                    </button>
                    <IkonHandling
                      label={`Kopier leder-lenke til ${leder.navn}`}
                      Icon={Share2}
                      variant="sky"
                      copied={copiedPersonId === `${leder.personId}-leader`}
                      onClick={() => handleCopyLink(leder.personId, "leader")}
                    />
                  </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Alle grupper er dekket på kommende søndager.</p>
            )}
          </div>

          <div className="space-y-2">
            {visKommendeGudstjenester.map((gudstjeneste) => renderGudstjenesteKort(gudstjeneste))}
            {visKommendeGudstjenester.length === 0 && (
              <p className="text-sm text-slate-500 bg-white rounded-2xl border border-slate-200 px-4 py-6 text-center">
                {folgOppLederId || oversiktFilter
                  ? "Ingen treff for dette filteret. Trykk kortet eller navnet igjen for å vise alle."
                  : "Ingen kommende gudstjenester."}
              </p>
            )}
          </div>

          {visTidligereFiltrert.length > 0 && oversiktFilter !== "medlemmer" && (
            <div>
              <button
                type="button"
                onClick={() => setVisTidligere((v) => !v)}
                aria-expanded={visTidligere}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                {visTidligere ? "Skjul tidligere" : `Tidligere (${visTidligereFiltrert.length})`}
              </button>
              {visTidligere && (
                <div className="space-y-2 mt-2">
                  {visTidligereFiltrert.map((gudstjeneste) => renderGudstjenesteKort(gudstjeneste))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {activeTab === "belastning" && (
        <BelastningView
          db={db}
          onVelgGudstjeneste={(gudstjenesteId, personId) => {
            setOversiktFilter(null);
            setActiveTab("services");
            setApneGudstjenester([gudstjenesteId]);
            setUthevPersonId(personId);
            setScrollTilGudstjenesteId(gudstjenesteId);
          }}
        />
      )}
      {/* FANE 2: PERSONREGISTER */}
      {activeTab === "people" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-slate-900">
              {filteredPersoner.length} personer
            </h3>

            <button
              onClick={() => openNewPersonModal()}
              className="px-3.5 py-2 bg-[#2d5a3f] hover:bg-[#234731] text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Ny person</span>
            </button>
          </div>

          {/* Søk og filter */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3.5 rounded-2xl border border-slate-200">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Søk på navn eller e-post..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedGroupFilter}
                onChange={(e) => setSelectedGroupFilter(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl p-2 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
              >
                <option value="all">Alle grupper</option>
                {db.grupper.map((g) => (
                  <option key={g.GruppeID} value={g.GruppeID}>
                    {g.Gruppenavn}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="w-full text-xs border border-slate-200 rounded-xl p-2 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
              >
                <option value="all">Alle tilganger / roller</option>
                <option value="leaders">Kun tjenestegruppeledere</option>
                <option value="admins">Kun administratorer</option>
                <option value="members">Kun ordinære medlemmer</option>
              </select>
            </div>
          </div>

          {/* Persontabell */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Navn</th>
                  <th className="p-3">Kontaktinfo</th>
                  <th className="p-3">Tilgang & Lederansvar</th>
                  <th className="p-3">Personroller (Godkjente)</th>
                  <th className="p-3">Tjenestegrupper</th>
                  <th className="p-3 text-right">Direktelenker</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredPersoner.map((person) => {
                  const personTilgang = hentTilgang(db, person.PersonID);
                  const isCopiedGeneral = copiedPersonId === person.PersonID;
                  const isCopiedLeader = copiedPersonId === `${person.PersonID}-leader`;
                  const isCopiedPersonal = copiedPersonId === `${person.PersonID}-personal`;

                  const personensRolleIds = db.personroller
                    .filter((pr) => pr.PersonID === person.PersonID && pr.Aktiv)
                    .map((pr) => pr.RolleID);
                  const personensRoller = db.roller.filter((r) =>
                    personensRolleIds.includes(r.RolleID)
                  );

                  const personensGrupper = finnTjenestegrupperForPerson(db, person.PersonID);
                  const lederGrupper = personensGrupper.filter((t) => t.tilknytning === "Leder" || t.tilknytning === "Nestleder");

                  return (
                    <tr key={person.PersonID} className="hover:bg-slate-50/70 transition">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{person.Navn}</div>
                        {person.Notat && (
                          <div className="text-[11px] text-slate-400 italic">
                            {person.Notat}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div>{person.Epost}</div>
                        <div className="text-slate-400">{person.Telefon}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1 items-start">
                          {personTilgang.isAdmin && (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-200">
                              <Shield className="w-3 h-3" />
                              Administrator
                            </span>
                          )}
                          {personTilgang.isLeader && (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-200">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                              Tjenestegruppeleder
                              {lederGrupper.length > 0 && ` (${lederGrupper.map((g) => g.gruppe.Gruppenavn).join(", ")})`}
                            </span>
                          )}
                          {!personTilgang.isAdmin && !personTilgang.isLeader && (
                            <span className="inline-flex items-center text-slate-500 text-[11px]">
                              Medlem (Min side)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {personensRoller.map((r) => (
                            <span
                              key={r.RolleID}
                              className="bg-[#eef5f1] text-[#2d5a3f] text-[10px] font-medium px-1.5 py-0.5 rounded border border-[#d2e8d9]"
                            >
                              {r.Rollenavn}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {personensGrupper.map((t) => (
                            <span
                              key={t.gruppe.GruppeID}
                              className="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded"
                            >
                              {t.gruppe.Gruppenavn}
                              {t.tilknytning !== "Medlem" ? ` (${t.tilknytning})` : ""}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {personTilgang.isLeader && (
                            <IkonHandling
                              label="Kopier leder-lenke"
                              Icon={Share2}
                              variant="sky"
                              copied={isCopiedLeader}
                              onClick={() => handleCopyLink(person.PersonID, "leader")}
                            />
                          )}
                          <IkonHandling
                            label="Kopier Min side-lenke"
                            Icon={Share2}
                            copied={isCopiedGeneral || isCopiedPersonal}
                            onClick={() => handleCopyLink(person.PersonID)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FANE 3: GRUPPER */}
      {activeTab === "groups" && (
        <div className="space-y-6">
          {/* Tjenestegrupper */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="min-w-0">
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UsersRound className="w-4 h-4 text-[#2d5a3f]" />
                  <span>Tjenestegrupper</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Klikk på en gruppe for detaljer. Del leder-lenken med ikonet.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                  <select
                    value={groupTypeFilter}
                    onChange={(e) => setGroupTypeFilter(e.target.value)}
                    className="text-xs border border-slate-200 rounded-full px-3 py-2 bg-white focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f] min-w-[180px]"
                  >
                    {GRUPPEFILTER.filter((f) => !f.seksjon).map((f) => {
                      const n = antallGrupperForFilter(db, f.id);
                      return (
                        <option key={f.id} value={f.id} disabled={n === 0}>
                          {f.label}
                          {n === 0 ? " (ingen ennå)" : ` (${n})`}
                        </option>
                      );
                    })}
                    <optgroup label="Ledelse">
                      {GRUPPEFILTER.filter((f) => f.seksjon === "Ledelse").map((f) => {
                        const n = antallGrupperForFilter(db, f.id);
                        return (
                          <option key={f.id} value={f.id} disabled={n === 0}>
                            {f.label}
                            {n === 0 ? " (ingen ennå)" : ` (${n})`}
                          </option>
                        );
                      })}
                    </optgroup>
                  </select>
                </div>
                <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setGroupOverviewView("grid")}
                    className={`p-1.5 rounded-lg cursor-pointer ${
                      groupOverviewView === "grid"
                        ? "bg-white text-[#2d5a3f] shadow-xs"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                    title="Rutenett"
                    aria-label="Rutenett"
                    aria-pressed={groupOverviewView === "grid"}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupOverviewView("list")}
                    className={`p-1.5 rounded-lg cursor-pointer ${
                      groupOverviewView === "list"
                        ? "bg-white text-[#2d5a3f] shadow-xs"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                    title="Liste"
                    aria-label="Liste"
                    aria-pressed={groupOverviewView === "list"}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setNewGroupModal(true)}
                  className="px-3.5 py-2 bg-[#2d5a3f] hover:bg-[#234731] text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ny gruppe</span>
                </button>
              </div>
            </div>

            <div
              className={
                groupOverviewView === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
                  : "flex flex-col gap-2"
              }
            >
              {db.grupper
                .filter((g) => {
                  if (!g.Aktiv) return false;
                  const ids = gruppetypeIderForFilter(db, groupTypeFilter);
                  if (ids.length === 0 && groupTypeFilter === "tjenestegruppe") return true;
                  return ids.includes(g.GruppetypeID);
                })
                .map((gruppe) => {
                  const leder = db.personer.find((p) => p.PersonID === gruppe.GruppelederID);
                  const nestleder = db.personer.find((p) => p.PersonID === gruppe.NestlederID);
                  const medlemstall = antallMedlemmerIGruppe(db, gruppe);
                  const ikonNavn = ikonNavnForGruppe(db, gruppe);
                  const isCopiedLeder = leder && copiedPersonId === `${leder.PersonID}-leader`;
                  const isCopiedNestleder = nestleder && copiedPersonId === `${nestleder.PersonID}-leader`;

                  if (groupOverviewView === "list") {
                    return (
                      <div
                        key={gruppe.GruppeID}
                        role="button"
                        tabIndex={0}
                        onClick={() => setDetailGruppeId(gruppe.GruppeID)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setDetailGruppeId(gruppe.GruppeID);
                          }
                        }}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-slate-50/70 border border-slate-200 rounded-xl px-3.5 py-2.5 hover:border-[#2d5a3f]/40 cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-2 min-w-[140px] flex-1">
                          <RolleIkon rollenavn={ikonNavn} />
                          <span className="font-bold text-slate-900 text-sm">
                            {gruppe.Gruppenavn}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 min-w-[140px]">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0" />
                          <span className="truncate">{leder ? leder.Navn : "Ingen leder"}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 min-w-[140px]">
                          <Star className="w-3.5 h-3.5 fill-sky-500 text-sky-500 shrink-0" />
                          <span className="truncate">{nestleder ? nestleder.Navn : "—"}</span>
                        </div>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 border-l border-slate-200 pl-2.5 shrink-0">
                          {medlemstall} MEDL.
                        </span>
                        {leder && (
                          <div className="flex items-center gap-1 ml-auto">
                          <IkonHandling
                            label="Kopier leder-lenke"
                            Icon={Share2}
                            variant="sky"
                            copied={Boolean(isCopiedLeder)}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyLink(leder.PersonID, "leader");
                            }}
                          />
                          <IkonHandling
                            label="Se som denne lederen"
                            Icon={Eye}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectPerson(leder.PersonID, "leader");
                            }}
                          />
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={gruppe.GruppeID}
                      role="button"
                      tabIndex={0}
                      onClick={() => setDetailGruppeId(gruppe.GruppeID)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setDetailGruppeId(gruppe.GruppeID);
                        }
                      }}
                      className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between space-y-3 hover:border-[#2d5a3f]/40 cursor-pointer text-left"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <RolleIkon rollenavn={ikonNavn} />
                            <span className="font-bold text-slate-900 text-sm truncate">
                              {gruppe.Gruppenavn}
                            </span>
                          </div>
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 shrink-0">
                            {medlemstall} MEDL.
                          </span>
                        </div>

                        {/* Gruppeleder */}
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200/90 space-y-1.5">
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 font-semibold text-slate-900 text-xs">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0" />
                              <span>{leder ? leder.Navn : "Ingen leder tildelt"}</span>
                            </div>
                            <span className="text-[10px] bg-amber-50 text-amber-800 font-medium px-1.5 py-0.5 rounded border border-amber-200">
                              Leder
                            </span>
                          </div>
                          {leder && (
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[11px] text-slate-500 truncate min-w-0">
                                {leder.Epost} {leder.Telefon ? `· ${leder.Telefon}` : ""}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <IkonHandling
                                  label="Kopier leder-lenke"
                                  Icon={Share2}
                                  variant="sky"
                                  copied={Boolean(isCopiedLeder)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyLink(leder.PersonID, "leader");
                                  }}
                                />
                                <IkonHandling
                                  label="Se som denne lederen"
                                  Icon={Eye}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectPerson(leder.PersonID, "leader");
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Nestleder */}
                        {nestleder && (
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200/90 space-y-1.5">
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1.5 font-semibold text-slate-900 text-xs">
                                <Star className="w-3.5 h-3.5 fill-sky-500 text-sky-500 shrink-0" />
                                <span>{nestleder.Navn}</span>
                              </div>
                              <span className="text-[10px] bg-sky-50 text-sky-700 font-medium px-1.5 py-0.5 rounded border border-sky-200">
                                Nestleder
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[11px] text-slate-500 truncate min-w-0">
                                {nestleder.Epost} {nestleder.Telefon ? `· ${nestleder.Telefon}` : ""}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <IkonHandling
                                  label="Kopier leder-lenke"
                                  Icon={Share2}
                                  copied={Boolean(isCopiedNestleder)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyLink(nestleder.PersonID, "leader");
                                  }}
                                />
                                <IkonHandling
                                  label="Se som denne nestlederen"
                                  Icon={Eye}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectPerson(nestleder.PersonID, "leader");
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

        </div>
      )}

      {/* FANE 4: ROLLER */}
      {activeTab === "roles" && (
        <div className="space-y-4 max-w-2xl">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#2d5a3f]" />
            <span>Roller ({db.roller.length})</span>
          </h3>

          <div className="space-y-3">
            {db.roller.map((rolle) => {
              const instruks =
                db.rollebeskrivelser.find((rb) => rb.RolleID === rolle.RolleID)
                  ?.Rollebeskrivelse || rolle.Beskrivelse;
              const sammendrag = oppsummerInstruks(instruks);

              return (
                <div
                  key={rolle.RolleID}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedRolleForModal(rolle)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedRolleForModal(rolle);
                    }
                  }}
                  className="w-full text-left bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-[#2d5a3f]/40 cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <RolleIkon rollenavn={rolle.Rollenavn} className="w-10 h-10" />
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 text-sm">{rolle.Rollenavn}</h4>
                      {sammendrag ? (
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{sammendrag}</p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-1">Ingen instruks registrert</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "programmal" && (
        <ProgrammalAdminView db={db} onUpdateDb={onUpdateDb} />
      )}

      {/* FANE 5: GOOGLE SHEETS & SYNKKONTROLL */}
      {activeTab === "sync" && (
        <GoogleSheetsSync
          db={db}
          onUpdateDb={onUpdateDb}
          dataSource={dataSource}
          onSwitchDataSource={onSwitchDataSource}
          onOpenImport={() => setShowImportModal(true)}
        />
      )}

      {/* MODAL: Ny Gudstjeneste */}
      {newServiceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-3">
              Opprett ny gudstjeneste
            </h3>

            <div className="space-y-3 mb-6 text-xs">
              <div>
                <label className="font-semibold text-slate-600 block mb-1">
                  Dato (YYYY-MM-DD)*:
                </label>
                <input
                  type="date"
                  value={newServiceData.Dato}
                  onChange={(e) =>
                    setNewServiceData((prev) => ({ ...prev, Dato: e.target.value }))
                  }
                  className="w-full border border-slate-300 rounded-xl p-2 bg-slate-50"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">
                  Tema / Tittel*:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bønn og faste"
                  value={newServiceData.Tema}
                  onChange={(e) =>
                    setNewServiceData((prev) => ({ ...prev, Tema: e.target.value }))
                  }
                  className="w-full border border-slate-300 rounded-xl p-2 bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Klokkeslett:
                  </label>
                  <input
                    type="text"
                    value={newServiceData.Tid}
                    onChange={(e) =>
                      setNewServiceData((prev) => ({ ...prev, Tid: e.target.value }))
                    }
                    className="w-full border border-slate-300 rounded-xl p-2 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 block mb-1">
                    Sted:
                  </label>
                  <input
                    type="text"
                    value={newServiceData.Sted}
                    onChange={(e) =>
                      setNewServiceData((prev) => ({ ...prev, Sted: e.target.value }))
                    }
                    className="w-full border border-slate-300 rounded-xl p-2 bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-600 block mb-1">
                  Bibeltekst:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Johannes 3:16"
                  value={newServiceData.Bibeltekst}
                  onChange={(e) =>
                    setNewServiceData((prev) => ({ ...prev, Bibeltekst: e.target.value }))
                  }
                  className="w-full border border-slate-300 rounded-xl p-2 bg-slate-50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewServiceModal(false)}
                className="px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Avbryt
              </button>
              <button
                type="button"
                disabled={!newServiceData.Dato || !newServiceData.Tema}
                onClick={handleSaveNewService}
                className="px-4 py-2 text-xs bg-[#2d5a3f] hover:bg-[#234731] disabled:opacity-50 text-white font-semibold rounded-xl shadow-xs transition cursor-pointer"
              >
                Opprett gudstjeneste
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Ny Person */}
      {newPersonModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Legg til person
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Fornavn er nok. Etternavn tas med hvis det står i tabellen eller skrives inn.
            </p>

            <div className="space-y-3 mb-6 text-xs">
              <div>
                <label className="font-semibold text-slate-600 block mb-1">
                  Navn
                </label>
                <input
                  type="text"
                  placeholder="F.eks. Magnar eller Pål Brenne"
                  value={newFornavn}
                  onChange={(e) => setNewFornavn(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2 bg-slate-50"
                />
              </div>

              {newPersonSlots.length > 0 ? (
                <div className="bg-[#eef5f1] border border-[#d2e8d9] rounded-xl p-3 text-slate-800">
                  <div className="font-semibold mb-1">Tjeneste som tildeles</div>
                  {newPersonSlots.map((s) => (
                    <div key={`${s.gudstjenesteId}-${s.rolleId}`}>
                      {s.rolleNavn}
                      {s.dato ? ` · ${s.dato}` : ""}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">
                      Gudstjeneste (valgfritt)
                    </label>
                    <select
                      value={newPersonGudstjenesteId}
                      onChange={(e) => setNewPersonGudstjenesteId(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl p-2 bg-slate-50"
                    >
                      <option value="">Ingen tildeling nå</option>
                      {db.gudstjenester.map((g) => (
                        <option key={g.GudstjenesteID} value={g.GudstjenesteID}>
                          {g.Dato} · {g.Tema}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">
                      Tjeneste / rolle (valgfritt)
                    </label>
                    <select
                      value={newPersonRolleId}
                      onChange={(e) => setNewPersonRolleId(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl p-2 bg-slate-50"
                    >
                      <option value="">Velg rolle</option>
                      {db.roller
                        .filter((r) => r.Aktiv)
                        .map((r) => (
                          <option key={r.RolleID} value={r.RolleID}>
                            {r.Rollenavn}
                          </option>
                        ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewPersonModal(false)}
                className="px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Avbryt
              </button>
              <button
                type="button"
                disabled={!newFornavn.trim()}
                onClick={handleSaveNewPerson}
                className="px-4 py-2 text-xs bg-[#2d5a3f] hover:bg-[#234731] disabled:opacity-50 text-white font-semibold rounded-xl shadow-xs transition cursor-pointer"
              >
                Lagre person
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Overstyr Behov */}
      {editNeedModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Juster rollebehov
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Rolle: {editNeedModal.rolleNavn}
              {db.gudstjenester.find((g) => g.GudstjenesteID === editNeedModal.gudstjenesteId)
                ?.Dato
                ? ` · ${db.gudstjenester.find((g) => g.GudstjenesteID === editNeedModal.gudstjenesteId)?.Dato}`
                : ""}
            </p>

            <div className="space-y-3 mb-6">
              <label className="text-xs font-semibold text-slate-600 block">
                Antall personer som trengs:
              </label>
              <input
                type="number"
                min="0"
                max="20"
                value={customNeedInput}
                onChange={(e) => setCustomNeedInput(parseInt(e.target.value, 10) || 0)}
                className="w-full text-base font-bold border border-slate-300 rounded-xl p-2.5 bg-slate-50 text-center"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditNeedModal(null)}
                className="px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={handleSaveCustomNeed}
                className="px-4 py-2 text-xs bg-[#2d5a3f] hover:bg-[#234731] text-white font-semibold rounded-xl shadow-xs transition cursor-pointer"
              >
                Lagre behov
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Tildel person */}
      {assignModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Tildel person til {assignModal.rolleNavn}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Gudstjeneste:{" "}
              {db.gudstjenester.find((g) => g.GudstjenesteID === assignModal.gudstjenesteId)
                ?.Dato || ""}
            </p>

            <div className="space-y-3 mb-6">
              <label className="text-xs font-semibold text-slate-600 block">
                Velg person fra registeret:
              </label>
              <select
                value={personToAssign}
                onChange={(e) => setPersonToAssign(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:ring-2 focus:ring-[#2d5a3f] focus:outline-hidden"
              >
                <option value="">-- Velg person --</option>
                <optgroup label="Personer med denne rollen godkjent">
                  {db.personer
                    .filter((p) =>
                      db.personroller.some(
                        (pr) =>
                          pr.PersonID === p.PersonID &&
                          pr.RolleID === assignModal.rolleId &&
                          pr.Aktiv
                      )
                    )
                    .filter(
                      (p) =>
                        !personHarAktivTildeling(
                          db,
                          p.PersonID,
                          assignModal.gudstjenesteId,
                          assignModal.rolleId
                        )
                    )
                    .map((p) => (
                      <option key={p.PersonID} value={p.PersonID}>
                        {p.Navn}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Øvrige personer i registeret">
                  {db.personer
                    .filter(
                      (p) =>
                        !db.personroller.some(
                          (pr) =>
                            pr.PersonID === p.PersonID &&
                            pr.RolleID === assignModal.rolleId &&
                            pr.Aktiv
                        )
                    )
                    .filter(
                      (p) =>
                        !personHarAktivTildeling(
                          db,
                          p.PersonID,
                          assignModal.gudstjenesteId,
                          assignModal.rolleId
                        )
                    )
                    .map((p) => (
                      <option key={p.PersonID} value={p.PersonID}>
                        {p.Navn}
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-2">
              <label className="text-xs font-semibold text-slate-600 block">
                Eller opprett ny person
              </label>
              <input
                type="text"
                placeholder="Fornavn, eller fornavn etternavn"
                value={assignNewFornavn}
                onChange={(e) => setAssignNewFornavn(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-xl p-2.5 bg-slate-50"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAssignModal(null);
                  setAssignNewFornavn("");
                }}
                className="px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Avbryt
              </button>
              {assignNewFornavn.trim() ? (
                <button
                  type="button"
                  onClick={handleCreateAndAssign}
                  className="px-4 py-2 text-xs bg-[#2d5a3f] hover:bg-[#234731] text-white font-semibold rounded-xl shadow-xs transition cursor-pointer"
                >
                  Opprett og tildel
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!personToAssign}
                  onClick={handleAssignPerson}
                  className="px-4 py-2 text-xs bg-[#2d5a3f] hover:bg-[#234731] disabled:opacity-50 text-white font-semibold rounded-xl shadow-xs transition cursor-pointer"
                >
                  Lagre tildeling
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {newGroupModal && (
        <NewGroupModal
          db={db}
          onUpdateDb={onUpdateDb}
          onClose={() => setNewGroupModal(false)}
        />
      )}

      {detailGruppeId &&
        db.grupper.find((g) => g.GruppeID === detailGruppeId) && (
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

      {/* MODAL: Rollebeskrivelse */}
      {selectedRolleForModal && (() => {
        const liveRolle = db.roller.find(
          (r) => r.RolleID === selectedRolleForModal.RolleID
        );
        if (!liveRolle) return null;
        return (
          <RoleDescriptionModal
            rolle={liveRolle}
            rollebeskrivelse={
              db.rollebeskrivelser.find((rb) => rb.RolleID === liveRolle.RolleID) ||
              null
            }
            gruppe={
              liveRolle.GruppeID
                ? db.grupper.find((g) => g.GruppeID === liveRolle.GruppeID) || null
                : null
            }
            grupper={db.grupper}
            antallKvalifiserte={
              db.personroller.filter(
                (pr) => pr.RolleID === liveRolle.RolleID && pr.Aktiv
              ).length
            }
            editable
            onUpdateRolle={(patch) => handleOppdaterRolle(liveRolle.RolleID, patch)}
            onSaveInstruks={(tekst) =>
              handleLagreRolleinstruks(liveRolle.RolleID, tekst)
            }
            onClose={() => setSelectedRolleForModal(null)}
          />
        );
      })()}

      {/* MODAL: Kildedata & Migrering */}
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
