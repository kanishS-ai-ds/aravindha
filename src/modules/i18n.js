/**
 * ARAVINDHA Dashboard — Multi-Language Localization (i18n) Engine
 * Full UI translation support. The selector carries all 22 scheduled
 * languages of India (Eighth Schedule of the Constitution) plus English.
 * Languages without a full phrase dictionary yet fall back to English
 * phrase-by-phrase via t(), so nothing ever renders blank — dictionaries
 * fill in incrementally (see DICTIONARY below).
 */

export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  // — The 22 scheduled languages of India —
  { code: 'as', name: 'Assamese', native: 'অসমীয়া' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'brx', name: 'Bodo', native: 'बड़ो' },
  { code: 'doi', name: 'Dogri', native: 'डोगरी' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ks', name: 'Kashmiri', native: 'کٲشُر' },
  { code: 'kok', name: 'Konkani', native: 'कोंकणी' },
  { code: 'mai', name: 'Maithili', native: 'मैथिली' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'mni', name: 'Manipuri', native: 'ꯃꯦꯏꯇꯦꯏ' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'ne', name: 'Nepali', native: 'नेपाली' },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'sa', name: 'Sanskrit', native: 'संस्कृतम्' },
  { code: 'sat', name: 'Santali', native: 'ᱥᱟᱱᱛᱟᱲᱤ' },
  { code: 'sd', name: 'Sindhi', native: 'سنڌي' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'ur', name: 'Urdu', native: 'اردو' }
];

