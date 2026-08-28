/**
 * Datamodell for Gudstjenesteplanlegger 2.0
 * Fasit i henhold til Prosjektdokument og Datamodell-spesifikasjon.
 */

/** Person opprettet av gruppeleder venter på admin-gjennomgang. */
export type PersonStatus = "ny" | "registrert";

export interface Person {
  PersonID: string; // e.g. "P001"
  Navn: string;
  Fornavn: string;
  Etternavn: string;
  Epost: string;
  Telefon: string;
  SikkerhetsToken?: string; // Tilfeldig magisk-lenke-token, lagres i arket
  /** Satt til «ny» når gruppeleder oppretter personen. Admin bekrefter i registeret. */
  PersonStatus?: PersonStatus;
  /** App-tilgang. Ikke det samme som tjenesterolle i fanen Roller. */
  Tilgangsnivå?: "bruker" | "gruppeleder" | "admin";
  BildeURL?: string;
  Fødselsår?: number;
  Fødselsdato?: string;
  Kjønn?: string;
  Adresse?: string;
  Postnummer?: string;
  Poststed?: string;
  Notat?: string;
  Aktiv: boolean;
  OpprettetDato: string;
  SistEndret: string;
}

export interface Gruppetype {
  GruppetypeID: string; // e.g. "GT001"
  Navn: string; // e.g. "Tjenestegruppe", "Gruppeledergruppe", "Ledergruppe", "Husgruppe", "Barnekirke"
  Beskrivelse: string;
  Aktiv: boolean;
  OpprettetDato: string;
  SistEndret: string;
}

export interface Samlingsplan {
  Frekvens?: string;
  Ukedag?: string;
  Startdato?: string;
  Sluttdato?: string;
  Klokkeslett?: string;
  Sluttid?: string;
  SistGenerert?: string;
}

export interface ArrangementTag {
  Kategori: string;
  Verdi: string;
}

export interface GruppeRessurs {
  Tittel: string;
  Url?: string;
  Tekst?: string;
}

export interface Gruppe {
  GruppeID: string; // e.g. "G001"
  Gruppenavn: string; // e.g. "Lovsangsgruppe", "Kjøkkentjeneste"
  GruppetypeID: string; // Ref: Gruppetyper.GruppetypeID
  GruppelederID?: string; // Ref: Personer.PersonID
  NestlederID?: string; // Ref: Personer.PersonID
  Beskrivelse: string;
  Samlingsplan?: Samlingsplan;
  /** Lenker og notater gruppeleder kan lese (admin setter). */
  Ressurser?: GruppeRessurs[];
  Aktiv: boolean;
  OpprettetDato: string;
  SistEndret: string;
}

/** Oppmøte per person på en gruppesamling (arrangement). */
export interface SamlingOppmote {
  SamlingOppmoteID: string;
  ArrangementID: string;
  GruppeID: string;
  PersonID: string;
  Tilstede: boolean;
  OpprettetDato: string;
  SistEndret: string;
}

/** Intern melding fra gruppeleder til gruppemedlemmer (fasit i appen). */
export interface GruppeMelding {
  GruppeMeldingID: string;
  GruppeID: string;
  ArrangementID?: string;
  Tekst: string;
  OpprettetAvPersonID: string;
  OpprettetDato: string;
  SistEndret: string;
}

export type VarselLoggStatus = "manuell" | "sendt" | "feilet";

/** Logg over utgående varsler (manuell nå, API senere). */
export interface VarselLogg {
  VarselID: string;
  PersonID: string;
  GruppeMeldingID?: string;
  Kanal: "sms" | "epost" | "kopier";
  Status: VarselLoggStatus;
  Tidspunkt: string;
}

export interface Gruppemedlem {
  GruppeMedlemID: string; // e.g. "GM001"
  GruppeID: string; // Ref: Grupper.GruppeID
  PersonID: string; // Ref: Personer.PersonID
  Medlemsrolle?: string; // e.g. "Medlem", "Tekniker", "Bassist"
  Aktiv: boolean;
  FraDato?: string;
  TilDato?: string;
  Notat?: string;
  OpprettetDato: string;
  SistEndret: string;
}

export interface Rolle {
  RolleID: string; // e.g. "R001"
  Rollenavn: string; // e.g. "Møteleder", "Taler", "Forbønn", "Barnekirke", "Lovsang", "Lyd", "Bilde", "Møtevert", "Rigging", "Kjøkken"
  Beskrivelse: string;
  Aktiv: boolean;
  Behov: number; // Standardbehov for rollen per gudstjeneste (veiledende)
  /** Hard øvre grense. null/udefinert = standard for rollenavn; 0 = ubegrenset overbooking; ≥1 = maks. */
  MaksAntall?: number | null;
  GruppeID?: string; // Ref: Grupper.GruppeID (Ansvarlig tjenestegruppe)
  OpprettetDato: string;
  SistEndret: string;
}

