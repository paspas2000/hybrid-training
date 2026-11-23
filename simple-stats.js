'use strict';
(() => {
 const h=Hybrid,has=(r,k)=>r[k]!==undefined&&r[k]!==null&&r[k]!==''&&Number.isFinite(Number(r[k]));
 function startDate(period,end=h.model.today()){
  if(period==='all')return '';const d=new Date(end+'T12:00:00Z');if(period==='week')d.setUTCDate(d.getUTCDate()-6);else{const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-({month:1,half:6,year:12}[period]||0));const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last))}return d.toISOString().slice(0,10);
 }
 const inRange=(history,period,end=h.model.today())=>{const start=startDate(period,end);return history.filter(w=>(!start||w.date>=start)&&w.date<=end).slice().sort((a,b)=>a.date.localeCompare(b.date)||(a.completedAt||'').localeCompare(b.completedAt||''))};
 function exercise(history,id,{period='month',variant='all',basis='all',weight='all'}={}){
  const groups=new Map();
  for(const workout of inRange(history,period))for(const section of workout.sections)for(const exercise of section.exercises){
   if(exercise.exerciseId!==id||(variant!=='all'&&(exercise.variant||'')!==variant))continue;
   for(const record of exercise.records){
    if(!h.model.isActual(record))continue;
    const weightBasis=h.recording.key(exercise,record);
    if(basis!=='all'&&weightBasis!==basis)continue;
    if(weight!=='all'&&(!has(record,'weightKg')||Number(record.weightKg)!==Number(weight)))continue;
    if(!groups.has(workout.date))groups.set(workout.date,[]);
    groups.get(workout.date).push({
     ...record, _basis:weightBasis, _variant:exercise.variant||'',
     _strength:['lower','upper','strength'].includes(section.id), _effort:exercise.rpe??null
    });
   }
  }
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
   if(id==='run'&&metrics.pace>0){metrics.speed=60/metrics.pace;allowed.push('speed')}
   const set=bestSet(records.filter(r=>r._strength),id);
   const timedRuns=id==='run'?records.filter(r=>Number(r.durationSec)>0&&Number(r.distanceM)>0):[];
   const run=timedRuns.length?{
    seconds:timedRuns.reduce((sum,r)=>sum+Number(r.durationSec)*h.model.setCount(r),0),
    meters:timedRuns.reduce((sum,r)=>sum+Number(r.distanceM)*h.model.setCount(r),0)
   }:null;
   const carry=id==='farmer'||id==='suitcase-carry'?bestCarry(records):null;
   return {date,set,run,carry, metrics: Object.fromEntries(Object.entries(metrics).filter(([key]) => allowed.includes(key)))};
  });
 }
 function timeSeries(history,period){const ws=inRange(history,period),dates=[...new Set(ws.map(w=>w.date))];return h.sections.map(section=>({id:section.id,title:section.title,points:dates.map(date=>{const values=ws.filter(w=>w.date===date).map(w=>h.timing.statTotal(w,section.id)).filter(v=>v!==null);return {date,value:values.length?values.reduce((a,b)=>a+b,0)/60:null}})}))}
 function bestSet(records,id){
  const candidates=[];
  for(const record of records){
   if(!has(record,'reps')||Number(record.reps)<=0)continue;
   const weighted=has(record,'weightKg');
   if(!weighted&&id!=='pullup')continue;
   if(record.bodyweightMode==='assisted')continue;
   const outcome=h.model.attemptOutcome({exerciseId:id},record);
   if(outcome.failed&&!outcome.successful)continue;
   const weight=weighted?Number(record.weightKg):Number(record.addedWeightKg||0);
   candidates.push({
    weight,reps:Number(record.reps),weighted,
    context:JSON.stringify([record._variant,weighted?record._basis:'pullup',record._effort]),
    label:weighted?h.recording.basisLabel(record._basis):'',
    variant:record._variant
   });
  }
  if(new Set(candidates.map(set=>set.context)).size>1)return null;
  return candidates.reduce((best,set)=>!best||set.weight>best.weight||
   (set.weight===best.weight&&set.reps>best.reps)?set:best,null);
 }
 function bestCarry(records){
  const paired=records.filter(record=>has(record,'weightKg')&&has(record,'distanceM'));
  if(new Set(paired.map(record=>record._basis)).size>1)return null;
  return paired.reduce((best,record)=>{
   if(!best)return record;
   const weight=Number(record.weightKg)-Number(best.weightKg);
   return weight>0||(weight===0&&Number(record.distanceM)>Number(best.distanceM))?record:best;
  },null);
 }
 function compareSets(first,last){
  if(first.context!==last.context)return null;
  const weight=Math.sign(last.weight-first.weight);
  const reps=Math.sign(last.reps-first.reps);
  if(weight&&reps&&weight!==reps)return null;
  return weight||reps;
 }
 function activity(history,end=h.model.today()){
  const last=Date.parse(end+'T00:00:00Z');
  let recent=0,previous=0;
  for(const workout of history){
   const age=(last-Date.parse(workout.date+'T00:00:00Z'))/86400000;
   if(age>=0&&age<28)recent++;
   else if(age>=28&&age<56)previous++;
  }
  return {recent,previous};
 }
 function frequency(history, end=h.model.today()){
  const today = Date.parse(end+'T00:00:00Z');
  const dayMs = 86400000;
  const result = new Map();
  const seenByWorkout = new Map();
  for(const workout of history){
   if(workout.date>end)continue;
   const daysAgo = (today-Date.parse(workout.date+'T00:00:00Z'))/dayMs;
   const seen = seenByWorkout.get(workout.id) || new Set();
   seenByWorkout.set(workout.id,seen);
   for(const section of workout.sections)for(const {exerciseId,name,records} of section.exercises){
    if(seen.has(exerciseId)||!records.some(h.model.isActual))continue;
    seen.add(exerciseId);
    const item = result.get(exerciseId) || {name,lastDate:workout.date,daysAgo,count28:0};
    if(daysAgo<item.daysAgo)Object.assign(item,{name,lastDate:workout.date,daysAgo});
    if(daysAgo<28)item.count28++;
    result.set(exerciseId,item);
   }
  }
  return result;
 }
 h.simpleStats={startDate,inRange,exercise,timeSeries,compareSets,activity,frequency};
})();
