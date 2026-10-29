/* Sổ Học Điện Tử — nền tảng chạy độc lập (không cần Claude.ai)
   Cung cấp cùng giao diện như runtime của artifact:
   db (IndexedDB trên máy), user, sample (Claude API bằng API key của bạn),
   mcp (Google Calendar qua đăng nhập Google), assets, downloads, permissions. */
(function(){
"use strict";
const CFG=Object.assign({googleClientId:"",provider:"gemini",geminiModel:"gemini-3.8-flash",geminiQuickModel:"gemini-3.5-flash-lite",defaultModel:"claude-sonnet-5-5",quickModel:"claude-haiku-5-5"},window.SOHOC_CONFIG||{});
const LS={get(k,d){try{const v=localStorage.getItem("sohoc:"+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem("sohoc:"+k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem("sohoc:"+k)}catch(e){}}};
const err=(code,msg,extra)=>Object.assign(new Error(msg||code),{code},extra||{});

/* ---------------- IndexedDB ---------------- */
let DBP=null;
function getDB(){return DBP||(DBP=new Promise((res,rej)=>{if(!("indexedDB" in window))return rej(new Error("no idb"));const r=indexedDB.open("sohoc",1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains("docs"))d.createObjectStore("docs");if(!d.objectStoreNames.contains("assets"))d.createObjectStore("assets")};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);r.onblocked=()=>rej(new Error("blocked"))}))}
function idbReq(store,mode,fn){return getDB().then(d=>new Promise((res,rej)=>{const t=d.transaction(store,mode);let out;const rq=fn(t.objectStore(store));if(rq)rq.onsuccess=()=>{out=rq.result};t.oncomplete=()=>res(out);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)}))}
const docs=new Map();let loaded=null,useLS=false;
function load(){return loaded||(loaded=(async()=>{
  try{await getDB();await new Promise((res,rej)=>{getDB().then(d=>{const rq=d.transaction("docs").objectStore("docs").openCursor();rq.onsuccess=()=>{const c=rq.result;if(c){docs.set(c.key,c.value);c.continue()}else res()};rq.onerror=()=>rej(rq.error)})})}
  catch(e){console.warn("IndexedDB không khả dụng, dùng localStorage",e);useLS=true;const raw=LS.get("docs",null);if(raw)Object.entries(raw).forEach(([k,v])=>docs.set(k,v))}
  try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}})())}
let _lsT=0;
function persist(id){if(useLS){clearTimeout(_lsT);_lsT=setTimeout(()=>LS.set("docs",Object.fromEntries(docs)),300);return}
  const v=docs.get(id);idbReq("docs","readwrite",s=>v===undefined?s.delete(id):s.put(v,id)).catch(e=>{console.warn(e);if(e&&e.name==="QuotaExceededError")alert("Bộ nhớ trình duyệt đã đầy. Hãy xóa bớt tài liệu hoặc sao lưu rồi dọn dữ liệu.")});
  try{bc&&bc.postMessage({id})}catch(e){}}
const subs=new Set();let emitT=0;const emit=()=>{if(emitT)return;emitT=setTimeout(()=>{emitT=0;subs.forEach(f=>f())},0)};
const clone=v=>v==null?v:(typeof structuredClone==="function"?structuredClone(v):JSON.parse(JSON.stringify(v)));
const clean=v=>JSON.parse(JSON.stringify(v));
/* đồng bộ giữa các thẻ trình duyệt đang mở cùng trang */
let bc=null;try{bc=new BroadcastChannel("sohoc");bc.onmessage=async e=>{const id=e.data&&e.data.id;if(!id)return;try{const v=await idbReq("docs","readonly",s=>s.get(id));if(v===undefined)docs.delete(id);else docs.set(id,v);emit()}catch(_){}}}catch(e){}
function Q(filters){return{
  where(f,op,v){return Q([...filters,[f,op,v]])},
  _m(){const out=[];docs.forEach((d,id)=>{if(filters.every(([f,op,v])=>op==="=="?d[f]===v:op==="in"?v.includes(d[f]):true))out.push({id,exists:true,data:()=>clone(d)})});return out},
  async get(){await load();return{docs:this._m()}},
  onSnapshot(cb){let live=true;const run=()=>{if(!live)return;try{cb({docs:this._m()})}catch(e){console.error(e)}};subs.add(run);load().then(run);return()=>{live=false;subs.delete(run)}},
  doc(id){return{
    async set(v){await load();docs.set(id,clean(v));persist(id);emit()},
    async update(v){await load();if(!docs.has(id))throw err("not-found","Không tìm thấy dữ liệu "+id);docs.set(id,{...docs.get(id),...clean(v)});persist(id);emit()},
    async delete(){await load();docs.delete(id);persist(id);emit()},
    async get(){await load();const d=docs.get(id);return d?{exists:true,data:()=>clone(d)}:{exists:false,data:()=>undefined}}}}}}