export interface Personrolle {
  PersonRolleID: string; // e.g. "PR001"
  PersonID: string; // Ref: Personer.PersonID
  RolleID: string; // Ref: Roller.RolleID
  Aktiv: boolean;
  FraDato?: string;
  TilDato?: string;
  Notat?: string;
  OpprettetDato: string;
  SistEndret: string;
}

export interface Rollebeskrivelse {
  RolleID: string; // Ref: Roller.RolleID
  Rollebeskrivelse: string; // Fullstendig tekst/oppgaveinstruks
  Aktiv: boolean;
  OpprettetDato: string;
  SistEndret: string;
}

export interface Gudstjeneste {
  GudstjenesteID: string; // e.g. "GUD001"
  Dato: string; // YYYY-MM-DD
  Tid: string; // HH:mm
  Sted: string;
  Tema: string;
  Bibeltekst?: string;
  /** Hva kollekten går til denne søndagen. */
  Kollekt?: string;
  /** Kunngjøringer møteleder leser. */
  Kunngjøringer?: string;
  Merknad?: string;
  /** UID fra kirkekalenderen, kun treffnøkkel — appen eier innholdet. */
  EksternKalenderID?: string;
}

export interface Tjenestebehov {
  TjenestebehovID: string; // e.g. "TB001"
  GudstjenesteID: string; // Ref: Gudstjenester.GudstjenesteID (tom for arrangement)
  ArrangementID?: string;
  RolleID: string; // Ref: Roller.RolleID
  Antall: number; // Overstyrer Roller.Behov for denne gudstjenesten
  Aktiv: boolean;
  Notat?: string;
  OpprettetDato: string;
  SistEndret: string;
}

export interface Tildeling {
  TildelingID: string; // e.g. "T001"
  GudstjenesteID: string; // Ref: Gudstjenester.GudstjenesteID (tom for arrangement)
  ArrangementID?: string;
  RolleID: string; // Ref: Roller.RolleID
  PersonID: string; // Ref: Personer.PersonID, eller EXT… for gjest
  EksternNavn?: string; // Gjest: visningsnavn, ikke i Personer
  OpprettetDato: string;
  SistEndret: string;
}

export type SvarStatus = "Bekreftet" | "Avvist" | "Venter";

export interface Svar {
  SvarID: string; // e.g. "S001"
  TildelingID: string; // Ref: Tildelinger.TildelingID
  PersonID: string; // Ref: Personer.PersonID
  Svar: SvarStatus;
  Kommentar?: string;
  SvartDato: string;
}

// Avledet data-type (ikke mastertabell, men beregnet visning)
export interface LedigOppgave {
  GudstjenesteID: string;
  RolleID: string;
  Rollenavn: string;
  Dato: string;
  Tid: string;
  Sted: string;
  Tema: string;
  EffektivtBehov: number;
  AntallTildelt: number;
  LedigePlasser: number;
  AnsvarligGruppeID?: string;
  AnsvarligGruppeNavn?: string;
}

// Kildedata-formater (beholdes urørt for migrering/innsyn)
export interface PersonerImport {
  PersonID: string;
  Navn: string;
  Epost: string;
  Telefon: string;
  Tjenesteområde1?: string;
  Tjenesteområde2?: string;
  Tjenesteområde3?: string;
  Tjenesteområde4?: string;
  Tjenesteområde5?: string;
  Aktiv: boolean;
}

export interface GudstjenesterImport {
  GudstjenesteID: string;
  Dato: string;
  Tid: string;
  Sted?: string;
  Tema: string;
  Bibeltekst?: string;
  Kollekt?: string;
  Merknad?: string;
  Leder?: string;
  Taler?: string;
  Forbønn?: string;
  Barnekirke?: string;
  Lovsang?: string;
  Lyd?: string;
  Bilde?: string;
  Møtevert?: string;
  Rigging?: string;
  Kjøkken?: string;
  Baking?: string;
  Pynting?: string;
  MøtelederGammel?: string;
  TalerGammel?: string;
  LovsangGammel?: string;
  LydGammel?: string;
  VertGammel?: string;
}

export interface RollebeskrivelseImport {
  RolleID: string;
  Rollenavn: string;
  FullBeskrivelse: string;
  SjekklisteGammel?: string;
}

/** Standard kjøreplan (én mal). Personer lagres ikke — vises fra Tildelinger på gudstjenesten. */
export interface MalAktivitet {
  MalAktivitetID: string; // e.g. "MA001"
  Rekkefolge: number;
  Tittel: string;
  VarighetMin: number;
  RolleID?: string;
  ForStart: boolean;
  Merknad?: string;
  OpprettetDato: string;
  SistEndret: string;
}

