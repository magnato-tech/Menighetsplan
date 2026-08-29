import type { Person, Gruppemedlem, GruppeMelding } from "../types/database";

export const demoPersoner: Person[] = [
  {
    "PersonID": "P020",
    "Navn": "Emma Andersen",
    "Fornavn": "Emma",
    "Etternavn": "Andersen",
    "Epost": "emma.andersen@example.com",
    "Telefon": "91000000",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P021",
    "Navn": "Noah Johansen",
    "Fornavn": "Noah",
    "Etternavn": "Johansen",
    "Epost": "noah.johansen@example.com",
    "Telefon": "91011111",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P022",
    "Navn": "Nora Hansen",
    "Fornavn": "Nora",
    "Etternavn": "Hansen",
    "Epost": "nora.hansen@example.com",
    "Telefon": "91022222",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P023",
    "Navn": "Lucas Olsen",
    "Fornavn": "Lucas",
    "Etternavn": "Olsen",
    "Epost": "lucas.olsen@example.com",
    "Telefon": "91033333",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P024",
    "Navn": "Ella Larsen",
    "Fornavn": "Ella",
    "Etternavn": "Larsen",
    "Epost": "ella.larsen@example.com",
    "Telefon": "91044444",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P025",
    "Navn": "William Nilsen",
    "Fornavn": "William",
    "Etternavn": "Nilsen",
    "Epost": "william.nilsen@example.com",
    "Telefon": "91055555",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P026",
    "Navn": "Maja Pedersen",
    "Fornavn": "Maja",
    "Etternavn": "Pedersen",
    "Epost": "maja.pedersen@example.com",
    "Telefon": "91066666",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P027",
    "Navn": "Filip Kristiansen",
    "Fornavn": "Filip",
    "Etternavn": "Kristiansen",
    "Epost": "filip.kristiansen@example.com",
    "Telefon": "91077777",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P028",
    "Navn": "Ingeborg Jensen",
    "Fornavn": "Ingeborg",
    "Etternavn": "Jensen",
    "Epost": "ingeborg.jensen@example.com",
    "Telefon": "91088888",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P029",
    "Navn": "Jakob Karlsen",
    "Fornavn": "Jakob",
    "Etternavn": "Karlsen",
    "Epost": "jakob.karlsen@example.com",
    "Telefon": "91099999",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P030",
    "Navn": "Sara Johnsen",
    "Fornavn": "Sara",
    "Etternavn": "Johnsen",
    "Epost": "sara.johnsen@example.com",
    "Telefon": "91111111",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P031",
    "Navn": "Oliver Eriksen",
    "Fornavn": "Oliver",
    "Etternavn": "Eriksen",
    "Epost": "oliver.eriksen@example.com",
    "Telefon": "91122222",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P032",
    "Navn": "Hanna Berg",
    "Fornavn": "Hanna",
    "Etternavn": "Berg",
    "Epost": "hanna.berg@example.com",
    "Telefon": "91133333",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P033",
    "Navn": "Emil Haugen",
    "Fornavn": "Emil",
    "Etternavn": "Haugen",
    "Epost": "emil.haugen@example.com",
    "Telefon": "91144444",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P034",
    "Navn": "Thea Dahl",
    "Fornavn": "Thea",
    "Etternavn": "Dahl",
    "Epost": "thea.dahl@example.com",
    "Telefon": "91155555",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P035",
    "Navn": "Aksel Moen",
    "Fornavn": "Aksel",
    "Etternavn": "Moen",
    "Epost": "aksel.moen@example.com",
    "Telefon": "91166666",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P036",
    "Navn": "Julie Solberg",
    "Fornavn": "Julie",
    "Etternavn": "Solberg",
    "Epost": "julie.solberg@example.com",
    "Telefon": "91177777",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P037",
    "Navn": "Henrik Strand",
    "Fornavn": "Henrik",
    "Etternavn": "Strand",
    "Epost": "henrik.strand@example.com",
    "Telefon": "91188888",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P038",
    "Navn": "Ida Lund",
    "Fornavn": "Ida",
    "Etternavn": "Lund",
    "Epost": "ida.lund@example.com",
    "Telefon": "91199999",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P039",
    "Navn": "Magnus Holm",
    "Fornavn": "Magnus",
    "Etternavn": "Holm",
    "Epost": "magnus.holm@example.com",
    "Telefon": "91211110",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P040",
    "Navn": "Leah Bakke",
    "Fornavn": "Leah",
    "Etternavn": "Bakke",
    "Epost": "leah.bakke@example.com",
    "Telefon": "91222222",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P041",
    "Navn": "Matias Aas",
    "Fornavn": "Matias",
    "Etternavn": "Aas",
    "Epost": "matias.aas@example.com",
    "Telefon": "91233333",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P042",
    "Navn": "Sofie Myhre",
    "Fornavn": "Sofie",
    "Etternavn": "Myhre",
    "Epost": "sofie.myhre@example.com",
    "Telefon": "91244444",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P043",
    "Navn": "Elias Ruud",
    "Fornavn": "Elias",
    "Etternavn": "Ruud",
    "Epost": "elias.ruud@example.com",
    "Telefon": "91255555",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P044",
    "Navn": "Amalie Sæther",
    "Fornavn": "Amalie",
    "Etternavn": "Sæther",
    "Epost": "amalie.sæther@example.com",
    "Telefon": "91266666",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P045",
    "Navn": "Tobias Vik",
    "Fornavn": "Tobias",
    "Etternavn": "Vik",
    "Epost": "tobias.vik@example.com",
    "Telefon": "91277777",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P046",
    "Navn": "Mari Eide",
    "Fornavn": "Mari",
    "Etternavn": "Eide",
    "Epost": "mari.eide@example.com",
    "Telefon": "91288888",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P047",
    "Navn": "Sander Tveit",
    "Fornavn": "Sander",
    "Etternavn": "Tveit",
    "Epost": "sander.tveit@example.com",
    "Telefon": "91299999",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P048",
    "Navn": "Live Fosse",
    "Fornavn": "Live",
    "Etternavn": "Fosse",
    "Epost": "live.fosse@example.com",
    "Telefon": "91311110",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P049",
    "Navn": "Even Hauge",
    "Fornavn": "Even",
    "Etternavn": "Hauge",
    "Epost": "even.hauge@example.com",
    "Telefon": "91322221",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P050",
    "Navn": "Frida Nordby",
    "Fornavn": "Frida",
    "Etternavn": "Nordby",
    "Epost": "frida.nordby@example.com",
    "Telefon": "91333333",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P051",
    "Navn": "Adrian Sørensen",
    "Fornavn": "Adrian",
    "Etternavn": "Sørensen",
    "Epost": "adrian.sørensen@example.com",
    "Telefon": "91344444",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P052",
    "Navn": "Silje Iversen",
    "Fornavn": "Silje",
    "Etternavn": "Iversen",
    "Epost": "silje.iversen@example.com",
    "Telefon": "91355555",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P053",
    "Navn": "Kristian Lien",
    "Fornavn": "Kristian",
    "Etternavn": "Lien",
    "Epost": "kristian.lien@example.com",
    "Telefon": "91366666",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P054",
    "Navn": "Marte Berge",
    "Fornavn": "Marte",
    "Etternavn": "Berge",
    "Epost": "marte.berge@example.com",
    "Telefon": "91377777",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P055",
    "Navn": "Benjamin Tangen",
    "Fornavn": "Benjamin",
    "Etternavn": "Tangen",
    "Epost": "benjamin.tangen@example.com",
    "Telefon": "91388888",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P056",
    "Navn": "Vilde Rønning",
    "Fornavn": "Vilde",
    "Etternavn": "Rønning",
    "Epost": "vilde.rønning@example.com",
    "Telefon": "91399999",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P057",
    "Navn": "Sebastian Stensrud",
    "Fornavn": "Sebastian",
    "Etternavn": "Stensrud",
    "Epost": "sebastian.stensrud@example.com",
    "Telefon": "91411110",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P058",
    "Navn": "Tiril Wold",
    "Fornavn": "Tiril",
    "Etternavn": "Wold",
    "Epost": "tiril.wold@example.com",
    "Telefon": "91422221",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "PersonID": "P059",
    "Navn": "Markus Nygaard",
    "Fornavn": "Markus",
    "Etternavn": "Nygaard",
    "Epost": "markus.nygaard@example.com",
    "Telefon": "91433332",
    "Aktiv": true,
    "Tilgangsnivå": "bruker",
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  }
];

