import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { api, errMsg } from "../../lib/api";
import { AuthShell } from "./Login";

export default function TokenPassword({ kind }) {
  const [params] = useSearchParams();
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState({ ok: false, err: "" });
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post(kind === "invite" ? "/auth/accept-invite" : "/auth/reset-password", { token: params.get("token") || "", password: pw, name: name || undefined });
      setState({ ok: true, err: "" });
    } catch (x) { setState({ ok: false, err: errMsg(x) }); }
  };
  return (
    <AuthShell title={kind === "invite" ? "Accept your invitation" : "Choose a new password"}>
      {state.ok ? (
        <p role="status" data-testid="token-success">Done. <Link to="/admin/login" className="underline">Sign in</Link></p>
      ) : (
        <form onSubmit={submit}>
          {kind === "invite" && (<><label htmlFor="nm" className="block text-sm font-semibold mb-1">Your name</label><Input id="nm" value={name} onChange={(e) => setName(e.target.value)} className="mb-4" /></>)}
          <label htmlFor="pw" className="block text-sm font-semibold mb-1">New password (at least 10 characters)</label>
          <Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className="mb-4" data-testid="token-password" />
          {state.err && <p role="alert" className="text-sm text-[#9A4F36] mb-3">{state.err}</p>}
          <Button type="submit" className="w-full" data-testid="token-submit">Save password</Button>
        </form>
      )}
    </AuthShell>
  );
}
