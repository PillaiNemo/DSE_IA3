// Check a student: design / interaction code only.
// Calculations come from web/model.js: predictRisk(), riskTier(), similarStudents(),
// getSuggestions(), backgroundGroup(), backgroundSupport(), whatIf().

// The input steps. Field: [feature, label, hint, type, options]
//   "num"    - a number that goes into the risk score
//   "choice" - a yes/no style answer that goes into the risk score (value = option index)
//   "group"  - a family / background category. These columns are category codes, not amounts,
//              so they are compared with past students in the same group instead of being scored.
const STEPS = [
  { name: "Student", title: "About the student", desc: "Background when the student joined.", short: "Age, admission, scholarship", fields: [
    ["Age at enrollment", "Age when they joined", "In years", "num", { min: 17, max: 70, step: 1 }],
    ["Gender", "Gender", "", "choice", ["Female", "Male"]],
    ["Admission grade", "Admission grade", "Entry score out of 200 (average about 127)", "num", { min: 95, max: 190, step: 0.5 }],
    ["Scholarship holder", "Has a scholarship?", "", "choice", ["No", "Yes"]]] },
  { name: "Education", title: "Education history", desc: "What the student studied before, and how they joined this course.", short: "Previous study, course, entry", fields: [
    ["Previous qualification", "Highest qualification before joining", "", "group"],
    ["Previous qualification (grade)", "Grade in that qualification", "Out of 200 (average about 133)", "num", { min: 95, max: 190, step: 0.5 }],
    ["Course", "Course enrolled in", "", "group"],
    ["Application mode", "How they were admitted", "", "group"],
    ["Daytime/evening attendance", "Classes attended", "", "choice", ["Evening", "Daytime"]]] },
  { name: "Family", title: "Family and personal", desc: "Family background and personal situation. Category answers are compared with past students from the same group (shown in the result).", short: "Parents, marital status, home", fields: [
    ["Mother's qualification", "Mother's education", "", "group"],
    ["Father's qualification", "Father's education", "", "group"],
    ["Mother's occupation", "Mother's job", "", "group"],
    ["Father's occupation", "Father's job", "", "group"],
    ["Marital status", "Marital status", "", "group"],
    ["Nacionality", "Nationality", "", "group"],
    ["Displaced", "Lives away from family home?", "", "choice", ["No", "Yes"]],
    ["Educational special needs", "Special educational needs?", "", "choice", ["No", "Yes"]]] },
  { name: "Fees", title: "Fees and money", desc: "The student's financial situation.", short: "Tuition and debts", fields: [
    ["Tuition fees up to date", "Tuition fees paid on time?", "", "choice", ["No", "Yes"]],
    ["Debtor", "Owes the university money?", "", "choice", ["No", "Yes"]]] },
  { name: "Semester 1", title: "Semester 1 results", desc: "Subjects taken and passed in the first semester.", short: "Subjects and grades", fields: [
    ["Curricular units 1st sem (enrolled)", "Subjects enrolled", "Usually 6", "num", { min: 0, max: 26, step: 1 }],
    ["Curricular units 1st sem (approved)", "Subjects passed", "Cannot be more than enrolled", "num", { min: 0, max: 26, step: 1 }],
    ["Curricular units 1st sem (grade)", "Average grade", "Out of 20 (10 is a pass)", "num", { min: 0, max: 20, step: 0.1 }]] },
  { name: "Semester 2", title: "Semester 2 results", desc: "Same as semester 1, for the second semester.", short: "Subjects and grades", fields: [
    ["Curricular units 2nd sem (enrolled)", "Subjects enrolled", "Usually 6", "num", { min: 0, max: 23, step: 1 }],
    ["Curricular units 2nd sem (approved)", "Subjects passed", "Cannot be more than enrolled", "num", { min: 0, max: 20, step: 1 }],
    ["Curricular units 2nd sem (grade)", "Average grade", "Out of 20 (10 is a pass)", "num", { min: 0, max: 20, step: 0.1 }]] }
];
const N = STEPS.length;                      // index N = the result
const FIELDS = STEPS.flatMap(s => s.fields);
const FIELD = Object.fromEntries(FIELDS.map(f => [f[0], f]));
const ASKED = FIELDS.filter(f => f[3] !== "group").map(f => f[0]);   // answers used in the risk score
const GROUPS = FIELDS.filter(f => f[3] === "group").map(f => f[0]);  // answers compared with past students
const MEANS = A.data.background.means_by_outcome;

