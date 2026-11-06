const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const c={window:{},crypto};vm.createContext(c);for(const file of ['data.js','timing.js','model.js','simple-stats.js']){vm.runInContext(fs.readFileSync(file,'utf8'),c);if(file==='data.js')c.Hybrid=c.window.Hybrid}
const h=c.Hybrid,m=h.model,t=h.timing;
assert.deepEqual(Array.from(h.sections,section=>section.id),['skill','lower','upper','capacity','anaerobic','endurance']);
assert.equal(h.activeExerciseIds.length,14);
assert.equal(h.catalogGroups.filter(group=>!group.additional).reduce((n,group)=>n+group.exerciseIds.length,0),10);
assert.equal(h.catalogGroups.filter(group=>group.additional).reduce((n,group)=>n+group.exerciseIds.length,0),4);
assert.equal(h.recording.weightLabel(h.recording.defaults['lu-raise']),'Вес одного блина, кг');
assert.deepEqual(Array.from(h.recording.fields(h.recording.defaults.burpee)),['reps','durationSec']);
const old={schemaVersion:2,date:m.today(),note:'',id:'old',completedAt:new Date().toISOString(),sections:[{id:'skill',exercises:[]},{id:'strength',exercises:[{id:'e',exerciseId:'deadlift',name:'Становая тяга',note:'',records:[{id:'r',weightKg:120,reps:5}]}]},{id:'capacity',exercises:[]},{id:'endurance',exercises:[]}],sectionTiming:{strength:{elapsedSec:120},capacity:{elapsedSec:180},endurance:{elapsedSec:60}}};
const restored=m.validate(old,true);assert.equal(restored.sections.length,7);assert.equal(restored.legacyLayout,'four');assert.equal(restored.sections.find(s=>s.id==='strength').exercises[0].records[0].weightKg,120);assert.equal(restored.sectionTiming.strength.elapsedSec,120);assert.equal(t.statTotal(restored,'lower'),null);assert.equal(t.statTotal(restored,'upper'),null);assert.equal(t.statTotal(restored,'capacity'),null);assert.equal(m.validate(JSON.parse(JSON.stringify(restored)),true).legacyLayout,'four');
const five=structuredClone(old);five.sections.splice(3,0,{id:'anaerobic',exercises:[]});five.sectionTiming.anaerobic={elapsedSec:30};const restoredFive=m.validate(five,true);assert.equal(restoredFive.legacyLayout,'five');assert.equal(t.statTotal(restoredFive,'capacity'),180);assert.equal(t.statTotal(restoredFive,'anaerobic'),30);assert.equal(t.statTotal(restoredFive,'lower'),null);assert.equal(h.simpleStats.timeSeries([restoredFive],'all').length,6);
const active=m.empty();t.toggleBlock(active,'lower',0);t.toggleBlock(active,'upper',30000);assert.equal(t.total(active,'lower'),30);assert.equal(t.activeBlock(active),'upper');t.stopAll(active,60000);assert.equal(t.total(active,'upper'),30);
assert.equal(m.template({id:'t',name:'Старый',createdAt:old.completedAt,workout:old}).workout.sections.find(s=>s.id==='strength').exercises[0].records[0].reps,5);
const bad=structuredClone(old);bad.sections[1].id='unknown';assert.throws(()=>m.validate(bad));const missing=m.empty();missing.sections.pop();assert.throws(()=>m.validate(missing));
console.log('PASS: six blocks, 10 main/4 additional exercises, Lu Raises/burpee fields, old four/five-block data preserved, unsplit old timers excluded and exclusive clocks.');
