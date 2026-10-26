'use strict';
(() => {
const $=s=>document.querySelector(s), {sections,db,model}=Hybrid, {fields,keys,uid}=model;
const clone=x=>JSON.parse(JSON.stringify(x)), names=Object.fromEntries(fields.map(f=>[f[0],f]));
const metricNames={setsCount:'Записи / подходы',weightKgMax:'Максимальный вес, кг',addedWeightKgMax:'Максимальный доп. вес, кг',repsSum:'Повторения',durationSecSum:'Время, мин',distanceMSum:'Дистанция, км',roundsSum:'Круги',volume:'Объём, кг × повт.',pace:'Темп, мин/км'};
let history=[],draft=model.empty(),catalog=[],legacySnapshot,ready=false,busy=false,pickerSection,editingGroupId,pendingImport,waitingWorker,queue=Promise.resolve(),toastTimer;
const el=(tag,value='',className='')=>{const e=document.createElement(tag);e.textContent=value;e.className=className;return e};
const btn=(value,action,className='text-button',aria='')=>{const e=el('button',value,className);e.type='button';if(aria)e.setAttribute('aria-label',aria);e.onclick=action;return e};
const count=w=>w.sections.reduce((n,s)=>n+s.exercises.length,0),empty=w=>!count(w)&&!w.note&&!w.sessionRpe&&!(w.groups?.length);
const sorted=()=>[...history].sort((a,b)=>b.date.localeCompare(a.date)||b.completedAt.localeCompare(a.completedAt));
const dateLabel=s=>new Date(s+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
const matches=(w,id)=>w.sections.flatMap(s=>s.exercises).filter(e=>e.exerciseId===id);
function latest(id,variant=null){for(const w of sorted()){const found=matches(w,id).filter(e=>variant===null||(e.variant||'')===variant);if(found.length)return{workout:w,exercise:found[found.length-1]}}return null}
const basisNames={total:'вес общий',perHand:'вес на руку',perImplement:'вес на снаряд'};
const bodyweightNames={self:'свой вес',weighted:'с доп. весом',assisted:'с помощью'};
function result(r){const parts=fields.filter(([key])=>r[key]!==undefined&&r[key]!=='').map(([key,label,unit])=>label.toLowerCase()+' '+fmt(key==='durationSec'?Number(r[key])/60:Number(r[key]))+(unit?' '+unit:''));if(r.weightKg!==undefined&&r.weightBasis)parts.push(basisNames[r.weightBasis]);if(r.bodyweightMode)parts.push(bodyweightNames[r.bodyweightMode]);if(r.note)parts.push(r.note);return parts.join(' · ')||'Без параметров'}
function toast(s){clearTimeout(toastTimer);$('#toast').textContent=s;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,5000)}
function storageError(e){console.error(e);$('#save-state').textContent='Не сохранено';$('#storage-error').textContent='Ошибка хранения. Экспортируй JSON, не закрывая страницу. '+(e.message||'');$('#storage-error').hidden=false}
function storageOK(){$('#storage-error').hidden=true;$('#save-state').textContent='Черновик сохранён'}
function enqueue(fn){const task=queue.then(fn);queue=task.catch(()=>{});return task}
function saveDraft(){if(!ready)return;$('#save-state').textContent='Сохраняю…';const snapshot=clone(draft);enqueue(()=>db.draft(snapshot)).then(storageOK).catch(storageError)}
function saveCatalog(){const snapshot=clone(catalog);enqueue(()=>db.catalog(snapshot)).catch(storageError)}
function plural(n,words){return words[n%10===1&&n%100!==11?0:n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?1:2]}
function updateTotal(){const n=count(draft);$('#exercise-total').textContent=n+' '+plural(n,['упражнение','упражнения','упражнений']);$('#finish').disabled=!ready||busy||!n;$('#clear-draft').disabled=!ready||busy||empty(draft)}
function setBusy(v){busy=v;if(v)document.querySelectorAll('#today-view input,#today-view textarea,#today-view select,#today-view button,#import-file,#confirm-import').forEach(e=>e.disabled=true);else{renderToday();$('#workout-date').disabled=!ready;$('#workout-note').disabled=!ready;$('#session-rpe').disabled=!ready;$('#import-file').disabled=!ready}updateTotal()}
function definition(id,name){let d=catalog.find(x=>x.id===id);if(!d){d={id,name,sectionId:null,fields:Hybrid.presets[id]||['weightKg','reps'],distanceUnit:'m',volumeEnabled:false,bodyweight:Hybrid.bodyweightIds.includes(id)};catalog.push(d);saveCatalog()}return d}
function visible(d){return d.fields.filter(k=>keys.includes(k))}
function makeRecord(source){const r={id:uid(),note:source?.note||''};keys.forEach(k=>{if(source?.[k]!==undefined&&source[k]!=='')r[k]=source[k]});for(const key of ['weightBasis','bodyweightMode'])if(source?.[key])r[key]=source[key];return r}
function renderToday(){
 $('#workout-date').value=draft.date;$('#workout-note').value=draft.note;$('#session-rpe').value=draft.sessionRpe||'';const root=$('#sections');root.replaceChildren();
 sections.forEach((section,i)=>{const data=draft.sections[i],card=el('section','','section-card');card.dataset.section=section.id;const head=el('div','','section-head'),title=el('div','','section-text');title.append(el('h2',section.title),el('p',section.subtitle));head.append(el('span',section.number,'section-number'),title,btn('+ Добавить',()=>openPicker(section),'add-button'));card.append(head);if(!data.exercises.length)card.append(el('div','Добавь упражнение в эту секцию','empty-section'));data.exercises.forEach((e,j)=>card.append(renderExercise(e,data,j)));root.append(card)});
 renderGroups();
 updateTotal()
}
const draftExercises=()=>draft.sections.flatMap((section,index)=>section.exercises.map(exercise=>({exercise,section:sections[index]})));
function renderGroups(){
 const root=$('#group-list');root.replaceChildren();$('#add-group').disabled=!ready||busy||count(draft)<2;
 for(const group of draft.groups||[]){
  const card=el('div','','group-card'),members=draftExercises().filter(item=>item.exercise.groupId===group.id).map(item=>item.exercise.name),head=el('div','','group-card-head');
  head.append(el('strong',group.name),btn('Изменить',()=>openGroup(group),'text-button'),btn('×',()=>removeGroup(group),'icon-button','Удалить связку '+group.name));card.append(head);
  const details=[...members,group.rounds?group.rounds+' '+plural(group.rounds,['круг','круга','кругов']):'',group.restSec!==undefined?'отдых '+fmt(group.restSec)+' сек':''].filter(Boolean);
  card.append(el('p',details.join(' · '),'muted'));if(group.note)card.append(el('p',group.note,'muted note-text'));root.append(card);
 }
}
function openGroup(group=null){
 if(!ready||busy||(!group&&count(draft)<2))return;
 editingGroupId=group?.id||null;$('#group-title').textContent=group?'Изменить связку':'Новая связка';$('#group-name').value=group?.name||'';$('#group-rounds').value=group?.rounds??'';$('#group-rest').value=group?.restSec??'';$('#group-note').value=group?.note||'';$('#group-error').hidden=true;
 const root=$('#group-member-options');root.replaceChildren();draftExercises().forEach(({exercise,section})=>{const label=el('label','','group-member'),input=document.createElement('input');input.type='checkbox';input.value=exercise.id;input.checked=!!group&&exercise.groupId===group.id;label.append(input,document.createTextNode(section.number+' · '+exercise.name));root.append(label)});
 $('#group-dialog').showModal();
}
function removeGroup(group){
 if(!confirm('Удалить связку «'+group.name+'»? Упражнения и записи останутся.'))return;
 draft.groups=draft.groups.filter(item=>item.id!==group.id);draftExercises().forEach(({exercise})=>{if(exercise.groupId===group.id)delete exercise.groupId});saveDraft();renderToday();
}
function move(section,i,delta){const j=i+delta;if(j<0||j>=section.exercises.length)return;[section.exercises[i],section.exercises[j]]=[section.exercises[j],section.exercises[i]];saveDraft();renderToday()}
function addRecord(exercise,source){if(exercise.records.length>=500){toast('Максимум 500 записей.');return}const record=makeRecord(source);if(definition(exercise.exerciseId,exercise.name).bodyweight&&!record.bodyweightMode)record.bodyweightMode='self';exercise.records.push(record);saveDraft();renderToday()}
function renderExercise(exercise,section,index){
 const card=el('article','','exercise');card.dataset.item=exercise.id;const def=definition(exercise.exerciseId,exercise.name);
 const head=el('div','','exercise-title'),controls=el('div','','exercise-controls');head.append(el('h3',exercise.name));
 const up=btn('↑',()=>move(section,index,-1),'icon-button','Поднять '+exercise.name),down=btn('↓',()=>move(section,index,1),'icon-button','Опустить '+exercise.name);up.disabled=index===0;down.disabled=index===section.exercises.length-1;
 controls.append(up,down,btn('×',()=>{if((exercise.records.some(model.filled)||exercise.note)&&!confirm('Убрать «'+exercise.name+'»?'))return;section.exercises.splice(index,1);saveDraft();renderToday()},'icon-button','Убрать '+exercise.name));head.append(controls);card.append(head);
 const group=(draft.groups||[]).find(item=>item.id===exercise.groupId);if(group)card.append(el('p','В связке: '+group.name,'group-tag'));
 const last=latest(exercise.exerciseId,exercise.variant||'');card.append(el('p',last?'Последний раз '+dateLabel(last.workout.date)+': '+(last.exercise.records.map(result).join(' / ')||last.exercise.note||'без параметров'):'Пока нет результатов','last-result'));
 const variantWrap=el('label','Вариант выполнения (необязательно)','variant-label'),variant=document.createElement('input');variant.type='text';variant.maxLength=100;variant.placeholder='Например: с виса, фронтальный, интервальный';variant.value=exercise.variant||'';variant.oninput=()=>{if(variant.value.trim())exercise.variant=variant.value;else delete exercise.variant;saveDraft()};variant.onchange=renderToday;variantWrap.append(variant);card.append(variantWrap);
 const options=el('details','','field-options');options.append(el('summary','Поля записи'));const toggles=el('div','','field-toggles');
 fields.forEach(([key,label])=>{const wrap=el('label','','field-toggle'),input=document.createElement('input');input.type='checkbox';input.checked=visible(def).includes(key);input.onchange=()=>{def.fields=input.checked?[...new Set([...visible(def),key])]:visible(def).filter(x=>x!==key);saveCatalog();renderToday()};wrap.append(input,document.createTextNode(label));toggles.append(wrap)});options.append(toggles);card.append(options);
 const bodyweightToggle=el('label','','field-toggle'),bodyweightInput=document.createElement('input');bodyweightInput.type='checkbox';bodyweightInput.checked=!!def.bodyweight;bodyweightInput.onchange=()=>{def.bodyweight=bodyweightInput.checked;saveCatalog();renderToday()};bodyweightToggle.append(bodyweightInput,document.createTextNode('Работа с собственным весом'));toggles.append(bodyweightToggle);
 if(visible(def).includes('distanceM')){const wrap=el('label','Единица дистанции ','unit-label'),select=document.createElement('select');[['m','метры'],['km','километры']].forEach(([v,t])=>select.add(new Option(t,v)));select.value=def.distanceUnit;select.onchange=()=>{def.distanceUnit=select.value;saveCatalog();renderToday()};wrap.append(select);card.append(wrap)}
 const rows=el('div','','record-list');exercise.records.forEach((r,j)=>rows.append(renderRecord(exercise,r,j,def)));card.append(rows);
 const actions=el('div','','record-actions');actions.append(btn('+ Запись',()=>addRecord(exercise),'secondary small'));if(exercise.records.length)actions.append(btn('Дублировать последнюю',()=>addRecord(exercise,exercise.records[exercise.records.length-1])));if(last?.exercise.records.length)actions.append(btn('Взять прошлую запись',()=>addRecord(exercise,last.exercise.records[last.exercise.records.length-1])));card.append(actions);
 const note=document.createElement('textarea');note.rows=1;note.maxLength=2000;note.className='exercise-note';note.placeholder='Заметка ко всему упражнению';note.value=exercise.note;note.oninput=()=>{exercise.note=note.value;saveDraft()};card.append(note);return card
}
function renderRecord(exercise,r,index,def){
 const row=el('div','','record-row'),head=el('div','','record-head');head.append(el('strong','Запись '+(index+1)),btn('×',()=>{exercise.records.splice(index,1);saveDraft();renderToday()},'icon-button','Удалить запись '+(index+1)));row.append(head);
 const grid=el('div','','record-fields');visible(def).forEach(key=>{const[,label,unit]=names[key],factor=key==='durationSec'?60:key==='distanceM'&&def.distanceUnit==='km'?1000:1,caption=key==='addedWeightKg'?'Доп. вес, кг (если есть)':label+(unit?', '+(key==='distanceM'&&def.distanceUnit==='km'?'км':unit):''),wrap=el('label',caption),input=document.createElement('input');input.type='number';input.min='0';input.step=key==='reps'||key==='rounds'?'1':'any';input.inputMode=key==='reps'||key==='rounds'?'numeric':'decimal';input.placeholder='—';input.value=r[key]===undefined||r[key]===''?'':String(Number(r[key])/factor);input.oninput=()=>{if(input.value==='')delete r[key];else r[key]=String(Number(input.value)*factor);if(key==='addedWeightKg'&&def.bodyweight){r.bodyweightMode=input.value&&Number(input.value)>0?'weighted':'self';const mode=row.querySelector('.bodyweight-mode');if(mode)mode.value=r.bodyweightMode}saveDraft()};wrap.append(input);grid.append(wrap)});row.append(grid);
 if(visible(def).includes('weightKg')){const wrap=el('label','Как указан вес','record-context'),select=document.createElement('select');[['','Не уточнять'],['total','Общий вес'],['perHand','На одну руку'],['perImplement','На один снаряд']].forEach(([value,label])=>select.add(new Option(label,value)));select.value=r.weightBasis||'';select.onchange=()=>{if(select.value)r.weightBasis=select.value;else delete r.weightBasis;saveDraft()};wrap.append(select);row.append(wrap)}
 if(def.bodyweight){const wrap=el('label','Нагрузка собственным весом','record-context'),select=document.createElement('select');select.className='bodyweight-mode';[['self','Свой вес'],['weighted','С дополнительным весом'],['assisted','С помощью / резиной']].forEach(([value,label])=>select.add(new Option(label,value)));select.value=r.bodyweightMode||(Number(r.addedWeightKg)>0?'weighted':'self');select.onchange=()=>{r.bodyweightMode=select.value;saveDraft()};wrap.append(select);row.append(wrap)}
 const note=document.createElement('input');note.type='text';note.maxLength=1000;note.placeholder='Заметка к записи';note.value=r.note||'';note.setAttribute('aria-label','Заметка к записи '+(index+1));note.oninput=()=>{r.note=note.value;saveDraft()};row.append(note);return row
}
function openPicker(section){pickerSection=section;$('#picker-title').textContent=section.title;$('#exercise-search').value='';$('#custom-name').value='';renderPicker();$('#picker').showModal()}
function renderPicker(){const root=$('#exercise-options'),q=$('#exercise-search').value.toLocaleLowerCase('ru').trim();root.replaceChildren();const retired=new Set(Hybrid.retiredIds||[]),map=new Map(pickerSection.exercises);catalog.filter(e=>e.id.startsWith('custom:')&&(!e.sectionId||e.sectionId===pickerSection.id)).forEach(e=>map.set(e.id,e.name));sorted().forEach(w=>w.sections.find(s=>s.id===pickerSection.id)?.exercises.forEach(e=>{if(e.exerciseId.startsWith('custom:')&&!map.has(e.exerciseId))map.set(e.exerciseId,e.name)}));for(const[id,name]of map)if(!retired.has(id)&&name.toLocaleLowerCase('ru').includes(q))root.append(btn(name+'  +',()=>addExercise(id,name),'exercise-option'));if(!root.children.length)root.append(el('p','Ничего не найдено. Можно добавить своё упражнение.','muted'))}
function addExercise(id,name){if(!ready||busy)return;if(count(draft)>=100){toast('Максимум 100 упражнений.');return}const def=definition(id,name),record=makeRecord();if(def.bodyweight)record.bodyweightMode='self';draft.sections.find(s=>s.id===pickerSection.id).exercises.push({id:uid(),exerciseId:id,name,note:'',records:[record]});saveDraft();renderToday();$('#picker').close()}
function renderHistory(){
 const summary=$('#history-summary'),n=history.length;summary.replaceChildren(el('strong',String(n)),el('span',plural(n,['тренировка сохранена','тренировки сохранены','тренировок сохранено'])));
 const root=$('#history-list');root.replaceChildren();
 if(!history.length){root.append(el('p','Собери и заверши первую тренировку.','muted'));return}
 sorted().forEach(w=>{
  const card=el('details','','history-card'),head=el('summary');
  const exercises=count(w);head.append(el('span',dateLabel(w.date),'history-date'),el('span',exercises+' '+plural(exercises,['упражнение','упражнения','упражнений']),'history-meta'));
  const body=el('div','','history-content');
  if(w.sessionRpe)body.append(el('p','Сложность: '+w.sessionRpe+'/10','effort-summary'));
  for(const group of w.groups||[]){const members=w.sections.flatMap(section=>section.exercises).filter(exercise=>exercise.groupId===group.id);if(!members.length)continue;body.append(el('p','Связка «'+group.name+'»: '+members.map(exercise=>exercise.name).join(' → ')+(group.rounds?' · '+group.rounds+' '+plural(group.rounds,['круг','круга','кругов']):'')+(group.restSec!==undefined?' · отдых '+fmt(group.restSec)+' сек':''),'group-history'));if(group.note)body.append(el('p',group.note,'muted note-text'))}
  w.sections.forEach((s,i)=>{
   if(!s.exercises.length)return;
   body.append(el('h3',sections[i].number+' / '+sections[i].title,'history-section'));
   s.exercises.forEach(e=>{
    const item=el('div','','history-item');item.append(el('strong',e.name+(e.variant?' · '+e.variant:'')));
    e.records.forEach((r,j)=>item.append(el('p',(j+1)+'. '+result(r))));
    if(e.note)item.append(el('p',e.note,'muted note-text'));
    body.append(item);
   });
  });
  if(w.note)body.append(el('p',w.note,'note-text'));
  const actions=el('div','','history-actions');
  actions.append(btn('Разбор тренировки',()=>{switchView('stats');$('#stats-workout').value=w.id;renderWorkoutStats()},'secondary'));
  actions.append(btn('Удалить тренировку',()=>deleteWorkout(w),'text-button danger','Удалить тренировку за '+dateLabel(w.date)));
  body.append(actions);
  card.append(head,body);root.append(card);
 });
}
async function deleteWorkout(workout){
 if(!ready||busy||!confirm('Удалить тренировку за '+dateLabel(workout.date)+'? Это удалит её из истории и статистики. Вернуть можно только из ранее сохранённого JSON.'))return;
 setBusy(true);
 try{await enqueue(()=>db.deleteWorkout(workout.id));history=history.filter(w=>w.id!==workout.id);renderHistory();renderStats();toast('Тренировка удалена.')}catch(error){storageError(error);toast('Не удалось удалить тренировку.')}finally{setBusy(false)}
}
function chartValue(key, value) {
 if(value===undefined||value===null||value==='')return null;
 const number=Number(value);
 if(!Number.isFinite(number))return null;
 return key==='durationSec'||key==='durationSecSum'?number/60:key==='distanceM'||key==='distanceMSum'?number/1000:number;
}
function makeChart(title, points, fixedMax = null) {
 const root=el('div','','metric-chart');root.append(el('strong',title,'metric-chart-title'));
 const scroll=el('div','','metric-chart-scroll'),columns=el('div','','metric-chart-columns');
 const maximum=fixedMax||Math.max(1,...points.map(point=>point.value||0));
 points.forEach(point=>{
  const column=el('div','','metric-chart-point'),value=el('span',point.value===null?'—':fmt(point.value),'metric-chart-value');
  const track=el('div','','metric-chart-track'),bar=el('div','','metric-chart-bar');
  bar.style.height=point.value===null||point.value===0?'0%':Math.max(4,point.value/maximum*100)+'%';
  track.append(bar);column.append(value,track,el('span',point.label,'metric-chart-label'));columns.append(column);
 });
 scroll.append(columns);root.append(scroll);return root;
}
function renderWorkoutStats(){
 const root=$('#workout-stats');root.replaceChildren();
 const workout=history.find(w=>w.id===$('#stats-workout').value);
 if(!workout){root.append(el('p','Выбери тренировку для разбора.','muted'));return}
 const totalRecords=workout.sections.reduce((n,s)=>n+s.exercises.reduce((m,e)=>m+e.records.length,0),0);
 root.append(el('p',count(workout)+' '+plural(count(workout),['упражнение','упражнения','упражнений'])+' · '+totalRecords+' '+plural(totalRecords,['запись','записи','записей'])+(workout.sessionRpe?' · сложность '+workout.sessionRpe+'/10':''),'muted'));
 for(const group of workout.groups||[]){const members=workout.sections.flatMap(section=>section.exercises).filter(exercise=>exercise.groupId===group.id);if(members.length)root.append(el('p','Связка «'+group.name+'»: '+members.map(exercise=>exercise.name).join(' → ')+(group.rounds?' · '+group.rounds+' '+plural(group.rounds,['круг','круга','кругов']):'')+(group.restSec!==undefined?' · отдых '+fmt(group.restSec)+' сек':''),'group-history'))}
 workout.sections.forEach((section,i)=>{
  if(!section.exercises.length)return;
  root.append(el('h3',sections[i].title,'workout-section-title'));
  section.exercises.forEach(exercise=>{
   const card=el('section','','workout-exercise'),heading=el('h4',exercise.name+(exercise.variant?' · '+exercise.variant:''));
   card.append(heading);
   const summary=model.metrics(exercise),chips=el('div','','metric-chips');
   const bases=new Set(exercise.records.filter(record=>record.weightKg!==undefined).map(record=>record.weightBasis||''));
   if(bases.size===1&&[...bases][0])chips.append(el('span',basisNames[[...bases][0]],'metric-chip'));
   Object.entries(metricNames).forEach(([key,label])=>{
    if(summary[key]===undefined||key==='pace'||(bases.size>1&&['weightKgMax','volume'].includes(key))||(key==='volume'&&!catalog.find(d=>d.id===exercise.exerciseId)?.volumeEnabled))return;
    chips.append(el('span',label+': '+fmt(chartValue(key,summary[key])),'metric-chip'));
   });
   card.append(chips);
   for(const [key,label,unit] of fields){
    if(key==='weightKg'&&bases.size>1)continue;
    if(!exercise.records.some(record=>record[key]!==undefined))continue;
    const chartLabel=label+(unit?', '+(key==='durationSec'?'мин':key==='distanceM'?'км':unit):'');
    card.append(makeChart(chartLabel,exercise.records.map((record,index)=>({label:String(index+1),value:chartValue(key,record[key])}))));
   }
   const rows=el('ol','','workout-records');
   exercise.records.forEach(record=>rows.append(el('li',result(record))));
   if(rows.children.length)card.append(rows);
   if(bases.size>1)card.append(el('p','Вес указан разными способами; максимум и график веса здесь не объединяются. Выбери способ в статистике упражнения.','muted'));
   if(exercise.note)card.append(el('p',exercise.note,'muted note-text'));
   root.append(card);
  });
 });
 if(workout.note)root.append(el('p',workout.note,'note-text'));
}
function renderVariantOptions(){
 const id=$('#stats-exercise').value,select=$('#stats-variant'),previous=select.value;
 const variants=new Set();
 history.forEach(workout=>matches(workout,id).forEach(exercise=>{if(exercise.variant)variants.add(exercise.variant)}));
 select.replaceChildren(new Option('Все варианты',''));
 [...variants].sort((a,b)=>a.localeCompare(b,'ru')).forEach(variant=>select.add(new Option(variant,variant)));
 select.value=variants.has(previous)?previous:'';
 $('#variant-option').hidden=!variants.size;
}
function renderBasisOptions(){
 const id=$('#stats-exercise').value,variant=$('#stats-variant').value,select=$('#stats-basis'),previous=select.value;
 const bases=new Set();
 history.forEach(workout=>matches(workout,id).filter(exercise=>!variant||(exercise.variant||'')===variant).forEach(exercise=>exercise.records.filter(record=>record.weightKg!==undefined).forEach(record=>bases.add(record.weightBasis||''))));
 select.replaceChildren(new Option('Все способы','all'));
 if(bases.has(''))select.add(new Option('Не уточнено',''));
 for(const basis of model.weightBases)if(bases.has(basis))select.add(new Option(basisNames[basis],basis));
 select.value=[...select.options].some(option=>option.value===previous)?previous:'all';
 $('#basis-option').hidden=bases.size<2;
}
function renderStats(){
 const grid=$('#activity-grid');grid.replaceChildren();
 const counts=new Map();history.forEach(w=>counts.set(w.date,(counts.get(w.date)||0)+1));
 const end=new Date(model.today()+'T12:00:00'),start=new Date(end);start.setDate(start.getDate()-364-((start.getDay()+6)%7));
 for(let day=new Date(start);day<=end;day.setDate(day.getDate()+1)){
  const date=day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0')+'-'+String(day.getDate()).padStart(2,'0');
  const cell=el('span','','activity-cell level-'+Math.min(counts.get(date)||0,4));cell.title=date+': '+(counts.get(date)||0);cell.setAttribute('aria-label',cell.title);grid.append(cell);
 }
 const effortWorkouts=[...history].filter(workout=>workout.sessionRpe).sort((a,b)=>a.date.localeCompare(b.date)||a.completedAt.localeCompare(b.completedAt));
 $('#effort-panel').hidden=!effortWorkouts.length;const effortChart=$('#effort-chart');effortChart.replaceChildren();
 if(effortWorkouts.length)effortChart.append(makeChart('Сложность по тренировкам',effortWorkouts.map(workout=>({label:workout.date.slice(8)+'.'+workout.date.slice(5,7),value:workout.sessionRpe})),10));
 const workoutSelect=$('#stats-workout'),oldWorkout=workoutSelect.value;
 workoutSelect.replaceChildren(new Option('Выбери тренировку',''));
 sorted().forEach(w=>workoutSelect.add(new Option(dateLabel(w.date)+' · '+new Date(w.completedAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}),w.id)));
 workoutSelect.value=history.some(w=>w.id===oldWorkout)?oldWorkout:'';
 renderWorkoutStats();
 const exerciseSelect=$('#stats-exercise'),oldExercise=exerciseSelect.value,available=new Map();
 history.forEach(w=>w.sections.forEach(s=>s.exercises.forEach(e=>available.set(e.exerciseId,e.name))));
 sections.forEach(s=>s.exercises.forEach(([id,name])=>{if(available.has(id))available.set(id,name)}));
 exerciseSelect.replaceChildren(new Option('Выбери упражнение',''));
 [...available].sort((a,b)=>a[1].localeCompare(b[1],'ru')).forEach(([id,name])=>exerciseSelect.add(new Option(name,id)));
 exerciseSelect.value=available.has(oldExercise)?oldExercise:'';
 renderVariantOptions();renderBasisOptions();renderExerciseStats();
}
function renderExerciseStats(){
 const id=$('#stats-exercise').value,variant=$('#stats-variant').value,basis=$('#stats-basis').value,metric=$('#stats-metric'),graph=$('#stats-graph'),list=$('#stats-history');
 graph.replaceChildren();list.replaceChildren();
 $('#volume-option').hidden=!id;
 if(!id){metric.replaceChildren();list.append(el('p','Выбери упражнение.','muted'));return}
 const def=definition(id,$('#stats-exercise').selectedOptions[0]?.textContent||id);
 $('#volume-toggle').checked=!!def.volumeEnabled;
 const selectedBasis=basis==='all'?null:basis,days=model.dailyMetrics(history,id,variant,selectedBasis),available=new Set(days.flatMap(day=>Object.keys(day.metrics))),previous=metric.value,mixedBasis=!$('#basis-option').hidden&&basis==='all';
 metric.replaceChildren();
 Object.entries(metricNames).filter(([key])=>available.has(key)&&!(mixedBasis&&['weightKgMax','volume'].includes(key))&&(key!=='volume'||def.volumeEnabled)).forEach(([key,label])=>metric.add(new Option(label,key)));
 metric.value=[...metric.options].some(option=>option.value===previous)?previous:metric.options[0]?.value||'';
 const key=metric.value,points=days.map(day=>({label:day.date.slice(8)+'.'+day.date.slice(5,7),value:chartValue(key,day.metrics[key])}));
 if(points.length)graph.append(makeChart(metricNames[key]+' по дням',points));
 else graph.append(el('p','Для выбранной метрики пока нет данных.','muted'));
 const entries=sorted().flatMap(w=>matches(w,id).filter(e=>!variant||(e.variant||'')===variant).map(e=>({date:w.date,exercise:e,records:selectedBasis===null?e.records:e.records.filter(record=>(record.weightBasis||'')===selectedBasis)})).filter(e=>e.records.length));
 entries.forEach(entry=>{
  const card=el('div','','stats-entry');
  card.append(el('strong',dateLabel(entry.date)+(entry.exercise.variant?' · '+entry.exercise.variant:'')));
  entry.records.forEach((record,index)=>card.append(el('p',(index+1)+'. '+result(record))));
  if(entry.exercise.note)card.append(el('p',entry.exercise.note,'muted'));
  list.append(card);
 });
 if(!entries.length)list.append(el('p','Пока нет результатов.','muted'));
}
function switchView(name){document.querySelectorAll('.view').forEach(e=>e.hidden=e.id!==name+'-view');document.querySelectorAll('[data-view]').forEach(b=>{const active=b.dataset.view===name;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});if(name==='history')renderHistory();if(name==='stats')renderStats();window.scrollTo(0,0)}
function validateDefinition(d){if(!d||typeof d.id!=='string'||!d.id||d.id.length>150||typeof d.name!=='string'||!d.name.trim()||d.name.length>100||!Array.isArray(d.fields)||d.fields.some(k=>!keys.includes(k))||!['m','km'].includes(d.distanceUnit)||typeof d.volumeEnabled!=='boolean'||(d.bodyweight!==undefined&&typeof d.bodyweight!=='boolean'))throw Error('Некорректная настройка упражнения.');return{id:d.id,name:d.name,sectionId:d.sectionId||null,fields:[...new Set(d.fields)],distanceUnit:d.distanceUnit,volumeEnabled:d.volumeEnabled,bodyweight:d.bodyweight??Hybrid.bodyweightIds.includes(d.id)}}
function validateBackup(raw){if(!raw||raw.app!=='hybrid-training'||![1,2].includes(raw.schemaVersion)||!Array.isArray(raw.history)||raw.history.length>10000)throw Error('Нужен JSON-экспорт «Гибрид» версии 1 или 2.');const data={history:raw.history.map(w=>raw.schemaVersion===1?model.legacy(w,true):model.validate(w,true)),draft:raw.draft==null?null:raw.schemaVersion===1?model.legacy(raw.draft):model.validate(raw.draft,false,true),catalog:raw.schemaVersion===2&&Array.isArray(raw.catalog)?raw.catalog.map(validateDefinition):[]},ids=new Set();data.history.forEach(w=>{if(ids.has(w.id))throw Error('Повторяются ID тренировок.');ids.add(w.id)});return data}
function planImport(backup,current){const byId=new Map(current.history.map(w=>[w.id,w])),added=[];let skipped=0;backup.history.forEach(w=>{const old=byId.get(w.id);if(!old)added.push(w);else if(JSON.stringify(old)===JSON.stringify(w))skipped++;else throw Error('Конфликт: тренировки с одинаковым ID отличаются. Импорт отменён.')});const nextCatalog=[...catalog];backup.catalog.forEach(d=>{if(!nextCatalog.some(e=>e.id===d.id))nextCatalog.push(d)});return{added,skipped,draft:backup.draft&&(!current.draft||empty(current.draft))?backup.draft:null,catalog:nextCatalog}}
async function finish(){if(!ready||busy||!count(draft))return;const invalid=[...document.querySelectorAll('#today-view input')].find(e=>!e.checkValidity());if(invalid){invalid.reportValidity();return}let workout;try{workout=model.validate({...clone(draft),id:uid(),completedAt:new Date().toISOString()},true)}catch(e){toast(e.message);return}if(!workout.sections.some(s=>s.exercises.some(e=>e.records.length||e.note.trim()))&&!workout.note.trim()){toast('Добавь результат или заметку.');return}setBusy(true);try{await enqueue(()=>db.finish(workout));history.push(workout);draft=model.empty();renderToday();storageOK();switchView('history');toast('Тренировка сохранена.')}catch(e){storageError(e)}finally{setBusy(false)}}
async function exportData(){if(busy)return;const data={app:'hybrid-training',schemaVersion:2,exportedAt:new Date().toISOString(),history:clone(history),draft:clone(draft),catalog:clone(catalog)};if(legacySnapshot)data.legacySnapshot=legacySnapshot;const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='hybrid-training-'+model.today()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);$('#backup-info').textContent='Файл подготовлен. Сохрани его в «Файлы» или iCloud Drive.';if(ready)enqueue(()=>db.backup(new Date().toISOString())).catch(storageError)}
async function previewImport(ev){const file=ev.target.files[0];ev.target.value='';pendingImport=null;const box=$('#import-preview');box.replaceChildren();box.hidden=true;if(!file||!ready||busy)return;try{if(file.size>10*1024*1024)throw Error('Максимальный размер файла — 10 МБ.');const backup=validateBackup(JSON.parse(await file.text()));await queue;const current=await db.read(),plan=planImport(backup,{history:current.history,draft});pendingImport=backup;box.append(el('p','Новых тренировок: '+plan.added.length+'. Уже есть: '+plan.skipped+'. '+(plan.draft?'Черновик восстановится.':'Текущий черновик сохранится.')));const b=btn('Импортировать',applyImport,'primary');b.id='confirm-import';box.append(b);box.hidden=false}catch(e){box.append(el('p',e instanceof SyntaxError?'Не удалось прочитать JSON.':e.message));box.hidden=false}}
async function applyImport(){if(!pendingImport||busy||!ready)return;setBusy(true);try{const plan=await enqueue(async()=>{const current=await db.read(),plan=planImport(pendingImport,{history:current.history,draft});await db.import(plan.added,plan.draft,plan.catalog);history=[...current.history,...plan.added];catalog=plan.catalog;return plan});if(plan.draft)draft=plan.draft;pendingImport=null;$('#import-preview').hidden=true;renderToday();renderHistory();storageOK();toast('Добавлено тренировок: '+plan.added.length+'.')}catch(e){toast(e.message)}finally{setBusy(false)}}
function setupWorker(){if(!('serviceWorker'in navigator)){$('#connection').textContent='Офлайн недоступен';return}const state=()=>$('#connection').textContent=!navigator.onLine?(navigator.serviceWorker.controller?'Без сети · офлайн':'Без сети'):(navigator.serviceWorker.controller?'Офлайн готов':'Готовим офлайн…');navigator.serviceWorker.addEventListener('controllerchange',state);window.addEventListener('online',state);window.addEventListener('offline',state);navigator.serviceWorker.register('./service-worker.js').then(reg=>{const show=()=>{if(reg.waiting&&navigator.serviceWorker.controller){waitingWorker=reg.waiting;$('#update-banner').hidden=false}};show();reg.addEventListener('updatefound',()=>reg.installing?.addEventListener('statechange',show));state()}).catch(e=>{console.error(e);$('#connection').textContent='Офлайн недоступен'});$('#update-app').onclick=async()=>{if(!waitingWorker||busy||!ready)return;setBusy(true);try{await enqueue(()=>db.draft(clone(draft)));navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});waitingWorker.postMessage({type:'SKIP_WAITING'})}catch(e){storageError(e);setBusy(false)}}}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));$('#close-picker').onclick=()=>$('#picker').close();$('#exercise-search').oninput=renderPicker;
$('#add-group').onclick=()=>openGroup();$('#close-group').onclick=()=>$('#group-dialog').close();
$('#group-form').onsubmit=event=>{event.preventDefault();if(!ready||busy)return;const selected=new Set([...document.querySelectorAll('#group-member-options input:checked')].map(input=>input.value));if(selected.size<2){$('#group-error').textContent='Выбери хотя бы два упражнения.';$('#group-error').hidden=false;return}const id=editingGroupId||uid(),group={id,name:$('#group-name').value.trim(),note:$('#group-note').value.trim()};if($('#group-rounds').value!=='')group.rounds=Number($('#group-rounds').value);if($('#group-rest').value!=='')group.restSec=Number($('#group-rest').value);draft.groups??=[];const position=draft.groups.findIndex(item=>item.id===id);if(position<0)draft.groups.push(group);else draft.groups[position]=group;draftExercises().forEach(({exercise})=>{if(selected.has(exercise.id))exercise.groupId=id;else if(exercise.groupId===id)delete exercise.groupId});saveDraft();$('#group-dialog').close();renderToday()};
$('#custom-form').onsubmit=ev=>{ev.preventDefault();const name=$('#custom-name').value.trim();if(!name||!pickerSection)return;const normalized=name.toLocaleLowerCase('ru').replace(/\s+/g,' '),match=pickerSection.exercises.find(([,n])=>n.toLocaleLowerCase('ru')===normalized)||catalog.find(e=>e.id.startsWith('custom:')&&(!e.sectionId||e.sectionId===pickerSection.id)&&e.name.toLocaleLowerCase('ru').replace(/\s+/g,' ')===normalized),id=match?(Array.isArray(match)?match[0]:match.id):'custom:'+uid();if(!match){catalog.push({id,name,sectionId:pickerSection.id,fields:['weightKg','reps'],distanceUnit:'m',volumeEnabled:false,bodyweight:false});saveCatalog()}addExercise(id,name)};
$('#workout-date').oninput=()=>{draft.date=$('#workout-date').value;saveDraft()};$('#workout-note').oninput=()=>{draft.note=$('#workout-note').value;saveDraft();updateTotal()};$('#session-rpe').onchange=()=>{if($('#session-rpe').value)draft.sessionRpe=Number($('#session-rpe').value);else delete draft.sessionRpe;saveDraft()};$('#finish').onclick=finish;$('#clear-draft').onclick=()=>{if(!ready||busy||!confirm('Очистить черновик?'))return;draft=model.empty();saveDraft();renderToday()};$('#export').onclick=exportData;$('#import-file').onchange=previewImport;$('#stats-workout').onchange=renderWorkoutStats;$('#stats-exercise').onchange=()=>{renderVariantOptions();renderBasisOptions();renderExerciseStats()};$('#stats-variant').onchange=()=>{renderBasisOptions();renderExerciseStats()};$('#stats-basis').onchange=renderExerciseStats;$('#stats-metric').onchange=renderExerciseStats;$('#volume-toggle').onchange=()=>{const d=catalog.find(e=>e.id===$('#stats-exercise').value);if(!d)return;d.volumeEnabled=$('#volume-toggle').checked;saveCatalog();renderExerciseStats()};
setBusy(true);renderToday();db.open().then(async()=>{let data=await db.read();if(data.history.some(w=>w.schemaVersion!==2)||(data.draft&&data.draft.schemaVersion!==2)){const snapshot={migratedAt:new Date().toISOString(),history:data.history,draft:data.draft},migrated=data.history.map(w=>w.schemaVersion===2?w:model.legacy(w,true)),next=data.draft?(data.draft.schemaVersion===2?data.draft:model.legacy(data.draft)):null;await db.migrate(migrated,next,snapshot);data=await db.read();toast('Старая история перенесена.')}history=data.history.map(w=>model.validate(w,true));draft=data.draft?model.validate(data.draft,false,true):model.empty();catalog=Array.isArray(data.catalog)?data.catalog.map(validateDefinition):[];legacySnapshot=data.legacySnapshot;ready=true;renderToday();storageOK();setBusy(false);if(data.backup)$('#backup-info').textContent='Последний экспорт: '+new Date(data.backup).toLocaleString('ru-RU')}).catch(e=>{setBusy(false);storageError(e)});setupWorker();
})();
