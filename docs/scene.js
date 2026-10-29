// Escolhe a cena lofi pelo horário local e aplica em body[data-time] (ver scene.css).
// Script clássico, incluído antes dos scripts de cada página.
// ?time=dawn|day|afternoon|night na URL força uma cena (útil para testar).
(() => {
  const SCENES = ["dawn", "day", "afternoon", "night"];
  const forced = new URLSearchParams(location.search).get("time");

  function timeOfDay(hour) {
    if (hour >= 5 && hour < 8) return "dawn";
    if (hour >= 8 && hour < 16) return "day";
    if (hour >= 16 && hour < 19) return "afternoon";
    return "night";
  }

  function applyScene() {
    document.body.dataset.time = SCENES.includes(forced) ? forced : timeOfDay(new Date().getHours());
  }

  applyScene();
  setInterval(applyScene, 30_000);
})();
