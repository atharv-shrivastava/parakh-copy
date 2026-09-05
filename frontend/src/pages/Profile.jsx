import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearSession, getUser } from "../lib/auth";
import { applyTheme, getTheme, THEMES } from "../lib/theme";
import { LANGUAGES } from "../lib/language";
import { useLanguage } from "../components/LanguageProvider";
import "../styles/profile.css";

function Profile() {
  const navigate = useNavigate();
  const [user] = useState(getUser());
  const [theme, setTheme] = useState(getTheme());
  const { language, setLanguage, t } = useLanguage();

  function logout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  function changeTheme(event) {
    const next = applyTheme(event.target.value);
    setTheme(next);
  }

  function changeLanguage(event) {
    setLanguage(event.target.value);
  }

  return <div className="profile-page">
    <div className="page-header"><p className="eyebrow">{t("account")}</p><h1>{t("profileSettings")}</h1><p>{t("profileSubtitle")}</p></div>
    <section className="profile-card">
      <div><span>{t("name")}</span><strong>{user?.name || "User"}</strong></div>
      <div><span>{t("email")}</span><strong>{user?.email || "Not available"}</strong></div>
      <div><span>{t("role")}</span><strong>{user?.role || "USER"}</strong></div>
      <div className="language-settings">
        <div><h2>{t("language")}</h2><p>{t("languageHelp")}</p></div>
        <select className="language-select" value={language} onChange={changeLanguage} aria-label={t("chooseLanguage")}>
          {LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.nativeName} · {item.name}</option>)}
        </select>
      </div>
      <div className="theme-settings">
        <div><h2>{t("setTheme")}</h2><p>{t("themeHelp")}</p></div>
        <select className="theme-select" value={theme} onChange={changeTheme} aria-label="Application theme">
          {THEMES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <div className="theme-preview">{THEMES.map((item) => <button key={item.id} type="button" className={`theme-swatch ${theme === item.id ? "active" : ""}`} style={{ background: item.primary }} title={item.name} aria-label={`Use ${item.name} theme`} onClick={() => { setTheme(applyTheme(item.id)); }} />)}</div>
      </div>
      <button className="secondary-action" type="button" onClick={logout}>{t("signOut")}</button>
    </section>
  </div>;
}

export default Profile;
