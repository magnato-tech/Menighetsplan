import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  loadDatabase,
  loadLocalDatabase,
  resetDatabase,
  DatabaseState,
  hentTilgang,
  visningErTillatt,
  startvisningForTilgang,
  AppView,
  finnPersonMedMagiskToken,
  finnAdministratorMedEpost,
  finnAdministratorMedPersonId,
  finnPersonForGoogleSesjon,
  sikreMagnarGoogleAdminIMinne,
  hentSisteLastetPersonId,
  switchDevDataSource,
  getDevDataSource,
  setDevDataSource,
  erDemoVersjon,
  SKARP_APP_URL,
  erMedITjenestegruppe,
  standardLederSeksjon,
  REMOTE_SAVE_FEIL_EVENT,
  harPaagaaendeRemoteSave,
  type DevDataSource,
  finnPersonFraDemoParam,
  tolkVisningFraUrl,
} from "./services/dataService";
import {
  epostFraGoogleJwt,
  hentAdminSesjonEpost,
  hentAdminSesjonPersonId,
  hentAdminGoogleCredential,
  lagreAdminSesjon,
  slettAdminSesjon,
  tolkInnlimtLenke,
  lesMagiskTokenFraUrl,
  lagreMagiskToken,
  hentMagiskToken,
  erMagiskLenkeToken,
  harApiIdentitet,
  slettMagiskToken,
} from "./services/innlogging";
import { Header } from "./components/Header";
import { Startside } from "./components/Startside";
import { PersonalView } from "./components/PersonalView";
import { GroupLeaderView } from "./components/GroupLeaderView";
import { AdminView } from "./components/AdminView";
import { MobilBunnmeny, type LederSeksjon, type LederNavTilstand } from "./components/MobilBunnmeny";
import { Shield, ArrowLeft, Users } from "lucide-react";

