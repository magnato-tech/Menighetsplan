import React, { useEffect, useState } from "react";
import {
  DatabaseState,
  UkjentImportSlot,
  finnUkjenteImportnavn,
  finnTjenestegrupperForPerson,
  genererPersonligLenke,
  opprettPersonIRegister,
  oppdaterPersonIRegister,
  saveDatabase,
  hentTilgang,
  tilgangsnivaaForPerson,
} from "../services/dataService";
import { Person } from "../types/database";
import { IkonHandling } from "./IkonHandling";
import {
  Shield,
  Plus,
  Pencil,
  Share2,
  Search,
  Filter,
  Star,
  AlertTriangle,
} from "lucide-react";

interface PersonregisterViewProps {
  db: DatabaseState;
  onUpdateDb: (updatedDb: DatabaseState) => void;
  visTabell: boolean;
  opprettSignal?: { fornavn?: string; slots?: UkjentImportSlot[] } | null;
  onOpprettSignalHandled?: () => void;
}

export const PersonregisterView: React.FC<PersonregisterViewProps> = ({
  db,
  onUpdateDb,
  visTabell,
  opprettSignal = null,
  onOpprettSignalHandled,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState<"all" | "leaders" | "admins" | "members">("all");
  const [copiedPersonId, setCopiedPersonId] = useState<string | null>(null);
  const [newPersonModal, setNewPersonModal] = useState(false);
  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const [editNavn, setEditNavn] = useState("");
  const [editEpost, setEditEpost] = useState("");
  const [editTelefon, setEditTelefon] = useState("");
  const [editAktiv, setEditAktiv] = useState(true);
  const [editTilgangsnivaa, setEditTilgangsnivaa] = useState<
    NonNullable<Person["Tilgangsnivå"]>
  >("bruker");
  const [newFornavn, setNewFornavn] = useState("");
  const [newPersonSlots, setNewPersonSlots] = useState<UkjentImportSlot[]>([]);
  const [newPersonGudstjenesteId, setNewPersonGudstjenesteId] = useState("");
  const [newPersonRolleId, setNewPersonRolleId] = useState("");

  const ukjenteImportnavn = finnUkjenteImportnavn(db);

  const openNewPersonModal = (prefill?: { fornavn?: string; slots?: UkjentImportSlot[] }) => {
    setNewFornavn(prefill?.fornavn || "");
    setNewPersonSlots(prefill?.slots || []);
    setNewPersonGudstjenesteId(prefill?.slots?.[0]?.gudstjenesteId || "");
    setNewPersonRolleId(prefill?.slots?.[0]?.rolleId || "");
    setNewPersonModal(true);
  };

  useEffect(() => {
    if (!opprettSignal) return;
    openNewPersonModal(opprettSignal);
    onOpprettSignalHandled?.();
  }, [opprettSignal]);

  const handleCopyLink = (personId: string) => {
    const link = genererPersonligLenke(personId, db);
    navigator.clipboard.writeText(link).then(() => {
      setCopiedPersonId(personId);
      setTimeout(() => setCopiedPersonId(null), 2500);
    });
  };

  const handleSaveNewPerson = () => {
    const fornavn = newFornavn.trim();
    if (!fornavn) return;

    let slots = newPersonSlots;
    if (slots.length === 0 && newPersonGudstjenesteId && newPersonRolleId) {
      const rolle = db.roller.find((r) => r.RolleID === newPersonRolleId);
      const gud = db.gudstjenester.find((g) => g.GudstjenesteID === newPersonGudstjenesteId);
      slots = [
        {
          gudstjenesteId: newPersonGudstjenesteId,
          rolleId: newPersonRolleId,
          rolleNavn: rolle?.Rollenavn || "",
          dato: gud?.Dato || "",
        },
      ];
    }

    const updatedDb = opprettPersonIRegister(db, { Navn: fornavn }, slots);
    saveDatabase(updatedDb);
    onUpdateDb(updatedDb);
    setNewPersonModal(false);
    setNewFornavn("");
    setNewPersonSlots([]);
    setNewPersonGudstjenesteId("");
    setNewPersonRolleId("");
  };

  const openEditPerson = (person: Person) => {
    setEditPerson(person);
    setEditNavn(person.Navn || "");
    setEditEpost(person.Epost || "");
    setEditTelefon(person.Telefon || "");
    setEditAktiv(person.Aktiv !== false);
    setEditTilgangsnivaa(tilgangsnivaaForPerson(db, person.PersonID));
  };

  const handleSaveEditPerson = () => {
    if (!editPerson || !editNavn.trim()) return;
    const updatedDb = oppdaterPersonIRegister(db, editPerson.PersonID, {
      Navn: editNavn.trim(),
      Epost: editEpost,
      Telefon: editTelefon,
      Aktiv: editAktiv,
      Tilgangsnivå: editTilgangsnivaa,
    });
    saveDatabase(updatedDb);
    onUpdateDb(updatedDb);
    setEditPerson(null);
  };

  const filteredPersoner = db.personer.filter((p) => {
    const matchesSearch =
      p.Navn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.Epost || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.PersonID.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedGroupFilter !== "all") {
      const tilknyttet = finnTjenestegrupperForPerson(db, p.PersonID).some(
        (t) => t.gruppe.GruppeID === selectedGroupFilter
      );
      if (!tilknyttet) return false;
    }

    if (roleFilter !== "all") {
      const tilgang = hentTilgang(db, p.PersonID);
      if (roleFilter === "leaders" && !tilgang.isLeader) return false;
      if (roleFilter === "admins" && !tilgang.isAdmin) return false;
      if (roleFilter === "members" && (tilgang.isLeader || tilgang.isAdmin)) return false;
    }

    return true;
  });

  return (
    <>
      {ukjenteImportnavn.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-950">
                Ukjente navn i oppgavefordelingen
              </p>
              <p className="text-xs text-amber-800 mt-0.5">
                Disse står i importen, men ikke i personregisteret. Etternavn tas med hvis det står i tabellen. Opprett og tildel herfra — uten å redigere arket.
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {ukjenteImportnavn.map((item) => (
              <li
                key={item.navn}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white/70 rounded-xl px-3 py-2 border border-amber-100"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900">{item.navn}</div>
                  <div className="text-xs text-slate-600">
                    {item.slots
                      .map((s) => (s.dato ? `${s.rolleNavn} · ${s.dato}` : s.rolleNavn))
                      .join(" · ")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openNewPersonModal({ fornavn: item.navn, slots: item.slots })}
                  className="px-3 py-1.5 bg-[#2d5a3f] hover:bg-[#234731] text-white text-xs font-semibold rounded-lg cursor-pointer self-start"
                >
                  Opprett person
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {visTabell && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-slate-900">
              {filteredPersoner.length} personer
            </h3>

            <button
              onClick={() => openNewPersonModal()}
              className="px-3.5 py-2 bg-[#2d5a3f] hover:bg-[#234731] text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Ny person</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3.5 rounded-2xl border border-slate-200">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Søk på navn eller e-post..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedGroupFilter}
                onChange={(e) => setSelectedGroupFilter(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl p-2 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
              >
                <option value="all">Alle grupper</option>
                {db.grupper.map((g) => (
                  <option key={g.GruppeID} value={g.GruppeID}>
                    {g.Gruppenavn}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
                className="w-full text-xs border border-slate-200 rounded-xl p-2 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
              >
                <option value="all">Alle tilganger / roller</option>
                <option value="leaders">Kun tjenestegruppeledere</option>
                <option value="admins">Kun administratorer</option>
                <option value="members">Kun ordinære medlemmer</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Navn</th>
                  <th className="p-3">Kontaktinfo</th>
                  <th className="p-3">Tilgangsnivå</th>
                  <th className="p-3">Personroller (Godkjente)</th>
                  <th className="p-3">Gruppe</th>
                  <th className="p-3 text-right">Handling</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredPersoner.map((person) => {
                  const personTilgang = hentTilgang(db, person.PersonID);
                  const isCopied = copiedPersonId === person.PersonID;

                  const personensRolleIds = db.personroller
                    .filter((pr) => pr.PersonID === person.PersonID && pr.Aktiv)
                    .map((pr) => pr.RolleID);
                  const personensRoller = db.roller.filter((r) =>
                    personensRolleIds.includes(r.RolleID)
                  );

                  const personensGrupper = finnTjenestegrupperForPerson(db, person.PersonID);
                  const lederGrupper = personensGrupper.filter(
                    (t) => t.tilknytning === "Leder" || t.tilknytning === "Nestleder"
                  );

                  return (
                    <tr key={person.PersonID} className="hover:bg-slate-50/70 transition">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{person.Navn}</div>
                        {person.Notat && (
                          <div className="text-[11px] text-slate-400 italic">
                            {person.Notat}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div>{person.Epost}</div>
                        <div className="text-slate-400">{person.Telefon}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-1 items-start">
                          {personTilgang.isAdmin && (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-200">
                              <Shield className="w-3 h-3" />
                              Admin
                            </span>
                          )}
                          {personTilgang.isLeader && !personTilgang.isAdmin && (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-200">
                              <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                              Gruppeleder
                              {lederGrupper.length > 0 &&
                                ` (${lederGrupper.map((g) => g.gruppe.Gruppenavn).join(", ")})`}
                            </span>
                          )}
                          {!personTilgang.isAdmin && !personTilgang.isLeader && (
                            <span className="inline-flex items-center text-slate-500 text-[11px]">
                              Bruker
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {personensRoller.map((r) => (
                            <span
                              key={r.RolleID}
                              className="bg-[#eef5f1] text-[#2d5a3f] text-[10px] font-medium px-1.5 py-0.5 rounded border border-[#d2e8d9]"
                            >
                              {r.Rollenavn}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {personensGrupper.map((t) => (
                            <span
                              key={t.gruppe.GruppeID}
                              className="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.5 rounded"
                            >
                              {t.gruppe.Gruppenavn}
                              {t.tilknytning !== "Medlem" ? ` (${t.tilknytning})` : ""}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <IkonHandling
                            label="Rediger person"
                            Icon={Pencil}
                            onClick={() => openEditPerson(person)}
                          />
                          <IkonHandling
                            label="Kopier personlenke"
                            Icon={Share2}
                            copied={isCopied}
                            onClick={() => handleCopyLink(person.PersonID)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {newPersonModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Legg til person</h3>
            <p className="text-xs text-slate-500 mb-4">
              Fornavn er nok. Etternavn tas med hvis det står i tabellen eller skrives inn.
            </p>

            <div className="space-y-3 mb-6 text-xs">
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Navn</label>
                <input
                  type="text"
                  placeholder="F.eks. Magnar eller Pål Brenne"
                  value={newFornavn}
                  onChange={(e) => setNewFornavn(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2 bg-slate-50"
                />
              </div>

              {newPersonSlots.length > 0 ? (
                <div className="bg-[#eef5f1] border border-[#d2e8d9] rounded-xl p-3 text-slate-800">
                  <div className="font-semibold mb-1">Tjeneste som tildeles</div>
                  {newPersonSlots.map((s) => (
                    <div key={`${s.gudstjenesteId}-${s.rolleId}`}>
                      {s.rolleNavn}
                      {s.dato ? ` · ${s.dato}` : ""}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">
                      Gudstjeneste (valgfritt)
                    </label>
                    <select
                      value={newPersonGudstjenesteId}
                      onChange={(e) => setNewPersonGudstjenesteId(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl p-2 bg-slate-50"
                    >
                      <option value="">Ingen tildeling nå</option>
                      {db.gudstjenester.map((g) => (
                        <option key={g.GudstjenesteID} value={g.GudstjenesteID}>
                          {g.Dato} · {g.Tema}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600 block mb-1">
                      Tjeneste / rolle (valgfritt)
                    </label>
                    <select
                      value={newPersonRolleId}
                      onChange={(e) => setNewPersonRolleId(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl p-2 bg-slate-50"
                    >
                      <option value="">Velg rolle</option>
                      {db.roller
                        .filter((r) => r.Aktiv)
                        .map((r) => (
                          <option key={r.RolleID} value={r.RolleID}>
                            {r.Rollenavn}
                          </option>
                        ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewPersonModal(false)}
                className="px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Avbryt
              </button>
              <button
                type="button"
                disabled={!newFornavn.trim()}
                onClick={handleSaveNewPerson}
                className="px-4 py-2 text-xs bg-[#2d5a3f] hover:bg-[#234731] disabled:opacity-50 text-white font-semibold rounded-xl shadow-xs transition cursor-pointer"
              >
                Lagre person
              </button>
            </div>
          </div>
        </div>
      )}

      {editPerson && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Rediger person</h3>
            <p className="text-xs text-slate-500 mb-4">
              E-post brukes til Google-innlogging for administratorer.
            </p>
            <div className="space-y-3 mb-6 text-xs">
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Navn</label>
                <input
                  type="text"
                  value={editNavn}
                  onChange={(e) => setEditNavn(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2 bg-slate-50"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">E-post</label>
                <input
                  type="email"
                  value={editEpost}
                  onChange={(e) => setEditEpost(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2 bg-slate-50"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Telefon</label>
                <input
                  type="tel"
                  value={editTelefon}
                  onChange={(e) => setEditTelefon(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2 bg-slate-50"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Tilgangsnivå</label>
                <select
                  value={editTilgangsnivaa}
                  onChange={(e) =>
                    setEditTilgangsnivaa(
                      e.target.value as NonNullable<Person["Tilgangsnivå"]>
                    )
                  }
                  className="w-full border border-slate-300 rounded-xl p-2 bg-slate-50"
                >
                  <option value="bruker">Bruker</option>
                  <option value="gruppeleder">Gruppeleder</option>
                  <option value="admin">Admin</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Styrer fanene i appen. Tjenesteroller (taler, lyd, …) settes under Personroller.
                </p>
              </div>
              <label className="flex items-center gap-2 font-semibold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editAktiv}
                  onChange={(e) => setEditAktiv(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Aktiv
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditPerson(null)}
                className="px-4 py-2 text-xs text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Avbryt
              </button>
              <button
                type="button"
                disabled={!editNavn.trim()}
                onClick={handleSaveEditPerson}
                className="px-4 py-2 text-xs bg-[#2d5a3f] hover:bg-[#234731] disabled:opacity-50 text-white font-semibold rounded-xl shadow-xs transition cursor-pointer"
              >
                Lagre
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
