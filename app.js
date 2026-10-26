/* Skrip situs unduhan Slink: bahasa (ID/EN), menu ponsel, deteksi perangkat, rilis terbaru dari GitHub, video hero.
   Tanpa pustaka luar. Bila skrip ini gagal, halaman tetap terbaca (teks Indonesia bawaan, tombol menuju kartu unduhan). */
(() => {
  "use strict";
  const doc = document, root = doc.documentElement;
  const $ = (s, r) => (r || doc).querySelector(s);
  const $$ = (s, r) => Array.from((r || doc).querySelectorAll(s));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* mode privat: abaikan */ } },
  };

  /* ---------------------------------------------------------------- bahasa */
  const EN = window.SLINK_EN || {};
  const JS = window.SLINK_JS || { id: {}, en: {} };
  let lang = "id";
  const idText = new WeakMap(), idAttr = new WeakMap();
  $$("[data-i18n]").forEach(el => idText.set(el, el.tagName === "TITLE" ? el.textContent : el.innerHTML));
  $$("[data-i18n-attr]").forEach(el => {
    const base = {};
    el.getAttribute("data-i18n-attr").split(";").forEach(pair => {
      const a = pair.slice(0, pair.indexOf(":"));
      base[a] = el.getAttribute(a);
    });
    idAttr.set(el, base);
  });

  function t(key, vars) {
    let s = (JS[lang] && JS[lang][key]) || (JS.id && JS.id[key]) || key;
    if (vars) for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
    return s;
  }

  function applyLang(l) {
    lang = l === "en" ? "en" : "id";
    root.lang = lang;
    $$("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      const val = lang === "en" && EN[key] !== undefined ? EN[key] : idText.get(el);
      if (val === undefined) return;
      if (el.tagName === "TITLE") el.textContent = val; else el.innerHTML = val;
    });
    $$("[data-i18n-attr]").forEach(el => {
      const base = idAttr.get(el) || {};
      el.getAttribute("data-i18n-attr").split(";").forEach(pair => {
        const i = pair.indexOf(":"), a = pair.slice(0, i), key = pair.slice(i + 1);
        const val = lang === "en" && EN[key] !== undefined ? EN[key] : base[a];
        if (val !== undefined && val !== null) el.setAttribute(a, val);
      });
    });
    $$("[data-lang]").forEach(b => b.setAttribute("aria-pressed", b.getAttribute("data-lang") === lang ? "true" : "false"));
    refresh();
  }

  doc.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-lang]");
    if (!b) return;
    store.set("slink.lang", b.getAttribute("data-lang"));
    applyLang(b.getAttribute("data-lang"));
  });

  /* ---------------------------------------------------------------- menu ponsel (hamburger) */
  const burger = $(".burger"), menu = $("#mobile-menu");
  function setMenu(open) {
    if (!burger || !menu) return;
    burger.setAttribute("aria-expanded", open ? "true" : "false");
    burger.setAttribute("aria-label", t(open ? "menu.close" : "menu.open"));
    menu.hidden = !open;
  }
  if (burger && menu) {
    burger.addEventListener("click", () => setMenu(menu.hidden));
    menu.addEventListener("click", e => { if (e.target.closest("a")) setMenu(false); });
    doc.addEventListener("click", e => { if (!menu.hidden && !e.target.closest(".topnav")) setMenu(false); });
    doc.addEventListener("keydown", e => { if (e.key === "Escape" && !menu.hidden) { setMenu(false); burger.focus(); } });
    const wide = window.matchMedia("(min-width: 768px)");
    (wide.addEventListener ? wide.addEventListener.bind(wide, "change") : wide.addListener.bind(wide))(() => { if (wide.matches) setMenu(false); });
  }

  /* ---------------------------------------------------------------- perangkat yang cocok */
  function detect() {
    const ua = navigator.userAgent || "";
    const plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
    if (/android/i.test(ua)) return "android";
    if (/iPhone|iPod|iPad/.test(ua)) return "iphone";
    if (/Mac/i.test(plat + ua) && navigator.maxTouchPoints > 1) return "iphone";   // iPad yang menyamar sebagai Mac
    if (/Win/i.test(plat) || /Windows/.test(ua)) return "windows";
    if (/Mac/i.test(plat) || /Macintosh/.test(ua)) return "mac";
    if (/CrOS/.test(ua)) return "web";
    if (/Linux|X11/i.test(plat + ua)) return "linux";
    return "web";
  }
  const here = detect();

  /* ---------------------------------------------------------------- rilis GitHub */
  const REPO = String(window.SLINK_REPO || "").trim();
  const REPO_OK = /^[\w.-]+\/[\w.-]+$/.test(REPO);
  const PLATS = ["android", "iphone", "windows", "mac", "linux", "web"];
  const MATCH = { android: /\.apk$/i, iphone: /\.ipa$/i, windows: /win.*\.zip$/i, mac: /mac.*\.zip$/i, linux: /linux.*\.tar\.gz$/i };
  const state = {};
  PLATS.forEach(p => { state[p] = { s: "loading" }; });
  let release = null;

  const slim = d => ({
    tag: d.tag_name || "", name: d.name || "", body: d.body || "", at: d.published_at || "", url: d.html_url || "",
    assets: (d.assets || []).map(a => ({ name: a.name, size: a.size, url: a.browser_download_url, digest: a.digest || "" })),
  });

  async function loadRelease() {
    if (!REPO_OK) return null;
    try {
      const c = JSON.parse(sessionStorage.getItem("slink.rel") || "null");
      if (c && c.repo === REPO && Date.now() - c.t < 600000) return c.d;
    } catch (e) { /* tanpa cache */ }
    const r = await fetch("https://api.github.com/repos/" + REPO + "/releases/latest", { headers: { Accept: "application/vnd.github+json" } });
    if (!r.ok) return null;
    const d = slim(await r.json());
    try { sessionStorage.setItem("slink.rel", JSON.stringify({ repo: REPO, t: Date.now(), d })); } catch (e) { /* abaikan */ }
    return d;
  }

  async function webReady() {
    if (location.protocol === "file:") return false;
    try { return (await fetch("play/index.html", { method: "HEAD" })).ok; } catch (e) { return false; }
  }

  const fmtSize = n => (n / 1048576).toFixed(1).replace(".", lang === "id" ? "," : ".") + " MB";
  const fmtDate = iso => { try { return new Date(iso).toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { year: "numeric", month: "short", day: "numeric" }); } catch (e) { return ""; } };
  const version = () => (release ? release.tag.replace(/^v/i, "") : "");

  function refresh() {
    /* kartu, bagian cara pasang, dan baris papan peringkat mengikuti status tiap platform */
    PLATS.forEach(p => {
      const st = state[p];
      $$('[data-platform="' + p + '"], [data-lb="' + p + '"]').forEach(el => el.setAttribute("data-state", st.s));
      $$('[data-platform="' + p + '"] [data-meta]').forEach(el => {
        if (p === "web") return;
        if (st.s === "ready") {
          el.textContent = st.asset.size ? t("meta.rel", { v: version(), s: fmtSize(st.asset.size), d: fmtDate(release.at) }) : t("meta.relnos", { v: version(), d: fmtDate(release.at) });
          el.hidden = false;
        } else { el.textContent = " "; }
      });
      $$('[data-lb="' + p + '"] [data-ver]').forEach(el => { el.textContent = version(); });
      $$('[data-dl="' + p + '"]').forEach(a => {
        if (p === "web") return;
        if (st.s === "ready") { a.href = st.asset.url; a.rel = "noopener"; }
      });
      $$('[data-hash="' + p + '"]').forEach(el => {
        const dg = st.s === "ready" && st.asset && /^sha256:/i.test(st.asset.digest || "") ? st.asset.digest.slice(7) : "";
        el.hidden = !dg;
        const c = $("code", el);
        if (c) c.textContent = dg;
      });
    });
    $$('.card[data-platform="' + here + '"]').forEach(el => el.setAttribute("data-here", ""));

    /* tombol utama di hero */
    const cta = $("[data-cta]");
    if (cta) {
      const lab = $("span", cta), note = $("[data-cta-note]");
      const name = t("p." + here), st = state[here];
      let href = "#unduh", nt = "";
      let text = lang === "en" ? (EN["hero.cta"] || "Download") : ((lab && idText.get(lab)) || "Unduh");
      if (st.s === "ready" && here !== "web") {
        href = st.asset.url; text = t("cta.for", { p: name });
        nt = t("note.ready", { p: name, v: version(), s: st.asset.size ? fmtSize(st.asset.size) : "" }).replace(/ · $/, "");
      } else if (st.s !== "loading") {
        if (state.web.s === "ready") {
          href = "play/"; text = t("cta.play"); nt = here === "web" ? t("note.web") : t("note.soon", { p: name });
        } else {
          text = t("cta.soon"); nt = here === "web" ? "" : t("note.soon", { p: name });
        }
      }
      cta.setAttribute("href", href);
      if (lab) lab.textContent = text;
      if (note) note.textContent = nt || " ";
    }
    if (burger) setMenu(menu && !menu.hidden);
  }

  /* ---------------------------------------------------------------- halaman cara pasang: tab aktif */
  function markTab(p) {
    $$(".tabs a").forEach(a => a.setAttribute("aria-current", a.getAttribute("href") === "#" + p ? "true" : "false"));
  }
  if ($(".tabs")) {
    const first = (location.hash || "").replace("#", "");
    markTab(first && $("#" + first + ".plat") ? first : here);
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(es => {
        es.forEach(e => { if (e.isIntersecting) markTab(e.target.id); });
      }, { rootMargin: "-25% 0px -65% 0px" });
      $$(".plat").forEach(s => io.observe(s));
    }
  }

  /* ---------------------------------------------------------------- panel rilis terbaru (catatan versi) */
  function showRelease() {
    const box = $("#latest");
    if (!box || !release) return;
    $("[data-r-title]", box).textContent = (release.name || release.tag) + (release.name && release.tag && release.name !== release.tag ? " · " + release.tag : "");
    $("[data-r-when]", box).textContent = fmtDate(release.at);
    $("[data-r-body]", box).textContent = (release.body || "").trim() || t("rel.empty");
    $("[data-r-link]", box).href = release.url || ("https://github.com/" + REPO + "/releases");
    box.hidden = false;
  }

  /* ---------------------------------------------------------------- tombol salin pada blok kode */
  doc.addEventListener("click", e => {
    const b = e.target.closest && e.target.closest("[data-copy]");
    if (!b) return;
    const code = $("code", b.parentNode);
    const text = code ? code.textContent : "";
    const done = () => {
      b.setAttribute("aria-label", t("copied"));
      const u = $("use", b);
      if (u) u.setAttribute("href", "#i-check");
      setTimeout(() => { b.setAttribute("aria-label", t("copy")); if (u) u.setAttribute("href", "#i-copy"); }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => {});
    } else {
      const ta = doc.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      doc.body.appendChild(ta); ta.select();
      try { doc.execCommand("copy"); done(); } catch (er) { /* abaikan */ }
      ta.remove();
    }
  });

  /* ---------------------------------------------------------------- tautan GitHub */
  if (REPO_OK) {
    $$("[data-gh]").forEach(a => { a.href = "https://github.com/" + REPO; a.hidden = false; });
    $$("[data-gh-issues]").forEach(a => { a.href = "https://github.com/" + REPO + "/issues"; a.hidden = false; });
  }

  /* ---------------------------------------------------------------- video hero */
  const vid = $(".hero-video");
  if (vid) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saver = navigator.connection && navigator.connection.saveData;
    if (!reduce && !saver) {
      const portrait = window.matchMedia("(max-aspect-ratio: 1/1)");
      const pick = () => {
        const src = portrait.matches ? vid.getAttribute("data-port") : vid.getAttribute("data-land");
        if (vid.getAttribute("src") === src) return;
        vid.classList.remove("on");
        vid.setAttribute("src", src);
        vid.muted = true;
        const p = vid.play();
        if (p && p.catch) p.catch(() => { /* autoplay ditolak (mis. mode hemat daya): poster tetap tampil */ });
      };
      vid.addEventListener("playing", () => vid.classList.add("on"));
      pick();
      (portrait.addEventListener ? portrait.addEventListener.bind(portrait, "change") : portrait.addListener.bind(portrait))(pick);
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(es => {
          es.forEach(e => {
            if (e.isIntersecting) { const p = vid.play(); if (p && p.catch) p.catch(() => {}); } else { vid.pause(); }
          });
        }).observe(vid);
      }
    }
  }

  /* ---------------------------------------------------------------- mulai */
  const saved = store.get("slink.lang");
  applyLang(saved === "id" || saved === "en" ? saved : (/^(id|ms)\b/i.test(navigator.language || "") ? "id" : "en"));

  (async () => {
    let rel = null;
    try { rel = await loadRelease(); } catch (e) { rel = null; }
    release = rel;
    PLATS.forEach(p => {
      if (p === "web") return;
      const a = rel && rel.assets.find(x => MATCH[p].test(x.name));
      state[p] = a ? { s: "ready", asset: a } : { s: "soon" };
    });
    state.web = { s: (await webReady()) ? "ready" : "soon" };
    refresh();
    showRelease();
  })();
})();
