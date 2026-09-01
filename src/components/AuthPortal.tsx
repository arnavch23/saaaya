import { useState } from "react";
import type { FormEvent } from "react";
import { authStore, type AdministratorProfile } from "../auth";

type Props = { onAuthenticated: (profile: AdministratorProfile) => void };
type Errors = { municipalId?: string; adminId?: string; password?: string; form?: string };

function Field({ label, name, value, onChange, error, type = "text", autoComplete }: { label: string; name: string; value: string; onChange: (value: string) => void; error?: string; type?: string; autoComplete?: string }) {
  return <label className="auth-field"><span>{label}</span><input name={name} type={type} value={value} autoComplete={autoComplete} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} onChange={(event) => onChange(event.target.value)} />{error && <em id={`${name}-error`}>{error}</em>}</label>;
}

function AuthBrand() { return <div className="auth-brand"><p className="auth-brand-mark">साया</p><p className="auth-kicker">Heat Health Intelligence</p><div className="auth-brand-rule" /><h1>Municipal Heat Operations Portal</h1><p>Restricted administrative access for Pune heat-health intelligence, response coordination and ward-level operational planning.</p><dl><div><dt>Authority</dt><dd>Pune Municipal Corporation</dd></div><div><dt>Access</dt><dd>Authorized municipal personnel only</dd></div></dl></div>; }

export function AuthPortal({ onAuthenticated }: Props) {
  const [values, setValues] = useState({ municipalId: "", adminId: "", password: "", remember: true });
  const [errors, setErrors] = useState<Errors>({});
  const update = (key: "municipalId" | "adminId" | "password", value: string) => { setValues((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: "", form: "" })); };
  const submit = (event: FormEvent) => {
    event.preventDefault(); const nextErrors: Errors = {};
    if (!values.municipalId.trim()) nextErrors.municipalId = "Enter your Municipal ID.";
    if (!values.adminId.trim()) nextErrors.adminId = "Enter your Admin ID.";
    if (!values.password) nextErrors.password = "Enter your password.";
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    const profile = authStore.signIn(values.municipalId, values.adminId, values.password, values.remember);
    if (!profile) { setErrors({ form: "Unable to verify internal access. Check your credentials and try again." }); return; }
    onAuthenticated(profile);
  };
  return <main className="auth-shell"><section className="auth-layout"><AuthBrand /><section className="auth-panel" aria-labelledby="auth-title"><form className="auth-form auth-internal-form" onSubmit={submit} noValidate><div><p className="auth-eyebrow">Authorized Municipal Access</p><h2 id="auth-title">Sign in to SAAYA Heat Health Intelligence</h2><p className="auth-intro">Restricted to authorized municipal personnel.</p></div>{errors.form && <p className="auth-error-summary" role="alert">{errors.form}</p>}<Field label="Municipal ID" name="municipalId" value={values.municipalId} autoComplete="username" error={errors.municipalId} onChange={(value) => update("municipalId", value)} /><Field label="Admin ID" name="adminId" value={values.adminId} autoComplete="username" error={errors.adminId} onChange={(value) => update("adminId", value)} /><Field label="Password" name="password" type="password" value={values.password} autoComplete="current-password" error={errors.password} onChange={(value) => update("password", value)} /><label className="auth-remember"><input type="checkbox" checked={values.remember} onChange={(event) => setValues((current) => ({ ...current, remember: event.target.checked }))} /> Remember this device</label><button className="auth-submit" type="submit">Sign in</button><p className="auth-restricted-note">Access is logged and intended solely for municipal operations.</p></form></section></section><p className="auth-disclaimer">Prototype authentication only. This portal does not provide production security or identity verification.</p></main>;
}
