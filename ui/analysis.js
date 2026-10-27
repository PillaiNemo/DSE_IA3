// Insights page: display only. Numbers come from web/data.js (analysis_data.py).
const D = A.data, ex = D.explore, t = ex.targets;

/* ---------- at a glance ---------- */
$("glance").innerHTML = `Of <b>${ex.rows.toLocaleString()}</b> past students, <b>${t.Graduate.toLocaleString()}</b> graduated, ` +
  `<b>${t.Enrolled.toLocaleString()}</b> were still studying and <b>${t.Dropout.toLocaleString()}</b> dropped out.`;
$("donutPct").textContent = pct(ex.dropout_rate, 0);
new Chart($("cDonut"), { type: "doughnut",
  data: { labels: ["Graduated", "Still studying", "Dropped out"], datasets: [{ data: [t.Graduate, t.Enrolled, t.Dropout],
    backgroundColor: ["#d6ef5a", "rgba(255,255,255,.28)", "#f08a74"], borderWidth: 0, hoverOffset: 6 }] },
  options: { maintainAspectRatio: false, cutout: "72%", plugins: { legend: { position: "bottom", labels: { color: "#e5ead6", boxWidth: 10, padding: 14 } } } } });

/* ---------- warning-sign tiles: two groups side by side ---------- */
function signal(title, obj, bad) {
  const rows = Object.entries(obj);
  const worst = rows.reduce((a, b) => b[1] > a[1] ? b : a);
  return `<div class="signal" data-reveal><h3>${title}</h3>
    <div class="big-x">${pct(worst[1], 0)} <small>dropout · ${worst[0].toLowerCase()}</small></div>
    <div class="vs">${rows.map(([k, v]) => `<div class="r"><span>${k}</span><div class="t"><i class="${k === bad ? "hot" : ""}" style="transform:scaleX(0)" data-w="${v}"></i></div><b>${pct(v, 0)}</b></div>`).join("")}</div></div>`;
}
$("signals").innerHTML = signal("Tuition fees", ex.by_fees, "Not paid") + signal("Owes money", ex.by_debtor, "Yes") +
  signal("Scholarship", ex.by_scholarship, "No") + signal("Gender", ex.by_gender, "");

/* ---------- family and background (analysis_data.py: background()) ---------- */
const BGD = D.background, AVG = ex.dropout_rate;
const BG_NAME = { "Previous qualification": "Previous qualification", "Mother's qualification": "Mother's education",
  "Father's qualification": "Father's education", "Mother's occupation": "Mother's job", "Father's occupation": "Father's job",
  "Marital status": "Marital status", "Nacionality": "Nationality", "Application mode": "How they were admitted",
  "Daytime/evening attendance": "Day or evening classes", "Displaced": "Lives away from home",
  "Educational special needs": "Special educational needs", "Age at enrollment": "Age when they joined", "Course": "Course" };
$("bgAvg").textContent = pct(AVG, 0);
function bgSignal(col) {
  const gs = BGD[col].groups.filter(g => g.n >= 20);
  return `<div class="signal" data-reveal><h3>${BG_NAME[col]}</h3><div class="vs wide">${gs.map(g =>
    `<div class="r"><span>${g.label}<small>${g.n.toLocaleString()} students</small></span>
      <div class="t"><i class="${g.rate > AVG + .05 ? "hot" : ""}" style="transform:scaleX(0)" data-w="${g.rate}"></i></div><b>${pct(g.rate, 0)}</b></div>`).join("")}</div></div>`;
}
$("bgSignals").innerHTML = ["Previous qualification", "Application mode", "Age at enrollment", "Mother's qualification",
  "Father's occupation", "Marital status", "Daytime/evening attendance", "Displaced"].map(bgSignal).join("");

// Three headline facts, taken straight from the group rates.
const rateOf = (col, label) => BGD[col].groups.find(g => g.label === label).rate;
$("bgKpis").innerHTML = [
  [`${pct(rateOf("Mother's occupation", "Other or not known"), 0)}`, "dropout when a parent's job is missing or unknown in the record, more than double the average."],
  [`${pct(rateOf("Application mode", "Mature entry (over 23)"), 0)}`, `dropout for mature-entry students (over 23), vs ${pct(rateOf("Application mode", "First admission round"), 0)} for first-round admissions.`],
  [`${pct(rateOf("Previous qualification", "Did not finish 12th"), 0)}`, `dropout for students who did not finish 12th, vs ${pct(rateOf("Previous qualification", "Finished 12th"), 0)} for those who did.`]
].map(([b, s]) => `<div data-reveal><b>${b}</b><span>${s}</span></div>`).join("");

