# Menighetsplan — struktur og funksjon

Planlegger for gudstjenestebemanning i Lillesand Misjonskirke. Kjernen er **hvem som tjener hvilken søndag**, med grupper, personlenker og valgfri kjøreplan.

Datakilde (mock vs Supabase, Sheets som backup): [DATAKILDE.md](DATAKILDE.md).

## Hva appen gjør

- Holder oversikt over gudstjenester, roller og tildelinger (bekreftet / venter / forfall).
- Lar frivillige svare på Min side via personlig lenke.
- Lar tjenestegruppeledere bemanne **sine** roller og se gruppemedlemmer.
- Lar administrator styre hele huset: kalender, søndager, register, grupper, roller, programmal og innstillinger.

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

**Ark** er rutenett per rolle og søndag (samme data). Hos administrator på stor skjerm bruker det nesten full bredde (små marger). Hos gruppeleder blir det i den vanlige kolonnen — færre roller, ingen grunn til å strekke tabellen.

Admin ser alle grupper. Gruppeleder ser bare gruppens roller. Begge bruker samme listekomponent med ulikt omfang.

**Belastning** (admin) er semester-matrise per person; klikk i en celle hopper til den søndagen med personen uthevet.

## Kalender (admin)

Admin-fanen **Kalender** viser bare det som ligger i appen: gudstjenester og arrangementer. Appen er fasit. **Synk mot kirkekalenderen** sammenligner med kirkens iCal og lager oppgaver når noe mangler i appen — ingenting kopieres automatisk. **Legg inn** kan velge mal og valgfri gruppe (tom gruppe = åpent treff). **Ikke nå** lagrer at hendelsen er avvist.

Under **Innstillinger** kan admin skru på (standard av): lesekalender på Min side, lesekalender hos gruppeleder, og personlig **iCal-abonnement**. Leseflaten har én knapp **Abonner** som åpner Google Kalender (legg til fra URL) med den personlige `minIcal`-feeden.

## Grupper og register

- Tjenestegrupper eier roller. Gruppeleder/nestleder får leder-visning.
- **Gruppelederteam** synkes automatisk fra ledere.
- Personregister: navn, kontakt, gruppe, personlenke. Ny person opprettes **her** (kun navn); oppgaver tildeles etterpå under Søndager. Ukjente navn fra import kan opprettes her uten tildeling i samme steg.
- Gruppeleder ser mobil, e-post og adresse for medlemmer i gruppene hen leder.

## Programmal og kjøreplan

Admin redigerer maler under **Maler**: søndagens standard kjøreplan og arrangementmaler (kjøreplan + tilleggsvakter) i samme nedtrekk. Eksisterende søndager og arrangementer uten `MalID` er uendret.

På gudstjenesteraden ligger **Kollekt** (hva gaven går til) og **Kunngjøringer**. Admin og tildelt møteleder (ikke avvist) redigerer dem i programdialogen. A4-PDF (`ProgramPdfArk`) viser sted, tema og bibeltekst øverst, og kollekt/kunngjøringer nederst (under øvrig bemanning når den er slått på). Tomme felt vises ikke.

Samlingsplanlegging v1 (grunnversjon på gruppekort) og arrangement-tagger er inne. Ikke i denne versjonen: samlingsplanlegging v2 (maler, rom, avansert gjentakelse), endringslogg, egen visning «Møteleder», frysing av navn ved publisering, parallelle spor, én-klikks PDF-fil. Se `.cursor/rules/backlog.mdc`.

## Kodekart — hvor du endrer

Importer forretningslogikk fra `src/services/dataService.ts` (fatade). Filene under er der koden faktisk ligger.

### Tjenestelag (`src/services/`)

| Fil | Ansvar |
| --- | --- |
| `bemanning.ts` | Tildeling, svar, ark-celler, belastningstall, person i register |
| `grupper.ts` | Ledere, medlemskap, gruppelederteam |
| `program.ts` | Søndagsmal, instans, publisering, programtider, kollekt/kunngjøringer |
| `mal.ts` | Arrangementmaler, bemanning fra kjøreplan + tilleggsvakter |
| `arrangementer.ts` | Opprette og slette arrangementer |
| `eksternKalender.ts` | iCal-parse, tidsretting, synk-oppgaver |
| `kalender.ts` | Lesesynlighet, innstillinger, personlig iCal |
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
| `KalenderView.tsx` | Admin-kalender, synk-oppgaver |
| `ArrangementDetaljView.tsx` | Admin: bemanning og kjøreplan for ett arrangement |
| `AdminGudstjenesterView.tsx` | Admin rundt søndagslisten (ny gudstjeneste, tildel fra register) |
| `PersonregisterView.tsx` | Personregister-fanen (ny person uten tildeling) |
| `RollerAdminView.tsx` | Roller-fanen |
| `GroupOverview.tsx` | Grupper-fanen |
| `BelastningView.tsx` | Belastning-fanen |
| `ProgrammalAdminView.tsx` | Søndagens standardkjøreplan (under Maler) |
| `ArrangementMalAdminView.tsx` | Arrangementmal (kjøreplan + bemanning) |
| `MalerAdminView.tsx` | Admin-fanen Maler (søndag + arrangementmaler) |
| `GudstjenesteNotaterFelt.tsx` | Kollekt og kunngjøringer i programdialogen |
| `ProgramPdfArk.tsx` | A4-utskrift av publisert/forhåndsvist program |
| `ProgramLeserModal.tsx` | Les/rediger program, PDF-forhåndsvisning |
| `Planleggingsark.tsx` | Ark-visning |
| `Startside.tsx` | Login uten sesjon |

Tildelingsmodalene er **ikke** slått sammen: admin velger bare personer som allerede ligger i registeret; gruppeleder søker og kan sette et eksternt navn.

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
