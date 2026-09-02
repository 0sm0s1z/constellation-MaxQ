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

function clock(): string {
  return new Date().toISOString().slice(11, 19) + "Z";
}

function shell(inner: string, route: Route): string {
  const links = (Object.keys(routes) as Route[])
    .map((key) => {
      const active = key === route ? " active" : "";
      return `<a class="${active}" href="#${key}">${routes[key].label}</a>`;
    })
    .join("");

  return `
    <header class="topbar">
      <div class="prompt">grokbot<span>@</span>maxq <span>~</span> $ constellation</div>
      <nav class="nav">${links}</nav>
    </header>
    ${inner}
    <footer class="foot">
      <span>MIT · persist-safe · mocha</span>
      <span>
        <a href="https://github.com/0sm0s1z/constellation-MaxQ">github</a>
        ·
        <a href="https://github.com/0sm0s1z/constellation-MaxQ/blob/main/docs/TRUST.md">trust</a>
        ·
        <span data-clock>${clock()}</span>
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
window.setInterval(() => {
  document.querySelectorAll("[data-clock]").forEach((el) => {
    el.textContent = clock();
  });
}, 1000);
