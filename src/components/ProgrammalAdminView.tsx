import React from "react";
import { Clock3 } from "lucide-react";
import {
  DatabaseState,
  fyllStandardMalaktiviteter,
  nyMalAktivitet,
  omskrivMalRekkefolge,
  saveDatabase,
  sortertMalaktiviteter,
} from "../services/dataService";
import { ProgramKjoreplan } from "./ProgramKjoreplan";
import { ProgramBrikkeFelt } from "./ProgramBrikke";

interface ProgrammalAdminViewProps {
  db: DatabaseState;
  onUpdateDb: (updatedDb: DatabaseState) => void;
  innebygd?: boolean;
}

export const ProgrammalAdminView: React.FC<ProgrammalAdminViewProps> = ({
  db,
  onUpdateDb,
  innebygd = false,
}) => {
  const mal = sortertMalaktiviteter(db);

  const persister = (updated: DatabaseState) => {
    saveDatabase(updated);
    onUpdateDb(updated);
  };

  const oppdaterMal = (neste: typeof mal) => {
    persister({ ...db, malaktiviteter: omskrivMalRekkefolge(neste) });
  };

  return (
    <div className={innebygd ? "space-y-4" : "space-y-4 max-w-3xl"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {!innebygd && (
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Clock3 className="w-5 h-5 text-[#2d5a3f]" />
              Standard kjøreplan
            </h3>
          )}
          <p className={`text-sm text-slate-600 ${innebygd ? "" : "mt-1"}`}>
            Dra og slipp for å endre rekkefølge. Roller og grupper huskes på brikkene. Personer fylles
            inn når lederen henter malen til en gudstjeneste.
          </p>
        </div>
        {mal.length === 0 && (
          <button
            type="button"
            onClick={() => persister(fyllStandardMalaktiviteter(db))}
            className="px-3 py-1.5 bg-[#2d5a3f] hover:bg-[#234731] text-white text-xs font-semibold rounded-xl cursor-pointer"
          >
            Fyll med standardprogram
          </button>
        )}
      </div>

      <ProgramKjoreplan
        linjer={mal.map((m) => {
          const rolle = m.RolleID ? db.roller.find((r) => r.RolleID === m.RolleID) : undefined;
          const gruppe = rolle?.GruppeID
            ? db.grupper.find((g) => g.GruppeID === rolle.GruppeID)
            : undefined;
          return {
            id: m.MalAktivitetID,
            tittel: m.Tittel,
            varighetMin: m.VarighetMin,
            rolleId: m.RolleID || "",
            forStart: Boolean(m.ForStart),
            merknad: m.Merknad,
            rolleNavn: rolle?.Rollenavn,
            gruppeNavn: gruppe?.Gruppenavn,
            personer: [],
          };
        })}
        roller={db.roller}
        redigerbar
        visKlokkeslett={false}
        visPersonHint
        onChangeLinje={(id, patch: Partial<ProgramBrikkeFelt>) => {
          oppdaterMal(
            mal.map((m) =>
              m.MalAktivitetID === id
                ? {
                    ...m,
                    Tittel: patch.tittel ?? m.Tittel,
                    VarighetMin: patch.varighetMin ?? m.VarighetMin,
                    RolleID: patch.rolleId !== undefined ? patch.rolleId : m.RolleID,
                    ForStart: patch.forStart ?? m.ForStart,
                    Merknad: patch.merknad ?? m.Merknad,
                  }
                : m
            )
          );
        }}
        onDeleteLinje={(id) => oppdaterMal(mal.filter((m) => m.MalAktivitetID !== id))}
        onMove={(from, to) => {
          const neste = [...mal];
          const [item] = neste.splice(from, 1);
          neste.splice(to, 0, item);
          oppdaterMal(neste);
        }}
        onNyAktivitet={() => oppdaterMal([...mal, nyMalAktivitet(mal)])}
      />
    </div>
  );
};
