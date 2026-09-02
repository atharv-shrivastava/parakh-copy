import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearSession, getUser } from "../lib/auth";
import "../styles/profile.css";

function Profile() {
  const navigate = useNavigate();
  const [user] = useState(getUser());

  function logout() {
    clearSession();
    navigate("/login", { replace: true });
  }

  return <div className="profile-page">
    <div className="page-header"><p className="eyebrow">ACCOUNT</p><h1>Profile</h1><p>Your PARAKH account and access information.</p></div>
    <section className="profile-card">
      <div><span>Name</span><strong>{user?.name || "User"}</strong></div>
      <div><span>Email</span><strong>{user?.email || "Not available"}</strong></div>
      <div><span>Role</span><strong>{user?.role || "USER"}</strong></div>
      <button className="secondary-action" type="button" onClick={logout}>Sign out</button>
    </section>
  </div>;
}

export default Profile;
