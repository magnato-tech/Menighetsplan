import React from "react";
import { DatabaseState, erGruppeledergruppe, lederforumKilderForPerson } from "../services/dataService";
import { Gruppe } from "../types/database";
import { Pencil, Star, X } from "lucide-react";
import { RolleIkon } from "./RolleIkon";

interface GroupDetailModalProps {
  gruppe: Gruppe;
  db: DatabaseState;
  onClose: () => void;
  onEdit?: () => void;
}

export const GroupDetailModal: React.FC<GroupDetailModalProps> = ({
  gruppe,
  db,
  onClose,
  onEdit,
}) => {
  const typeNavn = db.gruppetyper.find((gt) => gt.GruppetypeID === gruppe.GruppetypeID)?.Navn;
  const leder = db.personer.find((p) => p.PersonID === gruppe.GruppelederID);
  const nestleder = db.personer.find((p) => p.PersonID === gruppe.NestlederID);

  const medlemIds = new Set(
    db.gruppemedlemmer
      .filter((gm) => gm.GruppeID === gruppe.GruppeID && gm.Aktiv)
      .map((gm) => gm.PersonID)
  );
  if (gruppe.GruppelederID) medlemIds.add(gruppe.GruppelederID);
  if (gruppe.NestlederID) medlemIds.add(gruppe.NestlederID);

  const medlemmer = Array.from(medlemIds)
    .map((id) => {
      const person = db.personer.find((p) => p.PersonID === id);
      if (!person) return null;
      const medlemskap = db.gruppemedlemmer.find(
        (gm) => gm.GruppeID === gruppe.GruppeID && gm.PersonID === id && gm.Aktiv
      );
      const erLeder = gruppe.GruppelederID === id;
      const erNestleder = gruppe.NestlederID === id;
      return { person, medlemskap, erLeder, erNestleder };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => {
      const rank = (row: { erLeder: boolean; erNestleder: boolean }) =>
        row.erLeder ? 0 : row.erNestleder ? 1 : 2;
      const d = rank(a) - rank(b);
      if (d !== 0) return d;
      return a.person.Navn.localeCompare(b.person.Navn, "nb");
    });

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-3">
            <RolleIkon
              rollenavn={
                db.roller.find((r) => r.Aktiv && r.GruppeID === gruppe.GruppeID)?.Rollenavn ||
                gruppe.Gruppenavn
              }
              className="w-11 h-11"
            />
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#2d5a3f]">
                Gruppe
              </span>
              <h2 className="text-xl font-bold text-slate-900">{gruppe.Gruppenavn}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-xs text-slate-500 mb-1">Gruppetype</div>
            <div className="font-semibold text-slate-900 text-sm">{typeNavn || "Ikke satt"}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-xs text-slate-500 mb-1">Medlemmer</div>
            <div className="font-semibold text-slate-900 text-sm">{medlemmer.length}</div>
          </div>
        </div>

        {erGruppeledergruppe(db, gruppe) && (
          <p className="text-xs text-slate-600 bg-[#eef5f1] border border-[#d2e8d9] rounded-xl p-3 mb-4">
            Medlemmene her er gruppeledere og nestledere. Manuelle tillegg kan legges til ved redigering.
          </p>
        )}

        {gruppe.Beskrivelse && (
          <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-3 mb-4">
            {gruppe.Beskrivelse}
          </p>
        )}

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-1.5 text-sm text-slate-800">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0" />
            <span className="font-medium">{leder?.Navn || "Ikke satt"}</span>
            <span className="text-[10px] bg-amber-50 text-amber-800 font-medium px-1.5 py-0.5 rounded border border-amber-200">
              Leder
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-slate-800">
            <Star className="w-3.5 h-3.5 fill-sky-500 text-sky-500 shrink-0" />
            <span className="font-medium">{nestleder?.Navn || "Ikke satt"}</span>
            <span className="text-[10px] bg-sky-50 text-sky-700 font-medium px-1.5 py-0.5 rounded border border-sky-200">
              Nestleder
            </span>
          </div>
        </div>

        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          Deltakere
        </h3>
        <ul className="space-y-1.5">
          {medlemmer.length === 0 && (
            <li className="text-sm text-slate-400 py-2">Ingen deltakere i gruppen.</li>
          )}
          {medlemmer.map(({ person, medlemskap, erLeder, erNestleder }) => (
            <li
              key={person.PersonID}
              className="flex items-center justify-between gap-2 text-sm bg-slate-50 border border-slate-100 rounded-xl px-3 py-2"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {erLeder && (
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0" />
                )}
                {erNestleder && !erLeder && (
                  <Star className="w-3.5 h-3.5 fill-sky-500 text-sky-500 shrink-0" />
                )}
                <span className="font-medium text-slate-900 truncate">{person.Navn}</span>
              </div>
              <span className="text-[11px] text-slate-500 shrink-0 text-right max-w-[14rem]">
                {erLeder
                  ? "Leder"
                  : erNestleder
                    ? "Nestleder"
                    : erGruppeledergruppe(db, gruppe)
                      ? lederforumKilderForPerson(db, person.PersonID)
                          .map((k) => `${k.rolle} · ${k.gruppenavn}`)
                          .join(", ") || medlemskap?.Medlemsrolle || "Manuelt medlem"
                      : medlemskap?.Medlemsrolle || "Medlem"}
              </span>
            </li>
          ))}
        </ul>

        {onEdit && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onEdit}
              className="w-full px-4 py-2 rounded-xl bg-[#2d5a3f] hover:bg-[#234731] text-white text-sm font-semibold cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" />
              Rediger gruppe
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
