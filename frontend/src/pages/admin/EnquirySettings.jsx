import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Mail, Send } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { api, errMsg, fmtDateTime } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { PageHead, TextIn, AreaIn, SelectIn, CheckIn, Tag } from "../../components/admin/Kit";

// Common providers: picking one fills in the server, port and security.
const PRESETS = [
  ["", "Choose your email provider…"],
  ["gmail", "Gmail / Google Workspace", { host: "smtp.gmail.com", port: 587, security: "starttls" }, "Use an App Password (Google Account → Security → 2-Step Verification → App passwords), not your normal password."],
  ["zoho", "Zoho Mail (India)", { host: "smtp.zoho.in", port: 465, security: "ssl" }, "Use smtp.zoho.com instead if your Zoho account is not on the India data centre."],
  ["outlook", "Microsoft 365 / Outlook", { host: "smtp.office365.com", port: 587, security: "starttls" }, "SMTP sending (SMTP AUTH) must be allowed for the mailbox in Microsoft 365 admin."],
  ["hostinger", "Hostinger email", { host: "smtp.hostinger.com", port: 465, security: "ssl" }, "Use the full email address as the username."],
  ["godaddy", "GoDaddy / Titan email", { host: "smtp.titan.email", port: 465, security: "ssl" }, ""],
  ["ses", "Amazon SES (Mumbai)", { host: "email-smtp.ap-south-1.amazonaws.com", port: 587, security: "starttls" }, "Use the SES SMTP credentials, and a verified “From” address."],
  ["brevo", "Brevo (Sendinblue)", { host: "smtp-relay.brevo.com", port: 587, security: "starttls" }, "Use the SMTP key from Brevo → SMTP & API as the password."],
  ["other", "Other (enter details yourself)", null, ""],
];

const Section = ({ title, desc, children, testid }) => (
  <section className="bg-white border p-4 md:p-5 mb-6" data-testid={testid}>
    <h2 className="font-semibold text-base">{title}</h2>
    {desc && <p className="text-sm text-muted-foreground mb-4 mt-0.5">{desc}</p>}
    {children}
  </section>
);

