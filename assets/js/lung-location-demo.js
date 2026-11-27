(function () {
  "use strict";

  const root = document.getElementById("lung-findings-demo");
  const report = document.getElementById("location-report");
  const copy = document.getElementById("copy-location-report");
  const notice = document.getElementById("location-copy-status");
  let text = "";

  window.createLungFindings(root, ({ description }) => {
    text = description;
    report.textContent = text || "Добавьте находку, чтобы сформировать фрагмент.";
    copy.disabled = !text;
    notice.textContent = "";
  });
  root.querySelector(".lung-findings-grid").append(document.getElementById("location-preview"));

  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);
      notice.textContent = "Скопировано";
    } catch {
      notice.textContent = "Выделите текст протокола и скопируйте вручную.";
    }
  });
})();
