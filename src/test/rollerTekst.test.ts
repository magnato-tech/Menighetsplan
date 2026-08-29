import assert from "node:assert/strict";
import {
  formatBidraRolle,
  formatBidraRoller,
  gjetBidraPreposisjon,
  hentBidraPreposisjon,
} from "../services/rollerTekst";
import type { Rolle } from "../types/database";

function rolle(over: Partial<Rolle> & Pick<Rolle, "Rollenavn">): Rolle {
  return {
    RolleID: "R999",
    Beskrivelse: "",
    Aktiv: true,
    Behov: 1,
    OpprettetDato: "2026-01-01",
    SistEndret: "2026-01-01",
    ...over,
  };
}

assert.equal(hentBidraPreposisjon(rolle({ Rollenavn: "Møteleder", BidraPreposisjon: "som" })), "som");
assert.equal(hentBidraPreposisjon(rolle({ Rollenavn: "Møteleder" })), "som");
assert.equal(gjetBidraPreposisjon({ Rollenavn: "Lyd" }), "på");
assert.equal(gjetBidraPreposisjon({ Rollenavn: "Barnekirke" }), "i");
assert.equal(gjetBidraPreposisjon({ Rollenavn: "Lovsang" }), "med");

assert.equal(formatBidraRolle(rolle({ Rollenavn: "Møteleder", BidraPreposisjon: "som" })), "som Møteleder");
assert.equal(formatBidraRolle(rolle({ Rollenavn: "Lovsang", BidraPreposisjon: "med" })), "med Lovsang");
assert.equal(formatBidraRolle(rolle({ Rollenavn: "Lyd", BidraPreposisjon: "på" })), "på Lyd");

assert.equal(
  formatBidraRoller([
    rolle({ Rollenavn: "Møteleder", BidraPreposisjon: "som" }),
    rolle({ Rollenavn: "Lovsang", BidraPreposisjon: "med" }),
  ]),
  "som Møteleder og med Lovsang"
);
assert.equal(formatBidraRoller([]), null);

console.log("rollerTekst.test.ts: ok");
