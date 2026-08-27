const GAS_URL =
  process.env.APPS_SCRIPT_URL ||
  "https://script.google.com/macros/s/AKfycbznLoq62orP53izSEA0wnA7VdQHiNWpP3upTo2nd1owcL3LDZp13gK8LxrAdsjxWwt7vw/exec";

export const config = { maxDuration: 60 };

function tokenFra(req: { query?: Record<string, string | string[] | undefined>; url?: string }): string {
  const q = req.query?.t;
  if (typeof q === "string") return q.trim();
  if (Array.isArray(q) && q[0]) return String(q[0]).trim();
  try {
    const u = new URL(req.url || "", "https://gudstjenesteplanlegger2-0.vercel.app");
    return (u.searchParams.get("t") || "").trim();
  } catch {
    return "";
  }
}

export default async function handler(
  req: { query?: Record<string, string | string[] | undefined>; url?: string },
  res: {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => { send: (body: string) => void };
  }
) {
  const t = tokenFra(req);
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  if (!t) {
    res.status(400).send("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n");
    return;
  }
  const dest = `${GAS_URL.replace(/\/$/, "")}?action=minIcal&t=${encodeURIComponent(t)}`;
  try {
    const upstream = await fetch(dest, { redirect: "follow" });
    const ics = await upstream.text();
    res.status(upstream.ok ? 200 : 502).send(ics);
  } catch (err) {
    res.status(502).send(String(err));
  }
}