// Master phrase glossary (English to target language mappings)
export const DICTIONARY = {
  // English
  en: {},

  // Hindi (हिन्दी)
  hi: {
    "NORTH EASTERN REGION": "पूर्वोत्तर क्षेत्र",
    "Disaster Monitoring Command Center": "आपदा निगरानी कमान केंद्र",
    "DISASTER INTELLIGENCE": "आपदा आसूचना प्रणाली",
    "COMMAND CENTER": "कमान केंद्र",
    "Overview": "अवलोकन",
    "Risk Map": "जोखिम मानचित्र",
    "Alerts": "चेतावनियां",
    "Field Reports": "फील्ड रिपोर्ट",
    "Analytics": "विश्लेषण (एनालिटिक्स)",
    "SYSTEM": "प्रणाली",
    "Settings": "सेटिंग्स",
    "System Online": "सिस्टम ऑनलाइन",
    "Monitoring network active": "निगरानी नेटवर्क सक्रिय",
    "Toggle Theme": "थीम बदलें",
    "EARLY WARNING NETWORK": "पूर्व चेतावनी नेटवर्क",
    "Monitoring rainfall, soil moisture, terrain, landslide, earthquake and satellite indicators across NER.": "पूर्वोत्तर क्षेत्र में वर्षा, मिट्टी की नमी, भूस्खलन, भूकंप और उपग्रह संकेतकों की रीयल-टाइम निगरानी।",
    "View Alerts": "चेतावनियां देखें",
    "Send Alert Now (SMS)": "📲 चेतावनी भेजें (SMS)",
    "EARLY WARNING SMS AUDIT LOG": "पूर्व चेतावनी SMS ऑडिट लॉग",
    "LANDSLIDE RISK": "भूस्खलन जोखिम",
    "RAINFALL": "वर्षा (24 घंटे)",
    "SOIL MOISTURE": "मिट्टी की नमी",
    "EARTHQUAKE": "भूकंप गतिविधि",
    "MONITORING": "निगरानी जारी",
    "LOADING": "लोड हो रहा है...",
    "Provisional evidence score": "संभावित साक्ष्य स्कोर",
    "Open-Meteo model data": "Open-Meteo मॉडल डेटा",
    "USGS — past 24h": "USGS — पिछले 24 घंटे",
    "GEOSPATIAL INTELLIGENCE": "भू-स्थानिक सूचना प्रणाली",
    "NER Hazard Map": "पूर्वोत्तर आपदा मानचित्र",
    "LIVE HEATMAP": "🔥 लाइव हीटमैप",
    "HIGHWAYS": "🛣️ राजमार्ग",
    "LANDSLIDES": "🌋 भूस्खलन",
    "FLASH FLOODS": "🌊 अचानक बाढ़",
    "SATELLITE": "🛰️ उपग्रह",
    "3D TERRAIN": "⛰️ 3D इलाका",
    "LIVE EARTH": "🌍 लाइव अर्थ",
    "HAZARD RISK INTENSITY": "आपदा जोखिम तीव्रता",
    "ACTIVE LAYERS": "सक्रिय परतें",
    "Severe Risk Hotspot": "गंभीर जोखिम हॉटस्पॉट",
    "High Landslide Risk": "उच्च भूस्खलन जोखिम",
    "Flash Flood Basin": "अचानक बाढ़ बेसिन",
    "Passable Corridor": "खुला गलियारा",
    "Watch (Runoff/Slow)": "निगरानी (धीमी गति)",
    "Caution (Slip Zone)": "सावधानी (खिसकाव क्षेत्र)",
    "Earthquakes (USGS)": "भूकंप (USGS)",
    "Landslides": "भूस्खलन",
    "Flash Floods": "अचानक बाढ़",
    "Hotspots": "हॉटस्पॉट",
    "Highways": "राजमार्ग",
    "ARAVINDHA ENGINE": "अरविंदा इंजन",
    "Landslide Risk": "भूस्खलन जोखिम",
    "REGIONAL RISK ANALYTICS": "क्षेत्रीय जोखिम विश्लेषण",
    "Historical Landslide Events & Corridor Connectivity": "ऐतिहासिक भूस्खलन घटनाएं और सड़क संपर्क",
    "Monthly Landslide Events": "मासिक भूस्खलन घटनाएं",
    "Road & Evacuation Corridors": "सड़क और निकासी गलियारे",
    "Yearly": "वार्षिक",
    "Monthly": "मासिक",
    "All Years (2016-2026)": "सभी वर्ष (2016-2026)",
    "CONFIGURATION": "कॉन्फ़िगरेशन",
    "System Settings & Recipient Directory": "सिस्टम सेटिंग्स और संपर्क निर्देशिका",
    "Automated Warning Rules": "स्वचालित चेतावनी नियम",
    "Auto-SMS on SEVERE Risk Level": "गंभीर जोखिम पर स्वचालित SMS भेजें",
    "Real-Time SMS Gateway Configuration": "रीयल-टाइम SMS गेटवे कॉन्फ़िगरेशन",
    "Active SMS Provider": "सक्रिय SMS प्रदाता",
    "Instant SMS Delivery Diagnostic Tester": "त्वरित SMS डिलीवरी परीक्षक",
    "Emergency SMS Recipients": "आपातकालीन SMS प्राप्तकर्ता",
    "Send Test SMS": "🚀 परीक्षण SMS भेजें",
    "Save Gateway Settings": "💾 गेटवे सेटिंग्स सहेजें",
    "Add Contact": "+ संपर्क जोड़ें",
    "Check Live Quota": "📊 लाइव कोटा जांचें",
    "TIME": "समय",
    "TYPE": "प्रकार",
    "MESSAGE": "संदेश",
    "RECIPIENTS": "प्राप्तकर्ता",
    "DELIVERY STATUS": "वितरण स्थिति",
    "PASSABLE": "खुला मार्ग",
    "WATCH": "निगरानी",
    "CAUTION": "सावधानी",
    "LOW": "कम",
    "MOD": "मध्यम",
    "HIGH": "उच्च",
    "SEVERE": "गंभीर",
    "CRITICAL": "अति गंभीर",
    "Name / Role": "नाम / पद",
    "Phone Number": "फ़ोन नंबर",
    "District / Region": "ज़िला / क्षेत्र",
    "Action": "कार्रवाई",
    "Delete": "हटाएं"
  },

  // Assamese (অসমীয়া)
  as: {
    "NORTH EASTERN REGION": "উত্তৰ-পূৰ্বাঞ্চল",
    "Disaster Monitoring Command Center": "দুৰ্যোগ নিৰীক্ষণ কমাণ্ড চেণ্টাৰ",
    "DISASTER INTELLIGENCE": "দুৰ্যোগ তথ্য প্ৰণালী",
    "COMMAND CENTER": "কমাণ্ড চেণ্টাৰ",
    "Overview": "সামগ্ৰিক দৃশ্য",
    "Risk Map": "বিপদৰ মানচিত্ৰ",
    "Alerts": "সতৰ্কবাৰ্তা",
    "Field Reports": "ক্ষেত্ৰ প্ৰতিবেদন",
    "Analytics": "বিশ্লেষণ (এনালাইটিক্স)",
    "SYSTEM": "পদ্ধতি",
    "Settings": "ছেটিংছ",
    "System Online": "ছিষ্টেম অনলাইন",
    "Monitoring network active": "নিৰীক্ষণ নেটৱৰ্ক সক্ৰিয়",
    "Toggle Theme": "থীম সলনি কৰক",
    "EARLY WARNING NETWORK": "আগতীয়া সতৰ্কবাৰ্তা নেটৱৰ্ক",
    "Monitoring rainfall, soil moisture, terrain, landslide, earthquake and satellite indicators across NER.": "উত্তৰ-পূৰ্বাঞ্চলত বৰষুণ, মাটিৰ আৰ্দ্ৰতা, ভূমিস্খলন, ভূমিকম্প আৰু উপগ্ৰহ সূচকসমূহ নিৰীক্ষণ।",
    "View Alerts": "সতৰ্কবাৰ্তা চাওক",
    "Send Alert Now (SMS)": "📲 সতৰ্কবাৰ্তা প্ৰেৰণ কৰক (SMS)",
    "EARLY WARNING SMS AUDIT LOG": "আগতীয়া সতৰ্কবাৰ্তা SMS অভিলেখ",
    "LANDSLIDE RISK": "ভূমিস্খলন বিপদ",
    "RAINFALL": "বৰষুণ (২৪ ঘণ্টা)",
    "SOIL MOISTURE": "মাটিৰ আৰ্দ্ৰতা",
    "EARTHQUAKE": "ভূমিকম্প",
    "MONITORING": "নিৰীক্ষণ চলি আছে",
    "LOADING": "লোড হৈ আছে...",
    "Provisional evidence score": "সম্ভাব্য প্ৰমাণ স্ক'ৰ",
    "Open-Meteo model data": "Open-Meteo মডেল তথ্য",
    "USGS — past 24h": "USGS — বিগত ২৪ ঘণ্টা",
    "GEOSPATIAL INTELLIGENCE": "ভৌগোলিক তথ্য প্ৰণালী",
    "NER Hazard Map": "উত্তৰ-পূব দুৰ্যোগ মানচিত্ৰ",
    "LIVE HEATMAP": "🔥 লাইভ হিটমেপ",
    "HIGHWAYS": "🛣️ ৰাজপথ",
    "LANDSLIDES": "🌋 ভূমিস্খলন",
    "FLASH FLOODS": "🌊 হঠাৎ বানপানী",
    "SATELLITE": "🛰️ উপগ্ৰহ",
    "3D TERRAIN": "⛰️ 3D ভূমি",
    "LIVE EARTH": "🌍 লাইভ পৃথিৱী",
    "HAZARD RISK INTENSITY": "দুৰ্যোগ বিপদৰ মাত্ৰা",
    "ACTIVE LAYERS": "সক্ৰিয় স্তৰসমূহ",
    "Severe Risk Hotspot": "গুৰুতৰ বিপদ কেন্দ্ৰ",
    "High Landslide Risk": "উচ্চ ভূমিস্খলন বিপদ",
    "Flash Flood Basin": "বানপানী অৱবাহিকা",
    "Passable Corridor": "চলিব পৰা পথ",
    "Watch (Runoff/Slow)": "নজৰ ৰাখক (ধীৰ গতি)",
    "Caution (Slip Zone)": "সাৱধান (স্খলন অঞ্চল)",
    "Earthquakes (USGS)": "ভূমিকম্প (USGS)",
    "Landslides": "ভূমিস্খলন",
    "Flash Floods": "হঠাৎ বানপানী",
    "Hotspots": "হটস্পট",
    "Highways": "ৰাজপথ",
    "ARAVINDHA ENGINE": "অৰবিন্দা ইঞ্জিন",
    "Landslide Risk": "ভূমিস্খলন বিপদ",
    "REGIONAL RISK ANALYTICS": "আঞ্চলিক বিপদ বিশ্লেষণ",
    "Historical Landslide Events & Corridor Connectivity": "ঐতিহাসিক ভূমিস্খলন আৰু পথ যোগাযোগ",
    "Monthly Landslide Events": "মাহেকীয়া ভূমিস্খলন ঘটনা",
    "Road & Evacuation Corridors": "পথ আৰু স্থানান্তৰ কৰিডৰ",
    "Yearly": "বাৰ্ষিক",
    "Monthly": "মাহেকীয়া",
    "All Years (2016-2026)": "সকলো বছৰ (২০১৬-২০২৬)",
    "CONFIGURATION": "কনফিগাৰেচন",
    "System Settings & Recipient Directory": "ছিষ্টেম ছেটিংছ আৰু যোগাযোগ তালিকা",
    "Automated Warning Rules": "স্বয়ংক্ৰিয় সতৰ্কবাৰ্তা নিয়ম",
    "Auto-SMS on SEVERE Risk Level": "গুৰুতৰ বিপদত স্বয়ংক্ৰিয় SMS প্ৰেৰণ",
    "Real-Time SMS Gateway Configuration": "ৰিয়েল-টাইম SMS গেটৱে কনফিগাৰেচন",
    "Active SMS Provider": "সক্ৰিয় SMS সেৱা",
    "Instant SMS Delivery Diagnostic Tester": "তৎক্ষণাৎ SMS পৰীক্ষক",
    "Emergency SMS Recipients": "জৰুৰীকালীন SMS প্ৰাপক",
    "Send Test SMS": "🚀 পৰীক্ষামূলক SMS পঠিয়াওক",
    "Save Gateway Settings": "💾 গেটৱে ছেটিং সংৰক্ষণ কৰক",
    "Add Contact": "+ যোগাযোগ যোগ কৰক",
    "Check Live Quota": "📊 লাইভ কটা পৰীক্ষা কৰক",
    "TIME": "সময়",
    "TYPE": "প্ৰকাৰ",
    "MESSAGE": "বাৰ্তা",
    "RECIPIENTS": "প্ৰাপক",
    "DELIVERY STATUS": "প্ৰেৰণ স্থিতি",
    "PASSABLE": "খোলা পথ",
    "WATCH": "নজৰ ৰাখক",
    "CAUTION": "সাৱধান",
    "LOW": "নিম্ন",
    "MOD": "মধ্যম",
    "HIGH": "উচ্চ",
    "SEVERE": "গুৰুতৰ",
    "CRITICAL": "চৰম সংকট",
    "Name / Role": "নাম / পদবী",
    "Phone Number": "ফোন নম্বৰ",
    "District / Region": "জিলা / অঞ্চল",
    "Action": "কাৰ্য্য",
    "Delete": "মচি পেলাওক"
  },

  // Bengali (বাংলা)
  bn: {
    "NORTH EASTERN REGION": "উত্তর-পূর্বাঞ্চল",
    "Disaster Monitoring Command Center": "দুর্যোগ নজরদারি কমান্ড সেন্টার",
    "DISASTER INTELLIGENCE": "দুর্যোগ গোয়েন্দা ব্যবস্থা",
    "COMMAND CENTER": "কমান্ড সেন্টার",
    "Overview": "সারসংক্ষেপ",
    "Risk Map": "ঝুঁকি মানচিত্র",
    "Alerts": "সতর্কবার্তা",
    "Field Reports": "ফিল্ড রিপোর্ট",
    "Analytics": "বিশ্লেষণ (অ্যানালিটিক্স)",
    "SYSTEM": "সিস্টেম",
    "Settings": "সেটিংস",
    "System Online": "সিস্টেম অনলাইন",
    "Monitoring network active": "নজরদারি নেটওয়ার্ক সক্রিয়",
    "Toggle Theme": "থিম পরিবর্তন করুন",
    "EARLY WARNING NETWORK": "আগাম সতর্কীকরণ নেটওয়ার্ক",
    "Monitoring rainfall, soil moisture, terrain, landslide, earthquake and satellite indicators across NER.": "উত্তর-পূর্বাঞ্চলে বৃষ্টিপাত, মাটির আর্দ্রতা, ভূমিধস ও ভূমিকম্প পর্যবেক্ষণ।",
    "View Alerts": "সতর্কবার্তা দেখুন",
    "Send Alert Now (SMS)": "📲 সতর্কবার্তা পাঠান (SMS)",
    "EARLY WARNING SMS AUDIT LOG": "আগাম সতর্কতা SMS নিরীক্ষা লগ",
    "LANDSLIDE RISK": "ভূমিধসের ঝুঁকি",
    "RAINFALL": "বৃষ্টিপাত (২৪ ঘণ্টা)",
    "SOIL MOISTURE": "মাটির আর্দ্রতা",
    "EARTHQUAKE": "ভূমিকম্প",
    "MONITORING": "নজরদারি চলছে",
    "LOADING": "লোড হচ্ছে...",
    "Provisional evidence score": "সম্ভাব্য প্রমাণ স্কোর",
    "Open-Meteo model data": "Open-Meteo মডেল তথ্য",
    "USGS — past 24h": "USGS — বিগত ২৪ ঘণ্টা",
    "GEOSPATIAL INTELLIGENCE": "ভূ-স্থানিক বুদ্ধিমত্তা",
    "NER Hazard Map": "উত্তর-পূর্ব দুর্যোগ মানচিত্র",
    "LIVE HEATMAP": "🔥 লাইভ হিটম্যাপ",
    "HIGHWAYS": "🛣️ মহাসড়ক",
    "LANDSLIDES": "🌋 ভূমিধস",
    "FLASH FLOODS": "🌊 আকস্মিক বন্যা",
    "SATELLITE": "🛰️ স্যাটেলাইট",
    "3D TERRAIN": "⛰️ 3D ভূখণ্ড",
    "LIVE EARTH": "🌍 লাইভ আর্থ",
    "HAZARD RISK INTENSITY": "দুর্যোগ ঝুঁকির তীব্রতা",
    "ACTIVE LAYERS": "সক্রিয় স্তরসমূহ",
    "Severe Risk Hotspot": "তীব্র ঝুঁকি হটস্পট",
    "High Landslide Risk": "উচ্চ ভূমিধস ঝুঁকি",
    "Flash Flood Basin": "বন্যা অববাহিকা",
    "Passable Corridor": "চলাচলযোগ্য করিডোর",
    "Watch (Runoff/Slow)": "নজরদারি (ধীর গতি)",
    "Caution (Slip Zone)": "সতর্কতা (ধস অঞ্চল)",
    "Earthquakes (USGS)": "ভূমিকম্প (USGS)",
    "Landslides": "ভূমিধস",
    "Flash Floods": "আকস্মিক বন্যা",
    "Hotspots": "হটস্পট",
    "Highways": "মহাসড়ক",
    "ARAVINDHA ENGINE": "অরবিন্দ ইঞ্জিন",
    "Landslide Risk": "ভূমিধসের ঝুঁকি",
    "REGIONAL RISK ANALYTICS": "আঞ্চলিক ঝুঁকি বিশ্লেষণ",
    "Historical Landslide Events & Corridor Connectivity": "ঐতিহাসিক ভূমিধস ও সড়ক যোগাযোগ",
    "Monthly Landslide Events": "মাসিক ভূমিধসের ঘটনা",
    "Road & Evacuation Corridors": "সড়ক ও স্থানান্তর করিডোর",
    "Yearly": "বার্ষিক",
    "Monthly": "মাসিক",
    "All Years (2016-2026)": "সকল বছর (২০১৬-২০২৬)",
    "CONFIGURATION": "কনফিগারেশন",
    "System Settings & Recipient Directory": "সিস্টেম সেটিংস ও প্রাপক ডিরেক্টরি",
    "Automated Warning Rules": "স্বয়ংক্রিয় সতর্কতা নিয়ম",
    "Auto-SMS on SEVERE Risk Level": "তীব্র ঝুঁকিতে স্বয়ংক্রিয় SMS পাঠান",
    "Real-Time SMS Gateway Configuration": "রিয়েল-টাইম SMS গেটওয়ে কনফিগারেশন",
    "Active SMS Provider": "সক্রিয় SMS প্রদানকারী",
    "Instant SMS Delivery Diagnostic Tester": "তাত্ক্ষণিক SMS ডেলিভারি পরীক্ষক",
    "Emergency SMS Recipients": "জরুরি SMS প্রাপক",
    "Send Test SMS": "🚀 টেস্ট SMS পাঠান",
    "Save Gateway Settings": "💾 গেটওয়ে সেটিংস সংরক্ষণ করুন",
    "Add Contact": "+ যোগাযোগ যোগ করুন",
    "Check Live Quota": "📊 কোটা পরীক্ষা করুন",
    "TIME": "সময়",
    "TYPE": "ধরন",
    "MESSAGE": "বার্তা",
    "RECIPIENTS": "প্রাপক",
    "DELIVERY STATUS": "ডেলিভারি স্থিতি",
    "PASSABLE": "উন্মুক্ত পথ",
    "WATCH": "নজরদারি",
    "CAUTION": "সতর্কতা",
    "LOW": "কম",
    "MOD": "মাঝারি",
    "HIGH": "উচ্চ",
    "SEVERE": "তীব্র",
    "CRITICAL": "চরম সংকট",
    "Name / Role": "নাম / পদবী",
    "Phone Number": "ফোন নম্বর",
    "District / Region": "জেলা / অঞ্চল",
    "Action": "পদক্ষেপ",
    "Delete": "মুছুন"
  },

  // Nepali (नेपाली)
  ne: {
    "NORTH EASTERN REGION": "उत्तर-पूर्वी क्षेत्र",
    "Disaster Monitoring Command Center": "विपद् अनुगमन कमान्ड सेन्टर",
    "DISASTER INTELLIGENCE": "विपद् सूचना प्रणाली",
    "COMMAND CENTER": "कमान्ड सेन्टर",
    "Overview": "सिंहावलोकन",
    "Risk Map": "जोखिम नक्सा",
    "Alerts": "चेतावनीहरू",
    "Field Reports": "फिल्ड रिपोर्टहरू",
    "Analytics": "विश्लेषण",
    "SYSTEM": "प्रणाली",
    "Settings": "सेटिङहरू",
    "System Online": "प्रणाली अनलाइन",
    "Monitoring network active": "अनुगमन सञ्जाल सक्रिय",
    "Toggle Theme": "थिम बदल्नुहोस्",
    "EARLY WARNING NETWORK": "पूर्व चेतावनी सञ्जाल",
    "Monitoring rainfall, soil moisture, terrain, landslide, earthquake and satellite indicators across NER.": "उत्तर-पूर्वमा वर्षा, माटोको चिसोपन, पहिरो र भूकम्पको प्रत्यक्ष अनुगमन।",
    "View Alerts": "चेतावनी हेर्नुहोस्",
    "Send Alert Now (SMS)": "📲 चेतावनी पठाउनुहोस् (SMS)",
    "EARLY WARNING SMS AUDIT LOG": "पूर्व चेतावनी SMS अडिट लग",
    "LANDSLIDE RISK": "पहिरो जोखिम",
    "RAINFALL": "वर्षा (२४ घण्टा)",
    "SOIL MOISTURE": "माटोको चिसोपन",
    "EARTHQUAKE": "भूकम्प",
    "MONITORING": "अनुगमन जारी",
    "LOADING": "लोड हुँदैछ...",
    "Provisional evidence score": "सम्भावित प्रमाण अङ्क",
    "Open-Meteo model data": "Open-Meteo मोडेल डेटा",
    "USGS — past 24h": "USGS — विगत २४ घण्टा",
    "GEOSPATIAL INTELLIGENCE": "भू-स्थानिक सूचना प्रणाली",
    "NER Hazard Map": "पूर्वोत्तर विपद् नक्सा",
    "LIVE HEATMAP": "🔥 प्रत्यक्ष हिटम्याप",
    "HIGHWAYS": "🛣️ राजमार्गहरू",
    "LANDSLIDES": "🌋 पहिरो",
    "FLASH FLOODS": "🌊 आकस्मिक बाढी",
    "SATELLITE": "🛰️ उपग्रह",
    "3D TERRAIN": "⛰️ 3D भूभाग",
    "LIVE EARTH": "🌍 प्रत्यक्ष पृथ्वी",
    "HAZARD RISK INTENSITY": "विपद् जोखिम तीव्रता",
    "ACTIVE LAYERS": "सक्रिय तहहरू",
    "Severe Risk Hotspot": "गम्भीर जोखिम हटस्पट",
    "High Landslide Risk": "उच्च पहिरो जोखिम",
    "Flash Flood Basin": "बाढी बेसिन",
    "Passable Corridor": "खुला मार्ग",
    "Watch (Runoff/Slow)": "निगरानी (सुस्त गति)",
    "Caution (Slip Zone)": "सावधानी (पहिरो क्षेत्र)",
    "Earthquakes (USGS)": "भूकम्प (USGS)",
    "Landslides": "पहिरो",
    "Flash Floods": "आकस्मिक बाढी",
    "Hotspots": "हटस्पट",
    "Highways": "राजमार्गहरू",
    "ARAVINDHA ENGINE": "अरविन्द इन्जिन",
    "Landslide Risk": "पहिरो जोखिम",
    "REGIONAL RISK ANALYTICS": "क्षेत्रीय जोखिम विश्लेषण",
    "Historical Landslide Events & Corridor Connectivity": "ऐतिहासिक पहिरो घटनाहरू र सडक सम्पर्क",
    "Monthly Landslide Events": "मासिक पहिरो घटनाहरू",
    "Road & Evacuation Corridors": "सडक र उद्धार मार्गहरू",
    "Yearly": "वार्षिक",
    "Monthly": "मासिक",
    "All Years (2016-2026)": "सबै वर्ष (२०१६-२०२६)",
    "CONFIGURATION": "कन्फिगरेसन",
    "System Settings & Recipient Directory": "प्रणाली सेटिङ र सम्पर्क सूची",
    "Automated Warning Rules": "स्वचालित चेतावनी नियमहरू",
    "Auto-SMS on SEVERE Risk Level": "गम्भीर जोखिममा स्वचालित SMS पठाउनुहोस्",
    "Real-Time SMS Gateway Configuration": "वास्तविक समय SMS गेटवे कन्फिगरेसन",
    "Active SMS Provider": "सक्रिय SMS प्रदायक",
    "Instant SMS Delivery Diagnostic Tester": "तत्काल SMS परीक्षण यन्त्र",
    "Emergency SMS Recipients": "आपतकालीन SMS प्राप्तकर्ताहरू",
    "Send Test SMS": "🚀 परीक्षण SMS पठाउनुहोस्",
    "Save Gateway Settings": "💾 गेटवे सेटिङहरू बचत गर्नुहोस्",
    "Add Contact": "+ सम्पर्क थप्नुहोस्",
    "Check Live Quota": "📊 कोटा जाँच गर्नुहोस्",
    "TIME": "समय",
    "TYPE": "प्रकार",
    "MESSAGE": "सन्देश",
    "RECIPIENTS": "प्राप्तकर्ता",
    "DELIVERY STATUS": "डेलिभरी स्थिति",
    "PASSABLE": "सञ्चालन योग्य",
    "WATCH": "निगरानी",
    "CAUTION": "सावधानी",
    "LOW": "न्यून",
    "MOD": "मध्यम",
    "HIGH": "उच्च",
    "SEVERE": "गम्भीर",
    "CRITICAL": "अति संवेदनशील",
    "Name / Role": "नाम / भूमिका",
    "Phone Number": "फोन नम्बर",
    "District / Region": "जिल्ला / क्षेत्र",
    "Action": "कार्य",
    "Delete": "हटाउनुहोस्"
  },

  // Tamil (தமிழ்)
  ta: {
    "NORTH EASTERN REGION": "வடகிழக்கு பிராந்தியம்",
    "Disaster Monitoring Command Center": "பேரிடர் கண்காணிப்பு கட்டுப்பாட்டு மையம்",
    "DISASTER INTELLIGENCE": "பேரிடர் தகவல் அமைப்பு",
    "COMMAND CENTER": "கட்டுப்பாட்டு மையம்",
    "Overview": "கண்ணோட்டம்",
    "Risk Map": "இடர் வரைபடம்",
    "Alerts": "எச்சரிக்கைகள்",
    "Field Reports": "கள அறிக்கைகள்",
    "Analytics": "பகுப்பாய்வு",
    "SYSTEM": "அமைப்பு",
    "Settings": "அமைப்புகள்",
    "System Online": "அமைப்பு செயல்பாட்டில் உள்ளது",
    "Monitoring network active": "கண்காணிப்பு நெட்வொர்க் இயங்குகிறது",
    "Toggle Theme": "தீம் மாற்று",
    "EARLY WARNING NETWORK": "முன்னெச்சரிக்கை நெட்வொர்க்",
    "Monitoring rainfall, soil moisture, terrain, landslide, earthquake and satellite indicators across NER.": "வடகிழக்கில் மழை, மண் ஈரப்பதம், நிலச்சரிவு மற்றும் நிலநடுக்க நிகழ்நேர கண்காணிப்பு.",
    "View Alerts": "எச்சரிக்கைகளைக் காண்க",
    "Send Alert Now (SMS)": "📲 எச்சரிக்கை அனுப்புக (SMS)",
    "EARLY WARNING SMS AUDIT LOG": "முன்னெச்சரிக்கை SMS பதிவு",
    "LANDSLIDE RISK": "நிலச்சரிவு அபாயம்",
    "RAINFALL": "மழைப்பொழிவு (24 மணி)",
    "SOIL MOISTURE": "மண் ஈரப்பதம்",
    "EARTHQUAKE": "நிலநடுக்கம்",
    "MONITORING": "கண்காணிக்கப்படுகிறது",
    "LOADING": "ஏற்றப்படுகிறது...",
    "Provisional evidence score": "சாத்தியக்கூறு மதிப்பெண்",
    "Open-Meteo model data": "Open-Meteo மாதிரி தரவு",
    "USGS — past 24h": "USGS — கடந்த 24 மணிநேரம்",
    "GEOSPATIAL INTELLIGENCE": "புவிசார் தகவல் அமைப்பு",
    "NER Hazard Map": "பேரிடர் வரைபடம்",
    "LIVE HEATMAP": "🔥 நேரலை வெப்ப வரைபடம்",
    "HIGHWAYS": "🛣️ நெடுஞ்சாலைகள்",
    "LANDSLIDES": "🌋 நிலச்சரிவுகள்",
    "FLASH FLOODS": "🌊 திடீர் வெள்ளம்",
    "SATELLITE": "🛰️ செயற்கைக்கோள்",
    "3D TERRAIN": "⛰️ 3D நிலப்பரப்பு",
    "LIVE EARTH": "🌍 நேரலை பூமி",
    "HAZARD RISK INTENSITY": "பேரிடர் தீவிரத்தன்மை",
    "ACTIVE LAYERS": "செயலில் உள்ள அடுக்குகள்",
    "Severe Risk Hotspot": "தீவிர அபாய மையம்",
    "High Landslide Risk": "அதிக நிலச்சரிவு அபாயம்",
    "Flash Flood Basin": "திடீர் வெள்ளப் படுகை",
    "Passable Corridor": "செல்லக்கூடிய பாதை",
    "Watch (Runoff/Slow)": "கண்காணிப்பு (மெதுவானது)",
    "Caution (Slip Zone)": "எச்சரிக்கை (சரிவு மண்டலம்)",
    "Earthquakes (USGS)": "நிலநடுக்கங்கள் (USGS)",
    "Landslides": "நிலச்சரிவுகள்",
    "Flash Floods": "திடீர் வெள்ளம்",
    "Hotspots": "அபாய மையங்கள்",
    "Highways": "நெடுஞ்சாலைகள்",
    "ARAVINDHA ENGINE": "அரவிந்தா எஞ்சின்",
    "Landslide Risk": "நிலச்சரிவு அபாயம்",
    "REGIONAL RISK ANALYTICS": "பிராந்திய அபாய பகுப்பாய்வு",
    "Historical Landslide Events & Corridor Connectivity": "வரலாற்று நிலச்சரிவுகள் மற்றும் சாலை இணைப்பு",
    "Monthly Landslide Events": "மாதாந்திர நிலச்சரிவு நிகழ்வுகள்",
    "Road & Evacuation Corridors": "சாலை மற்றும் வெளியேற்ற பாதைகள்",
    "Yearly": "ஆண்டுதோறும்",
    "Monthly": "மாதாந்திரம்",
    "All Years (2016-2026)": "அனைத்து ஆண்டுகள் (2016-2026)",
    "CONFIGURATION": "கட்டமைப்பு",
    "System Settings & Recipient Directory": "அமைப்பு அமைப்புகள் & தொடர்புகள்",
    "Automated Warning Rules": "தானியங்கி எச்சரிக்கை விதிகள்",
    "Auto-SMS on SEVERE Risk Level": "தீவிர அபாயத்தில் தானியங்கி SMS அனுப்புக",
    "Real-Time SMS Gateway Configuration": "நிகழ்நேர SMS நுழைவாயில் அமைப்புகள்",
    "Active SMS Provider": "செயலில் உள்ள SMS சேவை",
    "Instant SMS Delivery Diagnostic Tester": "உடனடி SMS சோதனை",
    "Emergency SMS Recipients": "அவசர SMS பெறுநர்கள்",
    "Send Test SMS": "🚀 சோதனை SMS அனுப்புக",
    "Save Gateway Settings": "💾 அமைப்புகளைச் சேமி",
    "Add Contact": "+ தொடர்பைச் சேர்",
    "Check Live Quota": "📊 இருப்பை சரிபார்க்கவும்",
    "TIME": "நேரம்",
    "TYPE": "வகை",
    "MESSAGE": "செய்தி",
    "RECIPIENTS": "பெறுநர்கள்",
    "DELIVERY STATUS": "நிலை",
    "PASSABLE": "திறந்துள்ளது",
    "WATCH": "கண்காணிப்பு",
    "CAUTION": "எச்சரிக்கை",
    "LOW": "குறைவு",
    "MOD": "மிதமானது",
    "HIGH": "அதிகம்",
    "SEVERE": "தீவிரம்",
    "CRITICAL": "மிகத் தீவிரம்",
    "Name / Role": "பெயர் / பதவி",
    "Phone Number": "தொலைபேசி எண்",
    "District / Region": "மாவட்டம் / பிராந்தியம்",
    "Action": "செயல்",
    "Delete": "நீக்கு"
  },

  // Telugu (తెలుగు)
  te: {
    "NORTH EASTERN REGION": "ఈశాన్య ప్రాంతం",
    "Disaster Monitoring Command Center": "విపత్తు పర్యవేక్షణ కమాండ్ సెంటర్",
    "DISASTER INTELLIGENCE": "విపత్తు సమాచార వ్యవస్థ",
    "COMMAND CENTER": "కమాండ్ సెంటర్",
    "Overview": "అవలోకనం",
    "Risk Map": "ప్రమాద పటం",
    "Alerts": "హెచ్చరికలు",
    "Field Reports": "క్షేత్ర నివేదికలు",
    "Analytics": "విశ్లేషణలు",
    "SYSTEM": "సిస్టమ్",
    "Settings": "సెట్టింగ్‌లు",
    "System Online": "సిస్టమ్ ఆన్‌లైన్",
    "Monitoring network active": "పర్యవేక్షణ నెట్‌వర్క్ క్రియాశీలంగా ఉంది",
    "Toggle Theme": "థీమ్ మార్చండి",
    "EARLY WARNING NETWORK": "ముందస్తు హెచ్చరిక నెట్‌వర్క్",
    "Monitoring rainfall, soil moisture, terrain, landslide, earthquake and satellite indicators across NER.": "వర్షపాతం, నేల తేమ, కొండచరియలు మరియు భూకంపాల ప్రత్యక్ష పర్యవేక్షణ.",
    "View Alerts": "హెచ్చరికలను చూడండి",
    "Send Alert Now (SMS)": "📲 హెచ్చరికను పంపండి (SMS)",
    "EARLY WARNING SMS AUDIT LOG": "ముందస్తు హెచ్చరిక SMS లాగ్",
    "LANDSLIDE RISK": "కొండచరియల ప్రమాదం",
    "RAINFALL": "వర్షపాతం (24 గంటలు)",
    "SOIL MOISTURE": "నేల తేమ",
    "EARTHQUAKE": "భూకంపం",
    "MONITORING": "పర్యవేక్షణలో ఉంది",
    "LOADING": "లోడ్ అవుతోంది...",
    "Provisional evidence score": "సాధ్యమైన ఆధార స్కోరు",
    "Open-Meteo model data": "Open-Meteo నమూనా డేటా",
    "USGS — past 24h": "USGS — గత 24 గంటలు",
    "GEOSPATIAL INTELLIGENCE": "భౌగోళిక సమాచార వ్యవస్థ",
    "NER Hazard Map": "విపత్తు పటం",
    "LIVE HEATMAP": "🔥 లైవ్ హీట్‌మ్యాప్",
    "HIGHWAYS": "🛣️ రహదారులు",
    "LANDSLIDES": "🌋 కొండచరియలు",
    "FLASH FLOODS": "🌊 ఆకస్మిక వరదలు",
    "SATELLITE": "🛰️ ఉపగ్రహం",
    "3D TERRAIN": "⛰️ 3D భూభాగం",
    "LIVE EARTH": "🌍 లైవ్ ఎర్త్",
    "HAZARD RISK INTENSITY": "ప్రమాద తీవ్రత",
    "ACTIVE LAYERS": "క్రియాశీల పొరలు",
    "Severe Risk Hotspot": "తీవ్ర ప్రమాద కేంద్రం",
    "High Landslide Risk": "అధిక కొండచరియల ప్రమాదం",
    "Flash Flood Basin": "వరద బేసిన్",
    "Passable Corridor": "అనుకూల రహదారి",
    "Watch (Runoff/Slow)": "గమనించండి (నెమ్మదిగా)",
    "Caution (Slip Zone)": "జాగ్రత్త (జారే ప్రాంతం)",
    "Earthquakes (USGS)": "భూకంపాలు (USGS)",
    "Landslides": "కొండచరియలు",
    "Flash Floods": "ఆకస్మిక వరదలు",
    "Hotspots": "హాట్‌స్పాట్‌లు",
    "Highways": "రహదారులు",
    "ARAVINDHA ENGINE": "అరవింద ఇంజిన్",
    "Landslide Risk": "కొండచరియల ప్రమాదం",
    "REGIONAL RISK ANALYTICS": "ప్రాంతీయ ప్రమాద విశ్లేషణ",
    "Historical Landslide Events & Corridor Connectivity": "చారిత్రక కొండచరియలు & రహదారి అనుసంధానం",
    "Monthly Landslide Events": "నెలవారీ కొండచరియల ఘటనలు",
    "Road & Evacuation Corridors": "రహదారి & తరలింపు మార్గాలు",
    "Yearly": "వార్షిక",
    "Monthly": "నెలవారీ",
    "All Years (2016-2026)": "అన్ని సంవత్సరాలు (2016-2026)",
    "CONFIGURATION": "కాన్ఫిగరేషన్",
    "System Settings & Recipient Directory": "సిస్టమ్ సెట్టింగ్‌లు & పరిచయాలు",
    "Automated Warning Rules": "స్వయంచాలక హెచ్చరిక నిబంధనలు",
    "Auto-SMS on SEVERE Risk Level": "తీవ్ర ప్రమాదంలో స్వయంచాలక SMS పంపండి",
    "Real-Time SMS Gateway Configuration": "రియల్-టైమ్ SMS గేట్‌వే సెట్టింగ్‌లు",
    "Active SMS Provider": "క్రియాశీల SMS సర్వీస్",
    "Instant SMS Delivery Diagnostic Tester": "తక్షణ SMS పరీక్ష",
    "Emergency SMS Recipients": "అత్యవసర SMS గ్రహీతలు",
    "Send Test SMS": "🚀 పరీక్ష SMS పంపండి",
    "Save Gateway Settings": "💾 సెట్టింగ్‌లను సేవ్ చేయండి",
    "Add Contact": "+ పరిచయాన్ని జోడించండి",
    "Check Live Quota": "📊 కోటాను తనిఖీ చేయండి",
    "TIME": "సమయం",
    "TYPE": "రకం",
    "MESSAGE": "సందేశం",
    "RECIPIENTS": "గ్రహీతలు",
    "DELIVERY STATUS": "స్థితి",
    "PASSABLE": "స్పష్టమైనది",
    "WATCH": "గమనించండి",
    "CAUTION": "హెచ్చరిక",
    "LOW": "తక్కువ",
    "MOD": "మధ్యస్థం",
    "HIGH": "ఎక్కువ",
    "SEVERE": "తీవ్రం",
    "CRITICAL": "అత్యంత తీవ్రం",
    "Name / Role": "పేరు / పాత్ర",
    "Phone Number": "ఫోన్ నంబర్",
    "District / Region": "జిల్లా / ప్రాంతం",
    "Action": "చర్య",
    "Delete": "తొలగించు"
  },

  // Malayalam (മലയാളം)
  ml: {
    "NORTH EASTERN REGION": "വടക്കുകിഴക്കൻ പ്രദേശം",
    "Disaster Monitoring Command Center": "ദുരന്ത നിരീക്ഷണ കമാൻഡ് സെന്റർ",
    "DISASTER INTELLIGENCE": "ദുരന്ത വിവര സാങ്കേതികത",
    "COMMAND CENTER": "കമാൻഡ് സെന്റർ",
    "Overview": "അവലോകനം",
    "Risk Map": "അപകട ഭൂപടം",
    "Alerts": "മുന്നറിയിപ്പുകൾ",
    "Field Reports": "ഫീൽഡ് റിപ്പോർട്ടുകൾ",
    "Analytics": "വിശകലനം",
    "SYSTEM": "സിസ്റ്റം",
    "Settings": "ക്രമീകരണങ്ങൾ",
    "System Online": "സിസ്റ്റം ഓൺലൈൻ",
    "Monitoring network active": "നിരീക്ഷണ ശൃംഖല സജീവം",
    "Toggle Theme": "തീം മാറ്റുക",
    "EARLY WARNING NETWORK": "മുൻകൂർ മുന്നറിയിപ്പ് ശൃംഖല",
    "Monitoring rainfall, soil moisture, terrain, landslide, earthquake and satellite indicators across NER.": "മഴ, മണ്ണിന്റെ ഈർപ്പം, മണ്ണിടിച്ചിൽ, ഭൂകമ്പം എന്നിവയുടെ തത്സമയ നിരീക്ഷണം.",
    "View Alerts": "മുന്നറിയിപ്പുകൾ കാണുക",
    "Send Alert Now (SMS)": "📲 മുന്നറിയിപ്പ് അയക്കുക (SMS)",
    "EARLY WARNING SMS AUDIT LOG": "മുൻകൂർ മുന്നറിയിപ്പ് SMS ലോഗ്",
    "LANDSLIDE RISK": "മണ്ണിടിച്ചിൽ സാധ്യത",
    "RAINFALL": "മഴ (24 മണിക്കൂർ)",
    "SOIL MOISTURE": "മണ്ണിന്റെ ഈർപ്പം",
    "EARTHQUAKE": "ഭൂകമ്പം",
    "MONITORING": "നിരീക്ഷണം തുടരുന്നു",
    "LOADING": "ലോഡ് ചെയ്യുന്നു...",
    "Provisional evidence score": "സാധ്യത സ്കോർ",
    "Open-Meteo model data": "Open-Meteo മോഡൽ ഡാറ്റ",
    "USGS — past 24h": "USGS — കഴിഞ്ഞ 24 മണിക്കൂർ",
    "GEOSPATIAL INTELLIGENCE": "ഭൗമവിവര സംവിധാനം",
    "NER Hazard Map": "ദുരന്ത ഭൂപടം",
    "LIVE HEATMAP": "🔥 തത്സമയ ഹീറ്റ്മാപ്പ്",
    "HIGHWAYS": "🛣️ ഹൈവേകൾ",
    "LANDSLIDES": "🌋 മണ്ണിടിച്ചിലുകൾ",
    "FLASH FLOODS": "🌊 പെട്ടെന്നുള്ള വെള്ളപ്പൊക്കം",
    "SATELLITE": "🛰️ ഉപഗ്രഹം",
    "3D TERRAIN": "⛰️ 3D ഭൂപ്രകൃതി",
    "LIVE EARTH": "🌍 തത്സമയ ഭൂമി",
    "HAZARD RISK INTENSITY": "അപകടസാധ്യത തീവ്രത",
    "ACTIVE LAYERS": "സജീവ പാളികൾ",
    "Severe Risk Hotspot": "ഗുരുതര അപകട മേഖല",
    "High Landslide Risk": "ഉയർന്ന മണ്ണിടിച്ചിൽ സാധ്യത",
    "Flash Flood Basin": "വെള്ളപ്പൊക്ക തടം",
    "Passable Corridor": "തുറന്ന പാത",
    "Watch (Runoff/Slow)": "ശ്രദ്ധിക്കുക (വേഗത കുറവ്)",
    "Caution (Slip Zone)": "ജാഗ്രത (മണ്ണിടിച്ചിൽ മേഖല)",
    "Earthquakes (USGS)": "ഭൂകമ്പങ്ങൾ (USGS)",
    "Landslides": "മണ്ണിടിച്ചിൽ",
    "Flash Floods": "പെട്ടെന്നുള്ള വെള്ളപ്പൊക്കം",
    "Hotspots": "ഹോട്ട്സ്പോട്ടുകൾ",
    "Highways": "ഹൈവേകൾ",
    "ARAVINDHA ENGINE": "അരവിന്ദ എഞ്ചിൻ",
    "Landslide Risk": "മണ്ണിടിച്ചിൽ സാധ്യത",
    "REGIONAL RISK ANALYTICS": "മേഖലാ അപകടസാധ്യതാ വിശകലനം",
    "Historical Landslide Events & Corridor Connectivity": "ചരിത്രപരമായ മണ്ണിടിച്ചിലുകളും റോഡ് ബന്ധങ്ങളും",
    "Monthly Landslide Events": "പ്രതിമാസ മണ്ണിടിച്ചിൽ സംഭവങ്ങൾ",
    "Road & Evacuation Corridors": "റോഡ് & രക്ഷാപ്രവർത്തന പാതകൾ",
    "Yearly": "വാർഷികം",
    "Monthly": "പ്രതിമാസം",
    "All Years (2016-2026)": "എല്ലാ വർഷങ്ങളും (2016-2026)",
    "CONFIGURATION": "കോൺഫിഗറേഷൻ",
    "System Settings & Recipient Directory": "സിസ്റ്റം ക്രമീകരണങ്ങളും വിലാസപുസ്തകവും",
    "Automated Warning Rules": "ഓട്ടോമേറ്റഡ് മുന്നറിയിപ്പ് നിയമങ്ങൾ",
    "Auto-SMS on SEVERE Risk Level": "തീവ്ര അപകടത്തിൽ ഓട്ടോമാറ്റിക് SMS അയക്കുക",
    "Real-Time SMS Gateway Configuration": "തത്സമയ SMS ഗേറ്റ്‌വേ ക്രമീകരണം",
    "Active SMS Provider": "സജീവ SMS സേവനം",
    "Instant SMS Delivery Diagnostic Tester": "തത്സമയ SMS പരിശോധന",
    "Emergency SMS Recipients": "അടിയന്തര SMS സ്വീകർത്താക്കൾ",
    "Send Test SMS": "🚀 ടെസ്റ്റ് SMS അയക്കുക",
    "Save Gateway Settings": "💾 ക്രമീകരണങ്ങൾ സൂക്ഷിക്കുക",
    "Add Contact": "+ നമ്പർ ചേർക്കുക",
    "Check Live Quota": "📊 ക്വാട്ട പരിശോധിക്കുക",
    "TIME": "സമയം",
    "TYPE": "തരം",
    "MESSAGE": "സന്ദേശം",
    "RECIPIENTS": "സ്വീകർത്താക്കൾ",
    "DELIVERY STATUS": "സ്ഥിതി",
    "PASSABLE": "തുറന്നത്",
    "WATCH": "ശ്രദ്ധിക്കുക",
    "CAUTION": "ജാഗ്രത",
    "LOW": "കുറവ്",
    "MOD": "മിതമായത്",
    "HIGH": "ഉയർന്നത്",
    "SEVERE": "ഗുരുതരം",
    "CRITICAL": "അതീവ ഗുരുതരം",
    "Name / Role": "പേര് / സ്ഥാനം",
    "Phone Number": "ഫോൺ നമ്പർ",
    "District / Region": "ജില്ല / പ്രദേശം",
    "Action": "നടപടി",
    "Delete": "നീക്കം ചെയ്യുക"
  },

  // Kannada (ಕನ್ನಡ)
  kn: {
    "NORTH EASTERN REGION": "ಈಶಾನ್ಯ ಪ್ರದೇಶ",
    "Disaster Monitoring Command Center": "ವಿಪತ್ತು ಮೇಲ್ವಿಚಾರಣಾ ಕಮಾಂಡ್ ಸೆಂಟರ್",
    "DISASTER INTELLIGENCE": "ವಿಪತ್ತು ಮಾಹಿತಿ ವ್ಯವಸ್ಥೆ",
    "COMMAND CENTER": "ಕಮಾಂಡ್ ಸೆಂಟರ್",
    "Overview": "ಅವಲೋಕನ",
    "Risk Map": "ಅಪಾಯದ ನಕ್ಷೆ",
    "Alerts": "ಎಚ್ಚರಿಕೆಗಳು",
    "Field Reports": "ಕ್ಷೇತ್ರ ವರದಿಗಳು",
    "Analytics": "ವಿಶ್ಲೇಷಣೆ",
    "SYSTEM": "ವ್ಯವಸ್ಥೆ",
    "Settings": "ಸೆಟ್ಟಿಂಗ್‌ಗಳು",
    "System Online": "ವ್ಯವಸ್ಥೆ ಆನ್‌ಲೈನ್‌ನಲ್ಲಿದೆ",
    "Monitoring network active": "ಮೇಲ್ವಿಚಾರಣಾ ಜಾಲ ಸಕ್ರಿಯವಾಗಿದೆ",
    "Toggle Theme": "ಥೀಮ್ ಬದಲಾಯಿಸಿ",
    "EARLY WARNING NETWORK": "ಮುನ್ನೆಚ್ಚರಿಕೆ ಜಾಲ",
    "Monitoring rainfall, soil moisture, terrain, landslide, earthquake and satellite indicators across NER.": "ಮಳೆ, ಮಣ್ಣಿನ ತೇವಾಂಶ, ಭೂಕುಸಿತ ಮತ್ತು ಭೂಕಂಪಗಳ ನೈಜ-ಸಮಯದ ಮೇಲ್ವಿಚಾರಣೆ.",
    "View Alerts": "ಎಚ್ಚರಿಕೆಗಳನ್ನು ವೀಕ್ಷಿಸಿ",
    "Send Alert Now (SMS)": "📲 ಎಚ್ಚರಿಕೆ ಕಳುಹಿಸಿ (SMS)",
    "EARLY WARNING SMS AUDIT LOG": "ಮುನ್ನೆಚ್ಚರಿಕೆ SMS ಲಾಗ್",
    "LANDSLIDE RISK": "ಭೂಕುಸಿತದ ಅಪಾಯ",
    "RAINFALL": "ಮಳೆ (24 ಗಂಟೆಗಳು)",
    "SOIL MOISTURE": "ಮಣ್ಣಿನ ತೇವಾಂಶ",
    "EARTHQUAKE": "ಭೂಕಂಪ",
    "MONITORING": "ಮೇಲ್ವಿಚಾರಣೆ ಪ್ರಗತಿಯಲ್ಲಿದೆ",
    "LOADING": "ಲೋಡ್ ಆಗುತ್ತಿದೆ...",
    "Provisional evidence score": "ಸಂಭಾವ್ಯ ಪುರಾವೆ ಅಂಕ",
    "Open-Meteo model data": "Open-Meteo ಮಾದರಿ ಡೇಟಾ",
    "USGS — past 24h": "USGS — ಕಳೆದ 24 ಗಂಟೆಗಳು",
    "GEOSPATIAL INTELLIGENCE": "ಭೌಗೋಳಿಕ ಮಾಹಿತಿ ವ್ಯವಸ್ಥೆ",
    "NER Hazard Map": "ವಿಪತ್ತು ನಕ್ಷೆ",
    "LIVE HEATMAP": "🔥 ಲೈವ್ ಹೀಟ್‌ಮ್ಯಾಪ್",
    "HIGHWAYS": "🛣️ ಹೆದ್ದಾರಿಗಳು",
    "LANDSLIDES": "🌋 ಭೂಕುಸಿತಗಳು",
    "FLASH FLOODS": "🌊 ಹಠಾತ್ ಪ್ರವಾಹ",
    "SATELLITE": "🛰️ ಉಪಗ್ರಹ",
    "3D TERRAIN": "⛰️ 3D ಭೂಪ್ರದೇಶ",
    "LIVE EARTH": "🌍 ಲೈವ್ ಭೂಮಿ",
    "HAZARD RISK INTENSITY": "ಅಪಾಯದ ತೀವ್ರತೆ",
    "ACTIVE LAYERS": "ಸಕ್ರಿಯ ಪದರಗಳು",
    "Severe Risk Hotspot": "ತೀವ್ರ ಅಪಾಯದ ಕೇಂದ್ರ",
    "High Landslide Risk": "ಹೆಚ್ಚಿನ ಭೂಕುಸಿತ ಅಪಾಯ",
    "Flash Flood Basin": "ಪ್ರವಾಹ ಜಲಾನಯನ",
    "Passable Corridor": "ಮುಕ್ತ ರಸ್ತೆ",
    "Watch (Runoff/Slow)": "ಗಮನಿಸಿ (ನಿಧಾನ)",
    "Caution (Slip Zone)": "ಎಚ್ಚರಿಕೆ (ಕುಸಿತ ವಲಯ)",
    "Earthquakes (USGS)": "ಭೂಕಂಪಗಳು (USGS)",
    "Landslides": "ಭೂಕುಸಿತಗಳು",
    "Flash Floods": "ಹಠಾತ್ ಪ್ರವಾಹ",
    "Hotspots": "ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು",
    "Highways": "ಹೆದ್ದಾರಿಗಳು",
    "ARAVINDHA ENGINE": "ಅರವಿಂದ ಎಂಜಿನ್",
    "Landslide Risk": "ಭೂಕುಸಿತದ ಅಪಾಯ",
    "REGIONAL RISK ANALYTICS": "ಪ್ರಾದೇಶಿಕ ಅಪಾಯ ವಿಶ್ಲೇಷಣೆ",
    "Historical Landslide Events & Corridor Connectivity": "ಐತಿಹಾಸಿಕ ಭೂಕುಸಿತಗಳು ಮತ್ತು ರಸ್ತೆ ಸಂಪರ್ಕ",
    "Monthly Landslide Events": "ಮಾಸಿಕ ಭೂಕುಸಿತ ಘಟನೆಗಳು",
    "Road & Evacuation Corridors": "ರಸ್ತೆ ಮತ್ತು ಸ್ಥಳಾಂತರ ಮಾರ್ಗಗಳು",
    "Yearly": "ವಾರ್ಷಿಕ",
    "Monthly": "ಮಾಸಿಕ",
    "All Years (2016-2026)": "ಎಲ್ಲಾ ವರ್ಷಗಳು (2016-2026)",
    "CONFIGURATION": "ಸಂರಚನೆ",
    "System Settings & Recipient Directory": "ವ್ಯವಸ್ಥೆಯ ಸೆಟ್ಟಿಂಗ್‌ಗಳು ಮತ್ತು ಸಂಪರ್ಕಗಳು",
    "Automated Warning Rules": "ಸ್ವಯಂಚಾಲಿತ ಎಚ್ಚರಿಕೆ ನಿಯಮಗಳು",
    "Auto-SMS on SEVERE Risk Level": "ತೀವ್ರ ಅಪಾಯದಲ್ಲಿ ಸ್ವಯಂಚಾಲಿತ SMS ಕಳುಹಿಸಿ",
    "Real-Time SMS Gateway Configuration": "ನೈಜ-ಸಮಯದ SMS ಗೇಟ್‌ವೇ ಸೆಟ್ಟಿಂಗ್‌ಗಳು",
    "Active SMS Provider": "ಸಕ್ರಿಯ SMS ಸೇವೆ",
    "Instant SMS Delivery Diagnostic Tester": "ತ್ವರಿತ SMS ಪರೀಕ್ಷಕ",
    "Emergency SMS Recipients": "ತುರ್ತು SMS ಸ್ವೀಕೃತಿದಾರರು",
    "Send Test SMS": "🚀 ಪರೀಕ್ಷಾ SMS ಕಳುಹಿಸಿ",
    "Save Gateway Settings": "💾 ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ಉಳಿಸಿ",
    "Add Contact": "+ ಸಂಪರ್ಕ ಸೇರಿಸಿ",
    "Check Live Quota": "📊 ಕೋಟಾ ಪರಿಶೀಲಿಸಿ",
    "TIME": "ಸಮಯ",
    "TYPE": "ಪ್ರಕಾರ",
    "MESSAGE": "ಸಂದೇಶ",
    "RECIPIENTS": "ಸ್ವೀಕೃತಿದಾರರು",
    "DELIVERY STATUS": "ಸ್ಥಿತಿ",
    "PASSABLE": "ತೆರೆದಿದೆ",
    "WATCH": "ಗಮನಿಸಿ",
    "CAUTION": "ಎಚ್ಚರಿಕೆ",
    "LOW": "ಕಡಿಮೆ",
    "MOD": "ಮಧ್ಯಮ",
    "HIGH": "ಹೆಚ್ಚು",
    "SEVERE": "ತೀವ್ರ",
    "CRITICAL": "ಅತ್ಯಂತ ತೀವ್ರ",
    "Name / Role": "ಹೆಸರು / ಪಾತ್ರ",
    "Phone Number": "ದೂರವಾಣಿ ಸಂಖ್ಯೆ",
    "District / Region": "ಜಿಲ್ಲೆ / ಪ್ರದೇಶ",
    "Action": "ಕ್ರಮ",
    "Delete": "ಅಳಿಸಿ"
  },

  // Marathi (मराठी)
  mr: {
    "NORTH EASTERN REGION": "ईशान्य प्रदेश",
    "Disaster Monitoring Command Center": "आपत्ती नियंत्रण व देखरेख कक्ष",
    "DISASTER INTELLIGENCE": "आपत्ती बुद्धिमत्ता प्रणाली",
    "COMMAND CENTER": "कमांड सेंटर",
    "Overview": "आढावा",
    "Risk Map": "धोका नकाशा",
    "Alerts": "इशारे",
    "Field Reports": "फील्ड अहवाल",
    "Analytics": "विश्लेषण",
    "SYSTEM": "प्रणाली",
    "Settings": "सेटिंग्ज",
    "System Online": "प्रणाली ऑनलाइन",
    "Monitoring network active": "निरीक्षण नेटवर्क सक्रिय",
    "Toggle Theme": "थीम बदला",
    "EARLY WARNING NETWORK": "पूर्वसूचना नेटवर्क",
    "Monitoring rainfall, soil moisture, terrain, landslide, earthquake and satellite indicators across NER.": "ईशान्य भारतात पर्जन्यमान, जमिनीतील ओलावा, भूस्खलन व भूकंपाचे थेट निरीक्षण.",
    "View Alerts": "इशारे पहा",
    "Send Alert Now (SMS)": "📲 आता इशारा पाठवा (SMS)",
    "EARLY WARNING SMS AUDIT LOG": "पूर्वसूचना SMS ऑडिट नोंद",
    "LANDSLIDE RISK": "भूस्खलन धोका",
    "RAINFALL": "पर्जन्यमान (24 तास)",
    "SOIL MOISTURE": "जमिनीतील ओलावा",
    "EARTHQUAKE": "भूकंप",
    "MONITORING": "निरीक्षण सुरू आहे",
    "LOADING": "लोड होत आहे...",
    "Provisional evidence score": "संभाव्य पुरावा गुणसंख्या",
    "Open-Meteo model data": "Open-Meteo मॉडेल डेटा",
    "USGS — past 24h": "USGS — मागील 24 तास",
    "GEOSPATIAL INTELLIGENCE": "भू-अवकाशीय माहिती प्रणाली",
    "NER Hazard Map": "आपत्ती नकाशा",
    "LIVE HEATMAP": "🔥 थेट हीटमॅप",
    "HIGHWAYS": "🛣️ महामार्ग",
    "LANDSLIDES": "🌋 भूस्खलन",
    "FLASH FLOODS": "🌊 अचानक पूर",
    "SATELLITE": "🛰️ उपग्रह",
    "3D TERRAIN": "⛰️ 3D भूभाग",
    "LIVE EARTH": "🌍 थेट पृथ्वी",
    "HAZARD RISK INTENSITY": "आपत्ती धोका तीव्रता",
    "ACTIVE LAYERS": "सक्रिय स्तर",
    "Severe Risk Hotspot": "गंभीर धोका केंद्र",
    "High Landslide Risk": "उच्च भूस्खलन धोका",
    "Flash Flood Basin": "पूर खोरे",
    "Passable Corridor": "खुला मार्ग",
    "Watch (Runoff/Slow)": "लक्ष ठेवा (मंद गती)",
    "Caution (Slip Zone)": "सावधानता (घसरण क्षेत्र)",
    "Earthquakes (USGS)": "भूकंप (USGS)",
    "Landslides": "भूस्खलन",
    "Flash Floods": "अचानक पूर",
    "Hotspots": "हॉटस्पॉट",
    "Highways": "महामार्ग",
    "ARAVINDHA ENGINE": "अरविंदा इंजिन",
    "Landslide Risk": "भूस्खलन धोका",
    "REGIONAL RISK ANALYTICS": "प्रादेशिक धोका विश्लेषण",
    "Historical Landslide Events & Corridor Connectivity": "ऐतिहासिक भूस्खलन आणि रस्ते जोडणी",
    "Monthly Landslide Events": "मासिक भूस्खलन घटना",
    "Road & Evacuation Corridors": "रस्ते व निर्वासन मार्ग",
    "Yearly": "वार्षिक",
    "Monthly": "मासिक",
    "All Years (2016-2026)": "सर्व वर्षे (2016-2026)",
    "CONFIGURATION": "कॉन्फिगरेशन",
    "System Settings & Recipient Directory": "प्रणाली सेटिंग्ज आणि संपर्क सूची",
    "Automated Warning Rules": "स्वयंचलित इशारा नियम",
    "Auto-SMS on SEVERE Risk Level": "गंभीर धोक्यावर स्वयंचलित SMS पाठवा",
    "Real-Time SMS Gateway Configuration": "रिअल-टाइम SMS गेटवे कॉन्फिगरेशन",
    "Active SMS Provider": "सक्रिय SMS प्रदाता",
    "Instant SMS Delivery Diagnostic Tester": "त्वरित SMS चाचणी",
    "Emergency SMS Recipients": "आपत्कालीन SMS प्राप्तकर्ते",
    "Send Test SMS": "🚀 चाचणी SMS पाठवा",
    "Save Gateway Settings": "💾 सेटिंग्ज जतन करा",
    "Add Contact": "+ संपर्क जोडा",
    "Check Live Quota": "📊 कोटा तपासा",
    "TIME": "वेळ",
    "TYPE": "प्रकार",
    "MESSAGE": "संदेश",
    "RECIPIENTS": "प्राप्तकर्ते",
    "DELIVERY STATUS": "स्थिती",
    "PASSABLE": "खुला मार्ग",
    "WATCH": "लक्ष ठेवा",
    "CAUTION": "सावधानता",
    "LOW": "कमी",
    "MOD": "मध्यम",
    "HIGH": "जास्त",
    "SEVERE": "गंभीर",
    "CRITICAL": "अत्यंत गंभीर",
    "Name / Role": "नाव / भूमिका",
    "Phone Number": "फोन नंबर",
    "District / Region": "जिल्हा / प्रदेश",
    "Action": "कृती",
    "Delete": "हटवा"
  }
};

