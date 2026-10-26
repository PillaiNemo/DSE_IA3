// Overview (landing) page: display and interaction only.
// Numbers come from web/data.js; the quick check uses predictRisk() from web/model.js.
const D = A.data, M = A.model;
const best = E.results.find(r => r.Model === E.best);
const [[tn, fp], [fn, tp]] = M.evaluation.confusion;
const counts = { Red: 0, Yellow: 0, Green: 0 };
E.students.forEach(s => counts[s.tier]++);
const total = E.students.length;

/* ---------- hero widgets ---------- */
const TCOL = { Red: "var(--accent)", Yellow: "var(--mid)", Green: "var(--ok)" };
$("tierRows").innerHTML = ["Red", "Yellow", "Green"].map(t =>
  `<div class="trow"><span>${t}</span><div class="t"><i style="--w:${counts[t] / total};background:${TCOL[t]}"></i></div><b>${counts[t]}</b></div>`).join("") +
  `<p class="hint" style="margin-top:8px">${total} students screened</p>`;
$("caught").dataset.count = tp;
$("caughtOf").textContent = ` / ${tp + fn}`;
const pts = Object.values(D.explore.by_units);
const path = pts.map((v, i) => `${(i / (pts.length - 1)) * 200},${60 - v * 70}`).join(" L");
$("spark").innerHTML = `<path d="M${path}" fill="none" stroke="#26320f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
  pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" style="transition:stroke-dashoffset 2s cubic-bezier(.22,.8,.24,1) .4s"/>
  <path d="M${path} L200,60 L0,60Z" fill="rgba(214,239,90,.35)"/>`;
setTimeout(() => $("spark").querySelector("path").style.strokeDashoffset = 0, 300);

// Gentle parallax on the floating widgets while scrolling.
addEventListener("scroll", () => {
  if (REDUCED || scrollY > innerHeight) return;
  document.querySelectorAll(".widget").forEach((w, i) => w.style.transform = `translateY(${-scrollY * (0.06 + i * 0.04)}px)`);
}, { passive: true });

/* ---------- marquee ---------- */
const CONCEPTS = ["Early warnings", "Red · Yellow · Green tiers", "Clear reasons", "Suggested support", "Counsellor dashboard",
  "One-page PDF briefs", "Alert drafts for mentors", "Privacy first", "Fairness checked", "Human decides"];
$("marquee").innerHTML = CONCEPTS.concat(CONCEPTS).map(c => `<span>${c}</span>`).join("");

/* ---------- numbers in tiles and steps ---------- */
$("accNum").dataset.count = (best.Accuracy * 100).toFixed(1);
$("accNum").dataset.dec = 1;
$("tierStack").innerHTML = ["Red", "Yellow", "Green"].map(t => `<div>${tierPill(t)}<b>${counts[t]}</b></div>`).join("");

/* ---------- quick check: the real model with 3 inputs changed ---------- */
const q = { ...E.defaults };
["Tuition fees up to date", "Scholarship holder", "Debtor", "Gender"].forEach(f => q[f] = Math.round(q[f]));
let shownRisk = 0;
function quickCheck() {
  const passed = +$("qPass").value;
  q["Curricular units 2nd sem (approved)"] = passed;
  $("qPassV").textContent = passed;
  const p = predictRisk(q).probability, tier = riskTier(p);
  $("qTier").innerHTML = tierPill(tier);
  $("qBar").style.width = (p * 100) + "%";
  $("qBar").style.background = tier === "Red" ? "var(--accent)" : tier === "Yellow" ? "var(--mid)" : "var(--olive)";
  const from = shownRisk, to = p * 100, t0 = performance.now();
  const tick = now => {
    const k = Math.min(1, (now - t0) / 500), v = from + (to - from) * (1 - Math.pow(1 - k, 3));
    $("qRisk").textContent = Math.round(v) + "%";
    if (k < 1) requestAnimationFrame(tick); else shownRisk = to;
  };
  requestAnimationFrame(tick);
}
$("qPass").addEventListener("input", quickCheck);
[["qFees", "Tuition fees up to date"], ["qSch", "Scholarship holder"]].forEach(([id, f]) =>
  $(id).addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    q[f] = +b.dataset.v;
    $(id).querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
    quickCheck();
  }));
$("qFees").querySelector('[data-v="1"]').classList.toggle("on", q["Tuition fees up to date"] === 1);
$("qFees").querySelector('[data-v="0"]').classList.toggle("on", q["Tuition fees up to date"] === 0);
quickCheck();