export const demoGruppemedlemmer: Gruppemedlem[] = [
  {
    "GruppeMedlemID": "GM026",
    "GruppeID": "G001",
    "PersonID": "P020",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM027",
    "GruppeID": "G001",
    "PersonID": "P021",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM028",
    "GruppeID": "G002",
    "PersonID": "P022",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM029",
    "GruppeID": "G002",
    "PersonID": "P023",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM030",
    "GruppeID": "G002",
    "PersonID": "P024",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM031",
    "GruppeID": "G002",
    "PersonID": "P025",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM032",
    "GruppeID": "G002",
    "PersonID": "P026",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM033",
    "GruppeID": "G003",
    "PersonID": "P027",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM034",
    "GruppeID": "G003",
    "PersonID": "P028",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM035",
    "GruppeID": "G003",
    "PersonID": "P029",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM036",
    "GruppeID": "G003",
    "PersonID": "P030",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM037",
    "GruppeID": "G004",
    "PersonID": "P031",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM038",
    "GruppeID": "G004",
    "PersonID": "P032",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM039",
    "GruppeID": "G004",
    "PersonID": "P033",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM040",
    "GruppeID": "G004",
    "PersonID": "P034",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM041",
    "GruppeID": "G005",
    "PersonID": "P035",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM042",
    "GruppeID": "G005",
    "PersonID": "P036",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM043",
    "GruppeID": "G005",
    "PersonID": "P037",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM044",
    "GruppeID": "G005",
    "PersonID": "P038",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM045",
    "GruppeID": "G006",
    "PersonID": "P039",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM046",
    "GruppeID": "G006",
    "PersonID": "P040",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM047",
    "GruppeID": "G006",
    "PersonID": "P041",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM048",
    "GruppeID": "G006",
    "PersonID": "P042",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM049",
    "GruppeID": "G007",
    "PersonID": "P043",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM050",
    "GruppeID": "G007",
    "PersonID": "P044",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM051",
    "GruppeID": "G007",
    "PersonID": "P045",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM052",
    "GruppeID": "G008",
    "PersonID": "P046",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM053",
    "GruppeID": "G008",
    "PersonID": "P047",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM054",
    "GruppeID": "G008",
    "PersonID": "P048",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  },
  {
    "GruppeMedlemID": "GM055",
    "GruppeID": "G008",
    "PersonID": "P049",
    "Medlemsrolle": "Medlem",
    "Aktiv": true,
    "OpprettetDato": "2026-02-01",
    "SistEndret": "2026-02-01"
  }
];