/* =========================================================
   SIMULATION MODULE PHRASES — 3D Simulation cockpit + Video Studio.
   Merged into every language dictionary below so the phrase
   lookup covers the simulation tabs exactly like the dashboard.
========================================================= */

const SIM_PHRASES = {
  en: {},
  hi: {
    "3D Simulation": "3D सिमुलेशन",
    "Video Studio": "वीडियो स्टूडियो",
    "Landslide Risk Monitoring & Simulation": "भूस्खलन जोखिम निगरानी और सिमुलेशन",
    "Landslide Risk Overview": "भूस्खलन जोखिम अवलोकन",
    "Landslide Risk Zones": "भूस्खलन जोखिम क्षेत्र",
    "Landslide Simulation & Impact Dossier": "भूस्खलन सिमुलेशन और प्रभाव विवरण",
    "Risk & Simulation": "जोखिम और सिमुलेशन",
    "Simulation Animation": "सिमुलेशन एनीमेशन",
    "Animation Controls": "एनीमेशन नियंत्रण",
    "Scenario": "परिदृश्य",
    "Scenario Comparison": "परिदृश्य तुलना",
    "Probability": "प्रायिकता",
    "Current Conditions": "वर्तमान स्थिति",
    "Runout Distance": "बहाव की दूरी",
    "Runout Zone": "बहाव क्षेत्र",
    "Flow Path (Predicted)": "प्रवाह पथ (अनुमानित)",
    "Slope Angle": "ढलान कोण",
    "Soil Type": "मिट्टी का प्रकार",
    "Soil Moisture": "मिट्टी की नमी",
    "Bedrock Depth": "बेडरॉक गहराई",
    "Population Exposure": "जनसंख्या जोखिम",
    "Affected Infrastructure": "प्रभावित अवसंरचना",
    "Impacted Roads": "प्रभावित सड़कें",
    "Infrastructure": "अवसंरचना",
    "Buildings": "भवन",
    "Roads": "सड़कें",
    "Bridges": "पुल",
    "Water Bodies": "जल निकाय",
    "Critical Evacuation & Isochrone Window": "महत्वपूर्ण निकासी और समान-समय विंडो",
    "Golden Response Window": "स्वर्ण प्रतिक्रिया विंडो",
    "Designated Safe Shelters": "निर्धारित सुरक्षित आश्रय",
    "Live Topographic Synthesis": "लाइव टोपोग्राफिक संश्लेषण",
    "Terrain Elevation (DEM)": "भू-स्थलाकृति (DEM)",
    "Topographic Contours": "स्थलाकृतिक समोच्च",
    "Hillshade": "हिलशेड",
    "Satellite Imagery (RGB)": "उपग्रह चित्र (RGB)",
    "Base Layers": "आधार परतें",
    "Layers": "परतें",
    "Map Tools": "मैप टूल्स",
    "Draw": "ड्रा करें",
    "Pan": "पैन करें",
    "Measure": "मापें",
    "Identify": "पहचानें",
    "Zoom In": "ज़ूम इन",
    "Zoom Out": "ज़ूम आउट",
    "Replay": "पुनः चलाएं",
    "Play": "चलाएं",
    "Pause": "रोकें",
    "Close": "बंद करें",
    "View Details": "विवरण देखें",
    "Monitoring Stations": "निगरानी स्टेशन",
    "Rainfall Stations": "वर्षा स्टेशन",
    "Seismic Stations": "भूकंपीय स्टेशन",
    "Soil Moisture Sensors": "मिट्टी नमी सेंसर",
    "Seismic Activity": "भूकंपीय गतिविधि",
    "Rainfall (24h)": "वर्षा (24 घंटे)",
    "Rainfall Variation": "वर्षा परिवर्तन",
    "Seismic Variation": "भूकंपीय परिवर्तन",
    "Soil Moisture Variation": "मिट्टी नमी परिवर्तन",
    "Live Data": "लाइव डेटा",
    "Risk Progression (Last 6 Hours)": "जोखिम प्रगति (पिछले 6 घंटे)",
    "High Risk": "उच्च जोखिम",
    "High": "उच्च",
    "Moderate": "मध्यम",
    "Low": "कम",
    "Extreme": "अत्यंत",
    "DISASTER VIDEO STUDIO": "आपदा वीडियो स्टूडियो",
    "Cinematic 3D Disaster Simulation Renderer": "सिनेमैटिक 3D आपदा सिमुलेशन रेंडरर",
    "Select Geographic Area": "भौगोलिक क्षेत्र चुनें",
    "SELECT AREA": "क्षेत्र चुनें",
    "Click two opposite corners to draw the analysis box": "विश्लेषण बॉक्स बनाने के लिए दो विपरीत कोनों पर क्लिक करें",
    "clear selection": "चयन साफ़ करें",
    "Select an area first": "पहले एक क्षेत्र चुनें",
    "India Landslide Hotspots — fly to a documented failure zone": "भारत भूस्खलन हॉटस्पॉट — प्रलेखित क्षति क्षेत्र पर जाएं",
    "— Choose a region / district —": "— क्षेत्र / जिला चुनें —",
    "Disaster Type": "आपदा प्रकार",
    "Trigger Mechanism": "ट्रिगर तंत्र",
    "Extreme rainfall (monsoon cloudburst)": "अत्यधिक वर्षा (मानसून बादल फटना)",
    "Earthquake shaking (M 5.5–6.5)": "भूकंपीय कंपन (M 5.5–6.5)",
    "Deforestation — loss of root cohesion": "वनों की कटाई — जड़ संसंजन की हानि",
    "Road cutting / construction loading": "सड़क कटान / निर्माण भार",
    "Combined: rainfall + seismic + human": "संयुक्त: वर्षा + भूकंप + मानवीय",
    "Soil Saturation": "मिट्टी की संतृप्ति",
    "Rainfall Intensity": "वर्षा तीव्रता",
    "Rain Duration": "वर्षा अवधि",
    "Terrain Exaggeration": "भू-स्थलाकृति आवर्धन",
    "Video Length": "वीडियो लंबाई",
    "Camera Path": "कैमरा पथ",
    "Aerial Sweep": "हवाई स्वीप",
    "Establishing Push-In": "स्थापना पुश-इन",
    "Follow Flow Path": "प्रवाह पथ का पालन करें",
    "Time-Lapse Overview": "टाइम-लैप्स अवलोकन",
    "Lighting / Time of Day": "प्रकाश / दिन का समय",
    "Midday Clear": "दोपहर स्पष्ट",
    "Monsoon Storm": "मानसून तूफ़ान",
    "Dusk / Golden Hour": "संध्या / गोल्डन आवर",
    "Night Ops": "रात्रि अभियान",
    "Weather During Capture": "कैप्चर के दौरान मौसम",
    "Clear skies (aftermath clarity)": "साफ़ आसमान (बाद की स्पष्टता)",
    "Steady rainfall": "लगातार वर्षा",
    "Heavy monsoon storm + lightning": "भारी मानसून तूफ़ान + बिजली",
    "Resolution": "रिज़ॉल्यूशन",
    "HD 720p": "HD 720p",
    "Full HD 1080p": "फुल HD 1080p",
    "UHD 4K": "UHD 4K",
    "Format": "प्रारूप",
    "MP4 (H.264)": "MP4 (H.264)",
    "WebM (VP9)": "WebM (VP9)",
    "RENDER": "रेंडर करें",
    "EXPORT": "निर्यात करें",
    "Download": "डाउनलोड करें",
    "Generate": "जनरेट करें",
    "CONFIGURE": "कॉन्फ़िगर करें",
    "STEP 1": "चरण 1",
    "STEP 2": "चरण 2",
    "STEP 3 — RENDER PIPELINE": "चरण 3 — रेंडर पाइपलाइन",
    "Simulation & Camera Configuration": "सिमुलेशन और कैमरा कॉन्फ़िगरेशन",
    "Terrain Acquisition": "भू-अर्जन",
    "Disaster Physics": "आपदा भौतिकी",
    "Cinematic Render": "सिनेमैटिक रेंडर",
    "Video Encoding": "वीडियो एनकोडिंग",
    "Waiting": "प्रतीक्षा",
    "Done": "पूर्ण",
    "Population exposed": "प्रभावित जनसंख्या",
    "Buildings at risk": "जोखिम में भवन",
    "Affected area": "प्रभावित क्षेत्र",
    "Evacuation window": "निकासी विंडो",
    "Severity index": "गंभीरता सूचकांक",
    "Peak velocity": "अधिकतम वेग",
    "INTERACTIVE 3D RECONSTRUCTION": "इंटरैक्टिव 3D पुनर्निर्माण",
    "IMPACT ASSESSMENT": "प्रभाव आकलन",
    "TERRAIN & TRIGGER ANALYSIS": "भू-स्थलाकृति और ट्रिगर विश्लेषण",
    "LANDSLIDE SIMULATION": "भूस्खलन सिमुलेशन",
    "FLASH FLOOD SIMULATION": "अचानक बाढ़ सिमुलेशन",
    "SEVERITY": "गंभीरता",
    "RUNOUT": "बहाव",
    "PEAK SPEED": "अधिकतम गति",
    "MOBILE MASS": "गतिशील द्रव्यमान",
    "THICKNESS": "मोटाई",
    "MAX DEPTH": "अधिकतम गहराई",
    "PEAK FLOW": "अधिकतम प्रवाह",
    "DISCHARGE": "निस्सरण",
    "INUNDATED": "जलमग्न क्षेत्र",
    "SIM TIME": "सिम समय",
    "FRAME": "फ्रेम",
    "load a demo area (Wayanad)": "डेमो क्षेत्र लोड करें (वायनाड)",
    "NH-766 / Wayanad Thamarassery Churam": "NH-766 / वायनाड थमरस्सेरी चुरम",
    "Perspective": "परिप्रेक्ष्य",
    "Top": "ऊपर से",
    "Side": "बगल से",
    "Monsoon light": "मानसून प्रकाश",
    "Midday": "दोपहर",
    "Dusk": "संध्या",
    "Night": "रात",
    "Rain": "वर्षा",
    "Storm": "तूफ़ान",
    "Clear": "साफ़",
    "Record View": "व्यू रिकॉर्ड करें",
    "Relief": "उच्चावच",
    "Draw Box": "बॉक्स बनाएं",
    "Draw Polygon": "पॉलीगॉन बनाएं",
    "Drop Pin": "पिन रखें",
    "Box": "बॉक्स",
    "Polygon": "पॉलीगॉन",
    "Pin + Radius": "पिन + त्रिज्या",
    "Overview": "अवलोकन",
    "Risk Map": "जोखिम मैप",
    "Alerts": "चेतावनियाँ",
    "Field Reports": "फील्ड रिपोर्ट",
    "Analytics": "विश्लेषण",
    "Settings": "सेटिंग्स",
    "COMMAND CENTER": "कमांड सेंटर",
    "SYSTEM": "प्रणाली",
    "3D Risk Heatmap": "3D जोखिम हीटमैप",
    "Open in 3D Simulation Cockpit": "3D सिमुलेशन कॉकपिट में खोलें",
    "Show Flow Path": "प्रवाह पथ दिखाएं",
    "Show Runout Zone": "बहाव क्षेत्र दिखाएं",
    "Show Contours": "समोच्च दिखाएं",
    "Power Lines": "बिजली लाइनें",
    "Communication Towers": "संचार टावर",
    "Water Pipelines": "जल पाइपलाइन",
    "Administrative": "प्रशासनिक",
    "District Boundary": "जिला सीमा",
    "Village Boundary": "ग्राम सीमा",
    "Clay Loam (Residual Laterite)": "मृत्तिका दोमट (अवशिष्ट लैटेराइट)",
    "Combined": "संयुक्त"
  },
  as: {
    "3D Simulation": "3D ভূমিকম্প অনুকৰণ",
    "Video Studio": "ভিডিঅ' ষ্টুডিঅ'",
    "DISASTER VIDEO STUDIO": "দুর্যোগ ভিডিঅ' ষ্টুডিঅ'",
    "Select Geographic Area": "ভৌগোলিক অঞ্চল বাছনি কৰক",
    "SELECT AREA": "অঞ্চল বাছনি কৰক",
    "Disaster Type": "দুর্যোগৰ প্ৰকাৰ",
    "Trigger Mechanism": "ট্ৰিগাৰ প্ৰণালী",
    "Camera Path": "কেমেৰা পথ",
    "Resolution": "ৰেজলিউচন",
    "Format": "ফৰ্মেট",
    "RENDER": "ৰেণ্ডাৰ কৰক",
    "Download": "ডাউনল'ড কৰক",
    "Generate": "সৃষ্টি কৰক",
    "Terrain Acquisition": "ভূমি অধিগ্ৰহণ",
    "Disaster Physics": "দুর্যোগ পদাৰ্থবিজ্ঞান",
    "Cinematic Render": "চিনেমেটিক ৰেণ্ডাৰ",
    "Video Encoding": "ভিডিঅ' এনক'ডিং",
    "Population exposed": "প্ৰভাৱিত জনসংখ্যা",
    "Buildings at risk": "বিপদাপন্ন অট্টালিকা",
    "Affected area": "প্ৰভাৱিত অঞ্চল",
    "Evacuation window": "খালীকৰণৰ সময়",
    "Landslide Risk Zones": "ভূমিস্খলন বিপদাশংকাৰ ক্ষেত্ৰ"
  },
  bn: {
    "3D Simulation": "3D সিমুলেশন",
    "Video Studio": "ভিডিও স্টুডিও",
    "DISASTER VIDEO STUDIO": "দুর্যোগ ভিডিও স্টুডিও",
    "Select Geographic Area": "ভৌগোলিক এলাকা নির্বাচন করুন",
    "SELECT AREA": "এলাকা নির্বাচন করুন",
    "Disaster Type": "দুর্যোগের ধরন",
    "Trigger Mechanism": "ট্রিগার প্রক্রিয়া",
    "Camera Path": "ক্যামেরা পথ",
    "Resolution": "রেজোলিউশন",
    "Format": "ফরম্যাট",
    "RENDER": "রেন্ডার করুন",
    "Download": "ডাউনলোড করুন",
    "Generate": "তৈরি করুন",
    "Terrain Acquisition": "ভূমি অর্জন",
    "Disaster Physics": "দুর্যোগ পদার্থবিজ্ঞান",
    "Cinematic Render": "সিনেম্যাটিক রেন্ডার",
    "Video Encoding": "ভিডিও এনকোডিং",
    "Population exposed": "প্রভাবিত জনসংখ্যা",
    "Buildings at risk": "ঝুঁকিপূর্ণ ভবন",
    "Affected area": "প্রভাবিত এলাকা",
    "Evacuation window": "স্থানান্তরের সময়",
    "Landslide Risk Zones": "ভূমিধস ঝুঁকি অঞ্চল",
    "Runout Distance": "প্রবাহ দূরত্ব",
    "Slope Angle": "ঢাল কোণ",
    "Population Exposure": "জনসংখ্যার সংস্পর্শ"
  },
  ne: {
    "3D Simulation": "3D सिमुलेसन",
    "Video Studio": "भिडियो स्टुडियो",
    "DISASTER VIDEO STUDIO": "विपद् भिडियो स्टुडियो",
    "Select Geographic Area": "भौगोलिक क्षेत्र छान्नुहोस्",
    "SELECT AREA": "क्षेत्र छान्नुहोस्",
    "Disaster Type": "विपद्को प्रकार",
    "Trigger Mechanism": "ट्रिगर संयन्त्र",
    "Camera Path": "क्यामेरा मार्ग",
    "Resolution": "रेजोलुसन",
    "Format": "ढाँचा",
    "RENDER": "रेन्डर गर्नुहोस्",
    "Download": "डाउनलोड गर्नुहोस्",
    "Generate": "उत्पन्न गर्नुहोस्",
    "Terrain Acquisition": "भूमि प्राप्ति",
    "Disaster Physics": "विपद् भौतिकी",
    "Cinematic Render": "सिनेमेटिक रेन्डर",
    "Video Encoding": "भिडियो इन्कोडिङ",
    "Population exposed": "प्रभावित जनसंख्या",
    "Buildings at risk": "जोखिममा भवनहरू",
    "Affected area": "प्रभावित क्षेत्र",
    "Evacuation window": "सर्ने समय",
    "Landslide Risk Zones": "पहिरो जोखिम क्षेत्र"
  },
  ta: {
    "3D Simulation": "3D பாவனை",
    "Video Studio": "வீடியோ ஸ்டுடியோ",
    "DISASTER VIDEO STUDIO": "பேரழிவு வீடியோ ஸ்டுடியோ",
    "Select Geographic Area": "புவியியல் பகுதியைத் தேர்ந்தெடுக்கவும்",
    "SELECT AREA": "பகுதியைத் தேர்வு செய்க",
    "Disaster Type": "பேரழிவு வகை",
    "Trigger Mechanism": "தூண்டுதல் முறை",
    "Camera Path": "கேமரா பாதை",
    "Resolution": "தெளிவுத்திறன்",
    "Format": "வடிவம்",
    "RENDER": "வரையவும்",
    "Download": "பதிவிறக்கம்",
    "Generate": "உருவாக்கு",
    "Terrain Acquisition": "நிலப்பரப்பு பெறுதல்",
    "Disaster Physics": "பேரழிவு இயற்பியல்",
    "Cinematic Render": "சினமாட்டிக் ரெண்டர்",
    "Video Encoding": "வீடியோ குறியாக்கம்",
    "Population exposed": "பாதிக்கப்பட்ட மக்கள்",
    "Buildings at risk": "ஆபத்தில் உள்ள கட்டிடங்கள்",
    "Affected area": "பாதிக்கப்பட்ட பகுதி",
    "Evacuation window": "வெளியேற்றும் நேரம்",
    "Landslide Risk Zones": "நிலச்சரிவு ஆபத்து மண்டலங்கள்",
    "Runout Distance": "பாய்வு தூரம்",
    "Slope Angle": "சரிவு கோணம்",
    "Population Exposure": "மக்கள் பாதிப்பு"
  },
  te: {
    "3D Simulation": "3D సిమ్యులేషన్",
    "Video Studio": "వీడియో స్టూడియో",
    "DISASTER VIDEO STUDIO": "విపత్తు వీడియో స్టూడియో",
    "Select Geographic Area": "భౌగోళిక ప్రాంతాన్ని ఎంచుకోండి",
    "SELECT AREA": "ప్రాంతాన్ని ఎంచుకోండి",
    "Disaster Type": "విపత్తు రకం",
    "Trigger Mechanism": "ట్రిగర్ యంత్రాంగం",
    "Camera Path": "కెమెరా మార్గం",
    "Resolution": "రిజల్యూషన్",
    "Format": "ఫార్మాట్",
    "RENDER": "రెండర్ చేయండి",
    "Download": "డౌన్‌లోడ్ చేయండి",
    "Generate": "సృష్టించండి",
    "Terrain Acquisition": "భూమి సేకరణ",
    "Disaster Physics": "విపత్తు భౌతికశాస్త్రం",
    "Cinematic Render": "సినిమాటిక్ రెండర్",
    "Video Encoding": "వీడియో ఎన్కోడింగ్",
    "Population exposed": "ప్రభావిత జనాభా",
    "Buildings at risk": "ప్రమాదంలో ఉన్న భవనాలు",
    "Affected area": "ప్రభావిత ప్రాంతం",
    "Evacuation window": "ఖాళీ చేసే సమయం",
    "Landslide Risk Zones": "కొండచునక ప్రమాద మండలాలు"
  },
  ml: {
    "3D Simulation": "3D സിമുലേഷൻ",
    "Video Studio": "വീഡിയോ സ്റ്റുഡിയോ",
    "DISASTER VIDEO STUDIO": "ദുരന്ത വീഡിയോ സ്റ്റുഡിയോ",
    "Select Geographic Area": "ഭൗമശാസ്ത്ര പ്രദേശം തിരഞ്ഞെടുക്കുക",
    "SELECT AREA": "പ്രദേശം തിരഞ്ഞെടുക്കുക",
    "Disaster Type": "ദുരന്ത തരം",
    "Trigger Mechanism": "ട്രിഗർ സംവിധാനം",
    "Camera Path": "ക്യാമറ പാത",
    "Resolution": "റെസല്യൂഷൻ",
    "Format": "ഫോർമാറ്റ്",
    "RENDER": "റെൻഡർ ചെയ്യുക",
    "Download": "ഡൗൺലോഡ് ചെയ്യുക",
    "Generate": "സൃഷ്ടിക്കുക",
    "Terrain Acquisition": "ഭൂപ്രദേശ ഏറ്റെടുപ്പ്",
    "Disaster Physics": "ദുരന്ത ഭൗതികശാസ്ത്രം",
    "Cinematic Render": "സിനിമാറ്റിക് റെൻഡർ",
    "Video Encoding": "വീഡിയോ എൻകോഡിംഗ്",
    "Population exposed": "ബാധിത ജനസംഖ്യ",
    "Buildings at risk": "അപകടത്തിലുള്ള കെട്ടിടങ്ങൾ",
    "Affected area": "ബാധിത പ്രദേശം",
    "Evacuation window": "ഒഴിപ്പിക്കൽ സമയം",
    "Landslide Risk Zones": "മണ്ണിടിച്ചൽ അപകട മേഖലകൾ"
  },
  kn: {
    "3D Simulation": "3D ಅನುಕರಣೆ",
    "Video Studio": "ವೀಡಿಯೊ ಸ್ಟುಡಿಯೊ",
    "DISASTER VIDEO STUDIO": "ವಿಪತ್ತು ವೀಡಿಯೊ ಸ್ಟುಡಿಯೊ",
    "Select Geographic Area": "ಭೌಗೋಳಿಕ ಪ್ರದೇಶವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
    "SELECT AREA": "ಪ್ರದೇಶವನ್ನು ಆಯ್ಕೆಮಾಡಿ",
    "Disaster Type": "ವಿಪತ್ತಿನ ಪ್ರಕಾರ",
    "Trigger Mechanism": "ಟ್ರಿಗರ್ ಕಾರ್ಯವಿಧಾನ",
    "Camera Path": "ಕ್ಯಾಮೆರಾ ಮಾರ್ಗ",
    "Resolution": "ರೆಸಲ್ಯೂಶನ್",
    "Format": "ಸ್ವರೂಪ",
    "RENDER": "ರೆಂಡರ್ ಮಾಡಿ",
    "Download": "ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ",
    "Generate": "ರಚಿಸಿ",
    "Terrain Acquisition": "ಭೂಪ್ರದೇಶ ಸ್ವಾಧೀನ",
    "Disaster Physics": "ವಿಪತ್ತು ಭೌತಶಾಸ್ತ್ರ",
    "Cinematic Render": "ಸಿನೆಮಾಟಿಕ್ ರೆಂಡರ್",
    "Video Encoding": "ವೀಡಿಯೊ ಎನ್ಕೋಡಿಂಗ್",
    "Population exposed": "ಪೀಡಿತ ಜನಸಂಖ್ಯೆ",
    "Buildings at risk": "ಅಪಾಯದಲ್ಲಿರುವ ಕಟ್ಟಡಗಳು",
    "Affected area": "ಪೀಡಿತ ಪ್ರದೇಶ",
    "Evacuation window": "ಸ್ಥಳಾಂತರ ಸಮಯ",
    "Landslide Risk Zones": "ಭೂಕುಸಿತ ಅಪಾಯ ವಲಯಗಳು"
  },
  mr: {
    "3D Simulation": "3D सिम्युलेशन",
    "Video Studio": "व्हिडिओ स्टुडिओ",
    "DISASTER VIDEO STUDIO": "आपत्ती व्हिडिओ स्टुडिओ",
    "Select Geographic Area": "भौगोलिक क्षेत्र निवडा",
    "SELECT AREA": "क्षेत्र निवडा",
    "Disaster Type": "आपत्ती प्रकार",
    "Trigger Mechanism": "ट्रिगर यंत्रणा",
    "Camera Path": "कॅमेरा मार्ग",
    "Resolution": "रेझोल्यूशन",
    "Format": "स्वरूप",
    "RENDER": "रेंडर करा",
    "Download": "डाउनलोड करा",
    "Generate": "तयार करा",
    "Terrain Acquisition": "भूप्रदेश संपादन",
    "Disaster Physics": "आपत्ती भौतिकशास्त्र",
    "Cinematic Render": "सिनेमॅटिक रेंडर",
    "Video Encoding": "व्हिडिओ एन्कोडिंग",
    "Population exposed": "प्रभावित लोकसंख्या",
    "Buildings at risk": "धोक्यातील इमारती",
    "Affected area": "प्रभावित क्षेत्र",
    "Evacuation window": "स्थलांतर वेळ",
    "Landslide Risk Zones": "भूस्खलन धोका क्षेत्रे"
  }
};

