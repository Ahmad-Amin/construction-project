// Demo mode is switched on by three server-only environment variables (see .env.example).
// They are never sent to the browser. Without them, no demo buttons appear.
export type DemoConfig = {
  contractorEmail: string;
  clientEmail: string;
  password: string;
};

export function getDemoConfig(): DemoConfig | null {
  const contractorEmail = process.env.DEMO_CONTRACTOR_EMAIL;
  const clientEmail = process.env.DEMO_CLIENT_EMAIL;
  const password = process.env.DEMO_PASSWORD;
  if (!contractorEmail || !clientEmail || !password) return null;
  return { contractorEmail, clientEmail, password };
}

export function isDemoEmail(email: string | undefined | null) {
  const demo = getDemoConfig();
  if (!demo || !email) return false;
  const e = email.toLowerCase();
  return e === demo.contractorEmail.toLowerCase() || e === demo.clientEmail.toLowerCase();
}
