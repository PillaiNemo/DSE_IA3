// Shared display helpers, top navigation and motion (design only - no calculations).
const E = window.EDU;
const A = E.analysis;
const $ = id => document.getElementById(id);
const pct = (v, dp = 1) => (v * 100).toFixed(dp) + "%";
const INK = "#26320f", INK3 = "#9ba190", LINE = "#e7e9e0", ACC = "#e0533d", GREY = "#c9cdbd", OK = "#4f8a2c", LIME = "#8fae1f";
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- top navigation + footer, built once for every page ---------- */
const PAGES = [["dashboard", "dashboard.html", "Dashboard"], ["checker", "checker.html", "Check a student"],
  ["analysis", "analysis.html", "Insights"], ["models", "models.html", "Accuracy"], ["ethics", "ethics.html", "Responsible use"]];
(function buildShell() {
  const page = document.body.dataset.page;
  const nav = document.createElement("header");
  nav.className = "nav";
  nav.innerHTML = `<div class="bar"><a class="logo" href="index.html"><i></i>EduGuard</a>
    <nav class="links">${PAGES.map(([id, href, label]) => `<a href="${href}" class="${id === page ? "on" : ""}">${label}</a>`).join("")}</nav>
    <a class="btn solid small nav-cta" href="checker.html">Check a student <span class="arr">→</span></a>
    <button class="menu" type="button" aria-label="Open menu">Menu</button></div>`;
  if (!document.querySelector(".hero-shell")) document.body.prepend(nav);
  else document.querySelector(".hero-shell").prepend(nav);
  nav.querySelector(".menu").addEventListener("click", () => nav.classList.toggle("open"));
  // Over the dark hero (overview page) the nav uses a see-through dark style.
  const hero = document.querySelector(".hero");
  const onScroll = () => {
    nav.classList.toggle("scrolled", scrollY > 20);
    if (hero) nav.classList.toggle("on-dark", scrollY < hero.offsetHeight - 90);
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const foot = document.createElement("footer");
  foot.className = "foot";
  foot.innerHTML = `<div class="in">
    <div><a class="logo" href="index.html"><i></i>EduGuard</a>
      <p>Early-warning and counselling support for student success. Spot students at risk early and give them the right help.</p></div>
    <div><h5>For staff</h5><a href="dashboard.html">Counsellor dashboard</a><a href="checker.html">Check a student</a><a href="report.html">Summary report</a></div>
    <div><h5>Learn more</h5><a href="analysis.html">Insights</a><a href="models.html">Accuracy</a><a href="ethics.html">Responsible use</a></div>
    <div class="base"><span>© 2026 EduGuard</span><span>Decision support only · Built on anonymised historical student records</span></div></div>`;
  document.body.appendChild(foot);

  // Smooth page-to-page transition for internal links.
  document.addEventListener("click", e => {
    const a = e.target.closest("a[href]");
    if (!a || a.target || e.metaKey || e.ctrlKey) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname || REDUCED) return;
    e.preventDefault();
    document.body.classList.add("leaving");
    setTimeout(() => location.href = a.href, 230);
  });
  addEventListener("pageshow", () => document.body.classList.remove("leaving"));
})();

/* ---------- smooth scrolling (Lenis), loaded from a CDN; page works without it ---------- */
(function smoothScroll() {
  if (REDUCED) return;
  const s = document.createElement("script");
  s.src = "https://unpkg.com/lenis@1.1.13/dist/lenis.min.js";
  s.onload = () => {
    // lerp = how quickly the page catches up with the wheel (higher = tighter).
    const lenis = new Lenis({ lerp: 0.16, wheelMultiplier: 0.9, smoothWheel: true });
    window.lenis = lenis;
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  };
  document.head.appendChild(s);
})();

/* ---------- motion helpers ---------- */
function splitWords(el) {
  if (el.dataset.done) return;
  el.dataset.done = 1;
  const walk = node => [...node.childNodes].forEach(n => {
    if (n.nodeType === 3) {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        const w = document.createElement("span"); w.className = "w"; w.textContent = part; frag.appendChild(w);
      });
      n.replaceWith(frag);
    } else if (n.nodeType === 1 && !n.classList.contains("w")) walk(n);
  });
  walk(el);
  el.querySelectorAll(".w").forEach((w, i) => w.style.transitionDelay = (i * 45) + "ms");
}

