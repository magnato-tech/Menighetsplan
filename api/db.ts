import { handleDbAction, type DbEnv } from "./dbCore";

export const config = { maxDuration: 60 };

function lesEnv(): DbEnv {
  return {
    supabaseUrl: String(process.env.SUPABASE_URL || "").trim(),
    supabaseKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
    googleClientId: String(
      process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || ""
    ).trim(),
    appsScriptUrl: String(
      process.env.APPS_SCRIPT_URL ||
        process.env.VITE_APPS_SCRIPT_URL ||
        "https://script.google.com/macros/s/AKfycbznLoq62orP53izSEA0wnA7VdQHiNWpP3upTo2nd1owcL3LDZp13gK8LxrAdsjxWwt7vw/exec"
    ).trim(),
    migrateFromSheets: String(process.env.MIGRATE_FROM_SHEETS || "").toLowerCase() === "true",
  };
}

async function lesBody(req: { body?: unknown }): Promise<unknown> {
  if (req.body == null || req.body === "") return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export default async function handler(
  req: { method?: string; body?: unknown },
  res: {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => { json: (body: unknown) => void };
  }
) {
  res.setHeader("Cache-Control", "no-store");
  if ((req.method || "GET").toUpperCase() !== "POST") {
    res.status(405).json({ ok: false, error: "Bruk POST." });
    return;
  }
  const body = await lesBody(req);
  const result = await handleDbAction(lesEnv(), body);
  res.status(result.status).json(result.body);
}
