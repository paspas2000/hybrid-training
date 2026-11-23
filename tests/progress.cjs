const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const c={window:{},crypto};vm.createContext(c);for(const f of ['data.js','timing.js','model.js','simple-stats.js']){vm.runInContext(fs.readFileSync(f,'utf8'),c);if(f==='data.js')c.Hybrid=c.window.Hybrid}const h=c.Hybrid;
const date=h.model.today(),exercise=(id,records,recording)=>({exerciseId:id,name:id,records,...(recording?{recording}:{})}),workout=(...exercises)=>({date,sections:[{exercises}]});
const profile=h.recording.defaults.farmer;
let rows=h.simpleStats.exercise([workout(exercise('farmer',[{weightKg:32,distanceM:30,sets:2},{weightKg:40,distanceM:10},{weightKg:99,distanceM:99,pending:true}],profile))],'farmer',{period:'all'});
assert.equal(rows[0].metrics.distanceMSum,70);assert.equal(rows[0].metrics.carryVolume,4640);
rows=h.simpleStats.exercise([workout(exercise('farmer',[{weightKg:32,distanceM:30,sets:2},{weightKg:40,distanceM:10}],profile))],'farmer',{period:'all',weight:'32'});assert.equal(rows[0].metrics.distanceMSum,60);assert.equal(rows[0].metrics.carryVolume,3840);
rows=h.simpleStats.exercise([workout(exercise('farmer',[{weightKg:32,distanceM:30}]))],'farmer',{period:'all'});assert.equal(rows[0].metrics.carryVolume,undefined);
rows=h.simpleStats.exercise([workout(exercise('burpee',[{reps:10,sets:3},{reps:8}]))],'burpee',{period:'all'});assert.equal(rows[0].metrics.repsSum,38);assert.equal(rows[0].metrics.repsMax,10);assert.equal(rows[0].metrics.repsMin,8);
rows=h.simpleStats.exercise([workout(exercise('run',[{durationSec:900,distanceM:3000},{durationSec:600,distanceM:4000},{durationSec:900,distanceM:5000,pending:true}]))],'run',{period:'all'});assert.equal(rows[0].metrics.durationSecSum,1500);
assert.equal(rows[0].metrics.distanceMSum,7000);
assert.equal(rows[0].metrics.pace,1500/7000*1000/60);
assert.equal(rows[0].metrics.speed,60/rows[0].metrics.pace);
console.log('PASS: farmer volume with known weight basis, burpee totals and peak, runs of different durations, pending exclusion.');
const point=(date,records)=>({date,sections:[{id:'lower',exercises:[exercise('deadlift',records)]}]});
const strength=[
 point('2026-10-10',[{weightKg:60,reps:5},{weightKg:100,reps:1,pending:true}]),
 point('2026-10-15',[{weightKg:60,reps:7}]),
 point('2026-10-20',[{weightKg:65,reps:5}]),
 point('2026-10-25',[{weightKg:60,reps:4}])
];
const sets=h.simpleStats.exercise(strength,'deadlift',{period:'all'}).map(row=>row.set);
assert.equal(sets[0].weight,60);
assert.equal(h.simpleStats.compareSets(sets[0],sets[1]),1);
assert.equal(h.simpleStats.compareSets(sets[0],sets[2]),1);
assert.equal(h.simpleStats.compareSets(sets[1],sets[2]),null);
assert.equal(h.simpleStats.compareSets(sets[0],sets[3]),-1);
assert.equal(h.simpleStats.compareSets(sets[0],{...sets[1],context:'another variant'}),null);
const activity=h.simpleStats.activity(['2026-10-27','2026-10-27','2026-09-30','2026-09-29','2026-09-02','2026-09-01','2026-10-28'].map(date=>({date})),'2026-10-27');
assert.equal(activity.recent,3);
assert.equal(activity.previous,2);
console.log('PASS: strength comparisons without fixed reps and current/previous activity windows.');

const sessions = [
 {id:'a',date:'2026-10-22',sections:[{exercises:[exercise('run',[{durationSec:1200,distanceM:3000,sets:2}]),exercise('run',[{durationSec:1200}])]}]},
 {id:'b',date:'2026-10-22',sections:[{exercises:[exercise('run',[{durationSec:1800}])]}]},
 {id:'c',date:'2026-10-21',sections:[{exercises:[exercise('run',[{durationSec:900}]),exercise('farmer',[{weightKg:32}])]}]},
 {id:'d',date:'2026-11-18',sections:[{exercises:[exercise('run',[{durationSec:900,pending:true}])]}]},
 {id:'e',date:'2026-11-19',sections:[{exercises:[exercise('run',[{durationSec:900}])]}]}
];
const frequencies=h.simpleStats.frequency([...sessions,sessions[0]],'2026-11-18');
assert.equal(frequencies.get('run').lastDate,'2026-10-22');
assert.equal(frequencies.get('run').daysAgo,27);
assert.equal(frequencies.get('run').count28,2);
assert.equal(frequencies.get('farmer').count28,0);
assert.equal(h.simpleStats.exercise([workout(exercise('run',[{durationSec:1200,distanceM:3000}]))],'run')[0].metrics.speed,9);
