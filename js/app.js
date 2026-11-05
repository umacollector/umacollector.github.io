/* UmaUma: Global'deki tüm Umalar, destek kartları ve Team Trials rehberleri */
(() => {
  "use strict";

  const app = document.getElementById("app");
  const DATA = { umas: [], cards: [], effects: {}, guides: {}, cardById: {}, umaById: {} };

  const GRADES = ["S", "A", "B", "C", "D", "E", "F", "G"];
  const gradeRank = (g) => { const i = GRADES.indexOf(g); return i < 0 ? 99 : i; };
  const APT_ROWS = [
    ["Zemin", [["turf", "Turf"], ["dirt", "Dirt"]]],
    ["Mesafe", [["sprint", "Sprint"], ["mile", "Mile"], ["medium", "Medium"], ["long", "Long"]]],
    ["Stil", [["front", "Front"], ["pace", "Pace"], ["late", "Late"], ["end", "End"]]],
  ];
  const STATS = ["Speed", "Stamina", "Power", "Guts", "Wit"];
  const STAT_KEYS = ["speed", "stamina", "power", "guts", "wit"];
  const TYPES = ["Speed", "Stamina", "Power", "Guts", "Wit", "Pal", "Group"];
  const RARITIES = ["SSR", "SR", "R"];
  const BASE_LVL = { R: 20, SR: 25, SSR: 30 };
  const LV_POINTS = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
  const EFFECT_ORDER = [16, 15, 1, 8, 2, 19, 14, 18, 17, 30, 28, 27, 25, 26, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13];
  const FAN_BONUS = 16;
  const STAT_BAR_MAX = 1600;

  const store = {
    get(k, d) { try { const v = localStorage.getItem("umauma." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("umauma." + k, JSON.stringify(v)); } catch (e) { /* yok say */ } },
  };

  const umaState = { q: "", stars: new Set(), apt: new Set(), minGrade: "A", sort: "new", guideOnly: false };
  const cardState = { q: "", types: new Set(), rar: new Set(), uncap: store.get("uncap", 4), sort: "new" };
  let openKey = null;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (d) => { const [y, m, g] = String(d || "").split("-"); return y ? `${g}.${m}.${y}` : ""; };
  const norm = (s) => String(s || "").toLocaleLowerCase("tr");
  const umaImg = (u, big) => `img/${big ? "uma_l" : "uma"}/${u.id}.png`;
  const cardImg = (c) => `img/card/${c.id}.png`;
  const hideBroken = `onerror="this.style.visibility='hidden'"`;

  /* ---------------- kart etkileri ---------------- */
  const levelFor = (card, uncap) => BASE_LVL[card.rarity] + 5 * uncap;

  // Değerler seviyeler arasında doğrusal artar ve aşağı yuvarlanır (oyundaki değerlerle doğrulandı).
  function effectAt(vals, lv) {
    const pts = [];
    vals.forEach((x, i) => { if (x !== -1) pts.push([LV_POINTS[i], x]); });
    if (!pts.length || lv < pts[0][0]) return { value: null, unlock: pts.length ? pts[0][0] : null };
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, x] = pts[i], [b, y] = pts[i + 1];
      if (lv >= a && lv <= b) return { value: Math.floor(x + (y - x) * (lv - a) / (b - a)) };
    }
    return { value: pts[pts.length - 1][1] };
  }

  function cardEffects(card, lv) {
    return card.effects.map(([id, ...vals]) => {
      const info = DATA.effects[id] || { name: "Etki " + id, pct: false };
      const r = effectAt(vals, lv);
      return { id, name: info.name, pct: info.pct, value: r.value, unlock: r.unlock };
    });
  }

  const fmtEffect = (e, v) => (v === null || v === undefined) ? "" : (e.id === 17 ? "Lv " + v : v + (e.pct ? "%" : ""));

  /* ---------------- ortak parçalar ---------------- */
  const chip = (label, on, data, extra = "") =>
    `<button type="button" class="chip ${extra} ${on ? "on" : ""}" ${data} aria-pressed="${on}">${label}</button>`;
  const pageHead = (title, shown, total) =>
    `<div class="page-head"><h1>${title}</h1><span class="count">${shown} / ${total}</span></div>`;
  const starsHtml = (n) => "★".repeat(n) + `<span class="off">${"★".repeat(Math.max(0, 3 - n))}</span>`;

  function aptGrid(u, focus = []) {
    return `<div class="apt">${APT_ROWS.map(([label, keys]) =>
      `<span class="apt-l">${label}</span><span class="apt-r">${keys.map(([k, n]) =>
        `<span class="g g${esc(u.apt[k])} ${focus.includes(k) ? "focus" : ""}">${n}<b>${esc(u.apt[k])}</b></span>`).join("")}</span>`).join("")}</div>`;
  }
  const growthHtml = (u) => u.growth.map((v, i) => v ? `<span class="gr">${STATS[i]} +${v}%</span>` : "").join("");

  function cardMini(id, extra = "") {
    const c = DATA.cardById[id];
    if (!c) return `<div class="cmini missing">Kart bulunamadı</div>`;
    return `<a class="cmini ${extra}" href="#kartlar" data-card="${c.id}" title="${esc(c.name + " " + c.title)}">
      <img src="${cardImg(c)}" alt="" ${hideBroken}>
      <span class="cm-txt"><span class="cm-name">${esc(c.name)}</span><span class="cm-title">${esc(c.title)}</span>
      <span class="cm-badges"><span class="rar ${c.rarity}">${c.rarity}</span><span class="type ${esc(c.type)}">${esc(c.type)}</span></span></span>
    </a>`;
  }

  /* ---------------- UMALAR ---------------- */
  function filteredUmas() {
    const q = norm(umaState.q);
    const min = gradeRank(umaState.minGrade);
    const list = DATA.umas.filter((u) => {
      if (umaState.guideOnly && !u.guide) return false;
      if (q && !norm(`${u.name} ${u.title} ${u.unique?.name || ""}`).includes(q)) return false;
      if (umaState.stars.size && !umaState.stars.has(u.stars)) return false;
      for (const k of umaState.apt) if (gradeRank(u.apt[k]) > min) return false;
      return true;
    });
    const by = {
      new: (a, b) => b.release.localeCompare(a.release) || a.name.localeCompare(b.name),
      old: (a, b) => a.release.localeCompare(b.release) || a.name.localeCompare(b.name),
      name: (a, b) => a.name.localeCompare(b.name) || a.title.localeCompare(b.title),
    }[umaState.sort];
    return list.sort(by);
  }

  function umaBox(u) {
    const g = DATA.guides[u.id];
    return `<a class="box uma" href="#uma/${u.id}">
      ${u.guide ? `<span class="ribbon">Rehber</span>` : ""}
      <div class="uma-top">
        <img class="uma-thumb" src="${umaImg(u)}" alt="" loading="lazy" ${hideBroken}>
        <div class="uma-id">
          <div class="name">${esc(u.name)}</div><div class="title">${esc(u.title)}</div>
          <div class="stars" aria-label="${u.stars} yıldız">${starsHtml(u.stars)}</div>
          ${g ? `<div class="tt">Team Trials: <b>${esc(g.team_trials)}</b> · ${esc(g.style)}</div>` : ""}
        </div>
      </div>
      ${aptGrid(u, g ? g.focus.keys : [])}
      <div class="growth">${growthHtml(u)}</div>
    </a>`;
  }

  function renderUmas() {
    const list = filteredUmas();
    const aptChips = APT_ROWS.flatMap(([, keys]) => keys).map(([k, n]) =>
      chip(n, umaState.apt.has(k), `data-apt="${k}"`, "green")).join("");
    const guideCount = DATA.umas.filter((u) => u.guide).length;
    app.innerHTML = `
      ${pageHead("Umalar", list.length, DATA.umas.length)}
      <section class="filters" aria-label="Uma filtreleri">
        <div class="frow">
          <input class="search" id="uq" type="search" placeholder="İsim, ünvan ya da özel skill ara" value="${esc(umaState.q)}">
          <select class="select" id="usort" aria-label="Sıralama">
            <option value="new" ${umaState.sort === "new" ? "selected" : ""}>En yeni</option>
            <option value="old" ${umaState.sort === "old" ? "selected" : ""}>En eski</option>
            <option value="name" ${umaState.sort === "name" ? "selected" : ""}>İsim (A-Z)</option>
          </select>
        </div>
        <div class="frow"><span class="flabel">Yıldız</span>
          ${[3, 2, 1].map((s) => chip("★".repeat(s), umaState.stars.has(s), `data-star="${s}"`, "yellow")).join("")}
          ${chip(`Rehberi olanlar (${guideCount})`, umaState.guideOnly, `data-guideonly="1"`)}
        </div>
        <div class="frow"><span class="flabel">Uygunluk</span>
          ${aptChips}
          <span class="seg" role="group" aria-label="En az not">
            ${["S", "A", "B"].map((g) => `<button type="button" data-min="${g}" class="${umaState.minGrade === g ? "on" : ""}">${g}${g === "S" ? "" : "+"}</button>`).join("")}
          </span>
          <button type="button" class="reset" id="ureset">Temizle</button>
        </div>
        <div class="hint">Uygunlukta seçtiğin her şeyin en az seçili notta olduğu Umalar görünür. Bir Uma'ya tıklayınca sayfası açılır.</div>
      </section>
      <div class="grid">${list.map(umaBox).join("") || `<div class="empty">Bu filtrelere uyan Uma yok.</div>`}</div>`;
  }

  /* ---------------- UMA SAYFASI / REHBER ---------------- */
  function skillChip(s) {
    const icon = s.icon ? `<img src="img/skill/${s.icon}.png" alt="" ${hideBroken}>` : "";
    const base = s.base ? `<span class="sk-base">${s.base.icon ? `<img src="img/skill/${s.base.icon}.png" alt="" ${hideBroken}>` : ""}önce: ${esc(s.base.name)}</span>` : "";
    return `<li class="sk ${s.gold ? "gold" : ""}" title="${esc(s.desc || "")}">
      <span class="sk-main">${icon}<span>${esc(s.name)}</span></span>${base}</li>`;
  }

  function deckRow(title, ids, flex, note) {
    const slots = ids.map((id) => cardMini(id)).join("");
    return `<div class="deck">
      <h3>${title}</h3>
      <div class="deck-row">${slots}
        <div class="flex-slot">${cardMini(flex, "key")}<span class="flex-tag">6. slot · esnek</span><span class="key-tag">★ Kritik kart</span></div>
      </div>
      ${note ? `<p class="hint">${esc(note)}</p>` : ""}
    </div>`;
  }

  function renderUmaPage(id) {
    const u = DATA.umaById[id];
    if (!u) { app.innerHTML = `<p class="loading">Bu Uma bulunamadı. <a href="#umalar">Umalar'a dön</a></p>`; return; }
    const g = DATA.guides[id];
    const hero = `
      <a class="back" href="#umalar">← Umalar</a>
      <section class="hero">
        <div class="hero-img"><img src="${umaImg(u, true)}" alt="${esc(u.name)}" ${hideBroken}></div>
        <div class="hero-info">
          <div class="stars big">${starsHtml(u.stars)}</div>
          <h1>${esc(u.name)}</h1>
          <div class="title">${esc(u.title)}</div>
          ${g ? `<div class="hero-tags">
            <span class="htag pink">Team Trials: ${esc(g.team_trials)}</span>
            <span class="htag yellow">${esc(g.style)}</span>
            <span class="htag green">${esc(g.scenario)}</span></div>` : ""}
          ${aptGrid(u, g ? g.focus.keys : [])}
          <div class="growth">${growthHtml(u)}</div>
          ${u.unique ? `<div class="unique"><b>Özel skill: ${esc(u.unique.name)}</b><p>${esc(u.unique.desc)}</p></div>` : ""}
        </div>
      </section>`;
    if (!g) {
      app.innerHTML = hero + `<section class="panel soon"><h2>Rehber</h2><p>Bu Uma için Team Trials rehberi henüz eklenmedi.</p></section>`;
      return;
    }
    const bars = STAT_KEYS.map((k, i) => {
      const raw = g.stats[k];
      const n = parseInt(raw, 10) || 0;
      const w = Math.min(100, Math.round(n / STAT_BAR_MAX * 100));
      return `<div class="sbar"><span class="sb-l"><i class="sdot ${STATS[i]}"></i>${STATS[i]}</span>
        <span class="sb-track"><span class="sb-fill ${STATS[i]}" style="width:${w}%"></span></span>
        <b class="sb-v">${esc(raw)}</b></div>`;
    }).join("");
    const skillCols = Object.entries(g.skills).map(([grp, list]) =>
      `<div class="skcol"><h3>${esc(grp)}</h3><ul class="sklist">${list.map(skillChip).join("")}</ul></div>`).join("");
    const alts = Object.entries(g.alternates).map(([type, ids]) =>
      `<div class="alt-group"><h3><span class="type ${esc(type)}">${esc(type)}</span></h3><div class="alt-row">${ids.map((i) => cardMini(i, "small")).join("")}</div></div>`).join("");
    const prio = g.parents.priority.map((s, i) => `<span class="prio ${esc(s)}"><i>${i + 1}</i>${esc(s)}</span>`).join(`<span class="gt">›</span>`);
    app.innerHTML = hero + `
      <div class="guide">
        <section class="panel">
          <h2>Hedef statlar</h2>
          <div class="sbars">${bars}</div>
          ${g.milestone ? `<p class="hint">Ara hedef: ${esc(g.milestone)}</p>` : ""}
          <p class="hint">Senaryo: <b>${esc(g.scenario)}</b>. ${esc(g.scenario_note || "")}</p>
        </section>
        <section class="panel">
          <h2>Uygunluk odağı</h2>
          <ul class="notes">${g.focus.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
        </section>
        <section class="panel wide">
          <h2>Önerilen skill'ler</h2>
          <p class="hint">Altın çerçeveliler altın skill. "önce" yazan skill, altın skill'in alt (beyaz) sürümüdür.</p>
          <div class="skcols">${skillCols}</div>
        </section>
        <section class="panel wide">
          <h2>Desteler</h2>
          <p class="hint">Dağılım: ${esc(g.deck.mix)}. 6. slot arkadaştan ödünç alınabilen esnek slot, iki destede de kritik kart orada.</p>
          ${deckRow("Önerilen deste", g.deck.main, g.deck.flex)}
          ${deckRow("Budget deste", g.deck.budget, g.deck.flex, g.deck.flex_note)}
        </section>
        <section class="panel wide">
          <h2>Yedek kartlar</h2>
          <p class="hint">Destedeki bir kart sende yoksa aynı türden bunlardan biriyle değiştir.</p>
          ${alts}
        </section>
        <section class="panel wide">
          <h2>Veteran (ebeveyn) Umalar</h2>
          <div class="prio-row">${prio}</div>
          <p class="hint">${esc(g.parents.priority_note || "")}</p>
          <h3>Pembe spark (uygunluk)</h3>
          <div class="taglist">${g.parents.pink.map((p) => `<span class="tag pinkt">${esc(p)}</span>`).join("")}</div>
          ${g.parents.pink_note ? `<p class="hint">${esc(g.parents.pink_note)}</p>` : ""}
        </section>
        <p class="source">Kaynak: <a href="${esc(g.source.url)}" target="_blank" rel="noopener">${esc(g.source.name)}</a>, ${fmtDate(g.source.updated)} tarihli rehber. Notlar UmaUma tarafından özetlendi.</p>
      </div>`;
  }

  /* ---------------- KARTLAR ---------------- */
  function sortableEffects() {
    const present = new Set();
    DATA.cards.forEach((c) => c.effects.forEach(([id]) => present.add(id)));
    const ordered = EFFECT_ORDER.filter((id) => present.has(id) && DATA.effects[id]);
    present.forEach((id) => { if (!ordered.includes(id) && DATA.effects[id]) ordered.push(id); });
    return ordered;
  }

  function filteredCards() {
    const q = norm(cardState.q);
    const list = DATA.cards.filter((c) => {
      if (q && !norm(`${c.name} ${c.title} ${c.hints.join(" ")} ${c.events.join(" ")}`).includes(q)) return false;
      if (cardState.types.size && !cardState.types.has(c.type)) return false;
      if (cardState.rar.size && !cardState.rar.has(c.rarity)) return false;
      return true;
    });
    const s = cardState.sort;
    if (s.startsWith("eff:")) {
      const id = Number(s.slice(4));
      const val = (c) => {
        const e = c.effects.find(([eid]) => eid === id);
        return e ? (effectAt(e.slice(1), levelFor(c, cardState.uncap)).value ?? -1) : -1;
      };
      return list.sort((a, b) => val(b) - val(a) || b.release.localeCompare(a.release));
    }
    const by = {
      new: (a, b) => b.release.localeCompare(a.release) || b.id - a.id,
      old: (a, b) => a.release.localeCompare(b.release) || a.id - b.id,
      name: (a, b) => a.name.localeCompare(b.name) || a.title.localeCompare(b.title),
    }[s];
    return list.sort(by);
  }

  function uniqueText(c) {
    if (!c.unique) return "";
    const parts = c.unique.effects.map((e) => {
      const info = DATA.effects[e.type];
      return info && e.type < 100 ? `${esc(info.name)} +${e.value}${info.pct ? "%" : ""}` : "Özel koşullu etki";
    });
    return `<h4>Özel bonus (Lvl ${c.unique.level}'de açılır)</h4><p>${parts.join(", ")}</p>`;
  }

  function cardBox(c) {
    const key = "c" + c.id;
    const open = openKey === key;
    const lv = levelFor(c, cardState.uncap);
    const sortId = cardState.sort.startsWith("eff:") ? Number(cardState.sort.slice(4)) : null;
    const effs = cardEffects(c, lv);
    const active = effs.filter((e) => e.value !== null && e.value !== 0);
    const locked = effs.filter((e) => e.value === null);
    active.sort((a, b) => (b.id === sortId) - (a.id === sortId));
    const shown = open ? active : active.slice(0, 5);
    const row = (e) => `<li class="${e.id === sortId ? "hl" : ""} ${e.id === FAN_BONUS ? "fan" : ""}"><span>${esc(e.name)}</span><b>${fmtEffect(e, e.value)}</b></li>`;
    const lockedRows = open ? locked.map((e) => `<li class="locked"><span>${esc(e.name)}</span><span>Lvl ${e.unlock}'de</span></li>`).join("") : "";
    const hidden = active.length - shown.length;
    return `<article class="box card ${esc(c.type)} ${open ? "open" : ""}" data-key="${key}" tabindex="0" aria-expanded="${open}">
      <div class="card-top">
        <img class="card-img" src="${cardImg(c)}" alt="" loading="lazy" ${hideBroken}>
        <div class="card-id">
          <div class="badges"><span class="rar ${c.rarity}">${c.rarity}</span><span class="type ${esc(c.type)}">${esc(c.type)}</span></div>
          <div class="name">${esc(c.name)}</div><div class="title">${esc(c.title)}</div>
          <div class="lvl">Lvl ${lv}${hidden > 0 ? ` · ${hidden} etki daha` : ""}</div>
        </div>
      </div>
      <ul class="eff">${shown.map(row).join("")}${lockedRows}</ul>
      <div class="more">
        ${uniqueText(c)}
        ${c.hints.length ? `<h4>Skill ipuçları</h4><div class="taglist">${c.hints.map((h) => `<span class="tag">${esc(h)}</span>`).join("")}</div>` : ""}
        ${c.events.length ? `<h4>Olay skilleri</h4><div class="taglist">${c.events.map((h) => `<span class="tag">${esc(h)}</span>`).join("")}</div>` : ""}
        <div class="date">Global çıkış: ${fmtDate(c.release)}</div>
        <div class="close-hint">Kapatmak için tekrar tıkla</div>
      </div>
    </article>`;
  }

  function renderCards() {
    const list = filteredCards();
    const effOpts = sortableEffects().map((id) =>
      `<option value="eff:${id}" ${cardState.sort === "eff:" + id ? "selected" : ""}>${esc(DATA.effects[id].name)}</option>`).join("");
    app.innerHTML = `
      ${pageHead("Kartlar", list.length, DATA.cards.length)}
      <section class="filters" aria-label="Kart filtreleri">
        <div class="frow">
          <input class="search" id="cq" type="search" placeholder="İsim, ünvan ya da skill ipucu ara" value="${esc(cardState.q)}">
          <select class="select" id="csort" aria-label="Sıralama">
            <optgroup label="Genel">
              <option value="new" ${cardState.sort === "new" ? "selected" : ""}>En yeni</option>
              <option value="old" ${cardState.sort === "old" ? "selected" : ""}>En eski</option>
              <option value="name" ${cardState.sort === "name" ? "selected" : ""}>İsim (A-Z)</option>
            </optgroup>
            <optgroup label="Etkiye göre (yüksekten düşüğe)">${effOpts}</optgroup>
          </select>
        </div>
        <div class="frow"><span class="flabel">Tür</span>
          ${TYPES.map((t) => chip(`<span class="dot" style="background:var(--t-${t.toLowerCase()})"></span>${t}`, cardState.types.has(t), `data-type="${t}"`)).join("")}
        </div>
        <div class="frow"><span class="flabel">Nadirlik</span>
          ${RARITIES.map((r) => chip(r, cardState.rar.has(r), `data-rar="${r}"`, "yellow")).join("")}
        </div>
        <div class="frow"><span class="flabel">Uncap</span>
          <span class="seg" role="group" aria-label="Uncap">
            ${[0, 1, 2, 3, 4].map((u) => `<button type="button" data-uncap="${u}" class="${cardState.uncap === u ? "on" : ""}">${u === 4 ? "MLB" : u}</button>`).join("")}
          </span>
          <span class="hint">Etki değerleri seçili uncap'in en yüksek seviyesine göre.</span>
          <button type="button" class="reset" id="creset">Temizle</button>
        </div>
      </section>
      <div class="grid">${list.map(cardBox).join("") || `<div class="empty">Bu filtrelere uyan kart yok.</div>`}</div>`;
  }

  /* ---------------- yönlendirme ve olaylar ---------------- */
  function route() {
    const h = location.hash;
    const m = h.match(/^#uma\/(\d+)$/);
    if (m) return { page: "uma", id: Number(m[1]) };
    return { page: h === "#kartlar" ? "kartlar" : "umalar" };
  }

  function render(keepFocus) {
    const r = route();
    const tab = r.page === "uma" ? "umalar" : r.page;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.page === tab));
    const focusId = keepFocus && document.activeElement && document.activeElement.id;
    const caret = focusId && document.activeElement.selectionStart;
    if (r.page === "uma") renderUmaPage(r.id);
    else if (r.page === "kartlar") renderCards();
    else renderUmas();
    document.title = r.page === "uma" && DATA.umaById[r.id] ? `${DATA.umaById[r.id].name} · UmaUma` : "UmaUma";
    if (focusId) {
      const el = document.getElementById(focusId);
      if (el) { el.focus(); if (caret != null && el.setSelectionRange) el.setSelectionRange(caret, caret); }
    }
  }

  const toggle = (set, v) => { set.has(v) ? set.delete(v) : set.add(v); };

  app.addEventListener("input", (ev) => {
    if (ev.target.id === "uq") { umaState.q = ev.target.value; render(true); }
    if (ev.target.id === "cq") { cardState.q = ev.target.value; render(true); }
  });
  app.addEventListener("change", (ev) => {
    if (ev.target.id === "usort") { umaState.sort = ev.target.value; render(); }
    if (ev.target.id === "csort") { cardState.sort = ev.target.value; render(); }
  });
  app.addEventListener("click", (ev) => {
    const mini = ev.target.closest("a.cmini[data-card]");
    if (mini) {
      // Rehberdeki karta tıklanınca Kartlar'da o kart açık gelir
      const c = DATA.cardById[Number(mini.dataset.card)];
      Object.assign(cardState, { q: c.title, types: new Set(), rar: new Set(), sort: "new" });
      openKey = "c" + c.id;
      return;   // href="#kartlar" gezinmeyi yapar
    }
    const b = ev.target.closest("button");
    if (b) {
      const d = b.dataset;
      if (d.star) toggle(umaState.stars, Number(d.star));
      else if (d.apt) toggle(umaState.apt, d.apt);
      else if (d.min) umaState.minGrade = d.min;
      else if (d.guideonly) umaState.guideOnly = !umaState.guideOnly;
      else if (d.type) toggle(cardState.types, d.type);
      else if (d.rar) toggle(cardState.rar, d.rar);
      else if (d.uncap) { cardState.uncap = Number(d.uncap); store.set("uncap", cardState.uncap); }
      else if (b.id === "ureset") Object.assign(umaState, { q: "", stars: new Set(), apt: new Set(), minGrade: "A", sort: "new", guideOnly: false });
      else if (b.id === "creset") Object.assign(cardState, { q: "", types: new Set(), rar: new Set(), sort: "new" });
      else return;
      render();
      return;
    }
    const box = ev.target.closest(".box.card");
    if (box) { openKey = openKey === box.dataset.key ? null : box.dataset.key; render(); }
  });
  app.addEventListener("keydown", (ev) => {
    const box = ev.target.classList && ev.target.classList.contains("card") ? ev.target : null;
    if (box && (ev.key === "Enter" || ev.key === " ")) {
      ev.preventDefault();
      const key = box.dataset.key;
      openKey = openKey === key ? null : key;
      render();
      const again = app.querySelector(`.box[data-key="${key}"]`);
      if (again) again.focus();
    }
  });
  window.addEventListener("hashchange", () => {
    const keepOpen = location.hash === "#kartlar" && openKey;
    if (!keepOpen) openKey = null;
    render();
    const target = keepOpen && app.querySelector(`.box[data-key="${openKey}"]`);
    if (target) target.scrollIntoView({ block: "center" }); else window.scrollTo(0, 0);
  });

  Promise.all(["umas", "cards", "effects", "guides"].map((n) => fetch(`data/${n}.json`).then((r) => {
    if (!r.ok) throw new Error(n);
    return r.json();
  }))).then(([umas, cards, effects, guides]) => {
    Object.assign(DATA, { umas, cards, effects, guides });
    cards.forEach((c) => { DATA.cardById[c.id] = c; });
    umas.forEach((u) => { DATA.umaById[u.id] = u; });
    render();
  }).catch(() => {
    app.innerHTML = `<p class="loading">Veriler yüklenemedi. Sayfayı yenilemeyi dene.</p>`;
  });
})();
