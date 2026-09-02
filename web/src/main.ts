import { mountStarfield } from "./starfield";
import {
  parseRoute,
  renderHome,
  renderInstall,
  renderInvariants,
  renderOps,
  type Route,
} from "./pages";

const routes: Record<Route, { label: string; draw: () => string }> = {
  home: { label: "home", draw: renderHome },
  install: { label: "install", draw: renderInstall },
  invariants: { label: "invariants", draw: renderInvariants },
  ops: { label: "ops", draw: renderOps },
};

function shell(inner: string, route: Route): string {
  const links = (Object.keys(routes) as Route[])
    .map((key) => {
      const active = key === route ? " active" : "";
      return `<a class="${active}" href="#${key}">${routes[key].label}</a>`;
    })
    .join("");

  return `
    <header class="topbar">
      <a class="brand" href="#home"><img src="/mark.svg" alt="" />MaxQ</a>
      <nav class="nav">${links}</nav>
    </header>
    ${inner}
    <footer class="foot">
      <span>MIT · mocha</span>
      <span>
        <a href="https://github.com/0sm0s1z/constellation-MaxQ">github</a>
        ·
        <a href="https://github.com/0sm0s1z/constellation-MaxQ/blob/main/docs/TRUST.md">trust</a>
      </span>
    </footer>`;
}

function bind(root: HTMLElement) {
  root.querySelectorAll<HTMLButtonElement>("button.copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const text = btn.dataset.copy ?? "";
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "copied";
        btn.classList.add("ok");
        window.setTimeout(() => {
          btn.textContent = "copy";
          btn.classList.remove("ok");
        }, 1400);
      } catch {
        btn.textContent = "fail";
      }
    });
  });
}

function draw() {
  const app = document.getElementById("app");
  if (!app) return;
  const route = parseRoute();
  app.innerHTML = shell(routes[route].draw(), route);
  bind(app);
}

const field = document.getElementById("field");
if (field instanceof HTMLCanvasElement) mountStarfield(field);

draw();
window.addEventListener("hashchange", draw);
