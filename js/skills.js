/* UmaCollector — Skill Gezgini (Araçlar › Skill Gezgini)
   Motorun bildiği bütün Global skill'ler: arama, tür filtresi, kaynak kartlar ve Umalar.
   "Boy kazancı": seçilen Uma'ya her skill tek tek eklenip skill'siz hâliyle aynı yarışlarda koşturulur
   (alpha123'ün açık kaynak motoru, js/motor.worker.js, GPL-3.0). */
(() => {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const T = () => window.UMAUMA_TOOLS;
  const D = () => window.UMAUMA_DATA;
  const SIM = () => window.UmaSim;
  const KINDS = [["all", "Hepsi"], ["gold", "Altın"], ["white", "Beyaz"], ["unique", "Özel"], ["inherit", "Kalıtım"], ["debuff", "Rakibe"]];
  const KIND_TAG = { gold: "Altın", white: "Beyaz", unique: "Özel", inherit: "Kalıtım", debuff: "Rakibe" };
  const STATS = [["speed", "Speed"], ["stamina", "Stamina"], ["power", "Power"], ["guts", "Guts"], ["wisdom", "Wit"]];
  const SORTS = [["value", "Boy kazancı"], ["perSp", "100 SP başına kazanç"], ["name", "Ada göre"], ["sp", "SP maliyeti"]];
  const n2 = (v) => v.toFixed(2).replace(".", ",");
  const store = {
    get(k, d) { try { const v = localStorage.getItem("umauma." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("umauma." + k, JSON.stringify(v)); } catch (e) { /* yok say */ } },
  };

  const st = { q: "", kind: "all", sort: "value", open: null, limit: 80 };
  const cfg = store.get("skx", null) || { course: 10906, runner: null };
  let calc = store.get("skx.res", null);   // { key, results, failed, final }
  let busy = false, worker = null, runId = 0;

  const cfgKey = () => JSON.stringify([cfg.course, cfg.runner]);
  const course = () => SIM().simCourses().find((c) => c.id === cfg.course) || SIM().simCourses()[0];
  const computable = (id, s) => !s.x && s.k !== "debuff";

  function valueOf(id) {
    if (!calc || calc.key !== cfgKey()) return null;
    return calc.results[id] || null;
  }

  function settingsHtml() {
    const r = cfg.runner, c = course();
    const tracks = [...new Set(SIM().simCourses().map((x) => x.track))];
    const stale = calc && calc.key !== cfgKey();
    const done = calc && !stale ? Object.keys(calc.results).length : 0;
    return `<section class="panel wide sx-set">
      <h2>Boy kazancı</h2>
      <div class="sx-grid">
        <label class="sx-f"><span>Parkur</span><select class="select" data-sx="course">${tracks.map((t) => `<optgroup label="${esc(t)}">${SIM().simCourses().filter((x) => x.track === t).map((x) => `<option value="${x.id}" ${x.id === c.id ? "selected" : ""}>${esc(t)} ${x.terrain === "Turf" ? "Çim" : "Dirt"} ${x.length} m${x.inout === 2 ? " İç" : x.inout === 3 ? " Dış" : ""}${x.races[0] ? " · " + esc(x.races[0][0]) : ""}</option>`).join("")}</optgroup>`).join("")}</select></label>
        <label class="sx-f"><span>Uma</span><select class="select" data-sx="uma">${D().umas.slice().sort((a, b) => a.name.localeCompare(b.name)).map((u) => `<option value="${u.id}" ${u.id === r.uma ? "selected" : ""}>${esc(u.name)} ${esc(u.title)}</option>`).join("")}</select></label>
        <label class="sx-f sx-s"><span>Strateji</span><select class="select" data-sx="strategy">${SIM().STRATS.map(([v, n]) => `<option value="${v}" ${v === r.strategy ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      </div>
      <div class="sm-stats sx-stats">${STATS.map(([k, n]) => `<label class="sm-stat"><span>${n}</span><input type="number" min="1" max="2000" value="${r[k]}" data-sx="${k}"></label>`).join("")}</div>
      <div class="sx-go">
        <button type="button" class="dl-btn small" data-sxrun ${busy ? "disabled" : ""}>${busy ? "Hesaplanıyor…" : done ? "Yeniden hesapla" : "Değerleri hesapla"}</button>
        <span class="hint">${busy ? `<span class="sm-spin"></span> ${done ? `${done} skill ilk turda ölçüldü, sonuçlar netleşiyor` : "İlk tur sürüyor"}`
          : done ? `${done} skill ölçüldü · ${esc(c.track)} ${c.length} m` : stale ? "Ayarlar değişti, değerler bu ayarlara ait değil" : "Yaklaşık bir dakika sürer, ilk sonuçlar birkaç saniyede gelir"}</span>
      </div>
    </section>`;
  }

  function skillRow(id, s, maxV) {
    const v = valueOf(id);
    const open = st.open === id;
    const icon = s.i ? `<img src="img/skill/${s.i}.png" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : "";
    let val;
    if (s.x) val = `<span class="sx-na">Hesaplanamıyor</span>`;
    else if (s.k === "debuff") val = `<span class="sx-na">Rakiplere etki eder</span>`;
    else if (!v) val = `<span class="sx-na">${calc && calc.key === cfgKey() && calc.final ? "Etkisiz" : "—"}</span>`;
    else {
      const w = Math.max(0, v.mean) / (maxV || 1) * 100;
      val = `<span class="sx-val"><b>${n2(v.mean)}</b><small>boy</small><span class="sx-bar"><i style="width:${w.toFixed(1)}%"></i></span></span>`;
    }
    return `<div class="sx-row ${open ? "open" : ""} k-${s.k}">
      <button type="button" class="sx-main" data-sxopen="${id}" aria-expanded="${open}">
        <span class="sx-ico">${icon}</span>
        <span class="sx-txt"><b>${esc(s.n)}</b><span class="sx-tag k-${s.k}">${KIND_TAG[s.k]}</span>${s.c ? `<span class="sx-sp">${s.c} SP</span>` : ""}
          <small>${esc(s.tr || s.en)}</small></span>
        ${val}
      </button>
      ${open ? detailHtml(id, s, v) : ""}
    </div>`;
  }

  function detailHtml(id, s, v) {
    const umaById = window.UmaApp.umaById;
    const cards = (s.cards || []).map((cid) => D().cards.find((c) => c.id === cid)).filter(Boolean);
    const umas = (s.umas || []).map((uid) => umaById[uid]).filter(Boolean);
    const mini = (src, name, href) => `<a class="sx-src" href="${href}" title="${esc(name)}"><img src="${src}" alt="${esc(name)}" loading="lazy"></a>`;
    return `<div class="sx-detail">
      ${v ? `<div class="sx-nums"><div><small>En kötü</small><b>${n2(v.min)}</b></div><div><small>Medyan</small><b>${n2(v.median)}</b></div><div><small>Ortalama</small><b>${n2(v.mean)}</b></div><div><small>En iyi</small><b>${n2(v.max)}</b></div>${s.c ? `<div><small>100 SP başına</small><b>${n2(v.mean / s.c * 100)}</b></div>` : ""}</div>` : ""}
      ${s.en && s.tr ? `<p class="sx-en">${esc(s.en)}</p>` : ""}
      ${umas.length ? `<div class="sx-srch">Umalar</div><div class="sx-srcs">${umas.map((u) => mini(`img/uma/${u.id}.png`, `${u.name} ${u.title}`, `#uma/${u.id}`)).join("")}</div>` : ""}
      ${cards.length ? `<div class="sx-srch">Destek kartları <small>${cards.length}</small></div><div class="sx-srcs cards">${cards.map((c) => mini(`img/card/${c.id}.png`, `${c.name} ${c.title} ${c.rarity}`, "#kartlar")).join("")}</div>` : ""}
      ${computable(id, s) ? `<button type="button" class="chip" data-sxtry="${id}">Simülatörde dene</button>` : ""}
    </div>`;
  }

  function list() {
    const q = st.q.trim().toLocaleLowerCase("tr");
    let rows = Object.entries(T().skills).filter(([id, s]) => (st.kind === "all" || s.k === st.kind)
      && (!q || s.n.toLowerCase().includes(q) || (s.tr || "").toLocaleLowerCase("tr").includes(q) || (s.en || "").toLowerCase().includes(q)));
    const val = (id) => (valueOf(id) ? valueOf(id).mean : -1e9);
    const cmpName = (a, b) => a[1].n.localeCompare(b[1].n);
    if (st.sort === "name") rows.sort(cmpName);
    else if (st.sort === "sp") rows.sort((a, b) => (b[1].c || 0) - (a[1].c || 0) || cmpName(a, b));
    else if (st.sort === "perSp") rows.sort((a, b) => ((b[1].c && valueOf(b[0])) ? val(b[0]) / b[1].c : -1e9) - ((a[1].c && valueOf(a[0])) ? val(a[0]) / a[1].c : -1e9) || cmpName(a, b));
    else rows.sort((a, b) => val(b[0]) - val(a[0]) || cmpName(a, b));
    return rows;
  }

  function render(app) {
    if (!T()) { app.innerHTML = `<p class="loading">Yükleniyor…</p>`; SIM().needTools(() => { if (location.hash === "#araclar/skiller") render(app); }); return; }
    if (!cfg.runner) cfg.runner = SIM().defaultRunner(100101);
    const rows = list();
    const maxV = Math.max(0.01, ...rows.map(([id]) => (valueOf(id) ? valueOf(id).mean : 0)));
    const shown = rows.slice(0, st.limit);
    app.innerHTML = `
      <div class="page-head"><h1>Skill Gezgini</h1><span class="count">${rows.length} / ${Object.keys(T().skills).length}</span></div>
      ${settingsHtml()}
      <div class="filters sx-filters">
        <div class="frow"><input id="skq" class="search" type="search" placeholder="Skill ara: ad ya da açıklama" value="${esc(st.q)}" autocomplete="off">
          <select class="select" data-sx="sort" aria-label="Sıralama">${SORTS.map(([v, n]) => `<option value="${v}" ${v === st.sort ? "selected" : ""}>${n}</option>`).join("")}</select></div>
        <div class="frow">${KINDS.map(([v, n]) => `<button type="button" class="chip ${st.kind === v ? "on" : ""}" data-sxkind="${v}" aria-pressed="${st.kind === v}">${n}</button>`).join("")}</div>
      </div>
      <div class="sx-list">${shown.map(([id, s]) => skillRow(id, s, maxV)).join("") || `<div class="empty">Bu filtrelere uyan skill yok.</div>`}</div>
      ${rows.length > shown.length ? `<div class="sm-go"><button type="button" class="chip" data-sxmore>${rows.length - shown.length} skill daha göster</button></div>` : ""}
      <p class="source">Boy kazancı alpha123'ün açık kaynak motoruyla hesaplanır: <a href="https://github.com/alpha123/uma-tools" target="_blank" rel="noopener">uma-tools</a>, GPL-3.0. Her skill seçilen Uma'ya tek başına eklenir ve skill'siz hâliyle aynı yarışlarda karşılaştırılır.</p>`;
  }

  function run(rerender) {
    if (busy) return;
    const c = course(), r = cfg.runner, apt = SIM().aptFor(r, c);
    const uq = String((window.UmaApp.umaById[r.uma] || {}).unique || "");
    const base = uq && T().skills[uq] && !T().skills[uq].x ? [uq] : [];   // Uma'nın kendi özel skill'i tabanda hep var
    const skills = Object.entries(T().skills).filter(([id, s]) => computable(id, s) && id !== uq).map(([id]) => id);
    try { if (!worker) worker = new Worker("js/motor.worker.js" + (((document.querySelector('script[src*="js/app.js"]') || {}).src || "").match(/\?b=\d+/)?.[0] || "")); }
    catch (e) { return; }
    const id = ++runId, key = cfgKey();
    busy = true; calc = { key, results: {}, failed: [], final: false }; rerender();
    worker.onmessage = (e) => {
      const m = e.data; if (m.id !== id) return;
      if (m.type === "error") { busy = false; if (location.hash === "#araclar/skiller") rerender(true); return; }
      calc = { key, results: m.results, failed: m.failed || [], final: m.final };
      if (m.final) { busy = false; store.set("skx.res", calc); }
      if (location.hash === "#araclar/skiller") rerender(true);
    };
    worker.postMessage({ id, msg: "chart", data: { courseId: c.id, race: { ground: 1, weather: 1, season: 1, time: 2 },
      uma: { outfitId: String(r.uma), starCount: 3, speed: +r.speed, stamina: +r.stamina, power: +r.power, guts: +r.guts, wisdom: +r.wisdom,
        strategy: r.strategy, distanceAptitude: apt.dist, surfaceAptitude: apt.surf, strategyAptitude: apt.strat, mood: 2, skills: base },
      skills, options: { seed: 20261105, usePosKeep: true, useCompeteTop: false, useIntChecks: false } } });
  }

  const save = () => store.set("skx", cfg);
  window.UmaSkills = {
    render,
    handle(ev, rerender) {
      const t = ev.target;
      if (t.closest("[data-sxrun]")) { run(rerender); return true; }
      const k = t.closest("[data-sxkind]");
      if (k) { st.kind = k.dataset.sxkind; st.limit = 80; rerender(); return true; }
      const tr = t.closest("[data-sxtry]");
      if (tr) { SIM().tryWith(course().id, { ...cfg.runner, skills: [] }, tr.dataset.sxtry); return true; }
      const o = t.closest("[data-sxopen]");
      if (o) { st.open = st.open === o.dataset.sxopen ? null : o.dataset.sxopen; rerender(); return true; }
      if (t.closest("[data-sxmore]")) { st.limit += 120; rerender(); return true; }
      return false;
    },
    input(ev, rerender) {
      const t = ev.target;
      if (t.id === "skq") { st.q = t.value; st.limit = 80; rerender(true); return true; }
      const f = t.dataset.sx;
      if (!f || ev.type !== "change") return !!f;
      if (f === "sort") st.sort = t.value;
      else if (f === "course") cfg.course = Number(t.value);
      else if (f === "uma") { const d = SIM().defaultRunner(Number(t.value)); cfg.runner = d; }
      else if (f === "strategy") cfg.runner.strategy = t.value;
      else cfg.runner[f] = Math.max(1, Math.min(2000, Number(t.value) || 1));
      save(); rerender(); return true;
    },
  };
})();
