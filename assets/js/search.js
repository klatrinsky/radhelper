(function () {
  "use strict";

  const lower = s => s.toLowerCase().replace(/ё/g, "е");
  const tokens = s => lower(s).replace(/[^a-zа-я0-9]+/g, " ").split(" ").filter(Boolean);
  // слова, без которых запрос не меняется: «кт органов грудной клетки» = «грудной клетки»
  const STOP = new Set(["кт", "мскт", "органов", "орган", "органы", "исследование", "описание", "и", "с", "без"]);
  const stem = w => w.length > 4 ? w.slice(0, w.length - 2) : w;

  const queryWords = query => tokens(query).filter(w => !STOP.has(w));

  function bindGuideSearch(secs, q, none) {
    // ё = е, ъ = ь: «обьем» найдёт «объём» (твёрдый знак на клавиатуре никто не помнит)
    const norm = s => s.toLowerCase().replace(/ё/g, "е").replace(/ъ/g, "ь");
    const texts = secs.map(s => norm(s.textContent + " " + (s.dataset.words || "")));

    q.addEventListener("input", () => {
      const wasHome = document.body.classList.contains("home");
      document.body.classList.toggle("home", !q.value.trim());
      if (wasHome && q.value.trim()) window.scrollTo(0, 0);
      const words = norm(q.value).split(/\s+/).filter(Boolean);
      let shown = 0;
      secs.forEach((s, i) => {
        const ok = words.every(w => texts[i].includes(w));
        s.hidden = !ok;
        s.open = ok && words.length > 0;      // найденное — сразу раскрыто
        if (ok) shown++;
      });
      none.hidden = shown > 0;
    });
  }

  function groupStudies(variants) {
    const studies = [];
    variants.filter(Boolean).forEach(({ searchText, ...v }) => {
      v.words = tokens(searchText);
      let s = studies.find(x => x.title === v.study);
      if (!s) { s = { title: v.study, modality: v.modality, variants: [] }; studies.push(s); }
      s.variants.push(v);
    });
    return studies;
  }

  function score(words, v) {
    let s = 0;
    for (const w of words) {
      const st = stem(w);
      if (v.words.includes(w)) s += 2;          // точное слово весит больше частичного
      else if (v.words.some(k => k.startsWith(st) || (k.length > 3 && st.startsWith(k)))) s++;
      else return 0;
    }
    return s;
  }

  function rankStudies(studies, words) {
    return studies.map(s => ({ s, sc: Math.max(...s.variants.map(v => score(words, v))) }))
      .filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc).map(x => x.s);
  }

  function bestVariant(study, words) {
    let vi = 0, best = -1;
    study.variants.forEach((v, i) => { const sc = score(words, v); if (sc > best) { best = sc; vi = i; } });
    return vi;
  }

  // Широкий запрос: группируем исследования, не меняя список вариантов каждого шаблона.
  const searchCategory = s => {
    if (s.variants.some(v => v.kind === "tool")) return "Находки";
    if (s.variants.some(v => v.kind === "page")) return "Конструкторы";
    const m = lower(s.modality || "");
    if (m.includes("кт") || m.includes("мскт")) return "КТ и ангиография";
    if (m.includes("рентген")) return "Рентгенография";
    if (m.includes("денсит")) return "Денситометрия";
    if (m.includes("мамм")) return "Маммография";
    return "Другие исследования";
  };

  function groupResults(found) {
    const groups = new Map();
    found.forEach((x, i) => {
      const category = searchCategory(x);
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push({ x, i });
    });
    return groups;
  }

  window.RH_SEARCH = { bindGuideSearch, groupStudies, queryWords, rankStudies, bestVariant, groupResults };
})();