// Merge simulation-module phrases into the master dictionary so
// translateNode() picks up Video Studio + 3D cockpit labels.
for (const [code, phrases] of Object.entries(SIM_PHRASES)) {
  DICTIONARY[code] = { ...(DICTIONARY[code] || {}), ...phrases };
}

let currentLanguage = localStorage.getItem('aravindha_language') || 'en';

/**
 * Get language code from language name (e.g., 'Hindi' -> 'hi', 'Assamese' -> 'as')
 */
export function getLangCode(nameOrCode) {
  if (!nameOrCode) return 'en';
  const match = LANGUAGES.find(l => 
    l.code.toLowerCase() === nameOrCode.toLowerCase() || 
    l.name.toLowerCase() === nameOrCode.toLowerCase() ||
    l.native.toLowerCase() === nameOrCode.toLowerCase()
  );
  return match ? match.code : 'en';
}

/**
 * Get language name from code (e.g., 'hi' -> 'Hindi')
 */
export function getLangName(code) {
  const match = LANGUAGES.find(l => l.code === code);
  return match ? match.name : 'English';
}

/**
 * Helper to translate a single phrase
 */
export function t(phrase, lang = currentLanguage) {
  const code = getLangCode(lang);
  if (code === 'en') return phrase;
  const dict = DICTIONARY[code];
  if (dict && dict[phrase]) {
    return dict[phrase];
  }
  return phrase;
}

