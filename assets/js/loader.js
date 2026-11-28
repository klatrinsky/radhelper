(function () {
  "use strict";

  const GUIDE_DIR = "content/guides/";
  const TEMPLATE_DIR = "content/templates/";
  const FINDINGS_DIR = "content/findings/";
  const orderFiles = txt => txt.split("\n").map(s => s.trim()).filter(s => s && !s.startsWith("#"));

  const getGuide = f => fetch(GUIDE_DIR + f, { cache: "no-cache" }).then(r => {
    if (!r.ok) throw new Error(r.status);
    return r.text();
  });

  function loadGuides() {
    return getGuide("order.txt").then(txt => {
      const files = orderFiles(txt);
      return Promise.all(files.map(f => getGuide(f).then(t => ({ f, t }), () => ({ f, t: null }))));
    });
  }

  function createHintReader(sections) {
    const hintCache = {};
    return name => {
      if (sections[name] !== undefined) return Promise.resolve(sections[name]);
      if (!hintCache[name]) hintCache[name] = getGuide(name + ".md").catch(() => null);
      return hintCache[name];
    };
  }

  function readMetadata(lines, cut) {
    const meta = {};
    lines.slice(0, cut).forEach(l => {
      const m = l.match(/^\s*([^:#]+):\s*(.*)$/);
      if (m) meta[m[1].trim().toLowerCase().replace(/ё/g, "е")] = m[2].trim();
    });
    return meta;
  }

  function readTemplate(f, t) {
    const lines = t.replace(/\r/g, "").split("\n");
    const cut = lines.findIndex(l => l.trim() === "---");
    if (cut < 0) return null;
    const meta = readMetadata(lines, cut);
    const text = lines.slice(cut + 1).join("\n").replace(/^\n+|\s+$/g, "");
    const study = meta["исследование"];
    if (!study || !text) return null;
    // Автономный интерактивный инструмент: ссылка вместо обычного копируемого шаблона.
    // Только страницы внутри репозитория, никаких внешних адресов и ../
    const page = meta["страница"] || "";
    if (page && !/^[a-z0-9_-]+\.html$/i.test(page)) return null;
    return {
      f, study, text, kind: page ? "page" : "template", page: page ? "pages/" + page : "",
      variant: meta["вариант"] || "Основной",
      modality: meta["модальность"] || "",
      alert: meta["внимание"] || "",
      hints: (meta["подсказки"] || "").split(/[,\s]+/).map(s => s.replace(/\.md$/i, "")).filter(Boolean),
      searchText: [study, meta["вариант"], meta["модальность"], meta["слова"]].join(" ")
    };
  }

  // Находка (content/findings/*.md): та же шапка, но «Находка:» вместо «Исследование:»
  function readTool(f, t) {
    const lines = t.replace(/\r/g, "").split("\n");
    const cut = lines.findIndex(l => l.trim() === "---");
    if (cut < 0 || !window.RH_FINDINGS) return null;
    const meta = readMetadata(lines, cut);
    const title = meta["находка"];
    if (!title) return null;
    return {
      f, study: title, text: "", kind: "tool",
      tool: window.RH_FINDINGS.parse(lines.slice(cut + 1).join("\n")),
      variant: "Находка",
      modality: "Находка" + (meta["модальность"] ? " · " + meta["модальность"] : ""),
      hints: (meta["подсказки"] || "").split(/[,\s]+/).map(s => s.replace(/\.md$/i, "")).filter(Boolean),
      searchText: [title, meta["модальность"], meta["слова"]].join(" ")
    };
  }

  const variantSources = [[TEMPLATE_DIR, readTemplate], [FINDINGS_DIR, readTool]];
  const variantFiles = new Map();
  function getVariantFile(path) {
    if (!variantFiles.has(path)) {
      variantFiles.set(path, fetch(path, { cache: "no-cache" }).then(response => {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.text();
      }).catch(error => {
        variantFiles.delete(path);
        throw error;
      }));
    }
    return variantFiles.get(path);
  }

  const readOrder = dir => getVariantFile(dir + "order.txt").then(orderFiles);
  const readVariant = (dir, read, file) => getVariantFile(dir + file).then(text => {
    const variant = read(file, text);
    if (!variant) {
      variantFiles.delete(dir + file);
      throw new Error("Некорректный файл " + dir + file);
    }
    return variant;
  });

  async function loadProtocol(id) {
    if (!/^[a-z0-9_-]+$/i.test(id)) return null;
    for (const [dir, read] of variantSources) {
      const files = await readOrder(dir);
      const file = files.find(name => name.replace(/\.md$/i, "") === id);
      if (file) return readVariant(dir, read, file);
    }
    return null;
  }

  function loadVariants() {
    return Promise.all(variantSources.map(([dir, read]) => readOrder(dir)
      .then(files => Promise.all(files.map(file => readVariant(dir, read, file).catch(() => null))), () => [])));
  }

  window.RH_LOADER = { GUIDE_DIR, TEMPLATE_DIR, FINDINGS_DIR, loadGuides, loadProtocol, loadVariants, createHintReader };
})();
