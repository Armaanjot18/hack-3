require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const authRoutes = require('./routes/auth');
const nearbyHospitalsRoutes = require('./routes/nearbyHospitals');
const meRoutes = require('./routes/me');
const { requireAuthPage, requireAuthApi } = require('./middleware/auth');
const { cleanExpiredRefreshTokens } = require('./db');

const app = express();
const port = Number(process.env.PORT || 3000);

/* ── Validate JWT secrets at startup ── */
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be set and at least 32 characters long.');
  process.exit(1);
}
if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) {
  console.error('JWT_REFRESH_SECRET must be set and at least 32 characters long.');
  process.exit(1);
}

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

/* ── Clean expired refresh tokens every 30 minutes ── */
setInterval(cleanExpiredRefreshTokens, 30 * 60 * 1000);

app.use('/auth', authRoutes);
app.use('/api/nearby', requireAuthApi, nearbyHospitalsRoutes);
app.use('/api/me', requireAuthApi, meRoutes);

/* ── No-cache middleware for HTML pages ── */
function noCache(req, res, next) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  return next();
}

app.get('/login', noCache, (req, res) => {
  const payload = require('./middleware/auth').verifyAccessToken(req);
  if (payload) return res.redirect('/');
  return res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup', noCache, (req, res) => {
  const payload = require('./middleware/auth').verifyAccessToken(req);
  if (payload) return res.redirect('/');
  return res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/logout', noCache, (req, res) => {
  res.clearCookie('medicheck_access', { path: '/' });
  res.clearCookie('medicheck_refresh', { path: '/auth' });
  return res.redirect('/login');
});

app.get('/api/protected/health', requireAuthApi, (req, res) => {
  return res.status(200).json({ status: 'ok', userId: req.userId });
});

