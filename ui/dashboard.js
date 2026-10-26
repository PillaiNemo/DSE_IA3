// Counsellor dashboard: display and interaction only.
// Risk scores come from web/data.js; reasons, similar students and suggestions from web/model.js.
const F = E.features;
const KEY = ["Age at enrollment", "Gender", "Admission grade", "Scholarship holder", "Tuition fees up to date", "Debtor",
  "Curricular units 1st sem (enrolled)", "Curricular units 1st sem (approved)", "Curricular units 1st sem (grade)",
  "Curricular units 2nd sem (enrolled)", "Curricular units 2nd sem (approved)", "Curricular units 2nd sem (grade)"];
const LANES = [
  ["Red", "red", "Act now", "Contact this week", "var(--accent)"],
  ["Yellow", "yellow", "Monitor", "Check in after the next assessment", "var(--mid)"],
  ["Green", "green", "On track", "No action needed", "var(--ok)"]
];
const STEP = 12;

const students = E.students.map(s => {
  const values = {};
  F.forEach((f, j) => values[f] = s.x[j]);
  return { ...s, values };
}).sort((a, b) => b.risk - a.risk);

let query = "", lane = "Red";
const shown = { Red: STEP, Yellow: STEP, Green: STEP };

// Short issue tags: from the support rules, otherwise the strongest reason from the model.
const ISSUE = [["Fees are not up to date", "Unpaid fees"], ["Passed under half", "Failing sem 1"],
  ["Semester-2 average below", "Low sem 2 grades"], ["Student owes money", "Owes money"], ["No scholarship and in debt", "No scholarship"]];
function issues(s) {
  if (s.tags) return s.tags;
  const hit = getSuggestions(s.values, [0, 0, 0, 0, 0]).map(t => ISSUE.find(i => t.startsWith(i[0]))).filter(Boolean).map(i => i[1]);
  if (hit.length) return (s.tags = hit.slice(0, 2));
  const c = predictRisk(s.values).contributions.filter(x => KEY.includes(x[0])).sort((a, b) => b[1] - a[1])[0];
  s.tags = [s.tier === "Green" ? "Passing steadily" : `${nice(c[0])}: ${showValue(c[0], s.values[c[0]])}`];
  return s.tags;
}

/* ---------- board ---------- */
function card(s, i) {
  const col = LANES.find(l => l[0] === s.tier)[4], p = Math.round(s.risk * 100);
  return `<button class="scard" type="button" data-id="${s.id}" style="animation-delay:${(i % STEP) * 25}ms">
    <span class="ring" style="--p:${p};--c:${col}"><span>${p}%</span></span>
    <span><span class="id">${s.id}</span><span class="chips">${issues(s).map(t => `<span class="chip">${t}</span>`).join("")}</span></span></button>`;
}
function drawBoard() {
  $("board").innerHTML = LANES.map(([tier, cls, name, what, col]) => {
    const list = students.filter(s => s.tier === tier && s.id.toLowerCase().includes(query.toLowerCase()));
    const page = list.slice(0, shown[tier]);
    return `<section class="lane ${cls} ${lane === tier ? "show" : ""}">
      <div class="lane-head"><div><h2><i style="background:${col}"></i>${name}</h2><p>${what}</p></div><span class="n">${list.length}</span></div>
      <div class="cards">${page.length ? page.map(card).join("") : `<p class="empty">No students here.</p>`}</div>
      ${list.length > page.length ? `<button class="btn more" type="button" data-more="${tier}">Show ${Math.min(STEP, list.length - page.length)} more</button>` : ""}
    </section>`;
  }).join("");
  $("laneSwitch").innerHTML = LANES.map(([tier, , name]) =>
    `<button type="button" data-lane="${tier}" class="${lane === tier ? "on" : ""}">${name}</button>`).join("");
}

