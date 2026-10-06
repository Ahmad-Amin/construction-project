// Builds (or rebuilds) the sample "Ahmed Residence, DHA Lahore" project for demos.
//
//   npm run seed:demo
//
// Needs these in .env.local (see .env.example):
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
//   SUPABASE_SECRET_KEY, DEMO_CONTRACTOR_EMAIL, DEMO_CLIENT_EMAIL, DEMO_PASSWORD
//
// The secret key is used for exactly two things: creating the two demo logins, and
// back-dating timestamps so the history looks lived-in. Everything else is done by
// signing in as the demo contractor and the demo homeowner, so the sample data goes
// through the same row-level security and business rules as real data.
//
// Running it again wipes the demo company's projects and rebuilds them, so you can
// reset the demo before every pitch. It only ever touches the demo contractor's company.
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { receiptImage, sitePhoto } from "./demo-images.mjs";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Variables may already be set in the environment.
}

const env = process.env;
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "DEMO_CONTRACTOR_EMAIL",
  "DEMO_CLIENT_EMAIL",
  "DEMO_PASSWORD",
];
const missing = required.filter((k) => !env[k]);
if (missing.length) {
  console.error(`Missing in .env.local: ${missing.join(", ")}\nSee .env.example for what each one is.`);
  process.exit(1);
}
if (env.DEMO_PASSWORD.length < 10) {
  console.error("DEMO_PASSWORD should be at least 10 characters.");
  process.exit(1);
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const noSession = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL, env.SUPABASE_SECRET_KEY, noSession);

const CONTRACTOR = { email: env.DEMO_CONTRACTOR_EMAIL, name: "Usman Rehman" };
const HOMEOWNER = { email: env.DEMO_CLIENT_EMAIL, name: "Ahmed Khan", phone: "0300 1234567" };
const COMPANY = "Rehman Builders";

// --------------------------------------------------------------------------- helpers
const log = (msg) => console.log(`• ${msg}`);

function must(result, what) {
  if (result.error) {
    throw new Error(`${what}: ${result.error.message}`);
  }
  return result.data;
}

const karachiDate = (daysAgo) =>
  new Date(Date.now() - daysAgo * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
const stamp = (daysAgo, hhmm) => `${karachiDate(daysAgo)}T${hhmm}:00+05:00`;

async function signIn(email) {
  const client = createClient(URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, noSession);
  const { error } = await client.auth.signInWithPassword({ email, password: env.DEMO_PASSWORD });
  if (error) throw new Error(`Could not sign in as ${email}: ${error.message}`);
  return client;
}

async function ensureUser({ email, name }) {
  const list = must(await admin.auth.admin.listUsers({ page: 1, perPage: 1000 }), "list users");
  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    must(
      await admin.auth.admin.updateUserById(existing.id, {
        password: env.DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { name },
      }),
      `update ${email}`,
    );
    await admin.from("profiles").update({ name }).eq("id", existing.id);
    return existing.id;
  }

  const created = must(
    await admin.auth.admin.createUser({
      email,
      password: env.DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { name },
    }),
    `create ${email}`,
  );
  return created.user.id;
}

async function removeFolder(bucket, prefix) {
  const store = admin.storage.from(bucket);
  const { data } = await store.list(prefix, { limit: 1000 });
  const files = [];
  for (const entry of data ?? []) {
    if (entry.id === null) await removeFolder(bucket, `${prefix}/${entry.name}`);
    else files.push(`${prefix}/${entry.name}`);
  }
  if (files.length) await store.remove(files);
}

async function wipeDemo(contractorId) {
  const companies = must(await admin.from("companies").select("id").eq("owner_id", contractorId), "find demo company");
  for (const { id: companyId } of companies) {
    const projects = must(await admin.from("projects").select("id").eq("company_id", companyId), "find projects");
    for (const { id } of projects) await removeFolder("project-media", id);
    if (projects.length) {
      must(await admin.from("projects").delete().in("id", projects.map((p) => p.id)), "delete projects");
    }
    must(await admin.from("clients").delete().eq("company_id", companyId), "delete clients");
    must(await admin.from("companies").delete().eq("id", companyId), "delete company");
  }
  if (companies.length) log("Removed the previous demo project");
}

