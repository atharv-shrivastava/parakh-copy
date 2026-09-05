import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/auth";
import { useLanguage } from "../components/LanguageProvider";
import "../styles/shops.css";

const API_URL = "http://localhost:5000/api";

const SHOP_COPY = {
  en: {
    offlineBusinesses: "OFFLINE BUSINESSES", ecommerceSources: "E-COMMERCE SOURCES", offlineShops: "Offline shops", ecommerceShops: "E-commerce shops",
    offlineDescription: "Physical shops created through offline product inspections.", ecommerceDescription: "Websites used as sources for e-commerce product inspections. The website name is shown instead of a physical shop name.",
    shops: "Shops", websites: "Websites", compliant: "Compliant", needsReview: "Needs review", nonCompliant: "Non-compliant",
    allShops: "All shops", allWebsites: "All websites", searchShop: "Search shop, city or address...", searchWebsite: "Search website...", searchShops: "Search shops", filterStatus: "Filter shop status", reset: "Reset",
    loadingOffline: "Loading offline shops...", loadingEcommerce: "Loading e-commerce websites...", noOffline: "No offline shops match the current filters.", noEcommerce: "No e-commerce websites match the current filters.",
    websiteSource: "Website source", addressNotRecorded: "Address not recorded", products: "products", inspections: "inspections", noInspection: "No inspection", deleting: "Deleting...", delete: "Delete", deleteShop: "Delete shop"
  },
  hi: {
    offlineBusinesses: "ऑफलाइन व्यवसाय", ecommerceSources: "ई-कॉमर्स स्रोत", offlineShops: "ऑफलाइन दुकानें", ecommerceShops: "ई-कॉमर्स दुकानें",
    offlineDescription: "ऑफलाइन उत्पाद निरीक्षणों के माध्यम से बनाई गई भौतिक दुकानें।", ecommerceDescription: "ई-कॉमर्स उत्पाद निरीक्षणों के स्रोत के रूप में उपयोग की जाने वाली वेबसाइटें। भौतिक दुकान के नाम के बजाय वेबसाइट का नाम दिखाया जाता है।",
    shops: "दुकानें", websites: "वेबसाइटें", compliant: "अनुपालक", needsReview: "समीक्षा आवश्यक", nonCompliant: "गैर-अनुपालक",
    allShops: "सभी दुकानें", allWebsites: "सभी वेबसाइटें", searchShop: "दुकान, शहर या पता खोजें...", searchWebsite: "वेबसाइट खोजें...", searchShops: "दुकानें खोजें", filterStatus: "दुकान की स्थिति फ़िल्टर करें", reset: "रीसेट",
    loadingOffline: "ऑफलाइन दुकानें लोड हो रही हैं...", loadingEcommerce: "ई-कॉमर्स वेबसाइटें लोड हो रही हैं...", noOffline: "वर्तमान फ़िल्टर से कोई ऑफलाइन दुकान मेल नहीं खाती।", noEcommerce: "वर्तमान फ़िल्टर से कोई ई-कॉमर्स वेबसाइट मेल नहीं खाती।",
    websiteSource: "वेबसाइट स्रोत", addressNotRecorded: "पता दर्ज नहीं है", products: "उत्पाद", inspections: "निरीक्षण", noInspection: "कोई निरीक्षण नहीं", deleting: "हटाया जा रहा है...", delete: "हटाएँ", deleteShop: "दुकान हटाएँ"
  },
  bn: {
    offlineBusinesses: "অফলাইন ব্যবসা", ecommerceSources: "ই-কমার্স উৎস", offlineShops: "অফলাইন দোকান", ecommerceShops: "ই-কমার্স দোকান",
    offlineDescription: "অফলাইন পণ্য পরিদর্শনের মাধ্যমে তৈরি করা ভৌত দোকান।", ecommerceDescription: "ই-কমার্স পণ্য পরিদর্শনের উৎস হিসেবে ব্যবহৃত ওয়েবসাইট। ভৌত দোকানের নামের পরিবর্তে ওয়েবসাইটের নাম দেখানো হয়।",
    shops: "দোকান", websites: "ওয়েবসাইট", compliant: "অনুগত", needsReview: "পর্যালোচনা প্রয়োজন", nonCompliant: "অননুগত",
    allShops: "সব দোকান", allWebsites: "সব ওয়েবসাইট", searchShop: "দোকান, শহর বা ঠিকানা খুঁজুন...", searchWebsite: "ওয়েবসাইট খুঁজুন...", searchShops: "দোকান খুঁজুন", filterStatus: "দোকানের অবস্থা ফিল্টার করুন", reset: "রিসেট",
    loadingOffline: "অফলাইন দোকান লোড হচ্ছে...", loadingEcommerce: "ই-কমার্স ওয়েবসাইট লোড হচ্ছে...", noOffline: "বর্তমান ফিল্টারের সাথে কোনো অফলাইন দোকান মেলেনি।", noEcommerce: "বর্তমান ফিল্টারের সাথে কোনো ই-কমার্স ওয়েবসাইট মেলেনি।",
    websiteSource: "ওয়েবসাইট উৎস", addressNotRecorded: "ঠিকানা রেকর্ড করা নেই", products: "পণ্য", inspections: "পরিদর্শন", noInspection: "কোনো পরিদর্শন নেই", deleting: "মুছে ফেলা হচ্ছে...", delete: "মুছুন", deleteShop: "দোকান মুছুন"
  },
  mr: {
    offlineBusinesses: "ऑफलाइन व्यवसाय", ecommerceSources: "ई-कॉमर्स स्रोत", offlineShops: "ऑफलाइन दुकाने", ecommerceShops: "ई-कॉमर्स दुकाने",
    offlineDescription: "ऑफलाइन उत्पादन तपासण्यांमधून तयार केलेली भौतिक दुकाने.", ecommerceDescription: "ई-कॉमर्स उत्पादन तपासण्यांसाठी स्रोत म्हणून वापरल्या जाणाऱ्या वेबसाइट्स. भौतिक दुकानाच्या नावाऐवजी वेबसाइटचे नाव दाखवले जाते.",
    shops: "दुकाने", websites: "वेबसाइट्स", compliant: "अनुपालक", needsReview: "पुनरावलोकन आवश्यक", nonCompliant: "अनुपालक नाही",
    allShops: "सर्व दुकाने", allWebsites: "सर्व वेबसाइट्स", searchShop: "दुकान, शहर किंवा पत्ता शोधा...", searchWebsite: "वेबसाइट शोधा...", searchShops: "दुकाने शोधा", filterStatus: "दुकानाची स्थिती फिल्टर करा", reset: "रीसेट",
    loadingOffline: "ऑफलाइन दुकाने लोड होत आहेत...", loadingEcommerce: "ई-कॉमर्स वेबसाइट्स लोड होत आहेत...", noOffline: "सध्याच्या फिल्टरशी कोणतेही ऑफलाइन दुकान जुळत नाही.", noEcommerce: "सध्याच्या फिल्टरशी कोणतीही ई-कॉमर्स वेबसाइट जुळत नाही.",
    websiteSource: "वेबसाइट स्रोत", addressNotRecorded: "पत्ता नोंदवलेला नाही", products: "उत्पादने", inspections: "तपासण्या", noInspection: "तपासणी नाही", deleting: "हटवत आहे...", delete: "हटवा", deleteShop: "दुकान हटवा"
  },
  gu: {
    offlineBusinesses: "ઓફલાઇન વ્યવસાયો", ecommerceSources: "ઈ-કોમર્સ સ્ત્રોતો", offlineShops: "ઓફલાઇન દુકાનો", ecommerceShops: "ઈ-કોમર્સ દુકાનો",
    offlineDescription: "ઓફલાઇન ઉત્પાદન નિરીક્ષણોથી બનાવાયેલી ભૌતિક દુકાનો.", ecommerceDescription: "ઈ-કોમર્સ ઉત્પાદન નિરીક્ષણોના સ્ત્રોત તરીકે ઉપયોગ થતી વેબસાઇટ્સ. ભૌતિક દુકાનના નામની જગ્યાએ વેબસાઇટનું નામ બતાવવામાં આવે છે.",
    shops: "દુકાનો", websites: "વેબસાઇટ્સ", compliant: "અનુરૂપ", needsReview: "સમીક્ષા જરૂરી", nonCompliant: "બિન-અનુરૂપ",
    allShops: "બધી દુકાનો", allWebsites: "બધી વેબસાઇટ્સ", searchShop: "દુકાન, શહેર અથવા સરનામું શોધો...", searchWebsite: "વેબસાઇટ શોધો...", searchShops: "દુકાનો શોધો", filterStatus: "દુકાનની સ્થિતિ ફિલ્ટર કરો", reset: "રીસેટ",
    loadingOffline: "ઓફલાઇન દુકાનો લોડ થઈ રહી છે...", loadingEcommerce: "ઈ-કોમર્સ વેબસાઇટ્સ લોડ થઈ રહી છે...", noOffline: "હાલના ફિલ્ટર સાથે કોઈ ઓફલાઇન દુકાન મેળ ખાતી નથી.", noEcommerce: "હાલના ફિલ્ટર સાથે કોઈ ઈ-કોમર્સ વેબસાઇટ મેળ ખાતી નથી.",
    websiteSource: "વેબસાઇટ સ્ત્રોત", addressNotRecorded: "સરનામું નોંધાયેલ નથી", products: "ઉત્પાદનો", inspections: "નિરીક્ષણો", noInspection: "કોઈ નિરીક્ષણ નથી", deleting: "કાઢી રહ્યું છે...", delete: "કાઢી નાખો", deleteShop: "દુકાન કાઢી નાખો"
  },
  ta: {
    offlineBusinesses: "ஆஃப்லைன் வணிகங்கள்", ecommerceSources: "இ-காமர்ஸ் ஆதாரங்கள்", offlineShops: "ஆஃப்லைன் கடைகள்", ecommerceShops: "இ-காமர்ஸ் கடைகள்",
    offlineDescription: "ஆஃப்லைன் தயாரிப்பு ஆய்வுகள் மூலம் உருவாக்கப்பட்ட உடல் கடைகள்.", ecommerceDescription: "இ-காமர்ஸ் தயாரிப்பு ஆய்வுகளுக்கான ஆதாரங்களாகப் பயன்படுத்தப்படும் இணையதளங்கள். உடல் கடை பெயருக்கு பதிலாக இணையதள பெயர் காட்டப்படும்.",
    shops: "கடைகள்", websites: "இணையதளங்கள்", compliant: "இணக்கமானது", needsReview: "மதிப்பாய்வு தேவை", nonCompliant: "இணக்கமற்றது",
    allShops: "அனைத்து கடைகள்", allWebsites: "அனைத்து இணையதளங்கள்", searchShop: "கடை, நகரம் அல்லது முகவரியைத் தேடுங்கள்...", searchWebsite: "இணையதளத்தைத் தேடுங்கள்...", searchShops: "கடைகளைத் தேடுங்கள்", filterStatus: "கடை நிலையை வடிகட்டுங்கள்", reset: "மீட்டமை",
    loadingOffline: "ஆஃப்லைன் கடைகள் ஏற்றப்படுகின்றன...", loadingEcommerce: "இ-காமர்ஸ் இணையதளங்கள் ஏற்றப்படுகின்றன...", noOffline: "தற்போதைய வடிகட்டிகளுடன் எந்த ஆஃப்லைன் கடையும் பொருந்தவில்லை.", noEcommerce: "தற்போதைய வடிகட்டிகளுடன் எந்த இ-காமர்ஸ் இணையதளமும் பொருந்தவில்லை.",
    websiteSource: "இணையதள மூலம்", addressNotRecorded: "முகவரி பதிவு செய்யப்படவில்லை", products: "தயாரிப்புகள்", inspections: "ஆய்வுகள்", noInspection: "ஆய்வு இல்லை", deleting: "நீக்கப்படுகிறது...", delete: "நீக்கு", deleteShop: "கடையை நீக்கு"
  },
  te: {
    offlineBusinesses: "ఆఫ్‌లైన్ వ్యాపారాలు", ecommerceSources: "ఈ-కామర్స్ వనరులు", offlineShops: "ఆఫ్‌లైన్ దుకాణాలు", ecommerceShops: "ఈ-కామర్స్ దుకాణాలు",
    offlineDescription: "ఆఫ్‌లైన్ ఉత్పత్తి తనిఖీల ద్వారా సృష్టించిన భౌతిక దుకాణాలు.", ecommerceDescription: "ఈ-కామర్స్ ఉత్పత్తి తనిఖీలకు మూలాలుగా ఉపయోగించే వెబ్‌సైట్‌లు. భౌతిక దుకాణం పేరుకు బదులుగా వెబ్‌సైట్ పేరు చూపబడుతుంది.",
    shops: "దుకాణాలు", websites: "వెబ్‌సైట్‌లు", compliant: "అనుగుణం", needsReview: "సమీక్ష అవసరం", nonCompliant: "అననుగుణం",
    allShops: "అన్ని దుకాణాలు", allWebsites: "అన్ని వెబ్‌సైట్‌లు", searchShop: "దుకాణం, నగరం లేదా చిరునామా శోధించండి...", searchWebsite: "వెబ్‌సైట్ శోధించండి...", searchShops: "దుకాణాలను శోధించండి", filterStatus: "దుకాణ స్థితిని ఫిల్టర్ చేయండి", reset: "రీసెట్",
    loadingOffline: "ఆఫ్‌లైన్ దుకాణాలు లోడ్ అవుతున్నాయి...", loadingEcommerce: "ఈ-కామర్స్ వెబ్‌సైట్‌లు లోడ్ అవుతున్నాయి...", noOffline: "ప్రస్తుత ఫిల్టర్‌లకు ఏ ఆఫ్‌లైన్ దుకాణం సరిపోలలేదు.", noEcommerce: "ప్రస్తుత ఫిల్టర్‌లకు ఏ ఈ-కామర్స్ వెబ్‌సైట్ సరిపోలలేదు.",
    websiteSource: "వెబ్‌సైట్ మూలం", addressNotRecorded: "చిరునామా నమోదు కాలేదు", products: "ఉత్పత్తులు", inspections: "తనిఖీలు", noInspection: "తనిఖీ లేదు", deleting: "తొలగిస్తోంది...", delete: "తొలగించు", deleteShop: "దుకాణాన్ని తొలగించు"
  },
  kn: {
    offlineBusinesses: "ಆಫ್‌ಲೈನ್ ವ್ಯವಹಾರಗಳು", ecommerceSources: "ಇ-ಕಾಮರ್ಸ್ ಮೂಲಗಳು", offlineShops: "ಆಫ್‌ಲೈನ್ ಅಂಗಡಿಗಳು", ecommerceShops: "ಇ-ಕಾಮರ್ಸ್ ಅಂಗಡಿಗಳು",
    offlineDescription: "ಆಫ್‌ಲೈನ್ ಉತ್ಪನ್ನ ಪರಿಶೀಲನೆಗಳಿಂದ ರಚಿಸಲಾದ ಭೌತಿಕ ಅಂಗಡಿಗಳು.", ecommerceDescription: "ಇ-ಕಾಮರ್ಸ್ ಉತ್ಪನ್ನ ಪರಿಶೀಲನೆಗಳಿಗೆ ಮೂಲಗಳಾಗಿ ಬಳಸುವ ವೆಬ್‌ಸೈಟ್‌ಗಳು. ಭೌತಿಕ ಅಂಗಡಿಯ ಹೆಸರಿನ ಬದಲು ವೆಬ್‌ಸೈಟ್ ಹೆಸರು ತೋರಿಸಲಾಗುತ್ತದೆ.",
    shops: "ಅಂಗಡಿಗಳು", websites: "ವೆಬ್‌ಸೈಟ್‌ಗಳು", compliant: "ಅನುಗುಣ", needsReview: "ಪರಿಶೀಲನೆ ಅಗತ್ಯ", nonCompliant: "ಅನುಗುಣವಲ್ಲ",
    allShops: "ಎಲ್ಲಾ ಅಂಗಡಿಗಳು", allWebsites: "ಎಲ್ಲಾ ವೆಬ್‌ಸೈಟ್‌ಗಳು", searchShop: "ಅಂಗಡಿ, ನಗರ ಅಥವಾ ವಿಳಾಸ ಹುಡುಕಿ...", searchWebsite: "ವೆಬ್‌ಸೈಟ್ ಹುಡುಕಿ...", searchShops: "ಅಂಗಡಿಗಳನ್ನು ಹುಡುಕಿ", filterStatus: "ಅಂಗಡಿ ಸ್ಥಿತಿಯನ್ನು ಫಿಲ್ಟರ್ ಮಾಡಿ", reset: "ಮರುಹೊಂದಿಸಿ",
    loadingOffline: "ಆಫ್‌ಲೈನ್ ಅಂಗಡಿಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ...", loadingEcommerce: "ಇ-ಕಾಮರ್ಸ್ ವೆಬ್‌ಸೈಟ್‌ಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ...", noOffline: "ಪ್ರಸ್ತುತ ಫಿಲ್ಟರ್‌ಗಳಿಗೆ ಯಾವುದೇ ಆಫ್‌ಲೈನ್ ಅಂಗಡಿ ಹೊಂದಿಕೆಯಾಗಿಲ್ಲ.", noEcommerce: "ಪ್ರಸ್ತುತ ಫಿಲ್ಟರ್‌ಗಳಿಗೆ ಯಾವುದೇ ಇ-ಕಾಮರ್ಸ್ ವೆಬ್‌ಸೈಟ್ ಹೊಂದಿಕೆಯಾಗಿಲ್ಲ.",
    websiteSource: "ವೆಬ್‌ಸೈಟ್ ಮೂಲ", addressNotRecorded: "ವಿಳಾಸ ದಾಖಲಾಗಿಲ್ಲ", products: "ಉತ್ಪನ್ನಗಳು", inspections: "ಪರಿಶೀಲನೆಗಳು", noInspection: "ಪರಿಶೀಲನೆ ಇಲ್ಲ", deleting: "ಅಳಿಸಲಾಗುತ್ತಿದೆ...", delete: "ಅಳಿಸಿ", deleteShop: "ಅಂಗಡಿ ಅಳಿಸಿ"
  },
  ml: {
    offlineBusinesses: "ഓഫ്‌ലൈൻ ബിസിനസുകൾ", ecommerceSources: "ഇ-കൊമേഴ്‌സ് ഉറവിടങ്ങൾ", offlineShops: "ഓഫ്‌ലൈൻ കടകൾ", ecommerceShops: "ഇ-കൊമേഴ്‌സ് കടകൾ",
    offlineDescription: "ഓഫ്‌ലൈൻ ഉൽപ്പന്ന പരിശോധനകളിലൂടെ സൃഷ്ടിച്ച ഭൗതിക കടകൾ.", ecommerceDescription: "ഇ-കൊമേഴ്‌സ് ഉൽപ്പന്ന പരിശോധനകൾക്കുള്ള ഉറവിടങ്ങളായി ഉപയോഗിക്കുന്ന വെബ്‌സൈറ്റുകൾ. ഭൗതിക കടയുടെ പേരിന് പകരം വെബ്‌സൈറ്റ് പേര് കാണിക്കും.",
    shops: "കടകൾ", websites: "വെബ്‌സൈറ്റുകൾ", compliant: "അനുസൃതം", needsReview: "പരിശോധന ആവശ്യമാണ്", nonCompliant: "അനുസൃതമല്ല",
    allShops: "എല്ലാ കടകളും", allWebsites: "എല്ലാ വെബ്‌സൈറ്റുകളും", searchShop: "കട, നഗരം അല്ലെങ്കിൽ വിലാസം തിരയുക...", searchWebsite: "വെബ്‌സൈറ്റ് തിരയുക...", searchShops: "കടകൾ തിരയുക", filterStatus: "കടയുടെ നില ഫിൽട്ടർ ചെയ്യുക", reset: "റീസെറ്റ്",
    loadingOffline: "ഓഫ്‌ലൈൻ കടകൾ ലോഡ് ചെയ്യുന്നു...", loadingEcommerce: "ഇ-കൊമേഴ്‌സ് വെബ്‌സൈറ്റുകൾ ലോഡ് ചെയ്യുന്നു...", noOffline: "നിലവിലെ ഫിൽട്ടറുകളുമായി ഓഫ്‌ലൈൻ കടകളൊന്നും പൊരുത്തപ്പെടുന്നില്ല.", noEcommerce: "നിലവിലെ ഫിൽട്ടറുകളുമായി ഇ-കൊമേഴ്‌സ് വെബ്‌സൈറ്റൊന്നും പൊരുത്തപ്പെടുന്നില്ല.",
    websiteSource: "വെബ്‌സൈറ്റ് ഉറവിടം", addressNotRecorded: "വിലാസം രേഖപ്പെടുത്തിയിട്ടില്ല", products: "ഉൽപ്പന്നങ്ങൾ", inspections: "പരിശോധനകൾ", noInspection: "പരിശോധന ഇല്ല", deleting: "ഇല്ലാതാക്കുന്നു...", delete: "ഇല്ലാതാക്കുക", deleteShop: "കട ഇല്ലാതാക്കുക"
  },
  pa: {
    offlineBusinesses: "ਆਫਲਾਈਨ ਕਾਰੋਬਾਰ", ecommerceSources: "ਈ-ਕਾਮਰਸ ਸਰੋਤ", offlineShops: "ਆਫਲਾਈਨ ਦੁਕਾਨਾਂ", ecommerceShops: "ਈ-ਕਾਮਰਸ ਦੁਕਾਨਾਂ",
    offlineDescription: "ਆਫਲਾਈਨ ਉਤਪਾਦ ਜਾਂਚਾਂ ਰਾਹੀਂ ਬਣੀਆਂ ਭੌਤਿਕ ਦੁਕਾਨਾਂ।", ecommerceDescription: "ਈ-ਕਾਮਰਸ ਉਤਪਾਦ ਜਾਂਚਾਂ ਲਈ ਸਰੋਤ ਵਜੋਂ ਵਰਤੀਆਂ ਜਾਣ ਵਾਲੀਆਂ ਵੈੱਬਸਾਈਟਾਂ। ਭੌਤਿਕ ਦੁਕਾਨ ਦੇ ਨਾਮ ਦੀ ਥਾਂ ਵੈੱਬਸਾਈਟ ਦਾ ਨਾਮ ਦਿਖਾਇਆ ਜਾਂਦਾ ਹੈ।",
    shops: "ਦੁਕਾਨਾਂ", websites: "ਵੈੱਬਸਾਈਟਾਂ", compliant: "ਅਨੁਕੂਲ", needsReview: "ਸਮੀਖਿਆ ਲੋੜੀਂਦੀ", nonCompliant: "ਗੈਰ-ਅਨੁਕੂਲ",
    allShops: "ਸਾਰੀਆਂ ਦੁਕਾਨਾਂ", allWebsites: "ਸਾਰੀਆਂ ਵੈੱਬਸਾਈਟਾਂ", searchShop: "ਦੁਕਾਨ, ਸ਼ਹਿਰ ਜਾਂ ਪਤਾ ਖੋਜੋ...", searchWebsite: "ਵੈੱਬਸਾਈਟ ਖੋਜੋ...", searchShops: "ਦੁਕਾਨਾਂ ਖੋਜੋ", filterStatus: "ਦੁਕਾਨ ਦੀ ਸਥਿਤੀ ਫਿਲਟਰ ਕਰੋ", reset: "ਰੀਸੈੱਟ",
    loadingOffline: "ਆਫਲਾਈਨ ਦੁਕਾਨਾਂ ਲੋਡ ਹੋ ਰਹੀਆਂ ਹਨ...", loadingEcommerce: "ਈ-ਕਾਮਰਸ ਵੈੱਬਸਾਈਟਾਂ ਲੋਡ ਹੋ ਰਹੀਆਂ ਹਨ...", noOffline: "ਮੌਜੂਦਾ ਫਿਲਟਰਾਂ ਨਾਲ ਕੋਈ ਆਫਲਾਈਨ ਦੁਕਾਨ ਨਹੀਂ ਮਿਲੀ।", noEcommerce: "ਮੌਜੂਦਾ ਫਿਲਟਰਾਂ ਨਾਲ ਕੋਈ ਈ-ਕਾਮਰਸ ਵੈੱਬਸਾਈਟ ਨਹੀਂ ਮਿਲੀ।",
    websiteSource: "ਵੈੱਬਸਾਈਟ ਸਰੋਤ", addressNotRecorded: "ਪਤਾ ਦਰਜ ਨਹੀਂ", products: "ਉਤਪਾਦ", inspections: "ਜਾਂਚਾਂ", noInspection: "ਕੋਈ ਜਾਂਚ ਨਹੀਂ", deleting: "ਮਿਟਾਇਆ ਜਾ ਰਿਹਾ ਹੈ...", delete: "ਮਿਟਾਓ", deleteShop: "ਦੁਕਾਨ ਮਿਟਾਓ"
  },
  or: {
    offlineBusinesses: "ଅଫଲାଇନ ବ୍ୟବସାୟ", ecommerceSources: "ଇ-କମର୍ସ ଉତ୍ସ", offlineShops: "ଅଫଲାଇନ ଦୋକାନ", ecommerceShops: "ଇ-କମର୍ସ ଦୋକାନ",
    offlineDescription: "ଅଫଲାଇନ ଉତ୍ପାଦ ଯାଞ୍ଚ ମାଧ୍ୟମରେ ସୃଷ୍ଟି ହୋଇଥିବା ଭୌତିକ ଦୋକାନ।", ecommerceDescription: "ଇ-କମର୍ସ ଉତ୍ପାଦ ଯାଞ୍ଚର ଉତ୍ସ ଭାବେ ବ୍ୟବହୃତ ୱେବସାଇଟ। ଭୌତିକ ଦୋକାନ ନାମ ପରିବର୍ତ୍ତେ ୱେବସାଇଟ ନାମ ଦେଖାଯାଏ।",
    shops: "ଦୋକାନ", websites: "ୱେବସାଇଟ", compliant: "ଅନୁପାଳନ", needsReview: "ସମୀକ୍ଷା ଆବଶ୍ୟକ", nonCompliant: "ଅନୁପାଳନ ନୁହେଁ",
    allShops: "ସମସ୍ତ ଦୋକାନ", allWebsites: "ସମସ୍ତ ୱେବସାଇଟ", searchShop: "ଦୋକାନ, ସହର କିମ୍ବା ଠିକଣା ଖୋଜନ୍ତୁ...", searchWebsite: "ୱେବସାଇଟ ଖୋଜନ୍ତୁ...", searchShops: "ଦୋକାନ ଖୋଜନ୍ତୁ", filterStatus: "ଦୋକାନ ସ୍ଥିତି ଫିଲ୍ଟର କରନ୍ତୁ", reset: "ରିସେଟ",
    loadingOffline: "ଅଫଲାଇନ ଦୋକାନ ଲୋଡ ହେଉଛି...", loadingEcommerce: "ଇ-କମର୍ସ ୱେବସାଇଟ ଲୋଡ ହେଉଛି...", noOffline: "ବର୍ତ୍ତମାନର ଫିଲ୍ଟର ସହ କୌଣସି ଅଫଲାଇନ ଦୋକାନ ମେଳ ଖାଉନାହିଁ।", noEcommerce: "ବର୍ତ୍ତମାନର ଫିଲ୍ଟର ସହ କୌଣସି ଇ-କମର୍ସ ୱେବସାଇଟ ମେଳ ଖାଉନାହିଁ।",
    websiteSource: "ୱେବସାଇଟ ଉତ୍ସ", addressNotRecorded: "ଠିକଣା ରେକର୍ଡ ହୋଇନାହିଁ", products: "ଉତ୍ପାଦ", inspections: "ଯାଞ୍ଚ", noInspection: "କୌଣସି ଯାଞ୍ଚ ନାହିଁ", deleting: "ଡିଲିଟ ହେଉଛି...", delete: "ଡିଲିଟ", deleteShop: "ଦୋକାନ ଡିଲିଟ କରନ୍ତୁ"
  },
  as: {
    offlineBusinesses: "অফলাইন ব্যৱসায়", ecommerceSources: "ই-কমাৰ্চ উৎস", offlineShops: "অফলাইন দোকান", ecommerceShops: "ই-কমাৰ্চ দোকান",
    offlineDescription: "অফলাইন পণ্য পৰিদৰ্শনৰ জৰিয়তে সৃষ্টি কৰা ভৌতিক দোকান।", ecommerceDescription: "ই-কমাৰ্চ পণ্য পৰিদৰ্শনৰ উৎস হিচাপে ব্যৱহৃত ৱেবছাইট। ভৌতিক দোকানৰ নামৰ সলনি ৱেবছাইটৰ নাম দেখুওৱা হয়।",
    shops: "দোকান", websites: "ৱেবছাইট", compliant: "অনুগত", needsReview: "পৰ্যালোচনা প্ৰয়োজন", nonCompliant: "অননুগত",
    allShops: "সকলো দোকান", allWebsites: "সকলো ৱেবছাইট", searchShop: "দোকান, চহৰ বা ঠিকনা বিচাৰক...", searchWebsite: "ৱেবছাইট বিচাৰক...", searchShops: "দোকান বিচাৰক", filterStatus: "দোকানৰ অৱস্থা ফিল্টাৰ কৰক", reset: "ৰিছেট",
    loadingOffline: "অফলাইন দোকান লোড হৈ আছে...", loadingEcommerce: "ই-কমাৰ্চ ৱেবছাইট লোড হৈ আছে...", noOffline: "বৰ্তমান ফিল্টাৰৰ সৈতে কোনো অফলাইন দোকান মিল নাই।", noEcommerce: "বৰ্তমান ফিল্টাৰৰ সৈতে কোনো ই-কমাৰ্চ ৱেবছাইট মিল নাই।",
    websiteSource: "ৱেবছাইট উৎস", addressNotRecorded: "ঠিকনা ৰেকৰ্ড কৰা হোৱা নাই", products: "পণ্য", inspections: "পৰিদৰ্শন", noInspection: "কোনো পৰিদৰ্শন নাই", deleting: "মচি পেলোৱা হৈছে...", delete: "মচক", deleteShop: "দোকান মচক"
  },
  ur: {
    offlineBusinesses: "آف لائن کاروبار", ecommerceSources: "ای کامرس ذرائع", offlineShops: "آف لائن دکانیں", ecommerceShops: "ای کامرس دکانیں",
    offlineDescription: "آف لائن مصنوعات کے معائنوں کے ذریعے بنائی گئی جسمانی دکانیں۔", ecommerceDescription: "ای کامرس مصنوعات کے معائنوں کے ذرائع کے طور پر استعمال ہونے والی ویب سائٹس۔ جسمانی دکان کے نام کے بجائے ویب سائٹ کا نام دکھایا جاتا ہے۔",
    shops: "دکانیں", websites: "ویب سائٹس", compliant: "مطابق", needsReview: "جائزہ درکار", nonCompliant: "غیر مطابق",
    allShops: "تمام دکانیں", allWebsites: "تمام ویب سائٹس", searchShop: "دکان، شہر یا پتہ تلاش کریں...", searchWebsite: "ویب سائٹ تلاش کریں...", searchShops: "دکانیں تلاش کریں", filterStatus: "دکان کی حیثیت فلٹر کریں", reset: "ری سیٹ",
    loadingOffline: "آف لائن دکانیں لوڈ ہو رہی ہیں...", loadingEcommerce: "ای کامرس ویب سائٹس لوڈ ہو رہی ہیں...", noOffline: "موجودہ فلٹرز سے کوئی آف لائن دکان مطابقت نہیں رکھتی۔", noEcommerce: "موجودہ فلٹرز سے کوئی ای کامرس ویب سائٹ مطابقت نہیں رکھتی۔",
    websiteSource: "ویب سائٹ ذریعہ", addressNotRecorded: "پتہ درج نہیں", products: "مصنوعات", inspections: "معائنے", noInspection: "کوئی معائنہ نہیں", deleting: "حذف ہو رہا ہے...", delete: "حذف کریں", deleteShop: "دکان حذف کریں"
  }
};

