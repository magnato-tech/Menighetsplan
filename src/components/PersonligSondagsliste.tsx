import React, { useEffect, useMemo, useState } from "react";
import {
  DatabaseState,
  byggPersonligSondagsliste,
  erPaameldingValgt,
  grupperSondagerPerMaaned,
  kanPaameldingEndres,
  togglePaamelding,
  velgMaanedNokkel,
  kanRedigereProgram,
  visProgramIkon,
} from "../services/dataService";
import { RolleIkon } from "./RolleIkon";
import { IkonHandling } from "./IkonHandling";
import { ProgramLeserModal } from "./ProgramLeserModal";
import { RoleDescriptionModal } from "./RoleDescriptionModal";
import { ChevronUp, Info, Pencil, ScrollText } from "lucide-react";
import type { Rolle } from "../types/database";
import type { PåmeldingsRad } from "../services/dataService";

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

type RolleRadProps = {
  rad: PåmeldingsRad;
  gudstjenesteId: string;
  personId: string;
  kompakt: boolean;
  visRollenavn: boolean;
  onToggle: (gudstjenesteId: string, rolleId: string, checked: boolean) => void;
  onVisInstruks: (rolle: Rolle) => void;
};

const RolleRad: React.FC<RolleRadProps> = ({
  rad,
  gudstjenesteId,
  personId,
  kompakt,
  visRollenavn,
  onToggle,
  onVisInstruks,
}) => {
  const [visAndre, setVisAndre] = useState(false);
  const valgt = erPaameldingValgt(rad.status);
  const kanEndre = kanPaameldingEndres(rad.status);
  const andre = rad.personerPå.filter((p) => p.personId !== personId);
  const telling =
    rad.maks != null
      ? `${rad.bekreftetAntall}/${rad.maks}`
      : `${rad.bekreftetAntall}/${rad.behov}`;

  return (
    <li
      className={`flex items-center gap-2 min-w-0 ${kompakt ? "py-1.5" : "py-2"}`}
    >
      <button
        type="button"
        onClick={() => onVisInstruks(rad.rolle)}
        className="flex items-center gap-1.5 min-w-0 shrink-0 text-left cursor-pointer rounded-lg hover:bg-slate-50 px-0.5"
        title="Se instruks"
      >
        <RolleIkon rollenavn={rad.rolle.Rollenavn} className={kompakt ? "w-7 h-7" : "w-8 h-8"} />
        {visRollenavn ? (
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 hidden sm:inline">
            {rad.rolle.Rollenavn}
          </span>
        ) : null}
      </button>

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
          className="w-4 h-4 sm:w-5 sm:h-5 rounded border-slate-300 text-[#2d5a3f] focus:ring-[#2d5a3f] cursor-pointer disabled:opacity-40 disabled:cursor-default"
        />
      </div>
    </li>
  );
}

export const PersonligSondagsliste: React.FC<PersonligSondagslisteProps> = ({
  db,
  personId,
  rolleFilterId,
  onUpdateDb,
}) => {
  const [leserGudstjenesteId, setLeserGudstjenesteId] = useState<string | null>(null);
  const [valgtRolle, setValgtRolle] = useState<Rolle | null>(null);
  const [maanedNokkel, setMaanedNokkel] = useState<string | null>(null);

  const sondager = useMemo(
    () => byggPersonligSondagsliste(db, personId, rolleFilterId),
    [db, personId, rolleFilterId]
  );
  const maaneder = useMemo(() => grupperSondagerPerMaaned(sondager), [sondager]);
  const aktivMaanedNokkel = velgMaanedNokkel(maaneder, maanedNokkel);
  const aktivMaaned = maaneder.find((m) => m.nokkel === aktivMaanedNokkel) ?? null;
  const visRollenavn = !rolleFilterId;

  useEffect(() => {
    setMaanedNokkel((forrige) => velgMaanedNokkel(maaneder, forrige));
  }, [maaneder]);

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

  return (
    <>
      <div className="space-y-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
          {maaneder.map((m) => {
            const aktiv = m.nokkel === aktivMaanedNokkel;
            const visAar = maaneder.some(
              (annen) => annen.nokkel !== m.nokkel && annen.aar !== m.aar
            );
            return (
              <button
                key={m.nokkel}
                type="button"
                onClick={() => setMaanedNokkel(m.nokkel)}
                className={`relative shrink-0 min-h-10 px-3.5 text-sm font-semibold rounded-xl cursor-pointer transition-colors ${
                  aktiv
                    ? "bg-[#2d5a3f] text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {m.etikett}
                {visAar ? ` ${m.aar}` : ""}
                {m.harLedige && !aktiv ? (
                  <span
                    className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500"
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>

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

        <div className="space-y-1.5">
          {(aktivMaaned?.sondager ?? []).map(({ gudstjeneste, roller }) => (
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
                    onToggle={handleToggle}
                    onVisInstruks={setValgtRolle}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>

        {aktivMaaned && aktivMaaned.sondager.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-sm text-slate-500">
            Ingen gudstjenester denne måneden.
          </div>
        ) : null}
      </div>

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
