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

const greetingWords = ['hi','hello','hey','hlo','hii','good morning','good evening','good afternoon','namaste','sat sri akal','howdy','sup'];
const yesWords = ['yes','yeah','yep','yup','haan','ha','sure','ok','okay','correct','right','ji','ji haan'];
const noWords = ['no','nope','nah','nahi','nahin','never','negative','nai'];
const byeWords = ['bye','goodbye','thanks','thank you','shukriya','dhanyavaad','exit','quit','see you'];

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
  { has: 'Fever', missing: 'Cough', key: 'cough_check', addOnYes: 'Cough', question: 'Do you also have a cough or cold along with the fever?' },
  { has: 'Fever', missing: 'Headache', key: 'head_check', addOnYes: 'Headache', question: 'Are you experiencing any headache or body pain?' },
  { has: 'Cough', missing: 'Shortness of Breath', key: 'breath_check', addOnYes: 'Shortness of Breath', question: 'Are you having any difficulty breathing?' },
  { has: 'Cough', missing: 'Sore Throat', key: 'throat_check', addOnYes: 'Sore Throat', question: 'Do you have a sore throat?' },
  { has: 'Vomiting', missing: 'Diarrhea', key: 'diarrhea_check', addOnYes: 'Diarrhea', question: 'Are you also having loose motions or diarrhea?' },
  { has: 'Headache', missing: 'Fever', key: 'hfever_check', addOnYes: 'Fever', question: 'Do you also have a fever?' },
  { has: 'Abdominal Pain', missing: 'Vomiting', key: 'avomit_check', addOnYes: 'Vomiting', question: 'Are you feeling nauseous or vomiting?' },
  { has: 'Back Pain', missing: 'Fever', key: 'bfever_check', addOnYes: 'Fever', question: 'Do you have any fever with the back pain?' },
  { has: 'Dizziness', missing: 'Headache', key: 'dzhead_check', addOnYes: 'Headache', question: 'Are you also having a headache?' },
];