function countUp(el) {
  const end = parseFloat(el.dataset.count), dec = +(el.dataset.dec || 0), pre = el.dataset.pre || "", suf = el.dataset.suf || "";
  if (REDUCED) { el.textContent = pre + end.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf; return; }
  const t0 = performance.now(), dur = 1400;
  const tick = now => {
    const k = Math.min(1, (now - t0) / dur), v = end * (1 - Math.pow(1 - k, 4));
    el.textContent = pre + v.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf;
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const revealer = new IntersectionObserver(entries => entries.forEach(en => {
  if (!en.isIntersecting) return;
  const el = en.target;
  el.classList.add("in");
  revealer.unobserve(el);
  if (el.dataset.count) countUp(el);
  el.querySelectorAll("[data-count]").forEach(countUp);
  el.querySelectorAll(".fill[data-w]").forEach(f => f.style.transform = `scaleX(${f.dataset.w})`);
}), { threshold: .15, rootMargin: "0px 0px -40px 0px" });

// Call after adding content: animates cards, split headings and counters.
function animateIn(root = document) {
  root.querySelectorAll("[data-split]").forEach(el => { splitWords(el); el.classList.add("split"); revealer.observe(el); });
  root.querySelectorAll("[data-reveal], [data-count]").forEach((el, i) => {
    if (el.dataset.reveal === "" && !el.style.transitionDelay) el.style.transitionDelay = (i % 4) * 90 + "ms";
    revealer.observe(el);
  });
  root.querySelectorAll(".fill[data-w]").forEach(f => { f.style.transform = "scaleX(0)"; revealer.observe(f.closest(".bars") || f); });
}

// Scroll-linked word colouring for big statements (class "scrub").
function setupScrub() {
  const els = [...document.querySelectorAll("[data-scrub]")];
  els.forEach(el => { splitWords(el); el.classList.add("scrub"); el.querySelectorAll(".w").forEach(w => w.style.transitionDelay = "0ms"); });
  const update = () => els.forEach(el => {
    const r = el.getBoundingClientRect(), vh = innerHeight;
    const k = Math.min(1, Math.max(0, (vh * .85 - r.top) / (r.height + vh * .45)));
    const words = el.querySelectorAll(".w"), n = Math.round(k * words.length);
    words.forEach((w, i) => w.classList.toggle("on", i < n));
  });
  addEventListener("scroll", update, { passive: true });
  update();
}

/* ---------- tabs: one topic visible at a time ---------- */
function setupTabs(onShow) {
  const bar = document.querySelector(".tabs");
  if (!bar) return;
  const show = id => {
    bar.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.tab === id));
    document.querySelectorAll(".tab").forEach(t => {
      t.classList.toggle("on", t.id === id);
      if (t.id === id) t.querySelectorAll("[data-reveal]").forEach((c, i) => {
        c.classList.remove("in"); c.style.transitionDelay = i * 80 + "ms";
        requestAnimationFrame(() => requestAnimationFrame(() => c.classList.add("in")));
      });
    });
    if (onShow) onShow(id);
    history.replaceState(null, "", "#" + id);
  };
  bar.addEventListener("click", e => { const b = e.target.closest("button"); if (b) show(b.dataset.tab); });
  const start = location.hash.slice(1);
  show(document.getElementById(start) ? start : bar.querySelector("button").dataset.tab);
  // A #tab link should open that tab, not jump the page down to it.
  history.scrollRestoration = "manual";
  addEventListener("load", () => scrollTo(0, 0));
}

/* ---------- small display helpers ---------- */
const SHORT = {
  "Curricular units 1st sem (enrolled)": "Sem 1 subjects enrolled", "Curricular units 1st sem (approved)": "Sem 1 subjects passed",
  "Curricular units 1st sem (grade)": "Sem 1 average grade", "Curricular units 2nd sem (enrolled)": "Sem 2 subjects enrolled",
  "Curricular units 2nd sem (approved)": "Sem 2 subjects passed", "Curricular units 2nd sem (grade)": "Sem 2 average grade",
  "Curricular units 1st sem (credited)": "Sem 1 subjects credited", "Curricular units 2nd sem (credited)": "Sem 2 subjects credited",
  "Curricular units 1st sem (evaluations)": "Sem 1 evaluations", "Curricular units 2nd sem (evaluations)": "Sem 2 evaluations",
  "Tuition fees up to date": "Fees up to date", "Age at enrollment": "Age at enrolment", "Scholarship holder": "Scholarship"
};
const nice = f => SHORT[f] || f;
const YESNO = ["Tuition fees up to date", "Debtor", "Scholarship holder", "Displaced", "International"];
function showValue(f, v) {
  if (f === "Gender") return v === 1 ? "Male" : "Female";
  if (YESNO.includes(f)) return v === 1 ? "Yes" : "No";
  return Number.isInteger(v) ? v : (+v).toFixed(1);
}
const TIER = {
  Red: { label: "Red · High risk", color: "var(--accent)", bg: "var(--accent-soft)" },
  Yellow: { label: "Yellow · Medium risk", color: "var(--mid)", bg: "var(--mid-soft)" },
  Green: { label: "Green · Low risk", color: "var(--ok)", bg: "var(--ok-soft)" }
};
function tierPill(tier, short) {
  const t = TIER[tier];
  return `<span class="pill" style="color:${t.color};background:${t.bg}">${short ? tier : t.label}</span>`;
}
// Top reasons = the largest logistic-regression contributions (optionally only some features).
function reasonList(contributions, student, n = 4, only) {
  return contributions.filter(c => !only || only.includes(c[0]))
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, n)
    .map(([f, c]) => `<li><span>${nice(f)}<span class="v">${showValue(f, student[f])}</span></span>` +
      `<span class="${c > 0 ? "up" : "down"}">${c > 0 ? "▲ raises risk" : "▼ lowers risk"}</span></li>`).join("");
}
function neighbourDots(outcomes) {
  return outcomes.map(y => `<i class="${y ? "d" : ""}" title="${y ? "Dropped out" : "Stayed"}"></i>`).join("");
}
if (window.Chart) {
  Chart.defaults.font.family = "Inter"; Chart.defaults.color = INK3;
  Chart.defaults.animation.duration = REDUCED ? 0 : 1200; Chart.defaults.animation.easing = "easeOutQuart";
}
document.addEventListener("DOMContentLoaded", () => {
  // Inner pages: let the header and every card glide in.
  if (document.body.dataset.page !== "overview") {
    document.querySelectorAll(".phead, .page .card, .tiers, .stepper, .tabs").forEach(el => {
      if (!el.hasAttribute("data-reveal")) el.setAttribute("data-reveal", "");
    });
    document.querySelectorAll(".phead h1").forEach(h => h.setAttribute("data-split", ""));
  }
  animateIn(); setupScrub();
});
