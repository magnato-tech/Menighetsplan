import fs from "fs";

const fornavn = [
  "Emma", "Noah", "Nora", "Lucas", "Ella", "William", "Maja", "Filip", "Ingeborg", "Jakob",
  "Sara", "Oliver", "Hanna", "Emil", "Thea", "Aksel", "Julie", "Henrik", "Ida", "Magnus",
  "Leah", "Matias", "Sofie", "Elias", "Amalie", "Tobias", "Mari", "Sander", "Live", "Even",
  "Frida", "Adrian", "Silje", "Kristian", "Marte", "Benjamin", "Vilde", "Sebastian", "Tiril", "Markus",
];
const etternavn = [
  "Andersen", "Johansen", "Hansen", "Olsen", "Larsen", "Nilsen", "Pedersen", "Kristiansen", "Jensen", "Karlsen",
  "Johnsen", "Eriksen", "Berg", "Haugen", "Dahl", "Moen", "Solberg", "Strand", "Lund", "Holm",
  "Bakke", "Aas", "Myhre", "Ruud", "Sæther", "Vik", "Eide", "Tveit", "Fosse", "Hauge",
  "Nordby", "Sørensen", "Iversen", "Lien", "Berge", "Tangen", "Rønning", "Stensrud", "Wold", "Nygaard",
];
const grupper = [
  ["G001", 2],
  ["G002", 5],
  ["G003", 4],
  ["G004", 4],
  ["G005", 4],
  ["G006", 4],
  ["G007", 3],
  ["G008", 4],
];

let p = 20;
let gm = 26;
const personer = [];
const gruppemedlemmer = [];

for (let i = 0; i < 40; i++) {
  const id = `P${String(p).padStart(3, "0")}`;
  const fn = fornavn[i];
  const en = etternavn[i];
  personer.push({
    PersonID: id,
    Navn: `${fn} ${en}`,
    Fornavn: fn,
    Etternavn: en,
    Epost: `${fn.toLowerCase()}.${en.toLowerCase()}@example.com`,
    Telefon: `9${String(10000000 + i * 111111).slice(0, 7)}`,
    Aktiv: true,
    Tilgangsnivå: "bruker",
    OpprettetDato: "2026-02-01",
    SistEndret: "2026-02-01",
  });
  p++;
}

let pi = 0;
for (const [gid, n] of grupper) {
  for (let j = 0; j < n; j++) {
    const pid = personer[pi++].PersonID;
    gruppemedlemmer.push({
      GruppeMedlemID: `GM${String(gm++).padStart(3, "0")}`,
      GruppeID: gid,
      PersonID: pid,
      Medlemsrolle: "Medlem",
      Aktiv: true,
      OpprettetDato: "2026-02-01",
      SistEndret: "2026-02-01",
    });
  }
}

const meldinger = [
  { id: "GM001", g: "G002", fra: "P002", tekst: "Vi øver på fredag kl. 18 — ta med gitar om du har.", kilde: "gruppeleder", dato: "2026-02-10" },
  { id: "GM002", g: "G006", fra: "P006", tekst: "Trenger to til baking søndag 23. februar.", kilde: "gruppeleder", dato: "2026-02-12" },
  { id: "GM003", g: "G003", fra: "P003", tekst: "Ny mikrofon på plass — kort gjennomgang før gudstjeneste.", kilde: "gruppeleder", dato: "2026-02-14" },
  { id: "GM004", g: "G004", fra: "P004", tekst: "Barnekirke: husk gul vest om du er ny denne søndagen.", kilde: "gruppeleder", dato: "2026-02-15" },
  { id: "GM005", g: "G005", fra: "P005", tekst: "Vi trenger én ekstra ved inngangen 2. mars.", kilde: "gruppeleder", dato: "2026-02-16" },
  { id: "GM006", g: "G002", fra: "P008", tekst: "Kan ikke søndag 2. mars — reiser bort.", kilde: "medlem", dato: "2026-02-17", hendelse: "forfall" },
  { id: "GM007", g: "G007", fra: "P011", tekst: "Forbønnsteam: vi samles 10 min før gudstjeneste ved bønnerommet.", kilde: "gruppeleder", dato: "2026-02-18" },
  { id: "GM008", g: "G001", fra: "P001", tekst: "Møteledermøte torsdag 19.30 — kort agenda kommer.", kilde: "gruppeleder", dato: "2026-02-19" },
  { id: "GM009", g: "G006", fra: "P013", tekst: "Kakebordet er dekket — trenger hjelp til oppvask etterpå.", kilde: "gruppeleder", dato: "2026-02-20" },
  { id: "GM010", g: "G003", fra: "P009", tekst: "Lyd søn. 9. mars: Ola har meldt forfall til Lyd 9. mars. Er det noen som kan steppe inn og ta denne oppgaven?", kilde: "system", dato: "2026-02-21", utloser: "P009" },
  { id: "GM011", g: "G002", fra: "P002", tekst: "Setliste for palmesøndag er lagt ut — se Min side.", kilde: "gruppeleder", dato: "2026-02-22" },
  { id: "GM012", g: "G008", fra: "P007", tekst: "Husgruppe: vi møtes hos Camilla onsdag 26. feb kl. 19.", kilde: "gruppeleder", dato: "2026-02-23" },
  { id: "GM013", g: "G004", fra: "P016", tekst: "Kan ta barnekirke 16. mars om noen trenger avlastning.", kilde: "medlem", dato: "2026-02-24" },
  { id: "GM014", g: "G005", fra: "P012", tekst: "Husk å komme 45 min før — vi rigger sammen.", kilde: "gruppeleder", dato: "2026-02-25" },
  { id: "GM015", g: "G006", fra: "P006", tekst: "Glutenfritt alternativ på kaffebordet denne søndagen.", kilde: "gruppeleder", dato: "2026-02-26" },
];

const gruppeMeldinger = meldinger.map((m) => ({
  GruppeMeldingID: m.id,
  GruppeID: m.g,
  Tekst: m.tekst,
  OpprettetAvPersonID: m.fra,
  OpprettetDato: m.dato,
  SistEndret: m.dato,
  Kilde: m.kilde,
  HendelseType: m.hendelse || "manuell",
  UtlostAvPersonID: m.utloser,
}));

const out = `import type { Person, Gruppemedlem, GruppeMelding } from "../types/database";

export const demoPersoner: Person[] = ${JSON.stringify(personer, null, 2)};

export const demoGruppemedlemmer: Gruppemedlem[] = ${JSON.stringify(gruppemedlemmer, null, 2)};

export const demoGruppeMeldinger: GruppeMelding[] = ${JSON.stringify(gruppeMeldinger, null, 2)};
`;

fs.writeFileSync("src/data/demoUtvidelse.ts", out);
console.log(
  `Wrote ${personer.length} personer, ${gruppemedlemmer.length} medlemmer, ${gruppeMeldinger.length} meldinger`
);