const originalTextMap = new WeakMap();

/**
 * Intelligent phrase matcher with emoji/symbol prefix support
 */
function findTranslation(text, dict) {
  if (!text || !dict) return null;
  if (dict[text]) return dict[text];

  // Match emoji/symbol prefixes like "🔥 LIVE HEATMAP", "📲 Send Alert Now (SMS)", "💾 Save Gateway Settings"
  const prefixMatch = text.match(/^([\p{Extended_Pictographic}\p{Symbol}\s+•◈⌖⚠▣◫⚙☼≈◉⚡📡🧪📱🚀💾📊📲]+)(.*)$/u);
  if (prefixMatch) {
    const prefix = prefixMatch[1];
    const core = prefixMatch[2].trim();
    if (dict[core]) {
      if (/^[\p{Extended_Pictographic}\p{Symbol}•◈⌖⚠▣◫⚙☼≈◉⚡📡🧪📱🚀💾📊📲]/u.test(dict[core].trim())) {
        return dict[core];
      }
      return prefix + dict[core];
    }
  }

  // Case-insensitive fallback
  const lower = text.toLowerCase();
  for (const [key, val] of Object.entries(dict)) {
    if (key.toLowerCase() === lower) {
      return val;
    }
  }

  return null;
}

/**
 * Recursively walk elements in DOM and translate matching text nodes
 */
