# Datakilde: mock vs Supabase vs Google Sheets

Produkt og kodekart: [PRODUKT.md](PRODUKT.md).

## Hvordan utvikler bruker mock-data

På localhost er mock standard. Velg **Mock-data** i Administrator (knapper øverst, eller fanen Innstillinger). Det populerer testdata fra `src/data/initialData.ts`. Mock har egen localStorage-nøkkel og leser/skriver **ikke** Supabase eller Google Sheets.

```bash
npm run dev
```

## Hvordan utvikler tester ekte data lokalt

1. Opprett et Supabase-prosjekt (EU, f.eks. Frankfurt).
2. Kjør SQL i [`supabase/schema.sql`](../supabase/schema.sql) i SQL Editor.
3. I `.env.local` (ikke commit):

```
VITE_USE_REMOTE_DATA=true
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
GOOGLE_CLIENT_ID=...samme som VITE_GOOGLE_CLIENT_ID
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
```

Velg **Ekte data** i Administrator. Appen kaller `/api/db` (Vite-plugin lokalt). Første overføring: **Hent fra Google-arket til Supabase** (krever admin).

Hvis kallet feiler: **Prøv igjen**, eller **Bruk mock-data**. Valget huskes i nettleseren (`gudstjenesteplanlegger_dev_data_source`).

## Hvordan produksjon bruker data

`npm run build` setter `import.meta.env.PROD`. Produksjon bruker alltid `/api/db` → Supabase. Google Sheets er manuell backup.

På Vercel: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_ID` (ikke `VITE_` for de tre første).

## Hva brukeren ser hvis backend er nede

- Lasteskjerm: «Laster data …»
- Ved feil: «Kunne ikke laste data» + **Prøv igjen**
- Produksjon: ingen mock-knapp og ingen stille testdata
- Utvikling: samme skjerm, pluss **Bruk mock-data**

## Environment variables

| Variabel | Utvikling | Produksjon |
|---|---|---|
| `VITE_USE_REMOTE_DATA` | `false` / unset = mock. `true` = Supabase | Ignoreres (alltid remote) |
| `SUPABASE_URL` | Server `/api/db` | Vercel |
| `SUPABASE_SERVICE_ROLE_KEY` | Server `/api/db` | Vercel |
| `GOOGLE_CLIENT_ID` | Verifiser Google-token på server | Vercel |
| `VITE_APPS_SCRIPT_URL` | Backup, import, første migrasjon | Innbakes / Vercel |

Ikke bruk `VITE_` på service role-nøkkelen.

## Nye ark-faner og kolonner

`Malaktiviteter`, `Programaktiviteter` og `Programinstanser` opprettes automatisk av Apps Script (`ensureSchema_`) ved `load`/`save`. På fanen **Gudstjenester** opprettes kolonnen `Kunngjøringer` på samme måte (sammen med eksisterende `Kollekt`).

Etter kodeendring i `apps-script/Kode.gs` må backend publiseres på nytt:

```bash
npm run apps-script:push
npm run apps-script:deploy
```

Siste manuelle deploy av nettappen i denne runden er **versjon 41**. Før deploy finnes ikke nye faner/kolonner i menighetsarket. Frontend tåler tomme lister og manglende `Kunngjøringer`.
