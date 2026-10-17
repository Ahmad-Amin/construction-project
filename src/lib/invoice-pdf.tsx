import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatDate, formatMoney } from "@/lib/format";
import { invoiceNumber, type InvoiceView } from "@/lib/invoices";
import { PRODUCT_NAME } from "@/lib/site";
import { imageSource } from "@/lib/statement-pdf";

const ink = "#1c1917";
const muted = "#57534e";
const line = "#e7e5e4";
const amber = "#d97706";
const amberSoft = "#fdecc8";
const wash = "#fffbeb";
const red = "#b91c1c";

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingHorizontal: 40, paddingBottom: 64, fontFamily: "Helvetica", fontSize: 10, color: ink },
  header: { flexDirection: "row", justifyContent: "space-between", paddingBottom: 16, borderBottomWidth: 2, borderBottomColor: amber },
  brand: { flexDirection: "row", maxWidth: 320 },
  logo: { width: 44, height: 44, borderRadius: 6, objectFit: "contain", marginRight: 12 },
  logoFallback: { width: 44, height: 44, borderRadius: 6, backgroundColor: amberSoft, alignItems: "center", justifyContent: "center", marginRight: 12 },
  logoLetter: { fontSize: 20, fontFamily: "Helvetica-Bold", color: amber },
  company: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  details: { fontSize: 9, color: muted, marginTop: 3, lineHeight: 1.4 },
  docTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: amber, letterSpacing: 2, textAlign: "right" },
  number: { fontSize: 20, fontFamily: "Helvetica-Bold", textAlign: "right", marginTop: 4 },
  status: { fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "right", marginTop: 4 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginTop: 22, marginBottom: 22 },
  label: { fontSize: 8, color: muted, textTransform: "uppercase", letterSpacing: 0.8 },
  billName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 4 },
  small: { fontSize: 9, color: muted, marginTop: 2 },
  dates: { width: 200 },
  dateRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  th: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: line, paddingBottom: 6 },
  thText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: muted, textTransform: "uppercase", letterSpacing: 0.6 },
  tr: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: line },
  desc: { flexGrow: 1, flexShrink: 1, paddingRight: 12 },
  amount: { width: 130, textAlign: "right" },
  totals: { marginTop: 14, marginLeft: "auto", width: 240 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  grand: { flexDirection: "row", justifyContent: "space-between", backgroundColor: wash, borderRadius: 4, paddingVertical: 7, paddingHorizontal: 8, marginTop: 3 },
  grandText: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  boxes: { flexDirection: "row", marginTop: 28, paddingTop: 16, borderTopWidth: 1, borderTopColor: line },
  box: { flexGrow: 1, flexBasis: 0, paddingRight: 16 },
  boxText: { fontSize: 9.5, marginTop: 4, lineHeight: 1.45 },
  stamp: { position: "absolute", top: 330, left: 0, right: 0, textAlign: "center", fontSize: 72, fontFamily: "Helvetica-Bold", color: red, opacity: 0.12, transform: "rotate(-20deg)" },
  draftStamp: { position: "absolute", top: 330, left: 0, right: 0, textAlign: "center", fontSize: 72, fontFamily: "Helvetica-Bold", color: ink, opacity: 0.06, transform: "rotate(-20deg)" },
  footer: { position: "absolute", left: 40, right: 40, bottom: 28, borderTopWidth: 1, borderTopColor: line, paddingTop: 8 },
  footerText: { fontSize: 7.5, color: muted },
});

// The invoice as a PDF: the same content as the invoice page, for downloading, printing or forwarding.
export function InvoiceDocument({ invoice: v, logo }: { invoice: InvoiceView; logo: Buffer | null }) {
  const title = `Invoice ${invoiceNumber(v.number)}`;
  return (
    <Document title={title} author={v.company.name} subject={title}>
      <Page size="A4" style={s.page}>
        {v.status === "cancelled" ? <Text style={s.stamp} fixed>CANCELLED</Text> : null}
        {v.status === "draft" ? <Text style={s.draftStamp} fixed>DRAFT</Text> : null}

        <View style={s.header}>
          <View style={s.brand}>
            {logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an HTML <img>
              <Image src={imageSource(logo)} style={s.logo} />
            ) : (
              <View style={s.logoFallback}>
                <Text style={s.logoLetter}>{v.company.name.trim().charAt(0).toUpperCase() || "?"}</Text>
              </View>
            )}
            <View>
              <Text style={s.company}>{v.company.name}</Text>
              {v.company.details ? <Text style={s.details}>{v.company.details}</Text> : null}
            </View>
          </View>
          <View>
            <Text style={s.docTitle}>INVOICE</Text>
            <Text style={s.number}>{invoiceNumber(v.number)}</Text>
            {v.status === "cancelled" ? <Text style={[s.status, { color: red }]}>Cancelled</Text> : null}
          </View>
        </View>

        <View style={s.meta}>
          <View>
            <Text style={s.label}>Bill to</Text>
            <Text style={s.billName}>{v.client.name || "Client"}</Text>
            {v.client.email ? <Text style={s.small}>{v.client.email}</Text> : null}
            <Text style={s.small}>
              {v.project.name}
              {v.project.location ? ` · ${v.project.location}` : ""}
            </Text>
          </View>
          <View style={s.dates}>
            <View style={s.dateRow}>
              <Text style={{ color: muted }}>Invoice date</Text>
              <Text>{formatDate(v.issueDate)}</Text>
            </View>
            <View style={s.dateRow}>
              <Text style={{ color: muted }}>Due date</Text>
              <Text>{v.dueDate ? formatDate(v.dueDate) : "On receipt"}</Text>
            </View>
          </View>
        </View>

        <View style={s.th}>
          <Text style={[s.thText, s.desc]}>Description</Text>
          <Text style={[s.thText, s.amount]}>Amount</Text>
        </View>
        {v.lines.map((l, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <Text style={s.desc}>{l.description}</Text>
            <Text style={s.amount}>{formatMoney(l.amount, v.currency)}</Text>
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          <View style={s.totalRow}>
            <Text style={{ color: muted }}>Subtotal</Text>
            <Text>{formatMoney(v.subtotal, v.currency)}</Text>
          </View>
          {v.taxRate !== null ? (
            <View style={s.totalRow}>
              <Text style={{ color: muted }}>
                {v.taxLabel || "Tax"} ({v.taxRate}%)
              </Text>
              <Text>{formatMoney(v.taxAmount, v.currency)}</Text>
            </View>
          ) : null}
          <View style={s.grand}>
            <Text style={s.grandText}>Total due</Text>
            <Text style={s.grandText}>{formatMoney(v.total, v.currency)}</Text>
          </View>
        </View>

        {v.company.paymentInstructions || v.note ? (
          <View style={s.boxes} wrap={false}>
            {v.company.paymentInstructions ? (
              <View style={s.box}>
                <Text style={s.label}>How to pay</Text>
                <Text style={s.boxText}>{v.company.paymentInstructions}</Text>
              </View>
            ) : null}
            {v.note ? (
              <View style={s.box}>
                <Text style={s.label}>Note</Text>
                <Text style={s.boxText}>{v.note}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {v.status === "cancelled" && v.cancelReason ? (
          <Text style={[s.small, { marginTop: 16, color: red }]}>Cancelled: {v.cancelReason}</Text>
        ) : null}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            {v.company.name} · {invoiceNumber(v.number)} · Sent with {PRODUCT_NAME}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
