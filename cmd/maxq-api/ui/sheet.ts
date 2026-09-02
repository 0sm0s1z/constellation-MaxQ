// MaxQ thin settings sheet source (no framework). sheet.js is the deployed build.
type Status = {state:string;theme:string;api:{listen:string};gost:{enabled:boolean;running:boolean;listen:string};firewall:{note:string};vault:{note:string};oauth:{note:string};skills:{note:string}};
type Resources = {memory:{total_bytes:number;available_bytes:number;used_bytes:number;used_percent:number};cpu:{used_percent:number;cores:number;load1:number};agent_display:string;agent_profile:string;chrome:Array<{display:string;profile:string;rss_bytes:number;pids:number[];current_agent:boolean}>};
type Trigger = {id:string;kind:"schedule"|"probe";spec:string;enabled:boolean;last_fire?:string};

const byId=(id:string):HTMLElement=>{const el=document.getElementById(id);if(!el)throw new Error(`missing #${id}`);return el};
async function getJSON<T>(path:string):Promise<T>{const r=await fetch(path);if(!r.ok)throw new Error(`${path} ${r.status}`);return r.json() as Promise<T>}
async function postJSON<T>(path:string,body:unknown):Promise<T>{const r=await fetch(path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body??{})});if(!r.ok){let extra="";try{const j=await r.json() as {error?:string};extra=j.error?`: ${j.error}`:""}catch{}throw new Error(`${path} ${r.status}${extra}`)}return r.json() as Promise<T>}

// Keep behavior in sync with sheet.js: section nav; status/apply/revert/proxy;
// resources with current-agent-only Chrome trim/restart; and trigger/webhook CRUD.
// This source file is intentionally terse because runtime remains plain JS.
export type {Status,Resources,Trigger};
void byId;void getJSON;void postJSON;
