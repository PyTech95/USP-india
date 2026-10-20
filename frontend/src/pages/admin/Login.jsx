import { useState } from "react";
import { Navigate, useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { api, errMsg } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export const AuthShell = ({ title, children }) => (
  <div className="admin flex items-center justify-center p-6">
    <div className="w-full max-w-md bg-white border p-8 mt-[10vh]">
      <p style={{ fontFamily: "Lora, serif" }} className="text-xl mb-1">USP India</p>
      <h1 className="mb-6">{title}</h1>
      {children}
    </div>
  </div>
);

export default function Login() {
  const { user, setUser } = useAuth();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState("");
  if (user) return <Navigate to={params.get("next") || "/admin"} replace />;
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try { const r = await api.post("/auth/login", f); setUser(r.data); nav(params.get("next") || "/admin"); }
    catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
  };
  const sendForgot = async () => {
    if (!f.email) return setErr("Enter your email first.");
    const r = await api.post("/auth/forgot-password", { email: f.email }).catch((x) => ({ data: { message: errMsg(x) } }));
    setForgot(r.data.message);
  };
  return (
    <AuthShell title="Sign in">
      <form onSubmit={submit} noValidate>
        <label htmlFor="email" className="block text-sm font-semibold mb-1">Email</label>
        <Input id="email" type="email" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="mb-4" data-testid="login-email" />
        <label htmlFor="password" className="block text-sm font-semibold mb-1">Password</label>
        <Input id="password" type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className="mb-4" data-testid="login-password" />
        {err && <p role="alert" className="text-sm text-[#9A4F36] mb-3" data-testid="login-error">{err}</p>}
        {forgot && <p role="status" className="text-sm mb-3">{forgot}</p>}
        <Button type="submit" className="w-full" disabled={busy} data-testid="login-submit">{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
      <div className="flex justify-between mt-4 text-sm"><button className="underline" onClick={sendForgot} data-testid="login-forgot">Forgot password?</button><Link to="/" className="underline">Public site</Link></div>
      <p className="text-xs text-muted-foreground mt-6">Accounts are created by invitation from the site owner. There is no public sign-up.</p>
    </AuthShell>
  );
}
