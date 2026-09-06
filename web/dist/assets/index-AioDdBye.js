(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))s(r);new MutationObserver(r=>{for(const a of r)if(a.type==="childList")for(const n of a.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&s(n)}).observe(document,{childList:!0,subtree:!0});function t(r){const a={};return r.integrity&&(a.integrity=r.integrity),r.referrerPolicy&&(a.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?a.credentials="include":r.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function s(r){if(r.ep)return;r.ep=!0;const a=t(r);fetch(r.href,a)}})();const M="curl -fsSL https://raw.githubusercontent.com/0sm0s1z/constellation-MaxQ/main/install.sh | bash",k="https://github.com/0sm0s1z/constellation-MaxQ";function R(){const o=(location.hash||"#home").replace("#","");return["home","stack","router","cue","crew","install","invariants","ops"].includes(o)?o:"home"}const T=()=>`
  <div class="term"><code><span class="ps1">$</span><span class="cmd">${M}</span><span class="cursor"></span></code><button class="copy" type="button" data-copy="${M}">copy</button></div>`,g=(o,e,t,s,r)=>`
  <figure class="shot"><img src="${o}" alt="${e}" width="${s}" height="${r}" /><figcaption>${t}</figcaption></figure>`,m=(o,e,t,s="laptop",r=1280,a=800)=>`
  <figure class="bezel ${s}">
    <div class="chrome"><span></span><span></span><span></span></div>
    <img src="${o}" alt="${e}" width="${r}" height="${a}" />
    <figcaption>${t}</figcaption>
  </figure>`,C=[{id:"router",num:"01",label:"Router",title:"Make every seat count.",lede:"Constellation Auto picks a model from seats you already pay for: how hard the job is, the cheapest remaining token, and how close that seat is to reset.",src:"/shots/router-dashboard.webp",alt:"Constellation Router dashboard: seats, included usage, reset clocks",cap:"router · operations",w:1100,h:535,href:"#router"},{id:"maxq",num:"02",label:"MaxQ",title:"The computer Grok Bot runs on.",lede:"Utilities for the bot. Secondary controls for you: settings, telemetry, processes, every desktop.",src:"/shots/desktops.webp",alt:"MaxQ desktops multiplexer, live Xvfb :1 through :15, current :5",cap:"maxq · desktops",w:1037,h:1200,href:"#home"},{id:"cue",num:"03",label:"Cue",title:"Native glass. Not an Electron fork.",lede:"Swift/SwiftUI chat-and-steer for macOS. iOS still landing.",src:"/shots/cue-macos.webp",alt:"Cue macOS: Messages, MuxBot chat, Multiplexer assigns computers",cap:"cue · macOS",w:1006,h:670,href:"#cue"},{id:"crew",num:"04",label:"Crew",title:"Chat stays in Crew. The box is a provider.",lede:"Cue-like SwiftUI with pluggable ComputerProviders: local Docker/VZ, Proxmox, AWS/EC2, Connect-Mac.",src:"/shots/crew-macos.webp",alt:"Crew macOS: Messages, MuxBot, Multiplexer",cap:"crew · macOS",w:1006,h:670,href:"#crew"}],G="M12 0C12.7 7.1 16.9 11.3 24 12C16.9 12.7 12.7 16.9 12 24C11.3 16.9 7.1 12.7 0 12C7.1 11.3 11.3 7.1 12 0Z",H=[{x:"6%",y:"14%",size:22,tint:"mauve",dur:5.2,delay:-1.1,spin:1},{x:"22%",y:"8%",size:12,tint:"sky",dur:4.1,delay:-2.6,spin:-1},{x:"38%",y:"18%",size:16,tint:"peach",dur:6,delay:-.4,spin:1},{x:"49%",y:"6%",size:10,tint:"lavender",dur:4.6,delay:-3.3,spin:-1},{x:"9%",y:"62%",size:14,tint:"pink",dur:5.6,delay:-2,spin:1},{x:"31%",y:"76%",size:20,tint:"sky",dur:4.9,delay:-1.7,spin:-1},{x:"58%",y:"88%",size:12,tint:"mauve",dur:5.9,delay:-.9,spin:1},{x:"84%",y:"12%",size:18,tint:"peach",dur:4.4,delay:-2.2,spin:-1},{x:"94%",y:"40%",size:12,tint:"lavender",dur:6.3,delay:-3.8,spin:1},{x:"90%",y:"78%",size:24,tint:"mauve",dur:5,delay:-1.4,spin:-1},{x:"70%",y:"4%",size:10,tint:"pink",dur:4.2,delay:-.2,spin:1}],B=[["state","applied",!0],["intercept","false",!1],["persist","$HOME only",!1],["prove","PASS",!0]];function N(){const o=typeof matchMedia=="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches,e="MaxQ launch: a rocket lifting off a laptop",t=`<img class="launch-still" src="/art/maxq-launch-still.webp" alt="${e}" width="1024" height="1180" />`,s=o?t:`
        <video class="launch-video" autoplay muted playsinline width="1024" height="1180" poster="/art/maxq-launch-still.webp" aria-label="${e}">
          <source src="/art/maxq-launch.webm" type="video/webm" />
        </video>
        <img class="launch-gif" data-src="/art/maxq-launch.gif" alt="${e}" width="614" height="708" hidden />
        ${t}`,r=H.map((n,d)=>`<svg class="spark ${n.tint}" viewBox="0 0 24 24" aria-hidden="true" style="left:${n.x};top:${n.y};width:${n.size}px;height:${n.size}px;--dur:${n.dur}s;--delay:${n.delay}s;--spin:${n.spin};--i:${d}"><path d="${G}"/></svg>`).join(""),a=B.map(([n,d,p],l)=>`<li style="--i:${l}"><span class="tk">${n}</span><span class="tv${p?" ok":""}">${d}</span></li>`).join("");return`
    <section class="launch${o?" is-live is-apogee is-held":""}" data-launch>
      <div class="launch-sky" aria-hidden="true">${r}</div>
      <div class="launch-grid">
        <div class="launch-copy">
          <p class="eyebrow reveal r1">Constellation · first product</p>
          <h1 class="launch-title">
            <span class="launch-line reveal r2">Take Grok Bot to</span>
            <span class="wordmark reveal r3" role="img" aria-label="MaxQ"><span class="wordmark-ink pastel-flow"></span></span>
          </h1>
          <p class="lede reveal r4">MaxQ is the build package for the computer Grok Bot runs on. The bot gets the utilities to ship code. You get the side door: settings, telemetry, processes, and every desktop.</p>
          <div class="cta-row reveal r5">
            <a class="btn-solid" href="#install">Install</a>
            <a class="btn-ghost" href="#how">See how it works</a>
          </div>
        </div>
        <div class="launch-stage">
          <span class="ignition" aria-hidden="true"></span>
          ${s}
        </div>
      </div>
      <ul class="telemetry" aria-label="MaxQ state">${a}</ul>
      <a class="scroll-cue reveal r7" href="#how" aria-label="Scroll to how it works"><span></span></a>
    </section>`}function Q(){const o=C.map((t,s)=>`<button type="button" class="tab${s===0?" active":""}" data-tab="${t.id}"><span class="tab-num">${t.num}</span>${t.label}</button>`).join(""),e=C.map((t,s)=>`
      <div class="panel${s===0?" active":""}" data-panel="${t.id}" ${s===0?"":"hidden"}>
        <div class="panel-copy">
          <p class="eyebrow">${t.num} · ${t.label}</p>
          <h3>${t.title}</h3>
          <p class="lede">${t.lede}</p>
          <a class="btn-ghost" href="${t.href}">Open ${t.label}</a>
        </div>
        ${t.src?m(t.src,t.alt,t.cap,"laptop",t.w,t.h):`<figure class="bezel empty"><div class="chrome"><span></span><span></span><span></span></div><p class="ph">Crew screenshot landing. Not Cue.</p><figcaption>${t.cap}</figcaption></figure>`}
      </div>`).join("");return`
    ${N()}
    <div class="install-bar">${T()}</div>
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
      ${m("/shots/collage.webp","MaxQ operator glass: desktops multiplexer, settings, packages, OpenCode","maxq · desktops, settings, packages","laptop",900,1059)}
    </section>
    <section class="surfaces" id="surfaces">
      <div class="section-head">
        <p class="eyebrow">Constellation</p>
        <h2 class="display">Four surfaces. One stack.</h2>
      </div>
      <div class="tabs" role="tablist">${o}</div>
      <div class="panels">${e}</div>
    </section>`}function j(){return`
    <article class="block">
      <p class="eyebrow">Constellation</p>
      <h1>One stack. <span class="grad">Four surfaces.</span></h1>
      <p class="lede">Router spends the seats. MaxQ makes the box persist. Cue and Crew are the native glass.</p>
    </article>
    <div class="device-row">
      ${m("/shots/router-dashboard.webp","Constellation Router dashboard","router · seats","laptop",1100,535)}
      ${m("/shots/settings.webp","MaxQ settings applied","maxq · settings","laptop",1e3,624)}
      ${m("/shots/cue-macos.webp","Cue chat-and-steer on macOS","cue · macOS","laptop",1006,670)}
    </div>`}function D(){return`
    <article class="block">
      <p class="eyebrow">01 · Router</p>
      <h1>Make every <span class="grad">seat</span> count.</h1>
      <p class="lede">Constellation Auto picks a model from seats you already pay for: how hard the job is, the cheapest remaining token, and how close that seat is to reset.</p>
    </article>
    ${m("/shots/router-dashboard.webp","Constellation Router dashboard: seats, included usage, reset clocks","operations · dashboard","laptop",1100,535)}
    <div class="grid three">
      <section><h2>Hard jobs</h2><p>Spend the expensive seat when the work is actually hard.</p></section>
      <section><h2>Cheap remainder</h2><p>Mid-cycle, hoard Sol. Burn Luna or Grok on routine work.</p></section>
      <section><h2>Reset clock</h2><p>Near reset, spend tokens that are about to vanish.</p></section>
    </div>
    ${g("/shots/router-seats.webp","Constellation Router seats table","seats · linked",900,420)}`}function U(){return`
    <article class="block">
      <p class="eyebrow">03 · Cue</p>
      <h1><span class="grad">Cue</span> is native glass.</h1>
      <p class="lede">Swift/SwiftUI chat-and-steer for macOS. iOS still landing.</p>
    </article>
    <div class="device-row one">
      ${m("/shots/cue-macos.webp","Cue macOS: Messages, MuxBot chat, Multiplexer assigns computers","cue · macOS","laptop",1006,612)}
    </div>
    <div class="device-row one">
      ${m("/shots/cue-macos-2.webp","Cue macOS 3-pane, MuxBot Hello world, Multiplexer host and agents","cue · macOS","laptop",1006,635)}
    </div>`}function F(){return`
    <article class="block">
      <p class="eyebrow">04 · Crew</p>
      <h1><span class="grad">Crew</span> steers computers.</h1>
      <p class="lede">Cue-like SwiftUI with pluggable ComputerProviders: local Docker/VZ, Proxmox, AWS/EC2, Connect-Mac. Chat stays in Crew. The box is a provider.</p>
    </article>
    <div class="device-row one">
      ${m("/shots/crew-macos.webp","Crew macOS: Messages, MuxBot, Multiplexer","crew · macOS","laptop",1006,670)}
    </div>`}function V(){return`
    <article class="block">
      <p class="eyebrow">Install</p>
      <h1>From stock.</h1>
      <p class="lede">The installer copies <code>maxq</code> into <code>$HOME/bin</code> and runs apply. Apply is idempotent. Prove runs revert → apply → assert and leaves APPLIED.</p>
      ${T()}
    </article>
    ${g("/shots/prove.webp","maxq prove PASS on grokbot","maxq prove · result=PASS · intercept=false",900,562)}
    ${g("/shots/rofi.webp","Rofi Super+Space","launcher · Super+Space",1e3,625)}
    <article class="block"><h2>Commands</h2><table class="cli"><thead><tr><th>command</th><th>does</th></tr></thead><tbody>
      <tr><td>maxq status</td><td class="dim">applied | reverted</td></tr>
      <tr><td>maxq apply</td><td class="dim">configure (idempotent)</td></tr>
      <tr><td>maxq revert</td><td class="dim">unconfigure MaxQ-owned files only</td></tr>
      <tr><td>maxq prove</td><td class="dim">revert/apply/assert cycle; leaves APPLIED</td></tr>
      <tr><td>maxq proxy</td><td class="dim">GOST settings (local process only)</td></tr>
    </tbody></table></article>`}function W(){return`
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
    ${g("/shots/plank.webp","Plank dock with ChatGPT Claude Grok Slack Discord Ghostty","dock · mocha icons",900,562)}
    ${g("/shots/chrome-mocha.webp","Chrome mocha toolbar","chrome · mocha",900,562)}`}function K(){return`
    <article class="block">
      <p class="eyebrow">Ops</p>
      <h1>Control API</h1>
      <p class="lede">Go stdlib + embedded mocha sheet. apply starts it. revert stops it. No auth beyond localhost.</p>
    </article>
    ${m("/shots/settings.webp","MaxQ settings Defaults","GET / · applied · Ghostty 1.3.1","laptop",1e3,624)}
    <table class="cli"><thead><tr><th>route</th><th>notes</th></tr></thead><tbody>
      <tr><td>GET /</td><td class="dim">thin settings sheet</td></tr>
      <tr><td>GET /status</td><td class="dim">applied, theme, gost, clis</td></tr>
      <tr><td>POST /apply</td><td class="dim">runs maxq apply</td></tr>
      <tr><td>POST /revert</td><td class="dim">200 then the process exits</td></tr>
    </tbody></table>`}const L=[[203,166,247],[250,179,135],[137,220,235],[180,190,254]];function X(o){const e=o.getContext("2d");if(!e)return()=>{};let t=0,s=0,r=[],a=[],n=[],d=0,p=0,l=0,u=0,f=0,w=0;const y=window.matchMedia("(prefers-reduced-motion: reduce)").matches,x=()=>{const c=Math.min(window.devicePixelRatio||1,2);t=window.innerWidth,s=window.innerHeight,o.width=Math.floor(t*c),o.height=Math.floor(s*c),o.style.width=`${t}px`,o.style.height=`${s}px`,e.setTransform(c,0,0,c,0,0),I()},I=()=>{const c=Math.floor(t*s/11e3);r=Array.from({length:c},()=>({x:Math.random()*t,y:Math.random()*s,z:.25+Math.random()*.75,tw:Math.random()*Math.PI*2,rgb:L[Math.floor(Math.random()*L.length)]})),a=Array.from({length:16},()=>({x:Math.random()*t,y:Math.random()*s})),n=[];for(let i=0;i<a.length;i++){const v=a.map((h,b)=>({j:b,d:Math.hypot(h.x-a[i].x,h.y-a[i].y)})).filter(h=>h.j!==i).sort((h,b)=>h.d-b.d);for(const h of v.slice(0,2))h.d<Math.min(t,s)*.28&&n.push([i,h.j])}},$=c=>{y||(f=(c.clientX/t-.5)*6,w=(c.clientY/s-.5)*6)},S=()=>{p+=y?0:.002,l+=(f-l)*.04,u+=(w-u)*.04,e.setTransform(Math.min(window.devicePixelRatio||1,2),0,0,Math.min(window.devicePixelRatio||1,2),0,0),e.clearRect(0,0,t,s);const c=e.createRadialGradient(t*.5,s*.18,20,t*.5,s*.45,Math.max(t,s));c.addColorStop(0,"#1e1e2e"),c.addColorStop(.55,"#181825"),c.addColorStop(1,"#11111b"),e.fillStyle=c,e.fillRect(0,0,t,s),e.save(),e.translate(l,u),e.strokeStyle="rgba(203,166,247,0.10)",e.lineWidth=1;for(const[i,v]of n)e.beginPath(),e.moveTo(a[i].x,a[i].y),e.lineTo(a[v].x,a[v].y),e.stroke();for(const i of a)e.fillStyle="rgba(180,190,254,0.55)",e.beginPath(),e.arc(i.x,i.y,1.4,0,Math.PI*2),e.fill();for(const i of r){const v=y?.7:.4+.6*Math.abs(Math.sin(p*.9+i.tw)),[h,b,z]=i.rgb;e.fillStyle=`rgba(${h},${b},${z},${.16+i.z*.5*v})`,e.fillRect(i.x,i.y,i.z*1.5,i.z*1.5)}e.restore(),d=requestAnimationFrame(S)};return x(),S(),window.addEventListener("resize",x),window.addEventListener("mousemove",$),()=>{cancelAnimationFrame(d),window.removeEventListener("resize",x),window.removeEventListener("mousemove",$)}}const A={home:{label:"maxq",draw:Q},stack:{label:"stack",draw:j},router:{label:"router",draw:D},cue:{label:"cue",draw:U},crew:{label:"crew",draw:F},install:{label:"install",draw:V},invariants:{label:"invariants",draw:W},ops:{label:"ops",draw:K}},Y=["home","stack","router","cue","crew"];function Z(o,e){return`
    <header class="topbar">
      <a class="brand" href="#home">
        <span class="brand-kicker">Constellation</span>
        <img class="namelogo" src="/namelogo.webp" alt="MaxQ" width="1319" height="318" />
      </a>
      <nav class="nav">${Y.map(s=>`<a class="${s===e?" active":""}" href="#${s}">${A[s].label}</a>`).join("")}</nav>
      <div class="nav-end">
        <a class="btn-ghost btn-sm" href="${k}">GitHub</a>
        <a class="btn-solid btn-sm" href="#install">Install</a>
      </div>
    </header>
    <div class="accent pastel-flow" aria-hidden="true"></div>
    ${o}
    <footer class="foot">
      <span>MIT · mocha</span>
      <span>
        <a href="#invariants">invariants</a>
        · <a href="#ops">ops</a>
        · <a href="${k}">github</a>
        · <a href="${k}/blob/main/docs/TRUST.md">trust</a>
      </span>
    </footer>`}function _(o){o.querySelectorAll("button.copy").forEach(e=>{e.addEventListener("click",async()=>{const t=e.dataset.copy??"";try{await navigator.clipboard.writeText(t),e.textContent="copied",e.classList.add("ok"),window.setTimeout(()=>{e.textContent="copy",e.classList.remove("ok")},1400)}catch{e.textContent="fail"}})})}function J(o){const e=[...o.querySelectorAll("[data-tab]")],t=[...o.querySelectorAll("[data-panel]")];if(!e.length)return;const s=r=>{e.forEach(a=>a.classList.toggle("active",a.dataset.tab===r)),t.forEach(a=>{const n=a.dataset.panel===r;a.classList.toggle("active",n),a.hidden=!n})};e.forEach(r=>{r.addEventListener("click",()=>s(r.dataset.tab??"router"))})}function ee(o){const e=o.querySelector("[data-carousel]");if(!e)return;const t=e.hasAttribute("data-carousel-lock"),s=[...e.querySelectorAll(".slide")],r=[...e.querySelectorAll("[data-dot]")];let a=0,n=0;const d=l=>{a=(l%s.length+s.length)%s.length,s.forEach((u,f)=>{const w=f===a;u.classList.toggle("is-on",w),u.hidden=!w}),r.forEach((u,f)=>u.classList.toggle("is-on",f===a))},p=()=>{t||(window.clearInterval(n),n=window.setInterval(()=>d(a+1),4200))};r.forEach(l=>l.addEventListener("click",()=>{d(Number(l.dataset.dot)),t||p()})),t||(e.addEventListener("mouseenter",()=>window.clearInterval(n)),e.addEventListener("mouseleave",p),new IntersectionObserver(u=>{u.some(f=>f.isIntersecting)?p():window.clearInterval(n)},{threshold:.35}).observe(e)),d(0)}const E=3.5;function te(o){var p;const e=o.querySelector("[data-launch]");if(!e||e.classList.contains("is-live"))return;const t=e.querySelector("video.launch-video"),s=e.querySelector("img.launch-gif");let r=0;const a=()=>{e.classList.contains("is-live")||(e.classList.add("is-live"),r=window.setTimeout(()=>e.classList.add("is-apogee"),E*1e3))},n=()=>e.classList.add("is-apogee","is-held");if(!t){a(),n();return}const d=()=>{if(s){const l=s.dataset.src;l&&s.getAttribute("src")!==l&&(s.src=l),s.hidden=!1}t.remove(),a()};t.addEventListener("playing",a,{once:!0}),t.addEventListener("timeupdate",()=>{t.currentTime>=E&&(window.clearTimeout(r),e.classList.add("is-apogee"))}),t.addEventListener("ended",n,{once:!0}),t.addEventListener("error",d),(p=t.querySelector("source"))==null||p.addEventListener("error",d),window.setTimeout(()=>{e.classList.contains("is-live")||(t.play().catch(()=>{}),a(),t.paused&&n())},900)}function q(){const o=document.getElementById("app");if(!o)return;const e=R();o.innerHTML=Z(A[e].draw(),e),_(o),J(o),ee(o),te(o)}function O(){const o=document.getElementById("loader");if(!o)return;if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){o.remove();return}o.classList.add("out"),window.setTimeout(()=>o.remove(),480)}const P=document.getElementById("stars");P instanceof HTMLCanvasElement&&X(P);q();window.addEventListener("hashchange",q);document.readyState==="complete"?O():window.addEventListener("load",O);
