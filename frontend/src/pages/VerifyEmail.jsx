import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "../styles/auth.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const [email, setEmail] = useState((params.get("email") || "").trim().toLowerCase());
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => { if (email) setMessage(`A verification code was sent to ${email}.`); }, [email]);

  async function verify(event) {
    event.preventDefault(); setError(""); setMessage(""); setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/verify-email`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, otp }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Verification failed");
      navigate("/login", { replace: true, state: { verifiedEmail: email } });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function resend() {
    setError(""); setMessage(""); setResending(true);
    try {
      const response = await fetch(`${API_URL}/auth/resend-verification`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to resend code");
      setMessage(data.message || "A new verification code has been sent.");
    } catch (err) { setError(err.message); } finally { setResending(false); }
  }

  return <div className="auth-page"><div className="auth-card"><p className="eyebrow">PARAKH</p><h1>Verify your email</h1><p>Enter the 6-digit code we sent to your email address.</p><form onSubmit={verify}><label>Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value.trim().toLowerCase())} /></label><label>Verification code<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} /></label>{message && <div className="status-message" style={{ background: "#eff8ff", borderColor: "#b2ddff", color: "#175cd3" }}>{message}</div>}{error && <div className="status-message">{error}</div>}<button className="primary-button" disabled={loading}>{loading ? "Verifying…" : "Verify email"}</button></form><button className="primary-button" style={{ marginTop: 12, background: "transparent", color: "var(--auth-primary)", border: "1px solid var(--auth-border)" }} onClick={resend} disabled={resending || !email}>{resending ? "Sending…" : "Resend code"}</button><p><Link to="/login">Back to sign in</Link></p></div></div>;
}
export default VerifyEmail;
