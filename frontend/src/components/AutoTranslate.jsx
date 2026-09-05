import { useEffect, useRef } from "react";
import { apiFetch } from "../lib/auth";
import { useLanguage } from "./LanguageProvider";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT"]);
const SKIP_SELECTOR = "[data-no-auto-translate=\"true\"], .language-picker";

function shouldSkip(node) {
  const parent = node.parentElement;
  if (!parent || SKIP_TAGS.has(parent.tagName)) return true;
  if (parent.closest(SKIP_SELECTOR)) return true;
  const text = node.nodeValue?.trim() || "";
  if (text.length < 2) return true;
  if (/^(https?:\/\/|www\.)/i.test(text)) return true;
  if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(text)) return true;
  if (/^[\d\s.,:%+\-–—/()#]+$/.test(text)) return true;
  if (/^(PCR-|SIH|OKAY|VIOLATION|NEEDS_REVIEW|UNABLE_TO_VERIFY)[A-Z0-9_()./-]*$/i.test(text)) return true;
  return false;
}

function splitWhitespace(text) {
  const match = String(text).match(/^(\s*)([\s\S]*?)(\s*)$/);
  return { leading: match?.[1] || "", core: match?.[2] || String(text), trailing: match?.[3] || "" };
}

export default function AutoTranslate() {
  const { language } = useLanguage();
  const cache = useRef(new Map());
  const translatedByNode = useRef(new WeakMap());
  const busy = useRef(false);
  const observer = useRef(null);
  const timer = useRef(null);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const cacheKey = `parakh_translation_cache_${language}`;
    try {
      const stored = JSON.parse(localStorage.getItem(cacheKey) || "{}");
      cache.current = new Map(Object.entries(stored));
    } catch {
      cache.current = new Map();
    }
    translatedByNode.current = new WeakMap();

    let cancelled = false;

    async function process() {
      if (cancelled || busy.current) return;
      const root = document.body;
      if (!root) return;
      const nodes = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (shouldSkip(node)) continue;
        if (node.nodeValue === translatedByNode.current.get(node)) continue;
        nodes.push(node);
      }
      if (!nodes.length) return;

      const missing = [];
      const missingSet = new Set();
      for (const item of nodes) {
        const { core } = splitWhitespace(item.nodeValue || "");
        if (!core || cache.current.has(core)) continue;
        if (!missingSet.has(core)) { missingSet.add(core); missing.push(core); }
      }

      busy.current = true;
      try {
        for (let offset = 0; offset < missing.length; offset += 50) {
          const batch = missing.slice(offset, offset + 50);
          const response = await apiFetch("http://localhost:5000/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ target: language, texts: batch }),
          });
          const data = await response.json().catch(() => null);
          for (const text of batch) cache.current.set(text, data?.translations?.[text] || text);
          if (cancelled) return;
        }
        const compact = Object.fromEntries([...cache.current.entries()].slice(-1000));
        localStorage.setItem(cacheKey, JSON.stringify(compact));

        for (const item of nodes) {
          const { leading, core, trailing } = splitWhitespace(item.nodeValue || "");
          const translated = cache.current.get(core);
          if (!translated) continue;
          const next = `${leading}${translated}${trailing}`;
          item.nodeValue = next;
          translatedByNode.current.set(item, next);
        }
      } catch {
        // Keep current text when the translation service is unavailable.
      } finally {
        busy.current = false;
      }
    }

    const schedule = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(process, 180);
    };
    schedule();
    observer.current = new MutationObserver(schedule);
    observer.current.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelled = true;
      window.clearTimeout(timer.current);
      observer.current?.disconnect();
    };
  }, [language]);

  return null;
}
