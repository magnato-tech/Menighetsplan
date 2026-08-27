import React, { useEffect, useState } from "react";
import {
  AppView,
  Bemanningstall,
  DatabaseState,
  getEffektivtBehov,
  getMaksAntall,
  erRolleHardFull,
  hentSvarStatus,
  nesteNummerertId,
  plusBemanningstall,
  saveDatabase,
  summerBemanning,
  svarPaaTildeling,
  tildelingVisningsnavn,
  tomtBemanningstall,
  visProgramIkon,
  kanRedigereProgram,
  erHendelseRad,
} from "../services/dataService";
import { Gudstjeneste, Rolle } from "../types/database";
import { RolleIkon } from "./RolleIkon";
import { IkonHandling } from "./IkonHandling";
import { SituasjonRad } from "./SituasjonRad";
import { GudstjenesteProgramView } from "./GudstjenesteProgramView";
import { RoleDescriptionModal } from "./RoleDescriptionModal";
import { ListeArkBryter, Planleggingsark, type ArkVisning } from "./Planleggingsark";
import { ProgramLeserModal } from "./ProgramLeserModal";
import {
  Users,
  Plus,
  Trash2,
  Check,
  Sliders,
  Clock,
  X,
  UserPlus,
  AlertCircle,
  CircleHelp,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  ScrollText,
  ChevronDown,
} from "lucide-react";

const UTEN_GRUPPE = "__uten__";

export type OversiktFilter = "bekreftet" | "venter" | "ledige" | "medlemmer" | null;

export type TildelForesporsel = {
  gudstjenesteId: string;
  rolleId: string;
  rolleNavn: string;
  gudstjenesteDato: string;
};

export type GruppeRad = {
  gruppeId: string;
  gruppenavn: string;
  lederId?: string;
  lederNavn?: string;
  lederFornavn?: string;
  tall: Bemanningstall;
  roller: Rolle[];
};

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

function trefferOversiktFilter(tall: Bemanningstall, filter: OversiktFilter): boolean {
  if (!filter || filter === "medlemmer") return true;
  if (filter === "ledige") return tall.ledige > 0;
  if (filter === "venter") return tall.venter > 0;
  return tall.bekreftet > 0;
}

