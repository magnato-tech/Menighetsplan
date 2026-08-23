const ADMIN_SESJON_KEY = "gudstjenesteplanlegger_admin_sesjon";

export function epostFraGoogleJwt(credential: string): string | null {
  const deler = String(credential || "").split(".");
  if (deler.length < 2) return null;
  try {
    const b64 = deler[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded)) as {
      email?: string;
      email_verified?: boolean;
    };
    if (payload.email_verified === false) return null;
    const epost = String(payload.email || "").trim().toLowerCase();
    return epost || null;
  } catch {
    return null;
  }
}

const MAGISK_TOKEN_KEY = "gudstjenesteplanlegger_magisk_token";

export function erMagiskLenkeToken(verdi: string): boolean {
  return /^mk_[0-9a-z]+$/i.test(String(verdi || "").trim());
}

export function lesMagiskTokenFraUrl(search = typeof window === "undefined" ? "" : window.location.search): string | null {
  const t = (new URLSearchParams(search).get("t") || new URLSearchParams(search).get("token") || "").trim();
  return erMagiskLenkeToken(t) ? t : null;
}

export function lagreMagiskToken(token: string): void {
  if (!erMagiskLenkeToken(token)) return;
  try {
    sessionStorage.setItem(MAGISK_TOKEN_KEY, token.trim());
  } catch {
    // ignore
  }
}

export function hentMagiskToken(): string | null {
  try {
    const lagret = sessionStorage.getItem(MAGISK_TOKEN_KEY);
    if (lagret && erMagiskLenkeToken(lagret)) return lagret.trim();
  } catch {
    // ignore
  }
  return lesMagiskTokenFraUrl();
}

export function slettMagiskToken(): void {
  try {
    sessionStorage.removeItem(MAGISK_TOKEN_KEY);
  } catch {
    // ignore
  }
}

export function lagreAdminSesjon(epost: string, googleCredential?: string): void {
  try {
    sessionStorage.setItem(
      ADMIN_SESJON_KEY,
      JSON.stringify({
        epost: epost.trim().toLowerCase(),
        googleCredential: googleCredential || undefined,
      })
    );
  } catch {
    // privat modus / sperret lagring
  }
}

export function hentAdminSesjonEpost(): string | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_SESJON_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { epost?: string };
    const epost = String(parsed.epost || "").trim().toLowerCase();
    return epost || null;
  } catch {
    return null;
  }
}

export function hentAdminGoogleCredential(): string | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_SESJON_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { googleCredential?: string };
    const cred = String(parsed.googleCredential || "").trim();
    return cred || null;
  } catch {
    return null;
  }
}

export function slettAdminSesjon(): void {
  try {
    sessionStorage.removeItem(ADMIN_SESJON_KEY);
  } catch {
    // ignore
  }
}

/** Identitet som sendes til Apps Script. PersonID er ikke gyldig API-hemmelighet. */
export function hentApiIdentitet(): { token?: string; googleCredential?: string } {
  const googleCredential = hentAdminGoogleCredential();
  if (googleCredential) return { googleCredential };
  const token = hentMagiskToken();
  if (token) return { token };
  return {};
}

export function harApiIdentitet(): boolean {
  const id = hentApiIdentitet();
  return Boolean(id.token || id.googleCredential);
}

/** Lim inn full URL, sti+spørring, eller bare token. */
export function tolkInnlimtLenke(raw: string, pathname = "/"): string | null {
  const verdi = raw.trim();
  if (!verdi) return null;
  try {
    const url = new URL(verdi, "https://utfylling.invalid");
    const t = url.searchParams.get("t") || url.searchParams.get("token") || "";
    if (erMagiskLenkeToken(t)) {
      return `${pathname}?t=${encodeURIComponent(t.trim())}`;
    }
  } catch {
    // ikke URL
  }
  if (erMagiskLenkeToken(verdi)) {
    return `${pathname}?t=${encodeURIComponent(verdi.trim())}`;
  }
  return null;
}
