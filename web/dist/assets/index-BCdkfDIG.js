(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))a(r);new MutationObserver(r=>{for(const o of r)if(o.type==="childList")for(const i of o.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&a(i)}).observe(document,{childList:!0,subtree:!0});function t(r){const o={};return r.integrity&&(o.integrity=r.integrity),r.referrerPolicy&&(o.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?o.credentials="include":r.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function a(r){if(r.ep)return;r.ep=!0;const o=t(r);fetch(r.href,o)}})();const $="curl -fsSL https://raw.githubusercontent.com/0sm0s1z/constellation-MaxQ/main/install.sh | bash",x="https://github.com/0sm0s1z/constellation-MaxQ";function R(){const s=(location.hash||"#home").replace("#","");return["home","stack","router","cue","crew","install","invariants","ops"].includes(s)?s:"home"}const L=()=>`
  <div class="term"><code><span class="ps1">$</span><span class="cmd">${$}</span><span class="cursor"></span></code><button class="copy" type="button" data-copy="${$}">copy</button></div>`,v=(s,e,t,a,r)=>`
  <figure class="shot"><img src="${s}" alt="${e}" width="${a}" height="${r}" /><figcaption>${t}</figcaption></figure>`,p=(s,e,t,a="laptop",r=1280,o=800)=>`
  <figure class="bezel ${a}">
    <div class="chrome"><span></span><span></span><span></span></div>
    <img src="${s}" alt="${e}" width="${r}" height="${o}" />
    <figcaption>${t}</figcaption>
  </figure>`,G=s=>`<img class="${s}" src="/namelogo.webp" alt="MaxQ" width="1319" height="318" />`,C=[{id:"router",num:"01",label:"Router",title:"Make every seat count.",lede:"Constellation Auto picks a model from seats you already pay for: how hard the job is, the cheapest remaining token, and how close that seat is to reset.",src:"/shots/router-dashboard.webp",alt:"Constellation Router dashboard: seats, included usage, reset clocks",cap:"router · operations",w:1100,h:535,href:"#router"},{id:"maxq",num:"02",label:"MaxQ",title:"The computer Grok Bot runs on.",lede:"Utilities for the bot. Secondary controls for you: settings, telemetry, processes, every desktop.",src:"/shots/desktops.webp",alt:"MaxQ desktops multiplexer, live Xvfb :1 through :15, current :5",cap:"maxq · desktops",w:1037,h:1200,href:"#home"},{id:"cue",num:"03",label:"Cue",title:"Native glass. Not an Electron fork.",lede:"Swift/SwiftUI chat-and-steer for macOS. iOS still landing.",src:"/shots/cue-macos.webp",alt:"Cue macOS: Messages, MuxBot chat, Multiplexer assigns computers",cap:"cue · macOS",w:1006,h:670,href:"#cue"},{id:"crew",num:"04",label:"Crew",title:"Chat stays in Crew. The box is a provider.",lede:"Cue-like SwiftUI with pluggable ComputerProviders: local Docker/VZ, Proxmox, AWS/EC2, Connect-Mac.",src:"/shots/crew-macos.webp",alt:"Crew macOS: Messages, MuxBot, Multiplexer",cap:"crew · macOS",w:1006,h:670,href:"#crew"}];function H(){const s=C.map((t,a)=>`<button type="button" class="tab${a===0?" active":""}" data-tab="${t.id}"><span class="tab-num">${t.num}</span>${t.label}</button>`).join(""),e=C.map((t,a)=>`
      <div class="panel${a===0?" active":""}" data-panel="${t.id}" ${a===0?"":"hidden"}>
        <div class="panel-copy">
          <p class="eyebrow">${t.num} · ${t.label}</p>
          <h3>${t.title}</h3>
          <p class="lede">${t.lede}</p>
          <a class="btn-ghost" href="${t.href}">Open ${t.label}</a>
        </div>
        ${t.src?p(t.src,t.alt,t.cap,"laptop",t.w,t.h):`<figure class="bezel empty"><div class="chrome"><span></span><span></span><span></span></div><p class="ph">Crew screenshot landing. Not Cue.</p><figcaption>${t.cap}</figcaption></figure>`}
      </div>`).join("");return`
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Constellation · first product</p>
        <h1>
          <span class="words pastel-flow">Take Grok Bot to</span>
          ${G("hero-logo")}
        </h1>
        <p class="lede">MaxQ is the build package for the computer Grok Bot runs on. The bot gets the utilities to ship code. You get the side door: settings, telemetry, processes, and every desktop.</p>
        <div class="cta-row">
          <a class="btn-solid" href="#install">Install</a>
          <a class="btn-ghost" href="#how">See how it works</a>
        </div>
      </div>
      <div class="hero-visual carousel" data-carousel data-carousel-lock>
        <div class="slides">
          <figure class="slide is-on rocket-slide" data-slide="0">
            <div class="rocket-stage" data-rocket-stage>
              <img class="rocket-plate" src="/art/rocket-layers/plate.webp" alt="Pastel MaxQ workstation launch plate" width="1503" height="1047" />
              <img class="rocket-flame" src="/art/rocket-layers/flame-trail.webp" alt="" width="1437" height="1095" aria-hidden="true" />
              <div class="rocket-fly">
                <img class="rocket-sprite rocket-glow" src="/art/rocket-layers/rocket-trim.webp" alt="" width="881" height="1476" aria-hidden="true" />
                <img class="rocket-sprite" src="/art/rocket-layers/rocket-trim.webp" alt="" width="881" height="1476" aria-hidden="true" />
              </div>
            </div>
            <figcaption>01 · apply. install.sh takes the box to MaxQ.</figcaption>
          </figure>
          <figure class="slide" data-slide="1" hidden>
            <img src="/art/desk.webp" alt="Isometric agent workstation, code on the glass" width="1280" height="853" />
            <figcaption>02 · the computer the bot actually lives on.</figcaption>
          </figure>
          <figure class="slide" data-slide="2" hidden>
            <img src="/art/ops.webp" alt="Operator stack: three desktops, one control deck" width="1280" height="853" />
            <figcaption>03 · side door. telemetry, processes, every desktop.</figcaption>
          </figure>
        </div>
        <div class="dots" role="tablist">
          <button type="button" class="dot is-on" data-dot="0" aria-label="Slide 1"></button>
          <button type="button" class="dot" data-dot="1" aria-label="Slide 2"></button>
          <button type="button" class="dot" data-dot="2" aria-label="Slide 3"></button>
        </div>
      </div>
    </section>
    <div class="install-bar">${L()}</div>
    <div class="proof">
      <span>state=applied</span>
      <span>intercept=false</span>
      <span>$HOME only</span>
      <span>prove PASS</span>
    </div>
    <section class="how" id="how">
      <div class="how-copy">
        <p class="eyebrow">How it works</p>
        <h2 class="display">One box. Operator and bot.</h2>
        <ol class="steps">
          <li><span class="step-num">01</span><div><h3>Packages</h3><p>SBOM inventory for the bot: go, node, docker, ghostty, grok, claude. Not apt. Does not mutate packages.</p></div></li>
          <li><span class="step-num">02</span><div><h3>Operator glass</h3><p>Settings on loopback. Side-saddle the bot. Configure the machine without taking it hostage.</p></div></li>
          <li><span class="step-num">03</span><div><h3>Desktops</h3><p>Live Xvfb through the noVNC multiplexer. :1–:15. View, switch, this desktop.</p></div></li>
          <li><span class="step-num">04</span><div><h3>Persist</h3><p>Only <code>$HOME</code>. Revert does not delete the machine. Prove leaves APPLIED.</p></div></li>
        </ol>
      </div>
      ${p("/shots/collage.webp","MaxQ operator glass: desktops multiplexer, settings, packages, OpenCode","maxq · desktops, settings, packages","laptop",900,1059)}
    </section>
    <section class="surfaces" id="surfaces">
      <div class="section-head">
        <p class="eyebrow">Constellation</p>
        <h2 class="display">Four surfaces. One stack.</h2>
      </div>
      <div class="tabs" role="tablist">${s}</div>
      <div class="panels">${e}</div>
    </section>`}function N(){return`
    <article class="block">
      <p class="eyebrow">Constellation</p>
      <h1>One stack. <span class="grad">Four surfaces.</span></h1>
      <p class="lede">Router spends the seats. MaxQ makes the box persist. Cue and Crew are the native glass.</p>
    </article>
    <div class="device-row">
      ${p("/shots/router-dashboard.webp","Constellation Router dashboard","router · seats","laptop",1100,535)}
      ${p("/shots/settings.webp","MaxQ settings applied","maxq · settings","laptop",1e3,624)}
      ${p("/shots/cue-macos.webp","Cue chat-and-steer on macOS","cue · macOS","laptop",1006,670)}
    </div>`}function Q(){return`
    <article class="block">
      <p class="eyebrow">01 · Router</p>
      <h1>Make every <span class="grad">seat</span> count.</h1>
      <p class="lede">Constellation Auto picks a model from seats you already pay for: how hard the job is, the cheapest remaining token, and how close that seat is to reset.</p>
    </article>
    ${p("/shots/router-dashboard.webp","Constellation Router dashboard: seats, included usage, reset clocks","operations · dashboard","laptop",1100,535)}
    <div class="grid three">
      <section><h2>Hard jobs</h2><p>Spend the expensive seat when the work is actually hard.</p></section>
      <section><h2>Cheap remainder</h2><p>Mid-cycle, hoard Sol. Burn Luna or Grok on routine work.</p></section>
      <section><h2>Reset clock</h2><p>Near reset, spend tokens that are about to vanish.</p></section>
    </div>
    ${v("/shots/router-seats.webp","Constellation Router seats table","seats · linked",900,420)}`}function B(){return`
    <article class="block">
      <p class="eyebrow">03 · Cue</p>
      <h1><span class="grad">Cue</span> is native glass.</h1>
      <p class="lede">Swift/SwiftUI chat-and-steer for macOS. iOS still landing.</p>
    </article>
    <div class="device-row one">
      ${p("/shots/cue-macos.webp","Cue macOS: Messages, MuxBot chat, Multiplexer assigns computers","cue · macOS","laptop",1006,612)}
    </div>
    <div class="device-row one">
      ${p("/shots/cue-macos-2.webp","Cue macOS 3-pane, MuxBot Hello world, Multiplexer host and agents","cue · macOS","laptop",1006,635)}
    </div>`}function z(){return`
    <article class="block">
      <p class="eyebrow">04 · Crew</p>
      <h1><span class="grad">Crew</span> steers computers.</h1>
      <p class="lede">Cue-like SwiftUI with pluggable ComputerProviders: local Docker/VZ, Proxmox, AWS/EC2, Connect-Mac. Chat stays in Crew. The box is a provider.</p>
    </article>
    <div class="device-row one">
      ${p("/shots/crew-macos.webp","Crew macOS: Messages, MuxBot, Multiplexer","crew · macOS","laptop",1006,670)}
    </div>`}function D(){return`
    <article class="block">
      <p class="eyebrow">Install</p>
      <h1>From stock.</h1>
      <p class="lede">The installer copies <code>maxq</code> into <code>$HOME/bin</code> and runs apply. Apply is idempotent. Prove runs revert → apply → assert and leaves APPLIED.</p>
      ${L()}
    </article>
    ${v("/shots/prove.webp","maxq prove PASS on grokbot","maxq prove · result=PASS · intercept=false",900,562)}
    ${v("/shots/rofi.webp","Rofi Super+Space","launcher · Super+Space",1e3,625)}
    <article class="block"><h2>Commands</h2><table class="cli"><thead><tr><th>command</th><th>does</th></tr></thead><tbody>
      <tr><td>maxq status</td><td class="dim">applied | reverted</td></tr>
      <tr><td>maxq apply</td><td class="dim">configure (idempotent)</td></tr>
      <tr><td>maxq revert</td><td class="dim">unconfigure MaxQ-owned files only</td></tr>
      <tr><td>maxq prove</td><td class="dim">revert/apply/assert cycle; leaves APPLIED</td></tr>
      <tr><td>maxq proxy</td><td class="dim">GOST settings (local process only)</td></tr>
    </tbody></table></article>`}function j(){return`
    <article class="block">
      <p class="eyebrow">Invariants</p>
      <h1>The box can come apart.</h1>
      <p class="lede">MaxQ is the load line, not a hostage-taking dotfile run. Revert is part of the product.</p>
      <ul class="inv">
        <li>Persist only under $HOME — bin, .config/maxq, .local</li>
        <li>Never write Chrome ProxyMode / ProxyServer / managed policy</li>
        <li>GOST intercept defaults false</li>
        <li>Revert does not delete $HOME, SSH keys, Chrome profiles, or the persist CA</li>
        <li>API refuses non-loopback binds</li>
      </ul>
    </article>
    ${v("/shots/plank.webp","Plank dock with ChatGPT Claude Grok Slack Discord Ghostty","dock · mocha icons",900,562)}
    ${v("/shots/chrome-mocha.webp","Chrome mocha toolbar","chrome · mocha",900,562)}`}function U(){return`
    <article class="block">
      <p class="eyebrow">Ops</p>
      <h1>Control API</h1>
      <p class="lede">Go stdlib + embedded mocha sheet. apply starts it. revert stops it. No auth beyond localhost.</p>
    </article>
    ${p("/shots/settings.webp","MaxQ settings Defaults","GET / · applied · Ghostty 1.3.1","laptop",1e3,624)}
    <table class="cli"><thead><tr><th>route</th><th>notes</th></tr></thead><tbody>
      <tr><td>GET /</td><td class="dim">thin settings sheet</td></tr>
      <tr><td>GET /status</td><td class="dim">applied, theme, gost, clis</td></tr>
      <tr><td>POST /apply</td><td class="dim">runs maxq apply</td></tr>
      <tr><td>POST /revert</td><td class="dim">200 then the process exits</td></tr>
    </tbody></table>`}const O=[[203,166,247],[250,179,135],[137,220,235],[180,190,254]];function F(s){const e=s.getContext("2d");if(!e)return()=>{};let t=0,a=0,r=[],o=[],i=[],m=0,f=0,h=0,d=0,u=0,w=0;const y=window.matchMedia("(prefers-reduced-motion: reduce)").matches,k=()=>{const n=Math.min(window.devicePixelRatio||1,2);t=window.innerWidth,a=window.innerHeight,s.width=Math.floor(t*n),s.height=Math.floor(a*n),s.style.width=`${t}px`,s.style.height=`${a}px`,e.setTransform(n,0,0,n,0,0),A()},A=()=>{const n=Math.floor(t*a/11e3);r=Array.from({length:n},()=>({x:Math.random()*t,y:Math.random()*a,z:.25+Math.random()*.75,tw:Math.random()*Math.PI*2,rgb:O[Math.floor(Math.random()*O.length)]})),o=Array.from({length:16},()=>({x:Math.random()*t,y:Math.random()*a})),i=[];for(let l=0;l<o.length;l++){const b=o.map((c,g)=>({j:g,d:Math.hypot(c.x-o[l].x,c.y-o[l].y)})).filter(c=>c.j!==l).sort((c,g)=>c.d-g.d);for(const c of b.slice(0,2))c.d<Math.min(t,a)*.28&&i.push([l,c.j])}},S=n=>{y||(u=(n.clientX/t-.5)*6,w=(n.clientY/a-.5)*6)},M=()=>{f+=y?0:.002,h+=(u-h)*.04,d+=(w-d)*.04,e.setTransform(Math.min(window.devicePixelRatio||1,2),0,0,Math.min(window.devicePixelRatio||1,2),0,0),e.clearRect(0,0,t,a);const n=e.createRadialGradient(t*.5,a*.18,20,t*.5,a*.45,Math.max(t,a));n.addColorStop(0,"#1e1e2e"),n.addColorStop(.55,"#181825"),n.addColorStop(1,"#11111b"),e.fillStyle=n,e.fillRect(0,0,t,a),e.save(),e.translate(h,d),e.strokeStyle="rgba(203,166,247,0.10)",e.lineWidth=1;for(const[l,b]of i)e.beginPath(),e.moveTo(o[l].x,o[l].y),e.lineTo(o[b].x,o[b].y),e.stroke();for(const l of o)e.fillStyle="rgba(180,190,254,0.55)",e.beginPath(),e.arc(l.x,l.y,1.4,0,Math.PI*2),e.fill();for(const l of r){const b=y?.7:.4+.6*Math.abs(Math.sin(f*.9+l.tw)),[c,g,q]=l.rgb;e.fillStyle=`rgba(${c},${g},${q},${.16+l.z*.5*b})`,e.fillRect(l.x,l.y,l.z*1.5,l.z*1.5)}e.restore(),m=requestAnimationFrame(M)};return k(),M(),window.addEventListener("resize",k),window.addEventListener("mousemove",S),()=>{cancelAnimationFrame(m),window.removeEventListener("resize",k),window.removeEventListener("mousemove",S)}}const I={home:{label:"maxq",draw:H},stack:{label:"stack",draw:N},router:{label:"router",draw:Q},cue:{label:"cue",draw:B},crew:{label:"crew",draw:z},install:{label:"install",draw:D},invariants:{label:"invariants",draw:j},ops:{label:"ops",draw:U}},V=["home","stack","router","cue","crew"];function W(s,e){return`
    <header class="topbar">
      <a class="brand" href="#home">
        <span class="brand-kicker">Constellation</span>
        <img class="namelogo" src="/namelogo.webp" alt="MaxQ" width="1319" height="318" />
      </a>
      <nav class="nav">${V.map(a=>`<a class="${a===e?" active":""}" href="#${a}">${I[a].label}</a>`).join("")}</nav>
      <div class="nav-end">
        <a class="btn-ghost btn-sm" href="${x}">GitHub</a>
        <a class="btn-solid btn-sm" href="#install">Install</a>
      </div>
    </header>
    <div class="accent pastel-flow" aria-hidden="true"></div>
    ${s}
    <footer class="foot">
      <span>MIT · mocha</span>
      <span>
        <a href="#invariants">invariants</a>
        · <a href="#ops">ops</a>
        · <a href="${x}">github</a>
        · <a href="${x}/blob/main/docs/TRUST.md">trust</a>
      </span>
    </footer>`}function X(s){s.querySelectorAll("button.copy").forEach(e=>{e.addEventListener("click",async()=>{const t=e.dataset.copy??"";try{await navigator.clipboard.writeText(t),e.textContent="copied",e.classList.add("ok"),window.setTimeout(()=>{e.textContent="copy",e.classList.remove("ok")},1400)}catch{e.textContent="fail"}})})}function Y(s){const e=[...s.querySelectorAll("[data-tab]")],t=[...s.querySelectorAll("[data-panel]")];if(!e.length)return;const a=r=>{e.forEach(o=>o.classList.toggle("active",o.dataset.tab===r)),t.forEach(o=>{const i=o.dataset.panel===r;o.classList.toggle("active",i),o.hidden=!i})};e.forEach(r=>{r.addEventListener("click",()=>a(r.dataset.tab??"router"))})}function Z(s){const e=s.querySelector("[data-carousel]");if(!e)return;const t=e.hasAttribute("data-carousel-lock"),a=[...e.querySelectorAll(".slide")],r=[...e.querySelectorAll("[data-dot]")];let o=0,i=0;const m=h=>{o=(h%a.length+a.length)%a.length,a.forEach((d,u)=>{const w=u===o;d.classList.toggle("is-on",w),d.hidden=!w}),r.forEach((d,u)=>d.classList.toggle("is-on",u===o))},f=()=>{t||(window.clearInterval(i),i=window.setInterval(()=>m(o+1),4200))};r.forEach(h=>h.addEventListener("click",()=>{m(Number(h.dataset.dot)),t||f()})),t||(e.addEventListener("mouseenter",()=>window.clearInterval(i)),e.addEventListener("mouseleave",f),new IntersectionObserver(d=>{d.some(u=>u.isIntersecting)?f():window.clearInterval(i)},{threshold:.35}).observe(e)),m(0)}function T(){const s=document.getElementById("app");if(!s)return;const e=R();s.innerHTML=W(I[e].draw(),e),X(s),Y(s),Z(s)}function P(){const s=document.getElementById("loader");if(!s)return;if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){s.remove();return}s.classList.add("out"),window.setTimeout(()=>s.remove(),480)}const E=document.getElementById("stars");E instanceof HTMLCanvasElement&&F(E);T();window.addEventListener("hashchange",T);document.readyState==="complete"?P():window.addEventListener("load",P);
