import React from "react";
import type { DatabaseState } from "../types/database";
import {
  byggGruppeSondagStatus,
  type PåmeldingsPerson,
} from "../services/dataService";
import { MinSideRolleKnapper } from "./MinSideRolleHandling";
import { RolleIkon } from "./RolleIkon";

interface GruppeSondagStatusPanelProps {
  db: DatabaseState;
  personId: string;
  gudstjenesteId: string;
  hukedeRolleIds: ReadonlySet<string>;
  ekskluderRolleIds: ReadonlySet<string>;
  onMeldPa: (rolleId: string) => void;
}

function personBadgeStyle(status: PåmeldingsPerson["status"]): string {
  if (status === "Bekreftet") {
    return "bg-[#eef5f1] text-[#1e3e2b] border border-[#d2e8d9]";
  }
  if (status === "Avvist") {
    return "bg-rose-50 text-rose-800 border border-rose-200 line-through opacity-80";
  }
  return "bg-amber-50 text-amber-800 border border-amber-200";
}

export const GruppeSondagStatusPanel: React.FC<GruppeSondagStatusPanelProps> = ({
  db,
  personId,
  gudstjenesteId,
  hukedeRolleIds,
  ekskluderRolleIds,
  onMeldPa,
}) => {
  const grupper = byggGruppeSondagStatus(db, personId, gudstjenesteId);
  const roller = grupper
    .flatMap((g) => g.roller)
    .filter((rad) => !ekskluderRolleIds.has(rad.rolle.RolleID))
    .sort((a, b) => a.rolle.Rollenavn.localeCompare(b.rolle.Rollenavn, "nb"));

  if (roller.length === 0) return null;

  return (
    <>
      {roller.map((rad) => {
        const minStatus = rad.personerPå.find((p) => p.personId === personId)?.status;
        const erBekreftet = minStatus === "Bekreftet";
        const erForespurt = minStatus === "Venter";
        const kanMeldPa =
          hukedeRolleIds.has(rad.rolle.RolleID) &&
          rad.ledige > 0 &&
          !erBekreftet &&
          !erForespurt;
        const telling = `${rad.bekreftet}/${rad.behov}`;

        return (
          <li key={rad.rolle.RolleID} className="min-w-0 py-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <RolleIkon rollenavn={rad.rolle.Rollenavn} className="w-7 h-7" />
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-800 shrink-0 min-w-[4.5rem]">
                {rad.rolle.Rollenavn}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 shrink-0 tabular-nums">
                {telling}
              </span>
              <div className="ml-auto flex items-center gap-1 shrink-0 justify-end flex-wrap">
                {rad.personerPå.map((p) => (
                  <span
                    key={p.personId}
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${personBadgeStyle(p.status)}`}
                  >
                    {p.navn}
                    {p.status === "Venter" ? " ·" : ""}
                  </span>
                ))}
                {kanMeldPa ? (
                  <MinSideRolleKnapper
                    rollenavn={rad.rolle.Rollenavn}
                    erForespurt={false}
                    erBekreftet={false}
                    kanMeldPa
                    erStengt={false}
                    onMeldPa={() => onMeldPa(rad.rolle.RolleID)}
                    onMeldForfallClick={() => {}}
                    onSvarForesporsel={() => {}}
                  />
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </>
  );
};
