'use strict';
(() => {
 const h=Hybrid,has=(r,k)=>r[k]!==undefined&&r[k]!==null&&r[k]!==''&&Number.isFinite(Number(r[k]));
 function startDate(period,end=h.model.today()){
  if(period==='all')return '';const d=new Date(end+'T12:00:00Z');if(period==='week')d.setUTCDate(d.getUTCDate()-6);else{const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-({month:1,half:6,year:12}[period]||0));const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last))}return d.toISOString().slice(0,10);
 }
 const inRange=(history,period,end=h.model.today())=>{const start=startDate(period,end);return history.filter(w=>(!start||w.date>=start)&&w.date<=end).slice().sort((a,b)=>a.date.localeCompare(b.date)||(a.completedAt||'').localeCompare(b.completedAt||''))};
 function exercise(history,id,{period='month',variant='all',basis='all'}={}){
  const groups=new Map();for(const w of inRange(history,period))for(const section of w.sections)for(const e of section.exercises){if(e.exerciseId!==id||variant!=='all'&&(e.variant||'')!==variant)continue;const rs=e.records.filter(r=>h.model.isActual(r)&&(basis==='all'||(r.weightBasis||'')===basis));if(!rs.length)continue;if(!groups.has(w.date))groups.set(w.date,[]);groups.get(w.date).push(...rs)}
  const rows=[...groups].map(([date,records])=>{const values=k=>records.filter(r=>has(r,k)).map(r=>Number(r[k])),sum=k=>values(k).reduce((a,b)=>a+b,0),max=k=>values(k).length?Math.max(...values(k)):null,bases=new Set(records.filter(r=>has(r,'weightKg')).map(r=>r.weightBasis||'')),metrics={setsCount:records.length};
   if(values('weightKg').length&&bases.size===1)metrics.weightKgMax=max('weightKg');if(values('addedWeightKg').length)metrics.addedWeightKgMax=max('addedWeightKg');for(const k of ['reps','durationSec','distanceM'])if(values(k).length)metrics[k+'Sum']=sum(k);
   const paired=records.filter(r=>Number(r.durationSec)>0&&Number(r.distanceM)>0);if(paired.length)metrics.pace=paired.reduce((n,r)=>n+Number(r.durationSec),0)/paired.reduce((n,r)=>n+Number(r.distanceM),0)*1000/60;
   const known=records.filter(r=>Number(r.attempts?.successful)+Number(r.attempts?.failed)>0);if(known.length)metrics.successRate=known.reduce((n,r)=>n+Number(r.attempts.successful),0)/known.reduce((n,r)=>n+Number(r.attempts.successful)+Number(r.attempts.failed),0)*100;
   return {date,metrics};});return rows;
 }
 function timeSeries(history,period){const ws=inRange(history,period),dates=[...new Set(ws.map(w=>w.date))];return h.sections.map(section=>({id:section.id,title:section.title,points:dates.map(date=>{const values=ws.filter(w=>w.date===date).map(w=>h.timing.total(w,section.id)).filter(v=>v!==null);return {date,value:values.length?values.reduce((a,b)=>a+b,0)/60:null}})}))}
 h.simpleStats={startDate,inRange,exercise,timeSeries};
})();
