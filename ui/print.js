// Printable counsellor briefs: display only.
// Scores come from web/data.js; reasons, similar students and suggestions from web/model.js.
//   report.html                 -> one-page summary of all students
//   report.html?student=S014    -> one-page brief for a dashboard student
//   report.html?type=check      -> brief for the student entered in "Check a student"
const F = E.features;
const params = new URLSearchParams(location.search);
const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const best = E.results.find(r => r.Model === E.best);

const students = E.students.map(s => {
  const values = {};
  F.forEach((f, j) => values[f] = s.x[j]);
  return { ...s, values };
}).sort((a, b) => b.risk - a.risk);

// Each support rule -> a short issue name and the action a counsellor can plan for a group.
const ISSUES = [
  ["Fees are not up to date", "Unpaid tuition fees", "Run a fee-plan / financial-aid session"],
  ["Passed under half", "Failing semester-1 subjects", "Start a peer-tutoring group"],
  ["Semester-2 average below", "Semester-2 average below pass", "Assign academic mentors"],
  ["Student owes money", "Owes the university money", "Offer finance counselling meetings"],
  ["No scholarship and in debt", "In debt without a scholarship", "Check scholarship eligibility"],
  ["similar past students", "Profile matches past dropouts", "Schedule early check-ins"]
];
const issueOf = tip => ISSUES.find(i => tip.includes(i[0]));

function issuesFor(s) {
  return getSuggestions(s.values, similarStudents(s.values, 5)).map(issueOf).filter(Boolean);
}

function header(title, sub) {
  return `<header class="r-head"><div><a class="logo" href="index.html"><i></i>EduGuard</a><h1>${title}</h1>
    <p class="hint">${sub}</p></div>
    <div class="meta">${today}<br>EduGuard early-warning<br>Decision support only</div></header>`;
}

/* ---------- 1. one-page summary of all students ---------- */
function summaryReport() {
  const n = students.length;
  const red = students.filter(s => s.tier === "Red"), yellow = students.filter(s => s.tier === "Yellow");
  const green = students.filter(s => s.tier === "Green"), atRisk = red.concat(yellow);

  // Group the at-risk students by issue (one student can have several issues).
  const count = {};
  atRisk.forEach(s => issuesFor(s).forEach(i => count[i[1]] = (count[i[1]] || 0) + 1));
  // Only concrete issues a counsellor can act on (not the "similar students" note).
  const top = ISSUES.slice(0, 5).filter(i => count[i[1]]).sort((a, b) => count[b[1]] - count[a[1]]).slice(0, 4);

  // How at-risk students differ from on-track students (simple averages).
  const avg = (list, f) => list.reduce((a, s) => a + s.values[f], 0) / list.length;
  const compare = [
    ["Semester-1 subjects passed (avg)", avg(atRisk, "Curricular units 1st sem (approved)").toFixed(1), avg(green, "Curricular units 1st sem (approved)").toFixed(1)],
    ["Semester-2 average grade (/20)", avg(atRisk, "Curricular units 2nd sem (grade)").toFixed(1), avg(green, "Curricular units 2nd sem (grade)").toFixed(1)],
    ["Fees paid on time", pct(avg(atRisk, "Tuition fees up to date"), 0), pct(avg(green, "Tuition fees up to date"), 0)],
    ["Has a scholarship", pct(avg(atRisk, "Scholarship holder"), 0), pct(avg(green, "Scholarship holder"), 0)]
  ];

  const first = top[0];
  const priority = red.slice(0, 8).map(s => {
    const iss = issuesFor(s).filter(i => i[1] !== "Profile matches past dropouts");
    return `<tr><td><b>${s.id}</b></td><td>${pct(s.risk, 0)}</td><td>${iss.length ? iss.slice(0, 2).map(i => i[1]).join(", ") : "Profile matches past dropouts"}</td><td class="c"><span class="box"></span></td></tr>`;
  }).join("");

  return header("Counsellor summary", `Brief for the student support team · ${n} students screened`) +
    `<p class="r-summary"><b>${red.length} students (${pct(red.length / n, 0)}) need action now</b> and ${yellow.length} more should be monitored.
      The most common issue is <b>${first[1].toLowerCase()}</b> (${count[first[1]]} at-risk students).</p>

    <div class="tierbar">
      <i style="flex:${red.length};background:var(--accent)"></i><i style="flex:${yellow.length};background:var(--mid)"></i><i style="flex:${green.length};background:var(--ok)"></i></div>
    <div class="tierkey"><span><b style="color:var(--accent)">${red.length}</b> Red · act now</span>
      <span><b style="color:var(--mid)">${yellow.length}</b> Yellow · monitor</span>
      <span><b style="color:var(--ok)">${green.length}</b> Green · on track</span></div>

    <section class="r-sec"><h2>Main issues and what to do</h2>
      <div class="issues">${top.map(i => `<div><b>${count[i[1]]}</b><span>${i[1]}</span><p>→ ${i[2]}</p></div>`).join("")}</div></section>

    <section class="r-sec two">
      <div><h2>Contact first</h2><p class="lead-r">The 8 highest-risk students. Full list in the dashboard.</p>
        <table class="r-table"><tr><th>Student</th><th>Risk</th><th>Main issue</th><th>Done</th></tr>${priority}</table></div>
      <div><h2>How at-risk students differ</h2><p class="lead-r">Red + Yellow students compared with Green students.</p>
        <table class="r-table"><tr><th></th><th>At risk</th><th>On track</th></tr>
        ${compare.map(c => `<tr><td>${c[0]}</td><td><b>${c[1]}</b></td><td>${c[2]}</td></tr>`).join("")}</table></div>
    </section>

    <section class="r-sec"><h2>Recommended next steps</h2><ol class="steps-r">
      <li>Contact the ${red.length} Red students this week, starting with the list above.</li>
      <li>${top[0][2]} and ${top[1] ? top[1][2].toLowerCase() : "review progress"}: together these cover most at-risk students.</li>
      <li>Re-check the ${yellow.length} Yellow students after the next assessment.</li></ol></section>

    <div class="r-note">Risk = estimated dropout probability (Green &lt; 33%, Yellow 33–66%, Red &gt; 66%).
      In testing it flagged ${pct(best.Recall, 0)} of students who later dropped out, but it can be wrong. Use it to decide who to talk to, never to penalise a student.</div>`;
}