// Start from the median training student; features not asked stay at the median.
// Group answers start at the group that contains the median student's code.
let state, groupOf, current = 0, lastP = null;
function reset() {
  state = { ...E.defaults };
  ASKED.forEach(f => { if (FIELD[f][3] === "choice") state[f] = Math.round(state[f]); });
  groupOf = Object.fromEntries(GROUPS.map(f => [f, BG[f].groups.indexOf(backgroundGroup(f, E.defaults[f]))]));
}
reset();
const groupLabels = () => Object.fromEntries(GROUPS.map(f => [f, BG[f].groups[groupOf[f]].label]));

function show(f, v) {
  const def = FIELD[f];
  return def[3] === "choice" ? def[4][v] : (+v).toFixed(def[4].step < 1 ? 1 : 0);
}

function drawRail() {
  const items = STEPS.map(s => [s.name, s.short]).concat([["Result", "Risk, reasons, charts"]]);
  $("rail").innerHTML = `<span class="count">${current < N ? `Step ${current + 1} of ${N}` : "Done"}</span>` +
    `<div class="bar"><i style="width:${Math.min(current, N) / N * 100}%"></i></div><ol>` +
    items.map(([name, d], i) => `<li class="${i < current ? "done" : i === current ? "now" : ""}"><button type="button" data-go="${i}">` +
      `<span class="n">${i < current ? "✓" : i + 1}</span><span><span class="t">${name}</span><span class="d">${d}</span></span></button></li>`).join("") +
    `</ol><p class="foot-note">Answers start at a typical student. Change only what you know.</p>`;
}

function control([f, label, , type, opt]) {
  if (type === "group") {
    const gs = BG[f].groups.map((g, i) => [g.label, i]);
    if (gs.length <= 2) return `<div class="choice">${gs.map(([l, i]) =>
      `<button type="button" data-g="${f}" data-v="${i}" class="${groupOf[f] === i ? "on" : ""}">${l}</button>`).join("")}</div>`;
    if (f === "Course") gs.sort((a, b) => a[0].localeCompare(b[0]));
    return `<select class="sel" data-g="${f}" aria-label="${label}">${gs.map(([l, i]) =>
      `<option value="${i}" ${groupOf[f] === i ? "selected" : ""}>${l}</option>`).join("")}</select>`;
  }
  if (type === "choice") return `<div class="choice">${opt.map((o, i) =>
    `<button type="button" data-f="${f}" data-v="${i}" class="${state[f] === i ? "on" : ""}">${o}</button>`).join("")}</div>`;
  return `<div class="num"><button type="button" data-f="${f}" data-d="-1" aria-label="decrease">−</button>` +
    `<input type="number" data-f="${f}" min="${opt.min}" max="${opt.max}" step="${opt.step}" value="${show(f, state[f])}" aria-label="${label}">` +
    `<button type="button" data-f="${f}" data-d="1" aria-label="increase">+</button></div>`;
}

function drawStep() {
  const s = STEPS[current];
  $("form").innerHTML = `<h2>${s.title}</h2><p>${s.desc}</p><div class="fields">` +
    s.fields.map(def => `<div class="field"><label>${def[1]}${def[2] ? `<small>${def[2]}</small>` : ""}</label>${control(def)}</div>`).join("") +
    `</div><p class="warn" id="warn"></p><div class="nav-btns">` +
    (current > 0 ? `<button type="button" class="btn ghost" data-go="${current - 1}">← Back</button>` : "<span></span>") +
    (current < N - 1 ? `<button type="button" class="btn solid" data-go="${current + 1}">Next: ${STEPS[current + 1].name} <span class="arr">→</span></button>`
      : `<button type="button" class="btn solid" data-go="${N}">Check risk <span class="arr">→</span></button>`) + `</div>`;
  checkWarn();
}

