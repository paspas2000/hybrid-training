'use strict';
(() => {
 const ids=()=>Hybrid.sections.map(s=>s.id),limit=86400000;
 const stamp=value=>{if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw Error('Некорректное время секундомера.');return new Date(value).toISOString()};
 function validate(value,completed=false){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(id=>!ids().includes(id)))throw Error('Некорректное время блоков.');
  const out={};let running=0;
  for(const [id,raw] of Object.entries(value)){
   if(!raw||typeof raw!=='object'||Array.isArray(raw)||typeof raw.elapsedSec!=='number'||!Number.isFinite(raw.elapsedSec)||raw.elapsedSec<0||raw.elapsedSec>limit)throw Error('Некорректная длительность блока.');
   const clean={elapsedSec:raw.elapsedSec};for(const key of ['firstStartedAt','startedAt','stoppedAt'])if(raw[key]!==undefined)clean[key]=stamp(raw[key]);
   if(clean.startedAt){running++;if(completed)throw Error('Останови секундомер перед сохранением тренировки.');}
   out[id]=clean;
  }
  if(running>1)throw Error('Одновременно может работать только один секундомер.');return out;
 }
 function total(workout,id,now=Date.now()){const t=workout.sectionTiming?.[id];return t?t.elapsedSec+(t.startedAt?Math.max(0,(now-Date.parse(t.startedAt))/1000):0):null}
 const active=w=>ids().find(id=>w.sectionTiming?.[id]?.startedAt)||null;
 function stopAll(w,now=Date.now()){for(const id of ids()){const t=w.sectionTiming?.[id];if(t?.startedAt){t.elapsedSec=Math.round(total(w,id,now)*1000)/1000;t.stoppedAt=new Date(now).toISOString();delete t.startedAt}}return w}
 function toggle(w,id,now=Date.now()){if(!ids().includes(id))throw Error('Неизвестный блок.');const was=active(w);stopAll(w,now);if(was!==id){w.sectionTiming??={};const t=w.sectionTiming[id]??={elapsedSec:0};t.startedAt=new Date(now).toISOString();t.firstStartedAt??=t.startedAt;}return w}
 function set(w,id,seconds,now=Date.now()){if(!ids().includes(id)||seconds!==null&&(!Number.isFinite(seconds)||seconds<0||seconds>limit))throw Error('Некорректная длительность.');if(seconds===null){if(w.sectionTiming)delete w.sectionTiming[id];return}w.sectionTiming??={};const old=w.sectionTiming[id]||{},running=!!old.startedAt;w.sectionTiming[id]={...old,elapsedSec:seconds,...(running?{startedAt:new Date(now).toISOString()}:{})};}
 const has=w=>Object.keys(w.sectionTiming||{}).length>0;
 Hybrid.timing={validate,total,active,stopAll,toggle,set,has};
})();
