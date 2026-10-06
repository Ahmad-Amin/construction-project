import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatDate, formatPKR, formatTimestamp } from "@/lib/format";
import { projectStatusLabel } from "@/lib/project";
import { sideLabel } from "@/lib/payments";
import type { StatementData } from "@/lib/statement";

const ink = "#1c1917";
const muted = "#57534e";
const line = "#e7e5e4";
const amber = "#d97706";
const amberSoft = "#fdecc8";
const green = "#15803d";
const red = "#b91c1c";
const wash = "#f7f5f2";

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingHorizontal: 36, paddingBottom: 60, fontFamily: "Helvetica", fontSize: 9.5, color: ink },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: amber },
  brand: { flexDirection: "row", alignItems: "center" },
  logo: { width: 38, height: 38, borderRadius: 6, objectFit: "contain", marginRight: 10 },
  logoFallback: { width: 38, height: 38, borderRadius: 6, backgroundColor: amberSoft, alignItems: "center", justifyContent: "center", marginRight: 10 },
  logoLetter: { fontSize: 18, fontFamily: "Helvetica-Bold", color: amber },
  company: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  docTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: amber, letterSpacing: 1.4, textAlign: "right" },
  docDate: { fontSize: 9, color: muted, textAlign: "right", marginTop: 3 },
  title: { fontSize: 24, fontFamily: "Helvetica-Bold", marginTop: 20 },
  location: { fontSize: 11, color: muted, marginTop: 3 },
  facts: { flexDirection: "row", flexWrap: "wrap", marginTop: 14 },
  fact: { marginRight: 26, marginBottom: 6 },
  factLabel: { fontSize: 8, color: muted, textTransform: "uppercase", letterSpacing: 0.8 },
  factValue: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginTop: 2 },
  section: { marginTop: 22 },
  h2: { fontSize: 12.5, fontFamily: "Helvetica-Bold", paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: line, marginBottom: 10 },
  progressRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  bigPercent: { fontSize: 34, fontFamily: "Helvetica-Bold", width: 90 },
  track: { flexGrow: 1, height: 8, borderRadius: 4, backgroundColor: amberSoft },
  fill: { height: 8, borderRadius: 4, backgroundColor: amber },
  msRow: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  msName: { width: 130, fontSize: 9.5 },
  msTrack: { flexGrow: 1, height: 5, borderRadius: 3, backgroundColor: amberSoft, marginHorizontal: 8 },
  msFill: { height: 5, borderRadius: 3, backgroundColor: amber },
  msPercent: { width: 34, textAlign: "right", fontFamily: "Helvetica-Bold" },
  stats: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  stat: { width: "25%", paddingHorizontal: 4 },
  statBox: { backgroundColor: wash, borderRadius: 6, padding: 10 },
  statLabel: { fontSize: 8, color: muted },
  statValue: { fontSize: 12.5, fontFamily: "Helvetica-Bold", marginTop: 4 },
  statSub: { fontSize: 7.5, color: muted, marginTop: 3 },
  th: { flexDirection: "row", backgroundColor: wash, paddingVertical: 5, paddingHorizontal: 6, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  thText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: muted, textTransform: "uppercase", letterSpacing: 0.6 },
  tr: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: line },
  total: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 6, backgroundColor: wash, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  right: { textAlign: "right" },
  bold: { fontFamily: "Helvetica-Bold" },
  small: { fontSize: 8, color: muted, marginTop: 2 },
  update: { marginBottom: 9 },
  updateMeta: { fontSize: 8.5, color: muted, marginBottom: 2 },
  photos: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  photoBox: { width: "33.33%", paddingHorizontal: 4, marginBottom: 8 },
  photo: { width: "100%", height: 112, objectFit: "cover", borderRadius: 4 },
  photoDate: { fontSize: 7.5, color: muted, marginTop: 3 },
  footer: { position: "absolute", left: 36, right: 36, bottom: 24, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: line, paddingTop: 8 },
  footerText: { fontSize: 7.5, color: muted, maxWidth: 420 },
});

function imageSource(data: Buffer) {
  const isPng = data[0] === 0x89 && data[1] === 0x50;
  return { data, format: isPng ? ("png" as const) : ("jpg" as const) };
}

