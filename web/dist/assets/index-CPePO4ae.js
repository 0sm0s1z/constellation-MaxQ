(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))s(r);new MutationObserver(r=>{for(const o of r)if(o.type==="childList")for(const i of o.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&s(i)}).observe(document,{childList:!0,subtree:!0});function t(r){const o={};return r.integrity&&(o.integrity=r.integrity),r.referrerPolicy&&(o.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?o.credentials="include":r.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function s(r){if(r.ep)return;r.ep=!0;const o=t(r);fetch(r.href,o)}})();const C="curl -fsSL https://raw.githubusercontent.com/0sm0s1z/constellation-MaxQ/main/install.sh | bash",$="https://github.com/0sm0s1z/constellation-MaxQ";function G(){const a=(location.hash||"#home").replace("#","");return["home","stack","router","cue","crew","install","invariants","ops"].includes(a)?a:"home"}const q=()=>`
  <div class="term"><code><span class="ps1">$</span><span class="cmd">${C}</span><span class="cursor"></span></code><button class="copy" type="button" data-copy="${C}">copy</button></div>`,x=(a,e,t,s,r)=>`
  <figure class="shot"><img src="${a}" alt="${e}" width="${s}" height="${r}" /><figcaption>${t}</figcaption></figure>`,w=(a,e,t,s="laptop",r=1280,o=800)=>`
  <figure class="bezel ${s}">
    <div class="chrome"><span></span><span></span><span></span></div>
    <img src="${a}" alt="${e}" width="${r}" height="${o}" />
    <figcaption>${t}</figcaption>
  </figure>`,L=[{id:"router",num:"01",label:"Router",title:"Make every seat count.",lede:"Constellation Auto picks a model from seats you already pay for: how hard the job is, the cheapest remaining token, and how close that seat is to reset.",src:"/shots/router-dashboard.webp",alt:"Constellation Router dashboard: seats, included usage, reset clocks",cap:"router · operations",w:1100,h:535,href:"#router"},{id:"maxq",num:"02",label:"MaxQ",title:"The computer Grok Bot runs on.",lede:"Utilities for the bot. Secondary controls for you: settings, telemetry, processes, every desktop.",src:"/shots/desktops.webp",alt:"MaxQ desktops multiplexer, live Xvfb :1 through :15, current :5",cap:"maxq · desktops",w:1037,h:1200,href:"#home"},{id:"cue",num:"03",label:"Cue",title:"Native glass. Not an Electron fork.",lede:"Swift/SwiftUI chat-and-steer for macOS. iOS still landing.",src:"/shots/cue-macos.webp",alt:"Cue macOS: Messages, MuxBot chat, Multiplexer assigns computers",cap:"cue · macOS",w:1006,h:670,href:"#cue"},{id:"crew",num:"04",label:"Crew",title:"Chat stays in Crew. The box is a provider.",lede:"Cue-like SwiftUI with pluggable ComputerProviders: local Docker/VZ, Proxmox, AWS/EC2, Connect-Mac.",src:"/shots/crew-macos.webp",alt:"Crew macOS: Messages, MuxBot, Multiplexer",cap:"crew · macOS",w:1006,h:670,href:"#crew"}],H="M12 0C12.7 7.1 16.9 11.3 24 12C16.9 12.7 12.7 16.9 12 24C11.3 16.9 7.1 12.7 0 12C7.1 11.3 11.3 7.1 12 0Z",N=[{x:"6%",y:"14%",size:22,tint:"mauve",dur:5.2,delay:-1.1,spin:1},{x:"22%",y:"8%",size:12,tint:"sky",dur:4.1,delay:-2.6,spin:-1},{x:"38%",y:"18%",size:16,tint:"peach",dur:6,delay:-.4,spin:1},{x:"49%",y:"6%",size:10,tint:"lavender",dur:4.6,delay:-3.3,spin:-1},{x:"9%",y:"62%",size:14,tint:"pink",dur:5.6,delay:-2,spin:1},{x:"31%",y:"76%",size:20,tint:"sky",dur:4.9,delay:-1.7,spin:-1},{x:"58%",y:"88%",size:12,tint:"mauve",dur:5.9,delay:-.9,spin:1},{x:"84%",y:"12%",size:18,tint:"peach",dur:4.4,delay:-2.2,spin:-1},{x:"94%",y:"40%",size:12,tint:"lavender",dur:6.3,delay:-3.8,spin:1},{x:"90%",y:"78%",size:24,tint:"mauve",dur:5,delay:-1.4,spin:-1},{x:"70%",y:"4%",size:10,tint:"pink",dur:4.2,delay:-.2,spin:1}],Q=[["state","applied",!0],["intercept","false",!1],["persist","$HOME only",!1],["prove","PASS",!0]],E=[{src:"/shots/maxq-desktop.webp",w:1100,h:687,alt:"The bot's desktop on MaxQ: browser, Ghostty terminal, mocha dock",num:"01",cap:"the bot's desk",tele:"state"},{src:"/shots/settings.webp",w:1e3,h:624,alt:"MaxQ settings sheet on 127.0.0.1:7432, state applied",num:"02",cap:"the side door",tele:"intercept"},{src:"/shots/prove.webp",w:900,h:562,alt:"maxq prove report: result=PASS, left_state=APPLIED",num:"03",cap:"prove · PASS",tele:"prove"}];function B(){const a=typeof matchMedia=="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches,e="MaxQ launch: a rocket lifting off a laptop",t=`<img class="launch-still" src="/art/maxq-launch-still.webp" alt="${e}" width="1024" height="1180" />`,s=a?t:`
        <video class="launch-video" autoplay muted playsinline width="1024" height="1180" poster="/art/maxq-launch-still.webp" aria-label="${e}">
          <source src="/art/maxq-launch.webm" type="video/webm" />
        </video>
        <img class="launch-gif" data-src="/art/maxq-launch.gif" alt="${e}" width="614" height="708" hidden />
        ${t}`,r=N.map((n,l)=>`<svg class="spark ${n.tint}" viewBox="0 0 24 24" aria-hidden="true" style="left:${n.x};top:${n.y};width:${n.size}px;height:${n.size}px;--dur:${n.dur}s;--delay:${n.delay}s;--spin:${n.spin};--i:${l}"><path d="${H}"/></svg>`).join(""),o=Q.map(([n,l,d],u)=>`<li style="--i:${u}" data-key="${n}"><span class="tk">${n}</span><span class="tv${d?" ok":""}">${l}</span></li>`).join(""),i=E.map((n,l)=>`<img class="${l===0?"is-on":""}" src="${n.src}" alt="${n.alt}" width="${n.w}" height="${n.h}" loading="${l===0?"eager":"lazy"}" data-tele="${n.tele}" />`).join(""),p=E.map((n,l)=>`<button type="button" class="${l===0?"is-on":""}" data-glass-to="${l}" aria-label="Show ${n.cap}"><span class="gn">${n.num}</span>${n.cap}</button>`).join("");return`
    <section class="launch${a?" is-live is-apogee is-held":""}" data-launch>
      <div class="launch-sky" aria-hidden="true">${r}</div>
      <div class="launch-grid">
        <div class="launch-copy">
          <div class="blk blk-title">
            <p class="eyebrow reveal r1">Constellation · first product</p>
            <h1 class="launch-title">
              <span class="launch-line reveal r2">Take Grok Bot to</span>
              <span class="wordmark reveal r3" role="img" aria-label="MaxQ"><span class="wordmark-ink pastel-flow"></span></span>
            </h1>
          </div>
          <div class="blk blk-claim">
            <p class="claim reveal r4">A co-operating system for your bot and you.</p>
            <p class="lede reveal r4">One command on the bot's computer. The stock box becomes a workstation built for the bot. You keep the side door.</p>
            <div class="cta-row reveal r5">
              <a class="btn-solid" href="#install">Install</a>
              <a class="btn-ghost" href="#how">See how it works</a>
            </div>
          </div>
          <dl class="blk split late l1">
            <div>
              <dt>The bot gets</dt>
              <dd>A computer made for it. Terminal, browser, desktops, theme, and its CLIs in place before the first task.</dd>
            </div>
            <div>
              <dt>You get</dt>
              <dd>The side door: settings, telemetry, processes, every desktop. Loopback only. Revert leaves the box standing.</dd>
            </div>
          </dl>
          <div class="blk glass late l2" data-glass>
            <div class="glass-frame">${i}</div>
            <div class="glass-caps" role="tablist">${p}</div>
          </div>
        </div>
        <div class="launch-stage">
          <span class="ignition" aria-hidden="true"></span>
          ${s}
        </div>
      </div>
      <ul class="telemetry" aria-label="MaxQ state">${o}</ul>
      <a class="scroll-cue reveal r7" href="#how" aria-label="Scroll to how it works"><span></span></a>
    </section>`}function j(){const a=L.map((t,s)=>`<button type="button" class="tab${s===0?" active":""}" data-tab="${t.id}"><span class="tab-num">${t.num}</span>${t.label}</button>`).join(""),e=L.map((t,s)=>`
      <div class="panel${s===0?" active":""}" data-panel="${t.id}" ${s===0?"":"hidden"}>
        <div class="panel-copy">
          <p class="eyebrow">${t.num} · ${t.label}</p>
          <h3>${t.title}</h3>
          <p class="lede">${t.lede}</p>
          <a class="btn-ghost" href="${t.href}">Open ${t.label}</a>
        </div>
        ${t.src?w(t.src,t.alt,t.cap,"laptop",t.w,t.h):`<figure class="bezel empty"><div class="chrome"><span></span><span></span><span></span></div><p class="ph">Crew screenshot landing. Not Cue.</p><figcaption>${t.cap}</figcaption></figure>`}
      </div>`).join("");return`
    ${B()}
    <div class="install-bar">${q()}</div>
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
      ${w("/shots/collage.webp","MaxQ operator glass: desktops multiplexer, settings, packages, OpenCode","maxq · desktops, settings, packages","laptop",900,1059)}
    </section>
    <section class="surfaces" id="surfaces">
      <div class="section-head">
        <p class="eyebrow">Constellation</p>
        <h2 class="display">Four surfaces. One stack.</h2>
      </div>
      <div class="tabs" role="tablist">${a}</div>
      <div class="panels">${e}</div>
    </section>`}function D(){return`
    <article class="block">
      <p class="eyebrow">Constellation</p>
      <h1>One stack. <span class="grad">Four surfaces.</span></h1>
      <p class="lede">Router spends the seats. MaxQ makes the box persist. Cue and Crew are the native glass.</p>
    </article>
    <div class="device-row">
      ${w("/shots/router-dashboard.webp","Constellation Router dashboard","router · seats","laptop",1100,535)}
      ${w("/shots/settings.webp","MaxQ settings applied","maxq · settings","laptop",1e3,624)}
      ${w("/shots/cue-macos.webp","Cue chat-and-steer on macOS","cue · macOS","laptop",1006,670)}
    </div>`}function F(){return`
    <article class="block">
      <p class="eyebrow">01 · Router</p>
      <h1>Make every <span class="grad">seat</span> count.</h1>
      <p class="lede">Constellation Auto picks a model from seats you already pay for: how hard the job is, the cheapest remaining token, and how close that seat is to reset.</p>
    </article>
    ${w("/shots/router-dashboard.webp","Constellation Router dashboard: seats, included usage, reset clocks","operations · dashboard","laptop",1100,535)}
    <div class="grid three">
      <section><h2>Hard jobs</h2><p>Spend the expensive seat when the work is actually hard.</p></section>
      <section><h2>Cheap remainder</h2><p>Mid-cycle, hoard Sol. Burn Luna or Grok on routine work.</p></section>
      <section><h2>Reset clock</h2><p>Near reset, spend tokens that are about to vanish.</p></section>
    </div>
    ${x("/shots/router-seats.webp","Constellation Router seats table","seats · linked",900,420)}`}function U(){return`
    <article class="block">
      <p class="eyebrow">03 · Cue</p>
      <h1><span class="grad">Cue</span> is native glass.</h1>
      <p class="lede">Swift/SwiftUI chat-and-steer for macOS. iOS still landing.</p>
    </article>
    <div class="device-row one">
      ${w("/shots/cue-macos.webp","Cue macOS: Messages, MuxBot chat, Multiplexer assigns computers","cue · macOS","laptop",1006,612)}
    </div>
    <div class="device-row one">
      ${w("/shots/cue-macos-2.webp","Cue macOS 3-pane, MuxBot Hello world, Multiplexer host and agents","cue · macOS","laptop",1006,635)}
    </div>`}function V(){return`
    <article class="block">
      <p class="eyebrow">04 · Crew</p>
      <h1><span class="grad">Crew</span> steers computers.</h1>
      <p class="lede">Cue-like SwiftUI with pluggable ComputerProviders: local Docker/VZ, Proxmox, AWS/EC2, Connect-Mac. Chat stays in Crew. The box is a provider.</p>
    </article>
    <div class="device-row one">
      ${w("/shots/crew-macos.webp","Crew macOS: Messages, MuxBot, Multiplexer","crew · macOS","laptop",1006,670)}
    </div>`}function _(){return`
    <article class="block">
      <p class="eyebrow">Install</p>
      <h1>From stock.</h1>
      <p class="lede">The installer copies <code>maxq</code> into <code>$HOME/bin</code> and runs apply. Apply is idempotent. Prove runs revert → apply → assert and leaves APPLIED.</p>
      ${q()}
    </article>
    ${x("/shots/prove.webp","maxq prove PASS on grokbot","maxq prove · result=PASS · intercept=false",900,562)}
    ${x("/shots/rofi.webp","Rofi Super+Space","launcher · Super+Space",1e3,625)}
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
    ${x("/shots/plank.webp","Plank dock with ChatGPT Claude Grok Slack Discord Ghostty","dock · mocha icons",900,562)}
    ${x("/shots/chrome-mocha.webp","Chrome mocha toolbar","chrome · mocha",900,562)}`}function Y(){return`
    <article class="block">
      <p class="eyebrow">Ops</p>
      <h1>Control API</h1>
      <p class="lede">Go stdlib + embedded mocha sheet. apply starts it. revert stops it. No auth beyond localhost.</p>
    </article>
    ${w("/shots/settings.webp","MaxQ settings Defaults","GET / · applied · Ghostty 1.3.1","laptop",1e3,624)}
    <table class="cli"><thead><tr><th>route</th><th>notes</th></tr></thead><tbody>
      <tr><td>GET /</td><td class="dim">thin settings sheet</td></tr>
      <tr><td>GET /status</td><td class="dim">applied, theme, gost, clis</td></tr>
      <tr><td>POST /apply</td><td class="dim">runs maxq apply</td></tr>
      <tr><td>POST /revert</td><td class="dim">200 then the process exits</td></tr>
    </tbody></table>`}const O=[[203,166,247],[250,179,135],[137,220,235],[180,190,254]];function K(a){const e=a.getContext("2d");if(!e)return()=>{};let t=0,s=0,r=[],o=[],i=[],p=0,n=0,l=0,d=0,u=0,m=0;const g=window.matchMedia("(prefers-reduced-motion: reduce)").matches,v=()=>{const h=Math.min(window.devicePixelRatio||1,2);t=window.innerWidth,s=window.innerHeight,a.width=Math.floor(t*h),a.height=Math.floor(s*h),a.style.width=`${t}px`,a.style.height=`${s}px`,e.setTransform(h,0,0,h,0,0),y()},y=()=>{const h=Math.floor(t*s/11e3);r=Array.from({length:h},()=>({x:Math.random()*t,y:Math.random()*s,z:.25+Math.random()*.75,tw:Math.random()*Math.PI*2,rgb:O[Math.floor(Math.random()*O.length)]})),o=Array.from({length:16},()=>({x:Math.random()*t,y:Math.random()*s})),i=[];for(let c=0;c<o.length;c++){const b=o.map((f,k)=>({j:k,d:Math.hypot(f.x-o[c].x,f.y-o[c].y)})).filter(f=>f.j!==c).sort((f,k)=>f.d-k.d);for(const f of b.slice(0,2))f.d<Math.min(t,s)*.28&&i.push([c,f.j])}},S=h=>{g||(u=(h.clientX/t-.5)*6,m=(h.clientY/s-.5)*6)},M=()=>{n+=g?0:.002,l+=(u-l)*.04,d+=(m-d)*.04,e.setTransform(Math.min(window.devicePixelRatio||1,2),0,0,Math.min(window.devicePixelRatio||1,2),0,0),e.clearRect(0,0,t,s);const h=e.createRadialGradient(t*.5,s*.18,20,t*.5,s*.45,Math.max(t,s));h.addColorStop(0,"#1e1e2e"),h.addColorStop(.55,"#181825"),h.addColorStop(1,"#11111b"),e.fillStyle=h,e.fillRect(0,0,t,s),e.save(),e.translate(l,d),e.strokeStyle="rgba(203,166,247,0.10)",e.lineWidth=1;for(const[c,b]of i)e.beginPath(),e.moveTo(o[c].x,o[c].y),e.lineTo(o[b].x,o[b].y),e.stroke();for(const c of o)e.fillStyle="rgba(180,190,254,0.55)",e.beginPath(),e.arc(c.x,c.y,1.4,0,Math.PI*2),e.fill();for(const c of r){const b=g?.7:.4+.6*Math.abs(Math.sin(n*.9+c.tw)),[f,k,z]=c.rgb;e.fillStyle=`rgba(${f},${k},${z},${.16+c.z*.5*b})`,e.fillRect(c.x,c.y,c.z*1.5,c.z*1.5)}e.restore(),p=requestAnimationFrame(M)};return v(),M(),window.addEventListener("resize",v),window.addEventListener("mousemove",S),()=>{cancelAnimationFrame(p),window.removeEventListener("resize",v),window.removeEventListener("mousemove",S)}}const I={home:{label:"maxq",draw:j},stack:{label:"stack",draw:D},router:{label:"router",draw:F},cue:{label:"cue",draw:U},crew:{label:"crew",draw:V},install:{label:"install",draw:_},invariants:{label:"invariants",draw:W},ops:{label:"ops",draw:Y}},X=["home","stack","router","cue","crew"];function Z(a,e){return`
    <header class="topbar">
      <a class="brand" href="#home">
        <span class="brand-kicker">Constellation</span>
        <img class="namelogo" src="/namelogo.webp" alt="MaxQ" width="1319" height="318" />
      </a>
      <nav class="nav">${X.map(s=>`<a class="${s===e?" active":""}" href="#${s}">${I[s].label}</a>`).join("")}</nav>
      <div class="nav-end">
        <a class="btn-ghost btn-sm" href="${$}">GitHub</a>
        <a class="btn-solid btn-sm" href="#install">Install</a>
      </div>
    </header>
    <div class="accent pastel-flow" aria-hidden="true"></div>
    ${a}
    <footer class="foot">
      <span>MIT · mocha</span>
      <span>
        <a href="#invariants">invariants</a>
        · <a href="#ops">ops</a>
        · <a href="${$}">github</a>
        · <a href="${$}/blob/main/docs/TRUST.md">trust</a>
      </span>
    </footer>`}function J(a){a.querySelectorAll("button.copy").forEach(e=>{e.addEventListener("click",async()=>{const t=e.dataset.copy??"";try{await navigator.clipboard.writeText(t),e.textContent="copied",e.classList.add("ok"),window.setTimeout(()=>{e.textContent="copy",e.classList.remove("ok")},1400)}catch{e.textContent="fail"}})})}function ee(a){const e=[...a.querySelectorAll("[data-tab]")],t=[...a.querySelectorAll("[data-panel]")];if(!e.length)return;const s=r=>{e.forEach(o=>o.classList.toggle("active",o.dataset.tab===r)),t.forEach(o=>{const i=o.dataset.panel===r;o.classList.toggle("active",i),o.hidden=!i})};e.forEach(r=>{r.addEventListener("click",()=>s(r.dataset.tab??"router"))})}function te(a){const e=a.querySelector("[data-carousel]");if(!e)return;const t=e.hasAttribute("data-carousel-lock"),s=[...e.querySelectorAll(".slide")],r=[...e.querySelectorAll("[data-dot]")];let o=0,i=0;const p=l=>{o=(l%s.length+s.length)%s.length,s.forEach((d,u)=>{const m=u===o;d.classList.toggle("is-on",m),d.hidden=!m}),r.forEach((d,u)=>d.classList.toggle("is-on",u===o))},n=()=>{t||(window.clearInterval(i),i=window.setInterval(()=>p(o+1),4200))};r.forEach(l=>l.addEventListener("click",()=>{p(Number(l.dataset.dot)),t||n()})),t||(e.addEventListener("mouseenter",()=>window.clearInterval(i)),e.addEventListener("mouseleave",n),new IntersectionObserver(d=>{d.some(u=>u.isIntersecting)?n():window.clearInterval(i)},{threshold:.35}).observe(e)),p(0)}const P=3.5;function se(a){var n;const e=a.querySelector("[data-launch]");if(!e||e.classList.contains("is-live"))return;const t=e.querySelector("video.launch-video"),s=e.querySelector("img.launch-gif");let r=0;const o=()=>{e.classList.contains("is-live")||(e.classList.add("is-live"),r=window.setTimeout(()=>e.classList.add("is-apogee"),P*1e3))},i=()=>e.classList.add("is-apogee","is-held");if(oe(e),!t){o(),i();return}const p=()=>{if(s){const l=s.dataset.src;l&&s.getAttribute("src")!==l&&(s.src=l),s.hidden=!1}t.remove(),o()};t.addEventListener("playing",o,{once:!0}),t.addEventListener("timeupdate",()=>{t.currentTime>=P&&(window.clearTimeout(r),e.classList.add("is-apogee"))}),t.addEventListener("ended",i,{once:!0}),t.addEventListener("error",p),(n=t.querySelector("source"))==null||n.addEventListener("error",p),window.setTimeout(()=>{e.classList.contains("is-live")||(t.play().catch(()=>{}),o(),t.paused&&i())},900)}const ae=5200;function oe(a){const e=a.querySelector("[data-glass]");if(!e)return;const t=[...e.querySelectorAll(".glass-frame img")],s=[...e.querySelectorAll("[data-glass-to]")],r=[...a.querySelectorAll(".telemetry li[data-key]")];if(!t.length)return;const o=window.matchMedia("(prefers-reduced-motion: reduce)").matches;let i=0,p=0;const n=m=>{i=(m%t.length+t.length)%t.length,t.forEach((v,y)=>v.classList.toggle("is-on",y===i)),s.forEach((v,y)=>v.classList.toggle("is-on",y===i));const g=t[i].dataset.tele;r.forEach(v=>v.classList.toggle("is-hot",v.dataset.key===g))},l=()=>window.clearInterval(p),d=()=>{l(),!o&&(p=window.setInterval(()=>n(i+1),ae))};s.forEach(m=>m.addEventListener("click",()=>{n(Number(m.dataset.glassTo)),d()})),e.addEventListener("mouseenter",l),e.addEventListener("mouseleave",d),e.addEventListener("focusin",l),e.addEventListener("focusout",d);const u=()=>a.classList.contains("is-apogee")?(n(0),window.setTimeout(d,1400),!0):!1;if(!u()){const m=new MutationObserver(()=>{u()&&m.disconnect()});m.observe(a,{attributes:!0,attributeFilter:["class"]})}}function R(){const a=document.getElementById("app");if(!a)return;const e=G();a.innerHTML=Z(I[e].draw(),e),J(a),ee(a),te(a),se(a)}function T(){const a=document.getElementById("loader");if(!a)return;if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){a.remove();return}a.classList.add("out"),window.setTimeout(()=>a.remove(),480)}const A=document.getElementById("stars");A instanceof HTMLCanvasElement&&K(A);R();window.addEventListener("hashchange",R);document.readyState==="complete"?T():window.addEventListener("load",T);
