"use strict";
const SITE_KEYS=["chatgpt","grok","claude","discord","slack"];
function $(id){const el=document.getElementById(id);if(!el)throw new Error("missing #"+id);return el}
async function getJSON(path){const r=await fetch(path);if(!r.ok)throw new Error(path+" "+r.status);return r.json()}
async function postJSON(path,body){const r=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body??{})});if(!r.ok){let extra="";try{const j=await r.json();extra=j.error?": "+j.error:""}catch{}throw new Error(path+" "+r.status+extra)}return r.json()}
function renderStatus(s,d){$("st-state").textContent=s.state;$("st-theme").textContent=s.theme;const gs=d.ghostty.installed?(d.ghostty.default?"default":"installed / not default"):"missing";$("st-ghostty").textContent=[gs,d.ghostty.version].filter(Boolean).join(" · ");$("st-launcher").textContent=d.launcher.name+" · "+d.launcher.keybind;$("st-gost").textContent=(s.gost.enabled?"enabled":"off")+" / "+(s.gost.running?"running":"stopped");$("st-clis").textContent=[s.clis.installed,s.clis.preexisting].filter(Boolean).join(" ")||"—";$("st-api").textContent=s.api.listen;$("st-api-public").textContent=s.api.api_public?"public":"loopback";$("st-ui-public").textContent=s.api.ui_public?"public":"loopback";const p=$("pill");p.textContent=s.state;p.className="pill "+(s.state==="applied"?"on":"off")}
function renderDefaults(d){$("default-ai").value=d.default_ai_chat;SITE_KEYS.forEach(k=>{$("site-"+k).value=d.sites[k]||""});const list=$("shortcuts");list.textContent="";const entries=[["Super+Space","launcher"],["MaxQ AI Chat",d.sites[d.default_ai_chat]||d.default_ai_chat],["ChatGPT",d.sites.chatgpt],["Grok",d.sites.grok],["Claude",d.sites.claude],["Discord",d.sites.discord],["Slack",d.sites.slack],["Ghostty","$HOME/bin/ghostty"],["MaxQ Settings","127.0.0.1:7432"]];for(const [name,target] of entries){const li=document.createElement("li"),r=document.createElement("span");r.textContent=target||"—";li.append(document.createTextNode(name),r);list.appendChild(li)}}
function renderPackages(items){const list=$("packages");list.textContent="";for(const p of items){const li=document.createElement("li"),r=document.createElement("span");r.textContent=[p.version,p.source,p.path].filter(Boolean).join(" · ");li.append(document.createTextNode(p.name),r);list.appendChild(li)}if(!items.length){const li=document.createElement("li");li.textContent="No SBOM entries yet";list.appendChild(li)}}