function getNextFollowUp(session) {
  for (const rule of followUpRules) {
    if (session.symptoms.includes(rule.has) && !session.symptoms.includes(rule.missing) && !session.askedQuestions.includes(rule.key)) {
      return rule;
    }
  }
  if (!session.askedQuestions.includes('general_other')) {
    return { key: 'general_other', addOnYes: null, question: 'Do you have any other symptoms?' };
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

function buildDiagnosis(session) {
  const symptoms = session.symptoms;
  const diseases = predictDiseases(symptoms);
  const top = diseases.slice(0, 3);
  if (top.length === 0) return "I couldn't match your symptoms. Please consult a healthcare professional.";

  const remedies = [];
  symptoms.forEach(name => {
    const s = medicalData.symptoms.find(x => x.english === name);
    if (s && s.home_remedy) remedies.push(`  • ${name}: ${s.home_remedy}`);
  });

  const hasCritical = symptoms.some(n => { const s = medicalData.symptoms.find(x => x.english === n); return s && s.severity === 'critical'; });
  const hasHigh = symptoms.some(n => { const s = medicalData.symptoms.find(x => x.english === n); return s && s.severity === 'high'; });

  let urgency = '';
  if (hasCritical) urgency = '\n🚨 URGENT: Call emergency services (112) IMMEDIATELY.\n';
  else if (hasHigh) urgency = '\n⚠️ IMPORTANT: See a doctor as soon as possible.\n';

  let msg = '━━━━━━━━━━━━━━━━━━━━━━━━\n📋 MediCheck AI Health Report\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
  msg += `🩺 Symptoms: ${symptoms.join(', ')}\n${urgency}\n🔍 Possible Conditions:\n`;
  top.forEach((d, i) => {
    const conf = d.score >= 3 ? 'High' : d.score >= 2 ? 'Moderate' : 'Low';
    msg += `   ${i + 1}. ${d.name} (${conf})\n`;
  });
  if (remedies.length > 0) msg += `\n💊 Home Remedies:\n${remedies.join('\n')}\n`;
  msg += '\n⚠️ DISCLAIMER: This is NOT a medical diagnosis. Always consult a qualified healthcare professional.\nType "reset" to start new consultation.';
  return msg;
}

function newRuleSession() {
  return { symptoms: [], lastQuestion: null, askedQuestions: [], done: false, currentRule: null };
}

function handleRuleBased(userId, msg, sessions) {
  if (!sessions[userId]) sessions[userId] = newRuleSession();
  const session = sessions[userId];

  if (isBye(msg)) { sessions[userId] = newRuleSession(); return 'Take care! 🌿 Wishing you good health.'; }

  if (isGreeting(msg) && session.symptoms.length === 0 && !session.lastQuestion) {
    return 'Hello 👋 I am MediCheck AI.\n\nTell me your symptoms and I\'ll help assess possible conditions.\n\nExamples: fever, cough, headache, stomach pain\n\nYou can type in English, Hindi, or Punjabi.';
  }

  if (session.done) {
    const newSymp = extractSymptoms(msg);
    if (newSymp.length > 0) {
      sessions[userId] = newRuleSession();
      const s2 = sessions[userId];
      s2.symptoms = newSymp;
      const rule = getNextFollowUp(s2);
      if (rule) { s2.askedQuestions.push(rule.key); s2.currentRule = rule; s2.lastQuestion = rule.key; return `New consultation.\n\nNoted: ${newSymp.join(', ')}.\n\n${rule.question}`; }
      s2.done = true;
      return buildDiagnosis(s2);
    }
    return 'Your consultation is complete.\n\nType "reset" to start new, or describe new symptoms.';
  }

  if (session.lastQuestion && session.currentRule) {
    if (isYes(msg) || isNo(msg)) {
      if (isYes(msg) && session.currentRule.addOnYes) { session.symptoms.push(session.currentRule.addOnYes); session.symptoms = [...new Set(session.symptoms)]; }
      if (isYes(msg) && session.currentRule.key === 'general_other') { session.lastQuestion = null; session.currentRule = null; return 'Please describe those additional symptoms.'; }
      session.lastQuestion = null; session.currentRule = null;
      const nextRule = getNextFollowUp(session);
      if (nextRule) { session.askedQuestions.push(nextRule.key); session.currentRule = nextRule; session.lastQuestion = nextRule.key; return nextRule.question; }
      session.done = true;
      return buildDiagnosis(session);
    }
    const extra = extractSymptoms(msg);
    if (extra.length > 0) {
      session.symptoms = [...new Set([...session.symptoms, ...extra])]; session.lastQuestion = null; session.currentRule = null;
      const nextRule = getNextFollowUp(session);
      if (nextRule) { session.askedQuestions.push(nextRule.key); session.currentRule = nextRule; session.lastQuestion = nextRule.key; return `Noted: ${extra.join(', ')}.\n\n${nextRule.question}`; }
      session.done = true;
      return buildDiagnosis(session);
    }
    return 'Please answer yes or no, or describe a symptom.';
  }

  const detected = extractSymptoms(msg);
  if (detected.length === 0) {
    const healthWords = ['sick','ill','pain','ache','disease','help','medical','doctor','health','symptom','feeling','hurt','unwell','bimaar'];
    if (healthWords.some(w => msg.toLowerCase().includes(w))) return 'Could you describe your specific symptoms?\n\nExamples: fever, headache, cough, stomach pain';
    return 'I specialize in health symptoms.\n\nPlease tell me what you\'re feeling.\n\nExamples: fever, headache, cough, body pain, stomach pain';
  }

  session.symptoms = [...new Set([...session.symptoms, ...detected])];
  const hasCritical = session.symptoms.some(n => { const s = medicalData.symptoms.find(x => x.english === n); return s && s.severity === 'critical'; });
  if (hasCritical) { session.done = true; return buildDiagnosis(session); }

  const rule = getNextFollowUp(session);
  if (rule) { session.askedQuestions.push(rule.key); session.currentRule = rule; session.lastQuestion = rule.key; return `Noted: ${session.symptoms.join(', ')}.\n\n${rule.question}`; }
  session.done = true;
  return buildDiagnosis(session);
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
    const { userId, message } = req.body;

    if (!message || message.trim() === '') {
      return res.json({ message: 'Please type something so I can help you.' });
    }

    const msg = message.trim();

    if (msg.toLowerCase() === 'reset' || msg.toLowerCase() === 'restart' || msg.toLowerCase() === 'start over') {
      delete aiSessions[userId];
      delete ruleSessions[userId];
      return res.json({ message: '🔄 Starting fresh!\n\nHello 👋 I am MediCheck AI — your AI-powered health symptom checker.\n\nDescribe your symptoms and I will help assess possible conditions, suggest home remedies, and tell you when to see a doctor.\n\nYou can type in English, Hindi, or Punjabi.' });
    }

    // Try Gemini AI first (if configured)
    if (geminiModel) {
      try {
        const chat = getChat(userId);
        const result = await chat.sendMessage(msg);
        const response = result.response.text();
        return res.json({ message: response });
      } catch (aiError) {
        console.log('Gemini unavailable, using fallback:', aiError.message.substring(0, 80));
        delete aiSessions[userId];
      }
    }

    // Fallback to rule-based system
    const response = handleRuleBased(userId, msg, ruleSessions);
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