/* ---------- 2. one-page brief for one student ---------- */
function studentReport(id, values, risk, tier) {
  const res = predictRisk(values), near = similarStudents(values, 5), tips = getSuggestions(values, near);
  const k = near.reduce((a, b) => a + b, 0);
  const asked = ["Tuition fees up to date", "Debtor", "Scholarship holder", "Age at enrollment", "Admission grade",
    "Curricular units 1st sem (approved)", "Curricular units 1st sem (grade)", "Curricular units 2nd sem (approved)", "Curricular units 2nd sem (grade)"];
  const reasons = res.contributions.filter(c => asked.includes(c[0])).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3);
  const word = { Red: "high", Yellow: "medium", Green: "low" }[tier];
  const v = values;

  return header(`Student brief · ${id}`, "One page for a counselling meeting") +
    `<p class="r-summary">${id === "New student" ? "This student" : id} has a <b style="color:${TIER[tier].color}">${word} risk (${pct(risk, 0)})</b> of dropping out.
      ${tier === "Green" ? "No urgent action is needed." : `Suggested first step: <b>${tips[0].split(": ")[1] || tips[0]}</b>`}</p>

    <div class="facts">
      <div><span>Semester 1</span><b>${v["Curricular units 1st sem (approved)"]} / ${v["Curricular units 1st sem (enrolled)"]}</b><small>subjects passed</small></div>
      <div><span>Semester 2</span><b>${v["Curricular units 2nd sem (approved)"]} / ${v["Curricular units 2nd sem (enrolled)"]}</b><small>subjects passed</small></div>
      <div><span>Fees</span><b>${v["Tuition fees up to date"] ? "Paid" : "Not paid"}</b><small>${v["Debtor"] ? "owes money" : "no debt"}</small></div>
      <div><span>Similar students</span><b>${k} / 5</b><small>dropped out</small></div></div>

    <section class="r-sec two">
      <div><h2>Why this score</h2><ul class="why-r">${reasons.map(([f, c]) =>
        `<li><span class="${c > 0 ? "up" : "down"}">${c > 0 ? "▲" : "▼"}</span>${nice(f)}: <b>${showValue(f, v[f])}</b> ${c > 0 ? "raises" : "lowers"} the risk</li>`).join("")}</ul></div>
      <div><h2>Suggested support</h2>${tips.map(t => `<div class="r-tip">${t}</div>`).join("")}</div>
    </section>

    <section class="r-sec"><h2>Meeting notes</h2><div class="lines">${"<div></div>".repeat(4)}</div>
      <div class="sign"><div>Counsellor</div><div>Date</div><div>Follow-up date</div></div></section>

    <div class="r-note">Decision support only. The score is an estimate and can be wrong; adapt the suggestions to the student.</div>`;
}

/* ---------- choose which brief to show ---------- */
let html;
if (params.get("student")) {
  const s = students.find(x => x.id === params.get("student"));
  html = s ? studentReport(s.id, s.values, s.risk, s.tier) : "<p>Student not found.</p>";
  $("toolTitle").textContent = `Student brief · ${params.get("student")}`;
} else if (params.get("type") === "check") {
  let st = null;
  try { st = JSON.parse(sessionStorage.getItem("eduguardCheck")); } catch (e) { st = null; }
  if (st) { const p = predictRisk(st).probability; html = studentReport("New student", st, p, riskTier(p)); }
  else html = "<p>No checked student found. Run a check first on the Check a student page.</p>";
  $("toolTitle").textContent = "Student brief · from Check a student";
  $("back").href = "checker.html";
} else {
  html = summaryReport();
  $("toolTitle").textContent = "Counsellor summary (1 page)";
}
$("sheet").innerHTML = html;
$("savePdf").addEventListener("click", () => window.print());
