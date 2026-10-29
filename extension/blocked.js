const msg = (key) => chrome.i18n.getMessage(key);
const $ = (id) => document.getElementById(id);
const site = new URLSearchParams(location.search).get("site");
const lang = chrome.i18n.getUILanguage();

document.documentElement.lang = lang;

document.title = msg("blockedPageTitle");
$("heading").textContent = msg("blockedHeading");
$("site").textContent = site || msg("thisSite");
$("is-blocked").textContent = msg("blockedIsBlocked");

// Relógio discreto.
const clockFormat = new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit" });
function tick() {
  $("clock").textContent = clockFormat.format(new Date());
}
tick();
setInterval(tick, 10_000);

// Rótulo da respiração acompanha a animação de 8s do círculo (4s inspira, 4s expira).
let inhale = true;
function breath() {
  $("breath-label").textContent = msg(inhale ? "breatheIn" : "breatheOut");
  inhale = !inhale;
}
breath();
setInterval(breath, 4000);

// Frases calmas que trocam devagar.
const quotes = ["quote1", "quote2", "quote3", "quote4", "quote5"].map(msg).filter(Boolean);
let index = Math.floor(Math.random() * quotes.length);
$("quote").textContent = quotes[index];
setInterval(() => {
  const quote = $("quote");
  quote.classList.add("fading");
  setTimeout(() => {
    index = (index + 1) % quotes.length;
    quote.textContent = quotes[index];
    quote.classList.remove("fading");
  }, 1200);
}, 12_000);
