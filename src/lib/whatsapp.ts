import { formatPKR, whatsappNumber } from "@/lib/format";

// Click-to-chat link: opens WhatsApp with the message ready to send. It is the person's
// own tap that sends it; nothing is sent automatically. With no phone number, WhatsApp
// lets them pick who to send it to.
export function whatsappHref(phone: string | null | undefined, message: string) {
  const number = whatsappNumber(phone);
  return `https://wa.me/${number ?? ""}?text=${encodeURIComponent(message)}`;
}

const GREETING = "Assalam o Alaikum";

const clip = (text: string, max: number) => {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
};

// Everything below contains only what the client is allowed to see: progress, site updates
// and payments. Never expenses, so nothing hidden can leak through a message.

export function updateMessage(p: {
  clientName: string;
  companyName: string;
  projectName: string;
  text: string;
  photoCount: number;
  progress: number;
  link: string;
}) {
  const photos = p.photoCount > 0 ? `\n📷 ${p.photoCount} ${p.photoCount === 1 ? "photo" : "photos"}` : "";
  return (
    `${GREETING} ${p.clientName},\n\nNew update on ${p.projectName}:\n\n“${clip(p.text, 220)}”${photos}\n\n` +
    `Overall progress: ${p.progress}%\n\nSee the details here: ${p.link}\n\n– ${p.companyName}`
  );
}

export function progressMessage(p: {
  clientName: string;
  companyName: string;
  projectName: string;
  progress: number;
  currentStage: string | null;
  currentPercent: number | null;
  dueText: string | null;
  link: string;
}) {
  const stage =
    p.currentStage && p.currentPercent !== null ? `\nNow working on: ${p.currentStage} (${p.currentPercent}%)` : "";
  const due = p.dueText ? `\n${p.dueText}` : "";
  return (
    `${GREETING} ${p.clientName},\n\nProgress on ${p.projectName}: ${p.progress}% complete.${stage}${due}\n\n` +
    `Photos, payments and updates are all here: ${p.link}\n\n– ${p.companyName}`
  );
}

// A reminder to the other side, because there are no notifications yet.
export function paymentReminder(p: {
  to: string | null; // the person being asked to confirm, when we know their name
  from: string;
  recordedBy: "contractor" | "client";
  projectName: string;
  amount: number;
  date: string;
  link: string;
}) {
  const hello = p.to ? `${GREETING} ${p.to},` : `${GREETING},`;
  const what =
    p.recordedBy === "contractor"
      ? `I've recorded your payment of ${formatPKR(p.amount)} (${p.date}) for ${p.projectName}.`
      : `I've recorded a payment of ${formatPKR(p.amount)} (${p.date}) for ${p.projectName}.`;
  return `${hello}\n\n${what} Please confirm it here so we both have the same record: ${p.link}\n\n– ${p.from}`;
}
