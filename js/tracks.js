/* UmaCollector — Pist haritaları (Araçlar › Pist Haritaları)
   Veri: window.UMAUMA_DATA.courses (GameTora parkur verisi). Çizim UmaCollector'ın kendi yöntemi:
   parkur, finişten geriye doğru düzlük/viraj parçalarıyla "kaplumbağa" gibi çizilir. */
(() => {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PHASES = [["Başlangıç", "var(--green)"], ["Yarışın ortası", "var(--yellow)"], ["Yarışın sonu", "#ff9a3c"], ["Son atak", "var(--pink)"]];
  const STATN = { 1: "Speed", 2: "Stamina", 3: "Power", 4: "Guts", 5: "Wit" };
  const distCat = (m) => (m <= 1400 ? "Sprint" : m <= 1800 ? "Mile" : m <= 2400 ? "Medium" : "Long");
  const dirName = (t) => (t === 1 ? "Sağ" : t === 2 ? "Sol" : "Düz");
  const ioName = (io) => (io === 2 ? "İç" : io === 3 ? "Dış" : "");
  const phaseAt = (c, m) => { const i = c.phases.findIndex(([a, b]) => m >= a && m < b); return i < 0 ? 3 : i; };
  const cornerAt = (c, m) => c.corners.find(([a, b]) => m >= a && m < b);
  const fmt = (n) => n.toLocaleString("tr-TR");

  // Parkurun noktaları: her 4 m'de bir {x, y, m}. Virajlarda her viraj parçası 90° döner.
  function trackPoints(c) {
    const step = 4, sign = c.turn === 2 ? -1 : 1;
    let x = 0, y = 0, a = 0;
    const pts = [{ x, y, m: 0 }];
    for (let m = 0; m < c.length; m += step) {
      const k = cornerAt(c, m);
      if (k) a += sign * (Math.PI / 2) * (step / Math.max(40, k[1] - k[0]));
      x += Math.cos(a) * step; y += Math.sin(a) * step;
      pts.push({ x, y, m: Math.min(c.length, m + step) });
    }
    // Finişteki yön sağa bakacak şekilde döndür
    const end = pts[pts.length - 1], prev = pts[pts.length - 3] || pts[0];
    const rot = -Math.atan2(end.y - prev.y, end.x - prev.x);
    const cr = Math.cos(rot), sr = Math.sin(rot);
    pts.forEach((p) => { const nx = p.x * cr - p.y * sr, ny = p.x * sr + p.y * cr; p.x = nx; p.y = ny; });
    return pts;
  }

  function mapSvg(c, opts = {}) {
    const pts = trackPoints(c);
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const pad = opts.mini ? 30 : 60;
    let minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad, minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
    const w = maxX - minX, h = Math.max(maxY - minY, w * 0.32);
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2; minY = cy - h / 2;
    const sw = Math.max(w, h) / (opts.mini ? 38 : 60);
    const line = (from, to) => pts.filter((p) => p.m >= from && p.m <= to).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    let svg = `<svg class="tk-map" viewBox="${minX.toFixed(0)} ${minY.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}" role="img" aria-label="${esc(c.track)} ${c.length} m parkur haritası">`;
    svg += `<polyline points="${line(0, c.length)}" fill="none" stroke="var(--line)" stroke-width="${sw * 2.2}" stroke-linecap="round" stroke-linejoin="round"/>`;
    c.phases.forEach(([a, b], i) => {
      svg += `<polyline class="tk-ph" data-ph="${i}" points="${line(a, b)}" fill="none" stroke="${PHASES[i][1]}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    });
    if (!opts.mini) {
      // Aynı numaralı viraj birden çok turda geçiyorsa yalnızca sonuncusu etiketlenir
      const lastOf = {}; c.corners.forEach((k, i) => { lastOf[k[2]] = i; });
      c.corners.filter((k, i) => lastOf[k[2]] === i).forEach(([a, b, n]) => {
        const mid = pts.reduce((best, p) => (Math.abs(p.m - (a + b) / 2) < Math.abs(best.m - (a + b) / 2) ? p : best), pts[0]);
        svg += `<g class="tk-corner"><circle cx="${mid.x.toFixed(1)}" cy="${mid.y.toFixed(1)}" r="${sw * 1.6}"/><text x="${mid.x.toFixed(1)}" y="${mid.y.toFixed(1)}" font-size="${sw * 1.7}">${n}</text></g>`;
      });
      const sp = pts.reduce((best, p) => (Math.abs(p.m - c.spurt) < Math.abs(best.m - c.spurt) ? p : best), pts[0]);
      svg += `<circle class="tk-spurt" cx="${sp.x.toFixed(1)}" cy="${sp.y.toFixed(1)}" r="${sw * 0.9}"/>`;
    }
    const s = pts[0], e = pts[pts.length - 1];
    svg += `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="${sw * 1.15}" fill="var(--surface)" stroke="var(--green-deep)" stroke-width="${sw * 0.5}"/>`;
    svg += `<rect x="${(e.x - sw * 0.35).toFixed(1)}" y="${(e.y - sw * 2).toFixed(1)}" width="${(sw * 0.7).toFixed(1)}" height="${(sw * 4).toFixed(1)}" fill="var(--ink)"/>`;
    if (!opts.mini) {
      svg += `<text class="tk-lab" x="${s.x.toFixed(1)}" y="${(s.y - sw * 2.2).toFixed(1)}" font-size="${sw * 1.5}">Start</text>`;
      svg += `<text class="tk-lab" x="${e.x.toFixed(1)}" y="${(e.y + sw * 3.6).toFixed(1)}" font-size="${sw * 1.5}">Finiş</text>`;
    }
    return svg + "</svg>";
  }

  // Doğrusal döküm: bölümler, düzlük/viraj, yokuşlar ve işaretler
  function stripHtml(c) {
    const L = c.length, pct = (m) => (m / L * 100).toFixed(3) + "%";
    const seg = (a, b, cls, label, extra = "") =>
      `<span class="tk-seg ${cls}" style="left:${pct(a)};width:${pct(b - a)}" ${extra}>${b - a > L * 0.07 ? label : ""}</span>`;
    const phases = c.phases.map(([a, b], i) => seg(a, b, `ph${i}`, PHASES[i][0], `title="${PHASES[i][0]}: ${fmt(a)}–${fmt(b)} m"`)).join("");
    const parts = [...c.straights.map(([a, b, f]) => [a, b, "st", f === 1 ? "Düzlük" : f === 2 ? "Karşı düzlük" : "Düzlük"]),
      ...c.corners.map(([a, b, n]) => [a, b, "cn", `Viraj ${n}`])].sort((p, q) => p[0] - q[0]);
    const lastCorner = c.corners.length ? Math.max(...c.corners.map((k) => k[0])) : -1;
    const lastStraight = c.straights.length ? Math.max(...c.straights.map((k) => k[0])) : -1;
    const geo = parts.map(([a, b, cls, lab]) => {
      const name = cls === "cn" && a === lastCorner ? "Son viraj" : cls === "st" && a === lastStraight ? "Son düzlük" : lab;
      return seg(a, b, cls, name, `title="${name}: ${fmt(a)}–${fmt(b)} m"`);
    }).join("");
    const slopes = c.slopes.length ? c.slopes.map(([a, b, s]) => {
      const p = (s / 10000).toFixed(1).replace(".0", ""), up = s > 0;
      return seg(a, b, up ? "sl-up" : "sl-down", `${up ? "↗ Yokuş" : "↘ İniş"} %${Math.abs(p)}`, `title="${up ? "Yokuş" : "İniş"} %${Math.abs(p)}: ${fmt(a)}–${fmt(b)} m"`);
    }).join("") : `<span class="tk-flat">Düz, yokuş ya da iniş yok</span>`;
    const ticks = [];
    const stepM = L > 2400 ? 400 : 200;
    for (let m = 0; m <= L; m += stepM) ticks.push(`<span class="tk-tick" style="left:${pct(m)}">${fmt(m)}</span>`);
    const mark = (m, cls, lab) => `<span class="tk-mark ${cls}" style="left:${pct(m)}"><b>${lab}</b></span>`;
    return `<div class="tk-strip">
      <div class="tk-row"><span class="tk-rl">Bölüm</span><div class="tk-track">${phases}</div></div>
      <div class="tk-row"><span class="tk-rl">Parkur</span><div class="tk-track">${geo}</div></div>
      <div class="tk-row"><span class="tk-rl">Eğim</span><div class="tk-track">${slopes}</div></div>
      <div class="tk-row tk-marks"><span class="tk-rl"></span><div class="tk-track">${mark(c.keepEnd, "keep", "Konum koruma biter")}${mark(c.spurt, "spurt", "Son atak başlar")}${ticks.join("")}</div></div>
    </div>`;
  }

  function title(c) {
    const io = ioName(c.inout);
    return `${esc(c.track)} ${c.terrain === "Turf" ? "Çim" : "Dirt"} ${fmt(c.length)} m${io ? " " + io : ""}`;
  }
  function chips(c) {
    return `<span class="chip-s ${c.terrain === "Turf" ? "turf" : "dirt"}">${c.terrain}</span>
      <span class="chip-s">${distCat(c.length)}</span><span class="chip-s">${dirName(c.turn)}${c.turn !== 4 ? " dönüş" : ""}</span>`;
  }

  // Filtreler
  const st = { track: "", terrain: "", dist: "", q: "" };

  function list() {
    const C = window.UMAUMA_DATA.courses;
    const q = st.q.toLocaleLowerCase("tr");
    return C.filter((c) => (!st.track || c.track === st.track) && (!st.terrain || c.terrain === st.terrain)
      && (!st.dist || distCat(c.length) === st.dist)
      && (!q || c.races.some(([n]) => n.toLocaleLowerCase("tr").includes(q)) || c.track.toLowerCase().includes(q)));
  }

  function render(app) {
    const C = window.UMAUMA_DATA.courses;
    const tracks = [...new Set(C.map((c) => c.track))];
    const L = list();
    const chip = (key, val, label) => `<button type="button" class="chip ${st[key] === val ? "on" : ""}" data-tk="${key}" data-v="${val}" aria-pressed="${st[key] === val}">${label}</button>`;
    app.innerHTML = `
      <div class="page-head"><h1>Pist Haritaları</h1><span class="count">${L.length} / ${C.length}</span></div>
      <section class="filters" aria-label="Pist filtreleri">
        <div class="frow">
          <input class="search" id="tkq" type="search" placeholder="Yarış ya da hipodrom ara, örn. Arima Kinen" value="${esc(st.q)}">
          <select class="select" id="tkTrack" aria-label="Hipodrom"><option value="">Tüm hipodromlar</option>${tracks.map((t) => `<option ${st.track === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
        </div>
        <div class="frow"><span class="flabel">Zemin</span>${chip("terrain", "", "Hepsi")}${chip("terrain", "Turf", "Çim")}${chip("terrain", "Dirt", "Dirt")}</div>
        <div class="frow"><span class="flabel">Mesafe</span>${chip("dist", "", "Hepsi")}${["Sprint", "Mile", "Medium", "Long"].map((d) => chip("dist", d, d)).join("")}</div>
      </section>
      <div class="grid tk-grid">${L.map((c) => `
        <button type="button" class="box tk-card" data-course="${c.id}">
          <div class="tk-mini">${mapSvg(c, { mini: true })}</div>
          <div class="name">${title(c)}</div>
          <div class="tk-chips">${chips(c)}</div>
          <div class="tk-races">${c.races.slice(0, 3).map(([n, g]) => `<span class="tk-race g-${g.replace("-", "")}">${g}</span>${esc(n)}`).join("<br>")}${c.races.length > 3 ? `<br><span class="hint">+${c.races.length - 3} yarış daha</span>` : ""}</div>
        </button>`).join("") || `<div class="empty">Bu filtrelere uyan parkur yok.</div>`}</div>`;
  }

  function openCourse(id) {
    const c = window.UMAUMA_DATA.courses.find((x) => x.id === id);
    if (!c) return;
    const bg = document.createElement("div");
    bg.className = "modal-bg";
    const stats = c.stats.map((s) => STATN[s]).filter(Boolean);
    bg.innerHTML = `<div class="modal tk-modal" role="dialog" aria-modal="true" aria-labelledby="tkTitle">
      <button type="button" class="modal-x" data-tkclose aria-label="Kapat">×</button>
      <h2 id="tkTitle">${title(c)}</h2>
      <div class="tk-chips center">${chips(c)}</div>
      <div class="tk-big">${mapSvg(c)}</div>
      <div class="tk-legend">${PHASES.map(([n, col]) => `<span><i style="background:${col}"></i>${n}</span>`).join("")}<span><i class="sp"></i>Son atak başlangıcı</span></div>
      ${stripHtml(c)}
      <div class="tk-info">
        <div><b>Son atak</b><span>${fmt(c.spurt)} m'den itibaren, son ${fmt(c.length - c.spurt)} m</span></div>
        <div><b>Konum koruma</b><span>İlk ${fmt(c.keepEnd)} m</span></div>
        <div><b>Viraj</b><span>${c.corners.length} viraj parçası${c.laps.length > 1 ? ` · ${c.laps.length} tur çizgisi` : ""}</span></div>
        ${stats.length ? `<div><b>Stat bonusu</b><span>${stats.join(", ")} yüksek olan Uma'lar bu parkurda ek hız kazanır</span></div>` : ""}
      </div>
      <h3 class="bn-h">Bu parkurdaki yarışlar</h3>
      <div class="tk-racelist">${c.races.map(([n, g]) => `<span class="tag"><span class="tk-race g-${g.replace("-", "")}">${g}</span>${esc(n)}</span>`).join("")}</div>
    </div>`;
    document.body.appendChild(bg);
    document.body.classList.add("modal-open");
    const close = () => { bg.remove(); document.body.classList.remove("modal-open"); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    bg.addEventListener("click", (ev) => { if (ev.target === bg || ev.target.closest("[data-tkclose]")) close(); });
    // Döküm satırının üstüne gelince haritada o bölüm vurgulanır
    bg.querySelectorAll(".tk-seg[class*='ph']").forEach((el) => {
      const i = el.className.match(/ph(\d)/)[1];
      el.addEventListener("mouseenter", () => bg.querySelectorAll(".tk-ph").forEach((p) => p.classList.toggle("dim", p.dataset.ph !== i)));
      el.addEventListener("mouseleave", () => bg.querySelectorAll(".tk-ph").forEach((p) => p.classList.remove("dim")));
    });
  }

  window.UmaTracks = {
    render,
    handle(ev, rerender) {
      const card = ev.target.closest(".tk-card");
      if (card) { openCourse(Number(card.dataset.course)); return true; }
      const ch = ev.target.closest("[data-tk]");
      if (ch) { st[ch.dataset.tk] = ch.dataset.v; rerender(); return true; }
      return false;
    },
    input(ev, rerender) {
      if (ev.target.id === "tkq") { st.q = ev.target.value; rerender(true); return true; }
      if (ev.target.id === "tkTrack") { st.track = ev.target.value; rerender(); return true; }
      return false;
    },
  };
})();
