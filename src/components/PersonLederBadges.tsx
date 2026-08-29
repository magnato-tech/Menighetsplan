import React from "react";
import { Users, Star } from "lucide-react";
import type { DatabaseState } from "../types/database";
import { hentLederskapForPerson } from "../services/dataService";

type PersonLederBadgesProps = {
  db: DatabaseState;
  personId: string;
};

function stjerneStil(rolle: "Leder" | "Nestleder"): string {
  return rolle === "Leder"
    ? "text-amber-400 fill-amber-400"
    : "text-blue-500 fill-blue-500";
}

export const PersonLederBadges: React.FC<PersonLederBadgesProps> = ({ db, personId }) => {
  const lederskap = hentLederskapForPerson(db, personId);
  if (lederskap.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-0.5">
      {lederskap.map((l) => (
        <span
          key={l.gruppeId}
          title={`${l.rolle} i ${l.gruppenavn}`}
          className="inline-flex items-center gap-0.5 max-w-[10.5rem] bg-[#eef5f1] text-[#2d5a3f] text-[10px] px-1.5 py-0.5 rounded font-medium border border-[#d2e8d9]"
        >
          <Users className="w-3 h-3 shrink-0 opacity-70" aria-hidden />
          <Star className={`w-3 h-3 shrink-0 ${stjerneStil(l.rolle)}`} aria-hidden />
          <span className="truncate">{l.gruppenavn}</span>
        </span>
      ))}
    </div>
  );
};
