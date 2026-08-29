import React from "react";
import { HeartHandshake, Mail, Phone, Sparkles, UserCircle, Users, X } from "lucide-react";
import { DatabaseState, mineGrupperForPerson, type MinGruppeKontakt, type MinGruppeMedlem } from "../services/dataService";

interface MineGrupperArkProps {
  db: DatabaseState;
  personId: string;
  onLukk: () => void;
}

function tilknytningEtikett(tilknytning: "Leder" | "Nestleder" | "Medlem"): string {
  if (tilknytning === "Leder") return "Gruppeleder";
  if (tilknytning === "Nestleder") return "Nestleder";
  return "Medlem";
}

function tilknytningStil(tilknytning: "Leder" | "Nestleder" | "Medlem"): string {
  if (tilknytning === "Leder") return "bg-[#2d5a3f] text-white";
  if (tilknytning === "Nestleder") return "bg-amber-100 text-amber-900 border border-amber-200";
  return "bg-white/80 text-[#1e3e2b] border border-[#c8dfd0]";
}

const KontaktLinje: React.FC<{ kontakt: MinGruppeKontakt }> = ({ kontakt }) => {
  if (kontakt.erDeg) {
    return (
      <p className="flex items-start gap-2 text-sm text-slate-700 leading-snug">
        <UserCircle className="w-4 h-4 text-[#6b9a7d] mt-0.5 shrink-0" />
        <span>{kontakt.etikett}</span>
      </p>
    );
  }

  if (!kontakt.navn && kontakt.etikett === "Kontakt") {
    return (
      <p className="flex items-start gap-2 text-sm text-slate-600 leading-snug">
        <UserCircle className="w-4 h-4 text-[#6b9a7d] mt-0.5 shrink-0" />
        <span>Ta gjerne kontakt med gruppeleder om du lurer på noe.</span>
      </p>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <UserCircle className="w-4 h-4 text-[#6b9a7d] mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-800 leading-snug">
          <span className="text-slate-500">{kontakt.etikett}:</span>{" "}
          <span className="font-medium">{kontakt.navn}</span>
        </p>
        {(kontakt.telefon || kontakt.epost) && (
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {kontakt.telefon ? (
              <a
                href={`tel:${kontakt.telefon.replace(/\s+/g, "")}`}
                className="inline-flex items-center gap-1 text-xs text-[#2d5a3f] hover:underline"
              >
                <Phone className="w-3 h-3 shrink-0" />
                {kontakt.telefon}
              </a>
            ) : null}
            {kontakt.epost ? (
              <a
                href={`mailto:${kontakt.epost}`}
                className="inline-flex items-center gap-1 text-xs text-[#2d5a3f] hover:underline truncate max-w-full"
              >
                <Mail className="w-3 h-3 shrink-0" />
                {kontakt.epost}
              </a>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

const MedlemLinje: React.FC<{ medlem: MinGruppeMedlem }> = ({ medlem }) => (
  <div className="flex items-start gap-2">
    <UserCircle className="w-4 h-4 text-[#6b9a7d] mt-0.5 shrink-0" />
    <div className="min-w-0 flex-1">
      <p className="text-sm text-slate-800 leading-snug">
        <span className="font-medium">{medlem.navn}</span>
        {medlem.erDeg ? (
          <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-[#2d5a3f] bg-[#eef5f1] border border-[#d2e8d9] px-1.5 py-0.5 rounded-full">
            Deg
          </span>
        ) : null}
        {medlem.rolle === "Leder" ? (
          <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-white bg-[#2d5a3f] px-1.5 py-0.5 rounded-full">
            Leder
          </span>
        ) : null}
        {medlem.rolle === "Nestleder" ? (
          <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full">
            Nestleder
          </span>
        ) : null}
      </p>
      {medlem.oppgaver.length > 0 ? (
        <p className="text-xs text-slate-500 mt-0.5">{medlem.oppgaver.join(", ")}</p>
      ) : null}
      {(medlem.telefon || medlem.epost) && !medlem.erDeg ? (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {medlem.telefon ? (
            <a
              href={`tel:${medlem.telefon.replace(/\s+/g, "")}`}
              className="inline-flex items-center gap-1 text-xs text-[#2d5a3f] hover:underline"
            >
              <Phone className="w-3 h-3 shrink-0" />
              {medlem.telefon}
            </a>
          ) : null}
          {medlem.epost ? (
            <a
              href={`mailto:${medlem.epost}`}
              className="inline-flex items-center gap-1 text-xs text-[#2d5a3f] hover:underline truncate max-w-full"
            >
              <Mail className="w-3 h-3 shrink-0" />
              {medlem.epost}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  </div>
);

export const MineGrupperArk: React.FC<MineGrupperArkProps> = ({ db, personId, onLukk }) => {
  const grupper = mineGrupperForPerson(db, personId);
  const tittel = grupper.length === 1 ? "Min gruppe" : "Mine grupper";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/45 flex justify-center items-end sm:items-center p-0 sm:p-4 animate-fadeIn">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer"
        aria-label="Lukk"
        onClick={onLukk}
      />
      <div className="relative bg-[#fafbf9] w-full h-auto max-h-[90dvh] rounded-t-3xl sm:max-w-lg sm:rounded-3xl shadow-2xl border-0 sm:border sm:border-[#d8e8de] flex flex-col overflow-hidden">
        <div className="relative shrink-0 overflow-hidden border-b border-[#d8e8de]/80">
          <div className="absolute inset-0 bg-linear-to-br from-[#eef5f1] via-[#f4f9f6] to-[#faf6f0]" />
          <div className="relative flex items-start justify-between gap-3 px-5 pt-5 pb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-white/90 border border-[#d2e8d9] shadow-xs">
                  <HeartHandshake className="w-5 h-5 text-[#2d5a3f]" />
                </span>
                <span className="text-base font-bold text-[#1e3e2b]">{tittel}</span>
              </div>
              <p className="text-sm text-[#3d5c4a] leading-relaxed pr-2">
                {grupper.length === 1
                  ? "Du tjener sammen med andre i denne gruppen. Her ser du medlemmene, hvem som leder, og hvilke oppgaver du har valgt."
                  : "Du er med i flere grupper. Her ser du hvem du tjener sammen med, og hvem som leder."}
              </p>
            </div>
            <button
              type="button"
              onClick={onLukk}
              className="p-2 min-h-11 min-w-11 text-slate-500 hover:bg-white/70 rounded-xl cursor-pointer shrink-0"
              aria-label="Lukk"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
          {grupper.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#c8dfd0] bg-white px-5 py-8 text-center">
              <Users className="w-8 h-8 text-[#8fb39a] mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-800">Ingen gruppe ennå</p>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                Når du velger oppgaver under «Tjeneste», dukker gruppen din opp her.
              </p>
            </div>
          ) : (
            grupper.map((kort) => (
              <section
                key={kort.gruppeId}
                className="rounded-2xl border border-[#cfe3d6] bg-white shadow-xs overflow-hidden"
              >
                <div className="px-4 py-3.5 bg-linear-to-r from-[#eef5f1] to-[#f7faf8] border-b border-[#d8e8de]/70">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-white border border-[#d2e8d9] shadow-xs shrink-0">
                        <Users className="w-5 h-5 text-[#2d5a3f]" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-[#1e3e2b]">{kort.gruppenavn}</h3>
                        <span
                          className={`inline-flex mt-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${tilknytningStil(kort.tilknytning)}`}
                        >
                          {tilknytningEtikett(kort.tilknytning)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3.5 space-y-3">
                  <div className="space-y-2.5">
                    {kort.kontakter.map((kontakt, index) => (
                      <KontaktLinje key={`${kort.gruppeId}-${kontakt.etikett}-${index}`} kontakt={kontakt} />
                    ))}
                  </div>

                  <div>
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#5a7d68] mb-2">
                      <Users className="w-3.5 h-3.5" />
                      Med i gruppen
                    </p>
                    {kort.medlemmer.length > 0 ? (
                      <div className="space-y-2.5">
                        {kort.medlemmer.map((medlem) => (
                          <MedlemLinje key={`${kort.gruppeId}-${medlem.personId}`} medlem={medlem} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">Ingen andre medlemmer registrert ennå.</p>
                    )}
                  </div>

                  <div>
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#5a7d68] mb-2">
                      <Sparkles className="w-3.5 h-3.5" />
                      Dine oppgaver
                    </p>
                    {kort.mineOppgaver.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {kort.mineOppgaver.map((oppgave) => (
                          <span
                            key={oppgave}
                            className="inline-flex text-xs font-semibold px-2.5 py-1 rounded-full bg-[#eef5f1] text-[#1e3e2b] border border-[#d2e8d9]"
                          >
                            {oppgave}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">
                        Du har ikke valgt oppgaver i denne gruppen ennå.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            ))
          )}
        </div>

        <div className="px-4 py-3 border-t border-[#d8e8de]/80 bg-white/80 sheet-safe-bottom">
          <button
            type="button"
            onClick={onLukk}
            className="min-h-11 w-full sm:w-auto px-5 text-sm font-semibold text-white bg-[#2d5a3f] hover:bg-[#234731] rounded-xl cursor-pointer shadow-xs"
          >
            Lukk
          </button>
        </div>
      </div>
    </div>
  );
};
