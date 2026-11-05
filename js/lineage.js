/* UmaCollector — Soy Planlayıcı (Araçlar › Soy Planlayıcı)
   Uyum: oyunun karakter ilişki grupları (GameTora db-files succession_relation ve _member).
   İki ya da üç karakterin hepsinin bulunduğu her grubun puanı toplanır:
     ebeveyn tarafı i = Sen+Ei + Sen+Ei+Bi1 + Sen+Ei+Bi2 + Ei ile büyükebeveynlerinin ortak kazandığı graded yarış sayısı
     toplam = taraf 1 + taraf 2 + E1+E2.  ◎ 151 ve üstü, ○ 51–150, △ 0–50.
   Spark ihtimalleri topluluk ölçümleridir: temel oran × (1 + taraf uyumu / 100), büyükebeveynde yarısı. */
(() => {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const T = () => window.UMAUMA_TOOLS;
  const D = () => window.UMAUMA_DATA;
  const UMA = (id) => window.UmaApp.umaById[id];
  const chara = (id) => Math.floor(id / 100);
  const SLOTS = ["t", "p1", "p2", "g11", "g12", "g21", "g22"];
  const LABEL = { t: "Yetiştirdiğin", p1: "Ebeveyn 1", p2: "Ebeveyn 2", g11: "Büyükebeveyn", g12: "Büyükebeveyn", g21: "Büyükebeveyn", g22: "Büyükebeveyn" };
  const SPARKS = [["Mavi", "stat", [70, 80, 90]], ["Pembe", "uygunluk", [1, 3, 5]], ["Yeşil", "özel skill", [5, 10, 15]], ["Beyaz", "skill", [3, 6, 9]], ["Beyaz", "yarış", [1, 2, 3]]];
  const store = {
    get(k, d) { try { const v = localStorage.getItem("umauma." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("umauma." + k, JSON.stringify(v)); } catch (e) { /* yok say */ } },
  };
  const S = store.get("soy", null) || { t: null, p1: null, p2: null, g11: null, g12: null, g21: null, g22: null, r: { g11: 0, g12: 0, g21: 0, g22: 0 } };
  const save = () => store.set("soy", S);

  /* ---------- uyum ---------- */
  let memo = null;
  function groups(c) {
    if (!memo) { memo = {}; Object.entries(T().rel).forEach(([k, v]) => { memo[k] = new Set(v); }); }
    return memo[c] || new Set();
  }
  function rel(...ids) {
    if (ids.some((x) => !x)) return null;
    const sets = ids.map((id) => groups(chara(id)));
    let sum = 0;
    sets[0].forEach((g) => { if (sets.every((s) => s.has(g))) sum += T().rp[g] || 0; });
    return sum;
  }
  function calc(st) {
    const side = (i) => {
      const p = st["p" + i], parts = [];
      const add = (label, v, kind) => { if (v !== null) parts.push([label, v, kind]); };
      add(`Sen + ${short(p)}`, rel(st.t, p), "pair");
      ["1", "2"].forEach((j) => {
        const g = st[`g${i}${j}`];
        add(`Sen + ${short(p)} + ${short(g)}`, rel(st.t, p, g), "triple");
        if (p && g && st.r[`g${i}${j}`]) parts.push([`${short(p)} ile ${short(g)} ortak yarış`, +st.r[`g${i}${j}`], "race"]);
      });
      return { parts, sum: parts.reduce((a, x) => a + x[1], 0) };
    };
    const s1 = side(1), s2 = side(2), pp = rel(st.p1, st.p2);
    return { s1, s2, pp, total: s1.sum + s2.sum + (pp || 0) };
  }
  const short = (id) => (id && UMA(id) ? UMA(id).name : "?");
  const mark = (v) => (v >= 151 ? ["◎", "great", "Harika uyum"] : v >= 51 ? ["○", "good", "İyi uyum"] : ["△", "poor", "Zayıf uyum"]);

  /* ---------- görünüm ---------- */
  function slotHtml(k, cls = "") {
    const id = S[k], u = id && UMA(id);
    const owned = id && window.UmaApp.owned().has(id);
    const race = k.startsWith("g") && S["p" + k[1]] && id
      ? `<label class="ln-race" title="Ebeveynle bu büyükebeveynin ikisinin de kazandığı G1, G2 ve G3 yarışları"><span>Ortak yarış</span><input type="number" min="0" max="99" value="${S.r[k] || 0}" data-lnrace="${k}"></label>` : "";
    return `<div class="ln-slot ${cls} ${u ? "" : "empty"}" data-k="${k}">
      <button type="button" class="ln-pick" data-lnpick="${k}" aria-label="${LABEL[k]} seç">
        ${u ? `<img src="img/uma/${u.id}.png" alt="">` : `<span class="ln-plus">+</span>`}
        <span class="ln-tx"><small>${LABEL[k]}</small><b>${u ? esc(u.name) : "Seç"}</b>${u ? `<i>${esc(u.title)}</i>` : ""}</span>
        ${owned ? `<span class="ln-own">Sende</span>` : ""}
      </button>
      ${u ? `<button type="button" class="ln-x" data-lnclear="${k}" aria-label="Kaldır">×</button>` : ""}
      ${race}
    </div>`;
  }

  function sparkTable(i, aff) {
    const p = S["p" + i];
    if (!p) return "";
    const pct = (v) => (v >= 99.95 ? "100" : v >= 10 ? Math.round(v) : v.toFixed(1).replace(".", ",").replace(",0", "")) + "%";
    const hasG = S[`g${i}1`] || S[`g${i}2`];
    return `<div class="ln-spk">
      <div class="ln-spkh"><b>${esc(short(p))} tarafı</b><span>uyum ${aff}</span></div>
      <table><thead><tr><th>Spark</th><th>★1</th><th>★2</th><th>★3</th></tr></thead>
      <tbody>${SPARKS.map(([n, sub, base]) => `<tr><th>${n} <small>${sub}</small></th>${base.map((b) => {
        const v = Math.min(100, b * (1 + aff / 100));
        return `<td><b>${pct(v)}</b>${hasG ? `<small>${pct(v / 2)}</small>` : ""}</td>`; }).join("")}</tr>`).join("")}</tbody></table>
      ${hasG ? `<div class="ln-spkn"><b>Kalın</b> ebeveynin, küçük yazı büyükebeveynlerin sparkları için bir ilhamdaki ihtimal</div>` : `<div class="ln-spkn">Ebeveynin sparkları için bir ilhamdaki ihtimal</div>`}
    </div>`;
  }

  function resultHtml() {
    const r = calc(S);
    if (!S.t || (!S.p1 && !S.p2)) {
      return `<section class="panel ln-res"><h2>Uyum</h2><p class="hint">Yetiştireceğin Uma'yı ve en az bir ebeveyni seç. Uyum puanı, puan dökümü ve spark ihtimalleri burada görünür.</p></section>`;
    }
    const [sym, cls, word] = mark(r.total);
    const pctBar = Math.min(100, r.total / 200 * 100);
    const row = ([label, v, kind]) => `<li class="${kind}"><span>${esc(label)}</span><b>+${v}</b></li>`;
    return `<section class="panel ln-res">
      <h2>Uyum</h2>
      <div class="ln-score ${cls}"><span class="ln-sym">${sym}</span><div><b>${r.total}</b><small>${word}</small></div></div>
      <div class="ln-meter"><i style="width:${pctBar}%"></i><span class="t1" style="left:${51 / 2}%">○ 51</span><span class="t2" style="left:${151 / 2}%">◎ 151</span></div>
      <div class="ln-break">
        ${[1, 2].map((i) => S["p" + i] ? `<div><div class="ln-bh"><span>${esc(short(S["p" + i]))} tarafı</span><b>${r["s" + i].sum}</b></div><ul>${r["s" + i].parts.map(row).join("")}</ul></div>` : "").join("")}
        ${r.pp !== null ? `<div><div class="ln-bh"><span>İki ebeveyn birbiriyle</span><b>${r.pp}</b></div><ul>${row([`${short(S.p1)} + ${short(S.p2)}`, r.pp, "pair"])}</ul></div>` : ""}
      </div>
      <h3>Spark ihtimalleri</h3>
      <div class="ln-spks">${sparkTable(1, r.s1.sum)}${sparkTable(2, r.s2.sum)}</div>
    </section>`;
  }

  function render(app) {
    if (!T()) { app.innerHTML = `<p class="loading">Yükleniyor…</p>`; window.UmaSim.needTools(() => { if (location.hash === "#araclar/soy") render(app); }); return; }
    app.innerHTML = `
      <div class="page-head"><h1>Soy Planlayıcı</h1></div>
      <div class="ln-wrap">
        <section class="panel ln-tree">
          <div class="ln-col c0">${slotHtml("t", "big")}</div>
          <div class="ln-col c1">
            <div class="ln-fam">${slotHtml("p1", "par")}<div class="ln-gs">${slotHtml("g11")}${slotHtml("g12")}</div></div>
            <div class="ln-fam">${slotHtml("p2", "par")}<div class="ln-gs">${slotHtml("g21")}${slotHtml("g22")}</div></div>
          </div>
          <div class="ln-tools"><button type="button" class="chip" data-lnreset>Temizle</button></div>
        </section>
        ${resultHtml()}
      </div>
      <p class="source">Uyum oyunun karakter ilişki gruplarından hesaplanır, veri GameTora. Spark ihtimalleri topluluğun ölçtüğü temel oranlara dayanır, oyunun açıkladığı değerler değildir.</p>`;
  }

  /* ---------- seçici ---------- */
  function openPicker(k, rerender) {
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    let q = "", onlyOwned = false;
    const owned = window.UmaApp.owned();
    const base = calc(S).total;
    const blocked = new Set();
    if (k.startsWith("p")) { [S.t, S[k === "p1" ? "p2" : "p1"]].forEach((x) => x && blocked.add(chara(x))); }
    if (k === "t") [S.p1, S.p2].forEach((x) => x && blocked.add(chara(x)));
    const gain = (id) => { if (k === "t" && !S.p1 && !S.p2) return null; const st = { ...S, r: S.r, [k]: id }; return calc(st).total - (S[k] ? calc({ ...S, [k]: null }).total : base); };
    const cands = D().umas.map((u) => ({ u, g: blocked.has(chara(u.id)) ? null : gain(u.id) }));
    const draw = () => {
      const qq = q.trim().toLocaleLowerCase("tr");
      const list = cands.filter(({ u }) => (!qq || `${u.name} ${u.title}`.toLocaleLowerCase("tr").includes(qq)) && (!onlyOwned || owned.has(u.id)))
        .sort((a, b) => (blocked.has(chara(a.u.id)) - blocked.has(chara(b.u.id))) || ((b.g ?? -1) - (a.g ?? -1)) || a.u.name.localeCompare(b.u.name));
      bg.querySelector(".ln-grid").innerHTML = list.map(({ u, g }) => {
        const no = blocked.has(chara(u.id));
        return `<button type="button" class="ln-cand ${no ? "no" : ""} ${S[k] === u.id ? "on" : ""}" data-lnset="${u.id}" ${no ? "disabled" : ""} title="${esc(u.name)} ${esc(u.title)}">
          <img src="img/uma/${u.id}.png" alt="" loading="lazy">
          <span><b>${esc(u.name)}</b><small>${esc(u.title)}</small></span>
          ${no ? `<i class="ln-g no">Seçilemez</i>` : g !== null ? `<i class="ln-g">+${g}</i>` : ""}
          ${owned.has(u.id) ? `<em>Sende</em>` : ""}
        </button>`;
      }).join("") || `<div class="empty">Bulunamadı</div>`;
    };
    bg.innerHTML = `<div class="modal ln-modal" role="dialog" aria-modal="true" aria-labelledby="lnTitle">
      <button type="button" class="modal-x" data-lnclose aria-label="Kapat">×</button>
      <h2 id="lnTitle">${LABEL[k]} seç</h2>
      <div class="frow ln-mf"><input class="search" type="search" placeholder="Uma ara" autocomplete="off" data-lnq>
        ${owned.size ? `<button type="button" class="toggle small" data-lnowned aria-pressed="false"><span class="knob" aria-hidden="true"></span>Sadece sendekiler</button>` : ""}</div>
      ${k === "t" && !S.p1 && !S.p2 ? "" : `<p class="hint ln-mh">Sayılar bu Uma'nın toplam uyuma katacağı puan</p>`}
      <div class="ln-grid"></div>
    </div>`;
    document.body.appendChild(bg);
    document.body.classList.add("modal-open");
    draw();
    const close = () => { bg.remove(); document.body.classList.remove("modal-open"); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    bg.querySelector("[data-lnq]").addEventListener("input", (e) => { q = e.target.value; draw(); });
    setTimeout(() => { if (window.matchMedia("(hover: hover)").matches) bg.querySelector("[data-lnq]").focus(); }, 30);
    bg.addEventListener("click", (ev) => {
      if (ev.target === bg || ev.target.closest("[data-lnclose]")) return close();
      const ow = ev.target.closest("[data-lnowned]");
      if (ow) { onlyOwned = !onlyOwned; ow.classList.toggle("on", onlyOwned); ow.setAttribute("aria-pressed", onlyOwned); draw(); return; }
      const c = ev.target.closest("[data-lnset]");
      if (c) { S[k] = Number(c.dataset.lnset); save(); close(); rerender(); }
    });
  }

  window.UmaLineage = {
    render,
    handle(ev, rerender) {
      const t = ev.target;
      const p = t.closest("[data-lnpick]");
      if (p) { openPicker(p.dataset.lnpick, rerender); return true; }
      const c = t.closest("[data-lnclear]");
      if (c) { S[c.dataset.lnclear] = null; if (S.r[c.dataset.lnclear] !== undefined) S.r[c.dataset.lnclear] = 0; save(); rerender(); return true; }
      if (t.closest("[data-lnreset]")) { SLOTS.forEach((k) => { S[k] = null; }); S.r = { g11: 0, g12: 0, g21: 0, g22: 0 }; save(); rerender(); return true; }
      return !!t.closest("[data-lnrace]");
    },
    input(ev, rerender) {
      const t = ev.target;
      if (!t.dataset.lnrace) return false;
      if (ev.type !== "change") return true;
      S.r[t.dataset.lnrace] = Math.max(0, Math.min(99, Number(t.value) || 0)); save(); rerender(); return true;
    },
  };
})();