export const demoGruppeMeldinger: GruppeMelding[] = [
  {
    "GruppeMeldingID": "GM001",
    "GruppeID": "G002",
    "Tekst": "Vi øver på fredag kl. 18 — ta med gitar om du har.",
    "OpprettetAvPersonID": "P002",
    "OpprettetDato": "2026-02-10",
    "SistEndret": "2026-02-10",
    "Kilde": "gruppeleder",
    "HendelseType": "manuell"
  },
  {
    "GruppeMeldingID": "GM002",
    "GruppeID": "G006",
    "Tekst": "Trenger to til baking søndag 23. februar.",
    "OpprettetAvPersonID": "P006",
    "OpprettetDato": "2026-02-12",
    "SistEndret": "2026-02-12",
    "Kilde": "gruppeleder",
    "HendelseType": "manuell"
  },
  {
    "GruppeMeldingID": "GM003",
    "GruppeID": "G003",
    "Tekst": "Ny mikrofon på plass — kort gjennomgang før gudstjeneste.",
    "OpprettetAvPersonID": "P003",
    "OpprettetDato": "2026-02-14",
    "SistEndret": "2026-02-14",
    "Kilde": "gruppeleder",
    "HendelseType": "manuell"
  },
  {
    "GruppeMeldingID": "GM004",
    "GruppeID": "G004",
    "Tekst": "Barnekirke: husk gul vest om du er ny denne søndagen.",
    "OpprettetAvPersonID": "P004",
    "OpprettetDato": "2026-02-15",
    "SistEndret": "2026-02-15",
    "Kilde": "gruppeleder",
    "HendelseType": "manuell"
  },
  {
    "GruppeMeldingID": "GM005",
    "GruppeID": "G005",
    "Tekst": "Vi trenger én ekstra ved inngangen 2. mars.",
    "OpprettetAvPersonID": "P005",
    "OpprettetDato": "2026-02-16",
    "SistEndret": "2026-02-16",
    "Kilde": "gruppeleder",
    "HendelseType": "manuell"
  },
  {
    "GruppeMeldingID": "GM006",
    "GruppeID": "G002",
    "Tekst": "Kan ikke søndag 2. mars — reiser bort.",
    "OpprettetAvPersonID": "P008",
    "OpprettetDato": "2026-02-17",
    "SistEndret": "2026-02-17",
    "Kilde": "medlem",
    "HendelseType": "forfall"
  },
  {
    "GruppeMeldingID": "GM007",
    "GruppeID": "G007",
    "Tekst": "Forbønnsteam: vi samles 10 min før gudstjeneste ved bønnerommet.",
    "OpprettetAvPersonID": "P011",
    "OpprettetDato": "2026-02-18",
    "SistEndret": "2026-02-18",
    "Kilde": "gruppeleder",
    "HendelseType": "manuell"
  },
  {
    "GruppeMeldingID": "GM008",
    "GruppeID": "G001",
    "Tekst": "Møteledermøte torsdag 19.30 — kort agenda kommer.",
    "OpprettetAvPersonID": "P001",
    "OpprettetDato": "2026-02-19",
    "SistEndret": "2026-02-19",
    "Kilde": "gruppeleder",
    "HendelseType": "manuell"
  },
  {
    "GruppeMeldingID": "GM009",
    "GruppeID": "G006",
    "Tekst": "Kakebordet er dekket — trenger hjelp til oppvask etterpå.",
    "OpprettetAvPersonID": "P013",
    "OpprettetDato": "2026-02-20",
    "SistEndret": "2026-02-20",
    "Kilde": "gruppeleder",
    "HendelseType": "manuell"
  },
  {
    "GruppeMeldingID": "GM010",
    "GruppeID": "G003",
    "Tekst": "Lyd søn. 9. mars: Ola har meldt forfall til Lyd 9. mars. Er det noen som kan steppe inn og ta denne oppgaven?",
    "OpprettetAvPersonID": "P009",
    "OpprettetDato": "2026-02-21",
    "SistEndret": "2026-02-21",
    "Kilde": "system",
    "HendelseType": "manuell",
    "UtlostAvPersonID": "P009"
  },
  {
    "GruppeMeldingID": "GM011",
    "GruppeID": "G002",
    "Tekst": "Setliste for palmesøndag er lagt ut — se Min side.",
    "OpprettetAvPersonID": "P002",
    "OpprettetDato": "2026-02-22",
    "SistEndret": "2026-02-22",
    "Kilde": "gruppeleder",
    "HendelseType": "manuell"
  },
  {
    "GruppeMeldingID": "GM012",
    "GruppeID": "G008",
    "Tekst": "Husgruppe: vi møtes hos Camilla onsdag 26. feb kl. 19.",
    "OpprettetAvPersonID": "P007",
    "OpprettetDato": "2026-02-23",
    "SistEndret": "2026-02-23",
    "Kilde": "gruppeleder",
    "HendelseType": "manuell"
  },
  {
    "GruppeMeldingID": "GM013",
    "GruppeID": "G004",
    "Tekst": "Kan ta barnekirke 16. mars om noen trenger avlastning.",
    "OpprettetAvPersonID": "P016",
    "OpprettetDato": "2026-02-24",
    "SistEndret": "2026-02-24",
    "Kilde": "medlem",
    "HendelseType": "manuell"
  },
  {
    "GruppeMeldingID": "GM014",
    "GruppeID": "G005",
    "Tekst": "Husk å komme 45 min før — vi rigger sammen.",
    "OpprettetAvPersonID": "P012",
    "OpprettetDato": "2026-02-25",
    "SistEndret": "2026-02-25",
    "Kilde": "gruppeleder",
    "HendelseType": "manuell"
  },
  {
    "GruppeMeldingID": "GM015",
    "GruppeID": "G006",
    "Tekst": "Glutenfritt alternativ på kaffebordet denne søndagen.",
    "OpprettetAvPersonID": "P006",
    "OpprettetDato": "2026-02-26",
    "SistEndret": "2026-02-26",
    "Kilde": "gruppeleder",
    "HendelseType": "manuell"
  }
];
