(function () {
  "use strict";

  const levels = document.getElementById("disc-levels");
  const level = document.getElementById("disc-level");
  const report = document.getElementById("disc-report");
  const copy = document.getElementById("disc-copy");
  const notice = document.getElementById("disc-copy-status");
  let currentResult;

  function updateReport(result) {
    currentResult = result;
    const { text, sizeError, canalAreaError } = result;
    let message = "Выберите зону или укажите площадь позвоночного канала.";
    if (sizeError) message = "Исправьте размер выпячивания.";
    if (canalAreaError) message = "Исправьте планиметрическую площадь позвоночного канала.";
    report.textContent = text || message;
    copy.disabled = !text;
    notice.textContent = "";
  }

  window.createDiscLevelPicker(level, levels, updateReport);
  copy.addEventListener("click", async () => {
    const { text } = currentResult;
    try {
      await navigator.clipboard.writeText(text);
      notice.textContent = "Скопировано";
    } catch {
      notice.textContent = "Выделите текст описания и скопируйте вручную.";
    }
  });
})();
