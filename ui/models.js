// Accuracy page: display only. Numbers come from web/data.js (train.py, analysis_model.py).
const M = A.model, best = E.results.find(r => r.Model === E.best);
const [[tn, fp], [fn, tp]] = M.evaluation.confusion;

$("lead").textContent = `EduGuard learned from ${M.train_size.toLocaleString()} past students, then was tested on ` +
  `${M.test_size} other students it had never seen, the same way it would meet new students.`;

$("kpis").innerHTML = `In testing it flagged <b style="color:var(--lime)">${pct(best.Recall, 0)}</b> of students who later dropped out, ` +
  `was right <b style="color:var(--lime)">${pct(best.Accuracy, 0)}</b> of the time overall, and correctly left alone ` +
  `<b style="color:var(--lime)">${pct(tn / (tn + fp), 0)}</b> of students who stayed.`;

/* ---------- out of 100 dots ---------- */
const caught = Math.round(tp / (tp + fn) * 100), cleared = Math.round(tn / (tn + fp) * 100);
$("caughtBig").textContent = caught + " of 100";
$("clearBig").textContent = cleared + " of 100";
$("dotsDrop").innerHTML = Array.from({ length: 100 }, (_, i) => `<i class="${i < caught ? "y" : ""}" style="transition-delay:${i * 8}ms"></i>`).join("");
$("dotsStay").innerHTML = Array.from({ length: 100 }, (_, i) => `<i class="${i < cleared ? "y" : "r"}" style="transition-delay:${i * 8}ms"></i>`).join("");
const dotObs = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add("in"); dotObs.unobserve(e.target); }
}), { threshold: .3 });
document.querySelectorAll(".dots100").forEach(d => dotObs.observe(d));

/* ---------- results grid ---------- */
const cell = (v, lab, hot) => `<div style="background:${hot ? "var(--accent-soft)" : "var(--ok-soft)"}"><b>${v}</b>${lab}</div>`;
$("cm").innerHTML = `<div class="lab"></div><div class="lab">Predicted: stays</div><div class="lab">Predicted: drops out</div>
  <div class="lab">Stayed</div>${cell(tn, "correct", 0)}${cell(fp, "precaution", 1)}
  <div class="lab">Dropped out</div>${cell(fn, "missed", 1)}${cell(tp, "caught early", 0)}`;
$("cmTake").innerHTML = `Of ${tp + fn} students who dropped out, <b style="color:var(--lime)">${tp} would have been flagged in time</b> and ${fn} were missed.`;

/* ---------- what raises / lowers risk ---------- */
// Coded columns (e.g. occupation codes) mean nothing to staff, so they are not listed.
const HIDE = ["Nacionality", "Mother's occupation", "Father's occupation", "Course", "Application mode"];
const LABEL = { "International": "International student" };
const w = Object.entries(M.ethics.weights).filter(x => !HIDE.includes(x[0])).map(([f, v]) => [LABEL[f] || f, v]);
const maxW = Math.max(...w.map(x => Math.abs(x[1])));
const list = (sign) => w.filter(x => sign > 0 ? x[1] > 0 : x[1] < 0).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  .map(([f, v]) => `<div class="row"><span>${nice(f)}</span><div class="t"><i style="width:${Math.abs(v) / maxW * 100}%"></i></div></div>`).join("");
$("drivers").innerHTML = `<div class="drv up" data-reveal><h3>▲ Raises the risk</h3>${list(1)}</div>` +
  `<div class="drv down" data-reveal><h3>▼ Lowers the risk</h3>${list(-1)}</div>`;
