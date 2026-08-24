import React, { useMemo, useState } from "react";
import { Search, Star, Trash2, X } from "lucide-react";
import { IkonHandling } from "./IkonHandling";
import { Gruppemedlem, Person } from "../types/database";
import {
  DatabaseState,
  erGruppeledergruppe,
  nesteGruppeMedlemId,
  saveDatabase,
  sikreGruppemedlemskap,
  synkGruppeledergruppe,
} from "../services/dataService";

interface GroupAdminModalProps {
  db: DatabaseState;
  gruppeId: string;
  onClose: () => void;
  onUpdateDb: (updatedDb: DatabaseState) => void;
}

type Lederskap = "Leder" | "Nestleder" | "Medlem";

const LEDERSKAP_VERDIER = new Set(["Medlem", "Leder", "Nestleder", "Medleder"]);
const GRUNN_TJENESTEROLLER = ["Gruppeleder"];

function visningsinitialer(navn: string): string {
  const parts = String(navn || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function PersonAvatar({ person, size = "md" }: { person: Person; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-9 h-9 text-[10px]" : "w-11 h-11 text-xs";
  return (
    <div
      className={`${dim} rounded-xl bg-[#eef5f1] text-[#2d5a3f] font-bold flex items-center justify-center shrink-0 border border-[#d2e8d9]`}
    >
      {visningsinitialer(person.Navn)}
    </div>
  );
}

export const GroupAdminModal: React.FC<GroupAdminModalProps> = ({
  db,
  gruppeId,
  onClose,
  onUpdateDb,
}) => {
  const gruppe = db.grupper.find((g) => g.GruppeID === gruppeId);
  const [gruppenavn, setGruppenavn] = useState(gruppe?.Gruppenavn || "");
  const [gruppetypeID, setGruppetypeID] = useState(gruppe?.GruppetypeID || "");
  const [beskrivelse, setBeskrivelse] = useState(gruppe?.Beskrivelse || "");
  const [gruppelederID, setGruppelederID] = useState(gruppe?.GruppelederID || "");
  const [nestlederID, setNestlederID] = useState(gruppe?.NestlederID || "");
  const [medlemmer, setMedlemmer] = useState<Gruppemedlem[]>(() =>
    db.gruppemedlemmer.filter((gm) => gm.GruppeID === gruppeId)
  );
  const [sok, setSok] = useState("");

  const nesteId = (draft: Gruppemedlem[]) =>
    nesteGruppeMedlemId([
      ...db.gruppemedlemmer.filter((gm) => gm.GruppeID !== gruppeId),
      ...draft,
    ]);

  const gruppeRoller = useMemo(
    () =>
      db.roller.filter((r) => r.Aktiv && r.GruppeID === gruppeId).sort((a, b) =>
        a.Rollenavn.localeCompare(b.Rollenavn, "nb")
      ),
    [db.roller, gruppeId]
  );

  const aktiveMedlemmer = useMemo(
    () => medlemmer.filter((gm) => gm.Aktiv),
    [medlemmer]
  );

  const synligePersonIds = useMemo(() => {
    const ids = new Set(aktiveMedlemmer.map((gm) => gm.PersonID));
    if (gruppelederID) ids.add(gruppelederID);
    if (nestlederID) ids.add(nestlederID);
    return ids;
  }, [aktiveMedlemmer, gruppelederID, nestlederID]);

  const visningsliste = useMemo(() => {
    const ids = Array.from(synligePersonIds);
    const sorted = ids
      .map((id) => db.personer.find((p) => p.PersonID === id))
      .filter((p): p is Person => Boolean(p))
      .sort((a, b) => a.Navn.localeCompare(b.Navn, "nb"));

    const rank = (id: string) =>
      id === gruppelederID ? 0 : id === nestlederID ? 1 : 2;
    return sorted.sort((a, b) => rank(a.PersonID) - rank(b.PersonID) || a.Navn.localeCompare(b.Navn, "nb"));
  }, [db.personer, synligePersonIds, gruppelederID, nestlederID]);

  const kandidater = useMemo(() => {
    const q = sok.trim().toLowerCase();
    if (!q) return [];
    return db.personer
      .filter((p) => p.Aktiv && !synligePersonIds.has(p.PersonID))
      .filter(
        (p) =>
          p.Navn.toLowerCase().includes(q) ||
          (p.Epost || "").toLowerCase().includes(q)
      )
      .sort((a, b) => a.Navn.localeCompare(b.Navn, "nb"))
      .slice(0, 8);
  }, [db.personer, sok, synligePersonIds]);

  if (!gruppe) return null;

  const lederskapFor = (personId: string): Lederskap => {
    if (personId === gruppelederID) return "Leder";
    if (personId === nestlederID) return "Nestleder";
    return "Medlem";
  };

  const tjenesterolleFor = (personId: string) => {
    const verdi =
      medlemmer.find((gm) => gm.PersonID === personId && gm.Aktiv)?.Medlemsrolle || "";
    if (!verdi || LEDERSKAP_VERDIER.has(verdi)) return "";
    return verdi;
  };

  const settTjenesterolle = (personId: string, verdi: string) => {
    setMedlemmer((prev) => {
      const existing = prev.find((gm) => gm.PersonID === personId);
      if (existing) {
        return prev.map((gm) =>
          gm.PersonID === personId ? { ...gm, Medlemsrolle: verdi, Aktiv: true } : gm
        );
      }
      return [
        ...prev,
        {
          GruppeMedlemID: nesteId(prev),
          GruppeID: gruppeId,
          PersonID: personId,
          Medlemsrolle: verdi,
          Aktiv: true,
          FraDato: new Date().toISOString().split("T")[0],
          TilDato: "",
          Notat: "",
          OpprettetDato: new Date().toISOString().split("T")[0],
          SistEndret: new Date().toISOString().split("T")[0],
        },
      ];
    });
  };

  const leggTilPerson = (personId: string) => {
    const now = new Date().toISOString().split("T")[0];
    setMedlemmer((prev) => {
      const existing = prev.find((gm) => gm.PersonID === personId);
      if (existing) {
        return prev.map((gm) =>
          gm.PersonID === personId ? { ...gm, Aktiv: true, SistEndret: now } : gm
        );
      }
      return [
        ...prev,
        {
          GruppeMedlemID: nesteId(prev),
          GruppeID: gruppeId,
          PersonID: personId,
          Medlemsrolle: "",
          Aktiv: true,
          FraDato: now,
          TilDato: "",
          Notat: "",
          OpprettetDato: now,
          SistEndret: now,
        },
      ];
    });
    setSok("");
  };

  const fjernPerson = (personId: string) => {
    setMedlemmer((prev) =>
      prev.map((gm) => (gm.PersonID === personId ? { ...gm, Aktiv: false } : gm))
    );
    if (gruppelederID === personId) setGruppelederID("");
    if (nestlederID === personId) setNestlederID("");
  };

  const settLederskap = (personId: string, rolle: Lederskap) => {
    if (rolle === "Leder") {
      setGruppelederID(personId);
      if (nestlederID === personId) setNestlederID("");
      return;
    }
    if (rolle === "Nestleder") {
      if (gruppelederID === personId) {
        setGruppelederID("");
      }
      setNestlederID(personId);
      return;
    }
    if (gruppelederID === personId) setGruppelederID("");
    if (nestlederID === personId) setNestlederID("");
  };

  const handleLagre = () => {
    const navn = gruppenavn.trim();
    if (!navn) return;
    const now = new Date().toISOString().split("T")[0];
    const medlemsroller = new Map<string, string | undefined>(
      medlemmer.filter((gm) => gm.Aktiv).map((gm) => [gm.PersonID, gm.Medlemsrolle])
    );

    let gruppemedlemmer: Gruppemedlem[] = [
      ...db.gruppemedlemmer.filter((gm) => gm.GruppeID !== gruppeId),
      ...medlemmer.map((gm) => ({ ...gm, SistEndret: now })),
    ];

    if (gruppelederID) {
      gruppemedlemmer = sikreGruppemedlemskap(
        gruppemedlemmer,
        gruppeId,
        gruppelederID,
        medlemsroller.get(gruppelederID)
      );
    }
    if (nestlederID && nestlederID !== gruppelederID) {
      gruppemedlemmer = sikreGruppemedlemskap(
        gruppemedlemmer,
        gruppeId,
        nestlederID,
        medlemsroller.get(nestlederID)
      );
    }

    const updated = synkGruppeledergruppe({
      ...db,
      grupper: db.grupper.map((g) =>
        g.GruppeID === gruppeId
          ? {
              ...g,
              Gruppenavn: navn,
              GruppetypeID: gruppetypeID || g.GruppetypeID,
              Beskrivelse: beskrivelse,
              GruppelederID: gruppelederID || undefined,
              NestlederID:
                nestlederID && nestlederID !== gruppelederID ? nestlederID : undefined,
              SistEndret: now,
            }
          : g
      ),
      gruppemedlemmer,
    });

    saveDatabase(updated);
    onUpdateDb(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 mb-5">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#2d5a3f]">
              Gruppe
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              Administrer {gruppenavn.trim() || gruppe.Gruppenavn}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {erGruppeledergruppe(db, gruppe) && (
          <p className="mb-4 text-xs text-slate-600 bg-[#eef5f1] border border-[#d2e8d9] rounded-xl px-3 py-2">
            Ledere og nestledere fra tjenestegrupper, husgrupper og barnekirke oppdateres automatisk. Manuelle tillegg blir værende.
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Grunninfo
            </h3>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Gruppenavn
              </label>
              <input
                type="text"
                value={gruppenavn}
                onChange={(e) => setGruppenavn(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Kategori
              </label>
              <select
                value={gruppetypeID}
                onChange={(e) => setGruppetypeID(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
              >
                {db.gruppetyper
                  .filter((gt) => gt.Aktiv)
                  .map((gt) => (
                    <option key={gt.GruppetypeID} value={gt.GruppetypeID}>
                      {gt.Navn}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Beskrivelse
              </label>
              <textarea
                value={beskrivelse}
                onChange={(e) => setBeskrivelse(e.target.value)}
                rows={4}
                className="w-full text-sm border border-slate-300 rounded-xl p-2.5 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f] resize-y min-h-[96px]"
              />
            </div>

          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Medlemmer
              </h3>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                {visningsliste.length} totalt
              </span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Søk og legg til person…"
                value={sok}
                onChange={(e) => setSok(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
              />
              {sok.trim() && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  {kandidater.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-slate-500">Ingen treff</div>
                  ) : (
                    kandidater.map((p) => (
                      <button
                        key={p.PersonID}
                        type="button"
                        onClick={() => leggTilPerson(p.PersonID)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                      >
                        <PersonAvatar person={p} size="sm" />
                        <span className="font-medium text-slate-900">{p.Navn}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-0.5">
              {visningsliste.length === 0 && (
                <p className="text-xs text-slate-400 italic py-4 text-center">
                  Ingen medlemmer ennå.
                </p>
              )}
              {visningsliste.map((person) => {
                const rolle = lederskapFor(person.PersonID);
                const erLeder = rolle === "Leder";
                const erNestleder = rolle === "Nestleder";
                const tjenesterolle = tjenesterolleFor(person.PersonID);
                const rollevalg = Array.from(
                  new Set(
                    [
                      ...GRUNN_TJENESTEROLLER,
                      ...gruppeRoller.map((r) => r.Rollenavn),
                      tjenesterolle,
                    ].filter((navn) => navn && !LEDERSKAP_VERDIER.has(navn))
                  )
                );

                return (
                  <div
                    key={person.PersonID}
                    className={`p-3 rounded-xl border bg-white ${
                      erLeder
                        ? "border-amber-400"
                        : erNestleder
                          ? "border-sky-400"
                          : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <PersonAvatar person={person} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-slate-900 truncate">
                              {person.Navn}
                            </div>
                          </div>
                          <IkonHandling
                            label="Fjern medlem"
                            Icon={Trash2}
                            variant="decline"
                            onClick={() => fjernPerson(person.PersonID)}
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {erLeder && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                              <Star className="w-3 h-3 text-amber-500 fill-amber-400" />
                              Gruppeleder
                            </span>
                          )}
                          {erNestleder && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-full">
                              <Star className="w-3 h-3 text-sky-500 fill-sky-500" />
                              Nestleder
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <label className="block min-w-0">
                            <span className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Tjenesterolle
                            </span>
                            <select
                              value={tjenesterolle}
                              onChange={(e) => settTjenesterolle(person.PersonID, e.target.value)}
                              className="w-full text-[11px] border border-slate-200 rounded-lg p-1.5 bg-slate-50"
                            >
                              <option value="">Velg tjenesterolle</option>
                              {rollevalg.map((navn) => (
                                <option key={navn} value={navn}>
                                  {navn}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block min-w-0">
                            <span className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Medlemsrolle
                            </span>
                            <select
                              value={rolle}
                              onChange={(e) =>
                                settLederskap(person.PersonID, e.target.value as Lederskap)
                              }
                              className="w-full text-[11px] border border-slate-200 rounded-lg p-1.5 bg-slate-50"
                            >
                              <option value="Medlem">Medlem</option>
                              <option value="Leder">Leder</option>
                              <option value="Nestleder">Nestleder</option>
                            </select>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Avbryt
          </button>
          <button
            type="button"
            disabled={!gruppenavn.trim()}
            onClick={handleLagre}
            className="px-4 py-2 text-xs bg-[#2d5a3f] hover:bg-[#234731] disabled:opacity-50 text-white font-semibold rounded-xl shadow-xs transition cursor-pointer"
          >
            Lagre
          </button>
        </div>
      </div>
    </div>
  );
};
