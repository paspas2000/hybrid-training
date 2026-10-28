'use strict';
(() => {
 const h=Hybrid,own=(o,k)=>Object.hasOwn(o,k),has=(r,k)=>own(r,k)&&r[k]!==''&&r[k]!==null&&Number.isFinite(Number(r[k]));
 const num=(r,k)=>has(r,k)?Number(r[k]):null;
 const actual=r=>!r.pending&&(h.model.keys.some(k=>num(r,k)>0)||Number(r.attempts?.successful)>0||Number(r.attempts?.failed)>0||r.marked===true);
 const working=r=>actual(r)&&r.kind!=='warmup';
 const shift=(date,days)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
 const signature=r=>[...h.model.keys.map(k=>num(r,k)),r.weightBasis||'',r.bodyweightMode||'',r.kind||''];
 function analyze(history,profiles,{end=h.model.today(),days=56}={}){
  if(![28,56].includes(Number(days)))throw Error('Период обзора — 4 или 8 недель.');
  const start=shift(end,1-Number(days)),workouts=history.filter(w=>w.date>=start&&w.date<=end).slice().sort((a,b)=>a.date.localeCompare(b.date)||(a.completedAt||'').localeCompare(b.completedAt||'')||a.id.localeCompare(b.id));
  const lookup=new Map(profiles.map(p=>[p.id,p])),series=new Map(),patterns=new Map(),coverage=Object.fromEntries(h.sections.map(s=>[s.id,{sessions:0,records:0,rated:0}])) ;
  let unknown=0,rated=0;
  function add(w,sectionId,e,metric,condition,value,{unit='',lower=false,priority=5,source=[],success=null,total=null,label='',kind='',warnings=[]}={}){
   const id=JSON.stringify([sectionId,e.exerciseId,e.variant||'',e.format||'',kind,metric,condition]);
   if(!series.has(id))series.set(id,{id,sectionId,exerciseId:e.exerciseId,name:e.name,variant:e.variant||'',format:e.format||'',kind,metric,label,condition,unit,lower,priority,warnings,points:new Map()});
   const s=series.get(id),key=w.id;
   if(!s.points.has(key))s.points.set(key,{workoutId:key,date:w.date,completedAt:w.completedAt,value,success,total,sources:[...source]});
   else{const p=s.points.get(key);p.sources.push(...source);if(metric==='successRate'){p.success+=success;p.total+=total;p.value=p.success/p.total*100}else p.value=lower?Math.min(p.value,value):Math.max(p.value,value)}
  }
  for(const w of workouts){
   if(w.sessionRpe!=null)rated++;
   const seenPatterns=new Set(),patternRatings=new Map();
   for(const section of w.sections){
    let records=0;
    for(const e of section.exercises){
     const rs=e.records.filter(working);records+=rs.length;
     if(rs.length){const p=lookup.get(e.exerciseId);if(!p?.patterns?.length)unknown++;else for(const pattern of p.patterns){seenPatterns.add(pattern);if(w.sectionRpe?.[section.id]!=null){const prior=patternRatings.get(pattern);patternRatings.set(pattern,Math.max(prior??0,w.sectionRpe[section.id]))}}}
     const group=e.groupId?(w.groups||[]).find(g=>g.id===e.groupId):null;
     const partners=group?w.sections.flatMap(s=>s.exercises).filter(x=>x.groupId===group.id&&x.id!==e.id).map(x=>[x.exerciseId,x.variant||'',x.format||'',x.records.filter(working).map(signature)]):null;
     const context=group?['complex',num(group,'rounds'),num(group,'restSec'),partners]:null;
     for(const r of rs){
      const load=[num(r,'weightKg'),r.weightBasis||'',num(r,'addedWeightKg'),r.bodyweightMode||''];
      const base=[load,r.kind||'',context],source=[{name:e.name,record:r}],warning=[];
      if(has(r,'weightKg')&&!r.weightBasis)warning.push('Способ указания веса не уточнён.');
      if(group)warning.push('Работа в комплексе: сравниваются также записанные условия остальных упражнений.');
      const options={source,kind:r.kind||'',warnings:warning};
      const successes=Number(r.attempts?.successful||0),failures=Number(r.attempts?.failed||0),attempts=successes+failures;
      if(section.id==='skill'){
       if(has(r,'weightKg')&&attempts>0)add(w,section.id,e,'successRate',[...base,num(r,'reps')],successes/attempts*100,{...options,success:successes,total:attempts,unit:'%',priority:0,label:'Успешность на фиксированном весе'});
       if(has(r,'weightKg')&&successes>0)add(w,section.id,e,'successfulWeight',[[r.weightBasis||'',num(r,'addedWeightKg'),r.bodyweightMode||''],num(r,'reps'),r.kind||'',context],Number(r.weightKg),{...options,unit:'кг',priority:1,label:'Максимальный явно успешный вес'});
       if(lookup.get(e.exerciseId)?.patterns?.includes('jump')&&has(r,'distanceM')&&Number(r.distanceM)>0)add(w,section.id,e,'jumpDistance',base,Number(r.distanceM),{...options,unit:'м',priority:2,label:'Максимальная дистанция одной записи'});
      }
      if(section.id==='strength'&&!(attempts>0&&successes===0)&&has(r,'reps')&&Number(r.reps)>0){
       if(has(r,'weightKg')){
        add(w,section.id,e,'weightAtReps',[[r.weightBasis||'',num(r,'addedWeightKg'),r.bodyweightMode||''],Number(r.reps),r.kind||'',context],Number(r.weightKg),{...options,unit:'кг',priority:0,label:'Вес при одинаковом числе повторений'});
        add(w,section.id,e,'repsAtLoad',base,Number(r.reps),{...options,unit:'повт.',priority:1,label:'Повторы в одном подходе при фиксированной нагрузке'});
       }else if(has(r,'addedWeightKg')&&r.bodyweightMode!=='assisted')add(w,section.id,e,'addedWeightAtReps',[r.bodyweightMode||'weighted',Number(r.reps),r.kind||'',context],Number(r.addedWeightKg),{...options,unit:'кг доп.',priority:0,label:'Дополнительный вес при одинаковых повторах'});
       else if(!has(r,'addedWeightKg')&&(r.bodyweightMode==='self'||h.bodyweightIds.includes(e.exerciseId)))add(w,section.id,e,'bodyweightReps',base,Number(r.reps),{...options,unit:'повт.',priority:1,label:'Повторы в одной записи без указанного отягощения'});
      }
      if(section.id==='capacity'){
       if(has(r,'durationSec')&&Number(r.durationSec)>0&&has(r,'reps'))add(w,section.id,e,'repsAtTime',[...base,Number(r.durationSec)],Number(r.reps),{...options,unit:'повт.',priority:0,label:'Повторы за фиксированное время в одной записи'});
       if(has(r,'durationSec')&&Number(r.durationSec)>0&&has(r,'distanceM')&&Number(r.distanceM)>0)add(w,section.id,e,'carryTime',[...base,Number(r.distanceM)],Number(r.durationSec),{...options,unit:'с',lower:true,priority:1,label:'Время одной записи на фиксированную дистанцию'});
       if(has(r,'reps')&&!has(r,'durationSec'))add(w,section.id,e,'capacityReps',base,Number(r.reps),{...options,unit:'повт.',priority:4,label:'Повторы в одной записи при фиксированной нагрузке'});
      }
      if(section.id==='endurance'&&has(r,'durationSec')&&Number(r.durationSec)>0&&has(r,'distanceM')&&Number(r.distanceM)>0){
       add(w,section.id,e,'timeAtDistance',[...base,Number(r.distanceM)],Number(r.durationSec),{...options,unit:'с',lower:true,priority:0,label:'Время на одинаковой дистанции'});
       add(w,section.id,e,'distanceAtTime',[...base,Number(r.durationSec)],Number(r.distanceM),{...options,unit:'м',priority:1,label:'Дистанция за одинаковое время'});
      }
     }
    }
    const groupWork=(w.groups||[]).some(g=>g.sectionId===section.id&&(actual(g.result||{})||(g.roundResults||[]).some(actual)||Number(g.rounds)>0));
    if(records||groupWork){coverage[section.id].sessions++;coverage[section.id].records+=records;if(w.sectionRpe?.[section.id]!=null)coverage[section.id].rated++}
   }
   // A complex is comparable only with a complete, identical logged composition and work.
   for(const g of w.groups||[]){
    const members=w.sections.flatMap(s=>s.exercises).filter(e=>e.groupId===g.id),order=g.order||[],ordered=members.slice().sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
    if(!members.length||!g.order||g.order.length!==members.length||!(Number(g.rounds)>0)||!members.every(e=>e.records.some(working)&&e.records.filter(working).every(r=>['reps','durationSec','distanceM'].some(k=>num(r,k)>0))&&!e.records.some(r=>r.pending))||!actual(g.result||{})||!(Number(g.result.durationSec)>0))continue;
    const composition=ordered.map(e=>[e.exerciseId,e.variant||'',e.format||'',e.records.filter(working).map(signature)]),e={exerciseId:ordered[0].exerciseId,name:'Комплекс «'+g.name+'»',variant:'',format:'circuit'};
    if(g.sectionId==='capacity')add(w,'capacity',e,'complexTime',[composition,num(g,'rounds'),num(g,'restSec'),...h.model.keys.filter(k=>k!=='durationSec').map(k=>num(g.result,k))],Number(g.result.durationSec),{unit:'с',lower:true,priority:0,label:'Время комплекса с тем же записанным составом и объёмом',source:[{name:'Общий результат комплекса',record:g.result},...ordered.flatMap(e=>e.records.filter(working).map(record=>({name:e.name,record})))],warnings:['Сравнение доступно только при совпадении всех записанных параметров упражнений и схемы комплекса.']});
   }
   for(const key of seenPatterns){if(!patterns.has(key))patterns.set(key,{id:key,sessions:0,ratedSessions:0,maxBlockRpe:null});const p=patterns.get(key);p.sessions++;if(patternRatings.has(key)){p.ratedSessions++;p.maxBlockRpe=Math.max(p.maxBlockRpe??0,patternRatings.get(key))}}
  }
  const values=[...series.values()].map(s=>{const points=[...s.points.values()].sort((a,b)=>a.date.localeCompare(b.date)||(a.completedAt||'').localeCompare(b.completedAt||'')||a.workoutId.localeCompare(b.workoutId)),latest=points.at(-1),previous=points.at(-2),delta=previous?latest.value-previous.value:null,status=!previous?'insufficient':Math.abs(delta)<1e-9?'same':((delta>0)!==s.lower?'higher':'lower');return {...s,points,latest,previous,delta,status}}).sort((a,b)=>Number(b.points.length>=2)-Number(a.points.length>=2)||b.latest.date.localeCompare(a.latest.date)||a.priority-b.priority||b.points.length-a.points.length||a.name.localeCompare(b.name,'ru'));
  return {start,end,days:Number(days),workouts,coverage,patterns:[...patterns.values()],unknown,rated,series:values};
 }
 h.progress={analyze,actual,shift};
})();