function translateNode(node, dict, isEnglish) {
  if (!node) return;

  // Skip scripts, styles, code tags, and the language selector dropdown itself
  if (['SCRIPT', 'STYLE', 'CODE', 'PRE'].includes(node.nodeName)) {
    return;
  }
  if (node.id === 'languageSelect' || node.closest?.('#languageSelect')) {
    return;
  }

  if (node.nodeType === Node.TEXT_NODE) {
    let raw = originalTextMap.get(node);
    if (raw === undefined) {
      raw = node.nodeValue;
      originalTextMap.set(node, raw);
    }

    const trimmed = raw.trim();
    if (trimmed) {
      if (isEnglish) {
        node.nodeValue = raw;
      } else {
        const translated = findTranslation(trimmed, dict);
        if (translated) {
          node.nodeValue = raw.replace(trimmed, translated);
        }
      }
    }
    return;
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    // Translate placeholder attributes if any
    if (node.placeholder) {
      if (!node.dataset.origPlaceholder) node.dataset.origPlaceholder = node.placeholder;
      const orig = node.dataset.origPlaceholder;
      node.placeholder = isEnglish ? orig : (findTranslation(orig, dict) || orig);
    }

    // Traverse children
    const children = Array.from(node.childNodes);
    for (const child of children) {
      translateNode(child, dict, isEnglish);
    }
  }
}

