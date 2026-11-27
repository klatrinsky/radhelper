window.RH_RENDER_CATALOG = function renderCatalog(studies, references, protocolUrl) {
  const categories = new Map([
    ["ct", "Компьютерная томография и ангиография"],
    ["xr", "Рентгенография"],
    ["mmg", "Маммография"],
    ["dxa", "Денситометрия"],
    ["constructors", "Интерактивные конструкторы"],
    ["calculations", "Калькуляторы и классификации"],
    ["references", "Справочники и памятки"]
  ]);
  const groupFor = v => {
    if (v.kind === "page" || v.kind === "tool") return "constructors";
    const modality = v.modality.toLowerCase();
    if (modality.includes("кт")) return "ct";
    if (modality.includes("рентген")) return "xr";
    if (modality.includes("мамм") || modality === "ммг") return "mmg";
    if (modality.includes("денсит")) return "dxa";
    return "constructors";
  };
  const items = studies.map(({ title, variants: [v] }) => ({
    title, href: protocolUrl(v).href, category: groupFor(v)
  })).concat(references);
  if (!items.length) return;

  const catalog = document.getElementById("catalog");
  const groups = catalog.querySelector(".search-groups");
  for (const [category, label] of categories) {
    const entries = items.filter(item => item.category === category);
    if (!entries.length) continue;
    const group = document.createElement("details");
    group.className = "search-group";
    const summary = document.createElement("summary");
    summary.textContent = label;
    const list = document.createElement("ul");
    for (const { title, href } of entries) {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.textContent = title;
      link.href = href;
      li.append(link);
      list.append(li);
    }
    group.append(summary, list);
    groups.append(group);
  }
  catalog.hidden = false;
};
