import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "../styles/auth.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const [step, setStep] = useState("request");
  const [email, setEmail] = useState((params.get("email") || "").trim().toLowerCase());
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestCode(event) {
    event.preventDefault(); setError(""); setMessage(""); setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send reset code");
      setMessage(data.message || "A password reset code has been sent."); setStep("reset");
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function reset(event) {
    event.preventDefault(); setError(""); setMessage("");
    if (password !== confirm) return setError("Passwords do not match");
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, otp, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Password reset failed");
      navigate("/login", { replace: true, state: { resetSuccess: true } });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  return <div className="auth-page"><div className="auth-card"><p className="eyebrow">PARAKH</p><h1>{step === "request" ? "Reset password" : "Choose a new password"}</h1><p>{step === "request" ? "We'll send a 6-digit reset code to your email." : `Enter the code sent to ${email}.`}</p>{step === "request" ? <form onSubmit={requestCode}><label>Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value.trim().toLowerCase())} /></label>{error && <div className="status-message">{error}</div>}<button className="primary-button" disabled={loading}>{loading ? "Sending…" : "Send reset code"}</button></form> : <form onSubmit={reset}><label>Verification code<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} /></label><label>New password<input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label><label>Confirm password<input required type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>{error && <div className="status-message">{error}</div>}<button className="primary-button" disabled={loading}>{loading ? "Resetting…" : "Reset password"}</button></form>}{message && <div className="status-message" style={{ marginTop: 12, background: "#eff8ff", borderColor: "#b2ddff", color: "#175cd3" }}>{message}</div>}<p><Link to="/login">Back to sign in</Link></p></div></div>;
}

export default ResetPassword;
