'use strict';
(() => {
 const h=Hybrid,has=(r,k)=>r[k]!==undefined&&r[k]!==null&&r[k]!==''&&Number.isFinite(Number(r[k]));
 function startDate(period,end=h.model.today()){
  if(period==='all')return '';const d=new Date(end+'T12:00:00Z');if(period==='week')d.setUTCDate(d.getUTCDate()-6);else{const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-({month:1,half:6,year:12}[period]||0));const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last))}return d.toISOString().slice(0,10);
 }
 const inRange=(history,period,end=h.model.today())=>{const start=startDate(period,end);return history.filter(w=>(!start||w.date>=start)&&w.date<=end).slice().sort((a,b)=>a.date.localeCompare(b.date)||(a.completedAt||'').localeCompare(b.completedAt||''))};
 function exercise(history,id,{period='month',variant='all',basis='all',weight='all'}={}){
  const groups=new Map();for(const w of inRange(history,period))for(const section of w.sections)for(const e of section.exercises){if(e.exerciseId!==id||variant!=='all'&&(e.variant||'')!==variant)continue;const rs=e.records.filter(r=>h.model.isActual(r)&&(basis==='all'||h.recording.key(e,r)===basis)&&(weight==='all'||has(r,'weightKg')&&Number(r.weightKg)===Number(weight)));if(!rs.length)continue;if(!groups.has(w.date))groups.set(w.date,[]);groups.get(w.date).push(...rs.map(r=>({...r,_basis:h.recording.key(e,r)})))}
  const allowed = ['setsCount','weightKgMax','addedWeightKgMax','repsSum','durationSecSum','distanceMSum','distanceMMax','pace','successfulAttempts','failedAttempts','totalAttempts','successRate'];
  return [...groups].map(([date, records]) => {
   const metrics = h.model.metrics({exerciseId: id, records});
   const bases = new Set(records.filter(record => {const outcome=h.model.attemptOutcome({exerciseId:id},record);return has(record,'weightKg')&&(h.attemptExerciseIds.includes(id)?outcome.successful>0:!(outcome.failed>0&&outcome.successful===0));}).map(record => record._basis));
   if (bases.size > 1) delete metrics.weightKgMax;
   if(id==='burpee'){const reps=records.filter(r=>has(r,'reps')).map(r=>Number(r.reps));if(reps.length){metrics.repsMax=Math.max(...reps);metrics.repsMin=Math.min(...reps);allowed.push('repsMax','repsMin')}}
   if(id==='farmer'){
    const valid=records.filter(r=>has(r,'weightKg')&&has(r,'distanceM'));
    const totalWeight=r=>{if(r._basis==='total')return Number(r.weightKg);const m=/^implement:(\d+):/.exec(r._basis);return m?Number(r.weightKg)*Number(m[1]):null};
    if(valid.length&&valid.every(r=>totalWeight(r)!==null)){metrics.carryVolume=valid.reduce((sum,r)=>sum+totalWeight(r)*Number(r.distanceM)*h.model.setCount(r),0);allowed.push('carryVolume')}
   }
   if(id==='run'){const runs=records.filter(r=>Number(r.durationSec)===900&&has(r,'distanceM'));if(runs.length){metrics.run15Distance=Math.max(...runs.map(r=>Number(r.distanceM)));allowed.push('run15Distance')}}
   return {date, metrics: Object.fromEntries(Object.entries(metrics).filter(([key]) => allowed.includes(key)))};
  });
 }
 function timeSeries(history,period){const ws=inRange(history,period),dates=[...new Set(ws.map(w=>w.date))];return h.sections.map(section=>({id:section.id,title:section.title,points:dates.map(date=>{const values=ws.filter(w=>w.date===date).map(w=>h.timing.statTotal(w,section.id)).filter(v=>v!==null);return {date,value:values.length?values.reduce((a,b)=>a+b,0)/60:null}})}))}
 function progress(history,end=h.model.today()){
  const start=new Date(end+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-27);const since=start.toISOString().slice(0,10),groups=new Map();
  const allowed=Object.fromEntries(h.sections.map(s=>[s.id,new Set(h.personalLibrary[s.id]?.main||[])]));
  for(const w of history.filter(w=>w.date>=since&&w.date<=end).slice().sort((a,b)=>a.date.localeCompare(b.date)||(a.completedAt||'').localeCompare(b.completedAt||'')))for(const section of w.sections)for(const e of section.exercises){
   const block=section.id==='strength'?h.blockForExercise(e.exerciseId):section.id;if(!allowed[block]?.has(e.exerciseId))continue;
   const records=e.records.filter(h.model.isActual), buckets=new Map();
   for(const r of records){let value,key,detail;const variant=e.variant||'',basis=h.recording.key(e,r);
    if(block==='skill'){if(!h.model.attemptOutcome(e,r).successful||!has(r,'weightKg')||Number(r.weightKg)<=0)continue;value=Number(r.weightKg);key=[basis,variant];detail='успешный вес · '+h.recording.basisLabel(basis)}
    else if(block==='lower'||block==='upper'){if(!has(r,'reps')||Number(r.reps)<=0)continue;if(e.exerciseId==='pullup'&&!has(r,'weightKg')){value=Number(r.reps);key=[variant,r.bodyweightMode||'',has(r,'addedWeightKg')?Number(r.addedWeightKg):null,e.rpe??null];detail='максимум повторений · '+(r.bodyweightMode==='assisted'?'с помощью':has(r,'addedWeightKg')?'доп. вес '+r.addedWeightKg+' кг':'свой вес')+(e.rpe?' · RPE '+e.rpe:'')}else{if(!has(r,'weightKg')||Number(r.weightKg)<=0)continue;value=Number(r.weightKg);key=[basis,variant,Number(r.reps),e.rpe??null];detail=Number(r.reps)+' повтор. · '+h.recording.basisLabel(basis)+(e.rpe?' · RPE '+e.rpe:'')}}
    else if(block==='capacity'){if(!has(r,'weightKg')||!has(r,'distanceM'))continue;const match=/^implement:(\d+):/.exec(basis),factor=basis==='total'?1:match?Number(match[1]):0;if(!factor)continue;value=Number(r.weightKg)*factor*Number(r.distanceM)*h.model.setCount(r);key=[basis,variant];detail='объём переноса, кг·м'}
    else if(block==='anaerobic'){if(!has(r,'reps'))continue;value=Number(r.reps)*h.model.setCount(r);key=[variant];detail='повторы за тренировку'}
    else if(block==='endurance'){if(records.length!==1||!has(r,'durationSec')||!has(r,'distanceM')||Number(r.durationSec)<=0||Number(r.distanceM)<=0||h.model.setCount(r)!==1||r.circuitRound||/интервал/i.test(variant))continue;value=Number(r.distanceM)/Number(r.durationSec);key=[variant];detail='средняя скорость · время и дистанция'}
    else continue;
    if(value<=0)continue;const id=JSON.stringify([block,e.exerciseId,...key]),existing=buckets.get(id);if(existing)existing.value=block==='capacity'||block==='anaerobic'?existing.value+value:Math.max(existing.value,value);else buckets.set(id,{id,block,name:e.name,detail:detail+(variant?' · '+variant:''),value});
   }
   for(const row of buckets.values()){if(!groups.has(row.id))groups.set(row.id,{...row,points:[]});groups.get(row.id).points.push({date:w.date,value:row.value})}
  }
  return h.sections.map(section=>({section,options:[...groups.values()].filter(g=>g.block===section.id&&new Set(g.points.map(p=>p.date)).size>=2).map(g=>{const first=g.points[0],last=g.points.at(-1);return {...g,first,last,change:(last.value/first.value-1)*100}})}));
 }
 h.simpleStats={startDate,inRange,exercise,timeSeries,progress};
})();
