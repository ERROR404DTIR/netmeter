(function(){
"use strict";
const BASE="https://speed.cloudflare.com",HISTORY_KEY="netmeter.history.v1";
const $=function(id){return document.getElementById(id)};
const startBtn=$("startBtn"),stopBtn=$("stopBtn"),phaseBadge=$("phaseBadge"),engineStatus=$("engineStatus");
const liveSpeed=$("liveSpeed"),liveCaption=$("liveCaption"),gaugeArc=$("gaugeArc"),progressBar=$("progressBar");
const latencyValue=$("latencyValue"),jitterValue=$("jitterValue"),uploadValue=$("uploadValue");
const chart=$("speedChart"),chartEmpty=$("chartEmpty");
let controller=null,chartPoints=[],toastTimer=null,isRunning=false;
function median(values){const s=values.slice().sort(function(a,b){return a-b});const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2}
function fmt(value,digits){return Number.isFinite(value)?value.toFixed(digits===undefined?1:digits):"—"}
function setProgress(value){const amount=Math.max(0,Math.min(100,value));progressBar.style.width=amount+"%";progressBar.parentElement.setAttribute("aria-valuenow",String(Math.round(amount)))}
function setPhase(name,caption){phaseBadge.textContent=name.toUpperCase();liveCaption.textContent=caption;engineStatus.textContent=isRunning?"TEST IN PROGRESS":"READY TO TEST"}
function setLive(value,kind){liveSpeed.textContent=fmt(value,1);gaugeArc.style.strokeDashoffset=String(100-Math.max(0,Math.min(100,value)));gaugeArc.style.stroke=kind==="upload"?"var(--amber)":"var(--mint)"}
function toast(message){const node=$("toast");node.textContent=message;node.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(function(){node.classList.remove("show")},3400)}
function addPoint(kind,value){chartPoints.push({kind:kind,value:value});if(chartPoints.length>36)chartPoints.shift();chartEmpty.hidden=chartPoints.length>0;drawChart()}
function drawChart(){
 const rect=chart.getBoundingClientRect();if(!rect.width||!rect.height)return;
 const dpr=Math.min(window.devicePixelRatio||1,2);chart.width=Math.round(rect.width*dpr);chart.height=Math.round(rect.height*dpr);
 const ctx=chart.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
 const w=rect.width,h=rect.height,left=5,right=6,top=10,bottom=17,plotH=h-top-bottom,plotW=w-left-right;
 ctx.clearRect(0,0,w,h);ctx.strokeStyle="rgba(132,159,164,.16)";ctx.lineWidth=1;
 for(let i=0;i<4;i++){const y=top+(plotH/3)*i;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke()}
 if(!chartPoints.length)return;
 const max=Math.max(10,...chartPoints.map(function(p){return p.value}))*1.15;
 function drawKind(kind,color){const pts=chartPoints.filter(function(p){return p.kind===kind});if(!pts.length)return;ctx.beginPath();pts.forEach(function(p,i){const x=left+(chartPoints.indexOf(p)/Math.max(1,chartPoints.length-1))*plotW;const y=top+plotH-(p.value/max)*plotH;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.strokeStyle=color;ctx.lineWidth=2;ctx.lineJoin="round";ctx.lineCap="round";ctx.stroke()}
 drawKind("download","#79ddca");drawKind("upload","#e9bd79");
 ctx.fillStyle="rgba(154,173,177,.8)";ctx.font="10px ui-monospace,monospace";ctx.fillText("0",left,h-2);ctx.fillText(fmt(max,0)+" Mbps",Math.max(left,w-74),h-2);
}
async function timedFetch(url,options){const t=performance.now();const response=await fetch(url,options);if(!response.ok)throw new Error("Test endpoint returned HTTP "+response.status);return {response:response,elapsed:performance.now()-t}}
async function measureLatency(signal){
 const samples=[];
 for(let i=0;i<8;i++){const url=BASE+"/__down?bytes=0&netmeter="+Date.now()+"-"+i;const r=await timedFetch(url,{method:"GET",cache:"no-store",signal:signal,mode:"cors"});await r.response.arrayBuffer();if(i>0)samples.push(r.elapsed);setProgress(5+(i+1)/8*17)}
 const latency=median(samples),diffs=[];for(let i=1;i<samples.length;i++)diffs.push(Math.abs(samples[i]-samples[i-1]));
 return {latency:latency,jitter:diffs.reduce(function(a,b){return a+b},0)/Math.max(1,diffs.length)}
}
async function measureDownload(signal){
 const sizes=[1000000,3000000,5000000],workers=2;let totalBytes=0,totalMs=0;
 for(let i=0;i<sizes.length;i++){
  const started=performance.now(),jobs=[];
  for(let j=0;j<workers;j++){const url=BASE+"/__down?bytes="+sizes[i]+"&netmeter="+Date.now()+"-"+i+"-"+j;jobs.push((async function(){const r=await timedFetch(url,{method:"GET",cache:"no-store",signal:signal,mode:"cors"});const data=await r.response.arrayBuffer();return data.byteLength})())}
  const lengths=await Promise.all(jobs),elapsed=Math.max(1,performance.now()-started),bytes=lengths.reduce(function(a,b){return a+b},0);
  totalBytes+=bytes;totalMs+=elapsed;const current=bytes*8/elapsed/1000;addPoint("download",current);setLive(current,"download");setProgress(22+(i+1)/sizes.length*43);
 }
 return totalBytes*8/Math.max(1,totalMs)/1000
}
async function measureUpload(signal){
 const sizes=[300000,800000,1600000],workers=2;let totalBytes=0,totalMs=0;
 for(let i=0;i<sizes.length;i++){
  const started=performance.now(),jobs=[];
  for(let j=0;j<workers;j++){const bytes=new Uint8Array(sizes[i]);crypto.getRandomValues(bytes.subarray(0,Math.min(bytes.length,65536)));const blob=new Blob([bytes],{type:"application/octet-stream"});const url=BASE+"/__up?netmeter="+Date.now()+"-"+i+"-"+j;jobs.push((async function(){const r=await timedFetch(url,{method:"POST",body:blob,cache:"no-store",signal:signal,mode:"cors"});await r.response.arrayBuffer();return sizes[i]})())}
  const lengths=await Promise.all(jobs),elapsed=Math.max(1,performance.now()-started),bytes=lengths.reduce(function(a,b){return a+b},0);
  totalBytes+=bytes;totalMs+=elapsed;const current=bytes*8/elapsed/1000;addPoint("upload",current);setLive(current,"upload");setProgress(65+(i+1)/sizes.length*33);
 }
 return totalBytes*8/Math.max(1,totalMs)/1000
}
function setResult(id,value,unit){$(id).innerHTML=fmt(value,1)+' <span class="metric-unit">'+unit+'</span>'}
function readHistory(){try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]")}catch(e){return []}}
function renderHistory(){
 const list=$("historyList"),items=readHistory();if(!items.length){list.innerHTML='<div class="history-empty">No saved tests yet. Your recent results will appear here.</div>';return}
 list.innerHTML=items.slice(0,5).map(function(item){const date=new Date(item.at),label=date.toLocaleDateString(undefined,{month:"short",day:"numeric"})+" · "+date.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"});return '<div class="history-item"><span class="history-date">'+label+'</span><span class="history-speeds">'+fmt(item.down,1)+' ↓ <span>'+fmt(item.up,1)+' ↑</span></span><span class="history-latency">'+fmt(item.latency,0)+' ms</span></div>'}).join("")
}
function saveResult(result){const items=readHistory();items.unshift(result);localStorage.setItem(HISTORY_KEY,JSON.stringify(items.slice(0,10)));renderHistory();$("lastDownload").textContent=fmt(result.down,1)+" Mbps";$("lastUpload").textContent=Number.isFinite(result.up)?fmt(result.up,1)+" Mbps":"Unavailable";$("lastLatency").textContent=fmt(result.latency,0)+" ms";$("lastTime").textContent=new Date(result.at).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})}
async function runTest(){
 if(isRunning)return;isRunning=true;controller=new AbortController();const signal=controller.signal;chartPoints=[];drawChart();chartEmpty.hidden=false;setProgress(0);setLive(0,"download");
 latencyValue.innerHTML='— <span class="metric-unit">ms</span>';jitterValue.innerHTML='— <span class="metric-unit">ms</span>';uploadValue.innerHTML='— <span class="metric-unit">Mbps</span>';
 startBtn.hidden=true;stopBtn.hidden=false;setPhase("Latency","Measuring response time");
 const result={at:new Date().toISOString(),latency:NaN,jitter:NaN,down:NaN,up:NaN};
 try{
  const ping=await measureLatency(signal);result.latency=ping.latency;result.jitter=ping.jitter;setResult("latencyValue",ping.latency,"ms");setResult("jitterValue",ping.jitter,"ms");
  setPhase("Download","Measuring download throughput");result.down=await measureDownload(signal);
  setPhase("Upload","Measuring upload throughput");
  try{result.up=await measureUpload(signal);setResult("uploadValue",result.up,"Mbps")}catch(uploadError){if(signal.aborted)throw uploadError;uploadValue.innerHTML='— <span class="metric-unit">blocked</span>';toast("Upload test was blocked by the network or browser.")}
  setProgress(100);setPhase("Complete","Test finished");setLive(result.down,"download");saveResult(result);toast("Speed test completed.")
 }catch(error){if(signal.aborted){setPhase("Stopped","Test stopped");toast("Test stopped.")}else{setPhase("Test error","Could not complete the test");toast("Test failed: "+(error&&error.message?error.message:"network error"));liveCaption.textContent="Check your connection and try again."}}
 finally{isRunning=false;controller=null;startBtn.hidden=false;stopBtn.hidden=true;startBtn.innerHTML='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 5 10 7-10 7V5Z" fill="currentColor"/></svg>Run again';engineStatus.textContent="READY TO TEST"}
}
function updateConnection(){
 const c=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
 $("connectionType").textContent=c?(c.type||c.effectiveType||"Available"):"Not exposed";
 $("connectionDown").textContent=c&&Number.isFinite(c.downlink)?c.downlink+" Mbps":"Not exposed";
 $("connectionRtt").textContent=c&&Number.isFinite(c.rtt)?c.rtt+" ms":"Not exposed";
 $("onlineStatus").textContent=navigator.onLine?"Online":"Offline";$("onlineStatus").classList.toggle("accent",navigator.onLine)
}
startBtn.addEventListener("click",runTest);stopBtn.addEventListener("click",function(){if(controller)controller.abort()});
$("clearHistory").addEventListener("click",function(){localStorage.removeItem(HISTORY_KEY);renderHistory();$("lastDownload").textContent="—";$("lastUpload").textContent="—";$("lastLatency").textContent="—";$("lastTime").textContent="No test yet";toast("Local test history cleared.")});
window.addEventListener("resize",drawChart);window.addEventListener("online",updateConnection);window.addEventListener("offline",updateConnection);
if(navigator.connection&&navigator.connection.addEventListener)navigator.connection.addEventListener("change",updateConnection);
updateConnection();renderHistory();
})();