// Tema claro/escuro da arcada.
//
// Este script corre no <head>, antes do primeiro paint, para o tema
// escolhido ser aplicado sem "flash" do tema errado. O estado vive no
// atributo `data-theme` do <html>:
//
//   (sem atributo)      -> segue o sistema (prefers-color-scheme)
//   data-theme="light"  -> claro, por escolha do utilizador
//   data-theme="dark"   -> escuro, por escolha do utilizador
//
// O ícone do botão é escolhido por CSS a partir desse atributo (ver
// .theme-icon em styles.css), por isso o clique só tem de mexer no
// <html> - nada aqui repinta DOM e tudo sobrevive à enhanced navigation
// do Blazor, que troca o <body> sem recarregar a página.
(() => {
  const STORAGE_KEY = "arcade-theme";
  const CYCLE = ["system", "light", "dark"];
  const BAR_COLOR = { light: "#eceffa", dark: "#06080f" };

  const root = document.documentElement;
  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const read = () => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage pode estar bloqueado (modo privado, cookies off).
      return null;
    }
  };

  const write = (choice) => {
    try {
      if (choice === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      /* sem persistência: o tema vale só para esta página */
    }
  };

  const resolved = () => root.getAttribute("data-theme") || (darkQuery.matches ? "dark" : "light");

  // A barra de estado do browser/PWA acompanha o tema ativo.
  const syncBarColor = () => {
    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute("content", BAR_COLOR[resolved()]);
  };

  const apply = (choice) => {
    if (choice === "light" || choice === "dark") root.setAttribute("data-theme", choice);
    else root.removeAttribute("data-theme");
    syncBarColor();
  };

  apply(read());

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest("[data-theme-toggle]")) return;

    const current = root.getAttribute("data-theme") || "system";
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
    write(next);
    apply(next);
  });

  darkQuery.addEventListener("change", syncBarColor);
})();