// A heading always travels with the first block under it (`lead`), so it can never be
// left alone at the bottom of a page.
function Section({ title, lead, children }: { title: string; lead?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <View style={s.section}>
      <View wrap={false}>
        <Text style={s.h2}>{title}</Text>
        {lead}
      </View>
      {children}
    </View>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <View style={s.stat}>
      <View style={s.statBox}>
        <Text style={s.statLabel}>{label}</Text>
        <Text style={[s.statValue, tone ? { color: tone } : {}]}>{value}</Text>
        {sub ? <Text style={s.statSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function paymentStatus(p: StatementData["payments"][number]) {
  if (p.status === "confirmed") {
    return { text: `Confirmed by ${p.respondedBy || "the other party"}`, sub: formatTimestamp(p.respondedAt), color: green };
  }
  if (p.status === "disputed") {
    return { text: "Disputed", sub: p.respondedBy ? `by ${p.respondedBy}` : "", color: red };
  }
  return { text: "Awaiting confirmation", sub: "", color: amber };
}

function PaymentRow({ payment: x }: { payment: StatementData["payments"][number] }) {
  const st = paymentStatus(x);
  return (
    <View style={s.tr} wrap={false}>
      <Text style={{ width: 62 }}>{formatDate(x.date)}</Text>
      <View style={{ flexGrow: 1, flexShrink: 1, paddingRight: 8 }}>
        <Text>{x.reference || (x.side === "contractor" ? "Payment received" : "Payment made")}</Text>
        <Text style={s.small}>Recorded by {x.by || sideLabel[x.side]} ({sideLabel[x.side].toLowerCase()})</Text>
      </View>
      <View style={{ width: 150 }}>
        <Text style={{ color: st.color, fontFamily: "Helvetica-Bold" }}>{st.text}</Text>
        {st.sub ? <Text style={s.small}>{st.sub}</Text> : null}
      </View>
      <Text style={[s.right, s.bold, { width: 86 }]}>{formatPKR(x.amount)}</Text>
    </View>
  );
}

function ExpenseRow({ expense: e }: { expense: StatementData["expenses"][number] }) {
  return (
    <View style={s.tr} wrap={false}>
      <Text style={{ width: 62 }}>{formatDate(e.date)}</Text>
      <Text style={{ width: 76 }}>{e.category}</Text>
      <Text style={{ flexGrow: 1, flexShrink: 1, paddingRight: 8 }}>
        {e.note || e.category}
        {e.receipt ? "  (receipt on file)" : ""}
      </Text>
      <Text style={[s.right, s.bold, { width: 86 }]}>{formatPKR(e.amount)}</Text>
    </View>
  );
}

function UpdateItem({ update: u }: { update: StatementData["updates"][number] }) {
  return (
    <View style={s.update} wrap={false}>
      <Text style={s.updateMeta}>
        {formatDate(u.date)}
        {u.author ? `  ·  ${u.author}` : ""}
        {u.milestone ? `  ·  ${u.milestone}` : ""}
        {u.photos > 0 ? `  ·  ${u.photos} ${u.photos === 1 ? "photo" : "photos"}` : ""}
      </Text>
      <Text>{u.text}</Text>
    </View>
  );
}

function PhotoRow({ photos }: { photos: StatementData["photos"] }) {
  return (
    <View style={s.photos} wrap={false}>
      {photos.map((ph, i) => (
        <View key={i} style={s.photoBox}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an HTML <img> */}
          <Image src={imageSource(ph.image)} style={s.photo} />
          {ph.date ? <Text style={s.photoDate}>{formatDate(ph.date)}</Text> : null}
        </View>
      ))}
    </View>
  );
}

export function StatementDocument({ data }: { data: StatementData }) {
  const { project: p, money } = data;

  return (
    <Document title={`${p.name} – project statement`} author={data.company.name} subject="Project statement">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.brand}>
            {data.company.logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image, not an HTML <img>
              <Image src={imageSource(data.company.logo)} style={s.logo} />
            ) : (
              <View style={s.logoFallback}>
                <Text style={s.logoLetter}>{data.company.name.trim().charAt(0).toUpperCase() || "?"}</Text>
              </View>
            )}
            <Text style={s.company}>{data.company.name}</Text>
          </View>
          <View>
            <Text style={s.docTitle}>PROJECT STATEMENT</Text>
            <Text style={s.docDate}>As of {formatDate(data.generatedOn)}</Text>
          </View>
        </View>

        <Text style={s.title}>{p.name}</Text>
        {p.location ? <Text style={s.location}>{p.location}</Text> : null}

        <View style={s.facts}>
          {data.clientName ? (
            <View style={s.fact}>
              <Text style={s.factLabel}>Client</Text>
              <Text style={s.factValue}>{data.clientName}</Text>
            </View>
          ) : null}
          <View style={s.fact}>
            <Text style={s.factLabel}>Status</Text>
            <Text style={s.factValue}>{projectStatusLabel[p.status]}</Text>
          </View>
          {p.startDate ? (
            <View style={s.fact}>
              <Text style={s.factLabel}>Started</Text>
              <Text style={s.factValue}>{formatDate(p.startDate)}</Text>
            </View>
          ) : null}
          {p.expectedCompletion ? (
            <View style={s.fact}>
              <Text style={s.factLabel}>Expected completion</Text>
              <Text style={s.factValue}>{formatDate(p.expectedCompletion)}</Text>
            </View>
          ) : null}
        </View>

        <Section title="Progress">
          <View style={s.progressRow}>
            <Text style={s.bigPercent}>{data.progress}%</Text>
            <View style={s.track}>
              <View style={[s.fill, { width: `${data.progress}%` }]} />
            </View>
          </View>
          {data.milestones.map((m) => (
            <View key={m.name} style={s.msRow} wrap={false}>
              <Text style={s.msName}>{m.name}</Text>
              <View style={s.msTrack}>
                <View style={[s.msFill, { width: `${m.percent}%` }]} />
              </View>
              <Text style={s.msPercent}>{m.percent}%</Text>
            </View>
          ))}
        </Section>

        <Section title="Money">
          <View style={s.stats}>
            {data.budget !== null ? <Stat label="Budget" value={formatPKR(data.budget)} /> : null}
            <Stat label="Payments confirmed" value={formatPKR(money.received)} tone={green} sub="Acknowledged by both sides" />
            <Stat
              label="Awaiting confirmation"
              value={formatPKR(money.pending)}
              sub={money.disputedCount > 0 ? `${money.disputedCount} disputed, not counted` : undefined}
            />
            <Stat label="Expenses shared" value={formatPKR(money.expensesTotal)} sub={`${money.expensesCount} ${money.expensesCount === 1 ? "item" : "items"}`} />
          </View>
        </Section>

        <Section
          title="Payments"
          lead={
            data.payments.length === 0 ? (
              <Text style={{ color: muted }}>No payments recorded yet.</Text>
            ) : (
              <View>
                <View style={s.th}>
                  <Text style={[s.thText, { width: 62 }]}>Date</Text>
                  <Text style={[s.thText, { flexGrow: 1 }]}>Reference</Text>
                  <Text style={[s.thText, { width: 150 }]}>Status</Text>
                  <Text style={[s.thText, s.right, { width: 86 }]}>Amount</Text>
                </View>
                <PaymentRow payment={data.payments[0]} />
              </View>
            )
          }
        >
          {data.payments.length > 0 ? (
            <View>
              {data.payments.slice(1).map((x, i) => (
                <PaymentRow key={i} payment={x} />
              ))}
              <View style={s.total} wrap={false}>
                <Text style={[s.bold, { flexGrow: 1 }]}>Total confirmed</Text>
                <Text style={[s.right, s.bold, { width: 120, color: green }]}>{formatPKR(money.received)}</Text>
              </View>
            </View>
          ) : null}
        </Section>

        <Section
          title="Expenses shared with you"
          lead={
            data.expenses.length === 0 ? (
              <Text style={{ color: muted }}>No expenses have been shared yet.</Text>
            ) : (
              <View>
                <View style={s.th}>
                  <Text style={[s.thText, { width: 62 }]}>Date</Text>
                  <Text style={[s.thText, { width: 76 }]}>Category</Text>
                  <Text style={[s.thText, { flexGrow: 1 }]}>Vendor or note</Text>
                  <Text style={[s.thText, s.right, { width: 86 }]}>Amount</Text>
                </View>
                <ExpenseRow expense={data.expenses[0]} />
              </View>
            )
          }
        >
          {data.expenses.length > 0 ? (
            <View>
              {data.expenses.slice(1).map((e, i) => (
                <ExpenseRow key={i} expense={e} />
              ))}
              <View style={s.total} wrap={false}>
                <Text style={[s.bold, { flexGrow: 1 }]}>Total shared</Text>
                <Text style={[s.right, s.bold, { width: 120 }]}>{formatPKR(money.expensesTotal)}</Text>
              </View>
              {data.expensesByCategory.length > 1 ? (
                <Text style={[s.small, { marginTop: 8 }]}>
                  By category: {data.expensesByCategory.map((c) => `${c.category} ${formatPKR(c.total)}`).join("  ·  ")}
                </Text>
              ) : null}
            </View>
          ) : null}
        </Section>

        {data.updates.length > 0 ? (
          <Section title="Recent site updates" lead={<UpdateItem update={data.updates[0]} />}>
            {data.updates.slice(1).map((u, i) => (
              <UpdateItem key={i} update={u} />
            ))}
          </Section>
        ) : null}

        {data.photos.length > 0 ? (
          <Section title="Recent site photos" lead={<PhotoRow photos={data.photos.slice(0, 3)} />}>
            {data.photos.length > 3 ? <PhotoRow photos={data.photos.slice(3)} /> : null}
          </Section>
        ) : null}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            Prepared by {data.company.name} using Client Portal. This statement shows the records shared with the client.
            Payments marked Confirmed were acknowledged by both parties.
          </Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
