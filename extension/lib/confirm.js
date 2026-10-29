import { t } from "./i18n.js";

// Janela de confirmação no estilo de vidro da cena (estilos em scene.css).
// Resolve true se a pessoa confirmar e false se cancelar, clicar fora ou apertar Esc.
export function confirmDialog(message, confirmLabel) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
      <div class="confirm-card" role="alertdialog" aria-modal="true">
        <p class="confirm-message"></p>
        <div class="confirm-actions">
          <button type="button" class="secondary confirm-cancel"></button>
          <button type="button" class="confirm-ok"></button>
        </div>
      </div>`;
    overlay.querySelector(".confirm-message").textContent = message;
    overlay.querySelector(".confirm-cancel").textContent = t("cancel");
    overlay.querySelector(".confirm-ok").textContent = confirmLabel;

    const close = (result) => {
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === "Escape") close(false);
    };
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(false);
    });
    overlay.querySelector(".confirm-cancel").addEventListener("click", () => close(false));
    overlay.querySelector(".confirm-ok").addEventListener("click", () => close(true));
    document.addEventListener("keydown", onKey);

    document.body.append(overlay);
    overlay.querySelector(".confirm-cancel").focus();
  });
}