/**
 * Apply selected language across the entire document
 */
export function setLanguage(nameOrCode) {
  const code = getLangCode(nameOrCode);
  currentLanguage = code;
  localStorage.setItem('aravindha_language', code);

  const dict = DICTIONARY[code] || {};
  const isEnglish = code === 'en';

  // Translate document title
  document.title = isEnglish ? 'ARAVINDHA — Disaster Monitoring Command Center' : `${t('ARAVINDHA', code)} — ${t('Disaster Monitoring Command Center', code)}`;

  // Synchronize language dropdown if present
  const select = document.querySelector('#languageSelect');
  if (select) {
    const langObj = LANGUAGES.find(l => l.code === code);
    if (langObj) {
      for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value.toLowerCase() === langObj.name.toLowerCase()) {
          select.selectedIndex = i;
          break;
        }
      }
    }
  }

  // Walk root container
  const root = document.querySelector('#app') || document.body;
  if (root) {
    translateNode(root, dict, isEnglish);
  }

  // Dispatch global event for modular listeners
  window.dispatchEvent(new CustomEvent('aravindha_language_changed', {
    detail: { language: code, name: getLangName(code) }
  }));

  console.log(`[i18n] Language switched to: ${getLangName(code)} (${code})`);
}

/**
 * Initialize i18n system, bind selector, and setup MutationObserver for dynamically loaded panels
 */
