// Check a student: design / interaction code only.
// Calculations come from web/model.js: predictRisk(), riskTier(),
// similarStudents(), getSuggestions().

// The 4 input steps. Field: [feature, label, hint, "num" | "choice", options]
const STEPS = [
  { name: "Student", title: "About the student", desc: "Background when the student joined.", short: "Age, admission, scholarship", fields: [
    ["Age at enrollment", "Age when they joined", "In years", "num", { min: 17, max: 70, step: 1 }],
    ["Gender", "Gender", "", "choice", ["Female", "Male"]],
    ["Admission grade", "Admission grade", "Entry score out of 200 (average about 127)", "num", { min: 95, max: 190, step: 0.5 }],
    ["Scholarship holder", "Has a scholarship?", "", "choice", ["No", "Yes"]]] },
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
const FIELDS = STEPS.flatMap(s => s.fields);
const FIELD = Object.fromEntries(FIELDS.map(f => [f[0], f]));
const ASKED = FIELDS.map(f => f[0]);

// Start from the median training student; the other 24 features stay at the median.
let state = { ...E.defaults }, current = 0, lastP = null;
ASKED.forEach(f => { if (FIELD[f][3] === "choice") state[f] = Math.round(state[f]); });

function show(f, v) {
  const def = FIELD[f];
  return def[3] === "choice" ? def[4][v] : (+v).toFixed(def[4].step < 1 ? 1 : 0);
}

function drawRail() {
  const items = STEPS.map(s => [s.name, s.short]).concat([["Result", "Risk, reasons, next step"]]);
  $("rail").innerHTML = `<span class="count">${current < 4 ? `Step ${current + 1} of 4` : "Done"}</span>` +
    `<div class="bar"><i style="width:${Math.min(current, 4) / 4 * 100}%"></i></div><ol>` +
    items.map(([name, d], i) => `<li class="${i < current ? "done" : i === current ? "now" : ""}"><button type="button" data-go="${i}">` +
      `<span class="n">${i < current ? "✓" : i + 1}</span><span><span class="t">${name}</span><span class="d">${d}</span></span></button></li>`).join("") +
    `</ol><p class="foot-note">Answers start at a typical student. Change only what you know.</p>`;
}

function drawStep() {
  const s = STEPS[current];
  $("form").innerHTML = `<h2>${s.title}</h2><p>${s.desc}</p><div class="fields">` +
    s.fields.map(([f, label, hint, type, opt]) => {
      const ctl = type === "choice"
        ? `<div class="choice">${opt.map((o, i) => `<button type="button" data-f="${f}" data-v="${i}" class="${state[f] === i ? "on" : ""}">${o}</button>`).join("")}</div>`
        : `<div class="num"><button type="button" data-f="${f}" data-d="-1" aria-label="decrease">−</button>` +
          `<input type="number" data-f="${f}" min="${opt.min}" max="${opt.max}" step="${opt.step}" value="${show(f, state[f])}" aria-label="${label}">` +
          `<button type="button" data-f="${f}" data-d="1" aria-label="increase">+</button></div>`;
      return `<div class="field"><label>${label}${hint ? `<small>${hint}</small>` : ""}</label>${ctl}</div>`;
    }).join("") + `</div>` +
    `<p class="warn" id="warn"></p><div class="nav-btns">` +
    (current > 0 ? `<button type="button" class="btn ghost" data-go="${current - 1}">← Back</button>` : "<span></span>") +
    (current < 3 ? `<button type="button" class="btn solid" data-go="${current + 1}">Next: ${STEPS[current + 1].name} <span class="arr">→</span></button>`
      : `<button type="button" class="btn solid" data-go="4">Check risk <span class="arr">→</span></button>`) + `</div>`;
  checkWarn();
}

function checkWarn() {
  if (!$("warn")) return;
  const bad = ["1st", "2nd"].filter(k => state[`Curricular units ${k} sem (approved)`] > state[`Curricular units ${k} sem (enrolled)`]);
  $("warn").textContent = bad.length ? `Check: subjects passed is more than subjects enrolled (${bad.join(" & ")} semester).` : "";
}

function drawResult() {
  const res = predictRisk(state), p = res.probability, tier = riskTier(p);
  const near = similarStudents(state, 5), tips = getSuggestions(state, near);
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
  $("tips").innerHTML = tips.map(x => `<div class="tip">${x}</div>`).join("");

  const best = E.results.find(r => r.Model === E.best);
  $("how").innerHTML = [
    "Each detail is compared with a typical past student.",
    "Each difference is weighted by how strongly it was linked to dropping out among past students, and the weights are added up.",
    `The total is turned into a percentage between 0 and 100. For this student: ${pc}%.`,
    `Green is below 33%, Yellow 33–66%, Red above 66%. In testing, EduGuard flagged ${pct(best.Recall, 0)} of students who later dropped out.`,
    "The 5 past students with the most similar records are found, to show what happened to students like this one.",
    "Suggested support follows simple written guidelines, for example: unpaid fees → financial-aid office."
  ].map(r => `<li>${r}</li>`).join("");
}

function go(i) {
  current = i;
  drawRail();
  $("wizard").hidden = i === 4; $("result").hidden = i !== 4;
  if (i === 4) drawResult(); else drawStep();
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
  const f = e.target.dataset.f;
  if (f) { setValue(f, +e.target.value || 0); e.target.value = show(f, state[f]); }
});
$("form").addEventListener("submit", e => e.preventDefault());
$("edit").addEventListener("click", () => go(0));
// Hand the entered student to the printable report page.
$("pdf").addEventListener("click", () => {
  try { sessionStorage.setItem("eduguardCheck", JSON.stringify(state)); } catch (e) { /* storage blocked */ }
  location.href = "report.html?type=check";
});
$("again").addEventListener("click", () => {
  state = { ...E.defaults }; ASKED.forEach(f => { if (FIELD[f][3] === "choice") state[f] = Math.round(state[f]); });
  lastP = null; go(0);
});

go(0);
// Example result for demonstrations: checker.html#example (typical student whose fees are unpaid).
if (location.hash === "#example") { state["Tuition fees up to date"] = 0; go(4); }
