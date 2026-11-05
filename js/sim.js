/* UmaCollector — Yarış Simülatörü (Araçlar › Yarış Simülatörü)
   Hesap: alpha123'ün açık kaynak motoru (uma-tools / uma-skill-tools, GPL-3.0-or-later), js/motor.worker.js.
   Motor iki Uma'yı aynı parkurda, aynı rastgele koşullarla tek başına koşturur ve aradaki farkı "boy" olarak ölçer. */
(() => {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const D = () => window.UMAUMA_DATA;
  const UMA = (id) => window.UmaApp.umaById[id];
  const T = () => window.UMAUMA_TOOLS;
  const STATS = [["speed", "Speed"], ["stamina", "Stamina"], ["power", "Power"], ["guts", "Guts"], ["wisdom", "Wit"]];
  const STRATS = [["Nige", "Front Runner"], ["Senkou", "Pace Chaser"], ["Sasi", "Late Surger"], ["Oikomi", "End Closer"]];
  const STYLE_TO_STRAT = { "Front Runner": "Nige", "Pace Chaser": "Senkou", "Late Surger": "Sasi", "End Closer": "Oikomi" };
  const STRAT_KEY = { Nige: "front", Senkou: "pace", Sasi: "late", Oikomi: "end" };
  const GRADES = ["S", "A", "B", "C", "D", "E", "F", "G"];
  const GROUND = [[1, "Sert"], [2, "İyi"], [3, "Yumuşak"], [4, "Ağır"]];
  const WEATHER = [[1, "Güneşli"], [2, "Bulutlu"], [3, "Yağmurlu"], [4, "Karlı"]];
  const SEASON = [[1, "İlkbahar"], [2, "Yaz"], [3, "Sonbahar"], [4, "Kış"]];
  const MOOD = [[2, "Harika"], [1, "İyi"], [0, "Normal"], [-1, "Kötü"], [-2, "Berbat"]];
  const distCat = (m) => (m <= 1400 ? "sprint" : m <= 1800 ? "mile" : m <= 2400 ? "medium" : "long");
  const fmt = (n, d = 2) => (n >= 0 ? "+" : "") + n.toFixed(d).replace(".", ",");

  /* ---------- Araçlar verisini gerektiğinde yükle (data/araclar.js) ---------- */
  let loading = null;
  const stamp = () => ((document.querySelector('script[src*="js/app.js"]') || {}).src || "").match(/\?b=\d+/)?.[0] || "";
  function needTools(cb) {
    if (T()) return cb();
    if (!loading) {
      loading = new Promise((res) => {
        const s = document.createElement("script");
        s.src = "data/araclar.js" + stamp(); s.onload = res; s.onerror = res;
        document.head.appendChild(s);
      });
    }
    loading.then(cb);
  }
  window.UmaToolsData = { need: needTools };

  /* ---------- durum ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem("umauma." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("umauma." + k, JSON.stringify(v)); } catch (e) { /* yok say */ } },
  };
  function defaultRunner(umaId) {
    const u = UMA(umaId) || D().umas[0];
    const g = D().guides[u.id];
    const num = (v) => parseInt(v, 10) || 0;
    const st = g ? g.stats : { speed: "1200", stamina: "800", power: "900", guts: "500", wit: "900" };
    const strat = g ? STYLE_TO_STRAT[g.style] || "Senkou" : "Senkou";
    return { uma: u.id, speed: num(st.speed), stamina: num(st.stamina), power: num(st.power), guts: num(st.guts), wisdom: num(st.wit),
      strategy: strat, mood: 2, skills: [], apt: null };
  }
  const S = store.get("sim", null) || {
    course: 10906, ground: 1, weather: 1, season: 1, n: 300, posKeep: true,
    a: null, b: null,
  };
  let result = null, running = false, worker = null, runId = 0;

  function save() { store.set("sim", S); }
  const simCourses = () => { const ok = new Set(T().courses || []); return D().courses.filter((c) => ok.has(c.id)); };
  function course() { return simCourses().find((c) => c.id === S.course) || simCourses()[0]; }
  function aptFor(r, c = course()) {
    const u = UMA(r.uma);
    const auto = u ? { dist: u.apt[distCat(c.length)], surf: u.apt[c.terrain === "Turf" ? "turf" : "dirt"], strat: u.apt[STRAT_KEY[r.strategy]] } : { dist: "A", surf: "A", strat: "A" };
    return { ...auto, ...(r.apt || {}) };
  }

  /* ---------- skill seçici ---------- */
  const skillName = (id) => (id === "kakari" ? "Heyecanlanma" : T() && T().skills[id] ? T().skills[id].n : id);
  const skillIcon = (id) => (T() && T().skills[id] && T().skills[id].i ? `<img src="img/skill/${T().skills[id].i}.png" alt="" onerror="this.style.visibility='hidden'">` : "");
  function uniqueOf(r) { const u = UMA(r.uma); return u && u.unique ? String(u.unique) : null; }

  function runnerCard(key, r, color) {
    const apt = aptFor(r);
    const uq = uniqueOf(r);
    const team = window.UmaApp.team();
    const aptSel = (field, label, val) => `<label class="sm-apt">${label}<select data-r="${key}" data-apt="${field}">${GRADES.map((g) => `<option ${g === val ? "selected" : ""}>${g}</option>`).join("")}</select></label>`;
    return `<section class="panel sm-runner ${color}">
      <div class="sm-rhead">
        <img class="sm-face" src="img/uma/${r.uma}.png" alt="">
        <div class="sm-rtitle"><span class="sm-tag">${key === "a" ? "Koşucu A" : "Koşucu B"}</span>
          <select class="select sm-uma" data-r="${key}" data-f="uma" aria-label="Uma">${D().umas.slice().sort((x, y) => x.name.localeCompare(y.name)).map((x) => `<option value="${x.id}" ${x.id === r.uma ? "selected" : ""}>${esc(x.name)} ${esc(x.title)}</option>`).join("")}</select>
        </div>
      </div>
      <div class="sm-actions">
        <button type="button" class="chip" data-r="${key}" data-act="guide">Önerilen statlar</button>
        ${team.length ? `<select class="select sm-team" data-r="${key}" data-act="team"><option value="">Takımımdan yükle…</option>${team.map((t, i) => `<option value="${i}">${esc(t.cat)} ${t.slot === "ACE" ? "ACE" : t.slot} · ${esc(t.name)}</option>`).join("")}</select>` : ""}
        <button type="button" class="chip" data-r="${key}" data-act="copy">${key === "a" ? "B'ye kopyala" : "A'ya kopyala"}</button>
      </div>
      <div class="sm-stats">${STATS.map(([k, n]) => `<label class="sm-stat"><span>${n}</span><input type="number" min="1" max="2000" step="1" value="${r[k]}" data-r="${key}" data-f="${k}"></label>`).join("")}</div>
      <div class="sm-row">
        <label class="sm-apt">Strateji<select data-r="${key}" data-f="strategy">${STRATS.map(([v, n]) => `<option value="${v}" ${v === r.strategy ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <label class="sm-apt">Ruh hali<select data-r="${key}" data-f="mood">${MOOD.map(([v, n]) => `<option value="${v}" ${v === r.mood ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        ${aptSel("dist", "Mesafe", apt.dist)}${aptSel("surf", "Zemin", apt.surf)}${aptSel("strat", "Stil", apt.strat)}
      </div>
      <div class="sm-skills">
        <div class="sm-sh">Skill'ler <small>${r.skills.length + (uq ? 1 : 0)}</small></div>
        <div class="sm-chips">
          ${uq ? `<span class="sm-chip uq" data-skill="${uq}">${skillIcon(uq)}${esc(skillName(uq))}<i>${(T().skills[uq] || {}).x ? "hesaba katılamıyor" : "özel"}</i></span>` : ""}
          ${r.skills.map((id) => `<span class="sm-chip"><span class="sm-cn" data-skill="${id}" tabindex="0">${skillIcon(id)}${esc(skillName(id))}</span><button type="button" aria-label="Kaldır" data-r="${key}" data-del="${id}">×</button></span>`).join("")}
        </div>
        <div class="sm-add"><input type="search" placeholder="Skill ekle: ara…" data-r="${key}" data-find="1" autocomplete="off"><div class="sm-sug" data-sug="${key}"></div></div>
      </div>
    </section>`;
  }

  function resultHtml() {
    if (running) return `<section class="panel wide sm-res"><div class="sm-run"><span class="sm-spin"></span>Hesaplanıyor… ${result ? `${result.stats.n} yarış` : ""}</div></section>`;
    if (!result) return "";
    if (result.error) return `<section class="panel wide sm-res"><p class="msg err">Motor hata verdi: ${esc(result.error.split("\n")[0])}</p></section>`;
    const st = result.stats, c = course();
    const ahead = st.mean >= 0 ? "B" : "A";
    const hist = histSvg(st.results);
    return `<section class="panel wide sm-res">
      <h2>Sonuç <small class="hint">${st.n} yarış · ${esc(c.track)} ${c.length} m</small></h2>
      <div class="sm-head"><b class="${ahead === "B" ? "pink" : "blue"}">${Math.abs(st.mean) < 0.05 ? "İkisi neredeyse eşit" : `Koşucu ${ahead}, ortalama ${Math.abs(st.mean).toFixed(2).replace(".", ",")} boy önde`}</b>
        <span class="hint">Pozitif değer B'nin önde bitirdiği, negatif A'nın önde bitirdiği anlamına gelir. 1 boy yaklaşık 2,5 metre.</span></div>
      <div class="sm-nums">
        <div><small>En kötü</small><b>${fmt(st.min)}</b></div><div><small>Medyan</small><b>${fmt(st.median)}</b></div>
        <div><small>Ortalama</small><b>${fmt(st.mean)}</b></div><div><small>En iyi</small><b>${fmt(st.max)}</b></div>
      </div>
      ${hist}
      ${result.run ? chartsHtml(result.run, c) : ""}
    </section>`;
  }

  function histSvg(res) {
    if (!res || !res.length) return "";
    const lo = Math.min(res[0], -0.5), hi = Math.max(res[res.length - 1], 0.5), N = 24;
    const bins = new Array(N).fill(0);
    res.forEach((v) => { bins[Math.min(N - 1, Math.floor((v - lo) / (hi - lo) * N))]++; });
    const mx = Math.max(...bins), W = 600, H = 120, bw = W / N;
    const zero = (0 - lo) / (hi - lo) * W;
    const n1 = (v) => v.toFixed(1).replace(".", ",");
    return `<div><svg class="sm-hist" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Boy farkı dağılımı">
      ${bins.map((b, i) => { const x0 = lo + (i / N) * (hi - lo); const h = mx ? b / mx * H : 0;
        return `<rect x="${(i * bw + 1).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${h.toFixed(1)}" class="${x0 + (hi - lo) / N / 2 >= 0 ? "pos" : "neg"}"/>`; }).join("")}
      <line x1="${zero}" x2="${zero}" y1="0" y2="${H}" class="zero"/>
    </svg><div class="sm-histax"><span style="left:0">${n1(lo)}</span><span style="left:${(zero / W * 100).toFixed(1)}%">0</span><span style="left:100%">${n1(hi)}</span></div></div>`;
  }

  function lineChart(title, run, key, c, unit) {
    const W = 600, H = 150, L = c.length;
    const all = [0, 1].flatMap((i) => run[key][i].filter((v, j) => isFinite(v) && (key !== "v" || run.p[i][j] > 60)));
    if (!all.length) return "";
    let lo = Math.min(...all), hi = Math.max(...all); if (hi - lo < 1e-6) hi = lo + 1;
    const x = (m) => (m / L * W).toFixed(1), y = (v) => (H - (v - lo) / (hi - lo) * (H - 8) - 4).toFixed(1);
    const yc = (v) => y(Math.max(lo, Math.min(hi, v)));
    const path = (i) => run.p[i].map((m, j) => `${j ? "L" : "M"}${x(Math.min(m, L))},${yc(run[key][i][j])}`).join("");
    const phases = c.phases.map(([a, b], i) => `<rect x="${x(a)}" width="${(x(b) - x(a)).toFixed(1)}" y="0" height="${H}" class="ph${i}"/>`).join("");
    return `<div class="sm-chart"><div class="sm-ct">${title}<span>${unit ? `${lo.toFixed(1).replace(".", ",")}–${hi.toFixed(1).replace(".", ",")} ${unit}` : `${Math.round(lo)}–${Math.round(hi)}`}</span></div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${phases}<path d="${path(0)}" class="la"/><path d="${path(1)}" class="lb"/></svg></div>`;
  }

  function skillBars(run, c) {
    const L = c.length;
    const row = (i, cls) => Object.entries(run.sk[i] || {}).map(([id, acts]) => acts.map(([a, b]) => {
      const end = b < 0 ? Math.min(L, a + 30) : b;
      return `<span class="sm-act ${cls}" style="left:${(a / L * 100).toFixed(2)}%;width:${Math.max(0.6, (end - a) / L * 100).toFixed(2)}%" data-skill="${id}" title="${esc(skillName(id))}: ${Math.round(a)}–${Math.round(end)} m"></span>`;
    }).join("")).join("");
    const list = (i) => Object.entries(run.sk[i] || {}).map(([id, acts]) => `<span class="tag sktag" data-skill="${id}">${skillIcon(id)}${esc(skillName(id))} · ${acts.map(([a]) => Math.round(a) + " m").join(", ")}</span>`).join("") || `<span class="hint">Devreye giren skill yok</span>`;
    return `<div class="sm-sk"><div class="sm-ct">Skill'lerin devreye girdiği yerler <span>medyan yarış</span></div>
      <div class="sm-skrow"><b class="blue">A</b><div class="sm-sktrack">${row(0, "a")}</div></div>
      <div class="sm-skrow"><b class="pink">B</b><div class="sm-sktrack">${row(1, "b")}</div></div>
      <div class="sm-sklist"><div><b class="blue">A</b> ${list(0)}</div><div><b class="pink">B</b> ${list(1)}</div></div></div>`;
  }

  function chartsHtml(run, c) {
    return `<div class="sm-legend"><span><i class="la"></i>Koşucu A</span><span><i class="lb"></i>Koşucu B</span><span class="hint">Grafikler medyan yarıştan, yatay eksen mesafe</span></div>
      ${lineChart("Hız", run, "v", c, "m/s")}${lineChart("Dayanıklılık (HP)", run, "hp", c, "")}${skillBars(run, c)}`;
  }

  /* ---------- sayfa ---------- */
  function render(app) {
    if (!T()) { app.innerHTML = `<p class="loading">Yükleniyor…</p>`; needTools(() => { if (location.hash === "#araclar/simulator") render(app); }); return; }
    if (!S.a) S.a = defaultRunner(100101);
    if (!S.b) { S.b = defaultRunner(100101); S.b.skills = ["200331"]; }
    const c = course();
    const tracks = [...new Set(simCourses().map((x) => x.track))];
    const seg = (field, opts) => `<span class="seg" role="group">${opts.map(([v, n]) => `<button type="button" data-race="${field}" data-v="${v}" class="${S[field] === v ? "on" : ""}">${n}</button>`).join("")}</span>`;
    app.innerHTML = `
      <div class="page-head"><h1>Yarış Simülatörü</h1></div>
      <p class="hint sm-intro">İki Uma'yı aynı parkurda, aynı şartlarda yüzlerce kez koşturur ve aradaki farkı boy olarak gösterir. Bir skill'in, statın ya da stratejinin ne kadar fark yarattığını görmek için iki koşucuyu sadece o noktada farklı kur.</p>
      <section class="panel wide sm-race">
        <h2>Yarış</h2>
        <div class="frow">
          <select class="select" data-race="course" aria-label="Parkur">${tracks.map((t) => `<optgroup label="${esc(t)}">${simCourses().filter((x) => x.track === t).map((x) => `<option value="${x.id}" ${x.id === S.course ? "selected" : ""}>${esc(t)} ${x.terrain === "Turf" ? "Çim" : "Dirt"} ${x.length} m${x.inout === 2 ? " İç" : x.inout === 3 ? " Dış" : ""}${x.races[0] ? " · " + esc(x.races[0][0]) : ""}</option>`).join("")}</optgroup>`).join("")}</select>
        </div>
        <div class="frow"><span class="flabel">Zemin</span>${seg("ground", GROUND)}</div>
        <div class="frow"><span class="flabel">Hava</span>${seg("weather", WEATHER)}</div>
        <div class="frow"><span class="flabel">Mevsim</span>${seg("season", SEASON)}</div>
        <div class="frow"><span class="flabel">Yarış sayısı</span>${seg("n", [[100, "100"], [300, "300"], [1000, "1000"]])}
          <button type="button" class="toggle small ${S.posKeep ? "on" : ""}" data-race="posKeep" aria-pressed="${S.posKeep}"><span class="knob" aria-hidden="true"></span>Konum koruma</button></div>
        <div class="sm-course">${window.UmaTracks ? window.UmaTracks.strip(c) : ""}</div>
      </section>
      <div class="sm-runners">${runnerCard("a", S.a, "blue")}${runnerCard("b", S.b, "pink")}</div>
      <div class="sm-go"><button type="button" class="dl-btn" data-simrun ${running ? "disabled" : ""}>${running ? "Hesaplanıyor…" : "Simülasyonu çalıştır"}</button></div>
      <div id="smResult">${resultHtml()}</div>
      <p class="source">Yarış hesabı alpha123'ün açık kaynak motoruyla yapılır: <a href="https://github.com/alpha123/uma-tools" target="_blank" rel="noopener">uma-tools</a> ve <a href="https://github.com/alpha123/uma-skill-tools" target="_blank" rel="noopener">uma-skill-tools</a>, GPL-3.0, <a href="https://github.com/umacollector/umacollector.github.io/tree/main/kaynak" target="_blank" rel="noopener">köprü kodumuz</a>. Motor her Uma'yı tek başına koşturur; diğer koşucuların etkisi olasılıkla modellenir.</p>`;
  }

  function run(rerender) {
    if (running) return;
    const c = course();
    const mk = (r) => {
      const apt = aptFor(r), uq = uniqueOf(r);
      return { outfitId: String(r.uma), starCount: 3, speed: +r.speed, stamina: +r.stamina, power: +r.power, guts: +r.guts, wisdom: +r.wisdom,
        strategy: r.strategy, distanceAptitude: apt.dist, surfaceAptitude: apt.surf, strategyAptitude: apt.strat, mood: +r.mood,
        skills: (uq ? [uq] : []).concat(r.skills).filter((id) => !(T().skills[id] || {}).x) };
    };
    try { if (!worker) worker = new Worker("js/motor.worker.js" + stamp()); } catch (e) {
      result = { error: "Tarayıcı motoru başlatamadı. Siteyi dosyadan değil, internet adresinden aç." }; rerender(); return;
    }
    const id = ++runId;
    running = true; result = null; rerender();
    worker.onmessage = (e) => {
      const m = e.data; if (m.id !== id) return;
      if (m.type === "error") { running = false; result = { error: m.error }; }
      else { result = { stats: m.stats, run: m.run }; if (m.final) running = false; }
      const box = document.getElementById("smResult");
      if (box) box.innerHTML = resultHtml();
      const btn = document.querySelector("[data-simrun]");
      if (btn) { btn.disabled = running; btn.textContent = running ? "Hesaplanıyor…" : "Simülasyonu çalıştır"; }
    };
    worker.postMessage({ id, msg: "compare", data: { courseId: c.id, race: { ground: S.ground, weather: S.weather, season: S.season, time: 2 },
      uma1: mk(S.a), uma2: mk(S.b), nsamples: S.n, options: { seed: (Math.random() * 2 ** 31) | 0, usePosKeep: S.posKeep, useCompeteTop: false, useIntChecks: false } } });
  }

  function suggest(key, q) {
    const box = document.querySelector(`[data-sug="${key}"]`);
    if (!box) return;
    q = q.trim().toLocaleLowerCase("tr");
    if (!q) { box.innerHTML = ""; return; }
    const r = S[key];
    const have = new Set(r.skills.concat([uniqueOf(r)]));
    const hits = Object.entries(T().skills).filter(([id, s]) => s.k !== "unique" && !s.x && !have.has(id)
      && (s.n.toLowerCase().includes(q) || (s.tr || "").toLocaleLowerCase("tr").includes(q))).slice(0, 12);
    box.innerHTML = hits.map(([id, s]) => `<button type="button" class="sm-sugi" data-r="${key}" data-addskill="${id}">${skillIcon(id)}<span><b>${esc(s.n)}</b><small>${esc(s.tr || s.en)}</small></span><i>${s.c ? s.c + " SP" : ""}</i></button>`).join("") || `<div class="hint sm-none">Bulunamadı</div>`;
  }

  window.UmaSim = {
    render, defaultRunner, aptFor, simCourses, needTools, STRATS, GRADES,
    // Skill Gezgini'nden: aynı Uma, B'de o skill fazladan
    tryWith(courseId, runner, id) {
      S.course = courseId; S.a = JSON.parse(JSON.stringify(runner)); S.b = JSON.parse(JSON.stringify(runner));
      if (!S.b.skills.includes(id)) S.b.skills.push(id);
      result = null; save(); location.hash = "#araclar/simulator";
    },
    handle(ev, rerender) {
      const t = ev.target;
      const race = t.closest("[data-race]");
      if (race && race.tagName === "BUTTON") {
        const f = race.dataset.race;
        if (f === "posKeep") S.posKeep = !S.posKeep; else S[f] = Number(race.dataset.v);
        save(); rerender(); return true;
      }
      if (t.closest("[data-simrun]")) { run(rerender); return true; }
      const add = t.closest("[data-addskill]");
      if (add) { const r = S[add.dataset.r]; r.skills.push(add.dataset.addskill); save(); rerender(); const inp = document.querySelector(`[data-find][data-r="${add.dataset.r}"]`); if (inp) inp.focus(); return true; }
      const del = t.closest("[data-del]");
      if (del) { const r = S[del.dataset.r]; r.skills = r.skills.filter((x) => x !== del.dataset.del); save(); rerender(); return true; }
      const act = t.closest("button[data-act]");
      if (act) {
        const k = act.dataset.r, o = k === "a" ? "b" : "a";
        if (act.dataset.act === "guide") { const d = defaultRunner(S[k].uma); Object.assign(S[k], { speed: d.speed, stamina: d.stamina, power: d.power, guts: d.guts, wisdom: d.wisdom, strategy: d.strategy }); }
        if (act.dataset.act === "copy") S[o] = JSON.parse(JSON.stringify(S[k]));
        save(); rerender(); return true;
      }
      return false;
    },
    input(ev, rerender) {
      const t = ev.target;
      if (t.dataset.find) { suggest(t.dataset.r, t.value); return true; }
      if (t.dataset.race === "course") { S.course = Number(t.value); result = null; save(); rerender(); return true; }
      const k = t.dataset.r;
      if (!k) return false;
      const r = S[k];
      if (t.dataset.act === "team" && t.value !== "") {
        const m = window.UmaApp.team()[Number(t.value)];
        if (m) { Object.assign(r, { speed: m.stats[0], stamina: m.stats[1], power: m.stats[2], guts: m.stats[3], wisdom: m.stats[4] });
          if (m.uma) r.uma = m.uma; r.apt = null; }
        save(); rerender(); return true;
      }
      if (t.dataset.apt) { r.apt = { ...(r.apt || {}), [t.dataset.apt]: t.value }; save(); return true; }
      const f = t.dataset.f;
      if (!f) return false;
      if (f === "uma") { r.uma = Number(t.value); r.apt = null; const d = defaultRunner(r.uma); r.strategy = d.strategy; save(); rerender(); return true; }
      if (f === "strategy") { r.strategy = t.value; if (r.apt) delete r.apt.strat; save(); rerender(); return true; }
      if (f === "mood") { r.mood = Number(t.value); save(); return true; }
      r[f] = Math.max(1, Math.min(2000, Number(t.value) || 1)); save(); return true;
    },
  };
})();
