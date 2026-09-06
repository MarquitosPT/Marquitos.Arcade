fetch("/api/account/me")
  .then((res) => res.json())
  .then((info) => {
    const link = document.querySelector("#auth-link");
    if (!link) return;
    link.textContent = info.authenticated ? `👤 ${info.userName}` : "👤 Entrar";
  })
  .catch(() => {});
