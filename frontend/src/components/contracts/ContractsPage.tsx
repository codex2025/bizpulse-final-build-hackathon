import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import {
  Upload, FileText, AlertTriangle, CheckCircle,
  ChevronDown, ChevronUp, Loader2, Send,
  Mail, Sparkles, DollarSign,
  Zap, ArrowRight, Lightbulb, BarChart3, Wallet,
  Trash2, Columns, ThumbsUp, ThumbsDown,
  AlertOctagon, Check, Globe, Mic, MicOff, Languages
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import { Topbar } from '../common/Topbar';
import { contractService } from '../../services/contractService';
import { usePersona } from '../../context/PersonaContext';

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', flag: 'EN' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', flag: 'HI' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', flag: 'TA' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', flag: 'TE' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', flag: 'KN' },
  { code: 'mr', name: 'Marathi', native: 'मराठी', flag: 'MR' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', flag: 'BN' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', flag: 'GU' },
];

const SPEECH_LANG_MAP: Record<string, string> = {
  ta: 'ta-IN',
  hi: 'hi-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  mr: 'mr-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
  en: 'en-IN',
};

const LOCALIZED_UI: Record<string, Record<string, string>> = {
  hi: {
    recommendation: 'अंतिम वित्तीय सिफारिश',
    ACCEPT: 'स्वीकार करें (सुरक्षित)',
    DECLINE: 'अस्वीकार करें (हस्ताक्षर न करें)',
    RENEGOTIATE: 'पुनर्विचार करें (पहले शर्तें बदलें)',
    headline_accept: 'इस समझौते के साथ आगे बढ़ना सुरक्षित है',
    headline_decline: 'इस समझौते पर हस्ताक्षर न करें',
    headline_renegotiate: 'हस्ताक्षर रोकें — पहले मुख्य शर्तों पर बातचीत करें',
    summary_accept: 'यह समझौता अनुकूल बाजार शर्तों, मानक कानूनी सुरक्षा और आपकी वित्तीय क्षमता के अनुसार है।',
    summary_decline: 'इस ऋण में गंभीर वित्तीय खतरे या अनुचित शर्तें हैं जो आपके लिए बड़ा जोखिम पैदा करती हैं।',
    summary_renegotiate: 'यह समझौता ठीक है, लेकिन इसमें कुछ जोखिम भरी शर्तें हैं जिन्हें पहले बदलना आवश्यक है।',
    why_accept: 'आपको इसे क्यों स्वीकार करना चाहिए:',
    why_decline: 'आपको इसे क्यों अस्वीकार करना चाहिए:',
    why_renegotiate: 'आपको पहले बातचीत क्यों करनी चाहिए:',
    doc_overview: 'अनुबंध दस्तावेज़ सारांश',
    monthly_pay: 'मासिक भुगतान',
    total_interest: 'कुल ब्याज',
    tenure: 'अवधि',
    key_terms: 'मुख्य शर्तें और सारांश:',
    financial_baseline: 'आपकी वित्तीय स्थिति और ऋण सामर्थ्य',
    baseline_desc: 'आपकी सत्यापित मासिक आय, आवर्ती व्यय और नकदी अधिशेष के आधार पर मूल्यांकन किया गया',
    past_income: 'मासिक आय / वेतन',
    past_expense: 'मासिक व्यय',
    new_emi: 'नई मासिक किस्त',
    cushion: 'शेष बचत अधिशेष',
    free_buffer: 'सुरक्षित मासिक बचत',
    comparison_chart: 'मासिक नकदी प्रवाह तुलना',
    original_text: 'मूल अनुबंध पाठ (यथावत):',
    plain_meaning: 'सरल भाषा में अर्थ:',
    cost_impact: 'लागत प्रभाव:',
    action_tip: 'सलाह:',
    why_risky: 'यह आपके लिए जोखिम भरा क्यों है:',
    tab_overview: 'कार्यकारी सारांश और निर्णय',
    tab_clauses: 'धारा विवरण',
    tab_baseline: 'वित्तीय स्थिति',
    tab_schedule: 'भुगतान अनुसूची',
    tab_assistant: 'अनुबंध सहायक',
    assistant_title: 'इंटरैक्टिव अनुबंध सहायक',
    assistant_desc: 'सत्यापित दस्तावेज़ संदर्भों के साथ कोई भी प्रश्न पूछें',
    ask_placeholder: 'हिंदी में अपना प्रश्न टाइप करें या बोलें...',
    ask_btn: 'पूछें',
    upload_btn: 'नया अनुबंध अपलोड करें',
    dropzone_active: 'अपना अनुबंध यहाँ छोड़ें',
    dropzone_idle: 'कोई भी वित्तीय अनुबंध यहाँ खींचें और छोड़ें (PDF, DOCX, इमेज, या TXT)',
    dropzone_sub: '8 भारतीय भाषाओं में व्यावसायिक ऋण, होम मॉर्गेज, व्यक्तिगत ऋण और क्रेडिट लाइनों का समर्थन करता है',
    fixed_emi: 'नियत मासिक किस्त',
    total_cost: 'कुल वित्तपोषण लागत',
    total_interest_obl: 'कुल ब्याज दायित्व',
    prepay_exit: 'समयपूर्व निकास शुल्क',
    due_monthly: 'प्रति माह देय',
    principal_interest: 'मूलधन + ब्याज',
    over_months: 'महीनों में',
    exit_charge: 'समयपूर्व भुगतान शुल्क',
    lender_points_title: 'ऋणदाता चर्चा बिंदु',
    lender_points_desc: 'हस्ताक्षर करने से पहले अनुशंसित समायोजन',
    neg_1_title: '1. बेंचमार्क पारदर्शिता:',
    neg_1_desc: 'अनुरोध करें कि मनमानी स्प्रेड वृद्धि से बचने के लिए ब्याज दर बाहरी बेंचमार्क से जुड़ी हो।',
    neg_2_title: '2. छूट अवधि नोटिस:',
    neg_2_desc: 'किसी भी पेनल्टी या डिफॉल्ट कार्रवाई से पहले अनिवार्य 15-दिन के लिखित नोटिस विंडो का अनुरोध करें।',
    neg_3_title: '3. समयपूर्व भुगतान सुरक्षा:',
    neg_3_desc: 'साधारण व्यावसायिक आय से किए गए समयपूर्व भुगतान पर 0% पेनल्टी की पुष्टि करें।'
  },
  ta: {
    recommendation: 'இறுதி நிதி பரிந்துரை',
    ACCEPT: 'ஏற்றுக்கொள்ளுங்கள் (பாதுகாப்பானது)',
    DECLINE: 'நிராகரிக்கவும் (கையொப்பமிட வேண்டாம்)',
    RENEGOTIATE: 'மறுபேச்சுவார்த்தை (விதிமுறைகளை மாற்றவும்)',
    headline_accept: 'இந்த ஒப்பந்தத்தில் கையொப்பமிடுவது பாதுகாப்பானது',
    headline_decline: 'இந்த ஒப்பந்தத்தில் கையொப்பமிட வேண்டாம்',
    headline_renegotiate: 'கையொப்பமிடுவதை நிறுத்துங்கள் — முதலில் முக்கிய விதிமுறைகளை பேசுங்கள்',
    summary_accept: 'இந்த ஒப்பந்தம் சாதகமான சந்தை விதிமுறைகள் மற்றும் உங்கள் நிதி திறனுக்குள் உள்ளது.',
    summary_decline: 'இந்த கடனில் கடுமையான நிதி அபாயங்கள் அல்லது ஆபத்தான நிபந்தனைகள் உள்ளன.',
    summary_renegotiate: 'இந்த ஒப்பந்தம் ஏற்கத்தக்கது, ஆனால் கையொப்பமிடுவதற்கு முன் சில விதிமுறைகளை மாற்ற வேண்டும்.',
    why_accept: 'நீங்கள் இதை ஏன் ஏற்றுக்கொள்ள வேண்டும்:',
    why_decline: 'நீங்கள் இதை ஏன் நிராகரிக்க வேண்டும்:',
    why_renegotiate: 'நீங்கள் ஏன் முதலில் பேச்சுவார்த்தை நடத்த வேண்டும்:',
    doc_overview: 'ஒப்பந்த ஆவண சுருக்கம்',
    monthly_pay: 'மாதாந்திர தவணை',
    total_interest: 'மொத்த வட்டி',
    tenure: 'கால அளவு',
    key_terms: 'முக்கிய விதிமுறைகள் மற்றும் சுருக்கம்:',
    financial_baseline: 'உங்கள் நிதி நிலை மற்றும் கடன் திறன்',
    baseline_desc: 'உங்கள் சரிபார்க்கப்பட்ட வருமானம் மற்றும் சேமிப்பு அடிப்படையில் மதிப்பீடு செய்யப்பட்டது',
    past_income: 'மாதாந்திர வருமானம்',
    past_expense: 'மாதாந்திர செலவுகள்',
    new_emi: 'புதிய மாதாந்திர தவணை',
    cushion: 'மீதமுள்ள சேமிப்பு',
    free_buffer: 'பாதுகாப்பான மாதாந்திர இருப்பு',
    comparison_chart: 'மாதாந்திர பணப்புழக்க ஒப்பீடு',
    original_text: 'அசல் ஒப்பந்த உரை:',
    plain_meaning: 'எளிய தமிழ் விளக்கம்:',
    cost_impact: 'செலவு தாக்கம்:',
    action_tip: 'முக்கிய ஆலோசனை:',
    why_risky: 'இது ஏன் ஆபத்தானது:',
    tab_overview: 'சுருக்கம் & பரிந்துரை',
    tab_clauses: 'விதிமுறைகள் விவரம்',
    tab_baseline: 'நிதி அடிப்படை',
    tab_schedule: 'தவணை அட்டவணை',
    tab_assistant: 'ஒப்பந்த உதவியாளர்',
    assistant_title: 'ஒப்பந்த உதவியாளர்',
    assistant_desc: 'ஆவணப் பக்கக் குறிப்புகளுடன் ஏதேனும் கேள்வி கேளுங்கள்',
    ask_placeholder: 'தமிழில் உங்கள் கேள்வியைத் தட்டச்சு செய்யவும் அல்லது பேசவும்...',
    ask_btn: 'கேட்க',
    upload_btn: 'ஒப்பந்தத்தை பதிவேற்றவும்',
    dropzone_active: 'உங்கள் ஆவணத்தை இங்கே விடுங்கள்',
    dropzone_idle: 'எந்தவொரு நிதி ஒப்பந்தத்தையும் பதிவேற்றவும் (PDF, DOCX, படம், அல்லது TXT)',
    dropzone_sub: '8 இந்திய மொழிகளில் வணிக கடன்கள், வீட்டுக் கடன்கள் மற்றும் தனிநபர் கடன்களை ஆதரிக்கிறது',
    fixed_emi: 'நிலையான மாதாந்திர தவணை',
    total_cost: 'மொத்த நிதி செலவு',
    total_interest_obl: 'மொத்த வட்டி பொறுப்பு',
    prepay_exit: 'முன்கூட்டியே வெளியேறும் கட்டணம்',
    due_monthly: 'மாதாந்திர தவணை',
    principal_interest: 'அசல் + வட்டி',
    over_months: 'மாதங்களில்',
    exit_charge: 'முன்கூட்டியே அடைக்கும் கட்டணம்',
    lender_points_title: 'வங்கி பேச்சுவார்த்தை குறிப்புகள்',
    lender_points_desc: 'கையொப்பமிடுவதற்கு முன் பரிந்துரைக்கப்படும் மாற்றங்கள்',
    neg_1_title: '1. வட்டி வெளிப்படைத்தன்மை:',
    neg_1_desc: 'தன்னிச்சையான வட்டி உயர்வைத் தவிர்க்க வட்டி விகிதங்கள் வெளிப்புற அளவுகோலுடன் இணைக்கப்பட வேண்டும் என்று கோருங்கள்.',
    neg_2_title: '2. சலுகை கால அறிவிப்பு:',
    neg_2_desc: 'அபராதக் கட்டணங்கள் வசூலிக்கப்படுவதற்கு முன்பு கட்டாயமாக 15 நாள் எழுத்துப்பூர்வ அறிவிப்பு சாளரத்தைக் கோருங்கள்.',
    neg_3_title: '3. முன்கூட்டியே செலுத்தும் பாதுகாப்பு:',
    neg_3_desc: 'சாதாரண வணிக வருமானத்திலிருந்து செய்யப்படும் முன்கூட்டியே செலுத்துதல்களுக்கு 0% வெளியேறும் அபராதத்தை உறுதிப்படுத்தவும்.'
  },
  te: {
    recommendation: 'తుది ఆర్థిక సిఫార్సు',
    ACCEPT: 'అంగీకరించండి (సురక్షితం)',
    DECLINE: 'తిరస్కరించండి (సంతకం చేయవద్దు)',
    RENEGOTIATE: 'పునఃచర్చలు (ముందుగా నిబంధనలు మార్చండి)',
    headline_accept: 'ఈ ఒప్పందాన్ని ముందుకు తీసుకెళ్లడం సురక్షితం',
    headline_decline: 'ఈ ఒప్పందంపై సంతకం చేయవద్దు',
    headline_renegotiate: 'సంతకం ఆపండి — ముందుగా ముఖ్యమైన నిబంధనలపై చర్చించండి',
    summary_accept: 'ఈ ఒప్పందం అనుకూలమైన నిబంధనలు మరియు మీ ఆర్థిక పరిమితులకు సరిపోతుంది.',
    summary_decline: 'ఈ అప్పులో భారీ ఆర్థిక ప్రమాదాలు లేదా దోపిడీ నిబంధనలు ఉన్నాయి.',
    summary_renegotiate: 'ఈ ఒప్పందం ఆమోదయోగ్యమైనది, కానీ కొన్ని నిబంధనలను సవరించాలి.',
    why_accept: 'మీరు దీన్ని ఎందుకు అంగీకరించాలి:',
    why_decline: 'మీరు దీన్ని ఎందుకు తిరస్కరించాలి:',
    why_renegotiate: 'మీరు ముందుగా ఎందుకు చర్చించాలి:',
    doc_overview: 'ఒప్పంద పత్రం సారాంశం',
    monthly_pay: 'నెలవారీ చెల్లింపు',
    total_interest: 'మొత్తం వడ్డీ',
    tenure: 'కాలపరిమితి',
    key_terms: 'ముఖ్య నిబంధనలు & సారాంశం:',
    financial_baseline: 'మీ ఆర్థిక పరిస్థితి మరియు రుణ స్థోమత',
    baseline_desc: 'మీ నెలవారీ ఆదాయం మరియు వ్యయాల ఆధారంగా విశ్లేషించబడింది',
    past_income: 'నెలవారీ ఆదాయం',
    past_expense: 'నెలవారీ ఖర్చులు',
    new_emi: 'కొత్త నెలవారీ వాయిదా',
    cushion: 'మిగిలిన నిల్వ',
    free_buffer: 'సురక్షిత మిగులు',
    comparison_chart: 'నెలవారీ నగదు ప్రవాహ పోలిక',
    original_text: 'అసలు ఒప్పంద పాఠం:',
    plain_meaning: 'సరళమైన తెలుగు అర్థం:',
    cost_impact: 'ఖర్చు ప్రభావం:',
    action_tip: 'సలహా:',
    why_risky: 'ఇది ఎందుకు ప్రమాదకరం:',
    tab_overview: 'సారాంశం & నిర్ణయం',
    tab_clauses: 'నిబంధనల వివరాలు',
    tab_baseline: 'ఆర్థిక పరిస్థితి',
    tab_schedule: 'చెల్లింపుల పట్టిక',
    tab_assistant: 'ఒప్పంద సహాయకుడు',
    assistant_title: 'ఇంటరాక్టివ్ సహాయకుడు',
    assistant_desc: 'పత్రం ఆధారంగా ఏదైనా ప్రశ్న అడగండి',
    ask_placeholder: 'తెలుగులో మీ ప్రశ్నను టైప్ చేయండి లేదా మాట్లాడండి...',
    ask_btn: 'అడగండి',
    upload_btn: 'ఒప్పందాన్ని అప్‌లోడ్ చేయండి',
    dropzone_active: 'మీ పత్రాన్ని ఇక్కడ వేయండి',
    dropzone_idle: 'ఏదైనా ఆర్థిక ఒప్పందాన్ని అప్‌లోడ్ చేయండి (PDF, DOCX, ఇమేజ్, లేదా TXT)',
    dropzone_sub: '8 భారతీయ భాషలలో వ్యాపార మరియు వ్యక్తిగత రుణాల మద్దతు',
    fixed_emi: 'స్థిర నెలవారీ వాయిదా',
    total_cost: 'మొత్తం రుణ ఖర్చు',
    total_interest_obl: 'మొత్తం వడ్డీ బాధ్యత',
    prepay_exit: 'ముందస్తు చెల్లింపు రుసుము',
    due_monthly: 'ప్రతినెల చెల్లించాల్సింది',
    principal_interest: 'అసలు + వడ్డీ',
    over_months: 'నెలలలో',
    exit_charge: 'ముందస్తు క్లోజర్ ఛార్జ్',
    lender_points_title: 'బ్యాంక్ చర్చాంశాలు',
    lender_points_desc: 'సంతకం చేయడానికి ముందు మార్పులు',
    neg_1_title: '1. వడ్డీ పారదర్శకత:',
    neg_1_desc: 'ఏకపక్ష వడ్డీ పెంపును నివారించడానికి వడ్డీ రేట్లను బాహ్య ప్రమాణంతో అనుసంధానించాలని కోరండి.',
    neg_2_title: '2. నోటీసు గడువు:',
    neg_2_desc: 'పెనాల్టీలు విధించే ముందు 15 రోజుల ముందస్తు రాతపూర్వక నోటీసును అడగండి.',
    neg_3_title: '3. ముందస్తు చెల్లింపు రక్షణ:',
    neg_3_desc: 'సాధారణ వ్యాపార ఆదాయం నుండి చేసే ముందస్తు చెల్లింపులపై 0% పెనాల్టీని నిర్ధారించుకోండి.'
  },
  kn: {
    recommendation: 'ಅಂತಿಮ ಆರ್ಥಿಕ ಶಿಫಾರಸು',
    ACCEPT: 'ಸ್ವೀಕರಿಸಿ (ಸುರಕ್ಷಿತ)',
    DECLINE: 'ತಿರಸ್ಕರಿಸಿ (ಸಹಿ ಮಾಡಬೇಡಿ)',
    RENEGOTIATE: 'ಮರು ಮಾತುಕತೆ (ಮೊದಲು ಷರತ್ತುಗಳನ್ನು ಬದಲಾಯಿಸಿ)',
    headline_accept: 'ಈ ಒಪ್ಪಂದದೊಂದಿಗೆ ಮುಂದುವರಿಯುವುದು ಸುರಕ್ಷಿತ',
    headline_decline: 'ಈ ಒಪ್ಪಂದಕ್ಕೆ ಸಹಿ ಮಾಡಬೇಡಿ',
    headline_renegotiate: 'ಸಹಿ ಮಾಡುವುದನ್ನು ನಿಲ್ಲಿಸಿ — ಮೊದಲು ಪ್ರಮುಖ ಷರತ್ತುಗಳನ್ನು ಚರ್ಚಿಸಿ',
    summary_accept: 'ಈ ಒಪ್ಪಂದವು ಅನುಕೂಲಕರ ಮಾರುಕಟ್ಟೆ ಷರತ್ತುಗಳು ಮತ್ತು ನಿಮ್ಮ ಆರ್ಥಿಕ ಸಾಮರ್ಥ್ಯಕ್ಕೆ ಸರಿಹೊಂದುತ್ತದೆ.',
    summary_decline: 'ಈ ಸಾಲದಲ್ಲಿ ಗಂಭೀರ ಆರ್ಥಿಕ ಅಪಾಯಗಳು ಅಥವಾ ಮೋಸದ ಷರತ್ತುಗಳಿವೆ.',
    summary_renegotiate: 'ಈ ಒಪ್ಪಂದವು ಕಾರ್ಯಸಾಧ್ಯವಾಗಿದೆ, ಆದರೆ ಕೆಲವು ಷರತ್ತುಗಳನ್ನು ಸರಿಪಡಿಸಿಕೊಳ್ಳಬೇಕು.',
    why_accept: 'ನೀವು ಇದನ್ನು ಏಕೆ ಸ್ವೀಕರಿಸಬೇಕು:',
    why_decline: 'ನೀವು ಇದನ್ನು ಏಕೆ ತಿರಸ್ಕರಿಸಬೇಕು:',
    why_renegotiate: 'ನೀವು ಮೊದಲು ಏಕೆ ಮಾತುಕತೆ ನಡೆಸಬೇಕು:',
    doc_overview: 'ದಾಖಲೆ ಸಾರಾಂಶ',
    monthly_pay: 'ಮಾಸಿಕ ಪಾವತಿ',
    total_interest: 'ಒಟ್ಟು ಬಡ್ಡಿ',
    tenure: 'ಅವಧಿ',
    key_terms: 'ಪ್ರಮುಖ ಷರತ್ತುಗಳು & ಸಾರಾಂಶ:',
    financial_baseline: 'ನಿಮ್ಮ ಆರ್ಥಿಕ ಸ್ಥಿತಿ ಮತ್ತು ಸಾಲದ ಸಾಮರ್ಥ್ಯ',
    baseline_desc: 'ನಿಮ್ಮ ಆದಾಯ ಮತ್ತು ವೆಚ್ಚಗಳ ಆಧಾರದ ಮೇಲೆ ಮೌಲ್ಯಮಾಪನ ಮಾಡಲಾಗಿದೆ',
    past_income: 'ಮಾಸಿಕ ಆದಾಯ',
    past_expense: 'ಮಾಸಿಕ ವೆಚ್ಚಗಳು',
    new_emi: 'ಹೊಸ ಮಾಸಿಕ ಕಂತು',
    cushion: 'ಉಳಿದಿರುವ ಉಳಿತಾಯ',
    free_buffer: 'ಸುರಕ್ಷಿತ ಮಾಸಿಕ ಮೊತ್ತ',
    comparison_chart: 'ಮಾಸಿಕ ಹಣಕಾಸು ಹೋಲಿಕೆ',
    original_text: 'ಮೂಲ ಒಪ್ಪಂದದ ಪಠ್ಯ:',
    plain_meaning: 'ಸರಳ ಕನ್ನಡ ಅರ್ಥ:',
    cost_impact: 'ವೆಚ್ಚದ ಪರಿಣಾಮ:',
    action_tip: 'ಸಲಹೆ:',
    why_risky: 'ಇದು ಏಕೆ ಅಪಾಯಕಾರಿ:',
    tab_overview: 'ಸಾರಾಂಶ ಮತ್ತು ನಿರ್ಧಾರ',
    tab_clauses: 'ಷರತ್ತುಗಳ ವಿವರ',
    tab_baseline: 'ಆರ್ಥಿಕ ಸ್ಥಿತಿ',
    tab_schedule: 'ಪಾವತಿ ವೇಳಾಪಟ್ಟಿ',
    tab_assistant: 'ಒಪ್ಪಂದ ಸಹಾಯಕ',
    assistant_title: 'ಒಪ್ಪಂದ ಸಹಾಯಕ',
    assistant_desc: 'ದಾಖಲೆಯ ಕುರಿತು ಯಾವುದೇ ಪ್ರಶ್ನೆಯನ್ನು ಕೇಳಿ',
    ask_placeholder: 'ಕನ್ನಡದಲ್ಲಿ ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು ಟೈಪ್ ಮಾಡಿ ಅಥವಾ ಮಾತನಾಡಿ...',
    ask_btn: 'ಕೇಳಿ',
    upload_btn: 'ಒಪ್ಪಂದ ಅಪ್ಲೋಡ್ ಮಾಡಿ',
    dropzone_active: 'ದಾಖಲೆಯನ್ನು ಇಲ್ಲಿ ಬಿಡಿ',
    dropzone_idle: 'ಯಾವುದೇ ಹಣಕಾಸು ಒಪ್ಪಂದವನ್ನು ಅಪ್ಲೋಡ್ ಮಾಡಿ (PDF, DOCX, ಇಮೇಜ್, ಅಥವಾ TXT)',
    dropzone_sub: '8 ಭಾರತೀಯ ಭಾಷೆಗಳಲ್ಲಿ ಸಾಲ ಒಪ್ಪಂದಗಳ ವಿಶ್ಲೇಷಣೆ',
    fixed_emi: 'ನಿಗದಿತ ಮಾಸಿಕ ಕಂತು',
    total_cost: 'ಒಟ್ಟು ಸಾಲ ವೆಚ್ಚ',
    total_interest_obl: 'ಒಟ್ಟು ಬಡ್ಡಿ ಹೊರೆ',
    prepay_exit: 'ಮುಂಗಡ ಪಾವತಿ ಶುಲ್ಕ',
    due_monthly: 'ತಿಂಗಳಿಗೆ ಪಾವತಿಸಬೇಕಾದ ಮೊತ್ತ',
    principal_interest: 'ಅಸಲು + ಬಡ್ಡಿ',
    over_months: 'ತಿಂಗಳುಗಳಲ್ಲಿ',
    exit_charge: 'ಮುಕ್ತಾಯ ಶುಲ್ಕ',
    lender_points_title: 'ಸಾಲದಾತರೊಂದಿಗೆ ಚರ್ಚಿಸಬೇಕಾದ ಅಂಶಗಳು',
    lender_points_desc: 'ಸಹಿ ಮಾಡುವ ಮೊದಲು ಶಿಫಾರಸು ಮಾಡಲಾದ ಬದಲಾವಣೆಗಳು',
    neg_1_title: '1. ಬಡ್ಡಿ ಪಾರದರ್ಶಕತೆ:',
    neg_1_desc: 'ಬಡ್ಡಿ ಏರಿಕೆಯನ್ನು ತಪ್ಪಿಸಲು ದರಗಳನ್ನು ಬಾಹ್ಯ ಮಾನದಂಡಕ್ಕೆ ಜೋಡಿಸಲು ವಿನಂತಿಸಿ.',
    neg_2_title: '2. ನೋಟಿಸ್ ಅವಧಿ:',
    neg_2_desc: 'ದಂಡ ವಿಧಿಸುವ ಮೊದಲು 15 ದಿನಗಳ ಲಿಖಿತ ನೋಟಿಸ್ ಕೇಳಿ.',
    neg_3_title: '3. ಮುಂಗಡ ಪಾವತಿ ರಕ್ಷಣೆ:',
    neg_3_desc: 'ಸಾಮಾನ್ಯ ವ್ಯಾಪಾರ ಆದಾಯದಿಂದ ಮಾಡುವ ಮುಂಗಡ ಪಾವತಿಗೆ 0% ದಂಡವನ್ನು ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಿ.'
  },
  mr: {
    recommendation: 'अंतिम आर्थिक शिफारस',
    ACCEPT: 'स्वीकारा (सुरक्षित)',
    DECLINE: 'नाकारा (स्वाक्षरी करू नका)',
    RENEGOTIATE: 'पुनर्विचार करा (आधी अटी बदला)',
    headline_accept: 'हा करार स्वीकारणे सुरक्षित आहे',
    headline_decline: 'या करारावर स्वाक्षरी करू नका',
    headline_renegotiate: 'स्वाक्षरी थांबवा — आधी महत्त्वाच्या अटींवर चर्चा करा',
    summary_accept: 'हा करार अनुकूल अटी, कायदेशीर संरक्षण आणि तुमच्या आर्थिक क्षमतेनुसार आहे.',
    summary_decline: 'या कर्जात मोठे आर्थिक धोके किंवा फसव्या अटी आहेत.',
    summary_renegotiate: 'हा करार ठीक आहे, परंतु स्वाक्षरी करण्यापूर्वी काही अटी बदलणे आवश्यक आहे.',
    why_accept: 'तुम्ही हे का स्वीकारावे:',
    why_decline: 'तुम्ही हे का नाकारावे:',
    why_renegotiate: 'तुम्ही आधी चर्चा का करावी:',
    doc_overview: 'दस्तऐवज सारांश',
    monthly_pay: 'मासिक हप्ता',
    total_interest: 'एकूण व्याज',
    tenure: 'मुदत',
    key_terms: 'मुख्य अटी आणि सारांश:',
    financial_baseline: 'तुमची आर्थिक स्थिती आणि कर्ज क्षमता',
    baseline_desc: 'तुमचे मासिक उत्पन्न आणि खर्चाच्या आधारावर मूल्यांकन केले',
    past_income: 'मासिक उत्पन्न',
    past_expense: 'मासिक खर्च',
    new_emi: 'नवीन मासिक हप्ता',
    cushion: 'शिल्लक बचत',
    free_buffer: 'सुरक्षित मासिक रक्कम',
    comparison_chart: 'मासिक रोख प्रवाह तुलना',
    original_text: 'मूळ करार मजकूर:',
    plain_meaning: 'सोप्या मराठीत अर्थ:',
    cost_impact: 'खर्चाचा परिणाम:',
    action_tip: 'सल्ला:',
    why_risky: 'हे धोकादायक का आहे:',
    tab_overview: 'सारांश आणि निर्णय',
    tab_clauses: 'कलम तपशील',
    tab_baseline: 'आर्थिक स्थिती',
    tab_schedule: 'परतफेड वेळापत्रक',
    tab_assistant: 'करार सहाय्यक',
    assistant_title: 'करार सहाय्यक',
    assistant_desc: 'दस्तऐवजाच्या आधारे कोणताही प्रश्न विचारा',
    ask_placeholder: 'मराठीत प्रश्न विचारा किंवा बोला...',
    ask_btn: 'विचारा',
    upload_btn: 'करार अपलोड करा',
    dropzone_active: 'दस्तऐवज येथे टाका',
    dropzone_idle: 'कोणताही आर्थिक करार अपलोड करा (PDF, DOCX, इमेज, किंवा TXT)',
    dropzone_sub: '8 भारतीय भाषांमध्ये व्यावसायिक आणि गृहकर्ज विश्लेषण',
    fixed_emi: 'निश्चित मासिक हप्ता',
    total_cost: 'एकूण वित्तपुरवठा खर्च',
    total_interest_obl: 'एकूण व्याज दायित्व',
    prepay_exit: 'मुदतपूर्व परतफेड शुल्क',
    due_monthly: 'दरमहा देय',
    principal_interest: 'मुद्दल + व्याज',
    over_months: 'महिन्यांत',
    exit_charge: 'मुदतपूर्व शुल्क',
    lender_points_title: 'बँक चर्चा मुद्दे',
    lender_points_desc: 'स्वाक्षरी करण्यापूर्वी महत्त्वाच्या सुधारणा',
    neg_1_title: '1. व्याजदर पारदर्शकता:',
    neg_1_desc: 'अनियंत्रित व्याजदर वाढ टाळण्यासाठी बाह्य बेंचमार्कशी जोडण्याची मागणी करा.',
    neg_2_title: '2. पूर्वसूचना कालावधी:',
    neg_2_desc: 'कोणताही दंड आकारण्यापूर्वी १५ दिवसांची लेखी नोटीस मागून घ्या.',
    neg_3_title: '3. मुदतपूर्व परतफेड संरक्षण:',
    neg_3_desc: 'व्यवसाय उत्पन्नातून मुदतपूर्व परतफेड केल्यास ०% दंड असल्याची खात्री करा.'
  },
  bn: {
    recommendation: 'চূড়ান্ত আর্থিক সুপারিশ',
    ACCEPT: 'গ্রহণ করুন (নিরাপদ)',
    DECLINE: 'প্রত্যাখ্যান করুন (স্বাক্ষর করবেন না)',
    RENEGOTIATE: 'পুনরায় আলোচনা করুন (শর্ত পরিবর্তন করুন)',
    headline_accept: 'এই চুক্তিটি গ্রহণ করা নিরাপদ',
    headline_decline: 'এই চুক্তিতে স্বাক্ষর করবেন না',
    headline_renegotiate: 'স্বাক্ষর স্থগিত রাখুন — প্রথমে মূল শর্তাবলী নিয়ে আলোচনা করুন',
    summary_accept: 'এই চুক্তিটি অনুকূল শর্তাবলী এবং আপনার আর্থিক সামর্থ্যের মধ্যে রয়েছে।',
    summary_decline: 'এই ঋণে মারাত্মক আর্থিক ঝুঁকি এবং ক্ষতিকারক শর্তাবলী রয়েছে।',
    summary_renegotiate: 'চুক্তিটি গ্রহণযোগ্য, তবে স্বাক্ষর করার আগে কিছু শর্ত পরিবর্তন করা উচিত।',
    why_accept: 'আপনার কেন এটি গ্রহণ করা উচিত:',
    why_decline: 'আপনার কেন এটি প্রত্যাখ্যান করা উচিত:',
    why_renegotiate: 'আপনার কেন প্রথমে আলোচনা করা উচিত:',
    doc_overview: 'নথির সারসংক্ষেপ',
    monthly_pay: 'মাসিক কিস্তি',
    total_interest: 'মোট সুদ',
    tenure: 'মেয়াদ',
    key_terms: 'মূল শর্তাবলী ও সারসংক্ষেপ:',
    financial_baseline: 'আপনার আর্থিক অবস্থা এবং ঋণ পরিশোধের ক্ষমতা',
    baseline_desc: 'আপনার যাচাইকৃত মাসিক আয় এবং ব্যয়ের ভিত্তিতে মূল্যায়িত',
    past_income: 'মাসিক আয়',
    past_expense: 'মাসিক ব্যয়',
    new_emi: 'নতুন মাসিক কিস্তি',
    cushion: 'অবশিষ্ট সঞ্চয়',
    free_buffer: 'নিরাপদ মাসিক উদ্বৃত্ত',
    comparison_chart: 'মাসিক ক্যাশ ফ্লো তুলনা',
    original_text: 'মূল চুক্তির পাঠ্য:',
    plain_meaning: 'সহজ বাংলায় অর্থ:',
    cost_impact: 'ব্যয় প্রভাব:',
    action_tip: 'পরামর্শ:',
    why_risky: 'এটি কেন ঝুঁকিপূর্ণ:',
    tab_overview: 'সারসংক্ষেপ ও সিদ্ধান্ত',
    tab_clauses: 'ধারা বিবরণী',
    tab_baseline: 'আর্থিক ভিত্তি',
    tab_schedule: 'পরিশোধের সময়সূচী',
    tab_assistant: 'চুক্তি সহকারী',
    assistant_title: 'ইন্টারেক্টিভ চুক্তি সহকারী',
    assistant_desc: 'নথি সম্পর্কিত যেকোনো প্রশ্ন জিজ্ঞাসা করুন',
    ask_placeholder: 'বাংলায় প্রশ্ন টাইপ করুন বা বলুন...',
    ask_btn: 'জিজ্ঞাসা',
    upload_btn: 'চুক্তি আপলোড করুন',
    dropzone_active: 'আপনার নথি এখানে ড্রপ করুন',
    dropzone_idle: 'যেকোনো আর্থিক চুক্তি আপলোড করুন (PDF, DOCX, ছবি, বা TXT)',
    dropzone_sub: '৮টি ভারতীয় ভাষায় ব্যবসায়িক ও ব্যক্তিগত ঋণ বিশ্লেষণ',
    fixed_emi: 'নির্দিষ্ট মাসিক কিস্তি',
    total_cost: 'মোট অর্থায়ন ব্যয়',
    total_interest_obl: 'মোট সুদ দায়',
    prepay_exit: 'মেয়াদপূর্ব পরিশোধ ফি',
    due_monthly: 'প্রতি মাসে প্রদেয়',
    principal_interest: 'আসল + সুদ',
    over_months: 'মাসে',
    exit_charge: 'মেয়াদপূর্ব ক্লোজার চার্জ',
    lender_points_title: 'ঋণদাতার সাথে আলোচনার বিষয়',
    lender_points_desc: 'স্বাক্ষর করার আগে প্রস্তাবিত সমন্বয়',
    neg_1_title: '১. সুদের স্বচ্ছতা:',
    neg_1_desc: 'অযৌক্তিক বৃদ্ধি এড়াতে সুদের হার বাহ্যিক বেঞ্চমার্কের সাথে যুক্ত করার অনুরোধ করুন।',
    neg_2_title: '২. নোটিশের সময়সীমা:',
    neg_2_desc: 'জরিমানা আরোপের আগে ১৫ দিনের লিখিত নোটিশের অনুরোধ করুন।',
    neg_3_title: '৩. মেয়াদপূর্ব পরিশোধ সুরক্ষা:',
    neg_3_desc: 'সাধারণ ব্যবসায়িক আয় থেকে মেয়াদপূর্ব পরিশোধে ০% ফি নিশ্চিত করুন।'
  },
  gu: {
    recommendation: 'અંતિમ નાણાકીય ભલામણ',
    ACCEPT: 'સ્વીકારો (સુરક્ષિત)',
    DECLINE: 'નકારો (સહી ન કરો)',
    RENEGOTIATE: 'ફરીથી વાતચીત કરો (શરતો બદલો)',
    headline_accept: 'આ કરાર સાથે આગળ વધવું સુરક્ષિત છે',
    headline_decline: 'આ કરાર પર સહી ન કરો',
    headline_renegotiate: 'સહી કરવાનું રોકો — પહેલાં મુખ્ય શરતો પર ચર્ચા કરો',
    summary_accept: 'આ કરાર અનુકૂળ શરતો અને તમારી નાણાકીય ક્ષમતા મુજબ છે.',
    summary_decline: 'આ લોનમાં ગંભીર નાણાકીય જોખમો અથવા શોષણકારી શરતો છે.',
    summary_renegotiate: 'આ કરાર સ્વીકાર્ય છે, પરંતુ સહી કરતાં પહેલાં કેટલીક શરતો બદલવી જરૂરી છે.',
    why_accept: 'તમારે આ કેમ સ્વીકારવું જોઈએ:',
    why_decline: 'તમારે આ કેમ નકારવું જોઈએ:',
    why_renegotiate: 'તમારે પહેલાં કેમ વાતચીત કરવી જોઈએ:',
    doc_overview: 'દસ્તાવેજ સારાંશ',
    monthly_pay: 'માસિક હપ્તો',
    total_interest: 'કુલ વ્યાજ',
    tenure: 'સમયગાળો',
    key_terms: 'મુખ્ય શરતો અને સારાંશ:',
    financial_baseline: 'તમારી નાણાકીય સ્થિતિ અને લોન ક્ષમતા',
    baseline_desc: 'તમારી આવક અને ખર્ચના આધારે મૂલ્યાંકન કરવામાં આવ્યું છે',
    past_income: 'માસિક આવક',
    past_expense: 'માસિક ખર્ચ',
    new_emi: 'નવો માસિક હપ્તો',
    cushion: 'બાકી રહેતી બચત',
    free_buffer: 'સુરક્ષિત માસિક રકમ',
    comparison_chart: 'માસિક નાણાકીય પ્રવાહ સરખામણી',
    original_text: 'મૂળ કરાર લખાણ:',
    plain_meaning: 'સરળ ગુજરાતીમાં અર્થ:',
    cost_impact: 'ખર્ચ અસર:',
    action_tip: 'સલાહ:',
    why_risky: 'આ કેમ જોખમી છે:',
    tab_overview: 'સારાંશ અને નિર્ણય',
    tab_clauses: 'કલમોની વિગત',
    tab_baseline: 'નાણાકીય સ્થિતિ',
    tab_schedule: 'ચુકવણી શેડ્યૂલ',
    tab_assistant: 'કરાર સહાયક',
    assistant_title: 'ઇન્ટરેક્ટિવ કરાર સહાયક',
    assistant_desc: 'દસ્તાવેજ સંબંધિત કોઈપણ પ્રશ્ન પૂછો',
    ask_placeholder: 'ગુજરાતીમાં પ્રશ્ન લખો અથવા બોલો...',
    ask_btn: 'પૂછો',
    upload_btn: 'કરાર અપલોડ કરો',
    dropzone_active: 'દસ્તાવેજ અહીં મૂકો',
    dropzone_idle: 'કોઈપણ નાણાકીય કરાર અપલોડ કરો (PDF, DOCX, ઇમેજ, અથવા TXT)',
    dropzone_sub: '8 ભારતીય ભાષાઓમાં વ્યાપારી અને વ્યક્તિગત લોન વિશ્લેષણ',
    fixed_emi: 'નિશ્ચિત માસિક હપ્તો',
    total_cost: 'કુલ ધિરાણ ખર્ચ',
    total_interest_obl: 'કુલ વ્યાજ જવાબદારી',
    prepay_exit: 'મુદત પૂર્વે ચુકવણી શુલ્ક',
    due_monthly: 'દર મહિને ચૂકવવાપાત્ર',
    principal_interest: 'મુદ્દલ + વ્યાજ',
    over_months: 'મહિનાઓમાં',
    exit_charge: 'મુદત પૂર્વે ચાર્જ',
    lender_points_title: 'બેંક ચર્ચાના મુદ્દા',
    lender_points_desc: 'સહી કરતા પહેલા ભલામણ કરેલ ફેરફારો',
    neg_1_title: '1. વ્યાજ પારદર્શિતા:',
    neg_1_desc: 'વ્યાજ દર વધારો રોકવા માટે બાહ્ય બેન્ચમાર્ક સાથે લિંક કરવાની વિનંતી કરો.',
    neg_2_title: '2. નોટિસ વિન્ડો:',
    neg_2_desc: 'દંડ લાદતા પહેલા 15 દિવસની લેખિત નોટિસ વિન્ડોની માંગ કરો.',
    neg_3_title: '3. મુદત પૂર્વે ચુકવણી સુરક્ષા:',
    neg_3_desc: 'વ્યાપાર આવકમાંથી મુદત પૂર્વે ચુકવણી પર 0% દંડની ખાતરી કરો.'
  }
};

