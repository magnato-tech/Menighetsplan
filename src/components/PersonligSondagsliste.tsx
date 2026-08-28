import React, { useEffect, useMemo, useState } from "react";
import {
  DatabaseState,
  antallGjenstaendeMaaneder,
  byggPersonligMaanedsliste,
  byggPersonligSondagsliste,
  erPaameldingValgt,
  forrigeMaanedNokkel,
  forsteUferdigeMaaned,
  kanPaameldingEndres,
  maanedErGjennomgaatt,
  nesteMaanedNokkel,
  semesterFremdrift,
  togglePaamelding,
  velgMaanedNokkel,
  kanRedigereProgram,
  visProgramIkon,
} from "../services/dataService";
import { RolleIkon } from "./RolleIkon";
import { IkonHandling } from "./IkonHandling";
import { ProgramLeserModal } from "./ProgramLeserModal";
import { RoleDescriptionModal, forsteInstruksSetning } from "./RoleDescriptionModal";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Info,
  Pencil,
  ScrollText,
  X,
} from "lucide-react";
import type { Rolle } from "../types/database";
import type { PåmeldingsRad } from "../services/dataService";

const INTRO_STORAGE_PREFIX = "min-side-semester-intro:";
const BANNER_SESSION_KEY = "min-side-semester-banner-lukket";
const FERDIG_STORAGE_PREFIX = "min-side-maaned-ferdig:";

interface PersonligSondagslisteProps {
  db: DatabaseState;
  personId: string;
  rolleFilterId: string | null;
  onUpdateDb: (updatedDb: DatabaseState) => void;
}

