// Creates the WhatsApp message templates in your WhatsApp Business Account, or shows their status.
//
//   npm run whatsapp:templates            create the ones that don't exist yet
//   npm run whatsapp:templates -- --status   show every template and whether Meta approved it
//   npm run whatsapp:templates -- --env .env.whatsapp-prod   read the values from another file
//
// Needs WHATSAPP_BUSINESS_ACCOUNT_ID and WHATSAPP_ACCESS_TOKEN in .env.local (or in the file given
// with --env, which is read instead; use it for the real account so its token never goes into
// .env.local, and keep that file out of git: every .env* file is ignored already). The wording lives
// in src/lib/whatsapp-templates.json. Meta reviews each new template (usually within minutes
// for these simple utility messages); until it says APPROVED, that message can't be sent.
// Approved templates can't be edited: to change the wording, give the template a new name.
import { readFileSync } from "node:fs";

const envFlag = process.argv.indexOf("--env");
const envFile = envFlag !== -1 ? process.argv[envFlag + 1] : ".env.local";
if (envFlag !== -1 && !envFile) {
  console.error("--env needs a file name, for example --env .env.whatsapp-prod");
  process.exit(1);
}
try {
  process.loadEnvFile(envFile);
} catch {
  if (envFlag !== -1) {
    console.error(`Could not read ${envFile}.`);
    process.exit(1);
  }
  // Otherwise the variables may already be set in the environment.
}

const env = process.env;
if (!env.WHATSAPP_BUSINESS_ACCOUNT_ID || !env.WHATSAPP_ACCESS_TOKEN) {
  console.error(`Missing WHATSAPP_BUSINESS_ACCOUNT_ID or WHATSAPP_ACCESS_TOKEN in ${envFile}.`);
  process.exit(1);
}

const base = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION || "v23.0"}/${env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`;
const headers = { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" };
const language = env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US";
const templates = JSON.parse(readFileSync(new URL("../src/lib/whatsapp-templates.json", import.meta.url), "utf8"));

async function existing() {
  const response = await fetch(`${base}?fields=name,status,language,category,rejected_reason&limit=200`, { headers });
  const json = await response.json();
  if (!response.ok) {
    console.error("Could not read templates:", json.error?.message ?? response.status);
    process.exit(1);
  }
  return json.data;
}

const current = await existing();

if (process.argv.includes("--status")) {
  for (const name of Object.keys(templates)) {
    const t = current.find((c) => c.name === name && c.language === language);
    console.log(`${name.padEnd(20)} ${t ? `${t.status} (${t.category})${t.rejected_reason && t.rejected_reason !== "NONE" ? ` · ${t.rejected_reason}` : ""}` : "not created yet"}`);
  }
  process.exit(0);
}

for (const [name, { body, example }] of Object.entries(templates)) {
  if (current.some((c) => c.name === name && c.language === language)) {
    console.log(`${name.padEnd(20)} already exists, skipped`);
    continue;
  }
  const response = await fetch(base, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name,
      language,
      category: "UTILITY",
      components: [{ type: "BODY", text: body, example: { body_text: [example] } }],
    }),
  });
  const json = await response.json();
  console.log(
    `${name.padEnd(20)} ${response.ok ? `created (${json.status ?? "PENDING"}, ${json.category ?? "UTILITY"})` : `FAILED: ${json.error?.error_user_msg ?? json.error?.message ?? response.status}`}`,
  );
}
console.log("\nRun with --status in a few minutes to see whether Meta approved them.");
