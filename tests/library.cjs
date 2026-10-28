const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const load=text=>{const c={window:{}};vm.runInNewContext(text,c);return c.window.Hybrid},h=load(fs.readFileSync('data.js','utf8')),old=load(cp.execFileSync('git',['show','HEAD:data.js'],{encoding:'utf8'}));
const ids=h.sections.flatMap(s=>s.exercises.map(([id])=>id));assert.equal(ids.length,new Set(ids).size);
for(const s of old.sections)for(const [id,name] of s.exercises)assert(h.sections.find(x=>x.id===s.id).exercises.some(x=>x[0]===id&&x[1]===name));
for(const id of ids){const p=h.exerciseProfiles[id];assert(p,id);assert(h.directionLabels[p.direction],id);assert.equal(p.status,h.libraryStatus[id]);for(const key of p.fields)assert(['weightKg','addedWeightKg','reps','durationSec','distanceM','rounds'].includes(key));for(const key of [...p.primaryQualities,...p.secondaryQualities])assert(h.traitLabels.qualities[key]);for(const key of p.patterns)assert(h.traitLabels.patterns[key]);assert(p.equipment.every(key=>h.equipmentLabels.some(([id])=>id===key)));assert(p.formats.every(key=>h.formatLabels[key]));}
for(const id of ['squat','front-squat','zercher-squat']){assert.equal(h.exerciseProfiles[id].direction,'squat');assert.equal(h.libraryStatus[id],'main')}
assert(!h.exerciseProfiles['zercher-squat'].patterns.includes('carry'));assert.notEqual(h.exerciseProfiles.row.id,h.exerciseProfiles['dumbbell-row'].id);


for(const id of ['single-leg-hop','direction-jump','jump-lunge','burpee','swim','handstand'])assert.equal(h.libraryStatus[id],'hidden',id);
for(const id of ['push-press','clean','sled-push','bike','loaded-hold','jump','medball','rowing','airbike','bodyweight-squat'])assert.equal(h.libraryStatus[id],'main',id);
assert.equal(h.catalogGroups.length,21);assert.equal(new Set(h.catalogGroups.map(g=>g.id)).size,21);
assert.deepEqual(Array.from(h.sections,s=>h.catalogGroups.filter(g=>g.sectionId===s.id).length),[6,6,5,4]);
for(const group of h.catalogGroups){assert.equal(new Set(group.exerciseIds).size,group.exerciseIds.length);for(const id of group.exerciseIds)assert(ids.includes(id),id)}
assert.equal(h.personalSectionFor('pullup','capacity'),'capacity');assert.equal(h.personalSectionFor('run','strength'),'strength');
assert.deepEqual(Array.from(h.presets.jump),['reps','addedWeightKg']);assert(h.bodyweightIds.includes('bodyweight-squat'));
const crypto=require('node:crypto'),context={window:{},crypto};vm.createContext(context);vm.runInContext(fs.readFileSync('data.js','utf8'),context);context.Hybrid=context.window.Hybrid;vm.runInContext(fs.readFileSync('model.js','utf8'),context);const m=context.Hybrid.model,w=m.empty();w.sections[1].exercises.push({id:'one',exerciseId:'squat',name:'Присед',note:'',format:'sets',records:[{id:'r',weightKg:80,reps:5}]});
assert.equal(m.validate(w).sections[1].exercises[0].format,'sets');assert.equal(m.template({id:'template',name:'Шаблон',createdAt:new Date().toISOString(),workout:w}).workout.sections[1].exercises[0].format,'sets');w.sections[1].exercises[0].format='invalid';assert.throws(()=>m.validate(w));delete w.sections[1].exercises[0].format;assert(!m.validate(w).sections[1].exercises[0].format);
console.log('PASS: 21 folders (6/6/5/4), independent IDs, full historical library, arbitrary context, optional format validation/template/legacy.');
