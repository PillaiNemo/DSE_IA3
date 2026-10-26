// Responsible use page: display only. Numbers come from web/data.js (analysis_model.py).
const fr = A.model.ethics.fairness;
const pair = (a, b, title, sub) => {
  const ga = fr.find(r => r.group === a), gb = fr.find(r => r.group === b);
  const row = g => `<div class="r"><span>${g.group}</span><div class="t"><i style="transform:scaleX(0)" data-w="${g.recall}"></i></div><b>${pct(g.recall, 0)}</b></div>`;
  return `<div class="fair" data-reveal><h3>${title}</h3><p class="sub">${sub}</p><div class="vs">${row(ga)}${row(gb)}</div>
    <div class="meta"><span>${ga.group}: ${ga.n} students, ${pct(ga.actual, 0)} dropped out</span><span>${gb.group}: ${gb.n} students, ${pct(gb.actual, 0)} dropped out</span></div></div>`;
};
$("fair").innerHTML = pair("Female", "Male", "By gender", "Caught early, out of those who dropped out") +
  pair("No scholarship", "Scholarship", "By scholarship", "Caught early, out of those who dropped out");

const sch = fr.find(r => r.group === "Scholarship"), nos = fr.find(r => r.group === "No scholarship");
$("fairTake").innerHTML = `<b>What this means:</b> results are similar for women and men, but EduGuard catches fewer at-risk ` +
  `scholarship holders (${pct(sch.recall, 0)} vs ${pct(nos.recall, 0)}). A Green result for a scholarship holder should be double-checked.`;

const barObs = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.querySelectorAll("i[data-w]").forEach(i => i.style.transform = `scaleX(${i.dataset.w})`);
  barObs.unobserve(e.target);
}), { threshold: .3 });
document.querySelectorAll(".fair").forEach(f => barObs.observe(f));