export default function App() {
  const [dataSource, setDataSource] = useState<DevDataSource>(() => getDevDataSource());
  const remoteByConfig = dataSource === "remote";
  const [db, setDb] = useState<DatabaseState | null>(() =>
    remoteByConfig ? null : loadLocalDatabase()
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingRemote, setIsLoadingRemote] = useState<boolean>(() => {
    const remote = getDevDataSource() === "remote";
    return remote && (Boolean(lesMagiskTokenFraUrl()) || Boolean(hentAdminGoogleCredential()));
  });
  const [activeView, setActiveView] = useState<AppView>("personal");
  const [selectedPersonId, setSelectedPersonId] = useState<string>("P001");
  const [lederSeksjon, setLederSeksjon] = useState<LederSeksjon>("hjem");
  const [lederNavTilstand, setLederNavTilstand] = useState<LederNavTilstand>({
    visMedlemmer: false,
    visBemanning: false,
    visSamlinger: false,
    visKalender: false,
    visHjem: false,
    primarSeksjon: "hjem",
  });
  const [fokusMedlemmerNokkel, setFokusMedlemmerNokkel] = useState(0);
  const [visOppgaverArk, setVisOppgaverArk] = useState(false);
  const [isMagicLinkUser, setIsMagicLinkUser] = useState<boolean>(false);
  const [adminSimulatingPersonId, setAdminSimulatingPersonId] = useState<string | null>(null);
  const [leaderViewAsObserverId, setLeaderViewAsObserverId] = useState<string | null>(null);

  const handleLederNavTilstand = useCallback((tilstand: LederNavTilstand) => {
    setLederNavTilstand(tilstand);
  }, []);

  useEffect(() => {
    if (activeView !== "leader") return;
    const fallback = lederNavTilstand.primarSeksjon;
    if (lederSeksjon === "medlemmer" && !lederNavTilstand.visMedlemmer) {
      setLederSeksjon(fallback);
    } else if (lederSeksjon === "bemanning" && !lederNavTilstand.visBemanning) {
      setLederSeksjon(fallback);
    } else if (lederSeksjon === "samlinger" && !lederNavTilstand.visSamlinger) {
      setLederSeksjon(fallback);
    } else if (lederSeksjon === "kalender" && !lederNavTilstand.visKalender) {
      setLederSeksjon(fallback);
    } else if (lederSeksjon === "hjem" && !lederNavTilstand.visHjem) {
      setLederSeksjon(fallback);
    }
  }, [activeView, lederSeksjon, lederNavTilstand]);

  const harValgtStartvisning = useRef(false);
  const [viserStartside, setViserStartside] = useState(() => {
    const remote = getDevDataSource() === "remote";
    if (!remote) return false;
    return !lesMagiskTokenFraUrl() && !hentAdminGoogleCredential();
  });
  const [startFeil, setStartFeil] = useState<string | null>(null);
  const [innloggetViaGoogle, setInnloggetViaGoogle] = useState(false);
  const [remoteSaveFeil, setRemoteSaveFeil] = useState<string | null>(null);

  const fetchRemote = useCallback(() => {
    let cancelled = false;
    setIsLoadingRemote(true);
    setLoadError(null);
    loadDatabase()
      .then((loaded) => {
        if (!cancelled) {
          setDb(loaded);
          setLoadError(null);
          setIsLoadingRemote(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          const melding = e instanceof Error ? e.message : String(e);
          if (/google/i.test(melding)) {
            slettAdminSesjon();
          }
          setLoadError(melding);
          setStartFeil(melding);
          setViserStartside(true);
          setIsLoadingRemote(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onFeil = (e: Event) => {
      const melding = (e as CustomEvent<string>).detail;
      setRemoteSaveFeil(melding || "Kunne ikke lagre til Google Sheets.");
    };
    window.addEventListener(REMOTE_SAVE_FEIL_EVENT, onFeil);
    return () => window.removeEventListener(REMOTE_SAVE_FEIL_EVENT, onFeil);
  }, []);

  useEffect(() => {
    const advar = (e: BeforeUnloadEvent) => {
      if (!harPaagaaendeRemoteSave()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", advar);
    return () => window.removeEventListener("beforeunload", advar);
  }, []);

  useEffect(() => {
    if (!remoteByConfig) return;
    const token = lesMagiskTokenFraUrl();
    if (token) lagreMagiskToken(token);
    if (!harApiIdentitet()) {
      setIsLoadingRemote(false);
      setStartFeil(null);
      setViserStartside(true);
      return;
    }
    return fetchRemote();
  }, [remoteByConfig, fetchRemote]);

  const handleRetryRemote = () => {
    setDb(null);
    fetchRemote();
  };

  const handleUseMockFallback = () => {
    void switchDevDataSource("mock").then((mock) => {
      setDataSource("mock");
      setLoadError(null);
      setIsLoadingRemote(false);
      setDb(mock);
    });
  };

  const handleSwitchDataSource = (source: DevDataSource) => {
    if (source === "remote" && !harApiIdentitet()) {
      setDevDataSource("remote");
      setDataSource("remote");
      setDb(null);
      setIsLoadingRemote(false);
      setLoadError(null);
      setStartFeil(
        "Ekte data krever din personlige admin-lenke. Lim den inn under, eller åpne lenken du har fått."
      );
      setViserStartside(true);
      harValgtStartvisning.current = true;
      return;
    }
    if (source === "remote") {
      setDb(null);
      setIsLoadingRemote(true);
      setLoadError(null);
    }
    void switchDevDataSource(source)
      .then((loaded) => {
        setDataSource(source);
        setDb(loaded);
        setLoadError(null);
        setIsLoadingRemote(false);
      })
      .catch((e) => {
        setDataSource(source);
        setLoadError(e instanceof Error ? e.message : String(e));
        setIsLoadingRemote(false);
        if (source === "remote") setDb(null);
      });
  };

  // Personlig lenke → Min side. Google-sesjon → admin. Produksjon uten lenke → startside.
  useEffect(() => {
    if (!db) return;
    if (harValgtStartvisning.current) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const tvingStartside = params.get("startside") === "1";
      const raattToken = (params.get("t") || params.get("token") || "").trim();
      const tokenParam = erMagiskLenkeToken(raattToken) ? raattToken : hentMagiskToken();

      const velgStartvisning = (personId: string, viewOverride?: AppView | null) => {
        const tilgang = hentTilgang(db, personId);
        const view =
          viewOverride && visningErTillatt(tilgang, viewOverride)
            ? viewOverride
            : startvisningForTilgang(tilgang);
        setActiveView(view);
        if (view === "leader") {
          setLederSeksjon(standardLederSeksjon(db, personId));
        }
      };

      if (erDemoVersjon()) {
        const demoPerson = finnPersonFraDemoParam(db, params.get("demo"));
        if (demoPerson) {
          const viewOverride = tolkVisningFraUrl(params.get("view"), db, demoPerson.PersonID);
          setSelectedPersonId(demoPerson.PersonID);
          setIsMagicLinkUser(true);
          setInnloggetViaGoogle(false);
          velgStartvisning(demoPerson.PersonID, viewOverride);
          setViserStartside(false);
          harValgtStartvisning.current = true;
          return;
        }
        const demoRaw = params.get("demo")?.trim();
        if (demoRaw) {
          setStartFeil(`Ukjent testperson «${demoRaw}» i demo.`);
          setViserStartside(true);
          harValgtStartvisning.current = true;
          return;
        }
      }

      if (raattToken && !erMagiskLenkeToken(raattToken)) {
        slettMagiskToken();
        if ((import.meta.env.PROD && !erDemoVersjon()) || tvingStartside) {
          setStartFeil("Lenken er ugyldig. Lim inn en ny, eller logg inn som administrator.");
          setViserStartside(true);
          harValgtStartvisning.current = true;
          return;
        }
      } else if (tokenParam) {
        const found = finnPersonMedMagiskToken(db, tokenParam);
        if (found) {
          const viewOverride = tolkVisningFraUrl(params.get("view"), db, found.PersonID);
          setSelectedPersonId(found.PersonID);
          setIsMagicLinkUser(true);
          setInnloggetViaGoogle(false);
          velgStartvisning(found.PersonID, viewOverride);
          setViserStartside(false);
          harValgtStartvisning.current = true;
          return;
        }
        slettMagiskToken();
        if (erDemoVersjon() && raattToken) {
          setStartFeil("Testlenken er utløpt eller ugyldig. Be admin om en ny demo-lenke.");
          setViserStartside(true);
          harValgtStartvisning.current = true;
          return;
        }
        if (!hentAdminGoogleCredential() && ((import.meta.env.PROD && !erDemoVersjon()) || tvingStartside)) {
          setStartFeil("Lenken er ugyldig. Lim inn en ny, eller logg inn som administrator.");
          setViserStartside(true);
          harValgtStartvisning.current = true;
          return;
        }
      }

      const sesjonEpost = hentAdminSesjonEpost();
      if (sesjonEpost && hentAdminGoogleCredential()) {
        const personId =
          hentAdminSesjonPersonId() || hentSisteLastetPersonId() || "";
        const treff =
          finnPersonForGoogleSesjon(db, sesjonEpost, personId) ||
          finnAdministratorMedEpost(db, sesjonEpost) ||
          finnAdministratorMedPersonId(db, personId);
        const sikret = treff
          ? { db, person: treff }
          : sikreMagnarGoogleAdminIMinne(db, sesjonEpost);
        if (sikret.person) {
          if (sikret.db !== db) setDb(sikret.db);
          setSelectedPersonId(sikret.person.PersonID);
          setIsMagicLinkUser(false);
          setInnloggetViaGoogle(true);
          const startView = startvisningForTilgang(
            hentTilgang(sikret.db, sikret.person.PersonID)
          );
          setActiveView(startView);
          if (startView === "leader") {
            setLederSeksjon(standardLederSeksjon(sikret.db, sikret.person.PersonID));
          }
          setViserStartside(false);
          harValgtStartvisning.current = true;
          return;
        }
        setStartFeil(
          "Google-innloggingen er godkjent, men personregisteret i arket er tomt. Prøv igjen, eller åpne Personer i Google Sheets."
        );
        setViserStartside(true);
        harValgtStartvisning.current = true;
        return;
      }

      if ((import.meta.env.DEV || erDemoVersjon()) && !tvingStartside) {
        const forsteAdmin = db.personer.find((p) => hentTilgang(db, p.PersonID).isAdmin);
        if (forsteAdmin) {
          setSelectedPersonId(forsteAdmin.PersonID);
          setIsMagicLinkUser(false);
          velgStartvisning(forsteAdmin.PersonID);
          setViserStartside(false);
          harValgtStartvisning.current = true;
          return;
        }
      }

      setViserStartside(true);
      harValgtStartvisning.current = true;
    } catch (e) {
      console.warn("Kunne ikke lese URL-parametre:", e);
    }
  }, [db]);

  const handleSelectPerson = (personId: string, view?: AppView) => {
    setLeaderViewAsObserverId(null);
    setSelectedPersonId(personId);
    const nesteView = view ?? activeView;
    setLederSeksjon(
      nesteView === "leader" && db ? standardLederSeksjon(db, personId) : "hjem"
    );
    setVisOppgaverArk(false);
    if (view) {
      setActiveView(view);
      return;
    }
    if (!db) return;
    const newTilgang = hentTilgang(db, personId);
    if (!visningErTillatt(newTilgang, activeView)) {
      setActiveView("personal");
    }
  };

  const handleLeaderViewAs = (memberId: string, view: AppView = "personal") => {
    setLeaderViewAsObserverId((prev) => prev ?? selectedPersonId);
    setSelectedPersonId(memberId);
    setLederSeksjon("hjem");
    setVisOppgaverArk(false);
    setActiveView(view);
  };

  const handleReturnFromLeaderView = () => {
    if (!leaderViewAsObserverId || !db) return;
    setSelectedPersonId(leaderViewAsObserverId);
    setLeaderViewAsObserverId(null);
    setLederSeksjon(standardLederSeksjon(db, leaderViewAsObserverId));
    setActiveView("leader");
    setVisOppgaverArk(false);
  };

  const handleAdminSimulatePerson = (personId: string, targetView: AppView = "personal") => {
    setLeaderViewAsObserverId(null);
    setAdminSimulatingPersonId(personId);
    setSelectedPersonId(personId);
    setActiveView(targetView);
  };

  const handleReturnToAdmin = () => {
    if (!db) return;
    const firstAdmin = db.personer.find((p) => hentTilgang(db, p.PersonID).isAdmin);
    if (firstAdmin) {
      setSelectedPersonId(firstAdmin.PersonID);
    }
    setLeaderViewAsObserverId(null);
    setAdminSimulatingPersonId(null);
    setActiveView("admin");
  };

  const handleNavigateView = (view: AppView) => {
    if (!db) return;
    if (!visningErTillatt(hentTilgang(db, selectedPersonId), view)) return;
    if (view !== "personal") {
      setVisOppgaverArk(false);
    }
    if (view === "leader" && db) {
      setLederSeksjon(standardLederSeksjon(db, selectedPersonId));
    }
    setActiveView(view);
  };

  const handleUpdateDb = (updatedDb: DatabaseState) => {
    setDb(updatedDb);
  };

  const handleResetData = () => {
    resetDatabase()
      .then((refreshed) => setDb(refreshed))
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
  };

  const handleFortsettLokalt = () => {
    if (import.meta.env.PROD) return;
    slettMagiskToken();
    slettAdminSesjon();
    setStartFeil(null);
    harValgtStartvisning.current = false;
    window.history.replaceState({}, "", window.location.pathname);
    void switchDevDataSource("mock").then((mock) => {
      setDataSource("mock");
      setLoadError(null);
      setIsLoadingRemote(false);
      setDb(mock);
      setViserStartside(false);
    });
  };

  const handleLimInnLenke = (raw: string) => {
    const neste = tolkInnlimtLenke(raw, window.location.pathname);
    if (!neste) {
      setStartFeil("Kunne ikke lese lenken. Lim inn hele adressen du har fått.");
      return;
    }
    window.location.assign(neste);
  };

  const handleGoogleCredential = (credential: string) => {
    const epost = epostFraGoogleJwt(credential);
    if (!epost) {
      setStartFeil("Google-innlogging ga ingen bekreftet e-postadresse.");
      return;
    }
    lagreAdminSesjon(epost, credential);
    slettMagiskToken();
    setStartFeil(null);
    setViserStartside(false);
    harValgtStartvisning.current = false;
    setDb(null);
    window.history.replaceState({}, "", window.location.pathname);
    fetchRemote();
  };

  const handleLoggUt = () => {
    slettAdminSesjon();
    slettMagiskToken();
    setInnloggetViaGoogle(false);
    setIsMagicLinkUser(false);
    setViserStartside(true);
    setActiveView("personal");
    setStartFeil(null);
    if (remoteByConfig) {
      setDb(null);
    }
    window.history.replaceState({}, "", window.location.pathname);
  };

  if (viserStartside) {
    return (
      <Startside
        feilmelding={startFeil}
        onLimInnLenke={handleLimInnLenke}
        onGoogleCredential={handleGoogleCredential}
        onFortsettLokalt={import.meta.env.DEV ? handleFortsettLokalt : undefined}
      />
    );
  }

  if (!db) {
    return (
      <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-xs text-center space-y-4">
          {loadError ? (
            <>
              <h2 className="text-lg font-bold text-slate-900">Kunne ikke laste data</h2>
              <p className="text-sm text-slate-600">{loadError}</p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  type="button"
                  onClick={handleRetryRemote}
                  className="px-4 py-2 rounded-xl bg-[#2d5a3f] hover:bg-[#234731] text-white text-sm font-semibold cursor-pointer"
                >
                  Prøv igjen
                </button>
                {import.meta.env.DEV && (
                  <button
                    type="button"
                    onClick={handleUseMockFallback}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    Bruk mock-data
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-600">
              {isLoadingRemote ? "Laster data …" : "Laster …"}
            </p>
          )}
        </div>
      </div>
    );
  }

  const activePerson = db.personer.find((p) => p.PersonID === selectedPersonId);
  const tilgang = hentTilgang(db, selectedPersonId);
  const isActualAdmin = tilgang.isAdmin;
  const observerPerson = leaderViewAsObserverId
    ? db.personer.find((p) => p.PersonID === leaderViewAsObserverId)
    : null;

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans flex flex-col selection:bg-indigo-500 selection:text-white">
      {erDemoVersjon() && (
        <div className="bg-amber-100 text-amber-950 px-4 py-2 text-xs font-medium text-center border-b border-amber-200">
          Dette er demoversjonen med fiktive data — ingenting lagres i menighetens database. Ekte
          app:{" "}
          <a className="underline font-semibold" href={SKARP_APP_URL}>
            www.menighetsplan.no
          </a>
        </div>
      )}
      {dataSource === "mock" && import.meta.env.DEV && !erDemoVersjon() && (
        <div className="bg-amber-100 text-amber-950 px-4 py-2 text-xs font-medium text-center border-b border-amber-200">
          Utvikling: mock-data. Leser og skriver ikke til Supabase. Bytt under Administrator →
          Innstillinger.
        </div>
      )}
      {remoteSaveFeil && (
        <div className="bg-rose-100 text-rose-950 px-4 py-2 text-xs font-medium text-center border-b border-rose-200 flex items-center justify-center gap-3">
          <span>Lagring til Google Sheets feilet: {remoteSaveFeil}</span>
          <button
            type="button"
            className="underline font-semibold cursor-pointer"
            onClick={() => setRemoteSaveFeil(null)}
          >
            Skjul
          </button>
        </div>
      )}
      {leaderViewAsObserverId && (
        <div className="bg-sky-500 text-slate-950 px-4 py-2 text-xs font-medium flex items-center justify-between shadow-sm sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-950" />
            <span>
              <strong>Gruppeleder-visning:</strong> Du ser nå skjermen slik den oppleves av{" "}
              <strong>{activePerson?.Navn || selectedPersonId}</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={handleReturnFromLeaderView}
            className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Tilbake til {observerPerson?.Fornavn || "gruppeleder"}
          </button>
        </div>
      )}
      {/* Banner når administrator tester visning som en annen person */}
      {adminSimulatingPersonId && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-medium flex items-center justify-between shadow-sm sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-950" />
            <span>
              <strong>Admin-testmodus:</strong> Du ser nå skjermen slik den oppleves av{" "}
              <strong>{activePerson?.Navn || adminSimulatingPersonId}</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={handleReturnToAdmin}
            className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Tilbake til Administrator
          </button>
        </div>
      )}

      {/* Toppmeny med bytte av visning og person */}
      <Header
        db={db}
        activeView={activeView}
        setActiveView={handleNavigateView}
        selectedPersonId={selectedPersonId}
        setSelectedPersonId={handleSelectPerson}
        onResetData={handleResetData}
        isAdminUser={isActualAdmin && !adminSimulatingPersonId}
        isMagicLinkUser={isMagicLinkUser}
        onLoggUt={innloggetViaGoogle ? handleLoggUt : undefined}
        onMineOppgaver={() => {
          setActiveView("personal");
          setVisOppgaverArk(true);
        }}
      />

      {/* Hovedinnhold basert på valgt modus */}
      <main className="flex-1 pb-28 md:pb-16">
        {activeView === "personal" && (
          <PersonalView
            db={db}
            selectedPersonId={selectedPersonId}
            onUpdateDb={handleUpdateDb}
            visOppgaverArk={visOppgaverArk}
            onOppgaverArkChange={setVisOppgaverArk}
          />
        )}

        {activeView === "leader" && visningErTillatt(hentTilgang(db, selectedPersonId), "leader") && (
          <GroupLeaderView
            db={db}
            selectedPersonId={selectedPersonId}
            onUpdateDb={handleUpdateDb}
            onSelectPerson={handleSelectPerson}
            onViewAsMember={handleLeaderViewAs}
            lederSeksjon={lederSeksjon}
            onLederSeksjon={setLederSeksjon}
            onLederNavTilstand={handleLederNavTilstand}
            fokusMedlemmerNokkel={fokusMedlemmerNokkel}
          />
        )}

        {activeView === "admin" && visningErTillatt(hentTilgang(db, selectedPersonId), "admin") && (
          <AdminView
            db={db}
            onUpdateDb={handleUpdateDb}
            onSelectPerson={handleAdminSimulatePerson}
            selectedPersonId={selectedPersonId}
            onSwitchDataSource={import.meta.env.DEV ? handleSwitchDataSource : undefined}
            dataSource={dataSource}
          />
        )}
      </main>

      {/* Enkel, ren bunntekst */}
      <footer className="hidden md:block bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>Menighetsplan</strong> &bull; Lillesand Misjonskirke
          </div>
          <div className="text-slate-400">
            Personlig lenke for frivillige. Administrator logger inn med Google.
          </div>
        </div>
      </footer>
      {(erMedITjenestegruppe(db, selectedPersonId) ||
        hentTilgang(db, selectedPersonId).views.includes("leader")) && (
        <MobilBunnmeny
          db={db}
          personId={selectedPersonId}
          activeView={activeView}
          lederSeksjon={lederSeksjon}
          lederNavTilstand={lederNavTilstand}
          onNavigate={handleNavigateView}
          onFokusHjem={() => {
            if (!visningErTillatt(hentTilgang(db, selectedPersonId), "leader")) return;
            setActiveView("leader");
            setLederSeksjon(lederNavTilstand.visHjem ? "hjem" : lederNavTilstand.primarSeksjon);
          }}
          onFokusMedlemmer={() => {
            if (!visningErTillatt(hentTilgang(db, selectedPersonId), "leader")) return;
            setActiveView("leader");
            setLederSeksjon("medlemmer");
            setFokusMedlemmerNokkel((n) => n + 1);
          }}
          onFokusSamlinger={() => {
            if (!visningErTillatt(hentTilgang(db, selectedPersonId), "leader")) return;
            setActiveView("leader");
            setLederSeksjon("samlinger");
          }}
          onFokusBemanning={() => {
            if (!visningErTillatt(hentTilgang(db, selectedPersonId), "leader")) return;
            setActiveView("leader");
            setLederSeksjon("bemanning");
          }}
          onFokusKalender={() => {
            if (!visningErTillatt(hentTilgang(db, selectedPersonId), "leader")) return;
            setActiveView("leader");
            setLederSeksjon("kalender");
          }}
        />
      )}
    </div>
  );
}

