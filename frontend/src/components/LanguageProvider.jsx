import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getUser } from "../lib/auth";
import { getLanguage, saveLanguage, translate } from "../lib/language";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const user = getUser();
  const [language, setLanguageState] = useState(() => getLanguage(user?.id));

  useEffect(() => {
    saveLanguage(language, getUser()?.id);
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage(next) {
      setLanguageState(saveLanguage(next, getUser()?.id));
    },
    t(key) { return translate(language, key); },
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
