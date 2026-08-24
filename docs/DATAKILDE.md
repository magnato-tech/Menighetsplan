# Datakilde: mock vs Google Sheets

Produkt og kodekart: [PRODUKT.md](PRODUKT.md).

## Hvordan utvikler bruker mock-data

På localhost er mock standard. Velg **Mock-data** i Administrator (knapper øverst, eller fanen Google Sheets & Data). Det populerer testdata fra `src/data/initialData.ts`. Mock har egen localStorage-nøkkel og leser/skriver **ikke** Google Sheets.

```bash
npm run dev
```

## Hvordan utvikler tester ekte Google Sheets lokalt

Velg **Ekte data** i Administrator. Appen henter da `/gas-api?action=load` (15 s timeout) og lagrer endringer til arket.

Hvis kallet feiler: **Prøv igjen**, eller **Bruk mock-data**. Valget huskes i nettleseren (`gudstjenesteplanlegger_dev_data_source`).

`VITE_USE_REMOTE_DATA=true` i `.env` brukes bare som startvalg hvis du ikke har valgt i admin ennå.

## Hvordan produksjon bruker Google Sheets

`npm run build` setter `import.meta.env.PROD`. Produksjon bruker alltid Apps Script / Google Sheets, uansett `VITE_USE_REMOTE_DATA`. Det finnes ingen mock-fallback.

Standard Web App-URL er den i `VITE_APPS_SCRIPT_URL` (innbakt ved build) eller den hardkodede menighets-URL-en.

Verifiser før deployment:

```bash
npm run build
npm run preview
```

Preview kaller Google direkte (ikke `/gas-api`). Du skal se data fra arket, ikke Magnar Totland fra mock.

## Hva brukeren ser hvis backend er nede

- Lasteskjerm: «Laster data fra menighetsarket …»
- Ved feil: «Kunne ikke laste menighetsarket» + **Prøv igjen**
- Produksjon: ingen mock-knapp og ingen stille testdata
- Utvikling med `VITE_USE_REMOTE_DATA=true`: samme skjerm, pluss **Bruk mock-data**

## Environment variables

| Variabel | Utvikling | Produksjon |
|---|---|---|
| `VITE_USE_REMOTE_DATA` | `false` / unset = mock. `true` = Sheets | Ignoreres (alltid Sheets) |
| `VITE_APPS_SCRIPT_URL` | Apps Script `/exec`-URL (valgfri; har default) | Innbakes ved build |

`GEMINI_API_KEY` og `APP_URL` brukes ikke av datalaget mot Sheets.

## Nye ark-faner (Programmal)

`Malaktiviteter`, `Programaktiviteter` og `Programinstanser` opprettes automatisk av Apps Script (`ensureSchema_`) ved `load`/`save`. Etter kodeendring i `apps-script/Kode.gs` må backend publiseres på nytt:

```bash
npm run apps-script:push
npm run apps-script:deploy
```

Før deploy finnes ikke fanene i menighetsarket. Frontend tåler tomme lister.

## Hvordan verifisere produksjonsflyten før deployment

1. Localhost + mock: `npm run dev` uten flagg — mock-personer (f.eks. Magnar Totland P001).
2. Localhost + Sheets: `.env` med `VITE_USE_REMOTE_DATA=true`, restart — arket (ikke mock).
3. Produksjonsbuild: `npm run build && npm run preview` mot gyldig URL — arket, ingen mock ved feil.
4. Simulert API-feil: bygg med ugyldig `VITE_APPS_SCRIPT_URL` og kjør preview — feilskjerm + Prøv igjen, ingen mock.