/* ---------- student window ---------- */
function alertText(s, tip) {
  return `EduGuard alert (draft) – Student ${s.id}\nRisk tier: ${s.tier} (${pct(s.risk, 0)}).\n` +
    `Main concern: ${tip}\nPlease contact the counselling cell to plan support.`;
}
function openStudent(id) {
  const s = students.find(x => x.id === id), v = s.values;
  const res = predictRisk(v), near = similarStudents(v, 5), tips = getSuggestions(v, near);
  const k = near.reduce((a, b) => a + b, 0);
  const reasons = res.contributions.filter(c => KEY.includes(c[0])).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3);
  const sentence = { Red: "High risk: contact this student this week.", Yellow: "Medium risk: check in after the next assessment.",
    Green: "Low risk: no action needed right now." }[s.tier];

  $("modalBody").innerHTML = `
    <div class="m-top"><h2>${s.id} ${tierPill(s.tier)}</h2><button class="m-close" id="close" aria-label="Close">✕</button></div>
    <div class="m-grid">
      <div>
        <div class="m-hero"><span class="mono">Dropout risk</span><div class="big">${pct(s.risk, 0)}</div>
          <p>${sentence}</p><div class="m-scale"><i style="left:${s.risk * 100}%"></i></div></div>
        <div class="facts">
          <div><span>Sem 1 passed</span><b>${v["Curricular units 1st sem (approved)"]} / ${v["Curricular units 1st sem (enrolled)"]}</b></div>
          <div><span>Sem 2 passed</span><b>${v["Curricular units 2nd sem (approved)"]} / ${v["Curricular units 2nd sem (enrolled)"]}</b></div>
          <div><span>Sem 2 grade</span><b>${(+v["Curricular units 2nd sem (grade)"]).toFixed(1)}</b></div>
          <div><span>Fees paid</span><b>${showValue("Tuition fees up to date", v["Tuition fees up to date"])}</b></div>
          <div><span>Owes money</span><b>${showValue("Debtor", v["Debtor"])}</b></div>
          <div><span>Scholarship</span><b>${showValue("Scholarship holder", v["Scholarship holder"])}</b></div></div>
      </div>
      <div>
        <div class="m-sec"><h3><span class="num">1</span>Why this score</h3><ul class="why">${reasons.map(([f, c]) =>
          `<li><span class="${c > 0 ? "up" : "down"}">${c > 0 ? "▲" : "▼"}</span><span>${nice(f)}: <b>${showValue(f, v[f])}</b> ${c > 0 ? "raises" : "lowers"} the risk</span></li>`).join("")}</ul></div>
        <div class="m-sec"><h3><span class="num">2</span>What to do</h3>${tips.map(t => `<div class="tip">${t}</div>`).join("")}
          <p class="hint">${k} of the 5 most similar past students dropped out.</p></div>
      </div>
    </div>
    <div class="m-foot"><span class="hint">Alerts are drafts. Nothing is sent automatically.</span>
      <div class="btns"><button class="btn" type="button" id="copy">Copy alert for mentor</button>
        <a class="btn solid" href="report.html?student=${s.id}">Student brief (PDF) <span class="arr">↓</span></a></div></div>
    <textarea id="alertText" hidden>${alertText(s, tips[0])}</textarea>`;

  $("modal").classList.add("open"); $("scrim").classList.add("open");
  $("modal").setAttribute("aria-hidden", "false"); document.body.classList.add("locked");
  if (window.lenis) lenis.stop();
  $("modalBody").scrollTop = 0;
  $("close").focus();
  $("close").addEventListener("click", closeStudent);
  $("copy").addEventListener("click", () =>
    navigator.clipboard.writeText($("alertText").value).then(() => $("copy").textContent = "Copied ✓"));
}
function closeStudent() {
  $("modal").classList.remove("open"); $("scrim").classList.remove("open");
  $("modal").setAttribute("aria-hidden", "true"); document.body.classList.remove("locked");
  if (window.lenis) lenis.start();
}

/* ---------- events ---------- */
$("board").addEventListener("click", e => {
  const c = e.target.closest(".scard"); if (c) return openStudent(c.dataset.id);
  const m = e.target.closest("[data-more]"); if (m) { shown[m.dataset.more] += STEP; drawBoard(); }
});
$("laneSwitch").addEventListener("click", e => { const b = e.target.closest("[data-lane]"); if (b) { lane = b.dataset.lane; drawBoard(); } });
$("search").addEventListener("input", e => { query = e.target.value.trim(); drawBoard(); });
$("modal").addEventListener("click", e => { if (e.target === $("modal")) closeStudent(); });
$("scrim").addEventListener("click", closeStudent);
addEventListener("keydown", e => { if (e.key === "Escape") closeStudent(); });

drawBoard();
// Link straight to a student, e.g. dashboard.html#student=S158
if (location.hash.startsWith("#student=")) openStudent(location.hash.slice(9));
