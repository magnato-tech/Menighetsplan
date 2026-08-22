import React, { useState } from "react";
import {
  DatabaseState,
  DeltakelseStatus,
  finnGrupperForGruppeleder,
  finnMedlemmerIGruppe,
  getEffektivtBehov,
  hentSvarStatus,
  summerBemanning,
  plusBemanningstall,
  tomtBemanningstall,
  ledigePlasserForRolle,
  genererPersonligLenke,
  saveDatabase,
  settDeltakelseForPerson,
  tildelEksternPerson,
  erEksternPersonId,
  sikreGruppemedlemskap,
  kanRedigereProgram,
  visProgramIkon,
  AppView,
} from "../services/dataService";
import { Person, Rolle, Tjenestebehov } from "../types/database";
import { RoleDescriptionModal } from "./RoleDescriptionModal";
import { IkonHandling } from "./IkonHandling";
import {
  GudstjenesteRolleOversikt,
  RolleOversiktNavn,
} from "./GudstjenesteRolleOversikt";
import { ProgramLeserModal } from "./ProgramLeserModal";
import {
  GroupLeaderGuide,
} from "./GroupLeaderGuide";
import {
  Users,
  Shield,
  Share2,
  Eye,
  Check,
  Clock,
  AlertCircle,
  UserPlus,
  Search,
  X,
  Trash2,
  HelpCircle,
  CheckCircle2,
  CircleHelp,
  ChevronDown,
  ChevronRight,
  Pencil,
  ScrollText,
} from "lucide-react";

interface GroupLeaderViewProps {
  db: DatabaseState;
  selectedPersonId: string;
  onUpdateDb: (updatedDb: DatabaseState) => void;
  onSelectPerson: (personId: string, view?: AppView) => void;
}

type OversiktFilter = "bekreftet" | "venter" | "ledige" | "medlemmer" | null;