function checkWarn() {
  if (!$("warn")) return;
  const bad = ["1st", "2nd"].filter(k => state[`Curricular units ${k} sem (approved)`] > state[`Curricular units ${k} sem (enrolled)`]);
  $("warn").textContent = bad.length ? `Check: subjects passed is more than subjects enrolled (${bad.join(" & ")} semester).` : "";
}

const tierColour = p => p > .66 ? ACC : p >= .33 ? "#c98a12" : OK;

function drawCharts(res, p) {
  // 1. What moved the risk (only answers that go into the score).
  contribChart($("cContrib"), res.contributions, state, ASKED, 8);

  // 2. What would lower the risk: one change at a time, everything else the same.
  const what = whatIf(state);
  $("whatTxt").textContent = what.length ? `Biggest single change: ${what[0].label.toLowerCase()} → ${pct(what[0].p, 0)}.`
    : "No obvious single change: this student already looks strong on these factors.";
  makeChart($("cWhat"), { type: "bar",
    data: { labels: ["Now"].concat(what.map(w => w.label)),
      datasets: [{ data: [p].concat(what.map(w => w.p)), backgroundColor: [p].concat(what.map(w => w.p)).map(tierColour), borderRadius: 6 }] },
    options: { indexAxis: "y", maintainAspectRatio: false, plugins: { legend: { display: false },
        tooltip: { callbacks: { label: c => `${pct(c.raw, 0)} risk` } } },
      scales: { x: pctAxis, y: { grid: { display: false }, ticks: { font: { size: 11 } } } } } });

  // 3. This student vs the average student who stayed / dropped out.
  const keys = ["Curricular units 1st sem (approved)", "Curricular units 2nd sem (approved)",
    "Curricular units 1st sem (grade)", "Curricular units 2nd sem (grade)"];
  makeChart($("cCompare"), { type: "bar",
    data: { labels: ["Sem 1 passed", "Sem 2 passed", "Sem 1 grade", "Sem 2 grade"], datasets: [
      { label: "This student", data: keys.map(k => state[k]), backgroundColor: INK, borderRadius: 5 },
      { label: "Average who stayed", data: keys.map(k => MEANS.stayed[k]), backgroundColor: LIME, borderRadius: 5 },
      { label: "Average who dropped out", data: keys.map(k => MEANS.dropped[k]), backgroundColor: ACC, borderRadius: 5 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 10 } } },
      scales: { y: { beginAtZero: true, grid: { color: LINE } }, x: { grid: { display: false } } } } });

  // 4. Past students with the same background (group dropout rates from analysis_data.py).
  const rows = GROUPS.map(f => [BG_TITLE[f], BG[f].groups[groupOf[f]]])
    .concat([["Age group", ageGroup(state["Age at enrollment"])]],
      ["Daytime/evening attendance", "Displaced"].map(f => [BG_TITLE[f], backgroundGroup(f, state[f])]));
  backgroundChart($("cBg"), rows);
  const high = rows.filter(r => r[1].rate > OVERALL + .05);
  $("bgTxt").textContent = high.length
    ? `Higher-than-average dropout in past records for: ${high.map(r => r[0].toLowerCase()).join(", ")}.`
    : "None of this student's background groups had clearly higher dropout than average.";
}