function formatDatoKort(dato: string): string {
  const parsed = new Date(`${dato}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dato;
  return parsed.toLocaleDateString("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function lesFerdigeMaaneder(personId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${FERDIG_STORAGE_PREFIX}${personId}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function harSettIntro(personId: string): boolean {
  return localStorage.getItem(`${INTRO_STORAGE_PREFIX}${personId}`) === "1";
}

function markerIntroSett(personId: string) {
  localStorage.setItem(`${INTRO_STORAGE_PREFIX}${personId}`, "1");
}

function erBannerLukketDenneSesjonen(): boolean {
  try {
    return sessionStorage.getItem(BANNER_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function lukkBannerForSesjon() {
  try {
    sessionStorage.setItem(BANNER_SESSION_KEY, "1");
  } catch {
    // Ignorer hvis sessionStorage er utilgjengelig
  }
}

function lagreFerdigMaaned(personId: string, nokkel: string) {
  const neste = lesFerdigeMaaneder(personId);
  neste.add(nokkel);
  localStorage.setItem(`${FERDIG_STORAGE_PREFIX}${personId}`, JSON.stringify(Array.from(neste)));
}

type RolleRadProps = {
  rad: PåmeldingsRad;
  gudstjenesteId: string;
  personId: string;
  kompakt: boolean;
  visRollenavn: boolean;
  instruksTekst?: string;
  /** Kun første søndagskort viser instruks-knapp. */
  visInstruksKnapp?: boolean;
  onToggle: (gudstjenesteId: string, rolleId: string, checked: boolean) => void;
  onVisInstruks: (rolle: Rolle) => void;
};

const RolleRad: React.FC<RolleRadProps> = ({
  rad,
  gudstjenesteId,
  personId,
  kompakt,
  visRollenavn,
  instruksTekst,
  visInstruksKnapp = false,
  onToggle,
  onVisInstruks,
}) => {
  const [visAndre, setVisAndre] = useState(false);
  const valgt = erPaameldingValgt(rad.status);
  const kanEndre = kanPaameldingEndres(rad.status);
  const visInstruksOppsummering =
    Boolean(instruksTekst) && (valgt || rad.status === "venter" || rad.status === "stengt");
  const instruksKort = visInstruksOppsummering ? forsteInstruksSetning(instruksTekst!) : "";
  const visKnapp = visInstruksKnapp && Boolean(instruksKort);
  const andre = rad.personerPå.filter((p) => p.personId !== personId);
  const telling =
    rad.maks != null
      ? `${rad.bekreftetAntall}/${rad.maks}`
      : `${rad.bekreftetAntall}/${rad.behov}`;

  return (
    <li className={`min-w-0 ${visKnapp ? "py-2" : kompakt ? "py-1.5" : "py-2"}`}>
      <div className="flex items-center gap-2 min-w-0">
        <RolleIkon rollenavn={rad.rolle.Rollenavn} className={kompakt ? "w-7 h-7" : "w-8 h-8"} />
        {visRollenavn ? (
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-800 shrink-0 min-w-[4.5rem]">
            {rad.rolle.Rollenavn}
          </span>
        ) : null}

        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 shrink-0 tabular-nums">
          {telling}
        </span>

        <div className="flex-1 min-w-0 flex justify-end">
          {andre.length === 0 ? (
            <span className="text-[11px] text-slate-400">—</span>
          ) : (
            <>
              <div className="hidden sm:flex flex-wrap gap-1 justify-end">
                {andre.map((p) => (
                  <span
                    key={p.personId}
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                      p.status === "Bekreftet"
                        ? "bg-[#eef5f1] text-[#1e3e2b] border border-[#d2e8d9]"
                        : "bg-amber-50 text-amber-800 border border-amber-200"
                    }`}
                  >
                    {p.navn}
                    {p.status === "Venter" ? " ·" : ""}
                  </span>
                ))}
              </div>
              <div className="sm:hidden">
                {!visAndre ? (
                  <button
                    type="button"
                    onClick={() => setVisAndre(true)}
                    className="text-[11px] font-medium text-[#2d5a3f] hover:underline cursor-pointer"
                  >
                    {andre.length === 1 ? andre[0].navn : `${andre.length} andre`}
                  </button>
                ) : (
                  <div className="flex flex-wrap gap-1 justify-end">
                    {andre.map((p) => (
                      <span
                        key={p.personId}
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                          p.status === "Bekreftet"
                            ? "bg-[#eef5f1] text-[#1e3e2b] border border-[#d2e8d9]"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {p.navn}
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => setVisAndre(false)}
                      className="p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      aria-label="Skjul navn"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-1">
          {rad.status === "stengt" ? (
            <span className="text-[10px] font-semibold text-slate-500">Fullt</span>
          ) : null}
          <input
            type="checkbox"
            checked={valgt}
            disabled={!kanEndre && !valgt}
            onChange={(e) => onToggle(gudstjenesteId, rad.rolle.RolleID, e.target.checked)}
            aria-label={`Meld meg på ${rad.rolle.Rollenavn}`}
            className="w-5 h-5 rounded border-slate-300 text-[#2d5a3f] focus:ring-[#2d5a3f] cursor-pointer disabled:opacity-40 disabled:cursor-default"
          />
        </div>
      </div>

      {visKnapp ? (
        <div className="mt-2 pl-9 sm:pl-10">
          <button
            type="button"
            onClick={() => onVisInstruks(rad.rolle)}
            className="w-full min-h-11 px-3.5 py-2.5 flex items-center gap-2 text-left text-sm text-[#2d5a3f] bg-[#eef5f1] hover:bg-[#dceee3] border border-[#d2e8d9] rounded-xl cursor-pointer"
          >
            <span className="flex-1 min-w-0 truncate leading-snug">{instruksKort}</span>
            <ChevronRight className="w-5 h-5 shrink-0" aria-hidden />
          </button>
        </div>
      ) : null}
    </li>
  );
};

export const PersonligSondagsliste: React.FC<PersonligSondagslisteProps> = ({
  db,
  personId,
  rolleFilterId,
  onUpdateDb,
}) => {
  const [leserGudstjenesteId, setLeserGudstjenesteId] = useState<string | null>(null);
  const [valgtRolle, setValgtRolle] = useState<Rolle | null>(null);
  const [maanedNokkel, setMaanedNokkel] = useState<string | null>(null);
  const [ferdigeMaaneder, setFerdigeMaaneder] = useState<Set<string>>(() =>
    lesFerdigeMaaneder(personId)
  );
  const [visIntro, setVisIntro] = useState(() => !harSettIntro(personId));
  const [bannerLukket, setBannerLukket] = useState(() => erBannerLukketDenneSesjonen());
  const [listeAnim, setListeAnim] = useState(false);

  const sondager = useMemo(
    () => byggPersonligSondagsliste(db, personId, rolleFilterId),
    [db, personId, rolleFilterId]
  );
  const maaneder = useMemo(() => byggPersonligMaanedsliste(sondager), [sondager]);
  const aktivMaanedNokkel = velgMaanedNokkel(maaneder, maanedNokkel);
  const aktivMaaned = maaneder.find((m) => m.nokkel === aktivMaanedNokkel) ?? null;
  const visRollenavn = !rolleFilterId;
  const fremdrift = useMemo(
    () => semesterFremdrift(maaneder, ferdigeMaaneder),
    [maaneder, ferdigeMaaneder]
  );
  const nesteNokkel = aktivMaanedNokkel
    ? nesteMaanedNokkel(maaneder, aktivMaanedNokkel)
    : null;
  const forrigeNokkel = aktivMaanedNokkel
    ? forrigeMaanedNokkel(maaneder, aktivMaanedNokkel)
    : null;
  const nesteMaaned = nesteNokkel ? maaneder.find((m) => m.nokkel === nesteNokkel) : null;
  const aktivErGjennomgaatt = aktivMaaned
    ? maanedErGjennomgaatt(aktivMaaned, ferdigeMaaneder)
    : false;
  const gjenstaendeMaaneder = useMemo(
    () => antallGjenstaendeMaaneder(maaneder, ferdigeMaaneder),
    [maaneder, ferdigeMaaneder]
  );
  const forsteUferdige = useMemo(
    () => forsteUferdigeMaaned(maaneder, ferdigeMaaneder),
    [maaneder, ferdigeMaaneder]
  );
  const visPaminnelseBanner =
    !visIntro && gjenstaendeMaaneder > 0 && !bannerLukket;

  useEffect(() => {
    setFerdigeMaaneder(lesFerdigeMaaneder(personId));
    setVisIntro(!harSettIntro(personId));
    setBannerLukket(erBannerLukketDenneSesjonen());
  }, [personId]);

  useEffect(() => {
    setMaanedNokkel((forrige) => velgMaanedNokkel(maaneder, forrige));
  }, [maaneder]);

  useEffect(() => {
    setListeAnim(true);
    const t = window.setTimeout(() => setListeAnim(false), 200);
    return () => window.clearTimeout(t);
  }, [aktivMaanedNokkel]);

  if (sondager.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-2">
        <Info className="w-8 h-8 text-slate-400 mx-auto" />
        <h3 className="text-base font-bold text-slate-800">Ingen kommende gudstjenester</h3>
      </div>
    );
  }

  const handleToggle = (gudstjenesteId: string, rolleId: string, checked: boolean) => {
    const neste = togglePaamelding(db, personId, gudstjenesteId, rolleId, checked);
    if (neste) onUpdateDb(neste);
  };

  const byttMaaned = (nokkel: string) => setMaanedNokkel(nokkel);

  const markerFerdig = () => {
    if (!aktivMaanedNokkel) return;
    lagreFerdigMaaned(personId, aktivMaanedNokkel);
    setFerdigeMaaneder(lesFerdigeMaaneder(personId));
    if (nesteNokkel) byttMaaned(nesteNokkel);
  };

  const lukkIntro = () => {
    markerIntroSett(personId);
    setVisIntro(false);
  };

  const lukkPaminnelseBanner = () => {
    lukkBannerForSesjon();
    setBannerLukket(true);
  };

  const gaTilNesteUferdige = () => {
    if (forsteUferdige) byttMaaned(forsteUferdige.nokkel);
  };

  return (
    <>
      <div className="space-y-3">
        {visPaminnelseBanner ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-[#d2e8d9] bg-[#eef5f1] px-3 py-2.5"
          >
            <Info className="w-4 h-4 text-[#2d5a3f] shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1e3e2b]">
                {gjenstaendeMaaneder === 1
                  ? "1 måned gjenstår i semesterplanen"
                  : `${gjenstaendeMaaneder} måneder gjenstår i semesterplanen`}
              </p>
              <p className="text-xs text-[#2d5a3f]/80 mt-0.5">
                Gå måned for måned og huk av der du kan være med.
              </p>
              {forsteUferdige ? (
                <button
                  type="button"
                  onClick={gaTilNesteUferdige}
                  className="mt-1.5 text-xs font-semibold text-[#2d5a3f] hover:underline cursor-pointer"
                >
                  Gå til {forsteUferdige.etikett.toLowerCase()}
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={lukkPaminnelseBanner}
              className="p-1 text-[#2d5a3f]/70 hover:text-[#2d5a3f] hover:bg-[#d2e8d9]/50 rounded-lg cursor-pointer shrink-0"
              aria-label="Skjul påminnelse"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : null}

        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
          {maaneder.map((m) => {
            const aktiv = m.nokkel === aktivMaanedNokkel;
            const visAar = maaneder.some(
              (annen) => annen.nokkel !== m.nokkel && annen.aar !== m.aar
            );
            const gjennomgaatt = maanedErGjennomgaatt(m, ferdigeMaaneder);
            return (
              <button
                key={m.nokkel}
                type="button"
                onClick={() => byttMaaned(m.nokkel)}
                className={`relative shrink-0 min-h-10 px-3.5 text-sm font-semibold rounded-xl cursor-pointer transition-colors ${
                  aktiv
                    ? "bg-[#2d5a3f] text-white"
                    : gjennomgaatt
                      ? "bg-[#eef5f1] text-[#1e3e2b] border border-[#d2e8d9]"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  {gjennomgaatt && !aktiv ? (
                    <Check className="w-3.5 h-3.5 text-[#2d5a3f]" aria-hidden />
                  ) : null}
                  {m.etikett}
                  {visAar ? ` ${m.aar}` : ""}
                </span>
                {m.harLedige && !aktiv && !gjennomgaatt ? (
                  <span
                    className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500"
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-slate-500 px-0.5">
          {fremdrift.tekst}
          {nesteMaaned && aktivMaanedNokkel !== nesteNokkel
            ? ` · ${nesteMaaned.etikett} neste`
            : ""}
        </p>

        {aktivMaaned ? (
          <p className="text-xs text-slate-500 px-0.5">
            {aktivMaaned.sondager.length}{" "}
            {aktivMaaned.sondager.length === 1 ? "gudstjeneste" : "gudstjenester"} i{" "}
            {new Date(aktivMaaned.aar, aktivMaaned.maaned - 1, 1).toLocaleDateString("nb-NO", {
              month: "long",
              year: "numeric",
            })}
          </p>
        ) : null}

        <div
          className={`space-y-1.5 transition-opacity duration-200 ${
            listeAnim ? "opacity-60" : "opacity-100"
          }`}
        >
          {(aktivMaaned?.sondager ?? []).map(({ gudstjeneste, roller }, sondagIndex) => (
            <div
              key={gudstjeneste.GudstjenesteID}
              className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
            >
              <div className="px-3 sm:px-4 py-2 flex items-center justify-between gap-2 border-b border-slate-100 bg-[#fafbfa]">
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-[#2d5a3f] truncate">
                    {formatDatoKort(gudstjeneste.Dato)}
                    {gudstjeneste.Tid ? ` · kl. ${gudstjeneste.Tid}` : ""}
                  </p>
                  {gudstjeneste.Tema || gudstjeneste.Sted ? (
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {[gudstjeneste.Tema, gudstjeneste.Sted].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </div>
                {visProgramIkon(db, personId, gudstjeneste.GudstjenesteID) ? (
                  <IkonHandling
                    label={
                      kanRedigereProgram(db, personId, gudstjeneste.GudstjenesteID)
                        ? "Rediger gudstjenesteprogram"
                        : "Åpne gudstjenesteprogram"
                    }
                    Icon={
                      kanRedigereProgram(db, personId, gudstjeneste.GudstjenesteID)
                        ? Pencil
                        : ScrollText
                    }
                    variant="sky"
                    onClick={() => setLeserGudstjenesteId(gudstjeneste.GudstjenesteID)}
                  />
                ) : null}
              </div>

              <ul className="divide-y divide-slate-100 px-3 sm:px-4">
                {roller.map((rad) => (
                  <RolleRad
                    key={`${gudstjeneste.GudstjenesteID}-${rad.rolle.RolleID}`}
                    rad={rad}
                    gudstjenesteId={gudstjeneste.GudstjenesteID}
                    personId={personId}
                    kompakt
                    visRollenavn={visRollenavn}
                    instruksTekst={
                      db.rollebeskrivelser.find((rb) => rb.RolleID === rad.rolle.RolleID)
                        ?.Rollebeskrivelse
                    }
                    onToggle={handleToggle}
                    onVisInstruks={setValgtRolle}
                    visInstruksKnapp={sondagIndex === 0}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>

        {aktivMaaned && aktivMaaned.sondager.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-500">
            Ingen gudstjenester denne måneden ennå.
          </div>
        ) : null}

        <div className="sticky bottom-0 z-10 -mx-1 px-1 pt-2 pb-1 bg-linear-to-t from-[#f4f8f5] via-[#f4f8f5] to-transparent">
          <div className="flex flex-wrap items-center gap-2">
            {forrigeNokkel ? (
              <button
                type="button"
                onClick={() => byttMaaned(forrigeNokkel)}
                className="min-h-10 px-3 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl cursor-pointer inline-flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Forrige
              </button>
            ) : null}
            {aktivMaaned && !aktivErGjennomgaatt ? (
              <button
                type="button"
                onClick={markerFerdig}
                className="min-h-10 px-3 text-sm font-semibold text-[#2d5a3f] bg-[#eef5f1] border border-[#d2e8d9] rounded-xl cursor-pointer"
              >
                Ferdig med {aktivMaaned.etikett.toLowerCase()}
              </button>
            ) : null}
            {nesteNokkel && nesteMaaned ? (
              <button
                type="button"
                onClick={() => byttMaaned(nesteNokkel)}
                className="min-h-10 px-3 text-sm font-semibold text-white bg-[#2d5a3f] hover:bg-[#234731] rounded-xl cursor-pointer inline-flex items-center gap-1 ml-auto"
              >
                Neste: {nesteMaaned.etikett.toLowerCase()}
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {visIntro ? (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex justify-center items-end sm:items-center p-0 sm:p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-pointer"
            aria-label="Lukk"
            onClick={lukkIntro}
          />
          <div className="relative bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 p-5 sheet-safe-bottom">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="text-base font-bold text-slate-900">Planlegg semesteret</h3>
              <button
                type="button"
                onClick={lukkIntro}
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl cursor-pointer"
                aria-label="Lukk"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Vi planlegger ett semester om gangen. Gå måned for måned, huk av der du kan være med,
              og trykk «Ferdig med [måned]» eller «Neste» når du er ferdig med en måned.
            </p>
            <button
              type="button"
              onClick={lukkIntro}
              className="mt-4 min-h-11 w-full px-4 text-sm font-semibold text-white bg-[#2d5a3f] hover:bg-[#234731] rounded-xl cursor-pointer"
            >
              Kom i gang
            </button>
          </div>
        </div>
      ) : null}

      {valgtRolle ? (
        <RoleDescriptionModal
          rolle={valgtRolle}
          rollebeskrivelse={
            db.rollebeskrivelser.find((rb) => rb.RolleID === valgtRolle.RolleID) || null
          }
          gruppe={
            valgtRolle.GruppeID
              ? db.grupper.find((g) => g.GruppeID === valgtRolle.GruppeID) || null
              : null
          }
          onClose={() => setValgtRolle(null)}
        />
      ) : null}

      {leserGudstjenesteId
        ? (() => {
            const gud = db.gudstjenester.find((g) => g.GudstjenesteID === leserGudstjenesteId);
            if (!gud) return null;
            return (
              <ProgramLeserModal
                db={db}
                gudstjeneste={gud}
                uthevPersonId={personId}
                selectedPersonId={personId}
                redigerbar={kanRedigereProgram(db, personId, gud.GudstjenesteID)}
                onClose={() => setLeserGudstjenesteId(null)}
                onUpdateDb={onUpdateDb}
              />
            );
          })()
        : null}
    </>
  );
};
