import "./polyfill";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import * as XLSX from "xlsx";
import { parseMenighetsplanWorkbook } from "../services/excelImport";

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.aoa_to_sheet([
    ["PersonID", "Navn", "Epost", "Aktiv"],
    ["P001", "Magnar Totland", "magnar.totland@gmail.com", "TRUE"],
  ]),
  "Personer"
);
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.aoa_to_sheet([
    ["GudstjenesteID", "Dato", "Tema"],
    ["G001", "2026-08-16", "Visjon"],
  ]),
  "Gudstjenester"
);
const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
const liten = parseMenighetsplanWorkbook(buf);
assert.equal(liten.personer?.length, 1);
assert.equal(liten.personer?.[0].Navn, "Magnar Totland");
assert.equal(liten.gudstjenester?.[0].Tema, "Visjon");
assert.equal(String(liten.gudstjenester?.[0].Dato).startsWith("2026-08-16"), true);

const ekte = "C:\\Users\\magna\\Downloads\\Menighetsplan.xlsx";
if (existsSync(ekte)) {
  const data = readFileSync(ekte);
  const parsed = parseMenighetsplanWorkbook(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
  assert.ok((parsed.personer?.length || 0) >= 10, "Ekte fil skal ha personer");
  assert.ok((parsed.gudstjenester?.length || 0) >= 5, "Ekte fil skal ha gudstjenester");
  const magnar = parsed.personer?.find((p) => /magnar/i.test(p.Navn) || /magnar/i.test(p.Epost || ""));
  assert.ok(magnar, "Magnar skal ligge i Personer");
}

console.log("excelImport.test.ts: ok");
