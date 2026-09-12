// Passo opcional de build (roda na Vercel, depois do generate-config.js e
// antes do minify.js): troca os id/class do HTML/CSS/JS publicados por
// nomes curtos sem sentido (tipo "a" em vez de "movie-grid"), so' pra
// deixar o F12 um pouco menos confortavel de ler. E' tao cosmetico quanto
// a minificacao (veja minify.js): quem quiser entender a estrutura ainda
// consegue, so' fica um pouco mais chato. O codigo-fonte no repositorio
// continua com os nomes de verdade; so' a copia publicada na Vercel fica
// assim.
//
// So' funciona porque a lista de id/class aqui embaixo e' fixa e conhecida
// (esse projeto nao gera id/class vindo de fora, tipo de uma API). Se um
// dia adicionar um id/class novo no HTML/CSS/JS, cadastra ele nas listas
// ID_NAMES/CLASS_NAMES tambem — senao ele simplesmente nao troca (nao
// quebra nada, so' fica sem o disfarce).

import { readFileSync, writeFileSync } from "node:fs";

// Ordem alfabetica so' por organizacao; a posicao na lista e' o que decide
// o nome curto (buildMap), entao mudar a ordem muda os nomes gerados, mas
// nunca quebra a troca em si.
const ID_NAMES = [
  "app-section",
  "bottom-nav",
  "config-warning",
  "email-form",
  "email-input",
  "email-login-btn",
  "email-login-error",
  "email-signup-btn",
  "filter-btn",
  "filter-sheet",
  "google-login-btn",
  "google-login-error",
  "guest-form",
  "guest-name",
  "list-status",
  "logout-btn",
  "movie-grid",
  "onboarding",
  "only-unwatched",
  "password-input",
  "profile-name",
  "progress-label",
  "refresh-fab",
  "search-input",
  "sheet-close",
  "sheet-overlay",
  "sort-select",
  "view-collection",
  "view-profile",
  "watched-grid",
  "year-filter",
];

const CLASS_NAMES = [
  "active",
  "app-credit",
  "app-main",
  "app-section",
  "app-shell",
  "bottom-nav",
  "btn-primary",
  "btn-secondary",
  "checkbox-label",
  "config-warning",
  "email-actions",
  "empty-message",
  "error-text",
  "fab",
  "field-label",
  "filled",
  "icon-btn",
  "list-status",
  "movie-card",
  "movie-grid",
  "movie-info",
  "movie-poster",
  "movie-year",
  "nav-btn",
  "onboarding",
  "onboarding-card",
  "poster-placeholder",
  "profile-avatar",
  "profile-card",
  "progress-label",
  "search-bar",
  "sheet",
  "sheet-handle",
  "sheet-overlay",
  "sheet-panel",
  "star",
  "stars",
  "topbar",
  "topbar-icon",
  "view",
  "watched-checkbox",
  "watched-label",
  "watched-section",
];

// Gera "a", "b", ..., "z", "aa", "ab", ... na ordem do indice (mesma logica
// de nomear coluna de planilha). Curto, sem sentido, nunca repete.
function shortCode(index) {
  let n = index;
  let code = "";
  do {
    code = String.fromCharCode(97 + (n % 26)) + code;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return code;
}

function buildMap(names) {
  const map = {};
  names.forEach((name, i) => {
    map[name] = shortCode(i);
  });
  return map;
}

const ID_MAP = buildMap(ID_NAMES);
const CLASS_MAP = buildMap(CLASS_NAMES);

// "a b c" -> mapeia cada classe da lista separadamente (um elemento pode
// ter mais de uma classe) e devolve remontado com espaco.
function mapClassList(list) {
  return list
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => CLASS_MAP[token] || token)
    .join(" ");
}

function mangleHtmlLike(text) {
  return text
    .replace(/id="([^"]+)"/g, (full, name) => `id="${ID_MAP[name] || name}"`)
    .replace(/for="([^"]+)"/g, (full, name) => `for="${ID_MAP[name] || name}"`)
    .replace(/class="([^"]+)"/g, (full, list) => `class="${mapClassList(list)}"`);
}

function mangleCss(text) {
  // So' existe seletor por classe nesse projeto (nenhum "#id" no CSS, so'
  // cores hexadecimais tipo #e0218a) — por isso so' mexe em ".nome".
  return text.replace(/\.([a-zA-Z][\w-]*)/g, (full, name) => `.${CLASS_MAP[name] || name}`);
}

function mangleJs(text) {
  // Unico lugar com classe montada dinamicamente: a estrela cheia. Essa
  // linha tem aspas dentro do ${...} (o ternario), o que quebraria a regex
  // generica de class="..." mais abaixo se ela tentasse ler essa linha
  // tambem — por isso troca essa linha inteira primeiro, por um marcador,
  // e devolve o valor certo so' no final.
  const ESTRELA_ANTIGA = 'class="star${value <= rating ? " filled" : ""}"';
  if (!text.includes(ESTRELA_ANTIGA)) {
    throw new Error(
      "mangle-names: padrao da estrela nao encontrado em js/main.js (o arquivo mudou?) — abortando pra nao publicar quebrado.",
    );
  }
  const ESTRELA_NOVA = `class="${CLASS_MAP.star}\${value <= rating ? " ${CLASS_MAP.filled}" : ""}"`;
  const MARCADOR = "@@MANGLE_STAR@@";

  let out = text.split(ESTRELA_ANTIGA).join(MARCADOR);

  out = out
    .replace(/getElementById\("([^"]+)"\)/g, (full, name) => `getElementById("${ID_MAP[name] || name}")`)
    .replace(/querySelectorAll\("\.([a-zA-Z][\w-]*)"\)/g, (full, name) => `querySelectorAll(".${CLASS_MAP[name] || name}")`)
    .replace(/\.matches\("\.([a-zA-Z][\w-]*)"\)/g, (full, name) => `.matches(".${CLASS_MAP[name] || name}")`)
    .replace(/\.closest\("\.([a-zA-Z][\w-]*)"\)/g, (full, name) => `.closest(".${CLASS_MAP[name] || name}")`)
    .replace(
      /classList\.(add|toggle|remove)\("([a-zA-Z][\w-]*)"/g,
      (full, method, name) => `classList.${method}("${CLASS_MAP[name] || name}"`,
    )
    .replace(/class="([^"]+)"/g, (full, list) => `class="${mapClassList(list)}"`);

  return out.split(MARCADOR).join(ESTRELA_NOVA);
}

try {
  const htmlPath = "index.html";
  const cssPath = "css/styles.css";
  const jsPath = "js/main.js";

  writeFileSync(htmlPath, mangleHtmlLike(readFileSync(htmlPath, "utf8")));
  writeFileSync(cssPath, mangleCss(readFileSync(cssPath, "utf8")));
  writeFileSync(jsPath, mangleJs(readFileSync(jsPath, "utf8")));

  console.log("id/class trocados por nomes curtos pra publicacao (so estetico, mesma ideia da minificacao).");
} catch (error) {
  console.error("Erro ao trocar id/class:", error);
  process.exit(1);
}