function drawResult() {
  const res = predictRisk(state), p = res.probability, tier = riskTier(p);
  const near = similarStudents(state, 5), tips = getSuggestions(state, near);
  const bgTips = backgroundSupport(groupLabels(), state["Age at enrollment"]);
  const pc = Math.round(p * 100), t = TIER[tier];

  $("big").textContent = pc + "%"; $("big").style.color = t.color;
  $("tier").innerHTML = tierPill(tier);
  $("sentence").textContent = tier === "Red" ? "High risk: this student needs counselling support now."
    : tier === "Yellow" ? "Medium risk: some warning signs. Monitor and check in regularly."
    : "Low risk: this student looks on track.";
  $("dot").style.left = "0%";
  requestAnimationFrame(() => requestAnimationFrame(() => $("dot").style.left = p * 100 + "%"));
  $("compare").innerHTML = lastP === null ? "" : `Previous check: <b>${lastP}%</b> → now <b>${pc}%</b>`;
  lastP = pc;

  $("reasons").innerHTML = reasonList(res.contributions, state, 4, ASKED);
  $("neigh").innerHTML = neighbourDots(near);
  $("neighTxt").textContent = `${near.reduce((a, b) => a + b, 0)} of the 5 most similar past students dropped out.`;
  $("tips").innerHTML = tips.map(x => `<div class="tip">${x}</div>`).join("") +
    (bgTips.length ? `<p class="tips-sub">Because of their background</p>` + bgTips.map(x => `<div class="tip bg">${x}</div>`).join("") : "");

  const best = E.results.find(r => r.Model === E.best);
  $("how").innerHTML = [
    "Each number and yes/no answer is compared with a typical past student.",
    "Each difference is weighted by how strongly it was linked to dropping out among past students, and the weights are added up.",
    `The total is turned into a percentage between 0 and 100. For this student: ${pc}%.`,
    `Green is below 33%, Yellow 33–66%, Red above 66%. In testing, EduGuard flagged ${pct(best.Recall, 0)} of students who later dropped out.`,
    "Family and background categories (parents' education and jobs, course, entry route, nationality, marital status) are stored as codes, not amounts, so they are not added to the score. Instead the chart shows how past students from the same groups did.",
    "The 5 past students with the most similar records are found, to show what happened to students like this one.",
    "Suggested support follows simple written guidelines, for example: unpaid fees → financial-aid office."
  ].map(r => `<li>${r}</li>`).join("");

  if (window.Chart) requestAnimationFrame(() => drawCharts(res, p));
}

function go(i) {
  current = i;
  drawRail();
  $("wizard").hidden = i === N; $("result").hidden = i !== N;
  if (i === N) drawResult(); else drawStep();
  if (window.lenis) lenis.scrollTo(0); else window.scrollTo({ top: 0, behavior: "smooth" });
}

function setValue(f, v) {
  const def = FIELD[f];
  if (def[3] === "num") v = Math.min(def[4].max, Math.max(def[4].min, Math.round(v / def[4].step) * def[4].step));
  state[f] = +(+v).toFixed(2);
  checkWarn();
}

document.addEventListener("click", e => {
  const b = e.target.closest("[data-go],[data-v],[data-d]"); if (!b) return;
  if (b.dataset.go !== undefined) return go(+b.dataset.go);
  if (b.dataset.g) {
    groupOf[b.dataset.g] = +b.dataset.v;
    b.parentElement.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
    return;
  }
  const f = b.dataset.f;
  if (b.dataset.v !== undefined) {
    setValue(f, +b.dataset.v);
    b.parentElement.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
  } else {
    setValue(f, state[f] + (+b.dataset.d) * FIELD[f][4].step);
    b.parentElement.querySelector("input").value = show(f, state[f]);
  }
});
$("form").addEventListener("change", e => {
  if (e.target.dataset.g) { groupOf[e.target.dataset.g] = +e.target.value; return; }
  const f = e.target.dataset.f;
  if (f) { setValue(f, +e.target.value || 0); e.target.value = show(f, state[f]); }
});
$("form").addEventListener("submit", e => e.preventDefault());
$("edit").addEventListener("click", () => go(0));
// Hand the entered student (and their background groups) to the printable report page.
$("pdf").addEventListener("click", () => {
  try {
    sessionStorage.setItem("eduguardCheck", JSON.stringify(state));
    sessionStorage.setItem("eduguardCheckGroups", JSON.stringify(groupLabels()));
  } catch (e) { /* storage blocked */ }
  location.href = "report.html?type=check";
});
$("again").addEventListener("click", () => { reset(); lastP = null; go(0); });

go(0);
// Example result for demonstrations: checker.html#example (typical student whose fees are unpaid).
if (location.hash === "#example") { state["Tuition fees up to date"] = 0; go(N); }
