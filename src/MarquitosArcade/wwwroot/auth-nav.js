fetch("/api/account/me")
  .then((res) => res.json())
  .then((info) => {
    const area = document.querySelector("#auth-area");
    if (!area) return;

    if (!info.authenticated) {
      area.innerHTML = '<a href="/Account/Login">Entrar</a>';
      return;
    }

    area.innerHTML = `
      <details class="topnav-dropdown">
        <summary class="topnav-trigger">Conta</summary>
        <div class="topnav-dropdown-menu">
          <a href="/Account/Manage">Ver conta</a>
          <hr />
          <button type="button" id="auth-logout-btn">Sair</button>
        </div>
      </details>
    `;

    document.querySelector("#auth-logout-btn").addEventListener("click", () => {
      fetch("/api/account/logout", { method: "POST" }).finally(() => {
        window.location.href = "/index.html";
      });
    });
  })
  .catch(() => {});