const db={collection:()=>Q([])};

/* ---------------- tệp đính kèm (PDF, ảnh…) ---------------- */
const blobURL=new Map();
async function assetBlob(id){try{return await idbReq("assets","readonly",s=>s.get(id))}catch(e){return null}}
const assets={
  async upload(blob){const id="a"+Date.now().toString(36)+Math.random().toString(36).slice(2,7);await idbReq("assets","readwrite",s=>s.put(blob,id));return{id,url:"asset:"+id}},
  async delete(id){await idbReq("assets","readwrite",s=>s.delete(id)).catch(()=>{});const u=blobURL.get(id);if(u){URL.revokeObjectURL(u);blobURL.delete(id)}}};
const _fetch=window.fetch.bind(window);
window.fetch=async function(u,o){const s=typeof u==="string"?u:u&&u.url;if(s&&s.startsWith("asset:")){const b=await assetBlob(s.slice(6));return b?new Response(b,{headers:{"content-type":b.type||"application/octet-stream"}}):new Response(null,{status:404})}return _fetch(u,o)};
document.addEventListener("click",async e=>{const a=e.target.closest&&e.target.closest('a[href^="asset:"]');if(!a)return;e.preventDefault();const id=a.getAttribute("href").slice(6);let u=blobURL.get(id);if(!u){const b=await assetBlob(id);if(!b)return;u=URL.createObjectURL(b);blobURL.set(id,u)}window.open(u,"_blank","noopener")},true);

/* ---------------- tải tệp về máy ---------------- */
const downloads={async save({filename,data}){const b=data instanceof Blob?data:new Blob([data]);const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=filename||"tep";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000)}};

/* ---------------- người dùng ---------------- */
let uid=LS.get("uid",null);if(!uid){uid="u"+Date.now().toString(36)+Math.random().toString(36).slice(2,8);LS.set("uid",uid)}
const user={async id(){return uid},async me(){return LS.get("me",{name:"",avatarUrl:""})}};

/* ---------------- Trợ lý AI: Google Gemini (AI Studio) hoặc Claude — API key của bạn, lưu trên máy này ---------------- */
const provider=()=>LS.get("provider",CFG.provider||"gemini")==="claude"?"claude":"gemini";
const apiKey=(pv=provider())=>pv==="claude"?LS.get("apiKey",""):LS.get("geminiKey","");
const model=(tier,pv=provider())=>pv==="claude"?(tier==="quick"?LS.get("quickModel",CFG.quickModel):LS.get("model",CFG.defaultModel)):(tier==="quick"?LS.get("gQuickModel",CFG.geminiQuickModel):LS.get("gModel",CFG.geminiModel));
async function blobToB64(b){let blob=b;try{const bmp=await createImageBitmap(b);const k=Math.min(1,1568/Math.max(bmp.width,bmp.height));if(k<1||b.size>3.5e6||!/png|jpeg|webp|gif/.test(b.type)){const c=document.createElement("canvas");c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);blob=await new Promise(r=>c.toBlob(r,"image/jpeg",.88))}}catch(e){}
  const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(",")[1]);r.onerror=rej;r.readAsDataURL(blob)});return{mime:blob.type||"image/jpeg",data}}
function toMessages(input){return typeof input==="string"?[{role:"user",content:input}]:input.map(t=>({role:t.role==="assistant"?"assistant":"user",content:String(t.content||"")}))}
async function sse(r,onEvent){const rd=r.body.getReader(),dec=new TextDecoder();let buf="";for(;;){const {value,done}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true}).replace(/\r/g,"");let i;
  while((i=buf.indexOf("\n\n"))>=0){const chunk=buf.slice(0,i);buf=buf.slice(i+2);const data=chunk.split("\n").filter(l=>l.startsWith("data:")).map(l=>l.slice(5).trim()).join("");if(!data||data==="[DONE]")continue;let ev;try{ev=JSON.parse(data)}catch(e){continue}onEvent(ev)}}
  if(buf.trim().startsWith("data:")){try{onEvent(JSON.parse(buf.trim().slice(5)))}catch(e){}}}
