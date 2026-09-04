import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { saveSession } from "../lib/auth";
import "../styles/auth.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  async function submit(event) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch(`${API_URL}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Login failed");
      saveSession(data.token, data.user);
      navigate(location.state?.from || "/", { replace: true });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  return <div className="auth-page"><div className="auth-card"><p className="eyebrow">PARAKH</p><h1>Sign in</h1><p>Sign in as a user or administrator.</p><form onSubmit={submit}><label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>{error && <div className="status-message">{error}</div>}<button className="primary-button" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button></form><p>New user? <Link to="/register">Create an account</Link></p></div></div>;
}
export default Login;
