import React, { createContext, useContext, useMemo, useState } from "react";

export const TEMA_LAGRING_KEY = "gudstjenesteplanlegger_tema";

export type Tema = "lyst" | "mork";

export function lesLagretTema(): Tema {
  try {
    return localStorage.getItem(TEMA_LAGRING_KEY) === "mork" ? "mork" : "lyst";
  } catch {
    return "lyst";
  }
}

export function anvendTema(tema: Tema): void {
  const rot = document.documentElement;
  rot.classList.toggle("dark", tema === "mork");
  rot.style.colorScheme = tema === "mork" ? "dark" : "light";
  if (typeof document === "undefined") return;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", tema === "mork" ? "#0b1220" : "#ffffff");
}

export function lagreTema(tema: Tema): void {
  try {
    localStorage.setItem(TEMA_LAGRING_KEY, tema);
  } catch {
    // privat modus
  }
  anvendTema(tema);
}

interface TemaContextVerdi {
  tema: Tema;
  erMork: boolean;
  veksleTema: () => void;
}

const TemaContext = createContext<TemaContextVerdi | null>(null);

export const TemaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tema, setTema] = useState<Tema>(() => {
    const lagret = lesLagretTema();
    if (typeof document !== "undefined") anvendTema(lagret);
    return lagret;
  });

  const verdi = useMemo<TemaContextVerdi>(
    () => ({
      tema,
      erMork: tema === "mork",
      veksleTema: () => {
        const neste: Tema = tema === "mork" ? "lyst" : "mork";
        lagreTema(neste);
        setTema(neste);
      },
    }),
    [tema]
  );

  return <TemaContext.Provider value={verdi}>{children}</TemaContext.Provider>;
};

export function useTema(): TemaContextVerdi {
  const ctx = useContext(TemaContext);
  if (!ctx) {
    throw new Error("useTema må brukes innenfor TemaProvider");
  }
  return ctx;
}