const RiskBadge = ({ level }: { level: string }) => {
  const cls = level === 'High' ? 'bg-red-50 text-red-700 border-red-200' : level === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
  const Icon = level === 'High' ? AlertTriangle : level === 'Medium' ? Zap : CheckCircle;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border shadow-2xs ${cls}`}>
      <Icon size={13} /> {level} Risk
    </span>
  );
};

// Sleek Custom Multilingual Dropdown UI Component
const CustomLanguageDropdown = ({
  selectedLanguage,
  onSelectLanguage,
  translating
}: {
  selectedLanguage: string;
  onSelectLanguage: (code: string) => void;
  translating: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = useMemo(() => {
    return SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage) || SUPPORTED_LANGUAGES[0];
  }, [selectedLanguage]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={translating}
        className={`group px-3.5 py-2 rounded-2xl border transition-all duration-200 flex items-center gap-2.5 shadow-xs cursor-pointer ${
          isOpen
            ? 'bg-brand-50/90 border-brand-400 ring-2 ring-brand-400/20 text-brand-900'
            : 'bg-white hover:bg-slate-50 border-slate-200/90 text-slate-800 hover:border-slate-300'
        }`}
      >
        <div className="w-6 h-6 rounded-lg bg-brand-500/10 text-brand-600 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-500/20 transition-colors">
          <Globe size={14} />
        </div>

        <div className="flex items-center gap-1.5 text-left">
          <span className="font-black text-xs text-slate-900">{currentLang.native}</span>
          <span className="text-[10px] font-semibold text-slate-600 hidden sm:inline">({currentLang.name})</span>
        </div>

        {translating ? (
          <Loader2 size={13} className="animate-spin text-brand-600 ml-0.5" />
        ) : (
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform duration-200 ml-0.5 ${isOpen ? 'rotate-180 text-brand-600' : 'group-hover:text-slate-600'}`}
          />
        )}
      </button>

      {/* Floating Animated Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/80 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-slate-100 mb-1 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-600">Select Output Language</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-brand-50 text-brand-700">8 Languages</span>
          </div>

          <div className="space-y-1 max-h-72 overflow-y-auto">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = lang.code === selectedLanguage;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    onSelectLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-brand-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {lang.flag}
                    </span>
                    <div>
                      <p className={`text-xs font-black leading-tight ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                        {lang.native}
                      </p>
                      <p className={`text-[10px] ${isSelected ? 'text-brand-100' : 'text-slate-600 font-medium'}`}>
                        {lang.name}
                      </p>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-white">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Single Clear Decision Verdict & Focused Reasons Card
const DecisionVerdictCard = ({ contract, language }: { contract: any; language: string }) => {
  const decision = contract.decision || {};
  const decisionType = (decision.decision_type || 'CAUTION').toUpperCase();
  const isDecline = decisionType === 'DECLINE';
  const isAccept = decisionType === 'ACCEPT';

  const badgeClass = isDecline 
    ? 'bg-red-600 text-white' 
    : isAccept 
      ? 'bg-emerald-600 text-white' 
      : 'bg-amber-500 text-white';

  const cardBg = isDecline 
    ? 'bg-red-50/40 border-red-200' 
    : isAccept 
      ? 'bg-emerald-50/40 border-emerald-200' 
      : 'bg-amber-50/40 border-amber-200';

  const Icon = isDecline ? ThumbsDown : isAccept ? ThumbsUp : AlertTriangle;
  const reasons: string[] = decision.reasons || [
    'Evaluated against your verified income and contract terms.'
  ];

  const ui = LOCALIZED_UI[language] || {};
  const whyTitle = isDecline 
    ? (ui.why_decline || 'Why You Should Decline / Walk Away:') 
    : isAccept 
      ? (ui.why_accept || 'Why You Should Accept / Proceed:') 
      : (ui.why_renegotiate || 'Why You Should Renegotiate:');

  const verdictLabel = isDecline 
    ? (ui.DECLINE || decision.decision || 'DECLINE') 
    : isAccept 
      ? (ui.ACCEPT || decision.decision || 'ACCEPT') 
      : (ui.RENEGOTIATE || decision.decision || 'RENEGOTIATE');

  const actionHeadline = decision.action_headline || (
    isDecline ? (ui.headline_decline || 'Do Not Sign This Agreement') : isAccept ? (ui.headline_accept || 'Safe to Proceed with Agreement') : (ui.headline_renegotiate || 'Hold Signing — Negotiate Key Terms')
  );

  const actionSummary = decision.action_summary || (
    isDecline ? (ui.summary_decline || 'High risk detected') : isAccept ? (ui.summary_accept || 'Favorable conditions') : (ui.summary_renegotiate || 'Negotiate terms first')
  );

  return (
    <div className={`p-6 rounded-3xl border-2 shadow-sm space-y-5 ${cardBg}`}>
      {/* Header Verdict */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/60">
        <div className="flex items-center gap-3.5">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${badgeClass}`}>
            <Icon size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-600">
                {ui.recommendation || 'Final Financial Recommendation'}
              </span>
              <span className={`px-3 py-0.5 text-xs font-black uppercase rounded-full shadow-2xs ${badgeClass}`}>
                {verdictLabel}
              </span>
            </div>
            <h3 className="font-black text-xl text-slate-900">
              {actionHeadline}
            </h3>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              {actionSummary}
            </p>
          </div>
        </div>
      </div>

      {/* Concrete Reasons for THIS Decision */}
      <div className="space-y-3">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
          <Lightbulb size={15} className={isDecline ? 'text-red-600' : isAccept ? 'text-emerald-600' : 'text-amber-600'} />
          {whyTitle}
        </h4>

        <div className="space-y-2.5">
          {reasons.map((reason, idx) => (
            <div key={idx} className="flex items-start gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                isDecline ? 'bg-red-100 text-red-700' : isAccept ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
              }`}>
                {isDecline ? <AlertTriangle size={14} /> : isAccept ? <Check size={14} /> : <AlertOctagon size={14} />}
              </div>
              <p className="text-xs font-semibold text-slate-800 leading-relaxed">{reason}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// User Past Financial Condition & Ledger Comparison
