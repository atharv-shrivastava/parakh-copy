export const LANGUAGES = [
  { code: "en", name: "English", nativeName: "English", dir: "ltr" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", dir: "ltr" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", dir: "ltr" },
  { code: "mr", name: "Marathi", nativeName: "मराठी", dir: "ltr" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", dir: "ltr" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", dir: "ltr" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", dir: "ltr" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", dir: "ltr" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", dir: "ltr" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", dir: "ltr" },
  { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ", dir: "ltr" },
  { code: "as", name: "Assamese", nativeName: "অসমীয়া", dir: "ltr" },
  { code: "ur", name: "Urdu", nativeName: "اردو", dir: "rtl" },
];

const DEFAULT_LANGUAGE = "en";
const LAST_LANGUAGE_KEY = "parakh_language";

export function isSupportedLanguage(code) {
  return LANGUAGES.some((language) => language.code === code);
}

export function getLanguage(userId) {
  const userKey = userId ? localStorage.getItem(`parakh_language_${userId}`) : null;
  const fallback = localStorage.getItem(LAST_LANGUAGE_KEY);
  const candidate = userKey || fallback;
  return isSupportedLanguage(candidate) ? candidate : DEFAULT_LANGUAGE;
}

export function saveLanguage(code, userId) {
  const next = isSupportedLanguage(code) ? code : DEFAULT_LANGUAGE;
  localStorage.setItem(LAST_LANGUAGE_KEY, next);
  if (userId) localStorage.setItem(`parakh_language_${userId}`, next);
  const language = LANGUAGES.find((item) => item.code === next) || LANGUAGES[0];
  document.documentElement.lang = next;
  document.documentElement.dir = language.dir;
  return next;
}

const EN = {
  account: "ACCOUNT",
  profileSettings: "Profile & Settings",
  profileSubtitle: "Your PARAKH account, access information and visual preferences.",
  name: "Name",
  email: "Email",
  role: "Role",
  setTheme: "Set theme",
  themeHelp: "Choose one of ten preset colour themes. Your selection is stored on this device.",
  language: "Language",
  languageHelp: "Choose the language used across the PARAKH interface.",
  signOut: "Sign out",
  compliancePlatform: "Compliance Platform",
  dashboard: "Dashboard",
  scan: "Scan",
  ecommerce: "E-commerce",
  shops: "Shops",
  products: "Products",
  history: "History",
  reports: "Reports",
  adminDashboard: "Admin Dashboard",
  globalCategories: "Global Categories",
  complianceRules: "Compliance Rules",
  parakh: "PARAKH",
  signIn: "Sign in",
  signInSubtitle: "Sign in as a user or administrator.",
  password: "Password",
  signingIn: "Signing in...",
  newUser: "New user?",
  createAccount: "Create an account",
  chooseLanguage: "Choose language",
  welcome: "Welcome",
  legalMetrology: "LEGAL METROLOGY COMPLIANCE",
  inspectSubtitle: "Inspect packaged commodities and identify potential compliance violations.",
  totalRegistered: "Total registered products",
  compliant: "Compliant",
  violations: "Violations",
  needsReview: "Needs review",
  myAnalytics: "My compliance analytics",
  analyticsHelp: "Based only on inspections and products available to your account.",
  inspectionSummary: "Inspection summary",
  frequentViolations: "Frequent violations",
  productsByCategory: "Products by category",
  topBrands: "Top brands",
  inspectionLocations: "Inspection locations",
  violationTrend: "Violation trend",
  noViolations: "No violations yet.",
  noCategoryData: "No category data yet.",
  noBrandData: "No brand data yet.",
  noLocationData: "No location data yet.",
  noTrendData: "No trend data yet.",
  productInspection: "PRODUCT INSPECTION",
  scanCommodity: "Scan a packaged commodity",
  scanCommodityHelp: "Use your camera or upload up to four package images to extract declarations and run the Legal Metrology Rules Engine.",
  startScan: "Start Scan",
  recentInspections: "Recent inspections",
  latestChecks: "Your latest product compliance checks.",
  viewAll: "View all",
  uncategorised: "Uncategorised",
  noShop: "No shop",
  noInspections: "No inspections yet. Start your first scan.",
  quickAccess: "Quick access",
  frequentlyUsed: "Frequently used areas of PARAKH.",
  browseRegisteredShops: "Browse registered shops",
  browseProductRecords: "Browse category hierarchy and product records",
  generateReports: "Generate product inspection reports",
};

const translations = { en: EN };

const localized = {
  hi: {
    account: "खाता", profileSettings: "प्रोफ़ाइल और सेटिंग्स", profileSubtitle: "आपका PARAKH खाता, पहुँच जानकारी और दृश्य प्राथमिकताएँ।", name: "नाम", email: "ईमेल", role: "भूमिका", setTheme: "थीम सेट करें", themeHelp: "दस प्रीसेट रंग थीम में से चुनें। चयन इस डिवाइस पर सहेजा जाएगा।", language: "भाषा", languageHelp: "PARAKH इंटरफ़ेस में उपयोग की जाने वाली भाषा चुनें।", signOut: "साइन आउट", compliancePlatform: "अनुपालन प्लेटफ़ॉर्म", dashboard: "डैशबोर्ड", scan: "स्कैन", ecommerce: "ई-कॉमर्स", shops: "दुकानें", products: "उत्पाद", history: "इतिहास", reports: "रिपोर्ट", adminDashboard: "एडमिन डैशबोर्ड", globalCategories: "ग्लोबल श्रेणियाँ", complianceRules: "अनुपालन नियम", parakh: "PARAKH", signIn: "साइन इन", signInSubtitle: "उपयोगकर्ता या प्रशासक के रूप में साइन इन करें।", password: "पासवर्ड", signingIn: "साइन इन हो रहा है...", newUser: "नए उपयोगकर्ता?", createAccount: "खाता बनाएँ", chooseLanguage: "भाषा चुनें", welcome: "स्वागत है", legalMetrology: "कानूनी मेट्रोलॉजी अनुपालन", inspectSubtitle: "पैकेज्ड वस्तुओं का निरीक्षण करें और संभावित अनुपालन उल्लंघनों की पहचान करें।", totalRegistered: "कुल पंजीकृत उत्पाद", compliant: "अनुपालक", violations: "उल्लंघन", needsReview: "समीक्षा आवश्यक", myAnalytics: "मेरा अनुपालन विश्लेषण", analyticsHelp: "केवल आपके खाते के उपलब्ध निरीक्षण और उत्पादों पर आधारित।", inspectionSummary: "निरीक्षण सारांश", frequentViolations: "अक्सर होने वाले उल्लंघन", productsByCategory: "श्रेणी के अनुसार उत्पाद", topBrands: "शीर्ष ब्रांड", inspectionLocations: "निरीक्षण स्थान", violationTrend: "उल्लंघन रुझान", noViolations: "अभी कोई उल्लंघन नहीं।", productInspection: "उत्पाद निरीक्षण", scanCommodity: "पैकेज्ड वस्तु स्कैन करें", scanCommodityHelp: "घोषणाएँ निकालने और कानूनी मेट्रोलॉजी नियम इंजन चलाने के लिए कैमरा उपयोग करें या अधिकतम चार पैकेज छवियाँ अपलोड करें।", startScan: "स्कैन शुरू करें", recentInspections: "हाल के निरीक्षण", latestChecks: "आपकी नवीनतम उत्पाद अनुपालन जाँच।", viewAll: "सभी देखें", uncategorised: "श्रेणी रहित", noShop: "कोई दुकान नहीं", noInspections: "अभी कोई निरीक्षण नहीं। पहला स्कैन शुरू करें।", quickAccess: "त्वरित पहुँच", frequentlyUsed: "PARAKH के अक्सर उपयोग किए जाने वाले क्षेत्र।", browseRegisteredShops: "पंजीकृत दुकानें देखें", browseProductRecords: "श्रेणी संरचना और उत्पाद रिकॉर्ड देखें", generateReports: "उत्पाद निरीक्षण रिपोर्ट बनाएँ"
  },
  bn: {
    account: "অ্যাকাউন্ট", profileSettings: "প্রোফাইল ও সেটিংস", name: "নাম", email: "ইমেল", role: "ভূমিকা", setTheme: "থিম সেট করুন", language: "ভাষা", signOut: "সাইন আউট", dashboard: "ড্যাশবোর্ড", scan: "স্ক্যান", ecommerce: "ই-কমার্স", shops: "দোকান", products: "পণ্য", history: "ইতিহাস", reports: "রিপোর্ট", signIn: "সাইন ইন", password: "পাসওয়ার্ড", signingIn: "সাইন ইন হচ্ছে...", newUser: "নতুন ব্যবহারকারী?", createAccount: "অ্যাকাউন্ট তৈরি করুন", chooseLanguage: "ভাষা নির্বাচন করুন", welcome: "স্বাগতম", totalRegistered: "মোট নিবন্ধিত পণ্য", compliant: "অনুগত", violations: "লঙ্ঘন", needsReview: "পর্যালোচনা প্রয়োজন", startScan: "স্ক্যান শুরু করুন", recentInspections: "সাম্প্রতিক পরিদর্শন", viewAll: "সব দেখুন", quickAccess: "দ্রুত অ্যাক্সেস"
  },
  mr: {
    account: "खाते", profileSettings: "प्रोफाइल आणि सेटिंग्ज", name: "नाव", email: "ईमेल", role: "भूमिका", setTheme: "थीम निवडा", language: "भाषा", signOut: "साइन आउट", dashboard: "डॅशबोर्ड", scan: "स्कॅन", ecommerce: "ई-कॉमर्स", shops: "दुकाने", products: "उत्पादने", history: "इतिहास", reports: "अहवाल", signIn: "साइन इन", password: "पासवर्ड", signingIn: "साइन इन होत आहे...", newUser: "नवीन वापरकर्ता?", createAccount: "खाते तयार करा", chooseLanguage: "भाषा निवडा", welcome: "स्वागत", totalRegistered: "एकूण नोंदणीकृत उत्पादने", compliant: "अनुपालक", violations: "उल्लंघने", needsReview: "पुनरावलोकन आवश्यक", startScan: "स्कॅन सुरू करा", recentInspections: "अलीकडील तपासण्या", viewAll: "सर्व पहा", quickAccess: "जलद प्रवेश"
  },
  gu: {
    account: "એકાઉન્ટ", profileSettings: "પ્રોફાઇલ અને સેટિંગ્સ", name: "નામ", email: "ઇમેલ", role: "ભૂમિકા", setTheme: "થીમ પસંદ કરો", language: "ભાષા", signOut: "સાઇન આઉટ", dashboard: "ડેશબોર્ડ", scan: "સ્કેન", ecommerce: "ઇ-કોમર્સ", shops: "દુકાનો", products: "ઉત્પાદનો", history: "ઇતિહાસ", reports: "રિપોર્ટ્સ", signIn: "સાઇન ઇન", password: "પાસવર્ડ", signingIn: "સાઇન ઇન થઈ રહ્યું છે...", newUser: "નવા વપરાશકર્તા?", createAccount: "એકાઉન્ટ બનાવો", chooseLanguage: "ભાષા પસંદ કરો", welcome: "સ્વાગત છે", totalRegistered: "કુલ નોંધાયેલા ઉત્પાદનો", compliant: "અનુપાલક", violations: "ઉલ્લંઘનો", needsReview: "સમીક્ષા જરૂરી", startScan: "સ્કેન શરૂ કરો", recentInspections: "તાજેતરના નિરીક્ષણો", viewAll: "બધા જુઓ", quickAccess: "ઝડપી ઍક્સેસ"
  },
  ta: { account: "கணக்கு", profileSettings: "சுயவிவரம் மற்றும் அமைப்புகள்", name: "பெயர்", email: "மின்னஞ்சல்", role: "பங்கு", setTheme: "தீம் அமைக்கவும்", language: "மொழி", signOut: "வெளியேறு", dashboard: "டாஷ்போர்டு", scan: "ஸ்கேன்", ecommerce: "மின் வணிகம்", shops: "கடைகள்", products: "தயாரிப்புகள்", history: "வரலாறு", reports: "அறிக்கைகள்", signIn: "உள்நுழை", password: "கடவுச்சொல்", signingIn: "உள்நுழைகிறது...", newUser: "புதிய பயனரா?", createAccount: "கணக்கை உருவாக்கவும்", chooseLanguage: "மொழியைத் தேர்வு செய்யவும்", welcome: "வரவேற்கிறோம்", totalRegistered: "மொத்த பதிவு செய்யப்பட்ட தயாரிப்புகள்", compliant: "இணக்கமானது", violations: "மீறல்கள்", needsReview: "மதிப்பாய்வு தேவை", startScan: "ஸ்கேன் தொடங்கவும்", recentInspections: "சமீபத்திய ஆய்வுகள்", viewAll: "அனைத்தையும் பார்க்கவும்", quickAccess: "விரைவு அணுகல்" },
  te: { account: "ఖాతా", profileSettings: "ప్రొఫైల్ & సెట్టింగ్స్", name: "పేరు", email: "ఇమెయిల్", role: "పాత్ర", setTheme: "థీమ్ ఎంచుకోండి", language: "భాష", signOut: "సైన్ అవుట్", dashboard: "డాష్‌బోర్డ్", scan: "స్కాన్", ecommerce: "ఈ-కామర్స్", shops: "దుకాణాలు", products: "ఉత్పత్తులు", history: "చరిత్ర", reports: "నివేదికలు", signIn: "సైన్ ఇన్", password: "పాస్‌వర్డ్", signingIn: "సైన్ ఇన్ అవుతోంది...", newUser: "కొత్త వినియోగదారా?", createAccount: "ఖాతాను సృష్టించండి", chooseLanguage: "భాషను ఎంచుకోండి", welcome: "స్వాగతం", totalRegistered: "మొత్తం నమోదైన ఉత్పత్తులు", compliant: "అనుగుణమైనవి", violations: "ఉల్లంఘనలు", needsReview: "సమీక్ష అవసరం", startScan: "స్కాన్ ప్రారంభించండి", recentInspections: "ఇటీవలి తనిఖీలు", viewAll: "అన్నీ చూడండి", quickAccess: "త్వరిత ప్రాప్యత" },
  kn: { account: "ಖಾತೆ", profileSettings: "ಪ್ರೊಫೈಲ್ ಮತ್ತು ಸೆಟ್ಟಿಂಗ್‌ಗಳು", name: "ಹೆಸರು", email: "ಇಮೇಲ್", role: "ಪಾತ್ರ", setTheme: "ಥೀಮ್ ಆಯ್ಕೆಮಾಡಿ", language: "ಭಾಷೆ", signOut: "ಸೈನ್ ಔಟ್", dashboard: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್", scan: "ಸ್ಕ್ಯಾನ್", ecommerce: "ಇ-ಕಾಮರ್ಸ್", shops: "ಅಂಗಡಿಗಳು", products: "ಉತ್ಪನ್ನಗಳು", history: "ಇತಿಹಾಸ", reports: "ವರದಿಗಳು", signIn: "ಸೈನ್ ಇನ್", password: "ಪಾಸ್‌ವರ್ಡ್", signingIn: "ಸೈನ್ ಇನ್ ಆಗುತ್ತಿದೆ...", newUser: "ಹೊಸ ಬಳಕೆದಾರ?", createAccount: "ಖಾತೆ ರಚಿಸಿ", chooseLanguage: "ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ", welcome: "ಸ್ವಾಗತ", totalRegistered: "ಒಟ್ಟು ನೋಂದಾಯಿತ ಉತ್ಪನ್ನಗಳು", compliant: "ಅನುಗುಣ", violations: "ಉಲ್ಲಂಘನೆಗಳು", needsReview: "ಪರಿಶೀಲನೆ ಅಗತ್ಯ", startScan: "ಸ್ಕ್ಯಾನ್ ಪ್ರಾರಂಭಿಸಿ", recentInspections: "ಇತ್ತೀಚಿನ ಪರಿಶೀಲನೆಗಳು", viewAll: "ಎಲ್ಲವನ್ನೂ ನೋಡಿ", quickAccess: "ತ್ವರಿತ ಪ್ರವೇಶ" },
  ml: { account: "അക്കൗണ്ട്", profileSettings: "പ്രൊഫൈലും ക്രമീകരണങ്ങളും", name: "പേര്", email: "ഇമെയിൽ", role: "പങ്ക്", setTheme: "തീം തിരഞ്ഞെടുക്കുക", language: "ഭാഷ", signOut: "സൈൻ ഔട്ട്", dashboard: "ഡാഷ്ബോർഡ്", scan: "സ്കാൻ", ecommerce: "ഇ-കൊമേഴ്‌സ്", shops: "കടകൾ", products: "ഉൽപ്പന്നങ്ങൾ", history: "ചരിത്രം", reports: "റിപ്പോർട്ടുകൾ", signIn: "സൈൻ ഇൻ", password: "പാസ്‌വേഡ്", signingIn: "സൈൻ ഇൻ ചെയ്യുന്നു...", newUser: "പുതിയ ഉപയോക്താവാണോ?", createAccount: "അക്കൗണ്ട് സൃഷ്ടിക്കുക", chooseLanguage: "ഭാഷ തിരഞ്ഞെടുക്കുക", welcome: "സ്വാഗതം", totalRegistered: "മൊത്തം രജിസ്റ്റർ ചെയ്ത ഉൽപ്പന്നങ്ങൾ", compliant: "അനുസരിച്ചുള്ളത്", violations: "ലംഘനങ്ങൾ", needsReview: "പരിശോധന ആവശ്യമാണ്", startScan: "സ്കാൻ ആരംഭിക്കുക", recentInspections: "സമീപകാല പരിശോധനകൾ", viewAll: "എല്ലാം കാണുക", quickAccess: "ദ്രുത പ്രവേശനം" },
  pa: { account: "ਖਾਤਾ", profileSettings: "ਪ੍ਰੋਫਾਈਲ ਅਤੇ ਸੈਟਿੰਗਾਂ", name: "ਨਾਮ", email: "ਈਮੇਲ", role: "ਭੂਮਿਕਾ", setTheme: "ਥੀਮ ਚੁਣੋ", language: "ਭਾਸ਼ਾ", signOut: "ਸਾਇਨ ਆਉਟ", dashboard: "ਡੈਸ਼ਬੋਰਡ", scan: "ਸਕੈਨ", ecommerce: "ਈ-ਕਾਮਰਸ", shops: "ਦੁਕਾਨਾਂ", products: "ਉਤਪਾਦ", history: "ਇਤਿਹਾਸ", reports: "ਰਿਪੋਰਟਾਂ", signIn: "ਸਾਇਨ ਇਨ", password: "ਪਾਸਵਰਡ", signingIn: "ਸਾਇਨ ਇਨ ਹੋ ਰਿਹਾ ਹੈ...", newUser: "ਨਵਾਂ ਉਪਭੋਗਤਾ?", createAccount: "ਖਾਤਾ ਬਣਾਓ", chooseLanguage: "ਭਾਸ਼ਾ ਚੁਣੋ", welcome: "ਜੀ ਆਇਆਂ ਨੂੰ", totalRegistered: "ਕੁੱਲ ਰਜਿਸਟਰਡ ਉਤਪਾਦ", compliant: "ਅਨੁਕੂਲ", violations: "ਉਲੰਘਣਾਂ", needsReview: "ਸਮੀਖਿਆ ਲੋੜੀਂਦੀ", startScan: "ਸਕੈਨ ਸ਼ੁਰੂ ਕਰੋ", recentInspections: "ਹਾਲੀਆ ਜਾਂਚਾਂ", viewAll: "ਸਭ ਵੇਖੋ", quickAccess: "ਤੁਰੰਤ ਪਹੁੰਚ" },
  or: { account: "ଖାତା", profileSettings: "ପ୍ରୋଫାଇଲ୍ ଓ ସେଟିଂସ୍", name: "ନାମ", email: "ଇମେଲ୍", role: "ଭୂମିକା", setTheme: "ଥିମ୍ ବାଛନ୍ତୁ", language: "ଭାଷା", signOut: "ସାଇନ୍ ଆଉଟ୍", dashboard: "ଡ୍ୟାସ୍‌ବୋର୍ଡ", scan: "ସ୍କାନ୍", ecommerce: "ଇ-କମର୍ସ", shops: "ଦୋକାନ", products: "ଉତ୍ପାଦ", history: "ଇତିହାସ", reports: "ରିପୋର୍ଟ", signIn: "ସାଇନ୍ ଇନ୍", password: "ପାସୱାର୍ଡ", signingIn: "ସାଇନ୍ ଇନ୍ ହେଉଛି...", newUser: "ନୂତନ ବ୍ୟବହାରକାରୀ?", createAccount: "ଖାତା ତିଆରି କରନ୍ତୁ", chooseLanguage: "ଭାଷା ବାଛନ୍ତୁ", welcome: "ସ୍ୱାଗତ", totalRegistered: "ମୋଟ ପଞ୍ଜିକୃତ ଉତ୍ପାଦ", compliant: "ଅନୁପାଳନ", violations: "ଉଲ୍ଲଂଘନ", needsReview: "ସମୀକ୍ଷା ଆବଶ୍ୟକ", startScan: "ସ୍କାନ୍ ଆରମ୍ଭ କରନ୍ତୁ", recentInspections: "ସମ୍ପ୍ରତି ଯାଞ୍ଚ", viewAll: "ସବୁ ଦେଖନ୍ତୁ", quickAccess: "ତ୍ୱରିତ ପ୍ରବେଶ" },
  as: { account: "একাউণ্ট", profileSettings: "প্ৰফাইল আৰু ছেটিংছ", name: "নাম", email: "ইমেইল", role: "ভূমিকা", setTheme: "থীম বাছক", language: "ভাষা", signOut: "চাইন আউট", dashboard: "ডেছব'ৰ্ড", scan: "স্কেন", ecommerce: "ই-কমাৰ্চ", shops: "দোকান", products: "উৎপাদন", history: "ইতিহাস", reports: "প্ৰতিবেদন", signIn: "চাইন ইন", password: "পাছৱৰ্ড", signingIn: "চাইন ইন হৈ আছে...", newUser: "নতুন ব্যৱহাৰকাৰী?", createAccount: "একাউণ্ট সৃষ্টি কৰক", chooseLanguage: "ভাষা বাছক", welcome: "স্বাগতম", totalRegistered: "মুঠ পঞ্জীয়নভুক্ত উৎপাদন", compliant: "অনুগত", violations: "উলংঘন", needsReview: "পুনৰীক্ষণ প্ৰয়োজন", startScan: "স্কেন আৰম্ভ কৰক", recentInspections: "শেহতীয়া পৰিদৰ্শন", viewAll: "সকলো চাওক", quickAccess: "দ্ৰুত প্ৰৱেশ" },
  ur: { account: "اکاؤنٹ", profileSettings: "پروفائل اور سیٹنگز", name: "نام", email: "ای میل", role: "کردار", setTheme: "تھیم منتخب کریں", language: "زبان", signOut: "سائن آؤٹ", dashboard: "ڈیش بورڈ", scan: "اسکین", ecommerce: "ای کامرس", shops: "دکانیں", products: "مصنوعات", history: "تاریخچہ", reports: "رپورٹس", signIn: "سائن اِن", password: "پاس ورڈ", signingIn: "سائن اِن ہو رہا ہے...", newUser: "نئے صارف؟", createAccount: "اکاؤنٹ بنائیں", chooseLanguage: "زبان منتخب کریں", welcome: "خوش آمدید", totalRegistered: "کل رجسٹرڈ مصنوعات", compliant: "مطابق", violations: "خلاف ورزیاں", needsReview: "جائزہ درکار ہے", startScan: "اسکین شروع کریں", recentInspections: "حالیہ معائنہ", viewAll: "سب دیکھیں", quickAccess: "فوری رسائی" },
};

Object.entries(localized).forEach(([code, values]) => { translations[code] = { ...EN, ...values }; });

export function translate(language, key) {
  return translations[language]?.[key] || translations.en[key] || key;
}
