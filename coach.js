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
 function recommend(history,all,sectionId,date=h.model.today()){
  const recent=analyze(history,all,{end:date,last:5}),n=recent.workouts.length;
  const available=all.filter(p=>p.sectionId===sectionId&&p.status!=='hidden'&&!p.excluded);
  const core=available.filter(p=>p.status==='main');
  const lastSeen=new Map();for(const w of history)if(w.date<=date)for(const s of w.sections)for(const e of s.exercises)if(e.records.some(h.model.isActual)&&(!lastSeen.has(e.exerciseId)||lastSeen.get(e.exerciseId)<w.date))lastSeen.set(e.exerciseId,w.date);
  const seen=id=>lastSeen.get(id)||'';
  const rank=(a,b)=>(recent.exercises[a.id]||0)-(recent.exercises[b.id]||0)||seen(a.id).localeCompare(seen(b.id))||a.name.localeCompare(b.name,'ru');
  const ranked=n<3?core:core.sort((a,b)=>Number(b.favorite)-Number(a.favorite)||rank(a,b)),ordered=[],seenPatterns=new Set();
  if(n>=3){for(const p of ranked.filter(p=>p.favorite).slice(0,3)){ordered.push(p);p.patterns.filter(key=>key!=='hold').forEach(key=>seenPatterns.add(key))}for(const p of ranked){if(ordered.includes(p)||ordered.length>=3)continue;const primary=(p.patterns||[]).filter(key=>key!=='hold');if(primary.some(key=>seenPatterns.has(key)))continue;ordered.push(p);primary.forEach(key=>seenPatterns.add(key));if(ordered.length===3)break}for(const p of ranked)if(!ordered.includes(p))ordered.push(p)}
  const suggestions=(n<3?core:ordered).map(p=>{
   const count=recent.exercises[p.id]||0,patterns=p.patterns.map(key=>h.traitLabels.patterns[key]).join(', ');
   const reason=n<3?'Основное упражнение этого блока. Для подсказок по истории нужно хотя бы 3 занятия.':count?'Встречалось в '+count+' из '+n+' последних занятий. Паттерн: '+(patterns||'не указан')+'.':'Не встречалось в последних '+n+' занятиях. Можно выбрать для разнообразия; это не свидетельство недостатка подготовки.';
   return {id:p.id,name:p.name,reason:reason+(n>=3&&seen(p.id)?' Последний раз: '+seen(p.id)+'.':'')};
  });
  const recentExercises=all.filter(p=>p.sectionId===sectionId&&recent.exercises[p.id]).map(p=>({id:p.id,name:p.name,count:recent.exercises[p.id]}));
  return {recentExercises,suggestions:n<3?suggestions:suggestions.slice(0,4),alternatives:available.filter(p=>p.status==='additional').map(p=>({id:p.id,name:p.name})),sample:n,patterns:recent.patterns};
 }
 h.coach={validateProfile,profiles,analyze,recommend};
})();
