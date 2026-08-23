import React from "react";
import {
  DatabaseState,
  getEffektivtBehov,
  hentSvarStatus,
  ledigePlasserForRolle,
} from "../services/dataService";
import { Rolle } from "../types/database";
import { RolleIkon } from "./RolleIkon";

export type RolleOversiktFilter = "bekreftet" | "venter" | "ledige" | null;

export type RolleOversiktPerson = {
  personId: string;
  tildelingId: string;
  navn: string;
  status: "Bekreftet" | "Venter" | "Avvist";
  ekstern: boolean;
};

export function personerIRolle(
  db: DatabaseState,
  gudstjenesteId: string,
  rolleId: string
): RolleOversiktPerson[] {
  return db.tildelinger
    .filter((t) => t.GudstjenesteID === gudstjenesteId && t.RolleID === rolleId)
    .map((t) => {
      const svar = hentSvarStatus(db, t.TildelingID);
      const p = db.personer.find((pers) => pers.PersonID === t.PersonID);
      const navn = t.EksternNavn || p?.Fornavn || p?.Navn;
      if (!navn) return null;
      const status: RolleOversiktPerson["status"] =
        svar === "Bekreftet" ? "Bekreftet" : svar === "Avvist" ? "Avvist" : "Venter";
      return {
        personId: t.PersonID,
        tildelingId: t.TildelingID,
        navn,
        status,
        ekstern: Boolean(t.EksternNavn) || /^EXT/i.test(t.PersonID || ""),
      } satisfies RolleOversiktPerson;
    })
    .filter((x): x is RolleOversiktPerson => x !== null);
}

export function RolleOversiktNavn({ person }: { person: RolleOversiktPerson }) {
  const bekreftet = person.status === "Bekreftet";
  const avvist = person.status === "Avvist";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${
          bekreftet ? "bg-emerald-500" : avvist ? "bg-rose-500" : "bg-amber-400"
        }`}
        title={bekreftet ? "Bekreftet" : avvist ? "Meldt forfall / Kan ikke" : "Forespurt"}
        aria-hidden
      />
      <span className={avvist ? "line-through opacity-75 text-rose-800" : undefined}>
        {person.navn}
      </span>
      {person.ekstern ? (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
          Ekstern
        </span>
      ) : null}
    </span>
  );
}

interface GudstjenesteRolleOversiktProps {
  db: DatabaseState;
  gudstjenesteId: string;
  roller: Rolle[];
  onSelectRolle: (rolle: Rolle) => void;
  filter?: RolleOversiktFilter;
  ansvarRolleIds?: string[];
  skjulUbekreftet?: boolean;
  /** Skjul roller uten synlige frivillige (Min side). Admin/gruppeleder viser alle. */
  skjulTommeRoller?: boolean;
  inkluderPersonId?: string;
  renderPerson?: (person: RolleOversiktPerson, rolle: Rolle) => React.ReactNode;
  renderEtterPersoner?: (rolle: Rolle, personer: RolleOversiktPerson[]) => React.ReactNode;
}

export const GudstjenesteRolleOversikt: React.FC<GudstjenesteRolleOversiktProps> = ({
  db,
  gudstjenesteId,
  roller,
  onSelectRolle,
  filter = null,
  ansvarRolleIds,
  skjulUbekreftet = false,
  skjulTommeRoller = false,
  inkluderPersonId,
  renderPerson,
  renderEtterPersoner,
}) => {
  return (
    <div>
      {roller.map((rolle) => {
        const allePersoner = personerIRolle(db, gudstjenesteId, rolle.RolleID);
        const harAnsvarSett = Array.isArray(ansvarRolleIds);
        const erAnsvar = harAnsvarSett
          ? ansvarRolleIds.includes(rolle.RolleID)
          : true;
        const gjelderFilter = Boolean(filter) && erAnsvar;
        if (gjelderFilter && filter === "venter" && !allePersoner.some((p) => p.status === "Venter")) {
          return null;
        }
        if (
          gjelderFilter &&
          filter === "bekreftet" &&
          !allePersoner.some((p) => p.status === "Bekreftet")
        ) {
          return null;
        }
        if (gjelderFilter && filter === "ledige") {
          const behov = getEffektivtBehov(db, gudstjenesteId, rolle);
          const bekreftet = allePersoner.filter((p) => p.status === "Bekreftet").length;
          if (ledigePlasserForRolle(behov, bekreftet) <= 0) return null;
        }
        const personer = (() => {
          let vis = allePersoner;
          if (gjelderFilter && filter === "venter") vis = vis.filter((p) => p.status === "Venter");
          else if (gjelderFilter && filter === "bekreftet") {
            vis = vis.filter((p) => p.status === "Bekreftet");
          }
          if (harAnsvarSett && !erAnsvar) {
            vis = vis.filter((p) => p.status === "Bekreftet");
          } else if (skjulUbekreftet) {
            vis = vis.filter(
              (p) =>
                p.status === "Bekreftet" ||
                (p.personId === inkluderPersonId && p.status !== "Avvist")
            );
          }
          return vis;
        })();
        if (skjulTommeRoller && personer.length === 0) return null;
        return (
          <div
            key={rolle.RolleID}
            className="flex items-center justify-between gap-3 py-1.5 border-t border-slate-100 min-h-[2rem]"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectRolle(rolle);
              }}
              title="Se instruks"
              className="inline-flex items-center gap-2 min-w-0 text-left cursor-pointer rounded-lg hover:bg-slate-50 px-0.5 py-0.5"
            >
              <RolleIkon rollenavn={rolle.Rollenavn} />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {rolle.Rollenavn}
              </span>
            </button>
            <span className="text-sm font-semibold text-slate-800 text-right inline-flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
              {personer.map((person) => (
                <React.Fragment key={person.tildelingId}>
                  {renderPerson ? renderPerson(person, rolle) : <RolleOversiktNavn person={person} />}
                </React.Fragment>
              ))}
              {renderEtterPersoner?.(rolle, personer)}
            </span>
          </div>
        );
      })}
    </div>
  );
};
