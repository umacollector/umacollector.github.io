/* UmaCollector: Global'deki tüm Umalar, destek kartları ve Team Trials rehberleri */
(() => {
  "use strict";

  const app = document.getElementById("app");
  const DATA = { umas: [], cards: [], effects: {}, guides: {}, skills: {}, cardById: {}, umaById: {} };

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

  /* ---------------- stat ikonları (UmaCollector'nın kendi çizimleri) ---------------- */
  const ICON_PATHS = {
    Speed: '<path d="M3 15.2c0-.9.6-1.6 1.4-1.8l4.4-1.1 2.1-4.1 3.2 1.1-1 3 3.6 1.2c2.6.9 4.3 2.1 4.3 4.1v.6H3z"/><path d="M3 18.6h18V21H3z"/>',
    Stamina: '<path d="M12 21s-7.4-4.5-9.2-9.1C1.6 8.7 3.7 5 7.1 5c2 0 3.4 1.1 4.9 3 1.5-1.9 2.9-3 4.9-3 3.4 0 5.5 3.7 4.3 6.9C19.4 16.5 12 21 12 21z"/>',
    Power: '<path d="M1.5 10.5h2V8.2h3.2v7.6H3.5v-2.3h-2zM22.5 10.5h-2V8.2h-3.2v7.6h3.2v-2.3h2z"/><path d="M7.5 10.6h9v2.8h-9z"/>',
    Guts: '<path d="M12.2 2c.9 3.4 5.3 5.6 5.3 10.6a5.5 5.5 0 0 1-11 0c0-2.2 1-3.8 2.2-4.9 0 2.1.9 3.2 2.1 3.4-.9-3.3.2-6.4 1.4-9.1z"/>',
    Wit: '<path d="M12 3.5 1 8.8l11 5.3 8.6-4.1v5.8h1.9V8.8z"/><path d="M5.6 12.9v3.6c0 1.9 2.9 3.4 6.4 3.4s6.4-1.5 6.4-3.4v-3.6L12 16z"/>',
    Pal: '<circle cx="12" cy="8" r="4.3"/><path d="M4.5 21c.6-4.3 3.6-7 7.5-7s6.9 2.7 7.5 7z"/>',
    Group: '<circle cx="8" cy="8.5" r="3.4"/><circle cx="16.5" cy="8.5" r="3.4"/><path d="M1.5 20c.5-3.6 3-5.8 6.5-5.8s6 2.2 6.5 5.8zM14.2 14.6c.7-.3 1.5-.4 2.3-.4 3.5 0 6 2.2 6.5 5.8h-6.7c-.3-2.2-1-4-2.1-5.4z"/>',
  };
  // "w": rozet içinde beyaz ikon; varsayılan: renkli daire içinde beyaz ikon
  const statIcon = (name, mode) => ICON_PATHS[name]
    ? `<i class="sico ${mode === "w" ? "plain" : esc(name)}" aria-hidden="true"><svg viewBox="0 0 24 24">${ICON_PATHS[name]}</svg></i>` : "";
  const typeBadge = (t) => `<span class="type ${esc(t)}">${statIcon(t, "w")}${esc(t)}</span>`;

  const store = {
    get(k, d) { try { const v = localStorage.getItem("umauma." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("umauma." + k, JSON.stringify(v)); } catch (e) { /* yok say */ } },
  };

  /* ---------------- envanter (Uma Collector export'ları) ---------------- */
  // Şimdilik bu tarayıcıda saklanır; hesap sistemi gelince hesaba taşınacak.
  const INV = { umas: store.get("inv.umas", null), cards: store.get("inv.cards", null), team: store.get("inv.team", null) };
  const invKey = (name, title) => norm(name) + "|" + norm(String(title || "").replace(/^\[|\]$/g, ""));
  let ownedUma = new Map(), ownedCard = new Map();

  function rebuildOwned() {
    ownedUma = new Map(); ownedCard = new Map();
    (INV.umas?.rows || []).forEach((r) => { if (r.id) ownedUma.set(r.id, r); });
    (INV.cards?.rows || []).forEach((r) => { if (r.id) ownedCard.set(r.id, r); });
  }

  // Uma Collector'ın txt tablosunu okur: başlık satırı, tire satırı, sonra satırlar.
  function parseExport(text) {
    const lines = text.replace(/\r/g, "").split("\n");
    const dashIdx = lines.findIndex((l) => /^-+(\s{2}-+)*\s*$/.test(l.trim()) && l.trim().length > 3);
    if (dashIdx < 1) return null;
    const spans = [];
    const re = /-+/g; let m;
    while ((m = re.exec(lines[dashIdx]))) spans.push([m.index, m.index + m[0].length]);
    const cut = (line, i) => line.slice(spans[i][0], i + 1 < spans.length ? spans[i + 1][0] : undefined).trim();
    const heads = spans.map((_, i) => cut(lines[dashIdx - 1], i));
    const rows = [];
    for (const line of lines.slice(dashIdx + 1)) {
      if (!line.trim()) break;
      const r = {};
      heads.forEach((h, i) => { r[h] = cut(line, i); });
      rows.push(r);
    }
    const dateM = (lines[0] || "").match(/okuma:\s*([0-9-]+ [0-9:]+)/);
    let kind = null;
    if (heads.includes("Potential")) kind = "umas";
    else if (heads.includes("Uncap")) kind = "cards";
    else if (heads.includes("Kategori")) kind = "team";
    return { kind, rows, date: dateM ? dateM[1] : "" };
  }

  // Ünvan birebir tutmazsa (OCR hatası) aynı isimli kayıtlar arasından en benzer ünvanı seçer.
  const bigrams = (s) => { const t = norm(s); const out = new Set(); for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2)); return out; };
  function similar(a, b) {
    const A = bigrams(a), B = bigrams(b); if (!A.size || !B.size) return 0;
    let n = 0; A.forEach((x) => { if (B.has(x)) n++; }); return 2 * n / (A.size + B.size);
  }
  function fuzzyId(list, name, title) {
    const same = list.filter((x) => norm(x.name).replace(/[^a-z0-9]/g, "") === norm(name).replace(/[^a-z0-9]/g, ""));
    let best = null, score = 0.6;
    same.forEach((x) => { const s = similar(x.title, title); if (s > score) { score = s; best = x.id; } });
    return best;
  }

  function importExport(text) {
    const p = parseExport(text);
    if (!p || !p.kind) return { ok: false, msg: "Bu dosya tanınmadı. Uma Collector'ın export klasöründeki umauma.txt, umacard.txt ya da umateam.txt dosyalarından birini seç." };
    let rows, miss = 0;
    if (p.kind === "umas") {
      const idx = new Map(DATA.umas.map((u) => [invKey(u.name, u.title), u.id]));
      rows = p.rows.map((r) => {
        const id = idx.get(invKey(r["İsim"], r["Ünvan"])) || fuzzyId(DATA.umas, r["İsim"], r["Ünvan"]);
        if (!id) miss++;
        return { id, name: r["İsim"], title: r["Ünvan"], stars: Number(r["Yıldız"]) || 0, potential: Number(r["Potential"]) || 0 };
      });
    } else if (p.kind === "cards") {
      const idx = new Map(DATA.cards.map((c) => [invKey(c.name, c.title), c.id]));
      rows = p.rows.map((r) => {
        const id = idx.get(invKey(r["İsim"], r["Ünvan"])) || fuzzyId(DATA.cards, r["İsim"], r["Ünvan"]);
        if (!id) miss++;
        return { id, name: r["İsim"], title: r["Ünvan"], level: Number(r["Seviye"]) || 0, uncap: Number(r["Uncap"]) || 0 };
      });
    } else {
      rows = p.rows.map((r) => ({
        cat: r["Kategori"], slot: r["Sıra"], name: r["İsim"], epithet: r["Lakap"], points: Number(r["Puan"]) || 0,
        stats: STATS.map((s) => Number(r[s]) || 0),
        uma: (DATA.umas.find((u) => norm(u.name) === norm(r["İsim"])) || {}).id || null,
      }));
    }
    INV[p.kind] = { date: p.date, rows };
    store.set("inv." + p.kind, INV[p.kind]);
    cloudSave(p.kind);
    rebuildOwned();
    const label = { umas: "Uma", cards: "kart", team: "takım Uma'sı" }[p.kind];
    return { ok: true, kind: p.kind, msg: `${rows.length} ${label} yüklendi${miss ? `, ${miss} tanesi sitedeki listeyle eşleşmedi` : ""}.` };
  }

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

  /* ---------------- skill'ler ---------------- */
  const skillName = (id) => (DATA.skills[id] || {}).name || "";
  const skillDesc = (id) => { const s = DATA.skills[id] || {}; return s.tr || s.en || ""; };
  const skillTag = (id) => `<span class="tag sktag" data-skill="${id}" tabindex="0">${esc(skillName(id))}</span>`;

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
  const growthHtml = (u) => u.growth.map((v, i) => v ? `<span class="gr">${statIcon(STATS[i], "w")}${STATS[i]} +${v}%</span>` : "").join("");

  function ownBadge(id) {
    if (!INV.cards) return "";
    const o = ownedCard.get(id);
    return o ? `<span class="own yes"><span class="own-l">Sende · </span>LB${o.uncap}</span>` : `<span class="own no"><span class="own-l">Sende </span>yok</span>`;
  }

  function cardMini(id, extra = "") {
    const c = DATA.cardById[id];
    if (!c) return `<div class="cmini missing">${id === null ? "Bu türde kartın yok" : "Kart bulunamadı"}</div>`;
    const ownCls = INV.cards ? (ownedCard.has(id) ? "has" : "lack") : "";
    return `<a class="cmini ${extra} ${ownCls}" href="#kartlar" data-card="${c.id}" title="${esc(c.name + " " + c.title)}">
      ${ownBadge(id)}
      <img src="${cardImg(c)}" alt="" ${hideBroken}>
      <span class="cm-txt"><span class="cm-name">${esc(c.name)}</span><span class="cm-title">${esc(c.title)}</span>
      <span class="cm-badges"><span class="rar ${c.rarity}">${c.rarity}</span>${typeBadge(c.type)}</span></span>
    </a>`;
  }

  /* ---------------- UMALAR ---------------- */
  function filteredUmas() {
    const q = norm(umaState.q);
    const min = gradeRank(umaState.minGrade);
    const list = DATA.umas.filter((u) => {
      if (umaState.guideOnly && !u.guide) return false;
      if (q && !norm(`${u.name} ${u.title} ${skillName(u.unique)}`).includes(q)) return false;
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
    const own = ownedUma.get(u.id);
    return `<a class="box uma ${own ? "owned" : ""}" href="#uma/${u.id}">
      ${u.guide ? `<span class="ribbon">Rehber</span>` : ""}
      ${own ? `<span class="own yes corner">Sende · Pot ${own.potential}</span>` : ""}
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
    return `<li class="sk ${s.gold ? "gold" : ""}" ${s.id ? `data-skill="${s.id}" tabindex="0"` : ""}>
      <span class="sk-main">${icon}<span>${esc(s.name)}</span></span>${base}</li>`;
  }

  function deckRow(title, ids, flex, note, headExtra) {
    const slots = ids.map((id) => cardMini(id)).join("");
    return `<div class="deck">
      <div class="deck-head"><h3>${title}</h3>${headExtra || ""}</div>
      <div class="deck-row">${slots}
        <div class="flex-slot">${cardMini(flex, "key")}<span class="flex-tag">6. slot · esnek</span><span class="key-tag">★ Kritik kart</span></div>
      </div>
      ${note ? `<p class="hint">${esc(note)}</p>` : ""}
    </div>`;
  }

  // Özel bonusun (Lvl'de açılan) bir kariyerdeki ortalama karşılığı: [etki, değer] listesi.
  // En az/en çok aralıkları GameTora'nın kendi hesabından alındı; aralıklı olanlar ortalamayla,
  // koşulu desteye bağlı olanlar o desteye göre sayılır.
  // deckTypes: kurulacak destedeki farklı kart türleri
  function uniqueBonus(c, deckTypes) {
    const out = [];
    const avg = (a, b) => (a + b) / 2;
    (c.unique ? c.unique.effects : []).forEach((e) => {
      const v = e.value, v1 = e.value_1, v2 = e.value_2, v3 = e.value_3, v4 = e.value_4;
      switch (e.type) {
        case 101: out.push([v1, v2]); if (v3) out.push([v3, v4]); break;          // dostluk göstergesi dolunca: kariyerin çoğunda açık
        case 102: out.push([8, v1 / 2]); break;                                  // sadece kendi türü dışındaki antrenmanda: yarı
        case 103: if (deckTypes && deckTypes.size >= v) out.push([8, v1]); break; // destede en az v farklı tür şartı
        case 104: out.push([8, v1 / 2]); break;                                  // fan sayısıyla 0'dan v1'e
        case 106: out.push([v1, (v * v2) / 2]); break;                           // dostluk antrenmanı sayısıyla 0'dan v*v2'ye
        case 107: out.push([v, avg(v4, v3)]); break;                             // enerji azaldıkça v4'ten v3'e
        case 108: out.push([v, avg(v3, v4)]); break;                             // maksimum enerjiyle v3'ten v4'e
        case 109: out.push([v, 600 / v1 / 2]); break;                            // toplam dostlukla 0'dan 600/v1'e
        case 110: case 111: out.push([v, 3 * v1]); break;                        // kart sayısı / antrenman seviyesiyle v1'den 5*v1'e
        case 113: case 115: case 122: out.push([v, v1]); break;
        case 114: out.push([v, avg(v1, v2)]); break;                             // enerjiyle v1'den v2'ye
        case 116: out.push([v1, (v2 * v3) / 2]); break;                          // skill sayısıyla 0'dan v2*v3'e
        case 117: out.push([v, avg((5 / v1) * v2, v2)]); break;                  // antrenman seviyeleri toplamıyla
        default: if (e.type < 100) out.push([e.type, v]);
      }
    });
    return out;
  }

  // Envanterden deste: rehberin ana destesindeki türleri izler. Her slot için o türde sendeki en güçlü
  // kart seçilir; güç, kartın SENDEKİ seviyesindeki etkileri (açıksa özel bonus dahil). Rehberin ana
  // destesi, budget destesi ve yedek listesinde olmak küçük bir artı puan verir, yakın güçte olanlar
  // arasında rehberin önerdiği seçilir. Aynı karakterden iki kart olmaz. 6. slot yine kritik kart.
  function inventoryDeck(g) {
    const owned = [...ownedCard.values()].filter((r) => DATA.cardById[r.id]);
    const bonus = new Map();
    g.deck.main.forEach((cid) => bonus.set(cid, 12));
    (g.deck.budget || []).forEach((cid) => { if (!bonus.has(cid)) bonus.set(cid, 6); });
    Object.values(g.alternates || {}).flat().forEach((cid) => { if (!bonus.has(cid)) bonus.set(cid, 3); });
    // Etki ağırlıkları: antrenmanı doğrudan büyütenler ağır, yardımcı etkiler hafif
    const W = { 1: 1, 8: 1.5, 2: 0.3, 19: 0.4, 15: 0.5, 16: 0.3, 3: 8, 4: 8, 5: 8, 6: 8, 7: 8, 18: 0.1, 14: 0.1,
                17: 2, 25: 0.2, 26: 0.2, 27: 0.3, 28: 0.3, 30: 3, 31: 2 };
    const deckTypes = new Set([...g.deck.main, g.deck.flex].map((cid) => (DATA.cardById[cid] || {}).type).filter(Boolean));
    const scoreCache = new Map();
    const score = (r) => {
      if (!scoreCache.has(r.id)) {
        const c = DATA.cardById[r.id];
        // Seviye dikkate alınmıyorsa kart, sendeki uncap'in izin verdiği en yüksek seviyede sayılır
        const lv = invUseLevel ? Math.max(1, r.level || 1) : levelFor(c, r.uncap || 0);
        const tot = {};
        cardEffects(c, lv).forEach((e) => { tot[e.id] = (tot[e.id] || 0) + (e.value || 0); });
        if (c.unique && lv >= c.unique.level) uniqueBonus(c, deckTypes).forEach(([id, val]) => { tot[id] = (tot[id] || 0) + val; });
        let s = 0;
        Object.entries(W).forEach(([id, w]) => { s += (tot[id] || 0) * w; });
        scoreCache.set(r.id, s + (bonus.get(r.id) || 0));
      }
      return scoreCache.get(r.id);
    };
    const rank = (a, b) => score(b) - score(a);
    const charOf = (r) => norm(DATA.cardById[r.id].name);
    const flexCard = DATA.cardById[g.deck.flex];
    const used = new Set(flexCard ? [norm(flexCard.name)] : []);
    const trainee = DATA.umaById[g.id];
    if (trainee) used.add(norm(trainee.name));   // Uma'nın kendi destek kartı desteye konamaz
    const types = g.deck.main.map((cid) => (DATA.cardById[cid] || {}).type);
    const pick = types.map((t) => {
      const best = owned.filter((r) => DATA.cardById[r.id].type === t && !used.has(charOf(r))).sort(rank)[0];
      if (best) used.add(charOf(best));
      return best || null;
    });
    // O türde kart kalmadıysa, Pal/Group dışında sendeki en güçlü kartla doldur
    pick.forEach((r, i) => {
      if (r) return;
      const best = owned.filter((x) => !used.has(charOf(x)) && !["Pal", "Group"].includes(DATA.cardById[x.id].type)).sort(rank)[0];
      if (best) { used.add(charOf(best)); pick[i] = best; }
    });
    return pick.map((r) => (r ? r.id : null));
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
          ${u.unique ? `<div class="unique"><b>Özel skill: ${esc(skillName(u.unique))}</b><p>${esc(skillDesc(u.unique))}</p></div>` : ""}
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
      return `<div class="sbar"><span class="sb-l">${statIcon(STATS[i])}${STATS[i]}</span>
        <span class="sb-track"><span class="sb-fill ${STATS[i]}" style="width:${w}%"></span></span>
        <b class="sb-v">${esc(raw)}</b></div>`;
    }).join("");
    const skillCols = Object.entries(g.skills).map(([grp, list]) =>
      `<div class="skcol"><h3>${esc(grp)}</h3><ul class="sklist">${list.map(skillChip).join("")}</ul></div>`).join("");
    const alts = Object.entries(g.alternates).map(([type, ids]) =>
      `<div class="alt-group"><h3>${typeBadge(type)}</h3><div class="alt-row">${ids.map((i) => cardMini(i, "small")).join("")}</div></div>`).join("");
    const prio = g.parents.priority.map((s, i) => `<span class="prio ${esc(s)}"><i>${i + 1}</i>${statIcon(s, "w")}${esc(s)}</span>`).join(`<span class="gt">›</span>`);
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
          <div class="skcols">${skillCols}</div>
        </section>
        <section class="panel wide">
          <h2>Desteler</h2>
          ${deckRow("Önerilen deste", g.deck.main, g.deck.flex)}
          ${g.deck.budget && g.deck.budget.length ? deckRow("Budget deste", g.deck.budget, g.deck.flex) : ""}
          ${INV.cards ? deckRow("Envanterinden", inventoryDeck(g), g.deck.flex, "",
              `<button type="button" class="toggle small ${invUseLevel ? "on" : ""}" id="invLevel" aria-pressed="${invUseLevel}"><span class="knob" aria-hidden="true"></span>Seviyeyi dikkate al</button>`)
            : `<div class="deck"><h3>Envanterinden</h3><p class="hint"><a href="#envanter">Kartlarını yükle</a>, sendeki kartlarla bir deste kurulsun.</p></div>`}
        </section>
        <section class="panel wide">
          <h2>Yedek kartlar</h2>
          <p class="hint">Destedeki bir kart sende yoksa aynı türden bunlardan biriyle değiştir.</p>
          ${alts}
        </section>
        <section class="panel wide">
          <h2>Veteran Umalar</h2>
          <div class="prio-row">${prio}</div>
          <h3>Pembe spark (uygunluk)</h3>
          <div class="taglist">${g.parents.pink.map((p) => `<span class="tag pinkt">${esc(p)}</span>`).join("")}</div>
        </section>
        <p class="source">Kaynak: <a href="${esc(g.source.url)}" target="_blank" rel="noopener">${esc(g.source.name)}</a>, ${fmtDate(g.source.updated)} tarihli rehber. Notlar UmaCollector tarafından özetlendi.</p>
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
      if (q && !norm(`${c.name} ${c.title} ${c.hints.map(skillName).join(" ")} ${c.events.map(skillName).join(" ")}`).includes(q)) return false;
      if (cardState.types.size && !cardState.types.has(c.type)) return false;
      if (cardState.rar.size && !cardState.rar.has(c.rarity)) return false;
      return true;
    });
    const s = cardState.sort;
    if (s.startsWith("eff:")) {
      const id = Number(s.slice(4));
      const val = (c) => {
        const lv = levelFor(c, cardState.uncap);
        const e = c.effects.find(([eid]) => eid === id);
        const base = e ? effectAt(e.slice(1), lv).value : null;
        const extra = uniquePlain(c, lv)[id] || 0;
        return base === null && !extra ? -1 : (base || 0) + extra;
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

  // Türkçe bulunma eki: 30'da, 40'ta, 50'de, 35'te
  function daDe(n) {
    const u = n % 10, t = n % 100;
    const units = { 1: "de", 2: "de", 3: "te", 4: "te", 5: "te", 6: "da", 7: "de", 8: "de", 9: "da" };
    const tens = { 0: "da", 10: "da", 20: "de", 30: "da", 40: "ta", 50: "de", 60: "ta", 70: "te", 80: "de", 90: "da" };
    return `${n}'${u ? units[u] : tens[t] || "da"}`;
  }

  // Özel bonusların açıklaması (GameTora'nın şablonları temel alınarak Türkçeleştirildi)
  function uniqueEffectText(e) {
    const info = (id) => DATA.effects[id] || { name: "Etki " + id, pct: false };
    const nm = (id) => esc(info(id).name);
    const ef = (id, v) => `${nm(id)} +${v}${info(id).pct ? "%" : ""}`;
    const v = e.value, v1 = e.value_1, v2 = e.value_2, v3 = e.value_3, v4 = e.value_4;
    switch (e.type) {
      case 101: {
        const two = v3 ? `${ef(v1, v2)} ve ${ef(v3, v4)}` : ef(v1, v2);
        return v === 100 ? `Dostluk göstergesi doluyken ${two} verir.` : `Dostluk göstergesi en az ${v} iken ${two} verir.`;
      }
      case 102: return `Dostluk göstergesi en az ${v} iken ve kart kendi türü dışındaki bir antrenmandayken ${ef(8, v1)} verir.`;
      case 103: return `Destede en az ${v} farklı türde kart varsa ${ef(8, v1)} verir.`;
      case 104: return `Her ${v.toLocaleString("tr-TR")} fan için ${ef(8, 1)} verir, ${(v * v1).toLocaleString("tr-TR")} fanda en fazla ${ef(8, v1)} olur.`;
      case 105: return `Destedeki her kart için o kartın türündeki başlangıç statını +${v} artırır. Pal ve Group kartları her statı +${v1} artırır.`;
      case 106: return `Bu kartla yapılan her dostluk antrenmanında ${ef(v1, v2)} verir. En fazla ${v} kez, toplamda ${ef(v1, v * v2)}.`;
      case 107: return `Enerjin ne kadar azsa o kadar çok ${nm(v)} verir.`;
      case 108: {
        let a = v2, b = 100; while (b) { const r = a % b; a = b; b = r; }
        const step = v2 / a, energyStep = 100 / a, maxE = v1 + (v4 - v3) * 100 / v2;
        return `${nm(v)} +${v3}% verir. Maksimum enerji ${v1} değerini her ${energyStep} puan geçtiğinde +${step}% daha ekler, ${maxE} enerjide en fazla +${v4}% olur.`;
      }
      case 109: return `Destedeki kartların toplam dostluğunda her ${v1} puan için ${nm(v)} +1% verir, 600'de en fazla +${Math.round(600 / v1)}% olur.`;
      case 110: return `Aynı antrenmandaki her destek kartı için ${ef(v, v1)} verir.`;
      case 111: return `Antrenmanın her seviyesi için ${ef(v, v1)} verir.`;
      case 112: return `%${v} ihtimalle o antrenmanın başarısızlık oranını sıfırlar.`;
      case 113: return `Dostluk antrenmanına katılınca ${ef(v, v1)} verir.`;
      case 114: return `Enerjiye göre ${nm(v)} verir: 0 enerjide +${v1}%, 100 ve üstünde +${v2}%.`;
      case 115: return `Destedeki tüm kartlara ${ef(v, v1)} verir.`;
      case 116: {
        const kind = v === 1 ? "hız" : v === 3 ? "dayanıklılık" : "belirli";
        return `Sahip olunan her ${kind} skill'i için ${ef(v1, v2)} verir, ${v3} skill'de en fazla ${ef(v1, v2 * v3)}.`;
      }
      case 117: return `Antrenmanların toplam seviyesi arttıkça daha çok ${nm(v)} verir, en fazla +${v2}.`;
      case 118: return `Dostluk göstergesi en az ${v1} iken bu kart aynı anda ${v + 1} antrenmanda birden görünebilir.`;
      case 119: return `Dostluk göstergesi en az ${v2} iken destedeki tüm kartların antrenmanlarda görünme ihtimali artar.`;
      case 120: return `Dostluk göstergesi en az ${v1} iken destedeki her kart için o kartın türündeki stat bonusunu artırır, stat başına en fazla ${v3}. Pal ve Group kartları skill puanı verir.`;
      case 121: return `Tüm kartlar antrenmandan +${v} fazladan dostluk kazanır, bu kartla aynı antrenmandaysalar +${v1}.`;
      case 122: return `Bu kartla birlikte antrenman yapan kartlara bir sonraki tur ${ef(v, v1)} verir.`;
      case 9991: return "İpuçlarından kazanılan statları artırır.";
      default: {
        const i = DATA.effects[e.type];
        return i ? `${esc(i.name)}${v ? ` +${v}${i.pct ? "%" : ""}` : ""}.` : "";
      }
    }
  }

  function uniqueText(c) {
    if (!c.unique) return "";
    const plain = c.unique.effects.filter((e) => e.type < 100 && DATA.effects[e.type]);
    const special = c.unique.effects.filter((e) => !(e.type < 100 && DATA.effects[e.type]));
    const parts = [];
    if (plain.length) parts.push(plain.map((e) => { const i = DATA.effects[e.type]; return `${esc(i.name)} +${e.value}${i.pct ? "%" : ""}`; }).join(", ") + " verir.");
    special.forEach((e) => { const t = uniqueEffectText(e); if (t) parts.push(t); });
    return `<h4>Özel bonus · Lvl ${daDe(c.unique.level)} açılır</h4><p>${parts.join(" ")}</p>`;
  }

  // Kartın verilen seviyede açık olan, koşulsuz (sabit) özel bonusları: {etki: değer}
  function uniquePlain(c, lv) {
    const out = {};
    if (c.unique && lv >= c.unique.level) {
      c.unique.effects.forEach((e) => { if (e.type < 100 && DATA.effects[e.type]) out[e.type] = (out[e.type] || 0) + e.value; });
    }
    return out;
  }

  function cardBox(c, open = false, lvOverride = null) {
    const key = "c" + c.id;
    const lv = lvOverride || levelFor(c, cardState.uncap);
    const sortId = cardState.sort.startsWith("eff:") ? Number(cardState.sort.slice(4)) : null;
    const effs = cardEffects(c, lv);
    // Seviyede açılan özel bonusun koşulsuz katkısı ilgili satıra "+5 özel" olarak eklenir
    const uq = uniquePlain(c, lv);
    effs.forEach((e) => { e.extra = uq[e.id] || 0; });
    Object.keys(uq).map(Number).filter((id) => !effs.some((e) => e.id === id)).forEach((id) => {
      const info = DATA.effects[id] || { name: "Etki " + id, pct: false };
      effs.push({ id, name: info.name, pct: info.pct, value: 0, extra: uq[id] });
    });
    const active = effs.filter((e) => (e.value !== null && e.value !== 0) || e.extra);
    const locked = effs.filter((e) => e.value === null);
    active.sort((a, b) => (b.id === sortId) - (a.id === sortId));
    const shown = open ? active : active.slice(0, 5);
    const row = (e) => `<li class="${e.id === sortId ? "hl" : ""} ${e.id === FAN_BONUS ? "fan" : ""}"><span>${esc(e.name)}</span><b>${e.value ? fmtEffect(e, e.value) : ""}${e.extra ? `<i class="uq" title="Özel bonustan">+${e.extra}${e.pct ? "%" : ""} özel</i>` : ""}</b></li>`;
    const lockedRow = (e) => `<li class="locked"><span>${esc(e.name)}</span><span>Lvl ${daDe(e.unlock)}</span></li>`;
    // Açık kartta sıra seviyeden bağımsız ve sabit: kartın kendi etki sırası, kilitliler yerinde soluk
    const fixed = effs.filter((e) => e.value !== 0 || e.extra).sort((a, b) => (b.id === sortId) - (a.id === sortId));
    const openRows = open ? fixed.map((e) => (e.value === null && !e.extra ? lockedRow(e) : row(e))).join("") : "";
    const hidden = active.length - shown.length;
    return `<article class="box card ${esc(c.type)} ${open ? "open" : ""}" data-key="${key}" tabindex="0" aria-expanded="${open}">
      <div class="card-top">
        <img class="card-img" src="${cardImg(c)}" alt="" loading="lazy" ${hideBroken}>
        <div class="card-id">
          <div class="badges"><span class="rar ${c.rarity}">${c.rarity}</span>${typeBadge(c.type)}${ownedCard.has(c.id) ? `<span class="own yes">Sende · LB${ownedCard.get(c.id).uncap}</span>` : ""}</div>
          <div class="name">${esc(c.name)}</div><div class="title">${esc(c.title)}</div>
          <div class="lvl">Lvl ${lv}${hidden > 0 ? ` · ${hidden} etki daha` : ""}</div>
        </div>
      </div>
      <ul class="eff">${open ? openRows : shown.map(row).join("")}</ul>
      <div class="more">
        ${uniqueText(c)}
        ${c.hints.length ? `<h4>Skill ipuçları</h4><div class="taglist">${c.hints.map(skillTag).join("")}</div>` : ""}
        ${c.events.length ? `<h4>Olay skilleri</h4><div class="taglist">${c.events.map(skillTag).join("")}</div>` : ""}
        <div class="date">Global çıkış: ${fmtDate(c.release)}</div>
        <div class="close-hint">Kapatmak için tekrar tıkla ya da boş bir yere tıkla</div>
      </div>
    </article>`;
  }

  /* ---------------- rehberdeki karta tıklayınca: kart özellikleri penceresi ---------------- */
  // Kart sende varsa sendeki seviyesiyle, yoksa en yüksek (MLB) seviyesiyle gösterilir.
  // Pencerenin içinde ya da dışında herhangi bir yere tıklayınca kapanır (skill etiketleri hariç).
  function openCardPopup(id) {
    const c = DATA.cardById[id];
    if (!c) return;
    const own = ownedCard.get(id);
    const ownLv = own ? Math.max(1, own.level || 1) : null;
    const maxLv = levelFor(c, 4);
    let useOwn = !!own;                       // envanterde varsa varsayılan: sendeki seviye
    const bg = document.createElement("div");
    bg.className = "modal-bg card-pop";
    const inner = document.createElement("div");
    inner.className = "card-pop-in";
    inner.setAttribute("role", "dialog");
    inner.setAttribute("aria-modal", "true");
    inner.setAttribute("aria-label", c.name);
    bg.appendChild(inner);
    const seg = document.createElement("span");
    seg.className = "seg lv-seg";
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "Seviye");
    seg.innerHTML = `<span class="lv-pill" aria-hidden="true"></span>` + (own
      ? `<button type="button" data-lvpick="own">Lvl ${ownLv} · Sende</button><button type="button" data-lvpick="max">MLB · Lvl ${maxLv}</button>`
      : `<button type="button" data-lvpick="max" disabled>MLB · Lvl ${maxLv}</button>`);
    const placePill = () => {
      const on = seg.querySelector(useOwn ? "[data-lvpick=own]" : "[data-lvpick=max]");
      seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === on));
      seg.style.setProperty("--px", on.offsetLeft + "px");
      seg.style.setProperty("--pw", on.offsetWidth + "px");
    };
    const draw = (anim) => {
      inner.innerHTML = cardBox(c, true, useOwn ? ownLv : maxLv);
      const box = inner.querySelector(".box.card");
      box.classList.add("float-pop");
      box.removeAttribute("tabindex");
      const hint = box.querySelector(".close-hint"); if (hint) hint.remove();
      const lvl = box.querySelector(".lvl");
      lvl.textContent = "";
      lvl.appendChild(seg);
      if (anim) box.querySelector(".eff").classList.add("eff-swap");
      requestAnimationFrame(placePill);
    };
    draw();
    document.body.appendChild(bg);
    document.body.classList.add("modal-open");
    const close = () => { bg.remove(); document.body.classList.remove("modal-open"); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    bg.addEventListener("click", (ev) => {
      const pick = ev.target.closest("[data-lvpick]");
      if (pick) { const next = pick.dataset.lvpick === "own"; if (next !== useOwn) { useOwn = next; draw(true); } return; }
      if (ev.target.closest("[data-skill], .lv-seg")) return;
      close();
    });
  }

  /* ---------------- kart açma: üstte yüzen kutu + beyaz perde ---------------- */
  const veil = document.createElement("div");
  veil.className = "veil";
  document.body.appendChild(veil);
  let floating = null;      // açık kart (article)
  const ANIM = 230;

  function setVeil(on) { veil.classList.toggle("on", on); }

  function animateHeight(el, from, to, done) {
    el.style.height = from + "px";
    el.style.overflow = "hidden";
    void el.offsetHeight;
    el.style.transition = `height ${ANIM}ms cubic-bezier(.2,.8,.2,1)`;
    el.style.height = to + "px";
    let fired = false;
    const end = () => { if (fired) return; fired = true; el.style.transition = ""; done && done(); };
    el.addEventListener("transitionend", end, { once: true });
    setTimeout(end, ANIM + 80);
  }

  function openCard(article, animate = true) {
    const c = DATA.cardById[Number(article.dataset.key.slice(1))];
    if (!c) return;
    const cell = article.parentElement;
    const h0 = article.getBoundingClientRect().height;   // kesirli yükseklik: alttaki kartlar 1px bile kaymasın
    cell.style.height = h0 + "px";
    const tmp = document.createElement("div");
    tmp.innerHTML = cardBox(c, true).trim();
    const el = tmp.firstElementChild;
    el.classList.add("float");
    cell.replaceChild(el, article);
    floating = el;
    openKey = el.dataset.key;
    setVeil(true);
    const h1 = el.scrollHeight;
    if (animate) animateHeight(el, h0, h1, () => { el.style.height = ""; el.style.overflow = ""; });
    return el;
  }

  function closeCard(animate = true, after) {
    const el = floating;
    if (!el) { after && after(); return; }
    floating = null;
    openKey = null;
    setVeil(false);
    const cell = el.parentElement;
    const c = DATA.cardById[Number(el.dataset.key.slice(1))];
    const finish = () => {
      if (cell && cell.isConnected) {
        const tmp = document.createElement("div");
        tmp.innerHTML = cardBox(c, false).trim();
        cell.replaceChild(tmp.firstElementChild, el);
        cell.style.height = "";
      }
      after && after();
    };
    if (animate && cell && cell.isConnected) animateHeight(el, el.offsetHeight, parseFloat(cell.style.height) || 0, finish);
    else finish();
  }

  function toggleCard(article) {
    if (article === floating) { closeCard(); return; }
    const key = article.dataset.key;
    if (floating) closeCard(false);
    const fresh = app.querySelector(`.cslot > .box.card[data-key="${key}"]`);
    if (fresh) openCard(fresh);
  }

  // Perdeye tıklanınca: altında başka kart varsa o açılır, yoksa açık kart kapanır
  veil.addEventListener("click", (ev) => {
    const under = document.elementsFromPoint(ev.clientX, ev.clientY)
      .find((n) => n.classList && n.classList.contains("card") && n.classList.contains("box") && n !== floating);
    if (under) toggleCard(under); else closeCard();
  });
  document.addEventListener("keydown", (ev) => { if (floating && ev.key === "Escape") closeCard(); });

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
          ${TYPES.map((t) => chip(`${statIcon(t)}${t}`, cardState.types.has(t), `data-type="${t}"`)).join("")}
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
      <div class="grid">${list.map((c) => `<div class="cslot">${cardBox(c)}</div>`).join("") || `<div class="empty">Bu filtrelere uyan kart yok.</div>`}</div>`;
    floating = null;
    if (openKey) {
      const el = app.querySelector(`.cslot > .box.card[data-key="${openKey}"]`);
      if (el) openCard(el, false); else openKey = null;
    }
  }

  /* ---------------- PROFİL SAYFALARI ---------------- */
  let lastMsg = null;

  const UPLOAD_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 6.5 8.5l1.4 1.4L11 6.8V15h2V6.8l3.1 3.1 1.4-1.4z"/><path d="M5 17h14v3H5z"/></svg>`;
  const fmtStamp = (d) => { const m = String(d || "").match(/(\d{4})-(\d\d)-(\d\d) (\d\d:\d\d)/); return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}` : ""; };

  // Küçük yükleme kutusu: tıkla ya da dosyayı üstüne sürükle
  function uploadBox(id, title, file, state) {
    return `<label class="up ${state ? "done" : ""}" for="${id}" data-drop="1">
      <input type="file" id="${id}" accept=".txt,text/plain" multiple hidden>
      <span class="up-ico">${UPLOAD_ICON}</span>
      <span class="up-txt"><b>${title}</b><small>${file}</small></span>
      <span class="up-state">${state || "Yüklenmedi"}</span>
      <span class="up-btn">${state ? "Yenile" : "Dosya seç"}</span>
    </label>`;
  }

  const uploadHelp = `<p class="up-help">Bu dosyaları <b>Uma Collector</b> uygulaması oluşturur. Kutuya tıkla ya da dosyayı üstüne sürükle. Yüklediklerin bu tarayıcıda saklanır.
    <a class="up-link" href="#indir">Uygulamayı indir →</a></p>`;

  function msgHtml() {
    // Mesaj sayfadan ayrılana kadar yerinde kalır (düğmelere basınca kaybolup sayfayı kaydırmasın)
    if (!lastMsg) return "";
    return `<div class="msg ${lastMsg.ok ? "ok" : "err"}">${esc(lastMsg.msg)}</div>`;
  }


  function renderInventory() {
    const u = INV.umas, c = INV.cards;
    const umaTiles = (u?.rows || []).map((r) => {
      const d = DATA.umaById[r.id];
      return `<a class="inv-uma ${d ? "" : "unknown"}" ${d ? `href="#uma/${d.id}"` : ""}>
        ${d ? `<img src="${umaImg(d)}" alt="" loading="lazy" ${hideBroken}>` : `<span class="noimg">?</span>`}
        <span class="iu-name">${esc(r.name)}</span><span class="iu-title">${esc(r.title)}</span>
        <span class="iu-meta"><span class="stars">${"★".repeat(r.stars)}</span><span class="pot">Pot ${r.potential}</span></span>
      </a>`;
    }).join("");
    const cardRows = (c?.rows || []).slice().sort((a, b) => {
      const ca = DATA.cardById[a.id], cb = DATA.cardById[b.id];
      const ra = ca ? RARITIES.indexOf(ca.rarity) : 9, rb = cb ? RARITIES.indexOf(cb.rarity) : 9;
      return ra - rb || (ca && cb ? TYPES.indexOf(ca.type) - TYPES.indexOf(cb.type) : 0) || b.uncap - a.uncap;
    });
    const cardTiles = cardRows.map((r) => {
      const d = DATA.cardById[r.id];
      const dia = "◆".repeat(r.uncap) + `<span class="off">${"◆".repeat(4 - r.uncap)}</span>`;
      return `<a class="inv-card" href="#kartlar" ${d ? `data-card="${d.id}"` : ""}>
        ${d ? `<img src="${cardImg(d)}" alt="" loading="lazy" ${hideBroken}>` : `<span class="noimg">?</span>`}
        <span class="ic-name">${esc(r.name)}</span>
        <span class="ic-meta">${d ? `${typeBadge(d.type)}` : ""}<span class="dia" title="Uncap ${r.uncap}">${dia}</span></span>
        <span class="ic-lvl">Lvl ${r.level}</span>
      </a>`;
    }).join("");
    app.innerHTML = `
      <div class="page-head"><h1>Envanterim</h1></div>
      ${msgHtml()}
      <section class="uploads">
        ${uploadBox("fUmas", "Umalar", "umauma.txt", u ? `${u.rows.length} Uma · ${fmtStamp(u.date)}` : "")}
        ${uploadBox("fCards", "Kartlar", "umacard.txt", c ? `${c.rows.length} kart · ${fmtStamp(c.date)}` : "")}
      </section>
      ${uploadHelp}
      ${u ? `<section class="panel inv-sec"><h2>Umalarım <span class="count">${u.rows.length} / ${DATA.umas.length}</span></h2>
        <div class="inv-grid umas">${umaTiles}</div></section>` : ""}
      ${c ? `<section class="panel inv-sec"><h2>Kartlarım <span class="count">${c.rows.length} / ${DATA.cards.length}</span></h2>
        <div class="inv-grid cards">${cardTiles}</div></section>` : ""}
      ${u || c ? `<button type="button" class="reset danger" id="invClear">Envanteri bu tarayıcıdan sil</button>` : ""}`;
  }

  /* ---------------- rank (oyunun değerlendirme puanı aralıkları) ---------------- */
  function rankOf(points) {
    const R = DATA.ranks || [];
    const i = R.findIndex(([min, max]) => points >= min && points <= max);
    if (i < 0) return null;
    const [min, , name] = R[i];
    const next = R[i + 1] ? { name: R[i + 1][2], min: R[i + 1][0] } : null;
    return { name, min, next };
  }
  const rankTier = (n) => n.startsWith("U") ? "u" : n.startsWith("S") ? "s" : n.startsWith("A") ? "a" : n.startsWith("B") ? "b" : "low";
  const rankBadge = (n, big) => `<span class="rank ${rankTier(n)} ${big ? "big" : ""}">${esc(n)}</span>`;

  // Takımdaki Uma'nın rehberi: aynı isimde rehberi olanlardan, kategorisi tutanı tercih et.
  function guideFor(name, cat) {
    const cands = DATA.umas.filter((u) => norm(u.name) === norm(name) && DATA.guides[u.id]);
    const hit = cands.find((u) => DATA.guides[u.id].team_trials === cat) || cands[0];
    return hit ? { uma: hit, g: DATA.guides[hit.id] } : null;
  }

  let teamCompare = store.get("teamCompare", false);
  let invUseLevel = store.get("invUseLevel", true);
  let teamAnim = false;   // sadece düğmeye basılınca çubuklar animasyonla gelir

  function renderTeam() {
    const t = INV.team;
    const cats = ["Sprint", "Mile", "Medium", "Long", "Dirt"];
    const total = t ? t.rows.reduce((s, r) => s + r.points, 0) : 0;
    const pct = (x) => Math.min(100, Math.round(x / STAT_BAR_MAX * 100));
    const col = (cat) => {
      const rows = t.rows.filter((r) => r.cat === cat);
      return `<div class="tcol"><h3>${cat}</h3>${rows.map((r) => {
        const u = DATA.umaById[r.uma];
        const rk = r.points ? rankOf(r.points) : null;
        const gf = teamCompare ? guideFor(r.name, cat) : null;
        const rec = gf ? STAT_KEYS.map((k) => parseInt(gf.g.stats[k], 10) || 0) : null;
        const recRaw = gf ? STAT_KEYS.map((k) => gf.g.stats[k]) : null;
        const prog = rk && rk.next ? Math.round((r.points - rk.min) / (rk.next.min - rk.min) * 100) : 100;
        const stats = r.stats.map((v, i) => {
          const ok = rec ? v >= rec[i] : null;
          return `<span class="mini ${rec ? "cmp" : ""}">${statIcon(STATS[i])}
            <span class="mini-bar ${rec ? "two" : ""}"><span class="sb-fill ${STATS[i]}" style="width:${pct(v)}%"></span>${rec ? `<span class="rec-fill ${STATS[i]}" style="width:${pct(rec[i])}%"></span>` : ""}</span>
            <b class="mini-v ${ok === null ? "" : ok ? "ok" : "low"}">${v}${rec ? `<small>${esc(recRaw[i])}</small>` : ""}</b></span>`;
        }).join("");
        return `<a class="tslot ${r.slot === "ACE" ? "ace" : ""}" ${u ? `href="#uma/${u.id}"` : ""}>
          ${r.slot === "ACE" ? `<span class="ace-tag">ACE</span>` : ""}
          ${rk ? `<span class="rank-corner">${rankBadge(rk.name)}</span>` : ""}
          ${u ? `<img src="${umaImg(u)}" alt="" loading="lazy" ${hideBroken}>` : `<span class="noimg">?</span>`}
          <span class="ts-name">${esc(r.name)}</span>
          <span class="ts-ep">${esc(r.epithet)}</span>
          <span class="ts-pts">${r.points ? r.points.toLocaleString("tr-TR") + " puan" : "puan okunamadı"}</span>
          ${rk && rk.next ? `<span class="rank-prog" title="${esc(rk.name)} → ${esc(rk.next.name)}"><span style="width:${prog}%"></span></span>
            <span class="ts-next">${esc(rk.next.name)} için ${(rk.next.min - r.points).toLocaleString("tr-TR")} puan</span>` : ""}
          <span class="ts-stats">${stats}</span>
        </a>`;
      }).join("")}</div>`;
    };
    app.innerHTML = `
      <div class="page-head"><h1>Takımım</h1>${t ? `<span class="count">Toplam ${total.toLocaleString("tr-TR")} puan</span>` : ""}</div>
      ${msgHtml()}
      <section class="uploads one">
        ${uploadBox("fTeam", "Takım", "umateam.txt", t ? `${t.rows.length} Uma · ${fmtStamp(t.date)}` : "")}
      </section>
      ${uploadHelp}
      ${t ? `<div class="team-bar">
          <button type="button" class="toggle ${teamCompare ? "on" : ""}" id="teamCompare" aria-pressed="${teamCompare}">
            <span class="knob" aria-hidden="true"></span>Önerilen statlarla karşılaştır</button>
        </div>
        <section class="team ${teamAnim ? "anim" : ""}">${cats.map(col).join("")}</section>
        <button type="button" class="reset danger" id="teamClear">Takımı bu tarayıcıdan sil</button>` : ""}`;
  }

  const DOWNLOAD_URL = "https://github.com/umacollector/uma-collector/releases/latest/download/UmaCollector.zip";

  function renderDownload() {
    const step = (n, title, body) => `<li class="step"><span class="step-n">${n}</span><div><h3>${title}</h3>${body}</div></li>`;
    app.innerHTML = `
      <section class="dl-hero">
        <img src="assets/icon.png" alt="" class="dl-logo">
        <div class="dl-info">
          <h1>Uma Collector</h1>
          <p>Umamusume: Pretty Derby ekranından <b>Umalarını</b>, <b>destek kartlarını</b> ve <b>Team Trials takımını</b> okuyup bu siteye yükleyebileceğin dosyalara yazan Windows uygulaması.</p>
          <div class="dl-actions">
            <a class="dl-btn" href="${DOWNLOAD_URL}">${UPLOAD_ICON.replace('M12 3 6.5 8.5l1.4 1.4L11 6.8V15h2V6.8l3.1 3.1 1.4-1.4z', 'M12 15l5.5-5.5-1.4-1.4L13 11.2V3h-2v8.2L7.9 8.1 6.5 9.5z')}İndir</a>
            <span class="dl-meta">Windows 10 / 11 · zip · yaklaşık 34 MB</span>
          </div>
        </div>
      </section>

      <div class="guide dl-guide">
        <section class="panel">
          <h2>Gerekenler</h2>
          <ul class="notes">
            <li>Windows 10 ya da 11.</li>
            <li>Oyunun Steam'deki Global sürümü.</li>
            <li>Oyun <b>1920×1080 tam ekran</b> ve Windows ekran ölçeği <b>%100</b> olmalı.</li>
            <li>Python ya da başka bir kurulum gerekmez.</li>
          </ul>
        </section>
        <section class="panel">
          <h2>Kurulum</h2>
          <ul class="notes">
            <li>İndirdiğin zip'i istediğin bir klasöre çıkar.</li>
            <li>Klasördeki <b>UmaCollector.exe</b>'yi çalıştır.</li>
            <li>Windows "bilinmeyen yayımcı" uyarısı verirse <b>Ek bilgi</b> ve sonra <b>Yine de çalıştır</b>'a bas.</li>
          </ul>
        </section>

        <section class="panel wide">
          <h2>Nasıl kullanılır</h2>
          <ol class="steps">
            ${step(1, "Oyunu hazırla", "<p>Oyunu 1920×1080 tam ekranda aç ve <b>ana menüye</b> gel. Takımını okutacaksan <b>Race › Team Trials</b> ekranında dur.</p>")}
            ${step(2, "Okumayı başlat", "<p><b>Umaları Oku</b>, <b>Kartları Oku</b> ya da ikisini birden yapan <b>Tümünü Oku</b>'ya bas. Takım için <b>Takımı Oku</b>. Uygulama kendini küçültür ve menülerde kendisi gezer.</p>")}
            ${step(3, "Dokunma, bekle", "<p>Okuma sürerken fareye ve klavyeye dokunma. Durdurmak için <b>F10</b>'a bas. Başka bir pencereye geçersen uygulama güvenlik için kendiliğinden durur.</p>")}
            ${step(4, "Kart filtresi", "<p>Sadece güçlü kartlarını güncellemek istersen <b>Okunacak kartlar</b>'dan <b>SR ve üstü</b> ya da <b>Sadece SSR</b> seç. Oyundaki kart listesi <b>Rarity / Desc</b> sırasında olmalı. Okunmayan nadirliklerin önceki kaydı korunur.</p>")}
            ${step(5, "Dosyaları bul", "<p>Okuma bitince <b>umauma.txt</b>, <b>umacard.txt</b> ya da <b>umateam.txt</b> uygulama klasöründeki <b>Export</b> klasörüne yazılır. <b>Export klasörünü aç</b> düğmesiyle açabilirsin. Başka bir klasör istersen <b>Ayarlar</b>'dan seç.</p>")}
            ${step(6, "Siteye yükle", `<p>Umalarını ve kartlarını <a href="#envanter">Envanterim</a>'e, takımını <a href="#takim">Takımım</a>'a yükle. Kartlar yüklüyse her rehberde senin kartlarınla kurulan bir deste de görünür.</p>`)}
          </ol>
        </section>

        <section class="panel wide">
          <h2>Sorun çözme</h2>
          <ul class="notes">
            <li><b>"… ekranı gelmedi"</b> hatası: Oyunun doğru ekranda olduğundan emin ol, tekrar dene. Neler olduğunu <b>Log klasörünü aç</b> ile adım adım ekran görüntülerinde görebilirsin.</li>
            <li><b>Tıklamalar oyuna gitmiyor:</b> UmaCollector.exe'ye sağ tıklayıp <b>Yönetici olarak çalıştır</b>.</li>
            <li><b>Filtreli kart okuması hemen duruyor:</b> Oyundaki kart listesinin altındaki sıralamayı <b>Rarity</b> ve <b>Desc</b> yap.</li>
            <li><b>Bir isim yanlış okunmuş:</b> Uygulama okuduklarını oyunun resmi listeleriyle düzeltir. Yine de hatalı bir satır görürsen o okumayı tekrarla.</li>
          </ul>
        </section>

        <p class="source">Uma Collector oyunun dosyalarına ya da internet trafiğine dokunmaz. Sadece ekranı okur ve menülerde tıklar. Yine de otomatik araç kullanımı oyunun kullanım şartlarına aykırı sayılabilir, kendi sorumluluğunda kullan.</p>
      </div>`;
  }

  /* ---------------- HESAP: profil sayfası ---------------- */
  const authReady = () => window.UmaAuth && window.UmaAuth.ready;
  const AUTH = { user: null, profile: null };

  function profileTeam() {
    return (INV.team?.rows || []).map((r) => ({ cat: r.cat, slot: r.slot, uma: r.uma || null, name: r.name,
                                                epithet: r.epithet || "", points: r.points || 0 }));
  }

  /* ---------------- banner: arka plan gradyanı + Uma ya da kart görseli ---------------- */
  const BANNER_PRESETS = {
    sakura: ["Sakura", "135deg", "#ffd1e3", "#ffe9b8"],
    gunbatimi: ["Gün batımı", "120deg", "#ff9a8b", "#ffd36e"],
    seftali: ["Şeftali", "135deg", "#ffcfb0", "#ffb3c7"],
    nane: ["Nane", "120deg", "#9be7c4", "#e3f7a8"],
    gokyuzu: ["Gökyüzü", "135deg", "#bfe6ff", "#e6dcff"],
    okyanus: ["Okyanus", "120deg", "#62c6e8", "#a68bff"],
    lavanta: ["Lavanta", "135deg", "#c9b6ff", "#ffc7e8"],
    gece: ["Gece", "135deg", "#272552", "#7b4fd6"],
  };
  const bannerSubject = (b) => b && (b.kind === "card" ? DATA.cardById[b.id] : DATA.umaById[b.id]);
  // Otomatik: kartın (ya da Uma'nın kıyafetinin) renkleri, temaya uyması için yüzeyle yumuşatılır
  function autoGradient(b) {
    const sub = bannerSubject(b);
    const pal = (sub && sub.pal) || ["#ff5fa2", "#ffcf3a", "#2fbf71"];
    const soft = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, var(--surface))`;
    return `linear-gradient(120deg, ${soft(pal[0], 62)} 0%, ${soft(pal[1] || pal[0], 48)} 55%, ${soft(pal[2] || pal[0], 58)} 100%)`;
  }
  function bannerBg(b) {
    const bg = (b && b.bg) || { mode: "auto" };
    if (bg.mode === "preset" && BANNER_PRESETS[bg.preset]) {
      const [, ang, c1, c2] = BANNER_PRESETS[bg.preset];
      return `linear-gradient(${ang}, ${c1}, ${c2})`;
    }
    if (bg.mode === "custom" && /^#[0-9a-f]{6}$/i.test(bg.a || "") && /^#[0-9a-f]{6}$/i.test(bg.b || ""))
      return `linear-gradient(${Number(bg.angle) || 0}deg, ${bg.a}, ${bg.b})`;
    return autoGradient(b);
  }

  function bannerHtml(b) {
    const sub = bannerSubject(b);
    if (!b || !sub) return `<div class="pf-banner empty"></div>`;
    const img = b.kind === "card"
      ? `<img class="pf-card" src="img/card_l/${b.id}.webp" alt="" onerror="this.src='img/card/${b.id}.png'">`
      : `<img class="pf-uma" src="${umaImg(sub, true)}" alt="">`;
    return `<div class="pf-banner ${b.kind}" style="background:${bannerBg(b)}"><span class="pf-shine"></span>${img}</div>`;
  }

  // Banner seçilince açılan pencere: arka plan rengi (Otomatik, hazır gradyanlar ya da özel gradyan)
  function openBannerEditor(kind, id) {
    const cur = AUTH.profile && AUTH.profile.banner;
    const same = cur && cur.kind === kind && cur.id === id;
    const draft = { kind, id, bg: same && cur.bg ? { ...cur.bg } : { mode: "auto" } };
    if (!draft.bg.a) Object.assign(draft.bg, { a: "#ff9ac4", b: "#ffe08a", angle: 120 });
    const sub = bannerSubject(draft);
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    const swatch = (mode, key, label, css) =>
      `<button type="button" class="bn-sw" data-bnmode="${mode}" ${key ? `data-bnpreset="${key}"` : ""} title="${esc(label)}">
        <span class="bn-chip" style="background:${css}"></span><span class="bn-lab">${esc(label)}</span></button>`;
    bg.innerHTML = `
      <div class="modal wide-modal" role="dialog" aria-modal="true" aria-labelledby="bnTitle">
        <button type="button" class="modal-x" data-bnclose aria-label="Kapat">×</button>
        <h2 id="bnTitle">Banner'ı ayarla</h2>
        <p class="auth-hint be-sub">${esc(sub.name)} ${esc(sub.title)}</p>
        <div class="bn-preview"></div>
        <h3 class="bn-h">Arka plan</h3>
        <div class="bn-grid">
          ${swatch("auto", "", "Otomatik", autoGradient(draft))}
          ${Object.entries(BANNER_PRESETS).map(([k, [lab, ang, c1, c2]]) => swatch("preset", k, lab, `linear-gradient(${ang}, ${c1}, ${c2})`)).join("")}
          <button type="button" class="bn-sw" data-bnmode="custom" title="Özel"><span class="bn-chip custom"></span><span class="bn-lab">Özel</span></button>
        </div>
        <div class="bn-custom">
          <label>Renk 1<input type="color" data-bnc="a" value="${draft.bg.a}"></label>
          <label>Renk 2<input type="color" data-bnc="b" value="${draft.bg.b}"></label>
          <label class="bn-angle">Açı <b>${draft.bg.angle}°</b><input type="range" min="0" max="360" step="5" value="${draft.bg.angle}" data-bnc="angle"></label>
        </div>
        <div class="be-actions"><button type="button" class="reset" data-bnclose>Vazgeç</button><button type="button" class="auth-go" data-bnsave>Kaydet</button></div>
      </div>`;
    document.body.appendChild(bg);
    document.body.classList.add("modal-open");
    const prev = bg.querySelector(".bn-preview"), custom = bg.querySelector(".bn-custom");
    const draw = () => {
      prev.innerHTML = bannerHtml(draft);
      bg.querySelectorAll(".bn-sw").forEach((el) => el.classList.toggle("on",
        el.dataset.bnmode === draft.bg.mode && (draft.bg.mode !== "preset" || el.dataset.bnpreset === draft.bg.preset)));
      custom.classList.toggle("open", draft.bg.mode === "custom");
      bg.querySelector(".bn-chip.custom").style.background = `linear-gradient(${draft.bg.angle}deg, ${draft.bg.a}, ${draft.bg.b})`;
      bg.querySelector(".bn-angle b").textContent = `${draft.bg.angle}°`;
    };
    const close = () => { bg.remove(); document.body.classList.remove("modal-open"); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    bg.addEventListener("click", (ev) => {
      const sw = ev.target.closest("[data-bnmode]");
      if (sw) { draft.bg.mode = sw.dataset.bnmode; if (sw.dataset.bnpreset) draft.bg.preset = sw.dataset.bnpreset; draw(); return; }
      if (ev.target === bg || ev.target.closest("[data-bnclose]")) { close(); return; }
      if (ev.target.closest("[data-bnsave]")) {
        const out = { mode: draft.bg.mode };
        if (out.mode === "preset") out.preset = draft.bg.preset;
        if (out.mode === "custom") Object.assign(out, { a: draft.bg.a, b: draft.bg.b, angle: Number(draft.bg.angle) });
        window.UmaAuth.saveProfile({ banner: { kind, id, bg: out } }).catch(() => {});
        close();
      }
    });
    bg.addEventListener("input", (ev) => {
      const k = ev.target.dataset.bnc;
      if (!k) return;
      draft.bg[k] = k === "angle" ? Number(ev.target.value) : ev.target.value;
      draft.bg.mode = "custom";
      draw();
    });
    draw();
  }

  // İsim kutusu: zemin temanın rengi, çerçeve banner gradyanının ilk rengi
  function bannerFirstColor(b) {
    if (!b || !bannerSubject(b)) return "var(--pink-soft)";           // banner yokken varsayılan gradyanın ilk rengi
    const bg = b.bg || { mode: "auto" };
    if (bg.mode === "preset" && BANNER_PRESETS[bg.preset]) return BANNER_PRESETS[bg.preset][2];
    if (bg.mode === "custom" && /^#[0-9a-f]{6}$/i.test(bg.a || "")) return bg.a;
    const pal = bannerSubject(b).pal || ["#ff5fa2"];
    return `color-mix(in srgb, ${pal[0]} 62%, var(--surface))`;    // otomatik gradyanla aynı ton
  }
  const nameChipStyle = (banner) => `--nc:${bannerFirstColor(banner)}`;

  // Profil fotoğrafı: Uma görseli yüze yakın kırpılır (büyük görselden, net olsun)
  const faceImg = (u) => `<img class="face-img" src="${umaImg(u, true)}" alt="" loading="lazy">`;
  function avatarHtml(id, cls = "pf-avatar") {
    const u = DATA.umaById[id];
    return u ? `<span class="${cls} face">${faceImg(u)}</span>`
             : `<span class="${cls} none"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4.2" fill="currentColor"/><path d="M3.5 21c.8-4.6 4.3-7 8.5-7s7.7 2.4 8.5 7z" fill="currentColor"/></svg></span>`;
  }

  let bannerTab = "uma";

  function renderProfile() {
    if (!authReady()) {
      app.innerHTML = `<section class="panel login-soon"><h2>Hesap sistemi hazırlanıyor</h2><p>Envanterim ve Takımım şimdilik bu tarayıcıda çalışıyor.</p></section>`;
      return;
    }
    if (!AUTH.user) {
      app.innerHTML = `<section class="panel login-soon"><h2>Profil</h2><p>Profilini görmek için giriş yap.</p>
        <button type="button" class="dl-btn small" data-auth="login">Giriş Yap</button></section>`;
      return;
    }
    const pr = AUTH.profile || {};
    const team = profileTeam();
    const total = team.reduce((a, r) => a + (r.points || 0), 0);
    const umaCount = INV.umas?.rows.length || 0, cardCount = INV.cards?.rows.length || 0;
    const cats = ["Sprint", "Mile", "Medium", "Long", "Dirt"];
    const teamHtml = team.length ? `<div class="pf-team">${cats.map((cat) => `<div class="pf-col"><h3>${cat}</h3>${
      team.filter((r) => r.cat === cat).map((r) => {
        const u = DATA.umaById[r.uma]; const rk = r.points ? rankOf(r.points) : null;
        return `<div class="pf-slot ${r.slot === "ACE" ? "ace" : ""}">
          ${u ? `<img src="${umaImg(u)}" alt="">` : `<span class="noimg">?</span>`}
          <span class="pf-sname">${esc(r.name)}</span><span class="pf-sep">${esc(r.epithet)}</span>
          <span class="pf-spts">${rk ? rankBadge(rk.name) : ""}${r.points ? r.points.toLocaleString("tr-TR") : ""}</span>
          ${r.slot === "ACE" ? `<span class="ace-tag">ACE</span>` : ""}
        </div>`; }).join("")}</div>`).join("")}</div>`
      : `<p class="hint">Takımını <a href="#takim">Takımım</a>'a yüklediğinde burada görünür.</p>`;

    const ownedUmas = (INV.umas?.rows || []).map((r) => DATA.umaById[r.id]).filter(Boolean);
    const ownedCards = (INV.cards?.rows || []).map((r) => DATA.cardById[r.id]).filter(Boolean)
      .sort((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity));
    const pickUma = (u, attr, on) => `<button type="button" class="pk face ${on ? "on" : ""}" ${attr}="${u.id}" title="${esc(u.name + " " + u.title)}">${faceImg(u)}</button>`;
    const pickCard = (c, on) => `<button type="button" class="pk card ${on ? "on" : ""}" data-pbanner="card" data-pid="${c.id}" title="${esc(c.name + " " + c.title)}"><img src="${cardImg(c)}" alt=""></button>`;
    const b = pr.banner || null;
    const bannerPicks = bannerTab === "uma"
      ? ownedUmas.map((u) => `<button type="button" class="pk ${b && b.kind === "uma" && b.id === u.id ? "on" : ""}" data-pbanner="uma" data-pid="${u.id}" title="${esc(u.name + " " + u.title)}"><img src="${umaImg(u)}" alt=""></button>`).join("")
      : ownedCards.map((c) => pickCard(c, b && b.kind === "card" && b.id === c.id)).join("");
    const noUmas = `<p class="hint"><a href="#envanter">Envanterim</a>'e Umalarını yüklediğinde buradan seçebilirsin.</p>`;
    const noCards = `<p class="hint"><a href="#envanter">Envanterim</a>'e kartlarını yüklediğinde buradan seçebilirsin.</p>`;

    app.innerHTML = `
      <section class="pf-top">
        ${bannerHtml(b)}
        <div class="pf-head">
          ${avatarHtml(pr.avatar)}
          <div class="pf-id">
            <h1><span class="pf-name" style="${nameChipStyle(pr.banner)}">${esc(pr.username || "")}</span></h1>
            <div class="pf-stats"><span>${umaCount} Uma</span><span>${cardCount} kart</span>${total ? `<span>${total.toLocaleString("tr-TR")} takım puanı</span>` : ""}</div>
          </div>
        </div>
      </section>
      <section class="panel wide pf-sec"><h2>Takımım</h2>${teamHtml}</section>
      <section class="panel wide pf-sec">
        <h2>Profili düzenle</h2>
        <h3>Profil fotoğrafı</h3>
        ${ownedUmas.length ? `<div class="pk-grid">${ownedUmas.map((u) => pickUma(u, "data-pavatar", pr.avatar === u.id)).join("")}</div>` : noUmas}
        <div class="deck-head"><h3>Banner</h3>
          <span class="seg" role="group" aria-label="Banner türü">
            <button type="button" data-btab="uma" class="${bannerTab === "uma" ? "on" : ""}">Uma</button>
            <button type="button" data-btab="card" class="${bannerTab === "card" ? "on" : ""}">Kart</button>
          </span>
        </div>
        ${(bannerTab === "uma" ? ownedUmas.length : ownedCards.length) ? `<div class="pk-grid ${bannerTab === "card" ? "cards" : ""}">${bannerPicks}</div>` : (bannerTab === "uma" ? noUmas : noCards)}
        ${b ? `<button type="button" class="reset" data-pbanner="none">Banner'ı kaldır</button>` : ""}
      </section>`;
  }

  /* ---------------- HESAP: giriş / kayıt penceresi ---------------- */
  let authModal = null;
  function closeAuth() { if (authModal) { authModal.remove(); authModal = null; document.body.classList.remove("modal-open"); } }

  function openAuth(mode = "login") {
    closeAuth();
    const reg = mode === "register";
    const ready = authReady();
    authModal = document.createElement("div");
    authModal.className = "modal-bg";
    authModal.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="authTitle">
        <button type="button" class="modal-x" data-authclose aria-label="Kapat">×</button>
        <div class="modal-logo"><span class="l1">Uma</span><span class="l2">Collector</span></div>
        <h2 id="authTitle">${reg ? "Hesap Oluştur" : "Giriş Yap"}</h2>
        ${ready ? `<form class="auth-form" novalidate>
          <label>Kullanıcı adı<input name="u" autocomplete="username" maxlength="20" required></label>
          <label>Şifre<input name="p" type="password" autocomplete="${reg ? "new-password" : "current-password"}" required></label>
          ${reg ? `<label>Şifre tekrar<input name="p2" type="password" autocomplete="new-password" required></label>
            <p class="auth-hint">Kullanıcı adı 3-20 karakter: harf, rakam, nokta, alt çizgi ya da tire. Şifre en az ${window.UmaAuth.MIN_PASSWORD} karakter.</p>` : ""}
          <p class="auth-err" role="alert"></p>
          <button type="submit" class="auth-go">${reg ? "Hesap Oluştur" : "Giriş Yap"}</button>
        </form>
        <p class="auth-switch">${reg ? `Zaten hesabın var mı? <button type="button" data-auth="login">Giriş Yap</button>`
                                    : `Hesabın yok mu? <button type="button" data-auth="register">Hesap Oluştur</button>`}</p>`
        : `<p class="auth-hint">Hesap sistemi henüz hazır değil. Envanterim ve Takımım şimdilik bu tarayıcıda çalışıyor.</p>`}
      </div>`;
    document.body.appendChild(authModal);
    document.body.classList.add("modal-open");
    const first = authModal.querySelector("input"); if (first) first.focus();
    const form = authModal.querySelector("form");
    if (form) form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const f = new FormData(form), err = form.querySelector(".auth-err"), btn = form.querySelector(".auth-go");
      err.textContent = "";
      if (reg && f.get("p") !== f.get("p2")) { err.textContent = "Şifreler aynı değil."; return; }
      btn.disabled = true; btn.textContent = reg ? "Hesap oluşturuluyor…" : "Giriş yapılıyor…";
      try {
        await (reg ? window.UmaAuth.register(f.get("u"), f.get("p")) : window.UmaAuth.login(f.get("u"), f.get("p")));
        closeAuth();
      } catch (e) {
        err.textContent = e.message || "Bir sorun oldu, tekrar dene.";
        btn.disabled = false; btn.textContent = reg ? "Hesap Oluştur" : "Giriş Yap";
      }
    });
  }

  document.addEventListener("click", (ev) => {
    const sw = ev.target.closest && ev.target.closest("[data-auth]");
    if (sw) { ev.preventDefault(); closeMenu(); openAuth(sw.dataset.auth); return; }
    if (authModal && (ev.target === authModal || ev.target.closest("[data-authclose]"))) closeAuth();
    const out = ev.target.closest && ev.target.closest("[data-logout]");
    if (out) { ev.preventDefault(); closeMenu(); window.UmaAuth.logout(); if (location.hash === "#profil") location.hash = "#umalar"; }
  });
  document.addEventListener("keydown", (ev) => { if (authModal && ev.key === "Escape") closeAuth(); });

  /* ---------------- HESAP: eşitleme ---------------- */
  // Hesap açıkken envanter/takım buluta da yazılır; profilin herkese açık kısmı (takım, sayılar) güncellenir.
  function cloudSave(kind) {
    if (!authReady() || !AUTH.user) return;
    window.UmaAuth.saveInventory(kind, INV[kind] || null).catch(() => {});
    publishProfile();
  }

  function publishProfile() {
    if (!authReady() || !AUTH.user) return;
    const team = profileTeam();
    const stats = { umas: INV.umas?.rows.length || 0, cards: INV.cards?.rows.length || 0,
                    points: team.reduce((a, r) => a + (r.points || 0), 0) };
    const pr = AUTH.profile || {};
    if (JSON.stringify(pr.team || []) === JSON.stringify(team) && JSON.stringify(pr.stats || {}) === JSON.stringify(stats)) return;
    window.UmaAuth.saveProfile({ team, stats }).catch(() => {});
  }

  // Girişte: her bölüm için bu tarayıcıdaki ve hesaptaki kayıttan yenisi kullanılır, eski taraf güncellenir.
  async function syncInventory() {
    let cloud = null;
    try { cloud = await window.UmaAuth.loadInventory(); } catch (e) { return; }
    cloud = cloud || {};
    ["umas", "cards", "team"].forEach((k) => {
      const local = INV[k], remote = cloud[k] || null;
      const newer = !local ? remote : !remote ? local : ((remote.date || "") > (local.date || "") ? remote : local);
      INV[k] = newer;
      store.set("inv." + k, newer);
      if (newer && newer !== remote) window.UmaAuth.saveInventory(k, newer).catch(() => {});
    });
    rebuildOwned();
    publishProfile();
    render();
  }

  window.addEventListener("umauth", (ev) => {
    const was = AUTH.user && AUTH.user.uid;
    AUTH.user = ev.detail.user; AUTH.profile = ev.detail.profile;
    renderMenu();
    if (AUTH.user && AUTH.user.uid !== was) syncInventory();
    else if (["#profil", "#envanter", "#takim"].includes(location.hash)) render();
  });

  async function handleFiles(files) {
    const msgs = [];
    let ok = true;
    for (const f of files) {
      const r = importExport(await f.text());
      ok = ok && r.ok;
      msgs.push(`${f.name}: ${r.msg}`);
    }
    lastMsg = { ok, msg: msgs.join("  ") };
    render();
  }

  /* ---------------- yönlendirme ve olaylar ---------------- */
  function route() {
    const h = location.hash;
    const m = h.match(/^#uma\/(\d+)$/);
    if (m) return { page: "uma", id: Number(m[1]) };
    if (["#envanter", "#takim", "#kartlar", "#indir", "#profil"].includes(h)) return { page: h.slice(1) };
    return { page: "umalar" };
  }

  function render(keepFocus) {
    const r = route();
    if (typeof setVeil === "function") { setVeil(false); }
    const tab = r.page === "uma" ? "umalar" : r.page;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.page === tab));
    const focusId = keepFocus && document.activeElement && document.activeElement.id;
    const caret = focusId && document.activeElement.selectionStart;
    const pages = { uma: () => renderUmaPage(r.id), kartlar: renderCards, envanter: renderInventory,
                    takim: renderTeam, profil: renderProfile, indir: renderDownload, umalar: renderUmas };
    pages[r.page]();
    const titles = { envanter: "Envanterim", takim: "Takımım", profil: "Profil", kartlar: "Kartlar", indir: "Uma Collector" };
    document.title = r.page === "uma" && DATA.umaById[r.id] ? `${DATA.umaById[r.id].name} · UmaCollector`
      : titles[r.page] ? `${titles[r.page]} · UmaCollector` : "UmaCollector";
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
    if (ev.target.type === "file" && ev.target.files.length) { handleFiles([...ev.target.files]); return; }
    if (ev.target.id === "usort") { umaState.sort = ev.target.value; render(); }
    if (ev.target.id === "csort") { cardState.sort = ev.target.value; render(); }
  });
  ["dragover", "dragleave", "drop"].forEach((type) => app.addEventListener(type, (ev) => {
    const zone = ev.target.closest && ev.target.closest("[data-drop]");
    if (!zone) return;
    ev.preventDefault();
    zone.classList.toggle("over", type === "dragover");
    if (type === "drop" && ev.dataTransfer.files.length) handleFiles([...ev.dataTransfer.files]);
  }));

  app.addEventListener("click", (ev) => {
    const pa = ev.target.closest && ev.target.closest("[data-pavatar]");
    if (pa) { window.UmaAuth.saveProfile({ avatar: Number(pa.dataset.pavatar) }).catch(() => {}); return; }
    const pb = ev.target.closest && ev.target.closest("[data-pbanner]");
    if (pb) {
      if (pb.dataset.pbanner !== "none") { openBannerEditor(pb.dataset.pbanner, Number(pb.dataset.pid)); return; }
      const banner = pb.dataset.pbanner === "none" ? null : { kind: pb.dataset.pbanner, id: Number(pb.dataset.pid) };
      window.UmaAuth.saveProfile({ banner }).catch(() => {}); return;
    }
    const bt = ev.target.closest && ev.target.closest("[data-btab]");
    if (bt) { bannerTab = bt.dataset.btab; render(); return; }
    const il = ev.target.closest && ev.target.closest("#invLevel");
    if (il) { invUseLevel = !invUseLevel; store.set("invUseLevel", invUseLevel); render(); return; }
    const tg = ev.target.closest && ev.target.closest("#teamCompare");
    if (tg) { teamCompare = !teamCompare; store.set("teamCompare", teamCompare); teamAnim = true; render(); teamAnim = false; return; }
    if (ev.target.id === "invClear" || ev.target.id === "teamClear") {
      const keys = ev.target.id === "invClear" ? ["umas", "cards"] : ["team"];
      keys.forEach((k) => { INV[k] = null; store.set("inv." + k, null); cloudSave(k); });
      rebuildOwned(); render(); return;
    }
    const cm = ev.target.closest("a.cmini[data-card]");
    if (cm) { ev.preventDefault(); openCardPopup(Number(cm.dataset.card)); return; }
    const mini = ev.target.closest("a.inv-card[data-card]");
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
    if (box) { toggleCard(box); return; }
    if (floating && !ev.target.closest(".box.card")) closeCard();
  });
  app.addEventListener("keydown", (ev) => {
    const box = ev.target.classList && ev.target.classList.contains("card") ? ev.target : null;
    if (box && (ev.key === "Enter" || ev.key === " ")) {
      ev.preventDefault();
      const key = box.dataset.key;
      toggleCard(box);
      const again = app.querySelector(`.box[data-key="${key}"]`);
      if (again) again.focus();
    }
  });
  window.addEventListener("hashchange", () => {
    closeMenu();
    lastMsg = null;
    const keepOpen = location.hash === "#kartlar" && openKey;
    if (!keepOpen) openKey = null;
    render();
    const target = keepOpen && app.querySelector(`.box[data-key="${openKey}"]`);
    if (target) target.scrollIntoView({ block: "center" }); else window.scrollTo(0, 0);
  });

  /* ---------------- profil menüsü ---------------- */
  const pBtn = document.getElementById("profileBtn");
  const pMenu = document.getElementById("profileMenu");
  function closeMenu() { pMenu.hidden = true; pBtn.setAttribute("aria-expanded", "false"); }
  function renderMenu() {
    const u = AUTH.user && AUTH.profile;
    pMenu.innerHTML = (u
      ? `<a role="menuitem" href="#profil" class="pm-item pm-user">${avatarHtml(AUTH.profile.avatar, "pm-av")}<b>${esc(AUTH.profile.username)}</b></a>`
      : `<button type="button" role="menuitem" class="pm-item" data-auth="login"><span class="pm-dot pink"></span>Giriş Yap</button>`)
      + `<a role="menuitem" href="#envanter" class="pm-item"><span class="pm-dot yellow"></span>Envanterim</a>
         <a role="menuitem" href="#takim" class="pm-item"><span class="pm-dot green"></span>Takımım</a>`
      + (u ? `<button type="button" role="menuitem" class="pm-item pm-out" data-logout><span class="pm-dot grey"></span>Çıkış Yap</button>` : "");
    const nameEl = document.getElementById("profileName");
    nameEl.textContent = u ? AUTH.profile.username : "Profil";
    const av = pBtn.querySelector(".avatar");
    const pu = u && DATA.umaById[AUTH.profile.avatar];
    av.innerHTML = pu ? faceImg(pu)
      : `<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="12" cy="8" r="4.2" fill="currentColor"/><path d="M3.5 21c.8-4.6 4.3-7 8.5-7s7.7 2.4 8.5 7z" fill="currentColor"/></svg>`;
    av.classList.toggle("has-img", !!pu);
    av.classList.toggle("face", !!pu);
  }
  function openMenu() {
    pMenu.hidden = false; pBtn.setAttribute("aria-expanded", "true");
    const first = pMenu.querySelector(".pm-item"); if (first) first.focus();
  }
  pBtn.addEventListener("click", (ev) => { ev.stopPropagation(); pMenu.hidden ? openMenu() : closeMenu(); });
  document.addEventListener("click", (ev) => { if (!pMenu.hidden && !ev.target.closest(".profile")) closeMenu(); });
  document.addEventListener("keydown", (ev) => {
    if (pMenu.hidden) return;
    const items = [...pMenu.querySelectorAll(".pm-item")];
    const i = items.indexOf(document.activeElement);
    if (ev.key === "Escape") { closeMenu(); pBtn.focus(); }
    else if (ev.key === "ArrowDown") { ev.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  });

  /* ---------------- tema ---------------- */
  const themeSw = document.getElementById("themeSw");
  function syncThemeSw() {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    themeSw.setAttribute("aria-pressed", String(dark));
    themeSw.setAttribute("aria-label", dark ? "Açık temaya geç" : "Karanlık temaya geç");
  }
  themeSw.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    store.set("theme", next);
    syncThemeSw();
  });
  syncThemeSw();

  /* ---------------- yukarı çık düğmesi ---------------- */
  const toTop = document.getElementById("toTop");
  const syncToTop = () => toTop.classList.toggle("show", window.scrollY > 500);
  window.addEventListener("scroll", syncToTop, { passive: true });
  toTop.addEventListener("click", () => {
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  });
  syncToTop();

  /* ---------------- skill açıklama kutusu ---------------- */
  // Fareyle üstüne gelince, klavyeyle odaklanınca ya da dokununca skill'in Türkçe açıklaması çıkar.
  const tip = document.createElement("div");
  tip.className = "tip"; tip.setAttribute("role", "tooltip"); tip.hidden = true;
  document.body.appendChild(tip);
  let tipFor = null;

  function showTip(el) {
    const id = el.dataset.skill;
    const s = DATA.skills[id];
    if (!s) return;
    tipFor = el;
    tip.innerHTML = `<div class="tip-h">${s.icon ? `<img src="img/skill/${s.icon}.png" alt="" ${hideBroken}>` : ""}<b>${esc(s.name)}</b></div>
      <p>${esc(skillDesc(id))}</p>`;
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8);
    let top = r.top - h - 10;
    tip.classList.toggle("below", top < 8);
    if (top < 8) top = r.bottom + 10;
    tip.style.left = left + window.scrollX + "px";
    tip.style.top = top + window.scrollY + "px";
  }
  function hideTip() { tip.hidden = true; tipFor = null; }

  document.addEventListener("mouseover", (ev) => {
    const el = ev.target.closest && ev.target.closest("[data-skill]");
    if (el && el !== tipFor) showTip(el); else if (!el && tipFor && ev.pointerType !== "touch") hideTip();
  });
  document.addEventListener("focusin", (ev) => { const el = ev.target.closest && ev.target.closest("[data-skill]"); if (el) showTip(el); });
  document.addEventListener("focusout", (ev) => { if (ev.target === tipFor) hideTip(); });
  document.addEventListener("click", (ev) => {
    const el = ev.target.closest && ev.target.closest("[data-skill]");
    if (el) { ev.stopPropagation(); el === tipFor && !tip.hidden ? hideTip() : showTip(el); }
    else if (tipFor) hideTip();
  }, true);
  window.addEventListener("scroll", () => { if (tipFor) hideTip(); }, { passive: true });

  /* ---------------- veri ---------------- */
  const D = window.UMAUMA_DATA;
  if (!D) {
    app.innerHTML = `<p class="loading">Veriler yüklenemedi. Sayfayı yenilemeyi dene.</p>`;
  } else {
    Object.assign(DATA, D);
    DATA.cards.forEach((c) => { DATA.cardById[c.id] = c; });
    DATA.umas.forEach((u) => { DATA.umaById[u.id] = u; });
    rebuildOwned();
    renderMenu();
    if (location.hash === "#giris") { history.replaceState(null, "", "#umalar"); openAuth("login"); }
    render();
  }
})();
