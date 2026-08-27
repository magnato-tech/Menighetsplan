import React, { useEffect, useRef, useState } from "react";
import { Church, Link2 } from "lucide-react";
import { TemaBryter } from "./TemaBryter";
import { useTema } from "../services/tema";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string>
          ) => void;
          cancel: () => void;
        };
      };
    };
  }
}

interface StartsideProps {
  feilmelding: string | null;
  onLimInnLenke: (raw: string) => void;
  onGoogleCredential: (credential: string) => void;
  onFortsettLokalt?: () => void;
}

export const Startside: React.FC<StartsideProps> = ({
  feilmelding,
  onLimInnLenke,
  onGoogleCredential,
  onFortsettLokalt,
}) => {
  const [lenke, setLenke] = useState("");
  const [lenkeFeil, setLenkeFeil] = useState<string | null>(null);
  const googleKnappRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onGoogleCredential);
  callbackRef.current = onGoogleCredential;
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
  const { erMork } = useTema();

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (cancelled || !window.google?.accounts?.id || !googleKnappRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => callbackRef.current(response.credential),
      });
      googleKnappRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleKnappRef.current, {
        theme: erMork ? "filled_black" : "outline",
        size: "large",
        text: "signin_with",
        locale: "no",
        width: "320",
      });
    };
    document.body.appendChild(script);
    return () => {
      cancelled = true;
      window.google?.accounts?.id?.cancel();
      script.remove();
    };
  }, [clientId, erMork]);

  const handleSubmitLenke = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lenke.trim()) {
      setLenkeFeil("Lim inn lenken du har fått, eller åpne den direkte fra SMS/e-post.");
      return;
    }
    setLenkeFeil(null);
    onLimInnLenke(lenke);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans flex flex-col">
      <div className="flex justify-end p-4">
        <TemaBryter />
      </div>
      <div className="flex-1 flex items-center justify-center p-6 pt-0">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#eef5f1] border border-[#d2e8d9] text-[#2d5a3f] flex items-center justify-center">
              <Church className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Lillesand Misjonskirke
              </div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Menighetsplan</h1>
            </div>
          </div>

          <p className="text-sm text-slate-600">
            Du trenger din personlige lenke for å se dine oppgaver og for å hente ekte data fra
            arket. Administrator logger inn med Google når det er satt opp.
          </p>

          {feilmelding && (
            <p className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
              {feilmelding}
            </p>
          )}

          <form onSubmit={handleSubmitLenke} className="space-y-2">
            <label htmlFor="personlig-lenke" className="text-xs font-semibold text-slate-700">
              Har du fått en lenke?
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="personlig-lenke"
                  type="text"
                  value={lenke}
                  onChange={(e) => {
                    setLenke(e.target.value);
                    setLenkeFeil(null);
                  }}
                  placeholder="Lim inn lenken her"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#2d5a3f]"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#2d5a3f] hover:bg-[#234731] text-white text-sm font-semibold cursor-pointer"
              >
                Åpne
              </button>
            </div>
            {lenkeFeil && <p className="text-xs text-rose-600">{lenkeFeil}</p>}
          </form>

          <div className="border-t border-slate-100 pt-5 space-y-3">
            <p className="text-xs font-semibold text-slate-700">Administrator</p>
            {clientId ? (
              <div ref={googleKnappRef} className="flex justify-center min-h-10" />
            ) : (
              <p className="text-xs text-slate-500">
                Google-innlogging mangler klient-ID i denne byggen. En personlenke virker bare
                hvis den ligger i Google-arket (ikke en lenke kopiert fra mock-data). For å komme
                inn her og nå: bruk knappen under.
              </p>
            )}
            {onFortsettLokalt && (
              <button
                type="button"
                onClick={onFortsettLokalt}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-sm font-semibold cursor-pointer"
              >
                Tilbake til mock-data (uten Google-ark)
              </button>
            )}
          </div>
        </div>
      </div>
      <footer className="py-4 text-center text-xs text-slate-500">
        Personlig lenke kreves for frivillige. Administrator bruker Google-konto.
      </footer>
    </div>
  );
};