const UserFinancialConditionCard = ({ ledgerImpact, sim, persona, language }: { ledgerImpact?: any; sim?: any; persona?: string; language: string }) => {
  const isEmployee = persona === 'employee';

  const income = Number(ledgerImpact?.avg_monthly_income || (isEmployee ? 55000 : 65000));
  const expense = Number(ledgerImpact?.avg_monthly_expense || (isEmployee ? 22000 : 20000));
  const emi = Number(ledgerImpact?.monthly_emi || sim?.monthly_emi || 16727);
  const netProfitBefore = income - expense;
  const residualCash = netProfitBefore - emi;

  const emiToProfitPct = netProfitBefore > 0 ? Math.round((emi / netProfitBefore) * 100) : 100;
  const isHeavy = residualCash < 0 || emiToProfitPct > 55;
  const isModerate = !isHeavy && emiToProfitPct > 25;

  const ui = LOCALIZED_UI[language] || {};

  const barData = [
    { name: ui.past_income || (isEmployee ? 'Monthly Salary' : 'Monthly Cash In'), amount: income, fill: '#059669' },
    { name: ui.past_expense || (isEmployee ? 'Living Expenses' : 'Operating Expenses'), amount: expense, fill: '#64748b' },
    { name: ui.new_emi || 'Proposed EMI', amount: emi, fill: '#e11d48' },
    { name: ui.cushion || 'Free Savings Buffer', amount: Math.max(0, residualCash), fill: isHeavy ? '#dc2626' : '#2563eb' }
  ];

  return (
    <div className="card p-6 border border-slate-200 rounded-3xl bg-white shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600">
            <Wallet size={20} />
          </div>
          <div>
            <h3 className="font-black text-lg text-slate-900">{ui.financial_baseline || 'Your Financial Baseline & Debt Affordability'}</h3>
            <p className="text-xs text-slate-600 font-medium">{ui.baseline_desc || 'Evaluated against your verified monthly income, recurring expenses, and cash reserves'}</p>
          </div>
        </div>
        <span className={`px-3 py-1 text-xs font-bold rounded-full ${
          isHeavy ? 'bg-red-50 text-red-700 border border-red-200' : isModerate ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        }`}>
          {isHeavy ? 'High Cash Flow Strain' : isModerate ? 'Moderate Budget Strain' : 'Easily Affordable'}
        </span>
      </div>

      {/* 4-Stat Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
          <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
            {ui.past_income || 'Past Monthly Salary'}
          </p>
          <p className="text-lg font-black text-emerald-950 mt-0.5">₹{income.toLocaleString('en-IN')}</p>
          <span className="text-[10px] text-emerald-700 font-medium">{isEmployee ? 'Net Take-Home Pay' : 'Average Revenue'}</span>
        </div>

        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
          <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            {ui.past_expense || 'Past Monthly Expenses'}
          </p>
          <p className="text-lg font-black text-slate-900 mt-0.5">₹{expense.toLocaleString('en-IN')}</p>
          <span className="text-[10px] text-slate-600 font-medium">{isEmployee ? 'Living Costs & Bills' : 'Operating Costs'}</span>
        </div>

        <div className="p-3.5 bg-red-50/50 border border-red-100 rounded-2xl">
          <p className="text-[11px] font-bold text-red-800 uppercase tracking-wider">{ui.new_emi || 'New Monthly Payment'}</p>
          <p className="text-lg font-black text-red-950 mt-0.5">₹{emi.toLocaleString('en-IN')}</p>
          <span className="text-[10px] text-red-700 font-medium">{emiToProfitPct}% of monthly surplus</span>
        </div>

        <div className={`p-3.5 rounded-2xl border ${isHeavy ? 'bg-red-50 border-red-200' : 'bg-blue-50/60 border-blue-100'}`}>
          <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            {ui.cushion || 'Remaining Savings'}
          </p>
          <p className={`text-lg font-black mt-0.5 ${isHeavy ? 'text-red-700' : 'text-blue-950'}`}>
            ₹{residualCash.toLocaleString('en-IN')}
          </p>
          <span className="text-[10px] text-slate-600 font-medium">{ui.free_buffer || 'Free Monthly Buffer'}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="pt-2">
        <p className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">{ui.comparison_chart || 'Monthly Cash Flow Comparison'}</p>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Amount']}
                contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 600 }}
              />
              <Bar dataKey="amount" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// Side-by-Side Clause Visualizer Component
const SideBySideClauseRow = ({ clause, language }: { clause: any; language: string }) => {
  const [expanded, setExpanded] = useState(true);
  const isHighRisk = clause.risk_level === 'High';
  const isRedFlag = clause.is_red_flag;
  const ui = LOCALIZED_UI[language] || {};

  return (
    <div className={`border rounded-2xl overflow-hidden shadow-2xs transition-all ${
      isRedFlag || isHighRisk ? 'border-red-200 bg-red-50/10' : 'border-slate-200 bg-white'
    }`}>
      {/* Header Bar */}
      <div 
        onClick={() => setExpanded(!expanded)}
        className="p-4 flex items-center justify-between cursor-pointer bg-slate-50/80 hover:bg-slate-100/80 transition-colors border-b border-slate-100"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
            isRedFlag || isHighRisk ? 'bg-red-100 text-red-700' : 'bg-brand-50 text-brand-700'
          }`}>
            {isRedFlag ? <AlertOctagon size={16} /> : <FileText size={16} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-black text-slate-900 text-sm">{clause.clause_type}</h4>
              {isRedFlag && (
                <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-md bg-red-600 text-white shadow-2xs">
                  Red Flag Trap
                </span>
              )}
            </div>
            {clause.source_page && (
              <span className="text-[11px] text-slate-500 font-medium">Page Reference (Page {clause.source_page})</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <RiskBadge level={clause.risk_level || 'Low'} />
          <button type="button" className="text-slate-400 hover:text-slate-600">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded Split-View */}
      {expanded && (
        <div className="p-5 space-y-4">
          {/* Red Flag Warning Box */}
          {isRedFlag && clause.red_flag_reason && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-xs font-black uppercase text-red-900 block tracking-tight">{ui.why_risky || 'Why this clause is risky for you:'}</span>
                <p className="text-xs font-semibold text-red-800 leading-relaxed mt-0.5">{clause.red_flag_reason}</p>
              </div>
            </div>
          )}

          {/* 2-Column Split: Original Contract Text vs Plain-English Translation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Original Contract Text */}
            <div className="bg-slate-100/80 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 block mb-1.5 flex items-center gap-1.5">
                  <FileText size={13} className="text-slate-500" /> {ui.original_text || 'Original Contract Text (Verbatim):'}
                </span>
                <p className="text-xs text-slate-800 font-mono leading-relaxed bg-white/90 p-3 rounded-lg border border-slate-200/80">
                  {clause.original_text || 'Original text excerpted from agreement document.'}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
                <span>Location</span>
                <span>Page {clause.source_page || 1}</span>
              </div>
            </div>

            {/* Right: Plain Translation */}
            <div className="bg-brand-50/50 border border-brand-200/80 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-brand-900 block mb-1.5 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-brand-600" /> {ui.plain_meaning || 'Plain Meaning:'}
                </span>
                <p className="text-xs font-semibold text-slate-900 leading-relaxed bg-white/90 p-3 rounded-lg border border-brand-100">
                  {clause.simple_explanation || clause.plain_explanation}
                </p>
              </div>

              {/* Tips & Financial Impact */}
              <div className="mt-3 pt-2 border-t border-brand-100 space-y-2">
                {clause.financial_impact && (
                  <div className="flex items-start gap-1.5 text-xs">
                    <DollarSign size={14} className="text-brand-600 mt-0.5 flex-shrink-0" />
                    <span className="font-bold text-slate-800">{ui.cost_impact || 'Cost Impact:'} <span className="font-normal text-slate-700">{clause.financial_impact}</span></span>
                  </div>
                )}
                {clause.actionable_tip && (
                  <div className="flex items-start gap-1.5 text-xs">
                    <Lightbulb size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <span className="font-bold text-slate-800">{ui.action_tip || 'Action Tip:'} <span className="font-normal text-slate-700">{clause.actionable_tip}</span></span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Executive Summary Hero Card (Step 1: Document Summary First)
const ExecutiveSummaryHero = ({ contract, language }: { contract: any; language: string }) => {
  const executivePoints = contract.executive_summary || [
    `Principal loan sum of ₹${Number(contract.simulation_results?.loan_amount || 500000).toLocaleString('en-IN')} over ${contract.simulation_results?.tenure_months || 36} months.`,
    `Estimated monthly obligation is ₹${Number(contract.simulation_results?.monthly_emi || 0).toLocaleString('en-IN')}.`,
    `Total repayment amounts to ₹${Number(contract.simulation_results?.total_repayment || 0).toLocaleString('en-IN')}.`
  ];

  const ui = LOCALIZED_UI[language] || {};

  return (
    <div className="rounded-3xl p-8 bg-gradient-to-br from-slate-950 via-brand-950 to-slate-900 text-white shadow-xl relative overflow-hidden border border-white/10 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/10">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-widest text-brand-300 block mb-1">
            {ui.doc_overview || 'Contract Document Overview'}
          </span>
          <h2 className="text-3xl font-black tracking-tight">{contract.document_name || 'Financial Agreement Summary'}</h2>
          <p className="text-xs text-slate-300 font-medium mt-1">Plain-language summary and financial obligations breakdown</p>
        </div>

        {/* Quick Numbers Bar */}
        <div className="flex items-center gap-6 bg-white/10 backdrop-blur-xl px-6 py-4 rounded-2xl border border-white/10 shadow-lg">
          <div>
            <p className="text-[11px] uppercase font-extrabold tracking-wider text-slate-300">{ui.monthly_pay || 'Monthly Payment'}</p>
            <p className="text-2xl font-black text-brand-300">₹{Number(contract.simulation_results?.monthly_emi || 0).toLocaleString('en-IN')}</p>
          </div>
          <div className="w-px h-10 bg-white/20" />
          <div>
            <p className="text-[11px] uppercase font-extrabold tracking-wider text-slate-300">{ui.total_interest || 'Total Interest'}</p>
            <p className="text-2xl font-black text-amber-300">₹{Number(contract.simulation_results?.total_interest || 0).toLocaleString('en-IN')}</p>
          </div>
          <div className="w-px h-10 bg-white/20" />
          <div>
            <p className="text-[11px] uppercase font-extrabold tracking-wider text-slate-300">{ui.tenure || 'Tenure'}</p>
            <p className="text-2xl font-black text-white">{contract.simulation_results?.tenure_months || 36}m</p>
          </div>
        </div>
      </div>

      {/* Summary Bullets */}
      <div className="space-y-3">
        <p className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <Sparkles size={16} className="text-brand-400" /> {ui.key_terms || 'Key Terms & Summary:'}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
          {executivePoints.map((pt: string, idx: number) => (
            <div key={idx} className="flex items-start gap-2.5 bg-white/5 hover:bg-white/10 transition-colors border border-white/10 rounded-2xl p-4 text-xs leading-relaxed font-medium text-slate-100">
              <ArrowRight size={16} className="text-brand-400 mt-0.5 flex-shrink-0" />
              <span>{pt}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Interactive Agreement Assistant with Regional Voice & Input Support
const ContractAssistant = ({ contractId, language }: { contractId: string; language: string }) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<Array<{
    id?: string;
    question: string;
    answer: string;
    cited_clauses?: any[];
  }>>([]);

  const ui = LOCALIZED_UI[language] || {};
  const currentLang = useMemo(() => {
    return SUPPORTED_LANGUAGES.find(l => l.code === language) || SUPPORTED_LANGUAGES[0];
  }, [language]);

  const loadQueries = useCallback(async () => {
    try {
      const data = await contractService.getQueries(contractId);
      if (Array.isArray(data)) setMessages(data);
    } catch (e) {
      // Ignored
    }
  }, [contractId]);

  useEffect(() => {
    loadQueries();
  }, [loadQueries]);

  // Voice speech recognition in target regional language
  const toggleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please type your query.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = SPEECH_LANG_MAP[language] || 'ta-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuestion(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleAsk = async (promptText?: string) => {
    const q = promptText || question;
    if (!q.trim() || loading) return;

    const optimisticIndex = messages.length;
    setMessages(prev => [...prev, { question: q, answer: 'Analyzing agreement terms…' }]);
    setQuestion('');
    setLoading(true);

    try {
      const res = await contractService.askQuestion(contractId, q, 4, language);
      setMessages(prev => {
        const next = [...prev];
        next[optimisticIndex] = res;
        return next;
      });
    } catch (err) {
      setMessages(prev => {
        const next = [...prev];
        next[optimisticIndex] = {
          question: q,
          answer: 'Unable to process question. Please ensure the service is running.',
        };
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  const samplePrompts = useMemo(() => {
    if (language === 'ta') {
      return [
        'வட்டி விகிதம் நிலையானதா அல்லது மிதக்கும் விகிதமா?',
        'முன்கூட்டியே கடனை அடைத்தால் என்ன கட்டணம் விதிக்கப்படும்?',
        'வங்கிக்கு எனது தனிப்பட்ட வீடு அல்லது சேமிப்பு மீது உரிமை உள்ளதா?',
        'தாமதக் கட்டணங்கள் விதிக்கப்படுவதற்கு முன் சலுகைக் காலம் உள்ளதா?'
      ];
    }
    if (language === 'hi') {
      return [
        'ब्याज दर फ्लोटिंग है या फिक्स्ड?',
        'क्या मैं बिना पेनल्टी के समयपूर्व भुगतान कर सकता हूँ?',
        'क्या बैंक के पास मेरे व्यक्तिगत घर या बचत पर अधिकार है?',
        'विलंब शुल्क लगने से पहले क्या कोई छूट अवधि है?'
      ];
    }
    if (language === 'te') {
      return [
        'వడ్డీ రేటు స్థిరమైనదా లేదా ఫ్లోటింగా?',
        'ముందస్తుగా చెల్లిస్తే ఏమైనా పెనాల్టీ ఉంటుందా?',
        'బ్యాంకుకు నా సొంత ఇల్లుపై హక్కు ఉందా?',
        'ఆలస్య చెల్లింపులపై ఏదైనా నోటీసు గడువు ఉందా?'
      ];
    }
    if (language === 'kn') {
      return [
        'ಬಡ್ಡಿ ದರ ನಿಗದಿತವೇ ಅಥವಾ ಬದಲಾಗುತ್ತದೆಯೇ?',
        'ಮುಂಚಿತವಾಗಿ ಸಾಲ ಮರುಪಾವತಿಸಿದರೆ ದಂಡವಿದೆಯೇ?',
        'ಬ್ಯಾಂಕಿಗೆ ನನ್ನ ಸ್ವಂತ ಮನೆಯ ಮೇಲೆ ಹಕ್ಕಿದೆಯೇ?',
        'ತಡವಾದ ಪಾವತಿಗಳಿಗೆ ಗ್ರೇಸ್ ಅವಧಿ ಇದೆಯೇ?'
      ];
    }
    if (language === 'mr') {
      return [
        'व्याजदर स्थिर आहे की फ्लोटिंग?',
        'मुदतपूर्व कर्ज फेडल्यास दंड आकारला जातो का?',
        'बँकेला माझ्या वैयक्तिक घरावर अधिकार आहे का?',
        'थकबाकीवर सूट कालावधी आहे का?'
      ];
    }
    if (language === 'bn') {
      return [
        'সুদের হার নির্দিষ্ট নাকি পরিবর্তনশীল?',
        'সময়সীমার আগে ঋণ পরিশোধে কি জরিমানা আছে?',
        'ব্যাঙ্কের কি আমার ব্যক্তিগত সম্পত্তির ওপর অধিকার আছে?',
        'দেরিতে পরিশোধের জন্য কি কোনো নোটিশ দেওয়া হয়?'
      ];
    }
    if (language === 'gu') {
      return [
        'વ્યાજ દર સ્થિર છે કે ફ્લોટિંગ?',
        'મુદત પહેલાં લોન ભરપાઈ કરવા પર કોઈ દંડ છે?',
        'શું બેંક પાસે મારા અંગત ઘર પર અધિકાર છે?',
        'વિલંબિત ચુકવણી માટે કોઈ નોટિસ સમયગાળો છે?'
      ];
    }
    return [
      'Is the interest rate floating or fixed?',
      'What happens if I make an early prepayment?',
      'Does the bank have rights over my personal home or savings?',
      'What is the grace period before late penalties apply?'
    ];
  }, [language]);

  return (
    <div className="card shadow-sm p-6 border border-slate-200 rounded-3xl flex flex-col h-[580px] bg-white">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shadow-2xs">
            <Sparkles size={18} />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-slate-900">{ui.assistant_title || 'Interactive Agreement Assistant'}</h4>
            <p className="text-xs text-slate-500 font-medium">{ui.assistant_desc || 'Ask any question in your native language with verified page citations'}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-brand-50 border border-brand-200/80 px-2.5 py-1 rounded-xl text-brand-800 text-[11px] font-bold">
          <Languages size={13} />
          <span>{currentLang.native}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
        {messages.length === 0 ? (
          <div className="text-center py-6 px-4">
            <p className="text-xs font-bold text-slate-800 mb-1">
              {language === 'ta' ? 'இந்த ஒப்பந்தம் குறித்து கேள்விகளைக் கேளுங்கள்' : language === 'hi' ? 'इस समझौते के बारे में प्रश्न पूछें' : 'Ask questions about this agreement'}
            </p>
            <p className="text-xs text-slate-500 mb-4">
              {language === 'ta' ? 'எந்தவொரு மொழியிலும் கேட்கலாம். உடனடி தெளிவான பதில் கிடைக்கும்.' : 'Every answer is verified against the specific text in your document.'}
            </p>
            <div className="flex flex-col gap-2">
              {samplePrompts.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleAsk(p)}
                  className="text-xs font-medium bg-slate-50 hover:bg-brand-50 border border-slate-200 hover:border-brand-200 text-slate-700 hover:text-brand-700 rounded-2xl px-4 py-3 text-left transition-all flex items-center justify-between shadow-2xs cursor-pointer"
                >
                  <span className="font-semibold">{p}</span>
                  <ArrowRight size={13} className="text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex justify-end">
                <div className="bg-brand-600 text-white text-xs font-bold px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] shadow-sm leading-relaxed">
                  {m.question}
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-slate-50 border border-slate-200 text-slate-800 text-xs px-4 py-3.5 rounded-2xl rounded-tl-sm max-w-[95%] shadow-sm space-y-2.5">
                  <p className="leading-relaxed whitespace-pre-wrap font-semibold text-slate-900">{m.answer}</p>
                  {m.cited_clauses && m.cited_clauses.length > 0 && (
                    <div className="pt-2.5 border-t border-slate-200 flex flex-wrap gap-1.5">
                      {m.cited_clauses.map((c: any, cIdx: number) => (
                        <span key={cIdx} className="text-[10px] font-bold bg-white border border-brand-200 text-brand-700 px-2.5 py-0.5 rounded-lg shadow-2xs">
                          Page {c.page_number || 1}: {c.section_title || 'Contract Excerpt'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input Box with Regional Language Badge, Mic Voice Input & Submit */}
      <form onSubmit={(e) => { e.preventDefault(); handleAsk(); }} className="pt-3 border-t border-slate-100 space-y-2">
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 focus-within:border-brand-500 focus-within:bg-white p-1.5 rounded-2xl transition-all shadow-2xs">
          {/* Active Regional Language Indicator */}
          <div className="hidden sm:flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-xl text-[10px] font-black text-slate-700 shadow-2xs flex-shrink-0">
            <span>{currentLang.flag}</span>
            <span>{currentLang.native}</span>
          </div>

          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={ui.ask_placeholder || 'Type your question in any regional language...'}
            disabled={loading}
            className="flex-1 text-xs px-2 py-1.5 bg-transparent focus:outline-none font-semibold text-slate-900 placeholder:text-slate-400"
          />

          {/* Regional Speech Input (Microphone Button) */}
          <button
            type="button"
            onClick={toggleVoiceInput}
            title={`Speak in ${currentLang.name} (${currentLang.native})`}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              isListening
                ? 'bg-red-500 text-white animate-pulse'
                : 'hover:bg-slate-200 text-slate-500 hover:text-slate-800'
            }`}
          >
            {isListening ? <MicOff size={15} /> : <Mic size={15} />}
          </button>

          {/* Ask Button */}
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm flex-shrink-0 cursor-pointer"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {ui.ask_btn || 'Ask'}
          </button>
        </div>

        {isListening && (
          <p className="text-[11px] font-bold text-red-600 animate-pulse text-center">
            🎙️ Listening in {currentLang.name} ({currentLang.native})… speak now
          </p>
        )}
      </form>
    </div>
  );
};