function formatDatoKort(dato: string): string {
  const parsed = new Date(`${dato}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dato;
  return parsed.toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatDato(dato: string): string {
  const parsed = new Date(`${dato}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dato;
  return parsed.toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type RolleRad = {
  rolle: Rolle;
  minBehov: number;
  synlige: { TildelingID: string; PersonID: string }[];
  visPersoner: { TildelingID: string; PersonID: string }[];
  harLedig: boolean;
  visRolle: boolean;
  bekreftede: number;
  ventende: number;
  forfall: number;
};

function rolleRaderForSondag(
  db: DatabaseState,
  gudstjenesteId: string,
  gruppensRoller: Rolle[],
  oversiktFilter: OversiktFilter
): RolleRad[] {
  return gruppensRoller
    .map((rolle) => {
      const minBehov = getEffektivtBehov(gudstjenesteId, rolle, db.tjenestebehov);
      const tildelinger = db.tildelinger.filter(
        (t) => t.GudstjenesteID === gudstjenesteId && t.RolleID === rolle.RolleID
      );
      const synlige = tildelinger.filter((t) => hentSvarStatus(db, t.TildelingID) !== "Avvist");
      const forfall = tildelinger.filter((t) => hentSvarStatus(db, t.TildelingID) === "Avvist");
      const bekreftede = synlige.filter((t) => hentSvarStatus(db, t.TildelingID) === "Bekreftet");
      const ventende = synlige.filter((t) => hentSvarStatus(db, t.TildelingID) !== "Bekreftet");
      const harLedig = ledigePlasserForRolle(minBehov, bekreftede.length) > 0;
      const visRolle =
        !oversiktFilter || oversiktFilter === "medlemmer"
          ? true
          : oversiktFilter === "ledige"
            ? harLedig
            : oversiktFilter === "bekreftet"
              ? bekreftede.length > 0
              : ventende.length > 0;
      const visPersoner =
        oversiktFilter === "bekreftet"
          ? bekreftede
          : oversiktFilter === "venter"
            ? ventende
            : synlige;
      return {
        rolle,
        minBehov,
        synlige,
        visPersoner,
        harLedig,
        visRolle,
        bekreftede: bekreftede.length,
        ventende: ventende.length,
        forfall: forfall.length,
      };
    })
    .filter((r) => r.visRolle);
}

export const GroupLeaderView: React.FC<GroupLeaderViewProps> = ({
  db,
  selectedPersonId,
  onUpdateDb,
  onSelectPerson,
}) => {
  const [copiedPersonId, setCopiedPersonId] = useState<string | null>(null);
  const [selectedRolleForModal, setSelectedRolleForModal] = useState<Rolle | null>(null);
  const [assignModal, setAssignModal] = useState<{
    gudstjenesteId: string;
    rolleId: string;
    rolleNavn: string;
    gudstjenesteDato: string;
  } | null>(null);
  const [assignSok, setAssignSok] = useState("");
  const [eksternForesporsel, setEksternForesporsel] = useState<string | null>(null);
  const [medlemSok, setMedlemSok] = useState("");
  const [valgtMenighetsmedlem, setValgtMenighetsmedlem] = useState<Person | null>(null);
  const [redigerMin, setRedigerMin] = useState<string | null>(null);
  const [oversiktFilter, setOversiktFilter] = useState<OversiktFilter>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [apneGudstjenester, setApneGudstjenester] = useState<string[]>([]);
  const [visTidligere, setVisTidligere] = useState(false);
  const [leserGudstjenesteId, setLeserGudstjenesteId] = useState<string | null>(null);

  const lukkVeiledning = () => {
    setGuideOpen(false);
  };

  const person = db.personer.find((p) => p.PersonID === selectedPersonId);

  // Finn grupper som denne personen leder eller er nestleder for
  const lededeGrupper = person
    ? finnGrupperForGruppeleder(db, person.PersonID)
    : [];

  // Alle gruppeledere i systemet for raskt bytte dersom valgt person ikke er leder
  const alleGruppeledere = db.personer.filter((p) =>
    finnGrupperForGruppeleder(db, p.PersonID).length > 0
  );

  const [activeGruppeId, setActiveGruppeId] = useState<string>(
    lededeGrupper[0]?.GruppeID || ""
  );

  // Synkroniser activeGruppeId dersom ledede grupper endres
  React.useEffect(() => {
    if (lededeGrupper.length > 0 && !lededeGrupper.some((g) => g.GruppeID === activeGruppeId)) {
      setActiveGruppeId(lededeGrupper[0].GruppeID);
    }
  }, [lededeGrupper, activeGruppeId]);

  const currentGruppe = db.grupper.find((g) => g.GruppeID === activeGruppeId);

  React.useEffect(() => {
    if (oversiktFilter !== "venter" || !currentGruppe) return;
    const d = new Date();
    const iDagNå = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const roller = db.roller.filter((r) => r.GruppeID === currentGruppe.GruppeID && r.Aktiv);
    const ids = db.gudstjenester
      .filter((g) => g.Dato >= iDagNå)
      .filter(
        (g) => rolleRaderForSondag(db, g.GudstjenesteID, roller, "venter").length > 0
      )
      .map((g) => g.GudstjenesteID);
    setApneGudstjenester(ids);
  }, [oversiktFilter, currentGruppe]);

  React.useEffect(() => {
    if (!guideOpen || !currentGruppe) return;
    const d = new Date();
    const iDagNå = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const roller = db.roller.filter((r) => r.GruppeID === currentGruppe.GruppeID && r.Aktiv);
    const first = db.gudstjenester
      .filter((g) => g.Dato >= iDagNå)
      .slice()
      .sort((a, b) => `${a.Dato} ${a.Tid}`.localeCompare(`${b.Dato} ${b.Tid}`))
      .find((g) =>
        rolleRaderForSondag(db, g.GudstjenesteID, roller, null).some((r) => r.harLedig)
      );
    if (!first) return;
    setApneGudstjenester((prev) =>
      prev.includes(first.GudstjenesteID) ? prev : [...prev, first.GudstjenesteID]
    );
  }, [guideOpen, currentGruppe, db]);

  const handleCopyLink = (targetPersonId: string) => {
    const link = genererPersonligLenke(targetPersonId, undefined, db);
    navigator.clipboard.writeText(link).then(() => {
      setCopiedPersonId(targetPersonId);
      setTimeout(() => setCopiedPersonId(null), 2500);
    });
  };

  const handleAssignPerson = (personId: string) => {
    if (!assignModal) return;
    const updated = settDeltakelseForPerson(
      db,
      personId,
      assignModal.gudstjenesteId,
      assignModal.rolleId,
      "Avventer",
      "Forespurt av gruppeleder"
    );
    onUpdateDb(updated);
    if (!erEksternPersonId(personId)) {
      handleCopyLink(personId);
    }
    setAssignSok("");
    setEksternForesporsel(null);
    setAssignModal(null);
  };

  const handleAssignEkstern = () => {
    if (!assignModal || !eksternForesporsel) return;
    const updated = tildelEksternPerson(
      db,
      assignModal.gudstjenesteId,
      assignModal.rolleId,
      eksternForesporsel,
      "Ekstern person (ikke i menighetsregisteret)"
    );
    onUpdateDb(updated);
    setAssignSok("");
    setEksternForesporsel(null);
    setAssignModal(null);
  };

  // Hvis personen ikke er registrert som leder for noen grupper:
  if (lededeGrupper.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs text-center">
          <Shield className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-900">
            {person?.Navn || "Valgt person"} er ikke registrert som tjenestegruppeleder
          </h2>
          <p className="text-slate-600 text-sm mt-1 max-w-md mx-auto">
            I Gudstjenesteplanlegger 2.0 får gruppeledere tilgang til sin tjenestegruppe, gruppemedlemmer og bemanning for tilknyttede roller.
          </p>

          <div className="mt-6 pt-6 border-t border-slate-100 max-w-lg mx-auto">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-3">
              Velg en tjenestegruppeleder for å teste visningen:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {alleGruppeledere.map((leder) => {
                const gruppenavn = db.grupper
                  .filter((g) => g.GruppelederID === leder.PersonID || g.NestlederID === leder.PersonID)
                  .map((g) => g.Gruppenavn)
                  .join(", ");

                return (
                  <button
                    key={leder.PersonID}
                    type="button"
                    onClick={() => onSelectPerson(leder.PersonID)}
                    className="p-3 text-left bg-[#eef5f1]/70 hover:bg-[#eef5f1] border border-[#d2e8d9] rounded-xl transition cursor-pointer"
                  >
                    <div className="font-bold text-[#1e3e2b] text-sm">{leder.Navn}</div>
                    <div className="text-xs text-[#2d5a3f] mt-0.5 truncate">{gruppenavn}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Gruppens medlemmer (inkl. leder/nestleder hvis de mangler medlemsrad)
  const gruppensMedlemmer = currentGruppe
    ? finnMedlemmerIGruppe(db, currentGruppe.GruppeID)
    : [];
  const oversiktPersoner: Person[] = (() => {
    const byId = new Map<string, Person>();
    for (const m of gruppensMedlemmer) byId.set(m.person.PersonID, m.person);
    if (currentGruppe?.GruppelederID) {
      const leder = db.personer.find((p) => p.PersonID === currentGruppe.GruppelederID);
      if (leder) byId.set(leder.PersonID, leder);
    }
    if (currentGruppe?.NestlederID) {
      const nest = db.personer.find((p) => p.PersonID === currentGruppe.NestlederID);
      if (nest) byId.set(nest.PersonID, nest);
    }
    return Array.from(byId.values());
  })();

  // Roller som tilhører denne gruppen
  const gruppensRoller = currentGruppe
    ? db.roller.filter((r) => r.GruppeID === currentGruppe.GruppeID && r.Aktiv)
    : [];

  const iDag = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const sorterteGudstjenester = db.gudstjenester
    .slice()
    .sort((a, b) => `${a.Dato} ${a.Tid}`.localeCompare(`${b.Dato} ${b.Tid}`));
  const kommendeGudstjenester = sorterteGudstjenester.filter((g) => g.Dato >= iDag);
  const tidligereGudstjenester = sorterteGudstjenester.filter((g) => g.Dato < iDag).reverse();

  const oversikt = kommendeGudstjenester.reduce(
    (acc, gudstjeneste) =>
      plusBemanningstall(
        acc,
        summerBemanning(db, gudstjeneste.GudstjenesteID, gruppensRoller)
      ),
    tomtBemanningstall()
  );
  const bekreftetProsent =
    oversikt.behov > 0 ? Math.round((oversikt.bekreftet / oversikt.behov) * 100) : 0;
  const ledigeOgForfall = oversikt.ledige;

  const velgOversiktFilter = (neste: Exclude<OversiktFilter, null>) => {
    const aktiv: OversiktFilter = oversiktFilter === neste ? null : neste;
    setOversiktFilter(aktiv);
    if (aktiv === "medlemmer") {
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>("[data-guide='medlemmer']")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  const handleSettStatus = (
    personId: string,
    gudstjenesteId: string,
    rolleId: string,
    status: DeltakelseStatus,
    kopierLenke: boolean
  ) => {
    const kommentar =
      status === "Deltar"
        ? "Bekreftet av gruppeleder"
        : status === "Avventer"
          ? "Forespurt av gruppeleder"
          : status === "Avvist"
            ? "Avvist av gruppeleder"
            : undefined;
    const updated = settDeltakelseForPerson(
      db,
      personId,
      gudstjenesteId,
      rolleId,
      status,
      kommentar
    );
    onUpdateDb(updated);
    if (kopierLenke) handleCopyLink(personId);
  };

  const handleLeggTilMedlem = (personId: string) => {
    if (!currentGruppe) return;
    const updatedDb: DatabaseState = {
      ...db,
      gruppemedlemmer: sikreGruppemedlemskap(
        db.gruppemedlemmer,
        currentGruppe.GruppeID,
        personId,
        "Medlem"
      ),
    };
    saveDatabase(updatedDb);
    onUpdateDb(updatedDb);
    setMedlemSok("");
    setValgtMenighetsmedlem(null);
  };

  const handleSettMinBehov = (gudstjenesteId: string, rolleId: string, antall: number) => {
    const now = new Date().toISOString().split("T")[0];
    const verdi = Math.max(0, antall);
    const existingIndex = db.tjenestebehov.findIndex(
      (tb) => tb.GudstjenesteID === gudstjenesteId && tb.RolleID === rolleId
    );
    let tjenestebehov: Tjenestebehov[];
    if (existingIndex >= 0) {
      tjenestebehov = db.tjenestebehov.map((tb, i) =>
        i === existingIndex ? { ...tb, Antall: verdi, Aktiv: true, SistEndret: now } : tb
      );
    } else {
      const maxNr = db.tjenestebehov.reduce((max, tb) => {
        const num = parseInt(tb.TjenestebehovID.replace(/\D/g, ""), 10);
        return !isNaN(num) && num > max ? num : max;
      }, 0);
      tjenestebehov = [
        ...db.tjenestebehov,
        {
          TjenestebehovID: `TB${String(maxNr + 1).padStart(3, "0")}`,
          GudstjenesteID: gudstjenesteId,
          RolleID: rolleId,
          Antall: verdi,
          Aktiv: true,
          OpprettetDato: now,
          SistEndret: now,
        },
      ];
    }
    const updatedDb = { ...db, tjenestebehov };
    saveDatabase(updatedDb);
    onUpdateDb(updatedDb);
  };

  const medlemKandidater = (() => {
    const q = medlemSok.trim().toLowerCase();
    if (!q) return [];
    return db.personer
      .filter((p) => p.Aktiv)
      .filter((p) => !oversiktPersoner.some((m) => m.PersonID === p.PersonID))
      .filter(
        (p) =>
          p.Navn.toLowerCase().includes(q) ||
          (p.Fornavn || "").toLowerCase().includes(q)
      )
      .slice()
      .sort((a, b) => a.Navn.localeCompare(b.Navn, "nb"))
      .slice(0, 8);
  })();

  const vekselApne = (id: string) => {
    setApneGudstjenester((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const renderSondagKort = (
    gudstjeneste: (typeof db.gudstjenester)[number]
  ) => {
    const alle = rolleRaderForSondag(db, gudstjeneste.GudstjenesteID, gruppensRoller, null);
    const visRoller =
      oversiktFilter && oversiktFilter !== "medlemmer"
        ? rolleRaderForSondag(db, gudstjeneste.GudstjenesteID, gruppensRoller, oversiktFilter)
        : alle;
    const bemanning = summerBemanning(db, gudstjeneste.GudstjenesteID, gruppensRoller);
    const tall = {
      bekreftet: bemanning.bekreftet,
      venter: bemanning.venter,
      ledige: bemanning.ledige,
    };
    const erApen = apneGudstjenester.includes(gudstjeneste.GudstjenesteID);
    const komplett = tall.ledige === 0 && tall.venter === 0;
    const visAlleTall = !oversiktFilter || oversiktFilter === "medlemmer";
    const ventendeNavn = visRoller
      .flatMap((r) => r.visPersoner)
      .map((t) => {
        const p = db.personer.find((pers) => pers.PersonID === t.PersonID);
        return p?.Fornavn || p?.Navn || "Ukjent";
      })
      .filter((navn, i, arr) => arr.indexOf(navn) === i);
    const kant = visAlleTall
      ? tall.ledige > 0
        ? "border-l-[3px] border-l-rose-400"
        : tall.venter > 0
        ? "border-l-[3px] border-l-amber-400"
        : "border-l-[3px] border-l-transparent"
      : oversiktFilter === "ledige"
        ? "border-l-[3px] border-l-rose-400"
        : oversiktFilter === "venter"
          ? "border-l-[3px] border-l-amber-400"
          : "border-l-[3px] border-l-emerald-400";

    const åpneSettOpp = (rolle: Rolle) => {
      setAssignSok("");
      setEksternForesporsel(null);
      setAssignModal({
        gudstjenesteId: gudstjeneste.GudstjenesteID,
        rolleId: rolle.RolleID,
        rolleNavn: rolle.Rollenavn,
        gudstjenesteDato: gudstjeneste.Dato,
      });
    };

    return (
      <div
        key={gudstjeneste.GudstjenesteID}
        className={`bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden ${kant} ${
          visAlleTall && komplett ? "opacity-80" : ""
        }`}
      >
        <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => vekselApne(gudstjeneste.GudstjenesteID)}
          aria-expanded={erApen}
          className="flex-1 min-w-0 text-left px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50/80 cursor-pointer"
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
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] tabular-nums font-semibold shrink-0">
            {visAlleTall ? (
              <>
                <span className={tall.bekreftet ? "text-emerald-700" : "text-slate-400"}>
                  {tall.bekreftet} bekr.
                </span>
                <span className={tall.venter ? "text-amber-800" : "text-slate-400"}>
                  {tall.venter} venter
                </span>
                <span className={tall.ledige ? "text-rose-800" : "text-slate-400"}>
                  {tall.ledige} ledige
                </span>
              </>
            ) : oversiktFilter === "bekreftet" ? (
              <span className="text-emerald-700">{tall.bekreftet} bekreftet</span>
            ) : oversiktFilter === "venter" ? (
              <span className="text-amber-900 font-semibold text-xs text-right max-w-[12rem] sm:max-w-xs">
                {ventendeNavn.length > 0 ? ventendeNavn.join(", ") : `${tall.venter} venter`}
              </span>
            ) : (
              <span className="text-rose-800">{tall.ledige} ledige</span>
            )}
          </div>
        </button>
        {visProgramIkon(db, selectedPersonId, gudstjeneste.GudstjenesteID) && (
          <div className="flex items-center pr-3">
            <IkonHandling
              label={
                kanRedigereProgram(db, selectedPersonId, gudstjeneste.GudstjenesteID)
                  ? "Rediger gudstjenesteprogram"
                  : "Åpne gudstjenesteprogram"
              }
              Icon={
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
          </div>
        )}
        </div>

        {erApen && (
          <div className="border-t border-slate-100 px-4 pb-2.5 pt-1">
            <GudstjenesteRolleOversikt
              db={db}
              gudstjenesteId={gudstjeneste.GudstjenesteID}
              roller={db.roller.filter((r) => r.Aktiv)}
              ansvarRolleIds={gruppensRoller.map((r) => r.RolleID)}
              filter={
                oversiktFilter === "ledige" ||
                oversiktFilter === "venter" ||
                oversiktFilter === "bekreftet"
                  ? oversiktFilter
                  : null
              }
              onSelectRolle={setSelectedRolleForModal}
              renderPerson={(person, rolle) => {
                const egen = gruppensRoller.some((r) => r.RolleID === rolle.RolleID);
                if (!egen) return <RolleOversiktNavn person={person} />;
                const erBekreftet = person.status === "Bekreftet";
                const erAvvist = person.status === "Avvist";
                const erVenter = person.status === "Venter";
                return (
                  <span className="inline-flex items-center gap-0.5" data-guide="status">
                    <RolleOversiktNavn person={person} />
                    <IkonHandling
                      label="Bekreft (personen har sagt ja)"
                      Icon={Check}
                      variant="confirm"
                      active={erBekreftet}
                      onClick={() =>
                        handleSettStatus(
                          person.personId,
                          gudstjeneste.GudstjenesteID,
                          rolle.RolleID,
                          "Deltar",
                          false
                        )
                      }
                    />
                    <IkonHandling
                      label="Sett status til forespurt / venter svar"
                      Icon={Clock}
                      variant="wait"
                      active={erVenter}
                      onClick={() =>
                        handleSettStatus(
                          person.personId,
                          gudstjeneste.GudstjenesteID,
                          rolle.RolleID,
                          "Avventer",
                          false
                        )
                      }
                    />
                    <IkonHandling
                      label="Marker som forfall / kan ikke"
                      Icon={X}
                      variant="decline"
                      active={erAvvist}
                      onClick={() =>
                        handleSettStatus(
                          person.personId,
                          gudstjeneste.GudstjenesteID,
                          rolle.RolleID,
                          "Avvist",
                          false
                        )
                      }
                    />
                    <IkonHandling
                      label="Fjern tildeling"
                      Icon={Trash2}
                      variant="decline"
                      onClick={() =>
                        handleSettStatus(
                          person.personId,
                          gudstjeneste.GudstjenesteID,
                          rolle.RolleID,
                          "Deltar ikke",
                          false
                        )
                      }
                    />
                  </span>
                );
              }}
              renderEtterPersoner={(rolle, personer) => {
                if (oversiktFilter === "venter" || oversiktFilter === "bekreftet") return null;
                const egenRad = alle.find((r) => r.rolle.RolleID === rolle.RolleID);
                if (!egenRad) return null;
                const minNokkel = `${gudstjeneste.GudstjenesteID}:${rolle.RolleID}`;
                const viserMinFelt = redigerMin === minNokkel;
                const dekkerMin = egenRad.bekreftede >= egenRad.minBehov;
                return (
                  <>
                    {viserMinFelt && (
                      <label className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                        Min.
                        <input
                          type="number"
                          min={0}
                          autoFocus
                          value={egenRad.minBehov}
                          onChange={(e) =>
                            handleSettMinBehov(
                              gudstjeneste.GudstjenesteID,
                              rolle.RolleID,
                              parseInt(e.target.value, 10) || 0
                            )
                          }
                          onBlur={() => setRedigerMin(null)}
                          className="w-14 border border-slate-200 rounded-lg px-1.5 py-0.5 text-xs bg-white font-semibold"
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      onClick={() => setRedigerMin(viserMinFelt ? null : minNokkel)}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full cursor-pointer ${
                        dekkerMin
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-800"
                      }`}
                      title="Veiledende antall. Overbooking er greit."
                    >
                      {egenRad.bekreftede} / {egenRad.minBehov}
                    </button>
                    {oversiktFilter !== "venter" ? (
                      <button
                        type="button"
                        onClick={() => åpneSettOpp(rolle)}
                        data-guide="sett-opp"
                        className="p-1.5 bg-[#2d5a3f] hover:bg-[#234731] text-white rounded-md cursor-pointer shrink-0"
                        title="Sett opp"
                        aria-label="Sett opp"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                  </>
                );
              }}
            />
          </div>
        )}
      </div>
    );
  };

  const visKommende = kommendeGudstjenester.filter((gudstjeneste) => {
    if (!oversiktFilter || oversiktFilter === "medlemmer") return true;
    return rolleRaderForSondag(
      db,
      gudstjeneste.GudstjenesteID,
      gruppensRoller,
      oversiktFilter
    ).length > 0;
  });

  const visTidligereFiltrert = tidligereGudstjenester.filter((gudstjeneste) => {
    if (!oversiktFilter || oversiktFilter === "medlemmer") return true;
    return rolleRaderForSondag(
      db,
      gudstjeneste.GudstjenesteID,
      gruppensRoller,
      oversiktFilter
    ).length > 0;
  });

  const venterPersonIds = new Set(
    kommendeGudstjenester.flatMap((gud) =>
      db.tildelinger
        .filter(
          (t) =>
            t.GudstjenesteID === gud.GudstjenesteID &&
            gruppensRoller.some((r) => r.RolleID === t.RolleID) &&
            hentSvarStatus(db, t.TildelingID) === "Venter"
        )
        .map((t) => t.PersonID)
    )
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Gruppevelger hvis leder har flere grupper */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#2d5a3f] uppercase tracking-wider">
            <Users className="w-4 h-4" />
            <span>
              Tjenestegruppeleder-visning
              {person?.Fornavn ? ` for ${person.Fornavn}` : ""}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
            {currentGruppe?.Gruppenavn || "Tjenestegruppe"}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {currentGruppe?.Beskrivelse}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2d5a3f] bg-[#eef5f1] hover:bg-[#dceee3] border border-[#d2e8d9] px-3 py-1.5 rounded-xl cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Slik gjør du det
          </button>
        {lededeGrupper.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
              Bytt tjenestegruppe:
            </span>
            <select
              value={activeGruppeId}
              onChange={(e) => setActiveGruppeId(e.target.value)}
              className="text-sm font-medium border border-slate-300 rounded-xl px-3 py-2 bg-slate-50 focus:ring-2 focus:ring-[#2d5a3f] focus:outline-hidden"
            >
              {lededeGrupper.map((g) => (
                <option key={g.GruppeID} value={g.GruppeID}>
                  {g.Gruppenavn}
                </option>
              ))}
            </select>
          </div>
        )}
        </div>
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
                tall: oversikt.venter,
                label: "Venter på svar",
                Icon: CircleHelp,
                wrap: "bg-amber-50 border-amber-100 text-amber-950",
                icon: "text-amber-500",
                aktiv: "ring-2 ring-amber-400",
              },
              {
                id: "bekreftet" as const,
                tall: oversikt.bekreftet,
                label: `Bekreftet (${bekreftetProsent}%)`,
                Icon: CheckCircle2,
                wrap: "bg-emerald-50 border-emerald-100 text-emerald-900",
                icon: "text-emerald-600",
                aktiv: "ring-2 ring-emerald-400",
              },
              {
                id: "medlemmer" as const,
                tall: oversiktPersoner.length,
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
        <p className="text-[11px] text-slate-500">
          Tallene gjelder {currentGruppe?.Gruppenavn || "denne tjenestegruppen"}, ikke
          oppgaver personen har i andre grupper.
        </p>
        {oversiktFilter && (
          <p className="text-[11px] text-slate-500">
            Viser {oversiktFilter === "bekreftet"
              ? "bekreftede oppgaver"
              : oversiktFilter === "venter"
                ? "oppgaver som venter på svar"
                : oversiktFilter === "ledige"
                  ? "roller med ledige plasser"
                  : "gruppemedlemmer"}
            . Trykk kortet igjen for å vise alle.
          </p>
        )}
      </div>

      {oversiktFilter !== "medlemmer" && (
      <div className="space-y-2" data-guide="gudstjenester">
        <h3 className="text-sm font-bold text-slate-900">Kommende gudstjenester</h3>

        {gruppensRoller.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center">
            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm text-slate-600">
              Ingen roller er tilknyttet denne tjenestegruppen i dagens register.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visKommende.map((gudstjeneste) => renderSondagKort(gudstjeneste))}
            {visKommende.length === 0 && (
              <p className="text-sm text-slate-500 bg-white rounded-2xl border border-slate-200 px-4 py-6 text-center">
                Ingen treff for dette filteret. Trykk kortet igjen for å vise alle.
              </p>
            )}
          </div>
        )}

        {visTidligereFiltrert.length > 0 && (
          <div className="pt-2">
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
                {visTidligereFiltrert.map((gudstjeneste) => renderSondagKort(gudstjeneste))}
              </div>
            )}
          </div>
        )}
      </div>
      )}


      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div
          data-guide="medlemmer"
          className={
            oversiktFilter === "medlemmer"
              ? "rounded-xl ring-2 ring-sky-300 p-3 -mx-1"
              : undefined
          }
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Gruppemedlemmer
          </h3>
          <div className="relative max-w-md mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={medlemSok}
              onChange={(e) => setMedlemSok(e.target.value)}
              placeholder="Søk i menigheten..."
              className="w-full text-sm border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
            />
            {medlemSok.trim() && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                {medlemKandidater.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-500">Ingen treff i registeret.</div>
                ) : (
                  medlemKandidater.map((p) => (
                    <button
                      key={p.PersonID}
                      type="button"
                      onClick={() => {
                        setValgtMenighetsmedlem(p);
                        setMedlemSok("");
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer"
                    >
                      {p.Navn}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {valgtMenighetsmedlem && (
            <div className="flex flex-wrap items-center gap-2 mb-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-sm font-semibold text-slate-900 flex-1 min-w-[8rem]">
                {valgtMenighetsmedlem.Navn}
              </span>
              <button
                type="button"
                onClick={() => handleLeggTilMedlem(valgtMenighetsmedlem.PersonID)}
                className="text-xs font-semibold text-white bg-[#2d5a3f] px-3 py-1.5 rounded-lg cursor-pointer"
              >
                Legg til
              </button>
            </div>
          )}

          {oversiktPersoner.length === 0 ? (
            <p className="text-xs text-slate-400">Ingen medlemmer i gruppen ennå.</p>
          ) : (
            <ul className="space-y-1.5" data-guide="del-lenke">
              {oversiktPersoner
                .slice()
                .sort((a, b) => {
                  const aV = venterPersonIds.has(a.PersonID) ? 0 : 1;
                  const bV = venterPersonIds.has(b.PersonID) ? 0 : 1;
                  if (aV !== bV) return aV - bV;
                  return a.Navn.localeCompare(b.Navn, "nb");
                })
                .map((m) => (
                  <li
                    key={m.PersonID}
                    className="flex items-center justify-between gap-2 px-1 py-1"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-slate-800 truncate">{m.Navn}</span>
                      {venterPersonIds.has(m.PersonID) && (
                        <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full shrink-0">
                          Venter
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <IkonHandling
                        label={`Se Min side som ${m.Fornavn || m.Navn}`}
                        Icon={Eye}
                        onClick={() => onSelectPerson(m.PersonID, "personal")}
                      />
                      <IkonHandling
                        label="Kopier Min side-lenke"
                        Icon={Share2}
                        copied={copiedPersonId === m.PersonID}
                        onClick={() => handleCopyLink(m.PersonID)}
                      />
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      {/* Modal for å tildele medlem */}
      {assignModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-0.5">
              Sett opp {assignModal.rolleNavn}
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              {formatDato(assignModal.gudstjenesteDato)}
            </p>
            {eksternForesporsel ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-700">
                  <strong>{eksternForesporsel}</strong> finnes ikke i personregisteret.
                  Vil du sette personen opp som ekstern på denne gudstjenesten?
                </p>
                <p className="text-xs text-slate-500">
                  Eksterne lagres ikke i menighetens personregister.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEksternForesporsel(null)}
                    className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Nei
                  </button>
                  <button
                    type="button"
                    onClick={handleAssignEkstern}
                    className="px-4 py-2 text-sm bg-[#2d5a3f] hover:bg-[#234731] text-white font-semibold rounded-xl cursor-pointer"
                  >
                    Ja, ekstern person
                  </button>
                </div>
              </div>
            ) : (
              <>
                {(() => {
                  const opptatt = new Set(
                    db.tildelinger
                      .filter(
                        (t) =>
                          t.GudstjenesteID === assignModal.gudstjenesteId &&
                          t.RolleID === assignModal.rolleId &&
                          hentSvarStatus(db, t.TildelingID) !== "Avvist"
                      )
                      .map((t) => t.PersonID)
                  );
                  const q = assignSok.trim().toLowerCase();
                  const treffer = (p: Person) => {
                    if (!q) return true;
                    const navn = `${p.Fornavn || ""} ${p.Etternavn || ""} ${p.Navn || ""}`.toLowerCase();
                    return navn.includes(q);
                  };
                  const iGruppen = oversiktPersoner
                    .filter((p) => !opptatt.has(p.PersonID) && treffer(p))
                    .slice()
                    .sort((a, b) =>
                      (a.Fornavn || a.Navn).localeCompare(b.Fornavn || b.Navn, "nb")
                    );
                  const gruppeIds = new Set(oversiktPersoner.map((p) => p.PersonID));
                  const iMenigheten = q
                    ? db.personer
                        .filter(
                          (p) =>
                            p.Aktiv !== false &&
                            !gruppeIds.has(p.PersonID) &&
                            !opptatt.has(p.PersonID) &&
                            treffer(p)
                        )
                        .slice()
                        .sort((a, b) =>
                          (a.Fornavn || a.Navn).localeCompare(b.Fornavn || b.Navn, "nb")
                        )
                        .slice(0, 12)
                    : [];
                  const ingenTreff = q.length > 0 && iGruppen.length === 0 && iMenigheten.length === 0;
                  return (
                    <>
                      <div className="relative mb-3">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="search"
                          value={assignSok}
                          onChange={(e) => setAssignSok(e.target.value)}
                          placeholder="Søk i gruppen eller menigheten…"
                          autoFocus
                          className="w-full text-sm border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
                        />
                      </div>
                      <div className="max-h-64 overflow-y-auto space-y-3">
                        <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                          {iGruppen.length === 0 ? (
                            <li className="px-4 py-3 text-sm text-slate-500">
                              {q ? "Ingen i gruppen matcher." : "Ingen ledige i gruppen."}
                            </li>
                          ) : (
                            iGruppen.map((p) => (
                              <li key={p.PersonID}>
                                <button
                                  type="button"
                                  onClick={() => handleAssignPerson(p.PersonID)}
                                  className="w-full text-left px-4 py-3 text-sm font-medium text-slate-900 hover:bg-[#eef5f1] cursor-pointer"
                                >
                                  {p.Fornavn || p.Navn}
                                </button>
                              </li>
                            ))
                          )}
                        </ul>
                        {iMenigheten.length > 0 && (
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1 px-1">
                              Fra menigheten
                            </p>
                            <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                              {iMenigheten.map((p) => (
                                <li key={p.PersonID}>
                                  <button
                                    type="button"
                                    onClick={() => handleAssignPerson(p.PersonID)}
                                    className="w-full text-left px-4 py-3 text-sm font-medium text-slate-900 hover:bg-[#eef5f1] cursor-pointer"
                                  >
                                    {p.Navn || `${p.Fornavn} ${p.Etternavn}`.trim()}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {ingenTreff && (
                          <button
                            type="button"
                            onClick={() => setEksternForesporsel(assignSok.trim())}
                            className="w-full text-left px-4 py-3 text-sm border border-dashed border-slate-200 rounded-xl text-[#2d5a3f] font-semibold hover:bg-[#eef5f1] cursor-pointer"
                          >
                            Legge til «{assignSok.trim()}» som ekstern person?
                          </button>
                        )}
                      </div>
                    </>
                  );
                })()}
                <div className="flex justify-end mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setAssignSok("");
                      setEksternForesporsel(null);
                      setAssignModal(null);
                    }}
                    className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                  >
                    Avbryt
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal for rollebeskrivelse */}
      {selectedRolleForModal && (
        <RoleDescriptionModal
          rolle={selectedRolleForModal}
          rollebeskrivelse={
            db.rollebeskrivelser.find(
              (rb) => rb.RolleID === selectedRolleForModal.RolleID
            ) || null
          }
          gruppe={
            selectedRolleForModal.GruppeID
              ? db.grupper.find((g) => g.GruppeID === selectedRolleForModal.GruppeID) || null
              : currentGruppe || null
          }
          onClose={() => setSelectedRolleForModal(null)}
        />
      )}

      {leserGudstjenesteId &&
        (() => {
          const gud = db.gudstjenester.find((g) => g.GudstjenesteID === leserGudstjenesteId);
          if (!gud) return null;
          return (
            <ProgramLeserModal
              db={db}
              gudstjeneste={gud}
              uthevPersonId={selectedPersonId}
              selectedPersonId={selectedPersonId}
              redigerbar={kanRedigereProgram(db, selectedPersonId, gud.GudstjenesteID)}
              onClose={() => setLeserGudstjenesteId(null)}
              onUpdateDb={onUpdateDb}
            />
          );
        })()}

      <GroupLeaderGuide open={guideOpen} onClose={lukkVeiledning} />
    </div>
  );
};