export function gruppeRaderForGudstjeneste(
  db: DatabaseState,
  gudstjenesteId: string,
  alleRoller = false,
  rolleIds?: string[]
): GruppeRad[] {
  const tillatte = rolleIds ? new Set(rolleIds) : null;
  const byId = new Map<string, GruppeRad>();
  for (const rolle of db.roller.filter((r) => r.Aktiv)) {
    if (tillatte && !tillatte.has(rolle.RolleID)) continue;
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

export interface SondagBemanningProps {
  db: DatabaseState;
  onUpdateDb: (updatedDb: DatabaseState) => void;
  rolleIds?: string[];
  gruppeId?: string;
  medlemstall: number;
  /** Etikett på KPI-kortet (leder: «Medlemmer»). */
  medlemmerKpiLabel?: string;
  kpiTittel?: string;
  kpiBeskrivelse?: string;
  kpiFotnote?: string;
  /** Skjul Medlemmer/Tjenestegrupper-kortet. Admin bruker Grupper-fanen i stedet. */
  visMedlemmerKpi?: boolean;
  kpiTetthet?: "kompakt" | "romslig";
  /** Venstre del av topplinjen (f.eks. gruppedropdown). Samler Kort/Ark og Ny på samme rad. */
  verktoyVenstre?: React.ReactNode;
  kanOpprettGudstjeneste?: boolean;
  onNyGudstjeneste?: () => void;
  visKjoreplan: "alltid" | "programrett";
  visBibeltekst?: boolean;
  skjulGruppehode?: boolean;
  skjulListeVedMedlemmer?: boolean;
  listeTittel?: string;
  visKpiAlltid?: boolean;
  oversiktFilter: OversiktFilter;
  onOversiktFilter: (filter: OversiktFilter) => void;
  onMedlemmer?: () => void;
  hoppTil?: { gudstjenesteId: string; personId: string } | null;
  vis?: boolean;
  onSelectPerson: (personId: string, view?: AppView) => void;
  selectedPersonId?: string;
  onTildel: (foresporsel: TildelForesporsel) => void;
  statusAktor: "administrator" | "gruppeleder";
  rolleInstruksRedigerbar?: boolean;
  guideVisning?: ArkVisning;
  guideApneForsteKort?: boolean;
}

export const SondagBemanning: React.FC<SondagBemanningProps> = ({
  db,
  onUpdateDb,
  rolleIds,
  gruppeId,
  medlemstall,
  medlemmerKpiLabel = "Medlemmer",
  kpiTittel,
  kpiBeskrivelse,
  kpiFotnote,
  visMedlemmerKpi = true,
  kpiTetthet = "romslig",
  verktoyVenstre,
  kanOpprettGudstjeneste = false,
  onNyGudstjeneste,
  visKjoreplan,
  visBibeltekst = false,
  skjulGruppehode = false,
  skjulListeVedMedlemmer = false,
  listeTittel,
  visKpiAlltid = false,
  oversiktFilter,
  onOversiktFilter,
  onMedlemmer,
  hoppTil = null,
  vis = true,
  onSelectPerson,
  selectedPersonId,
  onTildel,
  statusAktor,
  rolleInstruksRedigerbar = false,
  guideVisning,
  guideApneForsteKort = false,
}) => {
  const [selectedRolleForModal, setSelectedRolleForModal] = useState<Rolle | null>(null);
  const [editNeedModal, setEditNeedModal] = useState<{
    gudstjenesteId: string;
    rolleId: string;
    currentBehov: number;
    rolleNavn: string;
  } | null>(null);
  const [customNeedInput, setCustomNeedInput] = useState(1);
  const [visDetalj, setVisDetalj] = useState<Record<string, boolean>>(() =>
    hoppTil ? { [hoppTil.gudstjenesteId]: true } : {}
  );
  const [uthevPersonId, setUthevPersonId] = useState<string | null>(hoppTil?.personId ?? null);
  const [scrollTilGudstjenesteId, setScrollTilGudstjenesteId] = useState<string | null>(
    hoppTil?.gudstjenesteId ?? null
  );
  const [visTidligere, setVisTidligere] = useState(false);
  const [servicesVisning, setServicesVisning] = useState<ArkVisning>("liste");
  const [arkGudstjenesteId, setArkGudstjenesteId] = useState<string | null>(null);
  const [gudstjenesteKortFane, setGudstjenesteKortFane] = useState<
    Record<string, "bemanning" | "kjoreplan">
  >({});
  const [leserGudstjenesteId, setLeserGudstjenesteId] = useState<string | null>(null);
  const [statusArk, setStatusArk] = useState<{
    tildelingId: string;
    personId: string;
    navn: string;
    status: "Bekreftet" | "Venter" | "Avvist";
  } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => {
      if (!mq.matches) {
        setServicesVisning("liste");
        return;
      }
      if (guideVisning) setServicesVisning(guideVisning);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [guideVisning]);

  const omfangRoller = rolleIds
    ? db.roller.filter((r) => r.Aktiv && rolleIds.includes(r.RolleID))
    : db.roller.filter((r) => r.Aktiv);

  const iDag = iDagIso();
  const sorterteGudstjenester = db.gudstjenester
    .slice()
    .sort((a, b) => `${a.Dato} ${a.Tid}`.localeCompare(`${b.Dato} ${b.Tid}`));
  const kommendeGudstjenester = sorterteGudstjenester.filter((g) => g.Dato >= iDag);
  const tidligereGudstjenester = sorterteGudstjenester.filter((g) => g.Dato < iDag).reverse();
  const forsteKommendeId = kommendeGudstjenester[0]?.GudstjenesteID;

  useEffect(() => {
    if (!guideApneForsteKort || !forsteKommendeId) return;
    setVisDetalj((prev) => ({ ...prev, [forsteKommendeId]: true }));
  }, [guideApneForsteKort, forsteKommendeId]);

  const semesterOversikt = kommendeGudstjenester.reduce(
    (acc, gud) => plusBemanningstall(acc, summerBemanning(db, gud.GudstjenesteID, omfangRoller)),
    tomtBemanningstall()
  );
  const ledigeOgForfall = semesterOversikt.ledige;
  const bekreftetProsent =
    semesterOversikt.behov > 0
      ? Math.round((semesterOversikt.bekreftet / semesterOversikt.behov) * 100)
      : 0;

  const visKommendeGudstjenester = kommendeGudstjenester.filter((gud) => {
    const rader = gruppeRaderForGudstjeneste(db, gud.GudstjenesteID, false, rolleIds);
    const totalt = summerGruppeRader(rader);
    return trefferOversiktFilter(totalt, oversiktFilter);
  });

  const visTidligereFiltrert = tidligereGudstjenester.filter((gud) => {
    const totalt = summerGruppeRader(
      gruppeRaderForGudstjeneste(db, gud.GudstjenesteID, false, rolleIds)
    );
    return trefferOversiktFilter(totalt, oversiktFilter);
  });

  const arkGudstjeneste = arkGudstjenesteId
    ? db.gudstjenester.find((g) => g.GudstjenesteID === arkGudstjenesteId)
    : undefined;

  useEffect(() => {
    if (oversiktFilter !== "venter") return;
    const ids = db.gudstjenester
      .filter((gud) => gud.Dato >= iDag)
      .filter((gud) =>
        trefferOversiktFilter(
          summerGruppeRader(gruppeRaderForGudstjeneste(db, gud.GudstjenesteID, false, rolleIds)),
          "venter"
        )
      )
      .map((gud) => gud.GudstjenesteID);
    setVisDetalj((prev) => {
      const neste = { ...prev };
      ids.forEach((id) => {
        neste[id] = true;
      });
      return neste;
    });
  }, [oversiktFilter, db, iDag, rolleIds]);

  useEffect(() => {
    if (!vis || !scrollTilGudstjenesteId) return;
    const id = scrollTilGudstjenesteId;
    const t = window.setTimeout(() => {
      document.getElementById(`gudstjeneste-${id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setScrollTilGudstjenesteId(null);
    }, 50);
    return () => window.clearTimeout(t);
  }, [vis, scrollTilGudstjenesteId]);

  useEffect(() => {
    if (!uthevPersonId) return;
    const t = window.setTimeout(() => setUthevPersonId(null), 8000);
    return () => window.clearTimeout(t);
  }, [uthevPersonId]);

  useEffect(() => {
    if (!hoppTil) return;
    onOversiktFilter(null);
    setServicesVisning("liste");
    setVisDetalj((prev) => ({ ...prev, [hoppTil.gudstjenesteId]: true }));
    setUthevPersonId(hoppTil.personId);
    setScrollTilGudstjenesteId(hoppTil.gudstjenesteId);
  }, [hoppTil]);

  const velgOversiktFilter = (neste: Exclude<OversiktFilter, null>) => {
    const aktiv: OversiktFilter = oversiktFilter === neste ? null : neste;
    onOversiktFilter(aktiv);
    if (aktiv === "medlemmer" && visMedlemmerKpi) onMedlemmer?.();
  };

  const vekselDetalj = (id: string) => {
    setVisDetalj((prev) => {
      const neste = !prev[id];
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
        return neste ? { [id]: true } : {};
      }
      return { ...prev, [id]: neste };
    });
  };

  const kommentarForSvar = (nyttSvar: "Bekreftet" | "Venter" | "Avvist") => {
    if (statusAktor === "gruppeleder") {
      if (nyttSvar === "Bekreftet") return "Bekreftet av gruppeleder";
      if (nyttSvar === "Avvist") return "Avvist av gruppeleder";
      return "Forespurt av gruppeleder";
    }
    if (nyttSvar === "Bekreftet") return "Bekreftet av administrator (muntlig/ja)";
    if (nyttSvar === "Avvist") return "Meldt forfall via administrator";
    return "Forespurt av administrator";
  };

  const handleRemoveTildeling = (tildelingId: string) => {
    const updatedDb: DatabaseState = {
      ...db,
      tildelinger: db.tildelinger.filter((t) => t.TildelingID !== tildelingId),
      svar: db.svar.filter((s) => s.TildelingID !== tildelingId),
    };
    saveDatabase(updatedDb);
    onUpdateDb(updatedDb);
  };

  const handleUpdatePersonStatus = (
    tildelingId: string,
    personId: string,
    nyttSvar: "Bekreftet" | "Venter" | "Avvist"
  ) => {
    const updatedDb = svarPaaTildeling(
      db,
      tildelingId,
      personId,
      nyttSvar,
      kommentarForSvar(nyttSvar)
    );
    saveDatabase(updatedDb);
    onUpdateDb(updatedDb);
  };

  const handleSaveCustomNeed = () => {
    if (!editNeedModal) return;
    const now = new Date().toISOString().split("T")[0];
    const existingIndex = db.tjenestebehov.findIndex(
      (tb) =>
        erHendelseRad(tb, editNeedModal.gudstjenesteId) &&
        tb.RolleID === editNeedModal.rolleId
    );
    const tjenestebehov =
      existingIndex >= 0
        ? db.tjenestebehov.map((tb, i) =>
            i === existingIndex
              ? { ...tb, Antall: customNeedInput, Aktiv: true, SistEndret: now }
              : tb
          )
        : [
            ...db.tjenestebehov,
            {
              TjenestebehovID: nesteNummerertId(db.tjenestebehov, "TjenestebehovID", "TB"),
              GudstjenesteID: editNeedModal.gudstjenesteId,
              RolleID: editNeedModal.rolleId,
              Antall: customNeedInput,
              Aktiv: true,
              OpprettetDato: now,
              SistEndret: now,
            },
          ];
    const updatedDb: DatabaseState = { ...db, tjenestebehov };
    saveDatabase(updatedDb);
    onUpdateDb(updatedDb);
    setEditNeedModal(null);
  };

  const handleOppdaterRolle = (
    rolleId: string,
    patch: { GruppeID?: string; Behov?: number; MaksAntall?: number | null }
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
              ...("MaksAntall" in patch ? { MaksAntall: patch.MaksAntall } : {}),
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
          rb.RolleID === rolleId ? { ...rb, Rollebeskrivelse: tekst, SistEndret: now } : rb
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
    saveDatabase({ ...db, rollebeskrivelser });
    onUpdateDb({ ...db, rollebeskrivelser });
  };

  const visKjoreplanFor = (gudstjenesteId: string) => {
    if (visKjoreplan === "alltid") return true;
    return Boolean(selectedPersonId && visProgramIkon(db, selectedPersonId, gudstjenesteId));
  };

  const renderRolleRad = (gudstjeneste: Gudstjeneste, rolle: Rolle) => {
    const gudstjenesteId = gudstjeneste.GudstjenesteID;
    const effektivtBehov = getEffektivtBehov(db, gudstjenesteId, rolle);
    const isOverridden = db.tjenestebehov.some(
      (tb) => erHendelseRad(tb, gudstjenesteId) && tb.RolleID === rolle.RolleID && tb.Aktiv
    );
    const tildelinger = db.tildelinger.filter(
      (t) => erHendelseRad(t, gudstjenesteId) && t.RolleID === rolle.RolleID
    );
    const antallBekreftet = tildelinger.filter(
      (t) => hentSvarStatus(db, t.TildelingID) === "Bekreftet"
    ).length;
    const maks = getMaksAntall(rolle);
    const hardFull = erRolleHardFull(db, gudstjenesteId, rolle);
    const erFull = hardFull || antallBekreftet >= effektivtBehov;

    return (
      <div
        key={rolle.RolleID}
        className="px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2"
      >
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedRolleForModal(rolle);
            }}
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
            onClick={(e) => {
              e.stopPropagation();
              setEditNeedModal({
                gudstjenesteId,
                rolleId: rolle.RolleID,
                currentBehov: effektivtBehov,
                rolleNavn: rolle.Rollenavn,
              });
              setCustomNeedInput(effektivtBehov);
            }}
            title={
              maks != null
                ? `Maks ${maks}. Hard grense — overbooking er stengt.`
                : "Veiledende antall. Overbooking er greit."
            }
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition shrink-0 ${
              erFull
                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                : "bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-800"
            }`}
          >
            <span>
              {antallBekreftet} / {maks != null ? `maks ${maks}` : effektivtBehov}
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
              <div key={t.TildelingID} className="inline-flex items-center gap-0.5 min-w-0">
              <div
                className={`inline-flex items-center gap-1 pl-2 pr-2 py-0.5 rounded-xl text-xs border ${
                  uthevPersonId === t.PersonID ? "ring-2 ring-[#2d5a3f] ring-offset-1" : ""
                } ${
                  isBekreftet
                    ? "bg-emerald-50/80 border-emerald-200 text-emerald-950 font-medium"
                    : isAvvist
                    ? "bg-rose-50/80 border-rose-200 text-rose-800"
                    : "bg-amber-50/80 border-amber-200 text-amber-950 font-medium"
                }`}
                data-guide="status"
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
                <div className="hidden md:flex items-center gap-0.5">
                <IkonHandling
                  label="Bekreft (personen har sagt ja)"
                  Icon={Check}
                  variant="confirm"
                  active={isBekreftet}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdatePersonStatus(t.TildelingID, t.PersonID, "Bekreftet");
                  }}
                />
                <IkonHandling
                  label="Sett status til forespurt / venter svar"
                  Icon={Clock}
                  variant="wait"
                  active={status === "Venter"}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdatePersonStatus(t.TildelingID, t.PersonID, "Venter");
                  }}
                />
                <IkonHandling
                  label="Marker som forfall / kan ikke"
                  Icon={X}
                  variant="decline"
                  active={isAvvist}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdatePersonStatus(t.TildelingID, t.PersonID, "Avvist");
                  }}
                />
                <IkonHandling
                  label="Fjern tildeling"
                  Icon={Trash2}
                  variant="decline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTildeling(t.TildelingID);
                  }}
                />
                </div>
              </div>
                <button
                  type="button"
                  className="md:hidden inline-flex items-center justify-center min-h-11 min-w-11 rounded-lg text-slate-600 cursor-pointer"
                  aria-label={`Handlinger for ${visningsnavn}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setStatusArk({
                      tildelingId: t.TildelingID,
                      personId: t.PersonID,
                      navn: visningsnavn,
                      status: isBekreftet ? "Bekreftet" : isAvvist ? "Avvist" : "Venter",
                    });
                  }}
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            disabled={hardFull}
            onClick={(e) => {
              e.stopPropagation();
              if (hardFull) return;
              onTildel({
                gudstjenesteId,
                rolleId: rolle.RolleID,
                rolleNavn: rolle.Rollenavn,
                gudstjenesteDato: gudstjeneste.Dato,
              });
            }}
            className={`p-2 md:p-1.5 min-h-11 min-w-11 md:min-h-0 md:min-w-0 border rounded-lg transition shadow-2xs shrink-0 flex items-center justify-center ${
              hardFull
                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                : "bg-[#eef5f1] hover:bg-[#dff0e6] text-[#2d5a3f] border-[#d2e8d9] cursor-pointer"
            }`}
            title={hardFull ? `Rollen er full (maks ${maks})` : "Tildel"}
            aria-label={hardFull ? `Rollen er full (maks ${maks})` : "Tildel"}
            data-guide="sett-opp"
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
      visAlleTall,
      rolleIds
    );
    const totalt = summerGruppeRader(
      gruppeRaderForGudstjeneste(db, gudstjeneste.GudstjenesteID, false, rolleIds)
    );
    const rader = visAlleTall
      ? alleRader
      : alleRader.filter((rad) => trefferOversiktFilter(rad.tall, oversiktFilter));
    const visDetaljer = Boolean(visDetalj[gudstjeneste.GudstjenesteID]);
    const kant = `border-l-[3px] border-l-[#2d5a3f]${visAlleTall && totalt.ledige === 0 && totalt.venter === 0 ? " opacity-80" : ""}`;
    const visKjoreplanFane = visKjoreplanFor(gudstjeneste.GudstjenesteID);
    const aktivFane =
      visKjoreplanFane &&
      (gudstjenesteKortFane[gudstjeneste.GudstjenesteID] || "bemanning") === "kjoreplan"
        ? "kjoreplan"
        : "bemanning";

    return (
      <div
        key={gudstjeneste.GudstjenesteID}
        id={`gudstjeneste-${gudstjeneste.GudstjenesteID}`}
        className={`bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden ${kant}${
          visDetaljer ? " lg:col-span-2" : ""
        }`}
        data-guide="gudstjenester"
      >
        <div className="px-4 py-2.5 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
              <span className="font-semibold text-[#2d5a3f]">
                {formatDatoKort(gudstjeneste.Dato)}
                {gudstjeneste.Tid ? ` · kl. ${gudstjeneste.Tid}` : ""}
              </span>
              <span className="font-bold text-slate-900 truncate">
                {gudstjeneste.Tema || "Gudstjeneste"}
              </span>
              {gudstjeneste.Sted && visBibeltekst && (
                <span className="hidden sm:inline text-xs text-slate-500 truncate">
                  · {gudstjeneste.Sted}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] tabular-nums font-semibold shrink-0">
            {visKjoreplanFane && (
              <IkonHandling
                label={
                  selectedPersonId &&
                  kanRedigereProgram(db, selectedPersonId, gudstjeneste.GudstjenesteID)
                    ? "Rediger kjøreplan"
                    : "Åpne kjøreplan"
                }
                Icon={
                  selectedPersonId &&
                  kanRedigereProgram(db, selectedPersonId, gudstjeneste.GudstjenesteID)
                    ? Pencil
                    : ScrollText
                }
                variant="sky"
                onClick={(e) => {
                  e.stopPropagation();
                  setLeserGudstjenesteId(gudstjeneste.GudstjenesteID);
                }}
              />
            )}
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
            <button
              type="button"
              onClick={() => vekselDetalj(gudstjeneste.GudstjenesteID)}
              aria-expanded={visDetaljer}
              aria-label={visDetaljer ? "Skjul detaljer" : "Vis detaljer"}
              className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-xl text-slate-500 cursor-pointer"
            >
              <ChevronDown className={`w-5 h-5 transition ${visDetaljer ? "" : "rotate-180"}`} />
            </button>
          </div>
        </div>

        {!visDetaljer && (
          <SituasjonRad
            db={db}
            gudstjenesteId={gudstjeneste.GudstjenesteID}
            rolleIds={rolleIds}
          />
        )}

        {visDetaljer && (
          <div className="border-t border-slate-100">
            {visKjoreplanFane && (
              <div className="flex border-b border-slate-100 px-2">
                {(
                  [
                    ["bemanning", "Bemanning"],
                    ["kjoreplan", "Kjøreplan"],
                  ] as const
                ).map(([id, label]) => {
                  const aktiv = aktivFane === id;
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
            )}
            {aktivFane === "kjoreplan" ? (
              <GudstjenesteProgramView
                db={db}
                gudstjeneste={gudstjeneste}
                redigerbar={
                  selectedPersonId
                    ? kanRedigereProgram(db, selectedPersonId, gudstjeneste.GudstjenesteID)
                    : true
                }
                selectedPersonId={selectedPersonId}
                onUpdateDb={onUpdateDb}
              />
            ) : (
              <>
                {visBibeltekst &&
                  (gudstjeneste.Bibeltekst ||
                    gudstjeneste.Kollekt ||
                    gudstjeneste.Kunngjøringer ||
                    gudstjeneste.Merknad) && (
                    <div className="px-4 py-2 text-xs text-slate-600 flex flex-col gap-1 bg-slate-50/50">
                      <div className="flex flex-wrap gap-3">
                        {gudstjeneste.Bibeltekst && (
                          <span>
                            Bibeltekst:{" "}
                            <span className="font-medium text-slate-800">
                              {gudstjeneste.Bibeltekst}
                            </span>
                          </span>
                        )}
                        {gudstjeneste.Kollekt && (
                          <span>
                            Kollekt:{" "}
                            <span className="font-medium text-[#2d5a3f]">{gudstjeneste.Kollekt}</span>
                          </span>
                        )}
                      </div>
                      {gudstjeneste.Kunngjøringer && (
                        <span>
                          Kunngjøringer:{" "}
                          <span className="font-medium text-slate-800 whitespace-pre-wrap">
                            {gudstjeneste.Kunngjøringer}
                          </span>
                        </span>
                      )}
                      {gudstjeneste.Merknad && (
                        <span>
                          Merknad:{" "}
                          <span className="font-medium text-slate-800">{gudstjeneste.Merknad}</span>
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
                        {!skjulGruppehode && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900 min-w-[7rem]">
                              {rad.gruppenavn}
                            </span>
                            <span className="text-xs text-slate-600 min-w-[6rem]">
                              {rad.lederNavn || "Ingen leder"}
                            </span>
                            <span className="text-[11px] tabular-nums font-semibold flex items-center gap-2">
                              <span
                                className={rad.tall.bekreftet ? "text-emerald-700" : "text-slate-400"}
                              >
                                {rad.tall.bekreftet} bekr.
                              </span>
                              <span className={rad.tall.venter ? "text-amber-800" : "text-slate-400"}>
                                {rad.tall.venter} venter
                              </span>
                              <span className={rad.tall.ledige ? "text-rose-800" : "text-slate-400"}>
                                {rad.tall.ledige} ledige
                              </span>
                            </span>
                          </div>
                        )}
                        {visRoller.length > 0 && (
                          <div
                            className={`${skjulGruppehode ? "" : "mt-2 "}rounded-xl border border-slate-200 bg-slate-50/60 divide-y divide-slate-100`}
                          >
                            {visRoller.map((rolle) => renderRolleRad(gudstjeneste, rolle))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {rader.length === 0 && (
                    <p className="px-4 py-4 text-sm text-slate-500">
                      Ingen roller med behov denne dagen.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const visListe = !(skjulListeVedMedlemmer && oversiktFilter === "medlemmer");
  const visKpi = visKpiAlltid || servicesVisning === "liste";
  const kpiSkjultPaMobil = skjulListeVedMedlemmer && oversiktFilter === "medlemmer";
  const kompakt = kpiTetthet === "kompakt";

  const kompaktKnapper: {
    id: Exclude<OversiktFilter, null>;
    tall: number;
    label: string;
    aktiv: boolean;
  }[] = [
    { id: "ledige", tall: ledigeOgForfall, label: "Ledige", aktiv: oversiktFilter === "ledige" },
    { id: "venter", tall: semesterOversikt.venter, label: "Venter", aktiv: oversiktFilter === "venter" },
    {
      id: "bekreftet",
      tall: semesterOversikt.bekreftet,
      label: kompakt ? `Bekr. (${bekreftetProsent}%)` : "Bekr.",
      aktiv: oversiktFilter === "bekreftet",
    },
    ...(visMedlemmerKpi
      ? [
          {
            id: "medlemmer" as const,
            tall: medlemstall,
            label: medlemmerKpiLabel === "Tjenestegrupper" ? "Grupper" : "Folk",
            aktiv: oversiktFilter === "medlemmer",
          },
        ]
      : []),
  ];

  const storeKort = [
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
    ...(visMedlemmerKpi
      ? [
          {
            id: "medlemmer" as const,
            tall: medlemstall,
            label: medlemmerKpiLabel,
            Icon: Users,
            wrap: "bg-sky-50 border-sky-100 text-sky-950",
            icon: "text-sky-600",
            aktiv: "ring-2 ring-sky-300",
          },
        ]
      : []),
  ];

  const filterFotnote =
    oversiktFilter && oversiktFilter !== "medlemmer" ? (
      <p className="text-[11px] text-slate-500">
        Viser{" "}
        {oversiktFilter === "bekreftet"
          ? "søndager med bekreftede oppgaver"
          : oversiktFilter === "venter"
            ? "søndager der noen venter på å svare"
            : "søndager med ledige plasser"}
        . Trykk tallet igjen for å vise alle.
      </p>
    ) : null;

  const kompaktStatusRad = (
    <div className="flex gap-1">
      {kompaktKnapper.map((kort) => (
        <button
          key={kort.id}
          type="button"
          onClick={() => velgOversiktFilter(kort.id)}
          aria-pressed={kort.aktiv}
          className={`flex-1 min-h-11 rounded-xl border text-center px-1 py-1.5 cursor-pointer ${
            kort.aktiv ? "bg-[#2d5a3f] text-white border-[#2d5a3f]" : "bg-slate-50 border-slate-200 text-slate-800"
          }`}
        >
          <div className="text-base font-bold tabular-nums leading-none">{kort.tall}</div>
          <div className="text-[10px] font-semibold mt-0.5">{kort.label}</div>
        </button>
      ))}
    </div>
  );

  const kpiKort = kompakt ? (
    <div className="space-y-1.5">
      {kompaktStatusRad}
      {kpiFotnote && <p className="text-[11px] text-slate-500">{kpiFotnote}</p>}
      {filterFotnote}
    </div>
  ) : (
    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
      {(kpiTittel || kpiBeskrivelse) && (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            {kpiTittel && (
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{kpiTittel}</p>
            )}
            {kpiBeskrivelse && <p className="text-sm text-slate-600">{kpiBeskrivelse}</p>}
          </div>
        </div>
      )}
      <div className="md:hidden">{kompaktStatusRad}</div>
      <div
        className={`hidden md:grid gap-3 ${
          visMedlemmerKpi ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3"
        }`}
      >
        {storeKort.map((kort) => {
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
      {kpiFotnote && <p className="text-[11px] text-slate-500">{kpiFotnote}</p>}
      {filterFotnote}
    </div>
  );

  const kpiBlokk = visKpi ? (
    <div className={kpiSkjultPaMobil ? "hidden md:block" : undefined}>{kpiKort}</div>
  ) : null;

  const nyGudstjenesteKnapp = kanOpprettGudstjeneste && (
    <button
      type="button"
      onClick={onNyGudstjeneste}
      title="Ny gudstjeneste"
      aria-label="Ny gudstjeneste"
      className="inline-flex items-center justify-center w-10 h-10 bg-[#2d5a3f] hover:bg-[#234731] text-white rounded-xl shadow-xs transition cursor-pointer shrink-0"
    >
      <Plus className="w-5 h-5" />
    </button>
  );

  const visningBryter = visListe && !verktoyVenstre && (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {listeTittel ? (
        <h3 className="text-sm font-bold text-slate-900">{listeTittel}</h3>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap items-center gap-2 ml-auto">
        <div data-guide="liste-ark" className="hidden md:block">
          <ListeArkBryter visning={servicesVisning} onChange={setServicesVisning} />
        </div>
        <p className="md:hidden text-[11px] text-slate-500 w-full">
          Planleggingsarket er laget for større skjerm.
        </p>
        {kanOpprettGudstjeneste && servicesVisning === "ark" && nyGudstjenesteKnapp}
      </div>
    </div>
  );

  const samletVerktoy = verktoyVenstre ? (
    <div className="flex items-center gap-2 min-w-0">
      <div className="min-w-0 flex-1">{verktoyVenstre}</div>
      <div className="flex items-center gap-1.5 shrink-0">
        <div data-guide="liste-ark" className="hidden md:block">
          <ListeArkBryter visning={servicesVisning} onChange={setServicesVisning} />
        </div>
        {nyGudstjenesteKnapp}
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="space-y-4">
        {samletVerktoy}
        {omfangRoller.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm text-slate-600">
              Ingen roller er tilknyttet denne tjenestegruppen i dagens register.
            </p>
          </div>
        ) : (
          <>
            {visKpiAlltid && kpiBlokk}
            {servicesVisning === "liste" && visningBryter}
            {servicesVisning === "ark" && visListe && (
              <div
                className={
                  statusAktor === "administrator" ? "ark-fullbredde space-y-2" : "space-y-2"
                }
              >
                {visningBryter}
                <Planleggingsark
                  db={db}
                  onUpdateDb={onUpdateDb}
                  rolleIds={rolleIds}
                  gruppeId={gruppeId}
                  fullBredde={statusAktor === "administrator"}
                  valgtGudstjenesteId={arkGudstjenesteId}
                  onVelgGudstjeneste={(id) => {
                    setArkGudstjenesteId((prev) => (prev === id ? null : id));
                    setVisDetalj((prev) => ({ ...prev, [id]: true }));
                  }}
                />
                {arkGudstjeneste && renderGudstjenesteKort(arkGudstjeneste)}
              </div>
            )}
            {servicesVisning === "liste" && !visKpiAlltid && kpiBlokk}
            {servicesVisning === "liste" && visListe && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {visKommendeGudstjenester.map((gudstjeneste) => renderGudstjenesteKort(gudstjeneste))}
                </div>
                {visKommendeGudstjenester.length === 0 && (
                  <p className="text-sm text-slate-500 bg-white rounded-2xl border border-slate-200 px-4 py-6 text-center">
                    {oversiktFilter
                      ? "Ingen treff for dette filteret. Trykk tallet igjen for å vise alle."
                      : "Ingen kommende gudstjenester."}
                  </p>
                )}
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
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mt-2">
                        {visTidligereFiltrert.map((gudstjeneste) =>
                          renderGudstjenesteKort(gudstjeneste)
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {editNeedModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Juster rollebehov</h3>
            <p className="text-xs text-slate-500 mb-4">
              Rolle: {editNeedModal.rolleNavn}
              {db.gudstjenester.find((g) => g.GudstjenesteID === editNeedModal.gudstjenesteId)?.Dato
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

      {selectedRolleForModal &&
        (() => {
          const liveRolle = db.roller.find((r) => r.RolleID === selectedRolleForModal.RolleID);
          if (!liveRolle) return null;
          return (
            <RoleDescriptionModal
              rolle={liveRolle}
              rollebeskrivelse={
                db.rollebeskrivelser.find((rb) => rb.RolleID === liveRolle.RolleID) || null
              }
              gruppe={
                liveRolle.GruppeID
                  ? db.grupper.find((g) => g.GruppeID === liveRolle.GruppeID) || null
                  : null
              }
              grupper={rolleInstruksRedigerbar ? db.grupper : []}
              antallKvalifiserte={
                rolleInstruksRedigerbar
                  ? db.personroller.filter((pr) => pr.RolleID === liveRolle.RolleID && pr.Aktiv)
                      .length
                  : undefined
              }
              editable={rolleInstruksRedigerbar}
              onUpdateRolle={
                rolleInstruksRedigerbar
                  ? (patch) => handleOppdaterRolle(liveRolle.RolleID, patch)
                  : undefined
              }
              onSaveInstruks={
                rolleInstruksRedigerbar
                  ? (tekst) => handleLagreRolleinstruks(liveRolle.RolleID, tekst)
                  : undefined
              }
              onClose={() => setSelectedRolleForModal(null)}
            />
          );
        })()}

      {statusArk && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50 cursor-pointer"
            aria-label="Lukk"
            onClick={() => setStatusArk(null)}
          />
          <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl border-t border-slate-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
            <p className="text-sm font-bold text-slate-900 mb-3">{statusArk.navn}</p>
            <div className="grid gap-2">
              {(
                [
                  ["Bekreftet", "Bekreft"],
                  ["Venter", "Forespurt / venter"],
                  ["Avvist", "Forfall / kan ikke"],
                ] as const
              ).map(([verdi, label]) => (
                <button
                  key={verdi}
                  type="button"
                  onClick={() => {
                    handleUpdatePersonStatus(statusArk.tildelingId, statusArk.personId, verdi);
                    setStatusArk(null);
                  }}
                  className={`min-h-11 px-4 rounded-xl text-sm font-semibold border cursor-pointer ${
                    statusArk.status === verdi
                      ? "bg-[#2d5a3f] text-white border-[#2d5a3f]"
                      : "bg-white text-slate-800 border-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  handleRemoveTildeling(statusArk.tildelingId);
                  setStatusArk(null);
                }}
                className="min-h-11 px-4 rounded-xl text-sm font-semibold border border-rose-200 text-rose-800 bg-rose-50 cursor-pointer"
              >
                Fjern tildeling
              </button>
              <button
                type="button"
                onClick={() => setStatusArk(null)}
                className="min-h-11 px-4 rounded-xl text-sm font-semibold text-slate-600 cursor-pointer"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}

      {leserGudstjenesteId &&
        (() => {
          const gud = db.gudstjenester.find((g) => g.GudstjenesteID === leserGudstjenesteId);
          if (!gud) return null;
          return (
            <ProgramLeserModal
              db={db}
              gudstjeneste={gud}
              selectedPersonId={selectedPersonId}
              uthevPersonId={selectedPersonId}
              redigerbar={
                selectedPersonId
                  ? kanRedigereProgram(db, selectedPersonId, gud.GudstjenesteID)
                  : visKjoreplan === "alltid"
              }
              onClose={() => setLeserGudstjenesteId(null)}
              onUpdateDb={onUpdateDb}
            />
          );
        })()}
    </>
  );
};