/** Kopi av malen tilpasset én gudstjeneste. Klokkeslett beregnes, lagres ikke. */
export interface ProgramAktivitet {
  ProgramAktivitetID: string; // e.g. "PA001"
  GudstjenesteID: string;
  ArrangementID?: string;
  Rekkefolge: number;
  Tittel: string;
  VarighetMin: number;
  RolleID?: string;
  ForStart: boolean;
  Merknad?: string;
  OpprettetDato: string;
  SistEndret: string;
}

export type ProgramStatus = "Utkast" | "Publisert";

/** Én rad per gudstjeneste som har program. Uten rad er programmet ikke synlig. */
export interface Programinstans {
  GudstjenesteID: string;
  ArrangementID?: string;
  Status: ProgramStatus;
  PublisertDato?: string;
  PublisertAv?: string;
  OpprettetDato: string;
  SistEndret: string;
}

export interface Arrangement {
  ArrangementID: string;
  Dato: string;
  Tid: string;
  Sted: string;
  Tittel: string;
  Beskrivelse: string;
  GruppeID?: string;
  OpprettetAv?: string;
  EksternKalenderID?: string;
  Tagger?: ArrangementTag[];
  /** Valgfri. Tom = gammel rad, bemanning som før. Satt = ny mal (kjøreplan + tilleggsvakter). */
  MalID?: string;
  Aktiv: boolean;
  OpprettetDato: string;
  SistEndret: string;
}

/** Arrangementmal (ved siden av søndagens malaktiviteter). */
export interface Mal {
  MalID: string;
  Navn: string;
  Aktiv: boolean;
  OpprettetDato: string;
  SistEndret: string;
}

/** Kjøreplanlinje i en arrangementmal. Egne ID-er — ikke de samme som Malaktiviteter. */
export interface MalPost {
  MalPostID: string;
  MalID: string;
  Rekkefolge: number;
  Tittel: string;
  VarighetMin: number;
  RolleID?: string;
  ForStart: boolean;
  Merknad?: string;
  OpprettetDato: string;
  SistEndret: string;
}

/** Rolle som ikke kommer fra kjøreplanen, lagret på malen. */
export interface MalTilleggsvakt {
  MalTilleggsvaktID: string;
  MalID: string;
  RolleID: string;
  Antall: number;
  Aktiv: boolean;
  OpprettetDato: string;
  SistEndret: string;
}

export interface AppInnstillinger {
  visKalenderMinSide: boolean;
  visKalenderGruppeleder: boolean;
  visKalenderIcal: boolean;
  /** Gruppeleder kan varsle via enhetens SMS-app. Standard på. */
  visVarselSms: boolean;
  /** Gruppeleder kan varsle via enhetens e-post. Standard på. */
  visVarselEpost: boolean;
  /** Offentlig ICS-adresse for synk. Tom = kirkens standardfeed. */
  eksternIcalUrl?: string;
}

export type KalenderoppgaveStatus = "Åpen" | "Avvist" | "Opprettet";

export interface Kalenderoppgave {
  KalenderoppgaveID: string;
  EksternUID: string;
  Dato: string;
  Tid: string;
  Sted: string;
  Tittel: string;
  Beskrivelse: string;
  Status: KalenderoppgaveStatus;
  ArrangementID?: string;
  OpprettetDato: string;
  SistEndret: string;
}

export interface DatabaseState {
  gruppetyper: Gruppetype[];
  personer: Person[];
  grupper: Gruppe[];
  gruppemedlemmer: Gruppemedlem[];
  roller: Rolle[];
  personroller: Personrolle[];
  rollebeskrivelser: Rollebeskrivelse[];
  gudstjenester: Gudstjeneste[];
  tjenestebehov: Tjenestebehov[];
  tildelinger: Tildeling[];
  svar: Svar[];
  malaktiviteter: MalAktivitet[];
  maler: Mal[];
  malposter: MalPost[];
  malTilleggsvakter: MalTilleggsvakt[];
  programaktiviteter: ProgramAktivitet[];
  programinstanser: Programinstans[];
  arrangementer: Arrangement[];
  kalenderoppgaver: Kalenderoppgave[];
  samlingoppmote?: SamlingOppmote[];
  gruppeMeldinger?: GruppeMelding[];
  varselLogg?: VarselLogg[];
  innstillinger?: AppInnstillinger;
  personerImport: PersonerImport[];
  gudstjenesterImport: GudstjenesterImport[];
  rollebeskrivelseImport: RollebeskrivelseImport[];
}
