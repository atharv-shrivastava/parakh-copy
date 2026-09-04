import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearSession, getUser } from "../lib/auth";
import { applyTheme, getTheme, THEMES } from "../lib/theme";
import "../styles/profile.css";

function Profile() {
  const navigate = useNavigate();
  const [user] = useState(getUser());
  const [theme, setTheme] = useState(getTheme());

  function logout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  function changeTheme(event) {
    const next = applyTheme(event.target.value);
    setTheme(next);
  }

  return <div className="profile-page">
    <div className="page-header"><p className="eyebrow">ACCOUNT</p><h1>Profile & Settings</h1><p>Your PARAKH account, access information and visual preferences.</p></div>
    <section className="profile-card">
      <div><span>Name</span><strong>{user?.name || "User"}</strong></div>
      <div><span>Email</span><strong>{user?.email || "Not available"}</strong></div>
      <div><span>Role</span><strong>{user?.role || "USER"}</strong></div>
      <div className="theme-settings">
        <div><h2>Set theme</h2><p>Choose one of ten preset colour themes. Your selection is stored on this device.</p></div>
        <select className="theme-select" value={theme} onChange={changeTheme} aria-label="Application theme">
          {THEMES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <div className="theme-preview">{THEMES.map((item) => <button key={item.id} type="button" className={`theme-swatch ${theme === item.id ? "active" : ""}`} style={{ background: item.primary }} title={item.name} aria-label={`Use ${item.name} theme`} onClick={() => { setTheme(applyTheme(item.id)); }} />)}</div>
      </div>
      <button className="secondary-action" type="button" onClick={logout}>Sign out</button>
    </section>
  </div>;
}

export default Profile;