// Chi-square table, strongest link first.
const tests = Object.entries(BGD).filter(([, v]) => v.test).sort((a, b) => b[1].test.cramers_v - a[1].test.cramers_v);
$("bgTests").innerHTML = `<tr><th>Factor</th><th>χ²</th><th>p</th><th>V</th><th>Real?</th></tr>` +
  tests.map(([col, v]) => `<tr><td>${BG_NAME[col]}</td><td>${v.test.chi2}</td><td class="nw">${v.test.p}</td><td>${v.test.cramers_v}</td>
    <td class="${v.test.significant ? "yes" : "no"}">${v.test.significant ? "Yes" : "No"}</td></tr>`).join("");

/* ---------- profiles ---------- */
const COL = ["var(--ok)", "var(--mid)", "var(--accent)"];
const prof = D.clusters.profile;           // sorted from lowest to highest dropout
const total = prof.reduce((a, c) => a + c.size, 0);
const nameOf = c => c.fees < .5 ? "Fees overdue" : c.approved1 < 2 ? "Barely attending" : "On track";
$("share").innerHTML = prof.map((c, i) => `<i style="flex:${c.size};background:${COL[i]}"></i>`).join("");
$("shareKey").innerHTML = prof.map((c, i) => `<span><i style="background:${COL[i]}"></i>${nameOf(c)} · ${pct(c.size / total, 0)} of students</span>`).join("");
$("profiles").innerHTML = prof.map((c, i) => {
  const desc = c.fees < .5 ? "Have not paid tuition and pass few subjects." :
    c.approved1 < 2 ? "Enrolled, but pass almost no subjects." : "Pass most subjects with steady grades.";
  return `<div class="profile" data-reveal><div class="top" style="background:${COL[i]}"></div>
    <span class="mono">${c.size.toLocaleString()} students</span><h3>${nameOf(c)}</h3><p>${desc}</p>
    <div class="big" style="color:${COL[i]}">${pct(c.dropout, 0)}</div><p>dropped out</p>
    <ul><li>Semester-1 subjects passed<b>${c.approved1}</b></li><li>Semester-2 average grade<b>${c.grade2} / 20</b></li>
    <li>Fees up to date<b>${pct(c.fees, 0)}</b></li><li>Average age<b>${c.age}</b></li></ul></div>`;
}).join("");

/* ---------- early signal ---------- */
const r2 = D.regression.poly2;
$("r2").dataset.count = Math.round(r2.r2 * 100); $("r2").dataset.suf = "%";
$("rmse").textContent = "±" + r2.rmse.toFixed(1);
$("units").textContent = `${pct(ex.by_units["0"], 0)} → ${pct(ex.by_units["6"], 0)}`;
$("unitsTxt").textContent = "dropout for students passing no semester-1 subjects, versus those passing six.";

/* ---------- animate the comparison bars when they appear ---------- */
const barObs = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.querySelectorAll("i[data-w]").forEach(i => i.style.transform = `scaleX(${i.dataset.w})`);
  barObs.unobserve(e.target);
}), { threshold: .3 });
document.querySelectorAll(".signal").forEach(s => barObs.observe(s));

/* ---------- charts, drawn when scrolled into view ---------- */
const chartObs = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  chartObs.unobserve(e.target);
  if (e.target.id === "cUnits") new Chart(e.target, { type: "line",
    data: { labels: Object.keys(ex.by_units).map(k => k === "10" ? "10+" : k),
      datasets: [{ data: Object.values(ex.by_units), borderColor: INK, backgroundColor: "rgba(214,239,90,.35)", fill: true, tension: .35, pointBackgroundColor: ACC, pointRadius: 4 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { y: { ticks: { callback: v => pct(v, 0) }, grid: { color: LINE } }, x: { title: { display: true, text: "Subjects passed in semester 1" }, grid: { display: false } } } } });
  if (e.target.id === "cCorr") { const c = Object.entries(ex.correlation);
    new Chart(e.target, { type: "bar",
      data: { labels: c.map(x => nice(x[0])), datasets: [{ data: c.map(x => Math.abs(x[1])), backgroundColor: c.map(x => x[1] > 0 ? ACC : INK), borderRadius: 6 }] },
      options: { indexAxis: "y", maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { grid: { display: false } } } } }); }
  if (e.target.id === "cCourse") { const c = BGD.Course.groups.slice().reverse();   // highest dropout first
    new Chart(e.target, { type: "bar",
      data: { labels: c.map(g => g.label), datasets: [{ data: c.map(g => g.rate), borderRadius: 5,
        backgroundColor: c.map(g => g.rate > AVG + .05 ? ACC : g.rate < AVG - .05 ? OK : INK) }] },
      options: { indexAxis: "y", maintainAspectRatio: false, plugins: { legend: { display: false },
          tooltip: { callbacks: { label: x => `${pct(x.raw, 0)} dropped out (${c[x.dataIndex].n} students)` } } },
        scales: { x: { min: 0, max: 1, ticks: { callback: v => pct(v, 0) }, grid: { color: LINE } }, y: { grid: { display: false }, ticks: { font: { size: 11 } } } } } }); }
}), { threshold: .3 });
["cUnits", "cCorr", "cCourse"].forEach(id => chartObs.observe($(id)));
