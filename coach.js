'use strict';
(() => {
 const h=Hybrid, clone=x=>JSON.parse(JSON.stringify(x));
 const list=(value,allowed,label)=>{if(!Array.isArray(value)||value.length>100||value.some(x=>typeof x!=='string'||!allowed.includes(x)))throw Error('Некорректное поле: '+label);return [...new Set(value)]};
 function validateProfile(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Некорректный профиль');
  const out={};
  if(value.direction!==undefined){if(value.direction!==''&&!h.directionLabels[value.direction])throw Error('Некорректное направление');out.direction=value.direction}
  if(value.area!==undefined){if(value.area!==''&&!h.traitLabels.areas[value.area])throw Error('Некорректная область');out.area=value.area;out.areas=value.area==='full'?['upper','lower']:value.area?[value.area]:[]}
  for(const [key,allowed] of [['patterns',Object.keys(h.traitLabels.patterns)],['muscles',Object.keys(h.traitLabels.muscles)],['primaryQualities',Object.keys(h.traitLabels.qualities)],['secondaryQualities',Object.keys(h.traitLabels.qualities)],['formats',Object.keys(h.formatLabels)]])if(value[key]!==undefined)out[key]=list(value[key],allowed,key);
  if(out.primaryQualities&&out.secondaryQualities)out.secondaryQualities=out.secondaryQualities.filter(x=>!out.primaryQualities.includes(x));
  return out;
 }
 function profiles(catalog){
  const map=new Map(Object.entries(h.exerciseProfiles).map(([id,p])=>[id,clone(p)]));
  for(const d of catalog){let p=map.get(d.id)||{id:d.id,name:d.name,sectionId:d.sectionId,direction:'',area:'',areas:[],patterns:[],muscles:[],primaryQualities:[],secondaryQualities:[],formats:[],equipment:[],status:'main'};
   p={...p,...(d.profile||{}),name:d.name,fields:d.fields,status:d.status||p.status,excluded:!!d.excluded,favorite:!!d.favorite};
   if(d.equipment!==undefined)p.equipment=d.equipment?[d.equipment]:[];
   p.areas=p.area==='full'?['upper','lower']:p.area?[p.area]:[];map.set(d.id,p);
  }return [...map.values()];
 }

 function analyze(history,all,{start='',end='',last=null}={}){
  const workouts=history.filter(w=>(!start||w.date>=start)&&(!end||w.date<=end)).sort((a,b)=>b.date.localeCompare(a.date)||(b.completedAt||'').localeCompare(a.completedAt||''));if(last)workouts.splice(last);
  const lookup=new Map(all.map(p=>[p.id,p])),out={workouts,patterns:{},primary:{},exercises:{},unknown:0};
  for(const w of workouts){const patterns=new Set(),primary=new Set(),exercises=new Set();for(const section of w.sections)for(const e of section.exercises){if(!e.records.some(h.model.isActual))continue;exercises.add(e.exerciseId);const p=lookup.get(e.exerciseId);if(!p){out.unknown++;continue}p.patterns.forEach(key=>patterns.add(key));p.primaryQualities.forEach(key=>primary.add(key));if(!p.patterns.length&&!p.primaryQualities.length)out.unknown++}for(const [key,seen] of [['patterns',patterns],['primary',primary],['exercises',exercises]])for(const id of seen)out[key][id]=(out[key][id]||0)+1;}return out;
 }
 h.coach={validateProfile,profiles,analyze};
})();
