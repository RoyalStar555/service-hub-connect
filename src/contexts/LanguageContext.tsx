import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Language = "en" | "hi" | "mr";

export const LANGUAGES: { code: Language; label: string; native: string }[] = [
  { code: "en", label: "EN", native: "English" },
  { code: "hi", label: "HI", native: "हिन्दी" },
  { code: "mr", label: "MR", native: "मराठी" },
];

const dictionary = {
  en: {
    appName: "Service Hub",
    tagline: "Commercial Vehicle Roadside Assistance",
    dashboard: "Dashboard",
    requests: "Requests",
    jobs: "Jobs",
    wallet: "Wallet",
    settings: "Settings",
    logout: "Log out",
    login: "Log in",
    signup: "Sign up",
    email: "Email",
    password: "Password",
    fullName: "Full name",
    phone: "Phone",
    role: "Role",
    driver: "Driver",
    mechanic: "Mechanic",
    admin: "Admin",
    selectRole: "Select your role",
    language: "Language",
    driverDash: "Driver Dashboard",
    mechanicDash: "Mechanic Dashboard",
    adminDash: "Admin Console",
    newRequest: "New assistance request",
    vehicleType: "Vehicle type",
    issueType: "Issue type",
    submit: "Request assistance",
    pending: "Pending",
    accepted: "Accepted",
    completed: "Completed",
    noRequests: "No requests yet.",
    accept: "Accept job",
    complete: "Mark completed",
    unlockFee: "Unlock fee",
    balance: "Wallet balance",
    verified: "Verified",
    unverified: "Unverified",
    liveFeed: "Live job feed",
    users: "Users",
    platform: "Platform",
  },
  hi: {
    appName: "सर्विस हब",
    tagline: "व्यावसायिक वाहन सड़क किनारे सहायता",
    dashboard: "डैशबोर्ड",
    requests: "अनुरोध",
    jobs: "काम",
    wallet: "वॉलेट",
    settings: "सेटिंग्स",
    logout: "लॉग आउट",
    login: "लॉग इन",
    signup: "साइन अप",
    email: "ईमेल",
    password: "पासवर्ड",
    fullName: "पूरा नाम",
    phone: "फ़ोन",
    role: "भूमिका",
    driver: "ड्राइवर",
    mechanic: "मैकेनिक",
    admin: "एडमिन",
    selectRole: "अपनी भूमिका चुनें",
    language: "भाषा",
    driverDash: "ड्राइवर डैशबोर्ड",
    mechanicDash: "मैकेनिक डैशबोर्ड",
    adminDash: "एडमिन कंसोल",
    newRequest: "नया सहायता अनुरोध",
    vehicleType: "वाहन प्रकार",
    issueType: "समस्या प्रकार",
    submit: "सहायता मांगें",
    pending: "लंबित",
    accepted: "स्वीकृत",
    completed: "पूर्ण",
    noRequests: "अभी कोई अनुरोध नहीं।",
    accept: "काम स्वीकारें",
    complete: "पूर्ण करें",
    unlockFee: "अनलॉक शुल्क",
    balance: "वॉलेट शेष",
    verified: "सत्यापित",
    unverified: "असत्यापित",
    liveFeed: "लाइव जॉब फ़ीड",
    users: "उपयोगकर्ता",
    platform: "प्लेटफ़ॉर्म",
  },
  mr: {
    appName: "सर्व्हिस हब",
    tagline: "व्यावसायिक वाहन रस्त्यावरील मदत",
    dashboard: "डॅशबोर्ड",
    requests: "विनंत्या",
    jobs: "कामे",
    wallet: "वॉलेट",
    settings: "सेटिंग्ज",
    logout: "लॉग आउट",
    login: "लॉग इन",
    signup: "साइन अप",
    email: "ईमेल",
    password: "पासवर्ड",
    fullName: "पूर्ण नाव",
    phone: "फोन",
    role: "भूमिका",
    driver: "चालक",
    mechanic: "मेकॅनिक",
    admin: "प्रशासक",
    selectRole: "तुमची भूमिका निवडा",
    language: "भाषा",
    driverDash: "चालक डॅशबोर्ड",
    mechanicDash: "मेकॅनिक डॅशबोर्ड",
    adminDash: "प्रशासक कन्सोल",
    newRequest: "नवीन मदत विनंती",
    vehicleType: "वाहन प्रकार",
    issueType: "समस्या प्रकार",
    submit: "मदत मागा",
    pending: "प्रलंबित",
    accepted: "स्वीकारले",
    completed: "पूर्ण",
    noRequests: "अद्याप विनंत्या नाहीत.",
    accept: "काम स्वीकारा",
    complete: "पूर्ण करा",
    unlockFee: "अनलॉक शुल्क",
    balance: "वॉलेट शिल्लक",
    verified: "पडताळणी झाली",
    unverified: "पडताळणी नाही",
    liveFeed: "थेट कामांची यादी",
    users: "वापरकर्ते",
    platform: "प्लॅटफॉर्म",
  },
} as const;

export type TranslationKey = keyof (typeof dictionary)["en"];

type LanguageContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const STORAGE_KEY = "service-hub-language";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Language | null;
    if (stored && ["en", "hi", "mr"].includes(stored)) setLanguageState(stored);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    window.localStorage.setItem(STORAGE_KEY, lang);
  };

  const t = (key: TranslationKey) => dictionary[language][key] ?? dictionary.en[key];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
