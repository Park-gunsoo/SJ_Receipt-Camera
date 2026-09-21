/* Uses the same cached catalog and preference as the online app. */
(() => {
  const key = "sj-language-v1";
  const supported = value => ["ja", "ko", "en"].includes(value);
  let saved = null;
  try { saved = localStorage.getItem(key); } catch { /* Private/restricted browsing. */ }
  let locale = supported(saved) ? saved : (navigator.languages ?? [navigator.language]).map(value => value.toLowerCase().split(/[-_]/)[0]).find(supported) ?? "ja";
  const picker = document.getElementById("language");
  let catalog = {};
  const text = message => locale === "ja" ? catalog[message]?.ja ?? message : catalog[message]?.[locale] ?? message;
  function render() {
    document.documentElement.lang = locale;
    picker.value = locale;
    picker.setAttribute("aria-label", text("表示言語"));
    document.title = `${text("オフライン")} | ${text("SJ レシートカメラ")}`;
    document.getElementById("mascot").alt = text("レシートのフォルダを持ったSJの柴犬");
    for (const node of document.querySelectorAll("[data-message]")) node.textContent = text(node.dataset.message);
  }
  picker.addEventListener("change", () => {
    if (!supported(picker.value)) return;
    locale = picker.value;
    try { localStorage.setItem(key, locale); } catch { /* Keep the current page choice. */ }
    render();
  });
  picker.value = locale;
  fetch("/translations.json").then(response => { if (!response.ok) throw new Error(); return response.json(); }).then(value => { catalog = value; render(); }).catch(() => { /* The readable Japanese fallback remains available. */ });
})();
