// Krabbe-Hartkamp et al., Radiology 1998;207:103–111, figures 2–3.
// https://doi.org/10.1148/radiology.207.1.9530305
(function () {
  "use strict";

  const vesselNames = {
    acom: "передняя соединительная артерия",
    a1r: "сегмент A1 правой ПМА", a1l: "сегмент A1 левой ПМА",
    pcomr: "правая задняя соединительная артерия", pcoml: "левая задняя соединительная артерия",
    p1r: "сегмент P1 правой ЗМА", p1l: "сегмент P1 левой ЗМА"
  };
  const anteriorFeatures = {
    b: "множественные передние соединительные артерии",
    c: "срединная артерия мозолистого тела",
    d: "короткий участок слияния передних мозговых артерий",
    e: "общий ствол передних мозговых артерий с дистальным разделением",
    f: "раздельное отхождение двух стволов СМА от ВСА",
    i: "вариант с кровоснабжением обеих ПМА и обеих СМА из одной ВСА"
  };

  // Nonvisualization of P1 alone does not establish the origin of the distal PCA.
  function posteriorSide(absent, fetal, side) {
    const p1 = !absent.has("p1" + side);
    const pcom = !absent.has("pcom" + side);
    if (!pcom) return p1 && !fetal.has(side) ? "noPcom" : "unclassified";
    if (!p1) return fetal.has(side) ? "fullFetal" : "originUnknown";
    return fetal.has(side) ? "partialFetal" : "adult";
  }

  // Unordered pairs keep mirror-image configurations in the same class.
  const posteriorTypes = {
    "adult/adult": "a", "adult/partialFetal": "b", "partialFetal/partialFetal": "c",
    "adult/noPcom": "d", "noPcom/noPcom": "e", "adult/fullFetal": "f",
    "noPcom/partialFetal": "g", "fullFetal/noPcom": "h",
    "fullFetal/fullFetal": "i", "fullFetal/partialFetal": "j"
  };

  function anteriorType(absent, feature) {
    const missingA1 = Number(absent.has("a1r")) + Number(absent.has("a1l"));
    if (missingA1 > 0) return missingA1 === 1 && !absent.has("acom") && feature === "a" ? "h" : null;
    if (absent.has("acom")) {
      if (feature === "a") return "g";
      if (feature === "f") return "j";
      return null;
    }
    return feature === "a" || Object.hasOwn(anteriorFeatures, feature) ? feature : null;
  }

  function classifyWillis(absent, { fetal = new Set(), anteriorVariant = "a" } = {}) {
    const anterior = anteriorType(absent, anteriorVariant);
    const sides = ["r", "l"];
    const posteriorSides = sides.map(side => posteriorSide(absent, fetal, side));
    const posterior = posteriorTypes[posteriorSides.slice().sort().join("/")] || null;
    const anteriorComplete = !["acom", "a1r", "a1l"].some(id => absent.has(id)) && anteriorVariant !== "i";
    const posteriorComplete = !["pcomr", "pcoml", "p1r", "p1l"].some(id => absent.has(id));
    const completeness = ["неполный", "частично полный", "полный"][Number(anteriorComplete) + Number(posteriorComplete)];
    const type = code => code ? "тип " + code : "сочетание вне типовых вариантов";
    const unknownOrigin = posteriorSides.includes("originUnknown") && !posteriorSides.includes("unclassified");
    const posteriorLabel = unknownOrigin ? "тип не определён (требуется оценка отхождения ЗМА)" : type(posterior);
    const findings = Object.keys(vesselNames).filter(id => absent.has(id)).map(id => vesselNames[id]);
    const details = [];
    if (findings.length) details.push((findings.length === 1 ? "Не визуализируется " : "Не визуализируются ") + findings.join(", ") + ".");
    if (anteriorFeatures[anteriorVariant]) {
      const description = anteriorFeatures[anteriorVariant];
      details.push(description[0].toUpperCase() + description.slice(1) + ".");
    }
    const fetalSides = sides.filter((_, i) => ["partialFetal", "fullFetal"].includes(posteriorSides[i]));
    if (fetalSides.length === 2) details.push("Фетальный тип обеих ЗМА.");
    if (fetalSides.length === 1) details.push("Фетальный тип " + (fetalSides[0] === "r" ? "правой" : "левой") + " ЗМА.");
    const description = details.length ? details.join(" ") : "Сегменты A1 и P1 с обеих сторон, передняя и обе задние соединительные артерии визуализируются.";
    const conclusion = "Виллизиев круг " + completeness + " по Krabbe-Hartkamp (передний отдел — " + type(anterior) + ", задний отдел — " + posteriorLabel + ").";
    return { anterior, posterior, completeness, description, conclusion };
  }

  globalThis.classifyWillis = classifyWillis;
})();
