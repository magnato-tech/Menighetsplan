import React, { useState } from "react";
import { DatabaseState, AppView } from "../services/dataService";
import { Person } from "../types/database";
import { IkonHandling } from "./IkonHandling";
import { Search, Eye, Share2, Mail, Phone, MapPin } from "lucide-react";

function visningsadresse(p: Person): string {
  const linje = [p.Adresse, [p.Postnummer, p.Poststed].filter(Boolean).join(" ")]
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  return linje.join(", ");
}

interface GruppeMedlemListeProps {
  db: DatabaseState;
  medlemmer: Person[];
  venterPersonIds: Set<string>;
  uthevMedlemmer: boolean;
  copiedPersonId: string | null;
  onCopyLink: (personId: string) => void;
  onSelectPerson: (personId: string, view?: AppView) => void;
  onViewAsMember?: (personId: string, view?: AppView) => void;
  onLeggTilMedlem: (personId: string) => void;
  onOpprettNyPerson?: (navn: string) => void;
  /** Ingen ytre kort-ramme (f.eks. i popup på bemanning). */
  utenRamme?: boolean;
}

export const GruppeMedlemListe: React.FC<GruppeMedlemListeProps> = ({
  db,
  medlemmer,
  venterPersonIds,
  uthevMedlemmer,
  copiedPersonId,
  onCopyLink,
  onSelectPerson,
  onViewAsMember,
  onLeggTilMedlem,
  onOpprettNyPerson,
  utenRamme = false,
}) => {
  const [medlemSok, setMedlemSok] = useState("");
  const [valgtMenighetsmedlem, setValgtMenighetsmedlem] = useState<Person | null>(null);

  const medlemKandidater = (() => {
    const q = medlemSok.trim().toLowerCase();
    if (!q) return [];
    return db.personer
      .filter((p) => p.Aktiv)
      .filter((p) => !medlemmer.some((m) => m.PersonID === p.PersonID))
      .filter(
        (p) =>
          p.Navn.toLowerCase().includes(q) ||
          (p.Fornavn || "").toLowerCase().includes(q)
      )
      .slice()
      .sort((a, b) => a.Navn.localeCompare(b.Navn, "nb"))
      .slice(0, 8);
  })();

  return (
    <div
      className={
        utenRamme
          ? undefined
          : "bg-white p-5 rounded-2xl border border-slate-200 shadow-xs"
      }
    >
      <div
        data-guide="medlemmer"
        className={uthevMedlemmer ? "rounded-xl ring-2 ring-sky-300 p-3 -mx-1" : undefined}
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
                <div className="px-3 py-2 text-xs text-slate-500">
                  {onOpprettNyPerson && medlemSok.trim().length >= 2 ? (
                    <button
                      type="button"
                      onClick={() => {
                        onOpprettNyPerson(medlemSok.trim());
                        setMedlemSok("");
                      }}
                      className="text-[#2d5a3f] font-semibold hover:underline cursor-pointer"
                    >
                      Opprett «{medlemSok.trim()}» som ny person
                    </button>
                  ) : (
                    "Ingen treff i registeret."
                  )}
                </div>
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
              onClick={() => {
                onLeggTilMedlem(valgtMenighetsmedlem.PersonID);
                setValgtMenighetsmedlem(null);
              }}
              className="text-xs font-semibold text-white bg-[#2d5a3f] px-3 py-1.5 rounded-lg cursor-pointer"
            >
              Legg til
            </button>
          </div>
        )}

        {medlemmer.length === 0 ? (
          <p className="text-xs text-slate-400">Ingen medlemmer i gruppen ennå.</p>
        ) : (
          <ul className="space-y-1.5" data-guide="del-lenke">
            {medlemmer
              .slice()
              .sort((a, b) => {
                const aV = venterPersonIds.has(a.PersonID) ? 0 : 1;
                const bV = venterPersonIds.has(b.PersonID) ? 0 : 1;
                if (aV !== bV) return aV - bV;
                return a.Navn.localeCompare(b.Navn, "nb");
              })
              .map((m) => {
                const adresse = visningsadresse(m);
                const telefon = String(m.Telefon || "").trim();
                const epost = String(m.Epost || "").trim();
                return (
                  <li
                    key={m.PersonID}
                    className="flex items-start justify-between gap-3 px-1 py-2.5 border-b border-slate-100 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-slate-800 truncate">{m.Navn}</span>
                        {venterPersonIds.has(m.PersonID) && (
                          <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full shrink-0">
                            Venter
                          </span>
                        )}
                        {m.PersonStatus === "ny" && (
                          <span className="text-[10px] font-semibold text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-full shrink-0">
                            Ny
                          </span>
                        )}
                      </span>
                      {(telefon || epost || adresse) && (
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                          {telefon ? (
                            <a
                              href={`tel:${telefon.replace(/\s+/g, "")}`}
                              className="inline-flex items-center gap-1 hover:text-[#2d5a3f]"
                            >
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              {telefon}
                            </a>
                          ) : null}
                          {epost ? (
                            <a
                              href={`mailto:${epost}`}
                              className="hidden md:inline-flex items-center gap-1 hover:text-[#2d5a3f] truncate max-w-[16rem]"
                            >
                              <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                              {epost}
                            </a>
                          ) : null}
                          {adresse ? (
                            <span className="hidden md:inline-flex items-center gap-1 min-w-0">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{adresse}</span>
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      <IkonHandling
                        label={`Forhåndsvis Min side som ${m.Fornavn || m.Navn}`}
                        Icon={Eye}
                        onClick={() =>
                          (onViewAsMember ?? onSelectPerson)(m.PersonID, "personal")
                        }
                      />
                      <IkonHandling
                        label="Kopier personlenke"
                        Icon={Share2}
                        copied={copiedPersonId === m.PersonID}
                        onClick={() => onCopyLink(m.PersonID)}
                      />
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </div>
    </div>
  );
};