app.get('/', requireAuthPage, noCache, (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.get('/app', requireAuthPage, noCache, (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

/* ══════════════════════════════════════════
   GEMINI AI CHATBOT  (with rule-based fallback)
   ══════════════════════════════════════════ */

const medicalData = JSON.parse(fs.readFileSync(path.join(__dirname, 'medicine.json'), 'utf8'));

function buildCompactMedicalRef() {
  let ref = 'SYMPTOMS DB:\n';
  medicalData.symptoms.forEach(s => {
    ref += `${s.english}(${s.hindi}/${s.punjabi})[${s.severity}]: diseases=${s.possible_diseases.join(',')}, remedy=${s.home_remedy.substring(0, 100)}..., warning=${s.warning_signs.substring(0, 80)}...\n`;
  });
  ref += '\nDISEASES DB:\n';
  for (const [name, d] of Object.entries(medicalData.diseases)) {
    ref += `${name}: ${d.description.substring(0, 80)}... Doctor: ${d.when_to_see_doctor.substring(0, 60)}... Precautions: ${d.precautions.slice(0, 3).join('; ')}\n`;
  }
  return ref;
}

let geminiModel = null;
if (process.env.GEMINI_API_KEY) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const systemInstruction = `You are MediCheck AI — a friendly, professional medical symptom checker chatbot.

MEDICAL REFERENCE:
${buildCompactMedicalRef()}

RULES:
- Help users understand symptoms, possible conditions, home remedies, when to see a doctor
- Understand English, Hindi, Punjabi. Respond in user's language
- Ask 1-2 follow-up questions to understand symptoms better before giving diagnosis
- For CRITICAL symptoms (chest pain, breathing difficulty), immediately give emergency guidance — call 112
- Include in health report: symptoms detected, possible conditions, severity, home remedies, when to see doctor, disclaimer
- Always end reports with: "⚠️ DISCLAIMER: This is NOT a medical diagnosis. Always consult a qualified healthcare professional."
- Use emojis: 🩺 💊 ⚠️ 🏥 🌿
- If user asks non-health topics, politely redirect to health symptoms
- Keep responses concise with bullet points
- Be empathetic and caring`;

  geminiModel = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction
  });
  console.log('Gemini AI model loaded.');
} else {
  console.log('GEMINI_API_KEY not set — chatbot will use rule-based fallback only.');
}

/* ── Rule-based fallback helpers ── */

function wordMatch(text, words) {
  const t = ' ' + text.toLowerCase().trim().replace(/[.,!?]/g, ' ') + ' ';
  return words.some(w => t.includes(' ' + w + ' '));
}

const greetingWords = ['hi','hello','hey','hlo','hii','good morning','good evening','good afternoon','namaste','नमस्ते','sat sri akal','ਸਤ ਸ੍ਰੀ ਅਕਾਲ','ਹੈਲੋ','howdy','sup'];
const yesWords = ['yes','yeah','yep','yup','haan','ha','sure','ok','okay','correct','right','ji','ji haan','हाँ','हां','हाँ जी','ਹਾਂ','ਹਾਂ ਜੀ','ਜੀ ਹਾਂ'];
const noWords = ['no','nope','nah','nahi','nahin','never','negative','nai','नहीं','नही','ਨਹੀਂ','ਨਹੀ','ਨਾ'];
const byeWords = ['bye','goodbye','thanks','thank you','shukriya','dhanyavaad','exit','quit','see you','धन्यवाद','शुक्रिया','अलविदा','ਧੰਨਵਾਦ','ਤੁਹਾਡਾ ਧੰਨਵਾਦ','ਅਲਵਿਦਾ'];

function isGreeting(msg) { return wordMatch(msg, greetingWords); }
function isYes(msg) { return wordMatch(msg, yesWords); }
function isNo(msg) { return wordMatch(msg, noWords); }
function isBye(msg) { return wordMatch(msg, byeWords) || msg.toLowerCase().includes('thank'); }

function extractSymptoms(message) {
  const msg = message.toLowerCase();
  const detected = [];
  medicalData.symptoms.forEach(symptom => {
    if (msg.includes(symptom.english.toLowerCase()) || msg.includes(symptom.hindi) || msg.includes(symptom.punjabi)) {
      detected.push(symptom.english);
    }
    if (symptom.synonyms) {
      symptom.synonyms.forEach(word => {
        if (msg.includes(word.toLowerCase())) detected.push(symptom.english);
      });
    }
  });
  return [...new Set(detected)];
}

const followUpRules = [
  { has: 'Fever', missing: 'Cough', key: 'cough_check', addOnYes: 'Cough',
    question: { en: 'Do you also have a cough or cold along with the fever?', hi: 'क्या आपको बुखार के साथ खांसी या सर्दी भी है?', pa: 'ਕੀ ਤੁਹਾਨੂੰ ਬੁਖਾਰ ਨਾਲ ਖੰਘ ਜਾਂ ਜ਼ੁਕਾਮ ਵੀ ਹੈ?' } },
  { has: 'Fever', missing: 'Headache', key: 'head_check', addOnYes: 'Headache',
    question: { en: 'Are you experiencing any headache or body pain?', hi: 'क्या आपको सिरदर्द या बदन दर्द है?', pa: 'ਕੀ ਤੁਹਾਨੂੰ ਸਿਰ ਦਰਦ ਜਾਂ ਸਰੀਰ ਦਰਦ ਹੈ?' } },
  { has: 'Cough', missing: 'Shortness of Breath', key: 'breath_check', addOnYes: 'Shortness of Breath',
    question: { en: 'Are you having any difficulty breathing?', hi: 'क्या आपको सांस लेने में कोई तकलीफ है?', pa: 'ਕੀ ਤੁਹਾਨੂੰ ਸਾਹ ਲੈਣ ਵਿੱਚ ਕੋਈ ਦਿੱਕਤ ਹੈ?' } },
  { has: 'Cough', missing: 'Sore Throat', key: 'throat_check', addOnYes: 'Sore Throat',
    question: { en: 'Do you have a sore throat?', hi: 'क्या आपके गले में दर्द है?', pa: 'ਕੀ ਤੁਹਾਡੇ ਗਲੇ ਵਿੱਚ ਦਰਦ ਹੈ?' } },
  { has: 'Vomiting', missing: 'Diarrhea', key: 'diarrhea_check', addOnYes: 'Diarrhea',
    question: { en: 'Are you also having loose motions or diarrhea?', hi: 'क्या आपको दस्त भी हो रहे हैं?', pa: 'ਕੀ ਤੁਹਾਨੂੰ ਦਸਤ ਵੀ ਹੋ ਰਹੇ ਹਨ?' } },
  { has: 'Headache', missing: 'Fever', key: 'hfever_check', addOnYes: 'Fever',
    question: { en: 'Do you also have a fever?', hi: 'क्या आपको बुखार भी है?', pa: 'ਕੀ ਤੁਹਾਨੂੰ ਬੁਖਾਰ ਵੀ ਹੈ?' } },
  { has: 'Abdominal Pain', missing: 'Vomiting', key: 'avomit_check', addOnYes: 'Vomiting',
    question: { en: 'Are you feeling nauseous or vomiting?', hi: 'क्या आपको जी मिचलाना या उल्टी हो रही है?', pa: 'ਕੀ ਤੁਹਾਨੂੰ ਜੀ ਮਚਲਾਉਣਾ ਜਾਂ ਉਲਟੀ ਹੋ ਰਹੀ ਹੈ?' } },
  { has: 'Back Pain', missing: 'Fever', key: 'bfever_check', addOnYes: 'Fever',
    question: { en: 'Do you have any fever with the back pain?', hi: 'क्या कमर दर्द के साथ बुखार भी है?', pa: 'ਕੀ ਪਿੱਠ ਦਰਦ ਨਾਲ ਬੁਖਾਰ ਵੀ ਹੈ?' } },
  { has: 'Dizziness', missing: 'Headache', key: 'dzhead_check', addOnYes: 'Headache',
    question: { en: 'Are you also having a headache?', hi: 'क्या आपको सिरदर्द भी है?', pa: 'ਕੀ ਤੁਹਾਨੂੰ ਸਿਰ ਦਰਦ ਵੀ ਹੈ?' } },
];

function qText(rule, lang) {
  if (typeof rule.question === 'object') return rule.question[lang] || rule.question.en;
  return rule.question;
}

function getNextFollowUp(session) {
  for (const rule of followUpRules) {
    if (session.symptoms.includes(rule.has) && !session.symptoms.includes(rule.missing) && !session.askedQuestions.includes(rule.key)) {
      return rule;
    }
  }
  if (!session.askedQuestions.includes('general_other')) {
    return { key: 'general_other', addOnYes: null, question: { en: 'Do you have any other symptoms?', hi: 'क्या आपको कोई और लक्षण हैं?', pa: 'ਕੀ ਤੁਹਾਨੂੰ ਕੋਈ ਹੋਰ ਲੱਛਣ ਹਨ?' } };
  }
  return null;
}

function predictDiseases(symptoms) {
  const scores = {};
  symptoms.forEach(name => {
    const s = medicalData.symptoms.find(x => x.english === name);
    if (!s) return;
    s.possible_diseases.forEach(d => { scores[d] = (scores[d] || 0) + 1; });
  });
  return Object.entries(scores).sort((a, b) => b[1] - a[1]).map(([name, score]) => ({ name, score }));
}

function buildDiagnosis(session, lang) {
  const L = lang || 'en';
  const symptoms = session.symptoms;
  const diseases = predictDiseases(symptoms);
  const top = diseases.slice(0, 3);

  const labels = {
    en: { noMatch: "I couldn't match your symptoms. Please consult a healthcare professional.", report: 'MediCheck AI Health Report', symp: 'Symptoms', urgent: 'URGENT: Call emergency services (112) IMMEDIATELY.', important: 'IMPORTANT: See a doctor as soon as possible.', conditions: 'Possible Conditions', high: 'High', moderate: 'Moderate', low: 'Low', remedies: 'Home Remedies', disclaimer: 'DISCLAIMER: This is NOT a medical diagnosis. Always consult a qualified healthcare professional.', resetMsg: 'Type "reset" to start new consultation.' },
    hi: { noMatch: 'आपके लक्षणों से कोई बीमारी मिल नहीं पाई। कृपया डॉक्टर से मिलें।', report: 'MediCheck AI स्वास्थ्य रिपोर्ट', symp: 'लक्षण', urgent: 'तुरंत: आपातकालीन सेवाओं (112) को तुरंत कॉल करें!', important: 'महत्वपूर्ण: जल्द से जल्द डॉक्टर से मिलें।', conditions: 'संभावित बीमारियाँ', high: 'उच्च', moderate: 'मध्यम', low: 'कम', remedies: 'घरेलू उपाय', disclaimer: 'अस्वीकरण: यह चिकित्सा निदान नहीं है। हमेशा योग्य डॉक्टर से सलाह लें।', resetMsg: 'नई जांच के लिए "reset" टाइप करें।' },
    pa: { noMatch: 'ਤੁਹਾਡੇ ਲੱਛਣਾਂ ਨਾਲ ਕੋਈ ਬਿਮਾਰੀ ਨਹੀਂ ਮਿਲੀ। ਕਿਰਪਾ ਕਰਕੇ ਡਾਕਟਰ ਨੂੰ ਮਿਲੋ।', report: 'MediCheck AI ਸਿਹਤ ਰਿਪੋਰਟ', symp: 'ਲੱਛਣ', urgent: 'ਫੌਰੀ: ਐਮਰਜੈਂਸੀ ਸੇਵਾਵਾਂ (112) ਨੂੰ ਤੁਰੰਤ ਕਾਲ ਕਰੋ!', important: 'ਮਹੱਤਵਪੂਰਨ: ਜਲਦੀ ਡਾਕਟਰ ਨੂੰ ਮਿਲੋ।', conditions: 'ਸੰਭਾਵਿਤ ਬਿਮਾਰੀਆਂ', high: 'ਉੱਚ', moderate: 'ਮੱਧਮ', low: 'ਘੱਟ', remedies: 'ਘਰੇਲੂ ਇਲਾਜ', disclaimer: 'ਬੇਦਾਅਵਾ: ਇਹ ਡਾਕਟਰੀ ਜਾਂਚ ਨਹੀਂ ਹੈ। ਹਮੇਸ਼ਾ ਯੋਗ ਡਾਕਟਰ ਦੀ ਸਲਾਹ ਲਓ।', resetMsg: 'ਨਵੀਂ ਜਾਂਚ ਲਈ "reset" ਟਾਈਪ ਕਰੋ।' }
  };
  const l = labels[L] || labels.en;

  if (top.length === 0) return l.noMatch;

  const sympNames = symptoms.map(name => {
    const s = medicalData.symptoms.find(x => x.english === name);
    if (!s) return name;
    if (L === 'hi') return s.hindi;
    if (L === 'pa') return s.punjabi;
    return name;
  });

  const remedies = [];
  symptoms.forEach(name => {
    const s = medicalData.symptoms.find(x => x.english === name);
    const sName = L === 'hi' ? s.hindi : L === 'pa' ? s.punjabi : name;
    const remedy = L === 'pa' && s.home_remedy_pa ? s.home_remedy_pa : s.home_remedy;
    if (s && remedy) remedies.push(`  • ${sName}: ${remedy}`);
  });

  const hasCritical = symptoms.some(n => { const s = medicalData.symptoms.find(x => x.english === n); return s && s.severity === 'critical'; });
  const hasHigh = symptoms.some(n => { const s = medicalData.symptoms.find(x => x.english === n); return s && s.severity === 'high'; });

  let urgency = '';
  if (hasCritical) urgency = `\n🚨 ${l.urgent}\n`;
  else if (hasHigh) urgency = `\n⚠️ ${l.important}\n`;

  let msg = `━━━━━━━━━━━━━━━━━━━━━━━━\n📋 ${l.report}\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `🩺 ${l.symp}: ${sympNames.join(', ')}\n${urgency}\n🔍 ${l.conditions}:\n`;
  top.forEach((d, i) => {
    const conf = d.score >= 3 ? l.high : d.score >= 2 ? l.moderate : l.low;
    msg += `   ${i + 1}. ${d.name} (${conf})\n`;
  });
  if (remedies.length > 0) msg += `\n💊 ${l.remedies}:\n${remedies.join('\n')}\n`;
  msg += `\n⚠️ ${l.disclaimer}\n${l.resetMsg}`;
  return msg;
}

function newRuleSession() {
  return { symptoms: [], lastQuestion: null, askedQuestions: [], done: false, currentRule: null };
}

const uiText = {
  en: {
    bye: 'Take care! 🌿 Wishing you good health.',
    greet: "Hello 👋 I am MediCheck AI.\n\nTell me your symptoms and I'll help assess possible conditions.\n\nExamples: fever, cough, headache, stomach pain",
    complete: 'Your consultation is complete.\n\nType "reset" to start new, or describe new symptoms.',
    descMore: 'Please describe those additional symptoms.',
    yesNo: 'Please answer yes or no, or describe a symptom.',
    askSpecific: 'Could you describe your specific symptoms?\n\nExamples: fever, headache, cough, stomach pain',
    healthOnly: "I specialize in health symptoms.\n\nPlease tell me what you're feeling.\n\nExamples: fever, headache, cough, body pain, stomach pain",
    noted: 'Noted', newConsult: 'New consultation.'
  },
  hi: {
    bye: 'ध्यान रखें! 🌿 आपको अच्छे स्वास्थ्य की शुभकामनाएं।',
    greet: 'नमस्ते 👋 मैं MediCheck AI हूँ।\n\nमुझे अपने लक्षण बताएं और मैं संभावित बीमारियों का आकलन करूंगा।\n\nउदाहरण: बुखार, खांसी, सिरदर्द, पेट दर्द',
    complete: 'आपकी जांच पूरी हो गई है।\n\nनई जांच के लिए "reset" टाइप करें, या नए लक्षण बताएं।',
    descMore: 'कृपया अपने अतिरिक्त लक्षण बताएं।',
    yesNo: 'कृपया हाँ या नहीं में जवाब दें, या कोई लक्षण बताएं।',
    askSpecific: 'कृपया अपने लक्षण विस्तार से बताएं।\n\nउदाहरण: बुखार, सिरदर्द, खांसी, पेट दर्द',
    healthOnly: 'मैं स्वास्थ्य लक्षणों में विशेषज्ञ हूँ।\n\nकृपया बताएं आप कैसा महसूस कर रहे हैं।\n\nउदाहरण: बुखार, सिरदर्द, खांसी, बदन दर्द, पेट दर्द',
    noted: 'नोट किया', newConsult: 'नई जांच।'
  },
  pa: {
    bye: 'ਧਿਆਨ ਰੱਖੋ! 🌿 ਤੁਹਾਨੂੰ ਚੰਗੀ ਸਿਹਤ ਦੀਆਂ ਸ਼ੁਭਕਾਮਨਾਵਾਂ।',
    greet: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ 👋 ਮੈਂ MediCheck AI ਹਾਂ।\n\nਮੈਨੂੰ ਆਪਣੇ ਲੱਛਣ ਦੱਸੋ ਅਤੇ ਮੈਂ ਸੰਭਾਵਿਤ ਬਿਮਾਰੀਆਂ ਦਾ ਮੁਲਾਂਕਣ ਕਰਾਂਗਾ।\n\nਉਦਾਹਰਨ: ਬੁਖਾਰ, ਖੰਘ, ਸਿਰ ਦਰਦ, ਪੇਟ ਦਰਦ',
    complete: 'ਤੁਹਾਡੀ ਜਾਂਚ ਪੂਰੀ ਹੋ ਗਈ ਹੈ।\n\nਨਵੀਂ ਜਾਂਚ ਲਈ "reset" ਟਾਈਪ ਕਰੋ, ਜਾਂ ਨਵੇਂ ਲੱਛਣ ਦੱਸੋ।',
    descMore: 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੇ ਹੋਰ ਲੱਛਣ ਦੱਸੋ।',
    yesNo: 'ਕਿਰਪਾ ਕਰਕੇ ਹਾਂ ਜਾਂ ਨਹੀਂ ਵਿੱਚ ਜਵਾਬ ਦਿਓ, ਜਾਂ ਕੋਈ ਲੱਛਣ ਦੱਸੋ।',
    askSpecific: 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣੇ ਲੱਛਣ ਵਿਸਤਾਰ ਨਾਲ ਦੱਸੋ।\n\nਉਦਾਹਰਨ: ਬੁਖਾਰ, ਸਿਰ ਦਰਦ, ਖੰਘ, ਪੇਟ ਦਰਦ',
    healthOnly: 'ਮੈਂ ਸਿਹਤ ਲੱਛਣਾਂ ਵਿੱਚ ਮਾਹਰ ਹਾਂ।\n\nਕਿਰਪਾ ਕਰਕੇ ਦੱਸੋ ਤੁਸੀਂ ਕਿਵੇਂ ਮਹਿਸੂਸ ਕਰ ਰਹੇ ਹੋ।\n\nਉਦਾਹਰਨ: ਬੁਖਾਰ, ਸਿਰ ਦਰਦ, ਖੰਘ, ਸਰੀਰ ਦਰਦ, ਪੇਟ ਦਰਦ',
    noted: 'ਨੋਟ ਕੀਤਾ', newConsult: 'ਨਵੀਂ ਜਾਂਚ।'
  }
};

function handleRuleBased(userId, msg, sessions, lang) {
  const L = lang || 'en';
  const txt = uiText[L] || uiText.en;
  if (!sessions[userId]) sessions[userId] = newRuleSession();
  const session = sessions[userId];

  if (isBye(msg)) { sessions[userId] = newRuleSession(); return txt.bye; }

  if (isGreeting(msg) && session.symptoms.length === 0 && !session.lastQuestion) {
    return txt.greet;
  }

  if (session.done) {
    const newSymp = extractSymptoms(msg);
    if (newSymp.length > 0) {
      sessions[userId] = newRuleSession();
      const s2 = sessions[userId];
      s2.symptoms = newSymp;
      const rule = getNextFollowUp(s2);
      if (rule) { s2.askedQuestions.push(rule.key); s2.currentRule = rule; s2.lastQuestion = rule.key; return `${txt.newConsult}\n\n${txt.noted}: ${newSymp.join(', ')}.\n\n${qText(rule, L)}`; }
      s2.done = true;
      return buildDiagnosis(s2, L);
    }
    return txt.complete;
  }

  if (session.lastQuestion && session.currentRule) {
    if (isYes(msg) || isNo(msg)) {
      if (isYes(msg) && session.currentRule.addOnYes) { session.symptoms.push(session.currentRule.addOnYes); session.symptoms = [...new Set(session.symptoms)]; }
      if (isYes(msg) && session.currentRule.key === 'general_other') { session.lastQuestion = null; session.currentRule = null; return txt.descMore; }
      session.lastQuestion = null; session.currentRule = null;
      const nextRule = getNextFollowUp(session);
      if (nextRule) { session.askedQuestions.push(nextRule.key); session.currentRule = nextRule; session.lastQuestion = nextRule.key; return qText(nextRule, L); }
      session.done = true;
      return buildDiagnosis(session, L);
    }
    const extra = extractSymptoms(msg);
    if (extra.length > 0) {
      session.symptoms = [...new Set([...session.symptoms, ...extra])]; session.lastQuestion = null; session.currentRule = null;
      const nextRule = getNextFollowUp(session);
      if (nextRule) { session.askedQuestions.push(nextRule.key); session.currentRule = nextRule; session.lastQuestion = nextRule.key; return `${txt.noted}: ${extra.join(', ')}.\n\n${qText(nextRule, L)}`; }
      session.done = true;
      return buildDiagnosis(session, L);
    }
    return txt.yesNo;
  }

  const detected = extractSymptoms(msg);
  if (detected.length === 0) {
    const healthWords = ['sick','ill','pain','ache','disease','help','medical','doctor','health','symptom','feeling','hurt','unwell','bimaar','tabiyat','taklif','dard','rog','ਬਿਮਾਰ','ਤਬੀਅਤ','ਦਰਦ','ਰੋਗ','ਮਦਦ','ਡਾਕਟਰ','ਸਿਹਤ','ਲੱਛਣ','बीमार','तबीयत','दर्द','रोग'];
    if (healthWords.some(w => msg.toLowerCase().includes(w))) return txt.askSpecific;
    return txt.healthOnly;
  }

  session.symptoms = [...new Set([...session.symptoms, ...detected])];
  const hasCritical = session.symptoms.some(n => { const s = medicalData.symptoms.find(x => x.english === n); return s && s.severity === 'critical'; });
  if (hasCritical) { session.done = true; return buildDiagnosis(session, L); }

  const rule = getNextFollowUp(session);
  if (rule) { session.askedQuestions.push(rule.key); session.currentRule = rule; session.lastQuestion = rule.key; return `${txt.noted}: ${session.symptoms.join(', ')}.\n\n${qText(rule, L)}`; }
  session.done = true;
  return buildDiagnosis(session, L);
}

/* ── Chat session storage ── */
const aiSessions = {};
const ruleSessions = {};

function getChat(userId) {
  if (!aiSessions[userId]) {
    aiSessions[userId] = geminiModel.startChat({ history: [] });
  }
  return aiSessions[userId];
}

/* ── POST /chat — AI with rule-based fallback ── */
app.post('/chat', async (req, res) => {
  try {
    const { userId, message, lang } = req.body;
    const L = lang || 'en';

    if (!message || message.trim() === '') {
      const emptyMsg = { en: 'Please type something so I can help you.', hi: 'कृपया कुछ टाइप करें ताकि मैं आपकी मदद कर सकूँ।', pa: 'ਕਿਰਪਾ ਕਰਕੇ ਕੁਝ ਟਾਈਪ ਕਰੋ ਤਾਂ ਜੋ ਮੈਂ ਤੁਹਾਡੀ ਮਦਦ ਕਰ ਸਕਾਂ।' };
      return res.json({ message: emptyMsg[L] || emptyMsg.en });
    }

    const msg = message.trim();

    if (msg.toLowerCase() === 'reset' || msg.toLowerCase() === 'restart' || msg.toLowerCase() === 'start over') {
      delete aiSessions[userId];
      delete ruleSessions[userId];
      const resetMsg = {
        en: '🔄 Starting fresh!\n\nHello 👋 I am MediCheck AI — your AI-powered health symptom checker.\n\nDescribe your symptoms and I will help assess possible conditions, suggest home remedies, and tell you when to see a doctor.\n\nYou can type in English, Hindi, or Punjabi.',
        hi: '🔄 नई शुरुआत!\n\nनमस्ते 👋 मैं MediCheck AI हूँ — आपका AI स्वास्थ्य सहायक।\n\nअपने लक्षण बताएं और मैं संभावित बीमारियाँ, घरेलू उपाय और डॉक्टर से कब मिलना चाहिए बताऊंगा।',
        pa: '🔄 ਨਵੀਂ ਸ਼ੁਰੂਆਤ!\n\nਸਤ ਸ੍ਰੀ ਅਕਾਲ 👋 ਮੈਂ MediCheck AI ਹਾਂ — ਤੁਹਾਡਾ AI ਸਿਹਤ ਸਹਾਇਕ।\n\nਆਪਣੇ ਲੱਛਣ ਦੱਸੋ ਅਤੇ ਮੈਂ ਸੰਭਾਵਿਤ ਬਿਮਾਰੀਆਂ, ਘਰੇਲੂ ਇਲਾਜ ਅਤੇ ਡਾਕਟਰ ਨੂੰ ਕਦੋਂ ਮਿਲਣਾ ਦੱਸਾਂਗਾ।'
      };
      return res.json({ message: resetMsg[L] || resetMsg.en });
    }

    // Try Gemini AI first (if configured)
    if (geminiModel) {
      try {
        const chat = getChat(userId);
        const langHint = L === 'hi' ? '[Respond in Hindi] ' : L === 'pa' ? '[Respond in Punjabi] ' : '';
        const result = await chat.sendMessage(langHint + msg);
        const response = result.response.text();
        return res.json({ message: response });
      } catch (aiError) {
        console.log('Gemini unavailable, using fallback:', aiError.message.substring(0, 80));
        delete aiSessions[userId];
      }
    }

    // Fallback to rule-based system
    const response = handleRuleBased(userId, msg, ruleSessions, L);
    return res.json({ message: response });
  } catch (error) {
    console.error('Chat Error:', error.message);
    return res.json({ message: '⚠️ Sorry, I encountered an error. Please try again.' });
  }
});

app.use((req, res) => {
  if (req.path === '/favicon.ico') {
    return res.status(204).end();
  }
  return res.redirect('/login');
});

app.listen(port, () => {
  console.log(`MediCheck server running at http://localhost:${port}`);
});
