document.addEventListener("click", (event) => {
  document.querySelectorAll("details.topnav-dropdown[open]").forEach((menu) => {
    if (!menu.contains(event.target)) menu.removeAttribute("open");
  });
});