async function uploadJpeg(client, path, buffer) {
  const { error } = await client.storage
    .from("project-media")
    .upload(path, buffer, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
}

// --------------------------------------------------------------------------- the story
// Everything is dated relative to today, so the demo always looks current.
const MILESTONES = ["Foundation", "Grey Structure", "Electrical", "Plumbing", "Finishing"];

const UPDATES = [
  { ago: 230, time: "09:40", milestone: "Foundation", progress: 20,
    text: "Site cleared and boundary pillars marked. Excavation machinery arrives tomorrow.",
    photos: [{ stage: "cleared", caption: "Plot cleared and marked out" }, { stage: "cleared", variant: 2, caption: "Boundary pegs and string lines" }] },
  { ago: 210, time: "17:10", milestone: "Foundation", progress: 60,
    text: "Excavation complete. PCC poured and the foundation steel is being tied.",
    photos: [{ stage: "excavation", caption: "Excavation complete" }, { stage: "excavation", variant: 1, caption: "PCC poured in the trenches" }, { stage: "foundation", variant: 3, caption: "Foundation steel being tied" }] },
  { ago: 187, time: "12:25", milestone: "Foundation", progress: 100,
    text: "Foundation concrete poured and cured. Plinth beam finished. Ready to start the grey structure.",
    photos: [{ stage: "foundation", caption: "Foundation poured and cured" }, { stage: "foundation", variant: 1, caption: "Plinth level" }, { stage: "columns", variant: 2, caption: "Column starter bars in place" }] },
  { ago: 139, time: "11:05", milestone: "Grey Structure", progress: 30,
    text: "Ground floor columns up and brickwork started. About 30% of the ground floor walls done.",
    photos: [{ stage: "columns", caption: "Ground floor columns" }, { stage: "brickwork", variant: 1, caption: "Brickwork under way" }, { stage: "materials", variant: 2, caption: "Bricks delivered to site" }] },
  { ago: 100, time: "16:30", milestone: "Grey Structure", progress: 60,
    text: "Ground floor walls complete. Roof slab shuttering done and steel laid. Concrete is booked for this week.",
    photos: [{ stage: "brickwork", caption: "Ground floor walls complete" }, { stage: "slab", variant: 1, caption: "Shuttering and props" }, { stage: "slab", variant: 3, caption: "Slab steel laid" }] },
  { ago: 74, time: "14:15", milestone: "Grey Structure", progress: 70,
    text: "Ground floor roof slab cast today. Curing for the next 14 days, so no loading on it until then.",
    photos: [{ stage: "slab", caption: "Roof slab cast" }, { stage: "slab", variant: 2, caption: "Slab finishing" }, { stage: "floors", variant: 1, caption: "View from the plot corner" }, { stage: "materials", variant: 3, caption: "Cement and sand on site" }] },
  { ago: 42, time: "10:20", milestone: "Electrical", progress: 40,
    text: "Electrical conduiting has started on the ground floor. Boxes and main runs are in.",
    photos: [{ stage: "electrical", caption: "Conduit and junction boxes" }, { stage: "electrical", variant: 2, caption: "Main run to the DB position" }] },
  { ago: 24, time: "15:45", milestone: "Grey Structure", progress: 85,
    text: "First floor columns are up and brickwork is under way. Scaffolding is in place.",
    photos: [{ stage: "floors", caption: "First floor brickwork" }, { stage: "floors", variant: 2, caption: "Scaffolding in place" }, { stage: "columns", variant: 1, caption: "First floor columns" }] },
  { ago: 18, time: "13:10", milestone: "Plumbing", progress: 35,
    text: "Water supply and drain lines laid for the ground floor bathrooms and kitchen. Pressure test passed.",
    photos: [{ stage: "plumbing", caption: "Supply lines in the bathroom" }, { stage: "plumbing", variant: 1, caption: "Pressure test passed" }] },
  { ago: 4, time: "10:05", milestone: null, progress: null,
    text: "Plastering starts next week once conduiting is signed off. Materials have been ordered.",
    photos: [{ stage: "materials", caption: "Plaster materials ordered" }] },
];

const EXPENSES = [
  { ago: 224, category: "labour", note: "Excavation and site preparation crew", amount: 650_000, shared: true },
  { ago: 215, category: "material", note: "Steel bars, 12 tons, Ittefaq Steel", amount: 3_420_000, shared: true,
    receipt: { vendor: "Ittefaq Steel Traders", address: "Badami Bagh, Lahore", invoice: "IST-20418",
      lines: [{ desc: "Steel bars Grade 60", qty: "12 tons", rate: 285_000, amount: 3_420_000 }] } },
  { ago: 208, category: "material", note: "Cement, 900 bags, Al-Madina Cement Agency", amount: 1_440_000, shared: true,
    receipt: { vendor: "Al-Madina Cement Agency", address: "G.T. Road, Shahdara, Lahore", invoice: "AMC-7731",
      lines: [{ desc: "Cement 50 kg bags", qty: "900 bags", rate: 1_600, amount: 1_440_000 }] } },
  { ago: 200, category: "labour", note: "Foundation crew: masons and helpers", amount: 1_100_000, shared: true },
  { ago: 171, category: "material", note: "Bricks, 60,000, Bismillah Brick Kiln", amount: 1_080_000, shared: true,
    receipt: { vendor: "Bismillah Brick Kiln", address: "Raiwind Road, Lahore", invoice: "BBK-1204",
      lines: [{ desc: "First-class bricks", qty: "60,000", rate: 18, amount: 1_080_000 }] } },
  { ago: 145, category: "transport", note: "Sand and crush delivery", amount: 460_000, shared: true },
  { ago: 126, category: "equipment", note: "Shuttering and scaffolding rental", amount: 780_000, shared: false },
  { ago: 108, category: "labour", note: "Grey structure crew, June", amount: 1_850_000, shared: true },
  { ago: 90, category: "material", note: "Steel bars for the roof slab, 10 tons", amount: 2_950_000, shared: true,
    receipt: { vendor: "Ittefaq Steel Traders", address: "Badami Bagh, Lahore", invoice: "IST-21377",
      lines: [{ desc: "Steel bars Grade 60", qty: "10 tons", rate: 295_000, amount: 2_950_000 }] } },
  { ago: 76, category: "material", note: "Ready-mix concrete for the roof slab", amount: 1_720_000, shared: true,
    receipt: { vendor: "Metro Ready Mix", address: "Ferozepur Road, Lahore", invoice: "MRM-5590",
      lines: [{ desc: "Ready-mix concrete M25", qty: "62 m3", rate: 24_000, amount: 1_488_000 },
              { desc: "Pump and placing charges", qty: "1", rate: 232_000, amount: 232_000 }] } },
  { ago: 47, category: "material", note: "Electrical conduit, wiring and boards", amount: 1_340_000, shared: true,
    receipt: { vendor: "Pak Electric Store", address: "Brandreth Road, Lahore", invoice: "PES-33821",
      lines: [{ desc: "Conduit pipes and fittings", qty: "1 lot", rate: 420_000, amount: 420_000 },
              { desc: "Copper wire 1.5/2.5/4 mm", qty: "1 lot", rate: 690_000, amount: 690_000 },
              { desc: "Distribution boards", qty: "5", rate: 46_000, amount: 230_000 }] } },
  { ago: 21, category: "subcontractor", note: "Plumbing subcontractor, advance", amount: 900_000, shared: true },
  { ago: 14, category: "other", note: "Site office, security and sundries", amount: 240_000, shared: false },
];

// Recorded by the contractor, then confirmed by the homeowner.
const CONFIRMED_PAYMENTS = [
  { ago: 228, amount: 7_000_000, reference: "Bank transfer, HBL ref 884213", note: "Booking advance on signing the contract" },
  { ago: 179, amount: 8_000_000, reference: "Cheque 004512, Meezan Bank", note: "Foundation complete" },
  { ago: 103, amount: 6_500_000, reference: "Bank transfer, ref 99217", note: "Grey structure, first stage" },
];
// Recorded by the homeowner and left waiting, to show the two-sided confirmation.
const PENDING_PAYMENT = {
  ago: 8, amount: 4_000_000, reference: "Bank transfer, ref 55201",
  note: "Roof slab stage. Please confirm once it shows in your account.",
};

// --------------------------------------------------------------------------- run
async function main() {
  console.log(`\nBuilding the demo in ${URL}\n`);

  const contractorId = await ensureUser(CONTRACTOR);
  await ensureUser(HOMEOWNER);
  log(`Demo logins ready: ${CONTRACTOR.email} and ${HOMEOWNER.email}`);

  await wipeDemo(contractorId);

  const contractor = await signIn(CONTRACTOR.email);
  const homeowner = await signIn(HOMEOWNER.email);

  // Company, project, client, budget and milestones.
  must(await contractor.rpc("create_company", { p_name: COMPANY }), "create company");
  const projectId = must(
    await contractor.rpc("create_project", {
      p_name: "Ahmed Residence",
      p_location: "Phase 6, DHA Lahore",
      p_start_date: karachiDate(232),
      p_expected_completion_date: karachiDate(-175),
      p_budget: 35_000_000,
      p_client_name: HOMEOWNER.name,
      p_client_email: HOMEOWNER.email,
      p_client_phone: HOMEOWNER.phone,
      p_milestones: MILESTONES,
    }),
    "create project",
  );
  must(
    await contractor.from("project_budgets").update({ visible_to_client: true }).eq("project_id", projectId),
    "share budget",
  );
  log("Created Ahmed Residence, DHA Lahore (budget PKR 35,000,000)");

  // Back-date the project itself so its start date and history agree.
  await admin.from("projects").update({ created_at: stamp(232, "10:00") }).eq("id", projectId);

  // Homeowner accepts the invite, exactly as they would from the WhatsApp link.
  const clientId = must(await contractor.from("projects").select("client_id").eq("id", projectId).single(), "read client").client_id;
  const token = must(await contractor.rpc("get_client_invite_token", { p_client_id: clientId }), "invite token");
  must(await homeowner.rpc("accept_invite", { p_token: token }), "accept invite");
  log("Homeowner joined through the invite");

  const milestones = must(
    await contractor.from("milestones").select("id, name").eq("project_id", projectId),
    "read milestones",
  );
  const milestoneId = Object.fromEntries(milestones.map((m) => [m.name, m.id]));

  // Site updates with photos, oldest first so progress builds up the way it would in life.
  for (const u of UPDATES) {
    const updateId = randomUUID();
    const photos = [];
    for (const p of u.photos) {
      const { full, thumb } = await sitePhoto(p);
      const base = `${projectId}/updates/${updateId}/${randomUUID()}`;
      await uploadJpeg(contractor, `${base}.jpg`, full);
      await uploadJpeg(contractor, `${base}_thumb.jpg`, thumb);
      photos.push({ path: `${base}.jpg`, thumb: `${base}_thumb.jpg` });
    }
    must(
      await contractor.rpc("create_update", {
        p_id: updateId,
        p_project_id: projectId,
        p_date: karachiDate(u.ago),
        p_text: u.text,
        p_milestone_id: u.milestone ? milestoneId[u.milestone] : null,
        p_progress: u.milestone ? u.progress : null,
        p_photos: photos,
      }),
      "post update",
    );
    await admin.from("project_updates").update({ created_at: stamp(u.ago, u.time) }).eq("id", updateId);
    await admin.from("project_photos").update({ created_at: stamp(u.ago, u.time) }).eq("update_id", updateId);
  }
  log(`Posted ${UPDATES.length} site updates with photos`);

  // Expenses, some with receipts, two kept private to the contractor.
  for (const e of EXPENSES) {
    const id = randomUUID();
    let receiptPath = null;
    if (e.receipt) {
      const total = e.receipt.lines.reduce((sum, l) => sum + l.amount, 0);
      if (total !== e.amount) throw new Error(`Receipt for "${e.note}" adds up to ${total}, not ${e.amount}`);
      const image = await receiptImage({
        ...e.receipt,
        // karachiDate is a plain calendar day, so format it as UTC to avoid a timezone shift.
        date: new Date(karachiDate(e.ago)).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }),
        total: e.amount,
      });
      receiptPath = `${projectId}/receipts/${id}/receipt.jpg`;
      await uploadJpeg(contractor, receiptPath, image);
    }
    must(
      await contractor.from("expenses").insert({
        id,
        project_id: projectId,
        amount: e.amount,
        expense_date: karachiDate(e.ago),
        category: e.category,
        vendor_note: e.note,
        receipt_path: receiptPath,
        client_visible: e.shared,
      }),
      "add expense",
    );
    await admin.from("expenses").update({ created_at: stamp(e.ago, "15:30") }).eq("id", id);
  }
  log(`Recorded ${EXPENSES.length} expenses (${EXPENSES.filter((e) => !e.shared).length} hidden from the client)`);

  // Payments: three the contractor recorded and the homeowner confirmed.
  for (const p of CONFIRMED_PAYMENTS) {
    const id = randomUUID();
    must(
      await contractor.from("payments").insert({
        id, project_id: projectId, amount: p.amount, payment_date: karachiDate(p.ago),
        reference: p.reference, note: p.note,
      }),
      "record payment",
    );
    must(await homeowner.rpc("respond_to_payment", { p_payment_id: id, p_action: "confirm", p_reason: "" }), "confirm payment");
    await admin
      .from("payments")
      .update({ created_at: stamp(p.ago, "12:00"), responded_at: stamp(Math.max(p.ago - 1, 0), "11:15") })
      .eq("id", id);
  }

  // ...and one the homeowner recorded that is still waiting for the contractor.
  const pendingId = randomUUID();
  must(
    await homeowner.from("payments").insert({
      id: pendingId, project_id: projectId, amount: PENDING_PAYMENT.amount,
      payment_date: karachiDate(PENDING_PAYMENT.ago), reference: PENDING_PAYMENT.reference, note: PENDING_PAYMENT.note,
    }),
    "homeowner payment",
  );
  await admin.from("payments").update({ created_at: stamp(PENDING_PAYMENT.ago, "18:30") }).eq("id", pendingId);
  log(`Recorded ${CONFIRMED_PAYMENTS.length} confirmed payments and 1 waiting for the contractor`);

  // ----------------------------------------------------------------- self-check
  // Look at the project as the homeowner and make sure nothing private leaked.
  const sharedCount = EXPENSES.filter((e) => e.shared).length;
  const sharedTotal = EXPENSES.filter((e) => e.shared).reduce((s, e) => s + e.amount, 0);

  const seenProjects = must(await homeowner.from("projects").select("id"), "homeowner projects");
  const seenExpenses = must(await homeowner.from("expenses").select("id, amount"), "homeowner expenses");
  const seenBudget = must(await homeowner.from("project_budgets").select("amount"), "homeowner budget");
  const seenTotals = must(await homeowner.rpc("project_expense_totals", { p_project_id: projectId }), "homeowner totals")[0];
  const seenPayments = must(await homeowner.from("payments").select("id"), "homeowner payments");
  const timeline = must(await homeowner.rpc("project_timeline", { p_project_id: projectId, p_limit: 200 }), "homeowner timeline");

  const checks = [
    ["Homeowner sees exactly 1 project", seenProjects.length === 1],
    [`Homeowner sees only the ${sharedCount} shared expenses`, seenExpenses.length === sharedCount],
    ["Homeowner's expense total excludes hidden expenses", Number(seenTotals.total) === sharedTotal],
    ["Homeowner sees the shared budget", seenBudget.length === 1],
    ["Homeowner sees all 4 payments", seenPayments.length === 4],
    ["Hidden expenses are missing from the homeowner's timeline",
      timeline.filter((t) => t.kind === "expense").length === sharedCount],
  ];
  let failed = false;
  for (const [label, ok] of checks) {
    console.log(`  ${ok ? "✔" : "✘"} ${label}`);
    if (!ok) failed = true;
  }
  if (failed) throw new Error("A privacy self-check failed. Do not use this database for demos until it is fixed.");

  console.log(`
Done. Try it:
  Contractor: ${CONTRACTOR.email}
  Homeowner:  ${HOMEOWNER.email}
  (password is DEMO_PASSWORD from .env.local)
`);
}

main().catch((err) => {
  console.error(`\n✘ ${err.message}`);
  process.exit(1);
});