async function callClaude(input,o){
  const key=apiKey("claude");if(!key)throw err("not_granted","Chưa có API key Claude");
  const messages=toMessages(input);
  if(o.images&&o.images.length){const first=messages.findIndex(m=>m.role==="user");const blocks=[];for(const b of o.images.slice(0,4)){const x=await blobToB64(b);blocks.push({type:"image",source:{type:"base64",media_type:x.mime,data:x.data}})}messages[first]={role:"user",content:[...blocks,{type:"text",text:messages[first].content}]}}
  let r;try{r=await _fetch("https://api.anthropic.com/v1/messages",{method:"POST",signal:o.signal,headers:{"content-type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:model(o.modelTier,"claude"),max_tokens:o.max||8000,messages,stream:true})})}
  catch(e){if(e&&e.name==="AbortError")throw err("cancelled","Đã dừng");throw err("network","Không kết nối được tới Claude API")}
  if(!r.ok){let j={};try{j=await r.json()}catch(e){}const m=(j.error&&j.error.message)||r.statusText||("HTTP "+r.status);
    const code=r.status===401||r.status===403?"bad_key":r.status===429||r.status===529?"rate_limited":r.status===413||/too long|too many tokens|exceed/i.test(m)?"prompt_too_large":/model/i.test(m)&&r.status===404?"bad_model":"api_error";throw err(code,m)}
  let text="",stop=null;
  try{await sse(r,ev=>{if(ev.type==="content_block_delta"&&ev.delta&&ev.delta.type==="text_delta"){text+=ev.delta.text;if(o.onText)o.onText({text})}else if(ev.type==="message_delta"&&ev.delta&&ev.delta.stop_reason)stop=ev.delta.stop_reason;else if(ev.type==="error")throw err(ev.error&&ev.error.type==="overloaded_error"?"rate_limited":"api_error",(ev.error&&ev.error.message)||"Lỗi luồng dữ liệu",{text})})}
  catch(e){if(e&&e.name==="AbortError")throw err("cancelled","Đã dừng",{text});throw e}
  return{text,truncated:stop==="max_tokens"}}
const GEM="https://generativelanguage.googleapis.com/v1beta";
function gemErr(status,j){const e=j&&j.error||{};const m=e.message||("HTTP "+status);const st=e.status||"";
  if(status===429||st==="RESOURCE_EXHAUSTED")return err("rate_limited",m);if(/API key not valid|API_KEY_INVALID|invalid api key/i.test(m)||status===401||st==="UNAUTHENTICATED")return err("bad_key",m);if(status===403||st==="PERMISSION_DENIED")return err("bad_key",m);
  if(status===404||/not found|is not supported/i.test(m))return err("bad_model",m);if(/token|too long|exceeds/i.test(m)&&status===400)return err("prompt_too_large",m);if(status===503||status===500||st==="UNAVAILABLE")return err("rate_limited",m);return err("api_error",m)}
async function callGemini(input,o){
  const key=apiKey("gemini");if(!key)throw err("not_granted","Chưa có API key Google AI Studio");
  const msgs=toMessages(input);const contents=[];msgs.forEach(m=>{const role=m.role==="assistant"?"model":"user";const last=contents[contents.length-1];if(last&&last.role===role)last.parts.push({text:m.content});else contents.push({role,parts:[{text:m.content}]})});
  if(contents.length&&contents[0].role!=="user")contents.unshift({role:"user",parts:[{text:"(bắt đầu)"}]});
  if(o.images&&o.images.length){const first=contents.findIndex(c=>c.role==="user");const parts=[];for(const b of o.images.slice(0,6)){const x=await blobToB64(b);parts.push({inline_data:{mime_type:x.mime,data:x.data}})}contents[first].parts=[...parts,...contents[first].parts]}
  const gc={maxOutputTokens:o.max||16384};if(o.json)gc.responseMimeType="application/json";
  let r;try{r=await _fetch(`${GEM}/models/${encodeURIComponent(model(o.modelTier,"gemini"))}:streamGenerateContent?alt=sse`,{method:"POST",signal:o.signal,headers:{"content-type":"application/json","x-goog-api-key":key},body:JSON.stringify({contents,generationConfig:gc})})}
  catch(e){if(e&&e.name==="AbortError")throw err("cancelled","Đã dừng");throw err("network","Không kết nối được tới Google AI Studio")}
  if(!r.ok){let j={};try{j=await r.json()}catch(e){}if(Array.isArray(j))j=j[0]||{};throw gemErr(r.status,j)}
  let text="",stop=null,blocked=null;
  try{await sse(r,ev=>{if(ev.error)throw gemErr(ev.error.code||500,ev);if(ev.promptFeedback&&ev.promptFeedback.blockReason)blocked=ev.promptFeedback.blockReason;const c=(ev.candidates||[])[0];if(!c)return;
      const parts=(c.content&&c.content.parts)||[];const add=parts.filter(p=>p.text&&!p.thought).map(p=>p.text).join("");if(add){text+=add;if(o.onText)o.onText({text})}if(c.finishReason&&c.finishReason!=="FINISH_REASON_UNSPECIFIED")stop=c.finishReason})}
  catch(e){if(e&&e.name==="AbortError")throw err("cancelled","Đã dừng",{text});throw e}
  if(!text&&(blocked||stop==="SAFETY"||stop==="PROHIBITED_CONTENT"))throw err("refused","Gemini từ chối trả lời nội dung này ("+(blocked||stop)+")");
  return{text,truncated:stop==="MAX_TOKENS"}}
async function listGeminiModels(key){const r=await _fetch(`${GEM}/models?pageSize=200`,{headers:{"x-goog-api-key":key||apiKey("gemini")}});const j=await r.json().catch(()=>({}));if(!r.ok)throw gemErr(r.status,j);
  return (j.models||[]).filter(m=>(m.supportedGenerationMethods||[]).includes("generateContent")&&/gemini/i.test(m.name)&&!/embedding|image|tts|live|audio|robotics/i.test(m.name)).map(m=>({id:m.name.replace(/^models\//,""),name:m.displayName||m.name}))}
const call=(input,o={})=>provider()==="claude"?callClaude(input,o):callGemini(input,o);
function parseJSON(t){let s=String(t||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/,"");try{return JSON.parse(s)}catch(e){}const a=s.indexOf("{"),b=s.lastIndexOf("}");if(a>=0&&b>a){try{return JSON.parse(s.slice(a,b+1))}catch(e){}}throw err("invalid_json","AI trả về sai định dạng")}
const sample=(input,o)=>call(input,o||{});
sample.json=async(prompt,o={})=>{const r=await call(prompt+"\n\nCHỈ trả lời bằng đúng một đối tượng JSON hợp lệ, không có chữ hay ``` nào khác.",{...o,json:true,max:provider()==="claude"?16000:32768});return parseJSON(r.text)};

/* ---------------- Google: đăng nhập + Google Calendar ---------------- */
const GC="Google Calendar";const SCOPES="openid email profile https://www.googleapis.com/auth/calendar.events";
const clientId=()=>LS.get("googleClientId","")||CFG.googleClientId||"";
let tok=LS.get("gtok",null);
const tokOk=()=>tok&&tok.exp>Date.now()+60000;
function loadGIS(){return window.google&&google.accounts&&google.accounts.oauth2?Promise.resolve():new Promise((res,rej)=>{const s=document.createElement("script");s.src="https://accounts.google.com/gsi/client";s.async=true;s.onload=()=>res();s.onerror=()=>rej(err("network","Không tải được dịch vụ đăng nhập Google"));document.head.appendChild(s)})}
async function getToken(interactive){if(tokOk())return tok.t;const cid=clientId();if(!cid)throw err("no_client","Chưa cấu hình Google Client ID");if(!interactive)throw err("needs_reauth","Cần đăng nhập Google lại");
  await loadGIS();return new Promise((res,rej)=>{const c=google.accounts.oauth2.initTokenClient({client_id:cid,scope:SCOPES,callback:async r=>{if(r.error){rej(err(r.error==="access_denied"?"approval_required":"auth_error",r.error_description||r.error));return}
      tok={t:r.access_token,exp:Date.now()+(+r.expires_in||3600)*1000};LS.set("gtok",tok);LS.set("gLinked",true);
      try{const u=await _fetch("https://www.googleapis.com/oauth2/v3/userinfo",{headers:{Authorization:"Bearer "+tok.t}}).then(x=>x.json());LS.set("me",{name:u.name||u.given_name||"",avatarUrl:u.picture||""});window.dispatchEvent(new CustomEvent("sohoc:me"))}catch(e){}
      res(tok.t)},error_callback:e=>rej(err(e&&e.type==="popup_closed"?"popup_closed":"auth_error",e&&e.message||"Đăng nhập Google bị hủy"))});c.requestAccessToken({prompt:LS.get("gLinked",false)?"":"consent"})})}
async function gapi(url,opt={},retry=true){const t=await getToken(false);const r=await _fetch(url,{...opt,headers:{...(opt.headers||{}),Authorization:"Bearer "+t,"content-type":"application/json"}});
  if(r.status===401){tok=null;LS.del("gtok");throw err("needs_reauth","Phiên Google hết hạn")}
  const j=await r.json().catch(()=>({}));if(!r.ok)throw err("tool_error",(j.error&&j.error.message)||("HTTP "+r.status));return j}
const iso=s=>{const d=new Date(s);return isNaN(d)?s:d.toISOString()};
const mcp={
  async listTools(){if(!clientId())return{servers:[]};return{servers:[{server:GC,tools:["list_events","create_event"],authStatus:tokOk()?"ok":"needs_reauth"}]}},
  async describeTool(){return{}},
  async callTool(server,tool,a={}){if(server!==GC)throw err("server_not_connected");
    if(tool==="list_events"){const p=new URLSearchParams({singleEvents:"true",orderBy:"startTime",maxResults:String(Math.min(250,a.pageSize||100))});if(a.startTime)p.set("timeMin",iso(a.startTime));if(a.endTime)p.set("timeMax",iso(a.endTime));
      const j=await gapi("https://www.googleapis.com/calendar/v3/calendars/primary/events?"+p);return{payload:{events:j.items||[]}}}
    if(tool==="create_event"){const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;const body={summary:a.summary,description:a.description||"",start:{dateTime:iso(a.startTime),timeZone:tz},end:{dateTime:iso(a.endTime),timeZone:tz},reminders:{useDefault:a.useDefaultReminders!==false}};
      const j=await gapi("https://www.googleapis.com/calendar/v3/calendars/primary/events",{method:"POST",body:JSON.stringify(body)});return{payload:j}}
    throw err("tool_error","Công cụ không hỗ trợ: "+tool)}};
const permissions={async request(list){if((list||[]).some(x=>String(x).startsWith("mcp:")))await getToken(true);return true}};

/* ---------------- sao lưu / khôi phục / dọn dữ liệu ---------------- */
const b64=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(b)});
window.SOHOC={CFG,LS,getToken:()=>getToken(true),signOut(){const t=tok&&tok.t;tok=null;LS.del("gtok");LS.del("gLinked");LS.set("me",{name:"",avatarUrl:""});try{if(t&&window.google&&google.accounts.oauth2)google.accounts.oauth2.revoke(t,()=>{})}catch(e){}window.dispatchEvent(new CustomEvent("sohoc:me"))},
  hasKey:()=>!!apiKey(),provider,model,listGeminiModels,clientId,
  async exportAll(){await load();const out={app:"so-hoc-dien-tu",v:1,exported:new Date().toISOString(),docs:Object.fromEntries(docs),assets:{}};
    try{const d=await getDB();await new Promise((res,rej)=>{const rq=d.transaction("assets").objectStore("assets").openCursor();const pend=[];rq.onsuccess=()=>{const c=rq.result;if(c){pend.push(b64(c.value).then(u=>{out.assets[c.key]=u}));c.continue()}else Promise.all(pend).then(res,rej)};rq.onerror=()=>rej(rq.error)})}catch(e){}
    return new Blob([JSON.stringify(out)],{type:"application/json"})},
  async importAll(file){const j=JSON.parse(await file.text());if(!j||j.app!=="so-hoc-dien-tu"||!j.docs)throw new Error("Tệp sao lưu không hợp lệ");await load();
    for(const [id,v] of Object.entries(j.docs)){docs.set(id,v);persist(id)}
    for(const [id,u] of Object.entries(j.assets||{})){const b=await (await _fetch(u)).blob();await idbReq("assets","readwrite",s=>s.put(b,id))}emit();return Object.keys(j.docs).length},
  async clearAll(){docs.clear();try{await idbReq("docs","readwrite",s=>s.clear());await idbReq("assets","readwrite",s=>s.clear())}catch(e){}LS.del("docs");emit()},
  async usage(){try{const e=await navigator.storage.estimate();return e}catch(e){return null}}};

window.claude={use:async name=>({db,user,sample,mcp,assets,downloads,permissions})[name]||Promise.reject(err("unavailable"))};
load();
})();
