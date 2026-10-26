// =====================================================================
// model.js - the calculation logic used by the website. NO design code.
//
// Uses the numbers that src/export_web.py saved from the trained model:
//   1. predictRisk()     - Logistic Regression dropout probability
//   2. riskTier()        - Red / Yellow / Green tier
//   3. similarStudents() - 5 most similar past students (cosine similarity)
//   4. getSuggestions()  - support rules (same as src/recommender.py)
// The results match Python's predict_proba() exactly.
// =====================================================================

const MODEL = window.EDU;                 // loaded from web/data.js
const FEATURES = MODEL.features;          // 36 feature names, in training order
const MEAN = MODEL.lr.mean;               // StandardScaler mean of each feature
const SCALE = MODEL.lr.scale;             // StandardScaler std of each feature
const COEF = MODEL.lr.coef;               // Logistic Regression weights
const INTERCEPT = MODEL.lr.intercept;     // Logistic Regression bias


// Step 1: standard scaling, exactly like sklearn's StandardScaler.
function scaleRow(values) {
  const z = [];
  for (let i = 0; i < values.length; i++) {
    z.push((values[i] - MEAN[i]) / SCALE[i]);
  }
  return z;
}

// Step 2: sigmoid turns any number into a probability between 0 and 1.
function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

// Step 3: Logistic Regression.
// logit = intercept + sum(weight x scaled value); probability = sigmoid(logit).
// "weight x scaled value" is each input's contribution (+ raises, - lowers risk).
function predictRisk(student) {
  const z = scaleRow(FEATURES.map(name => student[name]));
  let logit = INTERCEPT;
  const contributions = [];
  for (let i = 0; i < z.length; i++) {
    const c = COEF[i] * z[i];
    logit += c;
    contributions.push([FEATURES[i], c]);
  }
  return { probability: sigmoid(logit), logit: logit, contributions: contributions };
}

// Risk tiers: Green < 0.33 <= Yellow <= 0.66 < Red.
function riskTier(p) {
  if (p > 0.66) return "Red";
  if (p >= 0.33) return "Yellow";
  return "Green";
}


// ---------- Recommender (syllabus Module 5) ----------

// Scale all past (training) students once and store each vector's length.
const PAST = MODEL.train_X.map(scaleRow);
const PAST_LEN = PAST.map(v => Math.hypot(...v));

// Cosine similarity = (a . b) / (|a| x |b|). 1 means "points the same way".
function cosineSimilarity(a, aLen, b, bLen) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot / (aLen * bLen || 1);
}

// Outcomes (1 = dropped out, 0 = stayed) of the k most similar past students.
function similarStudents(student, k = 5) {
  const z = scaleRow(FEATURES.map(name => student[name]));
  const zLen = Math.hypot(...z);
  const scored = PAST.map((v, i) => [cosineSimilarity(z, zLen, v, PAST_LEN[i]), i]);
  scored.sort((a, b) => b[0] - a[0]);
  return scored.slice(0, k).map(pair => MODEL.train_y[pair[1]]);
}

// Support rules - the same as src/recommender.py.
// These rules are our own documented assumptions, NOT learned from data.
function getSuggestions(s, neighbourOutcomes) {
  const tips = [];
  const dropped = neighbourOutcomes.reduce((a, b) => a + b, 0);
  const passRate = s["Curricular units 1st sem (approved)"] /
    Math.max(s["Curricular units 1st sem (enrolled)"], 1);

  if (dropped / neighbourOutcomes.length >= 0.6)
    tips.push(`${dropped} of ${neighbourOutcomes.length} similar past students dropped out: schedule a check-in this week.`);
  if (s["Tuition fees up to date"] === 0)
    tips.push("Fees are not up to date: refer to the financial-aid office.");
  if (s["Debtor"] === 1)
    tips.push("Student owes money: book a counselling meeting about finances.");
  if (passRate < 0.5)
    tips.push("Passed under half of semester-1 subjects: arrange peer tutoring.");
  if (s["Curricular units 2nd sem (grade)"] < 10)
    tips.push("Semester-2 average below 10/20: assign an academic mentor.");
  if (s["Scholarship holder"] === 0 && s["Debtor"] === 1)
    tips.push("No scholarship and in debt: check scholarship eligibility.");
  if (tips.length === 0)
    tips.push("No warning signs: continue regular mentor check-ins.");
  return tips.slice(0, 3);
}