export default function EnquirySettings() {
  const { can, user } = useAuth();
  const [s, setS] = useState(null);
  const [password, setPassword] = useState("");
  const [recipients, setRecipients] = useState("");
  const [preset, setPreset] = useState("");
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState("");
  const [dirty, setDirty] = useState(false);

  const apply = (data) => { setS(data); setRecipients((data.recipients || []).join(", ")); setPassword(""); setDirty(false); };
  useEffect(() => { api.get("/admin/enquiry-settings").then((r) => apply(r.data)).catch((e) => toast.error(errMsg(e))); }, []);
  if (!can("config")) return <p>Only the owner can change enquiry form settings.</p>;
  if (!s) return null;

  const set = (patch) => { setS({ ...s, ...patch }); setDirty(true); };
  const setSmtp = (k) => (v) => set({ smtp: { ...s.smtp, [k]: v } });
  const setAuto = (k) => (v) => set({ autoreply: { ...s.autoreply, [k]: v } });
  const choose = (key) => {
    setPreset(key);
    const p = PRESETS.find(([k]) => k === key);
    if (p?.[2]) set({ smtp: { ...s.smtp, ...p[2] } });
  };
  const presetHint = PRESETS.find(([k]) => k === preset)?.[3];

  const save = async () => {
    setBusy("save");
    try {
      const body = { notify: s.notify, subject: s.subject, recipients: recipients.split(/[,;\s]+/).filter(Boolean),
        smtp: { ...s.smtp, password, port: Number(s.smtp.port) || 587 }, autoreply: s.autoreply };
      const r = await api.put("/admin/enquiry-settings", body);
      apply(r.data);
      toast.success(r.data.ready ? "Saved — new enquiries will be emailed" : "Saved");
    } catch (e) { toast.error(errMsg(e)); }
    setBusy("");
  };
  const test = async () => {
    if (dirty) { toast.error("Save your changes first, then send a test"); return; }
    setBusy("test");
    try {
      const r = await api.post("/admin/enquiry-settings/test", { to: testTo });
      toast.success(`Test email sent to ${r.data.sent_to.join(", ")}`);
    } catch (e) { toast.error(errMsg(e), { duration: 12000 }); }
    const r = await api.get("/admin/enquiry-settings"); setS((cur) => ({ ...cur, last: r.data.last, ready: r.data.ready }));
    setBusy("");
  };

  const status = s.ready ? <Tag tone="ok" testid="enquiry-email-status">Emails on</Tag>
    : s.notify ? <Tag tone="warn" testid="enquiry-email-status">Incomplete — emails not sent yet</Tag>
      : <Tag tone="neutral" testid="enquiry-email-status">Emails off — enquiries are only saved in admin</Tag>;

  return (
    <div className="max-w-3xl" data-testid="enquiry-settings">
      <Link to="/admin/enquiries" className="inline-flex items-center gap-1 text-sm underline mb-3"><ArrowLeft size={14} /> Enquiries</Link>
      <PageHead title="Enquiry form settings" desc="Every message sent through the Connect form is always saved under Enquiries. Here you can also have each one emailed to your team, and send the visitor an automatic thank-you.">
        <Button onClick={save} disabled={busy === "save"} data-testid="enquiry-settings-save">{busy === "save" ? "Saving…" : "Save settings"}</Button>
      </PageHead>

      <div className="flex flex-wrap items-center gap-3 mb-6 text-sm">
        {status}
        {s.last?.status && <span data-testid="enquiry-email-last">Last email {s.last.status === "sent" ? "sent" : "failed"} {fmtDateTime(s.last.at)}{s.last.error && <span className="text-[#9A4F36]"> — {s.last.error}</span>}</span>}
      </div>

      <Section title="1. Who receives enquiries" testid="enquiry-recipients">
        <CheckIn label="Email me every new enquiry" checked={s.notify} onChange={(v) => set({ notify: v })} testid="enquiry-notify" />
        <TextIn label="Send to (one or more email addresses, separated by commas)" value={recipients} onChange={(v) => { setRecipients(v); setDirty(true); }} placeholder="info@uspindia.org, team@uspindia.org" testid="enquiry-recipient-list" />
        <TextIn label="Email subject" value={s.subject} onChange={(v) => set({ subject: v })} hint="You can use {name}, {topic} and {email}. Replying to the email goes straight to the visitor." testid="enquiry-subject" />
      </Section>

      <Section title="2. Email account used to send" desc="The website sends through your own mailbox (SMTP). Pick your provider to fill in the server details, then enter the mailbox login." testid="enquiry-smtp">
        <SelectIn label="Email provider" value={preset} onChange={choose} options={PRESETS.map(([k, l]) => [k, l])} testid="enquiry-provider" />
        {presetHint && <p className="text-xs bg-[#F6F1E8] border-l-2 border-[#D41445] p-2 -mt-2 mb-4" data-testid="enquiry-provider-hint">{presetHint}</p>}
        <div className="grid sm:grid-cols-[1fr_110px_160px] gap-x-3">
          <TextIn label="SMTP server" value={s.smtp.host} onChange={setSmtp("host")} placeholder="smtp.example.com" testid="enquiry-smtp-host" />
          <TextIn label="Port" type="number" value={s.smtp.port} onChange={setSmtp("port")} testid="enquiry-smtp-port" />
          <SelectIn label="Security" value={s.smtp.security} onChange={setSmtp("security")} options={[["starttls", "STARTTLS"], ["ssl", "SSL/TLS"], ["none", "None"]]} testid="enquiry-smtp-security" />
        </div>
        <div className="grid sm:grid-cols-2 gap-x-3">
          <TextIn label="Username (usually the email address)" value={s.smtp.username} onChange={setSmtp("username")} autoComplete="off" testid="enquiry-smtp-username" />
          <TextIn label="Password / app password" type="password" value={password} onChange={(v) => { setPassword(v); setDirty(true); }} autoComplete="new-password"
            placeholder={s.smtp.password_from_env ? "Set on the server (SMTP_PASSWORD)" : s.smtp.has_password ? "•••••••• saved — leave blank to keep" : ""}
            disabled={s.smtp.password_from_env} testid="enquiry-smtp-password" />
          <TextIn label="“From” email address" value={s.smtp.from_email} onChange={setSmtp("from_email")} hint="Usually the same mailbox as the username." testid="enquiry-smtp-from" />
          <TextIn label="“From” name" value={s.smtp.from_name} onChange={setSmtp("from_name")} testid="enquiry-smtp-from-name" />
        </div>
        <div className="border-t pt-4 mt-1">
          <p className="text-sm font-semibold mb-1">Send a test email</p>
          <div className="flex flex-wrap gap-2 items-center">
            <Input className="max-w-xs" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder={(recipients || user.email).split(",")[0]} aria-label="Test email address" data-testid="enquiry-test-to" />
            <Button variant="outline" onClick={test} disabled={busy === "test"} data-testid="enquiry-test-send"><Send size={14} className="mr-1" /> {busy === "test" ? "Sending…" : "Send test"}</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Save first. If it fails, the reason from your email provider is shown here.</p>
        </div>
      </Section>

      <Section title="3. Automatic reply to the visitor (optional)" testid="enquiry-autoreply">
        <CheckIn label="Send the visitor a thank-you email" checked={s.autoreply.enabled} onChange={setAuto("enabled")} testid="enquiry-autoreply-on" />
        {s.autoreply.enabled && <>
          <TextIn label="Subject" value={s.autoreply.subject} onChange={setAuto("subject")} testid="enquiry-autoreply-subject" />
          <AreaIn label="Message" rows={7} value={s.autoreply.message} onChange={setAuto("message")} hint="{name} is replaced with the visitor's name." testid="enquiry-autoreply-message" />
        </>}
      </Section>

      <p className="text-xs text-muted-foreground flex gap-1.5"><Mail size={14} className="shrink-0 mt-0.5" /><span>The password is stored on your server and is never shown again in the browser. On a VPS you can instead set it in the backend <code>.env</code> file as <code>SMTP_PASSWORD</code>.</span></p>
    </div>
  );
}
