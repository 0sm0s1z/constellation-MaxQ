"use strict";

const stubMeta={
  "/processes":["Processes","Inspect running processes and stop what should not be running."],
  "/files":["Files","Move files into and out of the bot box."],
  "/sessions":["Sessions","Manage OAuth and computer-use logins. Sessions are not secrets."],
  "/handoff":["Handoff","Securely hand an authentication step back to the operator."],
  "/vault":["Vault","Manage credentials and bot secrets."],
  "/ai":["AI defaults","Set primary, secondary, and tertiary browser, search, and chat services."],
  "/skills":["Skills","Manage the shared skill catalog and pre-appended prompt context."],
};
function setIf(id,value){const el=document.getElementById(id);if(el)el.textContent=value}
function proof(status){setIf("proof-state",`state=${status.state||"—"}`);setIf("proof-intercept",`intercept=${status.gost?.intercept?"true":"false"}`);setIf("proof-scope",status.scope||"$HOME only");setIf("proof-prove",`prove ${status.prove||"—"}`);document.getElementById("proof-state")?.classList.toggle("good",status.state==="applied");document.getElementById("proof-prove")?.classList.toggle("good",status.prove==="PASS")}
async function loadShell(){const chip=document.getElementById("connection-chip");try{const r=await fetch("/status",{cache:"no-store"});if(!r.ok)throw new Error(String(r.status));const s=await r.json();if(chip){chip.textContent="connected";chip.className="connection-chip connected"}proof(s);setIf("box-footer",`${s.state||"—"} · prove ${s.prove||"—"}`);return s}catch(e){if(chip){chip.textContent="offline";chip.className="connection-chip offline"}return null}}
async function loadLauncherDesktops(){const el=document.getElementById("desktops-footer");if(!el)return;try{const r=await fetch("/desktops",{headers:{Accept:"application/json"},cache:"no-store"});if(!r.ok)throw new Error(String(r.status));const d=await r.json();const current=d.desktops?.find(x=>x.current);el.textContent=`${d.system?.live_count??0} live · current ${current?":"+current.number:"—"}`}catch{el.textContent="desktop service unavailable"}}
function hydrateStub(){const meta=stubMeta[window.location.pathname];if(!meta)return;setIf("stub-title",meta[0]);setIf("stub-copy",meta[1]);setIf("breadcrumb-page",meta[0].toUpperCase());document.title=`MaxQ · ${meta[0]}`}
window.addEventListener("DOMContentLoaded",()=>{hydrateStub();loadShell();loadLauncherDesktops()});
