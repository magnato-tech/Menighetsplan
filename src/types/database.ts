/**
 * Datamodell for Gudstjenesteplanlegger 2.0
 * Fasit i henhold til Prosjektdokument og Datamodell-spesifikasjon.
 */

export interface Person {
  PersonID: string; // e.g. "P001"
  Navn: string;
  Fornavn: string;
  Etternavn: string;
  Epost: string;
  Telefon: string;
  SikkerhetsToken?: string; // Tilfeldig magisk-lenke-token, lagres i arket
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

export interface Gruppe {
  GruppeID: string; // e.g. "G001"
  Gruppenavn: string; // e.g. "Lovsangsgruppe", "Kjøkkentjeneste"
  GruppetypeID: string; // Ref: Gruppetyper.GruppetypeID
  GruppelederID?: string; // Ref: Personer.PersonID
  NestlederID?: string; // Ref: Personer.PersonID
  Beskrivelse: string;
  Aktiv: boolean;
  OpprettetDato: string;
  SistEndret: string;
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
  Behov: number; // Standardbehov for rollen per gudstjeneste
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
  Kollekt?: string;
  Merknad?: string;
}

export interface Tjenestebehov {
  TjenestebehovID: string; // e.g. "TB001"
  GudstjenesteID: string; // Ref: Gudstjenester.GudstjenesteID
  RolleID: string; // Ref: Roller.RolleID
  Antall: number; // Overstyrer Roller.Behov for denne gudstjenesten
  Aktiv: boolean;
  Notat?: string;
  OpprettetDato: string;
  SistEndret: string;
}

export interface Tildeling {
  TildelingID: string; // e.g. "T001"
  GudstjenesteID: string; // Ref: Gudstjenester.GudstjenesteID
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
  Tema: string;
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
  Status: ProgramStatus;
  PublisertDato?: string;
  PublisertAv?: string;
  OpprettetDato: string;
  SistEndret: string;
}
