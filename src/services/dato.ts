/** ISO-dato YYYY-MM-DD, eller tom streng hvis ukjent format. */
export function tilIsoDato(dato: string): string {
  const t = String(dato || "").trim();
  if (!t) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const compact = /^(\d{4})(\d{2})(\d{2})(?:$|T)/.exec(t);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const nordisk = /^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/.exec(t);
  if (nordisk) {
    let year = parseInt(nordisk[3], 10);
    if (year < 100) year += 2000;
    return `${year}-${String(nordisk[2]).padStart(2, "0")}-${String(nordisk[1]).padStart(2, "0")}`;
  }
  return t;
}

export function tilIsoTid(tid: string, fallback = "12:00"): string {
  const m = /^(\d{1,2})[:.](\d{2})/.exec(String(tid || "").trim());
  if (!m) return fallback;
  return `${String(m[1]).padStart(2, "0")}:${m[2]}`;
}