export function initI18n() {
  const saved = localStorage.getItem('aravindha_language') || 'en';
  
  // Bind language selector change
  const select = document.querySelector('#languageSelect');
  if (select) {
    // Populate options with native scripts for clarity
    select.innerHTML = LANGUAGES.map(l => 
      `<option value="${l.name}" ${l.code === saved ? 'selected' : ''}>${l.name} (${l.native})</option>`
    ).join('');

    select.addEventListener('change', (e) => {
      setLanguage(e.target.value);
    });
  }

  // Initial translation if not English
  if (saved !== 'en') {
    // Slight delay to allow initial DOM rendering
    setTimeout(() => {
      setLanguage(saved);
    }, 100);
  }

  // Setup MutationObserver so new cards, audit rows, or settings tabs automatically get translated
  let translationDebounce = null;
  const observer = new MutationObserver((mutations) => {
    if (currentLanguage === 'en') return;

    let hasNewText = false;
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length > 0) {
        hasNewText = true;
        break;
      }
    }

    if (hasNewText) {
      clearTimeout(translationDebounce);
      translationDebounce = setTimeout(() => {
        const dict = DICTIONARY[currentLanguage] || {};
        const root = document.querySelector('#app') || document.body;
        if (root) translateNode(root, dict, false);
      }, 50);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