export const ContractsPage: React.FC = () => {
  const { persona } = usePersona();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [translating, setTranslating] = useState<boolean>(false);
  const [translatedContractCache, setTranslatedContractCache] = useState<Record<string, any>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'sidebyside' | 'ledger' | 'charts' | 'assistant'>('overview');
  const qc = useQueryClient();

  const { data: contracts = [] } = useQuery({ queryKey: ['contracts'], queryFn: contractService.getAll });
  const rawActiveContract = contracts.find((c: any) => c.id === activeId);

  // Active contract with active language translation overlay
  const activeContract = useMemo(() => {
    if (!rawActiveContract) return null;
    if (selectedLanguage === 'en') return rawActiveContract;
    const cacheKey = `${rawActiveContract.id}_${selectedLanguage}`;
    return translatedContractCache[cacheKey] || rawActiveContract;
  }, [rawActiveContract, selectedLanguage, translatedContractCache]);

  const ui = LOCALIZED_UI[selectedLanguage] || {};

  useEffect(() => {
    if (!activeId && contracts.length > 0) {
      setActiveId(contracts[0].id);
    }
  }, [contracts, activeId]);

  // Handle language change with translation API
  const handleLanguageChange = async (lang: string) => {
    setSelectedLanguage(lang);
    if (lang === 'en' || !rawActiveContract) return;

    const cacheKey = `${rawActiveContract.id}_${lang}`;
    if (translatedContractCache[cacheKey]) return;

    setTranslating(true);
    try {
      const translated = await contractService.translateContract(rawActiveContract, lang);
      setTranslatedContractCache(prev => ({
        ...prev,
        [cacheKey]: translated
      }));
    } catch (err) {
      console.error('Translation error:', err);
    } finally {
      setTranslating(false);
    }
  };

  const onDrop = useCallback(async (files: File[]) => {
    if (!files || files.length === 0) return;
    setAnalyzing(true);
    try {
      const result = await contractService.uploadAndAnalyze(files[0]);
      qc.invalidateQueries({ queryKey: ['contracts'] });
      setActiveId(result.id);
      setActiveTab('overview');
    } catch (err: any) {
      console.error('Upload failed:', err);
      const msg = err?.response?.data?.message || err?.message || 'Could not analyze file. Please ensure the backend and AI service are running.';
      alert(`Upload Error: ${msg}`);
    } finally {
      setAnalyzing(false);
    }
  }, [qc]);

  const handleDeleteContract = async (id: string) => {
    if (!confirm('Are you sure you want to delete this agreement and purge its data?')) return;
    try {
      await contractService.deleteContract(id);
      qc.invalidateQueries({ queryKey: ['contracts'] });
      setActiveId(null);
    } catch (e) {
      alert('Failed to delete contract.');
    }
  };

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    onDrop,
    noClick: false,
    noKeyboard: false,
    accept: { 
      'application/pdf': ['.pdf'], 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'image/*': ['.png', '.jpg', '.jpeg']
    },
  });

  const sim = activeContract?.simulation_results || {
    loan_amount: 500000,
    annual_interest_rate: 12.5,
    tenure_months: 36,
    monthly_emi: 16727,
    total_repayment: 602172,
    total_interest: 102172,
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <Topbar 
        title="Financial Contract Simplifier AI" 
        subtitle="Analyze any loan, mortgage, lease, or debt agreement with clear executive summaries and unambiguous financial recommendations." 
      />

      {/* Hidden file input controlled by dropzone */}
      <input {...getInputProps()} id="contracts-global-file-input" />

      {/* Top Controls: Contract Switcher, Custom Language Selector, Delete & Upload */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200/90 shadow-sm">
        {/* Left: Document Switcher */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 font-bold shadow-2xs">
            <FileText size={18} />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block mb-0.5">Active Agreement</label>
            <select
              value={activeId || ''}
              onChange={(e) => setActiveId(e.target.value)}
              className="text-sm font-black text-slate-800 bg-transparent focus:outline-none cursor-pointer pr-4 hover:text-brand-600 transition-colors"
            >
              {contracts.length === 0 ? (
                <option value="">No contracts analyzed yet</option>
              ) : (
                contracts.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.document_name || 'Financial Agreement'} ({new Date(c.created_at).toLocaleDateString()})
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Right Controls: Sleek Custom Language Dropdown, Delete, and Upload */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Custom Designed Multilingual Selector */}
          <CustomLanguageDropdown
            selectedLanguage={selectedLanguage}
            onSelectLanguage={handleLanguageChange}
            translating={translating}
          />

          {activeContract && (
            <button
              type="button"
              onClick={() => handleDeleteContract(activeContract.id)}
              className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-red-200/60"
              title="Delete this agreement and purge stored data"
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline">Delete Data</span>
            </button>
          )}

          <button
            type="button"
            onClick={open}
            disabled={analyzing}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-2xl text-xs font-extrabold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {analyzing ? 'Analyzing Agreement…' : (ui.upload_btn || 'Upload Agreement')}
          </button>
        </div>
      </div>

      {/* Upload Dropzone Area */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragActive ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          {analyzing ? (
            <div className="py-4 flex flex-col items-center gap-2.5">
              <Loader2 size={36} className="text-brand-600 animate-spin" />
              <p className="text-base font-extrabold text-slate-900">
                Analyzing agreement against your financial baseline…
              </p>
              <p className="text-xs text-slate-600 font-medium">Extracting key terms, calculating affordability, and determining final recommendation</p>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 bg-brand-100 rounded-2xl flex items-center justify-center text-brand-600">
                <Upload size={22} />
              </div>
              <p className="text-slate-800 font-extrabold text-base">
                {isDragActive ? (ui.dropzone_active || 'Drop your agreement here') : (ui.dropzone_idle || 'Drag & drop any financial agreement (PDF, DOCX, Scanned Image, or TXT)')}
              </p>
              <p className="text-xs text-slate-600 font-medium">{ui.dropzone_sub || 'Supports Business Loans, Home Mortgages, Personal Debt, Equipment Leases & Credit Lines in 8 Indian Languages'}</p>
            </>
          )}
        </div>
      </div>

      {/* Full-Width Active Analysis Stage */}
      {activeContract && activeContract.analysis_status === 'completed' && (
        <div className="space-y-6">
          {/* Navigation View Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
            {[
              { id: 'overview', label: ui.tab_overview || 'Executive Summary & Decision', icon: Sparkles },
              { id: 'sidebyside', label: `${ui.tab_clauses || 'Clause Breakdown'} (${activeContract.clauses?.length || 0})`, icon: Columns },
              { id: 'ledger', label: ui.tab_baseline || 'Financial Baseline', icon: Wallet },
              { id: 'charts', label: ui.tab_schedule || 'Payment Schedule', icon: BarChart3 },
              { id: 'assistant', label: ui.tab_assistant || 'Agreement Assistant', icon: Mail },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-brand-600 hover:bg-slate-100'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* TAB 1: EXECUTIVE SUMMARY & DECISION */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Step 1: Executive Summary First */}
              <ExecutiveSummaryHero contract={activeContract} language={selectedLanguage} />

              {/* Step 2: Decision Verdict (Either Accept or Decline with Focused Reasons) */}
              <DecisionVerdictCard contract={activeContract} language={selectedLanguage} />

              {/* Step 3: User's Financial Condition Impact */}
              <UserFinancialConditionCard 
                ledgerImpact={activeContract.ledger_impact} 
                sim={activeContract.simulation_results} 
                persona={persona} 
                language={selectedLanguage}
              />

              {/* Step 4: Key Clauses Preview */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-lg text-slate-900">Key Clauses (Original vs Plain Translation)</h3>
                    <p className="text-xs text-slate-600 font-medium">Click any clause to inspect original wording and borrower tips</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('sidebyside')}
                    className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 cursor-pointer"
                  >
                    View All {activeContract.clauses?.length || 0} Clauses <ArrowRight size={13} />
                  </button>
                </div>

                <div className="space-y-3">
                  {activeContract.clauses?.slice(0, 4).map((clause: any, i: number) => (
                    <SideBySideClauseRow 
                      key={i} 
                      clause={clause} 
                      language={selectedLanguage}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: SIDE-BY-SIDE CLAUSE VISUALIZER (FULL) */}
          {activeTab === 'sidebyside' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900">{ui.tab_clauses || 'Clause-by-Clause Breakdown'}</h3>
                  <p className="text-xs text-slate-600 font-medium">
                    Original contract text displayed directly alongside the plain translation
                  </p>
                </div>
                <span className="text-xs font-bold text-brand-700 bg-brand-50 border border-brand-200 px-3 py-1 rounded-full">
                  {activeContract.clauses?.length || 0} Clauses Analyzed
                </span>
              </div>

              <div className="space-y-3">
                {activeContract.clauses?.map((clause: any, i: number) => (
                  <SideBySideClauseRow 
                    key={i} 
                    clause={clause} 
                    language={selectedLanguage}
                  />
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: FINANCIAL BASELINE */}
          {activeTab === 'ledger' && (
            <div className="space-y-6">
              <UserFinancialConditionCard 
                ledgerImpact={activeContract.ledger_impact} 
                sim={activeContract.simulation_results} 
                persona={persona} 
                language={selectedLanguage}
              />
            </div>
          )}

          {/* TAB 4: PAYMENT SCHEDULE */}
          {activeTab === 'charts' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card p-5 border border-slate-200 rounded-2xl bg-white shadow-sm">
                  <p className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">{ui.fixed_emi || 'Fixed Monthly Installment'}</p>
                  <p className="text-xl font-black text-brand-600 mt-1">₹{Number(sim.monthly_emi || 0).toLocaleString('en-IN')}</p>
                  <p className="text-xs text-slate-500 font-medium mt-1">{ui.due_monthly || 'Due monthly'}</p>
                </div>
                <div className="card p-5 border border-slate-200 rounded-2xl bg-white shadow-sm">
                  <p className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">{ui.total_cost || 'Total Financing Cost'}</p>
                  <p className="text-xl font-black text-slate-900 mt-1">₹{Number(sim.total_repayment || 0).toLocaleString('en-IN')}</p>
                  <p className="text-xs text-slate-500 font-medium mt-1">{ui.principal_interest || 'Principal + Interest'}</p>
                </div>
                <div className="card p-5 border border-slate-200 rounded-2xl bg-white shadow-sm">
                  <p className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">{ui.total_interest_obl || 'Total Interest Obligation'}</p>
                  <p className="text-xl font-black text-amber-600 mt-1">₹{Number(sim.total_interest || 0).toLocaleString('en-IN')}</p>
                  <p className="text-xs text-slate-500 font-medium mt-1">{sim.tenure_months || 36} {ui.over_months || 'months'}</p>
                </div>
                <div className="card p-5 border border-slate-200 rounded-2xl bg-white shadow-sm">
                  <p className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">{ui.prepay_exit || 'Prepayment Exit Fee'}</p>
                  <p className="text-xl font-black text-emerald-600 mt-1">{sim.prepayment_penalty ? `${sim.prepayment_penalty}%` : '0% (Free)'}</p>
                  <p className="text-xs text-slate-500 font-medium mt-1">{ui.exit_charge || 'Exit charge for early payoff'}</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: INTERACTIVE ASSISTANT */}
          {activeTab === 'assistant' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ContractAssistant contractId={activeContract.id} language={selectedLanguage} />
              
              {/* Negotiation Playbook */}
              <div className="card p-6 border border-slate-200 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600">
                    <Mail size={18} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base text-slate-900">{ui.lender_points_title || 'Lender Discussion Points'}</h4>
                    <p className="text-xs text-slate-600 font-medium">{ui.lender_points_desc || 'Recommended adjustments before signing'}</p>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs text-slate-700">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="font-bold text-slate-900 block mb-0.5">{ui.neg_1_title || '1. Benchmark Transparency:'}</span>
                    <span>{ui.neg_1_desc || 'Request that interest rates be pegged to an external benchmark to avoid arbitrary spread increases.'}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="font-bold text-slate-900 block mb-0.5">{ui.neg_2_title || '2. Grace Period Notice:'}</span>
                    <span>{ui.neg_2_desc || 'Request a mandatory 15-day written notice window before any default remedies or penalty fees can be charged.'}</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="font-bold text-slate-900 block mb-0.5">{ui.neg_3_title || '3. Early Payoff Protection:'}</span>
                    <span>{ui.neg_3_desc || 'Confirm 0% exit penalties for prepayments made from ordinary business income.'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
