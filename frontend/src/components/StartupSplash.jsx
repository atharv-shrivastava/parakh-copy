import { useEffect, useState } from "react";
import { apiFetch, getToken } from "../lib/auth";
import "../styles/startup-splash.css";

const API_URL = "http://localhost:5000/api";
const MIN_VISIBLE_MS = 900;
const MAX_BOOT_MS = 6500;

const BOOT_ENDPOINTS = [
  `${API_URL}/products?limit=6`,
  `${API_URL}/products/analytics/summary`,
  `${API_URL}/categories`,
  `${API_URL}/categories/tree/all`,
  `${API_URL}/shops?limit=50`,
  `${API_URL}/rules`,
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function warmEndpoint(url) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 5000);
  try {
    await apiFetch(url, { signal: controller.signal });
  } catch {
    // A failed warm-up must never prevent the application from opening.
  } finally {
    window.clearTimeout(timer);
  }
}

async function warmWorkspace() {
  if (!getToken()) return;
  await Promise.race([
    Promise.allSettled(BOOT_ENDPOINTS.map(warmEndpoint)),
    wait(MAX_BOOT_MS),
  ]);
}

export default function StartupSplash({ children }) {
  const [ready, setReady] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    let active = true;

    async function boot() {
      const startedAt = Date.now();
      await Promise.allSettled([warmWorkspace(), wait(MIN_VISIBLE_MS)]);
      const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt));
      if (remaining) await wait(remaining);
      if (!active) return;
      setExiting(true);
      window.setTimeout(() => {
        if (active) setReady(true);
      }, 260);
    }

    boot();
    return () => {
      active = false;
    };
  }, []);

  if (ready) return children;

  return (
    <div className={`startup-splash${exiting ? " startup-splash--exiting" : ""}`} role="status" aria-live="polite">
      <div className="startup-splash__ambient startup-splash__ambient--one" />
      <div className="startup-splash__ambient startup-splash__ambient--two" />
      <div className="startup-splash__content">
        <div className="startup-splash__logo-wrap">
          <div className="startup-splash__ring startup-splash__ring--outer" />
          <div className="startup-splash__ring startup-splash__ring--inner" />
          <div className="startup-splash__logo-card">
            <img src="/favicon.svg" alt="PARAKH" className="startup-splash__logo" />
          </div>
        </div>
        <div className="startup-splash__brand">PARAKH</div>
        <div className="startup-splash__tagline">Inspection intelligence workspace</div>
        <div className="startup-splash__loader" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="startup-splash__status">Preparing your workspace</div>
      </div>
    </div>
  );
}
