(function () {
  const toastEl = document.getElementById("toast");
  let toastTimer;

  function toast(message, duration = 1800) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, duration);
  }

  function copyFallback(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    let copied = false;
    try { copied = document.execCommand("copy"); } catch (error) {}
    textarea.remove();
    toast(copied ? "Скопировано" : "Не удалось скопировать — выделите текст вручную");
  }

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => toast("Скопировано"), () => copyFallback(text));
    } else {
      copyFallback(text);
    }
  }

  function bindForm(root) {
    root.addEventListener("input", event => event.target.classList.remove("miss"));
  }

  function bindTemplate(root, template) {
    function bindCopy(button, label, section) {
      if (!button) return;
      let armed = 0;
      button.textContent = label;
      button.onclick = function onCopy() {
        const missing = template.missing(section);
        root.querySelectorAll(".miss").forEach(field => field.classList.remove("miss"));
        if (!missing.length || Date.now() - armed < 8000) {
          armed = 0;
          button.textContent = label;
          copy(template.text(section));
          return;
        }
        armed = Date.now();
        const names = [...new Set(missing.map(field => field.label))];
        missing.forEach(field => field.el.classList.add("miss"));
        const first = missing.find(field => field.el.tagName === "INPUT");
        if (first) {
          first.el.focus({ preventScroll: true });
          first.el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        button.textContent = "Всё равно скопировать";
        toast("Не заполнено: " + names.slice(0, 4).join(", ") + (names.length > 4 ? " и ещё " + (names.length - 4) : ""), 4000);
        setTimeout(() => {
          if (button.onclick === onCopy && armed && Date.now() - armed >= 8000) {
            armed = 0;
            button.textContent = label;
          }
        }, 8100);
      };
    }
    bindCopy(root.querySelector(".copy"), "Скопировать протокол", "protocol");
    bindCopy(root.querySelector(".copy-conclusion"), "Скопировать заключение", "conclusion");
  }

  window.RH_CLIPBOARD = { copy, bindForm, bindTemplate };
})();