function viewerURL(d){const host=location.hostname||"127.0.0.1";return `http://${host}:${d.http}/vnc.html?autoconnect=true&resize=scale`}
function renderDesktops(items){const list=$("desktops");list.textContent="";if(!items.length){const li=document.createElement("li");li.textContent="No Xvfb sessions";list.appendChild(li);return}for(const d of items){const li=document.createElement("li");if(d.current)li.classList.add("current");const meta=document.createElement("span");meta.textContent=[d.live?"live":"token",":"+d.http,d.token?"token "+d.token:""].filter(Boolean).join(" · ");const btn=document.createElement("button");btn.type="button";btn.textContent=d.current?"this desktop":"view";btn.addEventListener("click",()=>{[...list.children].forEach(el=>el.classList.remove("active"));li.classList.add("active");const frame=$("desktop-view");frame.hidden=false;frame.src=viewerURL(d)});li.append(document.createTextNode(d.display+(d.current?" · current":"")),meta,btn);list.appendChild(li)}}
function readDefaults(){const sites={};SITE_KEYS.forEach(k=>sites[k]=$("site-"+k).value.trim());return{default_ai_chat:$("default-ai").value,sites}}
function msg(text,ok=false){const e=$("msg");e.hidden=!text;e.textContent=text;e.style.color=ok?"var(--green)":"var(--red)"}
function authMsg(text,ok=false){const e=$("auth-msg");e.hidden=!text;e.textContent=text;e.style.color=ok?"var(--green)":"var(--red)"}
function renderAuth(a){
  $("st-auth").textContent=a.operator_auth?"ON — glass locked":"OFF — glass open";
  $("st-auth-hash").textContent=a.has_hash?"set (bcrypt file)":"not set";
  const on=$("btn-auth-on"), off=$("btn-auth-off");
  on.disabled=!a.has_hash||!!a.operator_auth;
  on.title=a.operator_auth?"Already enabled":(a.has_hash?"DANGER: locks EVA :7432":"Set a password hash first");
  off.disabled=!a.operator_auth;
  off.title=a.operator_auth?"Turn wall off (opens glass)":"Auth already off";
}
async function refreshAuth(){const a=await getJSON("/api/auth/status");renderAuth(a);return a}
async function refresh(){const [s,d,defs,sbom]=await Promise.all([getJSON("/status"),getJSON("/desktop"),getJSON("/defaults"),getJSON("/sbom")]);renderStatus(s,d);renderDefaults(defs);renderPackages(sbom);try{await refreshAuth()}catch(e){authMsg(e instanceof Error?e.message:String(e))}}
function busy(on){["btn-apply","btn-revert","btn-proxy-on","btn-proxy-off","btn-save-defaults","btn-api-public-on","btn-api-public-off","btn-ui-public-on","btn-ui-public-off","btn-set-password"].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=on})}
async function act(fn,success=""){msg("");busy(true);try{await fn();await refresh();if(success)msg(success,true)}catch(e){msg(e instanceof Error?e.message:String(e))}finally{busy(false)}}
async function authAct(fn,success=""){authMsg("");try{await fn();await refreshAuth();if(success)authMsg(success,true)}catch(e){authMsg(e instanceof Error?e.message:String(e))}}
window.addEventListener("DOMContentLoaded",()=>{
  $("btn-apply").addEventListener("click",()=>act(()=>postJSON("/apply",{})));
  $("btn-revert").addEventListener("click",()=>act(()=>postJSON("/revert",{})));
  $("btn-proxy-on").addEventListener("click",()=>act(()=>postJSON("/proxy",{enabled:true})));
  $("btn-proxy-off").addEventListener("click",()=>act(()=>postJSON("/proxy",{enabled:false})));
  $("btn-api-public-on").addEventListener("click",()=>act(()=>postJSON("/bind",{api_public:true})));
  $("btn-api-public-off").addEventListener("click",()=>act(()=>postJSON("/bind",{api_public:false})));
  $("btn-ui-public-on").addEventListener("click",()=>act(()=>postJSON("/bind",{ui_public:true})));
  $("btn-ui-public-off").addEventListener("click",()=>act(()=>postJSON("/bind",{ui_public:false})));
  $("defaults-form").addEventListener("submit",e=>{e.preventDefault();act(()=>postJSON("/defaults",readDefaults()),"defaults saved")});
  $("auth-password-form").addEventListener("submit",e=>{
    e.preventDefault();
    const password=$("auth-password").value;
    const current_password=$("auth-current").value;
    authAct(async()=>{
      await postJSON("/api/auth/set-password",{password,current_password});
      $("auth-password").value="";
      $("auth-current").value="";
    },"password hash stored (0600); auth still OFF until you Enable");
  });
  $("btn-auth-on").addEventListener("click",()=>{
    if(!confirm("DANGER: Enable operator_auth? This LOCKS EVA :7432. Unauthenticated callers get 401 /login redirect. Only continue if you intend to lock the glass."))return;
    const password=$("auth-current").value;
    authAct(()=>postJSON("/api/auth/operator",{enabled:true,password}),"operator_auth ENABLED — glass locked");
  });
  $("btn-auth-off").addEventListener("click",()=>{
    const password=$("auth-current").value||$("auth-password").value;
    authAct(()=>postJSON("/api/auth/operator",{enabled:false,password}),"operator_auth disabled — glass open");
  });
  refresh().catch(e=>msg(e instanceof Error?e.message:String(e)))
})
