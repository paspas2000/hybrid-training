'use strict';
(() => {
 const h=Hybrid,has=(r,k)=>r[k]!==undefined&&r[k]!==null&&r[k]!==''&&Number.isFinite(Number(r[k]));
 function startDate(period,end=h.model.today()){
  if(period==='all')return '';const d=new Date(end+'T12:00:00Z');if(period==='week')d.setUTCDate(d.getUTCDate()-6);else{const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-({month:1,half:6,year:12}[period]||0));const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last))}return d.toISOString().slice(0,10);
 }
 const inRange=(history,period,end=h.model.today())=>{const start=startDate(period,end);return history.filter(w=>(!start||w.date>=start)&&w.date<=end).slice().sort((a,b)=>a.date.localeCompare(b.date)||(a.completedAt||'').localeCompare(b.completedAt||''))};
 function exercise(history,id,{period='month',variant='all',basis='all'}={}){
  const groups=new Map();for(const w of inRange(history,period))for(const section of w.sections)for(const e of section.exercises){if(e.exerciseId!==id||variant!=='all'&&(e.variant||'')!==variant)continue;const rs=e.records.filter(r=>h.model.isActual(r)&&(basis==='all'||h.recording.key(e,r)===basis));if(!rs.length)continue;if(!groups.has(w.date))groups.set(w.date,[]);groups.get(w.date).push(...rs.map(r=>({...r,_basis:h.recording.key(e,r)})))}
  const allowed = ['setsCount','weightKgMax','addedWeightKgMax','repsSum','durationSecSum','distanceMSum','pace','successfulAttempts','failedAttempts','totalAttempts','successRate'];
  return [...groups].map(([date, records]) => {
   const metrics = h.model.metrics({exerciseId: id, records});
   const bases = new Set(records.filter(record => {const outcome=h.model.attemptOutcome({exerciseId:id},record);return has(record,'weightKg')&&(h.attemptExerciseIds.includes(id)?outcome.successful>0:!(outcome.failed>0&&outcome.successful===0));}).map(record => record._basis));
   if (bases.size > 1) delete metrics.weightKgMax;
   return {date, metrics: Object.fromEntries(Object.entries(metrics).filter(([key]) => allowed.includes(key)))};
  });
 }
 function timeSeries(history,period){const ws=inRange(history,period),dates=[...new Set(ws.map(w=>w.date))];return h.sections.map(section=>({id:section.id,title:section.title,points:dates.map(date=>{const values=ws.filter(w=>w.date===date).map(w=>h.timing.statTotal(w,section.id)).filter(v=>v!==null);return {date,value:values.length?values.reduce((a,b)=>a+b,0)/60:null}})}))}
 h.simpleStats={startDate,inRange,exercise,timeSeries};
})();