function Shops() {
  const { language } = useLanguage();
  const copy = SHOP_COPY[language] || SHOP_COPY.en;
  const [shops, setShops] = useState([]);
  const [view, setView] = useState("OFFLINE");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const r = await apiFetch(`${API_URL}/shops?q=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}&sourceType=${view}`);
      const data = await r.json().catch(() => []);
      if (!r.ok) throw new Error(data?.error || "Could not load shops");
      setShops(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "Could not load shops");
      setShops([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [query, status, view]);

  const summary = useMemo(() => ({
    total: shops.length,
    compliant: shops.filter((s) => s.status === "COMPLIANT").length,
    review: shops.filter((s) => s.status === "REVIEW").length,
    nonCompliant: shops.filter((s) => s.status === "NON_COMPLIANT").length,
  }), [shops]);

  const ecommerce = view === "ECOMMERCE";

  function resetFilters() {
    setQuery("");
    setStatus("ALL");
  }

  async function deleteShop(event, shop) {
    event.preventDefault();
    event.stopPropagation();
    const confirmed = window.confirm(`Delete ${shop.name}? This will also delete its inspection records.`);
    if (!confirmed) return;

    setDeletingId(shop.id);
    setError("");

    // Optimistic removal keeps the interface instant while the database finishes the deletion.
    setShops((current) => current.filter((item) => item.id !== shop.id));

    try {
      const response = await apiFetch(`${API_URL}/shops/${shop.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Could not delete shop");
    } catch (e) {
      setShops((current) => {
        if (current.some((item) => item.id === shop.id)) return current;
        return [...current, shop].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      });
      setError(e?.message || "Could not delete shop");
    } finally {
      setDeletingId(null);
    }
  }

  return <div className="shops-page">
    <div className="page-header">
      <p className="eyebrow">{ecommerce ? copy.ecommerceSources : copy.offlineBusinesses}</p>
      <h1>{ecommerce ? copy.ecommerceShops : copy.offlineShops}</h1>
      <p>{ecommerce ? copy.ecommerceDescription : copy.offlineDescription}</p>
    </div>

    <div className="shop-source-tabs" role="tablist" aria-label="Shop source">
      <button type="button" className={view === "OFFLINE" ? "active" : ""} onClick={() => setView("OFFLINE")}>{copy.offlineShops}</button>
      <button type="button" className={view === "ECOMMERCE" ? "active" : ""} onClick={() => setView("ECOMMERCE")}>{copy.ecommerceShops}</button>
    </div>

    <div className="shop-summary">
      <div><span>{ecommerce ? copy.websites : copy.shops}</span><strong>{summary.total}</strong></div>
      <div><span>{copy.compliant}</span><strong>{summary.compliant}</strong></div>
      <div><span>{copy.needsReview}</span><strong>{summary.review}</strong></div>
      <div><span>{copy.nonCompliant}</span><strong>{summary.nonCompliant}</strong></div>
    </div>

    <div className="shop-search">
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={ecommerce ? copy.searchWebsite : copy.searchShop} aria-label={copy.searchShops} />
      <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={copy.filterStatus}>
        <option value="ALL">{ecommerce ? copy.allWebsites : copy.allShops}</option>
        <option value="COMPLIANT">{copy.compliant}</option>
        <option value="REVIEW">{copy.needsReview}</option>
        <option value="NON_COMPLIANT">{copy.nonCompliant}</option>
      </select>
      <button type="button" className="shop-clear" onClick={resetFilters}>{copy.reset}</button>
    </div>

    {error && <div className="status-message">{error}</div>}
    {loading && <p className="shops-loading">{ecommerce ? copy.loadingEcommerce : copy.loadingOffline}</p>}
    {!loading && !error && !shops.length && <div className="status-message">{ecommerce ? copy.noEcommerce : copy.noOffline}</div>}

    {!loading && !error && shops.length > 0 && <div className="shop-grid">
      {shops.map((shop) => <article key={shop.id} className="shop-card">
        <Link to={`/shops/${shop.id}`} className="shop-card-main">
          <div className="shop-card-header">
            <h2 data-no-auto-translate="true" className="shop-identity">{shop.name}</h2>
            <span className={`shop-status ${String(shop.status || "REVIEW").toLowerCase()}`}>{String(shop.status || "REVIEW").replace("_", " ")}</span>
          </div>
          <p>{ecommerce ? copy.websiteSource : ([shop.address, shop.city, shop.state].filter(Boolean).join(", ") || copy.addressNotRecorded)}</p>
          <div className="shop-card-footer">
            <span>{shop.productCount ?? 0} {copy.products}</span>
            <span>{shop.inspectionCount ?? 0} {copy.inspections}</span>
            <span>{shop.lastInspection ? new Date(shop.lastInspection).toLocaleDateString() : copy.noInspection}</span>
          </div>
        </Link>
        <button type="button" className="shop-delete" onClick={(event) => deleteShop(event, shop)} disabled={deletingId === shop.id} aria-label={`${copy.deleteShop}: ${shop.name}`}>
          {deletingId === shop.id ? copy.deleting : copy.delete}
        </button>
      </article>)}
    </div>}
  </div>;
}

export default Shops;
