# Menighetsplan — struktur og funksjon

Planlegger for gudstjenestebemanning i Lillesand Misjonskirke. Kjernen er **hvem som tjener hvilken søndag**, med grupper, personlenker og valgfri kjøreplan.

Datakilde (mock vs Google Sheets): [DATAKILDE.md](DATAKILDE.md).

## Hva appen gjør

- Holder oversikt over gudstjenester, roller og tildelinger (bekreftet / venter / forfall).
- Lar frivillige svare på Min side via personlig lenke.
- Lar tjenestegruppeledere bemanne **sine** roller og se gruppemedlemmer.
- Lar administrator styre hele huset: søndager, register, grupper, roller, programmal og innstillinger.

SMS-utsending er **ikke** på plass. Knappen hos gruppeleder er en deaktivert plassholder.

## Tre visninger

Tilgang styres av roller og gruppetilhørighet (`hentTilgang`).

| Visning | Hvem | Hva |
| --- | --- | --- |
| **Min side** | Alle innloggede | Egne oppgaver, ledige oppgaver i egne grupper, kjøreplan-ikon når relevant |
| **Tjenestegruppeleder** | Leder eller nestleder for minst én tjenestegruppe | Bemanning for gruppens roller, medlemsliste med kontakt, «Slik gjør du det» |
| **Administrator** | Person med rollen Administrator | Alle faner under |

Administrator kan «se som» en annen person for å teste.

Innlogging: personlig lenke (`?t=mk_…`) for frivillige; Google for administrator når klient-ID er satt. Utvikling kan åpnes mot mock uten Google.

## Søndag og bemanning

Hver gudstjeneste har roller med **veiledende behov** (overstyrbart per søndag). Tildeling er en person (eller eksternt navn) pluss svarstatus.

**Liste** viser ett kort per søndag: dato, tema, bekr./venter/ledige, sammenklappet rollesituasjon. Åpnet kort har rollerader (statusknapper, tildel, juster behov) og valgfri fane **Kjøreplan**.

**Ark** er rutenett per rolle og søndag (samme data).

Admin ser alle grupper. Gruppeleder ser bare gruppens roller. Begge bruker samme listekomponent med ulikt omfang.

**Belastning** (admin) er semester-matrise per person; klikk i en celle hopper til den søndagen med personen uthevet.

## Grupper og register

- Tjenestegrupper eier roller. Gruppeleder/nestleder får leder-visning.
- **Gruppelederteam** synkes automatisk fra ledere.
- Personregister: navn, kontakt, gruppe, personlenke. Ukjente navn fra import kan opprettes her.
- Gruppeleder ser mobil, e-post og adresse for medlemmer i gruppene hen leder.

## Programmal og kjøreplan

Admin redigerer **standardmalen**. Per gudstjeneste kan det ligge et utkast eller en **publisert** instans. Tildelt møteleder (ikke avvist) kan opprette fra mal, redigere og publisere **sin** søndag. PDF går via nettleserens utskrift.

Ikke i denne versjonen: flere maltyper, endringslogg, egen visning «Møteleder», frysing av navn ved publisering, parallelle spor, én-klikks PDF-fil. Se `.cursor/rules/backlog.mdc`.

## Kodekart — hvor du endrer

Importer forretningslogikk fra `src/services/dataService.ts` (fatade). Filene under er der koden faktisk ligger.

### Tjenestelag (`src/services/`)

| Fil | Ansvar |
| --- | --- |
| `bemanning.ts` | Tildeling, svar, ark-celler, belastningstall, person i register |
| `grupper.ts` | Ledere, medlemskap, gruppelederteam |
| `program.ts` | Mal, instans, publisering, programtider |
| `tilgang.ts` | Token, personlenke, `hentTilgang`, skjuling av andres kontakt |
| `persistens.ts` | Last/lagre, mock/remote, Sheets-kø |
| `innlogging.ts` | Sesjon, Google-JWT, URL-token |
| `ids.ts` | Neste nummererte ID |

Datamodellen (`DatabaseState` og tabeller) ligger i `src/types/database.ts`. Mock-innhold: `src/data/initialData.ts`. Sheets-API: `apps-script/Kode.gs` (ikke rør uten å oppdatere kontrakten).

### Skjermer (`src/components/`)

| Fil | Ansvar |
| --- | --- |
| `App.tsx` | Innlogging, last data, bytte visning |
| `PersonalView.tsx` | Min side |
| `GroupLeaderView.tsx` | Skall: gruppevalg, veiledning, medlemsliste |
| `GruppeMedlemListe.tsx` | Medlemmer og kontakt |
| `SondagBemanning.tsx` | Felles søndagsliste (admin og leder) |
| `AdminView.tsx` | Admin-faner og kryss-hopp |
| `AdminGudstjenesterView.tsx` | Admin rundt søndagslisten (følg opp, ny gudstjeneste, tildel fra register) |
| `PersonregisterView.tsx` | Personregister-fanen |
| `RollerAdminView.tsx` | Roller-fanen |
| `GroupOverview.tsx` | Grupper-fanen |
| `BelastningView.tsx` | Belastning-fanen |
| `ProgrammalAdminView.tsx` | Programmal-fanen |
| `Planleggingsark.tsx` | Ark-visning |
| `Startside.tsx` | Login uten sesjon |

Tildelingsmodalene er **ikke** slått sammen: admin velger fra register / oppretter person; gruppeleder søker og kan sette ekstern.

## Dataflyt

```
Startside / personlenke / Google
        → App laster DatabaseState (persistens)
        → PersonalView | GroupLeaderView | AdminView
        → mutatorer i bemanning/grupper/program
        → saveDatabase (localStorage; kø mot Sheets når remote)
```

Utvikling: `npm run dev` på http://localhost:3000/. Tester: `npm test`. Typesjekk: `npm run lint`.

## Arbeidsregel

Tekst, kolonne og CSS: åpne den lille visningsfilen, ikke tjenestelaget. Ny tildelingsregel: `bemanning.ts`. Ny grupperegel: `grupper.ts`. Ny søndagskort-UI: `SondagBemanning.tsx`.
