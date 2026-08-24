export function nesteNummerertId<T>(records: T[], field: keyof T, prefix: string): string {
  const max = records.reduce((acc, rec) => {
    const num = parseInt(String(rec[field] ?? "").replace(/\D/g, ""), 10);
    return !isNaN(num) && num > acc ? num : acc;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}
