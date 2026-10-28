'use strict';
(() => {
const $=s=>document.querySelector(s), {sections,db,model}=Hybrid, {fields,keys,uid}=model;
const clone=x=>JSON.parse(JSON.stringify(x)), names=Object.fromEntries(fields.map(f=>[f[0],f]));
const metricNames={successfulWeightKgMax:'Максимальный подтверждённый успешный вес, кг',distanceMMax:'Максимальная дистанция записи, м',successfulAttempts:'Успешные попытки',failedAttempts:'Неудачные попытки',totalAttempts:'Учтённые попытки',successRate:'Успешность учтённых попыток, %',setsCount:'Записи / подходы',weightKgMax:'Максимальный вес, кг',addedWeightKgMax:'Максимальный доп. вес, кг',repsSum:'Повторения',durationSecSum:'Время, мин',distanceMSum:'Дистанция, км',roundsSum:'Круги',volume:'Объём, кг × повт.',pace:'Темп, мин/км'};
let statsExerciseId='',history=[],draft=model.empty(),catalog=[],templates=[],legacySnapshot,ready=false,busy=false,pickerSection,pickerGroupId,editingGroupId,groupSectionId,editingWorkoutId,editingOriginalDraft,editingBase,pendingImport,waitingWorker,queue=Promise.resolve(),toastTimer,undoAction;
const collapsedExercises=new Set(),progressSelection=new Map();let progressData;
const el=(tag,value='',className='')=>{const e=document.createElement(tag);e.textContent=value;e.className=className;return e};
const btn=(value,action,className='text-button',aria='')=>{const e=el('button',value,className);e.type='button';if(aria)e.setAttribute('aria-label',aria);e.onclick=action;return e};
const count=w=>w.sections.reduce((n,s)=>n+s.exercises.length,0),empty=w=>!count(w)&&!w.note&&!w.sessionRpe&&!Object.keys(w.sectionRpe||{}).length&&!(w.groups?.length);
const sorted=()=>[...history].sort((a,b)=>b.date.localeCompare(a.date)||b.completedAt.localeCompare(a.completedAt));
const dateLabel=s=>new Date(s+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
const matches=(w,id)=>w.sections.flatMap(s=>s.exercises).filter(e=>e.exerciseId===id);
function variantsFor(id,def){const seen=new Set(),values=[];for(const value of [...sorted().flatMap(workout=>matches(workout,id).map(exercise=>exercise.variant).filter(Boolean)),...(def.variants||[]),...(Hybrid.defaultVariants?.[id]||[])]){const key=value.toLocaleLowerCase('ru').trim();if(key&&!seen.has(key)){seen.add(key);values.push(value)}}return values}
function latest(id,variant=null){for(const w of sorted()){if(w.id===editingWorkoutId||w.date>(editingBase?.date||draft.date))continue;const found=matches(w,id).filter(e=>variant===null||(e.variant||'')===variant);if(found.length)return{workout:w,exercise:found[found.length-1]}}return null}
const basisNames={total:'вес общий',perHand:'вес на руку',perImplement:'вес на снаряд'};
const bodyweightNames={self:'свой вес',weighted:'с доп. весом',assisted:'с помощью'};
function result(r){const parts=fields.filter(([key])=>r[key]!==undefined&&r[key]!=='').map(([key,label,unit])=>label.toLowerCase()+' '+(key==='durationSec'?model.formatDuration(r[key]):fmt(Number(r[key])))+(key==='durationSec'?' мин:сек':unit?' '+unit:''));if(r.weightKg!==undefined&&r.weightBasis)parts.push(basisNames[r.weightBasis]);if(r.bodyweightMode)parts.push(bodyweightNames[r.bodyweightMode]);if(r.kind)parts.push({warmup:'разминка',technique:'техника',working:'рабочий'}[r.kind]);if(r.attempts)parts.push('попытки: '+r.attempts.successful+' успешных / '+r.attempts.failed+' неудачных, всего '+(Number(r.attempts.successful)+Number(r.attempts.failed)));if(r.note)parts.push(r.note);return parts.join(' · ')||'Без параметров'}
function allProfiles(){return Hybrid.coach.profiles(catalog)}
function traitsFor(id){return allProfiles().find(p=>p.id===id)||null}
function traitText(id){const p=traitsFor(id);if(!p)return'';return [p.patterns.map(k=>Hybrid.traitLabels.patterns[k]).join(', '),p.primaryQualities.map(k=>Hybrid.traitLabels.qualities[k]).join(', ')].filter(Boolean).join(' · ')}
function choices(title,items,values=[]){const box=el('details','','profile-choices');box.append(el('summary',title));for(const [key,label] of items){const wrap=el('label'),input=document.createElement('input');input.type='checkbox';input.value=key;input.checked=values.includes(key);wrap.append(input,document.createTextNode(label));box.append(wrap)}return box}
function selected(box){return [...box.querySelectorAll('input:checked')].map(input=>input.value)}
function selectControl(label,items,value=''){const wrap=el('label',label,'profile-control'),input=document.createElement('select');items.forEach(([key,name])=>input.add(new Option(name,key)));input.value=value;wrap.append(input);return {wrap,input}}
function renderLibrarySettings(){const root=$('#personalization');if(!root)return;root.replaceChildren();
 root.append(el('h3','Управление упражнениями'));const search=document.createElement('input');search.type='search';search.placeholder='Найти в библиотеке, включая скрытые';search.id='library-search';search.setAttribute('aria-label','Найти в библиотеке');root.append(search);const select=document.createElement('select');select.id='profile-exercise';select.setAttribute('aria-label','Упражнение для настройки');root.append(select);const editor=el('div');root.append(editor);
 const refill=()=>{const previous=select.value;select.replaceChildren(new Option('Выбери упражнение',''));allProfiles().filter(p=>p.name.toLocaleLowerCase('ru').includes(search.value.toLocaleLowerCase('ru'))).sort((a,b)=>a.name.localeCompare(b.name,'ru')).forEach(p=>select.add(new Option(p.name+(p.status==='hidden'?' · скрыто':''),p.id)));select.value=[...select.options].some(o=>o.value===previous)?previous:'';renderEditor()};
 function renderEditor(){editor.replaceChildren();if(!select.value)return;const p=allProfiles().find(p=>p.id===select.value),def=definition(p.id,p.name),form=document.createElement('form');form.id='profile-form';
 const status=selectControl('Видимость',[['main','Основное'],['additional','Дополнительное'],['hidden','Скрытое']],p.status);status.input.id='profile-status';form.append(status.wrap);
 const block=selectControl('Блок',[['','Не указывать'],...sections.map(s=>[s.id,s.title])],p.sectionId||'');block.input.disabled=!p.id.startsWith('custom:');form.append(block.wrap);
 const patterns=choices('Двигательные паттерны',Object.entries(Hybrid.traitLabels.patterns),p.patterns),primary=choices('Основные физические качества',Object.entries(Hybrid.traitLabels.qualities),p.primaryQualities);const advanced=el('details','','advanced-settings');advanced.append(el('summary','Классификация для статистики'),patterns,primary);form.append(advanced);
 form.append(el('p','Пустые характеристики остаются неизвестными. Изменение профиля меняет классификацию истории, но сохраняет сами результаты.','muted'));const save=el('button','Сохранить упражнение','secondary');save.type='submit';form.append(save);
 form.onsubmit=async event=>{event.preventDefault();if(!ready||busy)return;try{const next=validateDefinition({...def,status:status.input.value,sectionId:block.input.value||null,profile:{...(def.profile||{}),patterns:selected(patterns),primaryQualities:selected(primary)}}),nextCatalog=catalog.map(d=>d.id===next.id?next:d);save.disabled=true;await enqueue(()=>db.catalog(nextCatalog));catalog=nextCatalog;renderToday();toast('Профиль сохранён. История не удалена.');refill()}catch(error){toast(error.message);save.disabled=false}};editor.append(form);
 }search.oninput=refill;select.onchange=renderEditor;refill();
}
function renderProfileAnalysis(){const root=$('#profile-analysis');if(!root)return;const value=$('#profile-period').value,end=model.today(),date=new Date(end+'T12:00:00Z');if(value!=='all')date.setUTCDate(date.getUTCDate()-Number(value)+1);const data=Hybrid.coach.analyze(history,allProfiles(),{start:value==='all'?'':date.toISOString().slice(0,10),end});root.replaceChildren(el('p','Занятий: '+data.workouts.length+'. Показано присутствие работы, а не уровень подготовки или интенсивность. Один паттерн учитывается не более одного раза за занятие.'));for(const [key,title,labels] of [['patterns','Двигательные паттерны',Hybrid.traitLabels.patterns],['primary','Основные качества',Hybrid.traitLabels.qualities]]){root.append(el('h3',title));const table=el('table','','profile-table');for(const [id,label] of Object.entries(labels)){const row=el('tr');row.append(el('td',label),el('td',(data[key][id]||0)+' / '+data.workouts.length));table.append(row)}root.append(table)}if(data.unknown)root.append(el('p','Упражнений без известных характеристик: '+data.unknown+'. Их свойства не определяются автоматически.','muted'));}

function timeInput(record,onChange,label='Время, сек или мин:сек'){
 const input=document.createElement('input');input.type='text';input.inputMode='text';input.placeholder='0:30';input.setAttribute('aria-label',label);input.value=model.formatDuration(record.durationSec);
 input.oninput=()=>{try{const seconds=model.parseDuration(input.value);input.setCustomValidity('');if(seconds===null)delete record.durationSec;else record.durationSec=seconds;onChange()}catch(error){input.setCustomValidity(error.message)}};return input;
}
function confirmControl(record,label='Подтвердить выполнение'){
 const button=btn(record.pending?label:'Выполнено ✓',()=>{if(record.pending){const invalid=[...button.parentElement.querySelectorAll('input')].find(input=>!input.checkValidity());if(invalid){invalid.reportValidity();return}delete record.pending;record.marked=true;saveDraft();renderToday()}},'secondary small confirm-record');button.disabled=!record.pending;return button;
}
function deleteRecord(exercise,index){const removed=clone(exercise.records[index]),workout=draft;exercise.records.splice(index,1);saveDraft();renderToday();toast('Запись удалена. Вернуть можно в течение 10 секунд.',()=>{if(draft!==workout||!draft.sections.some(s=>s.exercises.includes(exercise))){toast('Отмена недоступна: тренировка или упражнение изменены.');return}if(exercise.records.length>=500){toast('Нельзя вернуть: достигнут предел записей.');return}exercise.records.splice(Math.min(index,exercise.records.length),0,removed);saveDraft();renderToday();toast('Запись восстановлена.')},10000)}

function toast(s,action=null,timeout=5000){clearTimeout(toastTimer);undoAction=action;$('#toast').replaceChildren(el('span',s));if(action)$('#toast').append(btn('Вернуть',()=>{const restore=undoAction;undoAction=null;clearTimeout(toastTimer);if(restore)restore()},'text-button undo-button'));$('#toast').hidden=false;toastTimer=setTimeout(()=>{undoAction=null;$('#toast').replaceChildren(el('span',action?'Отмена удаления больше недоступна.':s));toastTimer=setTimeout(()=>$('#toast').hidden=true,2000)},timeout)}
function storageError(e){console.error(e);$('#save-state').textContent='Не сохранено';$('#storage-error').textContent='Ошибка хранения. Экспортируй JSON, не закрывая страницу. '+(e.message||'');$('#storage-error').hidden=false}
function storageOK(){$('#storage-error').hidden=true;$('#save-state').textContent='Черновик сохранён'}
function enqueue(fn){const task=queue.then(fn);queue=task.catch(()=>{});return task}
function editingState(){return editingWorkoutId?{workoutId:editingWorkoutId,base:clone(editingBase),workout:clone(draft)}:null}
function saveDraft(){if(!ready)return;if(editingWorkoutId){$('#save-state').textContent='Редактирование истории';const snapshot=editingState();enqueue(()=>db.editing(snapshot)).catch(storageError);return}$('#save-state').textContent='Сохраняю…';const snapshot=clone(draft);enqueue(()=>db.draft(snapshot)).then(storageOK).catch(storageError)}
function saveCatalog(){const snapshot=clone(catalog);enqueue(()=>db.catalog(snapshot)).catch(storageError)}
function saveTemplates(){const snapshot=clone(templates);enqueue(()=>db.templates(snapshot)).catch(storageError)}
function plural(n,words){return words[n%10===1&&n%100!==11?0:n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?1:2]}
function updateTotal(){const n=count(draft),editing=!!editingWorkoutId;$('#exercise-total').textContent=n+' '+plural(n,['упражнение','упражнения','упражнений']);$('#finish').disabled=!ready||busy||(!n&&!(draft.groups||[]).length);$('#finish').innerHTML=editing?'Сохранить изменения <span aria-hidden="true">↗</span>':'Завершить <span aria-hidden="true">↗</span>';$('#clear-draft').textContent=editing?'Отменить редактирование':'Очистить черновик';$('#clear-draft').disabled=!ready||busy||(editing?false:empty(draft))}
function setBusy(v){busy=v;if(v)document.querySelectorAll('#today-view input,#today-view textarea,#today-view select,#today-view button,#data-view button,#import-file,#confirm-import').forEach(e=>e.disabled=true);else{document.querySelectorAll('#today-view button,#data-view button,#confirm-import').forEach(e=>e.disabled=false);renderToday();renderTemplates();$('#workout-date').disabled=!ready;$('#workout-note').disabled=!ready;$('#session-rpe').disabled=!ready;$('#import-file').disabled=!ready}updateTotal()}
function definition(id,name){let d=catalog.find(x=>x.id===id);if(!d){d={id,name,sectionId:null,fields:Hybrid.presets[id]||['weightKg','reps'],distanceUnit:'m',volumeEnabled:false,bodyweight:Hybrid.bodyweightIds.includes(id),equipment:Hybrid.equipment[id]||'',favorite:false,variants:[]};catalog.push(d);saveCatalog()}return d}
function visible(d){return d.fields.filter(k=>keys.includes(k))}
function makeRecord(source){const r={id:uid(),note:source?.note||''};keys.forEach(k=>{if(source?.[k]!==undefined&&source[k]!=='')r[k]=source[k]});for(const key of ['weightBasis','bodyweightMode','kind'])if(source?.[key])r[key]=source[key];return r}
function renderToday(){
 $('#workout-date').value=draft.date;$('#workout-note').value=draft.note;$('#session-rpe').value=draft.sessionRpe||'';
 renderQuickChoices();renderFlow();const effort=$('#block-effort');effort.replaceChildren();
 sections.filter(section=>draft.sections.find(s=>s.id===section.id)?.exercises.length).forEach(section=>effort.append(renderSectionEffort(section)));
 $('#repeat-last').disabled=!ready||busy||!history.length;$('#save-template').disabled=!ready||busy||!count(draft);
 updateTotal()
}
function renderSectionEffort(section){
 const wrap=el('label','','section-effort'),select=document.createElement('select'),hasWork=draft.sections.find(item=>item.id===section.id)?.exercises.length;
 wrap.append(el('span',section.title+' · сложность'));
 select.append(new Option('Не оценивать',''));
 for(let value=1;value<=10;value++)select.add(new Option(value+(value===1?' · очень легко':value===5?' · умеренно':value===10?' · предельно тяжело':''),String(value)));
 select.value=hasWork?(draft.sectionRpe?.[section.id]||''):'';select.disabled=!hasWork;
 select.onchange=()=>{draft.sectionRpe??={};if(select.value)draft.sectionRpe[section.id]=Number(select.value);else delete draft.sectionRpe[section.id];if(!Object.keys(draft.sectionRpe).length)delete draft.sectionRpe;saveDraft()};
 wrap.append(select);return wrap
}
const draftExercises=()=>draft.sections.flatMap((section,index)=>section.exercises.map(exercise=>({exercise,section:sections[index]})));
function groupMembers(workout,group){const members=workout.sections.flatMap((section,index)=>section.exercises.map((exercise,position)=>({exercise,section,index,position}))).filter(item=>item.exercise.groupId===group.id),order=group.order||[];return members.sort((a,b)=>{const ai=order.indexOf(a.exercise.id),bi=order.indexOf(b.exercise.id);return(ai<0?Infinity:ai)-(bi<0?Infinity:bi)})}
function groupResultText(group){const parts=[];if(group.result&&model.filled(group.result))parts.push('Итог: '+result(group.result));if(group.roundResults?.length)parts.push(group.roundResults.map(round=>'Круг '+round.round+': '+result(round)).join(' · '));return parts.join(' · ')}
function flowItems(workout){
 const items=[...(workout.groups||[]).map(group=>({type:'group',token:'g:'+group.id,group})),...workout.sections.flatMap((section,index)=>section.exercises.map((exercise,position)=>({type:'exercise',token:'e:'+exercise.id,exercise,section,index,position})).filter(item=>!item.exercise.groupId))];
 const byToken=new Map(items.map(item=>[item.token,item])),ordered=(workout.order||[]).map(token=>byToken.get(token)).filter(Boolean);
 for(const item of items)if(!ordered.includes(item))ordered.push(item);
 return ordered;
}
function ensureDraftOrder(){draft.order=flowItems(draft).map(item=>item.token)}
function syncDraftOrder(){ensureDraftOrder();saveDraft();renderToday()}
function groupSection(group){return group.sectionId&&sections.some(section=>section.id===group.sectionId)?group.sectionId:null}
function renderFlow(){
 const root=$('#group-list');root.replaceChildren();const flow=flowItems(draft);
 if(!flow.length){root.append(el('p','Добавь упражнение или комплекс. Здесь будут порядок и результаты тренировки.','flow-empty'));return}
 for(const item of flow){
  if(item.type==='exercise'){root.append(renderExercise(item.exercise,item.section,item.position));continue}
  root.append(renderGroup(item.group));
 }
}
function renderGroup(group){
 const card=el('section','','group-card'),members=groupMembers(draft,group),head=el('div','','group-card-head');card.dataset.group=group.id;
 const flow=flowItems(draft),position=flow.findIndex(item=>item.token==='g:'+group.id);
 const up=btn('↑',()=>moveFlowItem('g:'+group.id,-1),'icon-button','Поднять комплекс '+group.name),down=btn('↓',()=>moveFlowItem('g:'+group.id,1),'icon-button','Опустить комплекс '+group.name);up.disabled=position===0;down.disabled=position===flow.length-1;
 head.append(el('strong',group.name),up,down,btn('Изменить',()=>openGroup(group),'text-button'),btn('×',()=>removeGroup(group),'icon-button','Удалить комплекс '+group.name));card.append(head);
 const section=sections.find(s=>s.id===groupSection(group));if(section)card.append(el('p',section.title,'group-tag'));
 const info=[group.rounds?group.rounds+' '+plural(group.rounds,['круг','круга','кругов']):'',group.restSec!==undefined?'отдых '+fmt(group.restSec)+' сек':''].filter(Boolean);
 if(info.length)card.append(el('p',info.join(' · '),'muted'));if(group.note)card.append(el('p',group.note,'muted note-text'));
 if(group.plannedRounds)card.append(el('p','План: '+group.plannedRounds+' кругов.','pending-label'),btn('Выполнены все '+group.plannedRounds+' кругов',()=>{group.rounds=group.plannedRounds;delete group.plannedRounds;saveDraft();renderToday()},'secondary small'));
 card.append(renderGroupResults(group));
 members.forEach(({exercise,index,position})=>card.append(renderExercise(exercise,draft.sections[index],position,group)));
 card.append(btn('+ Упражнение в комплекс',()=>openPicker(null,group.id),'secondary group-add'));return card;
}
function renderGroupResults(group){
 const panel=el('details','','group-results');panel.open=!!group.result||!!group.roundResults?.length;panel.append(el('summary','Результат комплекса и кругов'));
 const hint=el('p','Необязательно. Здесь можно отметить общий итог и время или заметку по каждому кругу.','muted');panel.append(hint);
 const overall=group.result||{id:uid(),note:''},fieldsWrap=el('div','','group-result-fields');if(overall.pending)fieldsWrap.classList.add('pending-record');
 for(const [key,label,unit] of fields){const wrap=el('label',label+(key==='durationSec'?' · сек / мин:сек':unit?' · '+unit:''));if(key==='durationSec'){wrap.append(timeInput(overall,()=>{group.result=overall;saveDraft()}));fieldsWrap.append(wrap);continue}const input=document.createElement('input');input.type='number';input.min='0';input.step=key==='reps'||key==='rounds'?'1':'any';input.inputMode=key==='reps'||key==='rounds'?'numeric':'decimal';input.placeholder='—';input.value=overall[key]===undefined?'':String(key==='durationSec'?Number(overall[key])/60:overall[key]);input.oninput=()=>{group.result=overall;if(input.value==='')delete overall[key];else overall[key]=String(key==='durationSec'?Number(input.value)*60:Number(input.value));saveDraft()};wrap.append(input);fieldsWrap.append(wrap)}
 const overallNote=document.createElement('input');overallNote.type='text';overallNote.maxLength=1000;overallNote.placeholder='Заметка к итогу комплекса';overallNote.value=overall.note||'';overallNote.oninput=()=>{group.result=overall;overall.note=overallNote.value;saveDraft()};panel.append(el('h4','Общий итог'),fieldsWrap,overallNote);if(overall.pending)panel.append(el('p','Итог — неподтверждённая заготовка','pending-label'),confirmControl(overall,'Подтвердить общий итог'));
 const rounds=group.roundResults||[];const roundList=el('div','','round-result-list');rounds.forEach(round=>{const row=el('div','','round-result'),head=el('div','','round-result-head');head.append(el('strong','Круг '+round.round),btn('×',()=>{group.roundResults=rounds.filter(item=>item.id!==round.id);saveDraft();renderToday()},'icon-button','Удалить результат круга '+round.round));row.append(head);const time=el('label','Время · сек / мин:сек'),roundTime=timeInput(round,saveDraft);time.append(roundTime);if(round.pending){row.classList.add('pending-record');row.append(confirmControl(round,'Подтвердить круг '+round.round))}const note=document.createElement('input');note.type='text';note.maxLength=1000;note.placeholder='Заметка к кругу';note.value=round.note||'';note.oninput=()=>{round.note=note.value;saveDraft()};row.append(time,note);roundList.append(row)});panel.append(el('h4','Отдельные круги'),roundList);
 const nextRound=()=>{const used=new Set(rounds.map(item=>item.round));for(let n=1;n<=1000;n++)if(!used.has(n))return n;return null};const add=btn('+ Отметить круг',()=>{const round=nextRound();if(!round)return;group.roundResults??=[];group.roundResults.push({id:uid(),round,note:'',marked:true});saveDraft();renderToday()},'secondary small');if(group.rounds&&rounds.length>=group.rounds)add.disabled=true;panel.append(add);return panel
}
function openGroup(group=null,section=null){
 if(!ready||busy||(!group&&(draft.groups||[]).length>=30))return;
 editingGroupId=group?.id||null;groupSectionId=group?groupSection(group):section?.id||'capacity';$('#group-title').textContent=group?'Изменить комплекс':'Новый комплекс';$('#group-section').value=groupSectionId||'';$('#group-name').value=group?.name||'';$('#group-rounds').value=group?.rounds??'';$('#group-rest').value=group?.restSec??'';$('#group-note').value=group?.note||'';$('#group-error').hidden=true;$('#group-members-field').hidden=!count(draft);
 const root=$('#group-member-options');root.replaceChildren();flowItems(draft).flatMap(item=>item.type==='group'?groupMembers(draft,item.group):[item]).forEach(({exercise,index})=>{const label=el('label','','group-member'),input=document.createElement('input');input.type='checkbox';input.value=exercise.id;input.checked=!!group&&exercise.groupId===group.id;label.append(input,document.createTextNode(sections[index].number+' · '+exercise.name));root.append(label)});
 $('#group-dialog').showModal();
}
function removeGroup(group){
 if(!confirm('Удалить связку «'+group.name+'»? Упражнения и записи останутся.'))return;
 ensureDraftOrder();const members=groupMembers(draft,group).map(item=>'e:'+item.exercise.id),position=draft.order.indexOf('g:'+group.id);draft.order.splice(position,1,...members);draft.groups=draft.groups.filter(item=>item.id!==group.id);draftExercises().forEach(({exercise})=>{if(exercise.groupId===group.id)delete exercise.groupId});syncDraftOrder();
}
function moveFlowItem(token,delta){ensureDraftOrder();const i=draft.order.indexOf(token),j=i+delta;if(i<0||j<0||j>=draft.order.length)return;[draft.order[i],draft.order[j]]=[draft.order[j],draft.order[i]];saveDraft();renderToday()}
function moveGroupMember(group,exercise,delta){const order=groupMembers(draft,group).map(item=>item.exercise.id),i=order.indexOf(exercise.id),j=i+delta;if(j<0||j>=order.length)return;[order[i],order[j]]=[order[j],order[i]];group.order=order;saveDraft();renderToday()}
function addRecord(exercise,source){if(exercise.records.length>=500){toast('Максимум 500 записей.');return}const record=makeRecord(source);if(definition(exercise.exerciseId,exercise.name).bodyweight&&!record.bodyweightMode)record.bodyweightMode='self';exercise.records.push(record);collapsedExercises.delete(exercise.id);saveDraft();renderToday();const input=document.querySelector('[data-record="'+record.id+'"] input[type="number"]');input?.focus();input?.select()}
function renderExercise(exercise,section,index,group=null){
 const card=el('article','','exercise');card.dataset.item=exercise.id;const def=definition(exercise.exerciseId,exercise.name);
 const head=el('div','','exercise-title'),controls=el('div','','exercise-controls');head.append(el('h3',exercise.name));
 const peers=group?groupMembers(draft,group).map(item=>item.exercise):flowItems(draft).map(item=>item.type==='exercise'?item.exercise:item.group),peerIndex=peers.indexOf(exercise);
 const up=btn('↑',()=>group?moveGroupMember(group,exercise,-1):moveFlowItem('e:'+exercise.id,-1),'icon-button','Поднять '+exercise.name),down=btn('↓',()=>group?moveGroupMember(group,exercise,1):moveFlowItem('e:'+exercise.id,1),'icon-button','Опустить '+exercise.name);up.disabled=peerIndex===0;down.disabled=peerIndex===peers.length-1;
 controls.append(up,down,btn('×',()=>{if((exercise.records.some(model.filled)||exercise.note)&&!confirm('Убрать «'+exercise.name+'»?'))return;const owner=draft.sections.find(s=>s.id===section.id);owner.exercises=owner.exercises.filter(e=>e.id!==exercise.id);if(group?.order)group.order=group.order.filter(id=>id!==exercise.id);syncDraftOrder()},'icon-button','Убрать '+exercise.name));head.append(controls);card.append(head);const body=el('div','','exercise-body');const folded=collapsedExercises.has(exercise.id);body.hidden=folded;const actual=exercise.records.filter(model.isActual),lastActual=actual.at(-1),summary=el('p',actual.length+' выполнено'+(exercise.records.some(r=>r.pending)?' · '+exercise.records.filter(r=>r.pending).length+' заготовок':'')+(lastActual?' · последний: '+result(lastActual):''),'collapsed-summary');summary.hidden=!folded;const toggle=btn(folded?'Развернуть':'Свернуть',()=>{const completedRecords=exercise.records.filter(model.isActual);summary.textContent=completedRecords.length+' выполнено'+(exercise.records.some(r=>r.pending)?' · '+exercise.records.filter(r=>r.pending).length+' заготовок':'')+(completedRecords.length?' · последний: '+result(completedRecords.at(-1)):'');const collapsed=!body.hidden;body.hidden=collapsed;summary.hidden=!collapsed;toggle.textContent=collapsed?'Развернуть':'Свернуть';toggle.setAttribute('aria-expanded',String(!collapsed));if(collapsed)collapsedExercises.add(exercise.id);else collapsedExercises.delete(exercise.id)},'text-button collapse-exercise');toggle.setAttribute('aria-expanded',String(!folded));head.append(toggle);card.append(summary,body);const cardRoot=card;
 body.append(el('p',(sections.find(item=>item.id===section.id)?.title||section.id)+(exercise.variant?' · '+exercise.variant:'')+(exercise.format?' · '+Hybrid.formatLabels[exercise.format]:''),'group-tag'));
 const last=latest(exercise.exerciseId,exercise.variant||''),lastRecord=last?.exercise.records[last.exercise.records.length-1];body.append(el('p',last?'Последний раз '+dateLabel(last.workout.date)+': '+(lastRecord?result(lastRecord)+(last.exercise.records.length>1?' · '+last.exercise.records.length+' '+plural(last.exercise.records.length,['запись','записи','записей']):''):last.exercise.note||'без параметров'):'Пока нет результатов','last-result'));
 if(last){const previous=el('details','','previous-sequence');previous.append(el('summary','Предыдущее выполнение · '+dateLabel(last.workout.date)));last.exercise.records.forEach((record,index)=>previous.append(el('p',(index+1)+'. '+result(record))));if(last.exercise.note)previous.append(el('p',last.exercise.note,'muted'));body.append(previous)}
 const settings=el('details','','exercise-settings');settings.append(el('summary','Вариант и поля упражнения'));const context=selectControl('Направление этой работы',sections.map(s=>[s.id,s.title]),section.id);context.input.className='exercise-context';context.input.onchange=()=>{const owner=draft.sections.find(s=>s.id===section.id),target=draft.sections.find(s=>s.id===context.input.value);owner.exercises=owner.exercises.filter(e=>e.id!==exercise.id);target.exercises.push(exercise);if(!owner.exercises.length&&draft.sectionRpe)delete draft.sectionRpe[owner.id];saveDraft();renderToday()};const format=selectControl('Формат работы',[['','Не указан'],...Object.entries(Hybrid.formatLabels)],exercise.format||'');format.input.className='exercise-format';format.input.onchange=()=>{if(format.input.value)exercise.format=format.input.value;else delete exercise.format;saveDraft()};settings.append(context.wrap,format.wrap);const profile=traitText(exercise.exerciseId);if(profile)settings.append(el('p',profile,'trait-summary'));body.append(settings);
 const variantWrap=el('label','Вариант выполнения (необязательно)','variant-label'),variant=document.createElement('input');variant.type='text';variant.maxLength=100;variant.placeholder='Например: с виса, фронтальный, интервальный';variant.value=exercise.variant||'';variant.oninput=()=>{if(variant.value.trim())exercise.variant=variant.value;else delete exercise.variant;saveDraft()};variant.onchange=()=>{const value=variant.value.trim(),known=variantsFor(exercise.exerciseId,def),canonical=known.find(item=>item.toLocaleLowerCase('ru')===value.toLocaleLowerCase('ru'));if(value){exercise.variant=canonical||value;def.variants??=[];if(!canonical&&def.variants.length<50){def.variants.push(value);saveCatalog()}}else delete exercise.variant;saveDraft();renderToday()};variantWrap.append(variant);settings.append(variantWrap);
 const suggestions=variantsFor(exercise.exerciseId,def).slice(0,5);if(suggestions.length){const chips=el('div','','variant-suggestions');suggestions.forEach(value=>chips.append(btn(value,()=>{exercise.variant=value;saveDraft();renderToday()},'variant-chip')));settings.append(chips)}
 const options=el('details','','field-options');options.append(el('summary','Поля записи'));const toggles=el('div','','field-toggles');
 fields.forEach(([key,label])=>{const wrap=el('label','','field-toggle'),input=document.createElement('input');input.type='checkbox';input.checked=visible(def).includes(key);input.onchange=()=>{def.fields=input.checked?[...new Set([...visible(def),key])]:visible(def).filter(x=>x!==key);saveCatalog();renderToday()};wrap.append(input,document.createTextNode(label));toggles.append(wrap)});options.append(toggles);settings.append(options);
 const bodyweightToggle=el('label','','field-toggle'),bodyweightInput=document.createElement('input');bodyweightInput.type='checkbox';bodyweightInput.checked=!!def.bodyweight;bodyweightInput.onchange=()=>{def.bodyweight=bodyweightInput.checked;saveCatalog();renderToday()};bodyweightToggle.append(bodyweightInput,document.createTextNode('Работа с собственным весом'));toggles.append(bodyweightToggle);
 if(visible(def).includes('distanceM')){const wrap=el('label','Единица дистанции ','unit-label'),select=document.createElement('select');[['m','метры'],['km','километры']].forEach(([v,t])=>select.add(new Option(t,v)));select.value=def.distanceUnit;select.onchange=()=>{def.distanceUnit=select.value;saveCatalog();renderToday()};wrap.append(select);settings.append(wrap)}
 const rows=el('div','','record-list');exercise.records.forEach((r,j)=>rows.append(renderRecord(exercise,r,j,def)));body.append(rows);
 const actions=el('div','','record-actions');actions.append(btn('+ Следующая запись',()=>addRecord(exercise,exercise.records.length?{...exercise.records[exercise.records.length-1],note:''}:null),'secondary small'));actions.append(btn('Пустая запись',()=>addRecord(exercise)));if(last?.exercise.records.length)actions.append(btn('Взять прошлую запись',()=>addRecord(exercise,last.exercise.records[last.exercise.records.length-1])));body.append(actions);
 const note=document.createElement('textarea');note.rows=1;note.maxLength=2000;note.className='exercise-note';note.placeholder='Заметка ко всему упражнению';note.value=exercise.note;note.oninput=()=>{exercise.note=note.value;saveDraft()};body.append(note);return cardRoot
}
function renderRecord(exercise,r,index,def){
 const row=el('div','','record-row compact-record');row.dataset.record=r.id;if(r.pending){row.classList.add('pending-record');row.append(el('p','Заготовка · не входит в результаты','pending-label'),confirmControl(r))}const shown=visible(def),main=el('div','','record-main');main.append(el('strong',String(index+1),'record-number'));
 function field(key){if(key==='durationSec'){const wrap=el('label','Время, сек / мин:сек');wrap.append(timeInput(r,saveDraft));return wrap}const[,label,unit]=names[key],factor=key==='durationSec'?60:key==='distanceM'&&def.distanceUnit==='km'?1000:1,caption=key==='addedWeightKg'?'Доп. вес, кг':label+(unit?', '+(key==='distanceM'&&def.distanceUnit==='km'?'км':unit):''),wrap=el('label',caption),input=document.createElement('input');input.type='number';input.min='0';input.step=key==='reps'||key==='rounds'?'1':'any';input.inputMode=key==='reps'||key==='rounds'?'numeric':'decimal';input.placeholder='—';input.value=r[key]===undefined||r[key]===''?'':String(Number(r[key])/factor);input.oninput=()=>{if(input.value==='')delete r[key];else r[key]=String(Number(input.value)*factor);if(key==='addedWeightKg'&&def.bodyweight){r.bodyweightMode=input.value&&Number(input.value)>0?'weighted':'self';const mode=row.querySelector('.bodyweight-mode');if(mode)mode.value=r.bodyweightMode}saveDraft()};wrap.append(input);return wrap}
 shown.slice(0,2).forEach(key=>main.append(field(key)));main.append(btn('×',()=>{deleteRecord(exercise,index)},'icon-button','Удалить запись '+(index+1)));row.append(main);
 const extra=el('details','','record-extra');extra.open=!!r.attempts||!!r.kind||!!r.note||shown.slice(2).some(key=>r[key]!==undefined)||!!r.weightBasis||(def.bodyweight&&r.bodyweightMode&&r.bodyweightMode!=='self');extra.append(el('summary','Ещё параметры / заметка'));const grid=el('div','','record-fields');shown.slice(2).forEach(key=>grid.append(field(key)));if(grid.children.length)extra.append(grid);
 if(shown.includes('weightKg')){const wrap=el('label','Как указан вес','record-context'),select=document.createElement('select');[['','Не уточнять'],['total','Общий вес'],['perHand','На одну руку'],['perImplement','На один снаряд']].forEach(([value,label])=>select.add(new Option(label,value)));select.value=r.weightBasis||'';select.onchange=()=>{if(select.value)r.weightBasis=select.value;else delete r.weightBasis;saveDraft()};wrap.append(select);extra.append(wrap)}
 if(def.bodyweight){const wrap=el('label','Нагрузка собственным весом','record-context'),select=document.createElement('select');select.className='bodyweight-mode';[['self','Свой вес'],['weighted','С дополнительным весом'],['assisted','С помощью / резиной']].forEach(([value,label])=>select.add(new Option(label,value)));select.value=r.bodyweightMode||(Number(r.addedWeightKg)>0?'weighted':'self');select.onchange=()=>{r.bodyweightMode=select.value;if(select.value!=='weighted')delete r.addedWeightKg;saveDraft();renderToday()};wrap.append(select);extra.append(wrap)}

 const ordering=el('div','','record-order');
 for(const [delta,label] of [[-1,'↑'],[1,'↓']]){const move=btn(label,()=>{const target=index+delta;if(target<0||target>=exercise.records.length)return;[exercise.records[index],exercise.records[target]]=[exercise.records[target],exercise.records[index]];saveDraft();renderToday()},'icon-button',delta<0?'Поднять запись '+(index+1):'Опустить запись '+(index+1));move.disabled=index+delta<0||index+delta>=exercise.records.length;ordering.append(move)}extra.append(ordering);
 const kindWrap=el('label','Тип подхода (необязательно)','record-context'),kind=document.createElement('select');[['','Не уточнять'],['warmup','Разминка'],['technique','Техника'],['working','Рабочий']].forEach(([v,t])=>kind.add(new Option(t,v)));kind.value=r.kind||'';kind.onchange=()=>{if(kind.value)r.kind=kind.value;else delete r.kind;saveDraft()};kindWrap.append(kind);extra.append(kindWrap);
 const attemptToggle=el('label','','attempt-toggle'),enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=!!r.attempts;attemptToggle.append(enabled,document.createTextNode('Учитывать результаты попыток'));extra.append(attemptToggle);
 const attempts=el('div','','attempt-fields'),total=el('p','','muted');attempts.hidden=!r.attempts;
 const updateTotalAttempts=()=>{total.textContent='Всего: '+(Number(r.attempts?.successful||0)+Number(r.attempts?.failed||0))+' · Повторы записываются отдельно. Неизвестные результаты не отмечай как успешные.'};
 const attemptInputs=[];
 for(const [key,label] of [['successful','Успешные'],['failed','Неудачные']]){const wrap=el('label',label),input=document.createElement('input');input.type='number';input.min='0';input.max='100000';input.step='1';input.inputMode='numeric';input.value=r.attempts?.[key]??0;input.setAttribute('aria-label',label+' попытки, запись '+(index+1));input.oninput=()=>{if(!r.attempts)return;r.attempts[key]=input.value===''?0:Number(input.value);updateTotalAttempts();saveDraft()};wrap.append(input);attempts.append(wrap);attemptInputs.push(input)}
 attempts.append(total);updateTotalAttempts();extra.append(attempts);
 enabled.onchange=()=>{if(enabled.checked){r.attempts={successful:0,failed:0};attemptInputs.forEach(input=>input.value='0')}else delete r.attempts;attempts.hidden=!enabled.checked;updateTotalAttempts();saveDraft()};
 const note=document.createElement('input');note.type='text';note.maxLength=1000;note.placeholder='Заметка к записи';note.value=r.note||'';note.setAttribute('aria-label','Заметка к записи '+(index+1));note.oninput=()=>{r.note=note.value;saveDraft()};extra.append(note);row.append(extra);return row
}
function openPicker(section=null,groupId=null){pickerSection=section;pickerGroupId=groupId;$('#picker-title').textContent=groupId?(draft.groups||[]).find(item=>item.id===groupId)?.name||'Комплекс':'Каталог упражнений';$('#picker-section').value=section?.id||'';$('#exercise-search').value='';$('#equipment-filter').value='all';$('#custom-name').value='';$('#custom-equipment').value='';renderPicker();$('#picker').showModal()}
function exerciseSection(id){return pickerSection||sections.find(s=>s.id===(catalog.find(d=>d.id===id)?.sectionId||Hybrid.personalSectionFor(id)))||sections[1]}
function favoriteIn(def,sectionId=null){if(!def)return false;if(Array.isArray(def.favoriteSections))return sectionId?def.favoriteSections.includes(sectionId):def.favoriteSections.length>0;return !!def.favorite&&(!sectionId||Hybrid.catalogGroups.some(g=>g.sectionId===sectionId&&g.exerciseIds.includes(def.id))||def.sectionId===sectionId)}
function toggleFavorite(id,name){const def=definition(id,name);if(pickerSection){const values=new Set(def.favoriteSections||sections.filter(s=>favoriteIn(def,s.id)).map(s=>s.id));if(values.has(pickerSection.id))values.delete(pickerSection.id);else values.add(pickerSection.id);def.favoriteSections=[...values];def.favorite=values.size>0}else{def.favorite=!favoriteIn(def);delete def.favoriteSections}saveCatalog();renderPicker();renderQuickChoices()}
function libraryEntries(){
 const map=new Map(sections.flatMap(s=>s.exercises));catalog.filter(d=>d.id.startsWith('custom:')).forEach(d=>map.set(d.id,d.name));
 sorted().forEach(w=>w.sections.forEach(s=>s.exercises.forEach(e=>{if(e.exerciseId.startsWith('custom:')&&!map.has(e.exerciseId))map.set(e.exerciseId,e.name)})));
 const profiles=new Map(allProfiles().map(p=>[p.id,p])),retired=new Set(Hybrid.retiredIds||[]);
 return [...map].filter(([id])=>!retired.has(id)&&profiles.get(id)?.status!=='hidden').map(([id,name])=>({id,name}));
}
function recentFor(sectionId=null){const recent=new Map();sorted().forEach(w=>w.sections.filter(s=>!sectionId||s.id===sectionId).forEach(s=>s.exercises.forEach(e=>{if(e.records.some(model.isActual)&&!recent.has(e.exerciseId))recent.set(e.exerciseId,recent.size)})));return recent}
function renderQuickChoices(){
 const root=$('#quick-blocks');root.replaceChildren();const entries=libraryEntries();
 for(const section of sections){const card=el('section','','quick-block');card.dataset.quickSection=section.id;const head=el('div','','quick-block-head');const browse=btn('Каталог',()=>openPicker(section),'text-button','Каталог · '+section.title);browse.disabled=!ready||busy;head.append(el('strong',section.title),browse);card.append(head);const recent=recentFor(section.id),favorites=entries.filter(e=>favoriteIn(catalog.find(d=>d.id===e.id),section.id)),seen=new Set(favorites.map(e=>e.id)),items=[...favorites,...entries.filter(e=>!seen.has(e.id)&&recent.has(e.id)).sort((a,b)=>recent.get(a.id)-recent.get(b.id))].slice(0,5),buttons=el('div','','quick-exercises');
 for(const item of items){const button=btn((favoriteIn(catalog.find(d=>d.id===item.id),section.id)?'★ ':'')+item.name,()=>{pickerSection=section;pickerGroupId=null;addExercise(item.id,item.name)},'variant-chip');button.disabled=!ready||busy;buttons.append(button)}
 if(!items.length)buttons.append(el('p','Выбери упражнения в каталоге. Избранное и недавние появятся здесь.','muted'));card.append(buttons);root.append(card)}
}
function renderPicker(){
 const root=$('#exercise-options'),q=$('#exercise-search').value.toLocaleLowerCase('ru').trim(),equipment=$('#equipment-filter').value,openFolders=new Set([...root.querySelectorAll('details[open]')].map(e=>e.dataset.catalogGroup||'other'));root.replaceChildren();
 const recent=recentFor(pickerSection?.id),entries=libraryEntries().filter(e=>{const groups=Hybrid.catalogGroups.filter(g=>g.exerciseIds.includes(e.id));return (!q||((e.name+' '+groups.map(g=>g.title).join(' ')).toLocaleLowerCase('ru').includes(q)||(Hybrid.defaultVariants[e.id]||[]).some(v=>(' '+v.toLocaleLowerCase('ru').replace(/[(),]/g,' ')).includes(' '+q))))&&(equipment==='all'||(catalog.find(d=>d.id===e.id)?.equipment||Hybrid.equipment[e.id]||'')===equipment)}),byId=new Map(entries.map(e=>[e.id,e]));
 function rows(items,parent){for(const {id,name} of items){const row=el('div','','picker-option-row');row.dataset.exerciseId=id;const favorite=favoriteIn(catalog.find(d=>d.id===id),pickerSection?.id);row.append(btn(name+'  +',()=>addExercise(id,name),'exercise-option'),btn(favorite?'★':'☆',()=>toggleFavorite(id,name),'favorite-button',(favorite?'Убрать из избранного: ':'В избранное: ')+name));parent.append(row)}}
 if(q){rows(entries,root);if(!entries.length)root.append(el('p','Ничего не найдено. Можно добавить своё упражнение.','muted'));return}
 const favorites=entries.filter(e=>favoriteIn(catalog.find(d=>d.id===e.id),pickerSection?.id)),seen=new Set(favorites.map(e=>e.id)),last=entries.filter(e=>!seen.has(e.id)&&recent.has(e.id)).sort((a,b)=>recent.get(a.id)-recent.get(b.id)).slice(0,5);
 if(favorites.length){root.append(el('p','ИЗБРАННОЕ','picker-group-title'));rows(favorites,root)}if(last.length){root.append(el('p','НЕДАВНИЕ','picker-group-title'));rows(last,root)}
 const other=el('details','','other-catalog-groups');other.open=openFolders.has('other');other.append(el('summary','Другие группы каталога'));
 for(const group of Hybrid.catalogGroups){const items=group.exerciseIds.map(id=>byId.get(id)).filter(Boolean);if(!items.length)continue;const box=el('details','','catalog-folder');box.dataset.catalogGroup=group.id;box.open=openFolders.has(group.id);box.append(el('summary',group.title+' · '+items.length));rows(items,box);if(!pickerSection||group.sectionId===pickerSection.id)root.append(box);else other.append(box)}
 if(other.querySelector('.catalog-folder'))root.append(other);
 const grouped=new Set(Hybrid.catalogGroups.flatMap(g=>g.exerciseIds)),extra=entries.filter(e=>!grouped.has(e.id));if(extra.length){const box=el('details','','catalog-folder');box.append(el('summary','Свои и другие упражнения'));rows(extra,box);root.append(box)}
}
function addExercise(id,name){if(!ready||busy)return;if(count(draft)>=100){toast('Максимум 100 упражнений.');return}ensureDraftOrder();const def=definition(id,name),record=makeRecord();if(def.bodyweight)record.bodyweightMode='self';const exercise={id:uid(),exerciseId:id,name,note:'',records:[record]};if(pickerGroupId){const group=(draft.groups||[]).find(g=>g.id===pickerGroupId);if(!group)return;exercise.groupId=group.id;group.order??=groupMembers(draft,group).map(item=>item.exercise.id);group.order.push(exercise.id)}else draft.order.push('e:'+exercise.id);draft.sections.find(s=>s.id===exerciseSection(id).id).exercises.push(exercise);saveDraft();renderToday();$('#picker').close()}
function renderHistory(){
 const summary=$('#history-summary'),n=history.length;summary.replaceChildren(el('strong',String(n)),el('span',plural(n,['тренировка сохранена','тренировки сохранены','тренировок сохранено'])));
 const root=$('#history-list');root.replaceChildren();
 if(!history.length){root.append(el('p','Собери и заверши первую тренировку.','muted'));return}
 sorted().forEach(w=>{
  const card=el('details','','history-card'),head=el('summary');
  const exercises=count(w);head.append(el('span',dateLabel(w.date),'history-date'),el('span',exercises+' '+plural(exercises,['упражнение','упражнения','упражнений']),'history-meta'));
  const body=el('div','','history-content');
  if(w.sessionRpe)body.append(el('p','Сложность тренировки: '+w.sessionRpe+'/10','effort-summary'));
  const blockEffort=sections.filter(section=>w.sectionRpe?.[section.id]).map(section=>section.number+' '+section.title+' · '+w.sectionRpe[section.id]+'/10');
  if(blockEffort.length)body.append(el('p','Блоки: '+blockEffort.join(' · '),'muted'));
  for(const flow of flowItems(w)){
   if(flow.type==='group'){const group=flow.group,members=groupMembers(w,group);if(!members.length&&!group.rounds&&!group.result&&!group.roundResults?.length)continue;const grouped=el('section','','history-group');grouped.append(el('h3','Комплекс «'+group.name+'»'+(group.rounds?' · '+group.rounds+' '+plural(group.rounds,['круг','круга','кругов']):'')+(group.restSec!==undefined?' · отдых '+fmt(group.restSec)+' сек':'')));if(group.note)grouped.append(el('p',group.note,'muted note-text'));const outcome=groupResultText(group);if(outcome)grouped.append(el('p',outcome,'muted note-text'));members.forEach(({exercise,index})=>{const item=el('div','','history-item');item.append(el('strong',exercise.name+(exercise.variant?' · '+exercise.variant:'')+(exercise.format?' · '+Hybrid.formatLabels[exercise.format]:'')+' · '+sections[index].title));exercise.records.forEach((record,j)=>item.append(el('p',(j+1)+'. '+result(record))));if(exercise.note)item.append(el('p',exercise.note,'muted note-text'));grouped.append(item)});body.append(grouped);continue}
   const e=flow.exercise,item=el('div','','history-item');item.append(el('strong',e.name+(e.variant?' · '+e.variant:'')+(e.format?' · '+Hybrid.formatLabels[e.format]:'')+' · '+sections[flow.index].title));e.records.forEach((r,j)=>item.append(el('p',(j+1)+'. '+result(r))));if(e.note)item.append(el('p',e.note,'muted note-text'));body.append(item);
  }
  if(w.note)body.append(el('p',w.note,'note-text'));
  const actions=el('div','','history-actions');
  actions.append(btn('Разбор тренировки',()=>{switchView('stats');$('#workout-analysis').open=true;$('#stats-workout').value=w.id;renderWorkoutStats()},'secondary'));
  actions.append(btn('Редактировать',()=>editWorkout(w),'secondary'));
  actions.append(btn('Повторить тренировку',()=>repeatWorkout(w),'secondary'));
  actions.append(btn('Удалить тренировку',()=>deleteWorkout(w),'text-button danger','Удалить тренировку за '+dateLabel(w.date)));
  body.append(actions);
  card.append(head,body);root.append(card);
 });
}
function makeFreshDraft(source){
 const copy=clone(source),groupIds=new Map(),exerciseIds=new Map();
 for(const group of copy.groups||[]){const old=group.id;group.id=uid();groupIds.set(old,group.id);if(group.rounds){group.plannedRounds=group.rounds;delete group.rounds}if(group.result){group.result.id=uid();group.result.pending=true}(group.roundResults||[]).forEach(round=>{round.id=uid();round.pending=true})}
 for(const section of copy.sections)for(const exercise of section.exercises){const old=exercise.id;exercise.id=uid();exerciseIds.set(old,exercise.id);if(exercise.groupId)exercise.groupId=groupIds.get(exercise.groupId);if(!exercise.records.length&&exercise.note.trim())exercise.records.push({id:uid(),note:exercise.note,pending:true});exercise.records.forEach(record=>{record.id=uid();delete record.attempts;record.pending=true})}
 for(const group of copy.groups||[])if(group.order)group.order=group.order.map(id=>exerciseIds.get(id)).filter(Boolean);
 copy.order=flowItems(source).map(item=>item.type==='group'?'g:'+groupIds.get(item.group.id):'e:'+exerciseIds.get(item.exercise.id));
 copy.date=model.today();copy.note='';delete copy.id;delete copy.completedAt;delete copy.sessionRpe;delete copy.sectionRpe;
 return model.validate(copy,false,true);
}
async function repeatWorkout(workout){
 if(!ready||busy)return;
 if(editingWorkoutId){toast('Сначала сохрани или отмени редактирование истории.');return}
 if(!empty(draft)&&!confirm('Заменить текущий черновик копией тренировки за '+dateLabel(workout.date)+'? Сначала экспортируй JSON, если хочешь сохранить черновик.'))return;
 let next;try{next=makeFreshDraft(workout)}catch(error){toast(error.message);return}
 setBusy(true);try{await enqueue(()=>db.draft(next));draft=next;renderToday();switchView('today');storageOK();toast('Тренировка скопирована в черновик.')}catch(error){storageError(error);toast('Не удалось повторить тренировку.')}finally{setBusy(false)}
}
function renderTemplates(){
 const root=$('#template-list');if(!root)return;root.replaceChildren();$('#save-template').disabled=!ready||busy||!count(draft);
 if(!templates.length){root.append(el('p','Сохрани текущую тренировку как заготовку для повторного использования.','muted'));return}
 templates.forEach(template=>{const item=el('article','','template-card'),meta=count(template.workout)+' '+plural(count(template.workout),['упражнение','упражнения','упражнений']);item.append(el('strong',template.name),el('p',meta,'muted'));const actions=el('div','','template-actions');actions.append(btn('Начать',()=>useTemplate(template),'secondary'));actions.append(btn('Удалить',()=>deleteTemplate(template),'text-button danger','Удалить шаблон '+template.name));item.append(actions);root.append(item)})
}
async function useTemplate(template){
 if(!ready||busy)return;
 if(editingWorkoutId){toast('Сначала сохрани или отмени редактирование истории.');return}
 if(!empty(draft)&&!confirm('Заменить текущий черновик шаблоном «'+template.name+'»? Сначала экспортируй JSON, если хочешь сохранить черновик.'))return;
 let next;try{next=makeFreshDraft(template.workout)}catch(error){toast(error.message);return}
 setBusy(true);try{await enqueue(()=>db.draft(next));draft=next;$('#templates-dialog').close();renderToday();switchView('today');storageOK();toast('Шаблон открыт в новом черновике.')}catch(error){storageError(error);toast('Не удалось открыть шаблон.')}finally{setBusy(false)}
}
async function deleteTemplate(template){
 if(!ready||busy||!confirm('Удалить шаблон «'+template.name+'»?'))return;
 const next=templates.filter(item=>item.id!==template.id);setBusy(true);try{await enqueue(()=>db.templates(next));templates=next;renderTemplates();toast('Шаблон удалён.')}catch(error){storageError(error)}finally{setBusy(false)}
}
function openTemplateDialog(){if(!ready||busy||!count(draft))return;$('#template-name').value='';$('#template-dialog').showModal();$('#template-name').focus()}
async function saveTemplate(){
 const name=$('#template-name').value.trim();if(!name||!ready||busy)return;
 let workout;try{workout=model.validate(clone(draft),false,false)}catch(error){toast(error.message);return}
 const template={id:uid(),name,createdAt:new Date().toISOString(),workout};setBusy(true);try{await enqueue(()=>db.templates([...templates,template]));templates.push(template);$('#template-dialog').close();renderTemplates();toast('Шаблон сохранён.')}catch(error){storageError(error)}finally{setBusy(false)}
}
async function deleteWorkout(workout){
 if(!ready||busy||!confirm('Удалить тренировку за '+dateLabel(workout.date)+'? Это удалит её из истории и статистики. Вернуть можно только из ранее сохранённого JSON.'))return;
 setBusy(true);
 try{await enqueue(()=>db.deleteWorkout(workout.id));history=history.filter(w=>w.id!==workout.id);renderHistory();renderStats();toast('Тренировка удалена.')}catch(error){storageError(error);toast('Не удалось удалить тренировку.')}finally{setBusy(false)}
}
function editWorkout(workout){
 if(!ready||busy)return;
 if(editingWorkoutId===workout.id){switchView('today');return}
 if(editingWorkoutId&&!confirm('Отменить текущее редактирование и открыть другую тренировку?'))return;
 if(!editingWorkoutId)editingOriginalDraft=clone(draft);editingWorkoutId=workout.id;editingBase=clone(workout);draft=clone(workout);saveDraft();renderToday();switchView('today');$('#save-state').textContent='Редактирование истории';toast('Редактируй и нажми «Сохранить изменения». Черновик сохранён отдельно.')
}
function cancelWorkoutEdit(){
 if(!editingWorkoutId)return;
 draft=editingOriginalDraft?clone(editingOriginalDraft):model.empty();editingWorkoutId=undefined;editingOriginalDraft=undefined;editingBase=undefined;enqueue(()=>db.editing(null)).catch(storageError);renderToday();storageOK();toast('Изменения в истории отменены.')
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
  const column=el('div','','metric-chart-point'),value=el('span',point.value===null?'—':point.display??fmt(point.value),'metric-chart-value');
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
 const blockEffort=sections.filter(section=>workout.sectionRpe?.[section.id]).map(section=>section.number+' '+workout.sectionRpe[section.id]+'/10');
 root.append(el('p',count(workout)+' '+plural(count(workout),['упражнение','упражнения','упражнений'])+' · '+totalRecords+' '+plural(totalRecords,['запись','записи','записей'])+(workout.sessionRpe?' · сложность '+workout.sessionRpe+'/10':'')+(blockEffort.length?' · блоки '+blockEffort.join(', '):''),'muted'));
 const ordered=[];for(const item of flowItems(workout)){if(item.type==='group'){ordered.push(item,...groupMembers(workout,item.group))}else ordered.push(item)}
 ordered.forEach(item=>{
  if(item.type==='group'){const group=item.group,members=groupMembers(workout,group),outcome=groupResultText(group);if(members.length||group.rounds||group.result||group.roundResults?.length)root.append(el('p','Комплекс «'+group.name+'»: '+members.map(entry=>entry.exercise.name).join(' → ')+(group.rounds?' · '+group.rounds+' '+plural(group.rounds,['круг','круга','кругов']):'')+(group.restSec!==undefined?' · отдых '+fmt(group.restSec)+' сек':'')+(outcome?' · '+outcome:''),'group-history'));return}
  const {exercise,index}=item;
  root.append(el('h3',sections[index].title,'workout-section-title'));
   const card=el('section','','workout-exercise'),heading=el('h4',exercise.name+(exercise.variant?' · '+exercise.variant:''));
   card.append(heading);
   const summary=model.metrics(exercise),chips=el('div','','metric-chips');
   const bases=new Set(exercise.records.filter(record=>record.weightKg!==undefined).map(record=>record.weightBasis||''));
   if(bases.size===1&&[...bases][0])chips.append(el('span',basisNames[[...bases][0]],'metric-chip'));
   Object.entries(metricNames).forEach(([key,label])=>{
    if(summary[key]===undefined||key==='pace'||(bases.size>1&&['weightKgMax','successfulWeightKgMax','volume'].includes(key))||(key==='volume'&&!catalog.find(d=>d.id===exercise.exerciseId)?.volumeEnabled))return;
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
function renderDistribution(){
 const panel=$('#distribution-panel'),root=$('#distribution-chart');root.replaceChildren();
 const bySection=new Map(sections.map(section=>[section.id,0])),byPattern=new Map(),byArea=new Map();
 for(const workout of history)for(const section of workout.sections)for(const exercise of section.exercises){
  const amount=exercise.records.length;if(!amount)continue;bySection.set(section.id,(bySection.get(section.id)||0)+amount);
  const traits=traitsFor(exercise.exerciseId);if(!traits)continue;
  if(traits.area)byArea.set(traits.area,(byArea.get(traits.area)||0)+amount);
  traits.patterns.forEach(pattern=>byPattern.set(pattern,(byPattern.get(pattern)||0)+amount));
 }
 const sectionPoints=sections.map(section=>({label:section.number,value:bySection.get(section.id)||0}));
 const patternPoints=[...byPattern].sort((a,b)=>b[1]-a[1]).map(([pattern,value])=>({label:Hybrid.traitLabels.patterns[pattern],value}));
 const areaPoints=[...byArea].map(([area,value])=>({label:Hybrid.traitLabels.areas[area],value}));
 panel.hidden=!sectionPoints.some(point=>point.value);
 if(panel.hidden)return;
 root.append(makeChart('Записи по блокам',sectionPoints));
 if(areaPoints.length)root.append(makeChart('Записи по области нагрузки',areaPoints));
 if(patternPoints.length)root.append(makeChart('Записи по двигательным паттернам',patternPoints));
}

const progressStates={higher:'Последний результат лучше',lower:'Последний результат ниже',same:'Записанные результаты совпадают',insufficient:'Недостаточно данных для сравнения'};
function progressValue(series,point){if(!point)return '—';if(series.metric==='successRate')return point.success+'/'+point.total+' · '+fmt(point.value)+'%';return series.unit==='с'?model.formatDuration(point.value):fmt(point.value)+' '+series.unit}
function progressConditions(s){
 const c=s.condition,parts=[];if(s.variant)parts.push(s.variant);else parts.push('вариант не указан');if(s.format)parts.push(Hybrid.formatLabels[s.format]);else parts.push('формат не указан');
 const kind={working:'рабочие записи',technique:'технические записи'};parts.push(kind[s.kind]||'тип записи не указан');
 if(['weightAtReps','successfulWeight'].includes(s.metric)){parts.push((c[1]===null?'повторы не указаны':c[1]+' повт.'),basisNames[c[0][0]]||'способ веса не указан')}
 else if(s.metric==='addedWeightAtReps')parts.push(c[1]+' повт.',bodyweightNames[c[0]]||'способ выполнения не указан');
 else if(s.metric==='complexTime'){parts.push(c[1]===null?'число кругов не указано':c[1]+' кругов');parts.push(c[2]===null?'отдых не указан':'отдых '+c[2]+' с')}
 else{const load=c[0];if(load[0]!==null)parts.push(load[0]+' кг · '+(basisNames[load[1]]||'способ веса не указан'));if(load[2]!==null)parts.push(load[2]+' кг доп.');if(load[3])parts.push(bodyweightNames[load[3]]);if(s.metric==='successRate'&&c[3]!==null)parts.push(c[3]+' повт.');if(['repsAtTime','distanceAtTime'].includes(s.metric))parts.push('за '+model.formatDuration(c[3]));if(['timeAtDistance','carryTime'].includes(s.metric))parts.push(c[3]+' м')}
 return parts.filter(Boolean).join(' · ');
}
function selectedProgress(sectionId){const candidates=progressData.series.filter(s=>s.sectionId===sectionId),saved=catalog.flatMap(d=>d.progressChoices?.[sectionId]?[d.progressChoices[sectionId]]:[])[0],requested=progressSelection.get(sectionId)||saved;return {candidates,requested,series:requested?candidates.find(s=>s.id===requested):candidates[0]}}
function showProgressDetail(s){
 const root=$('#progress-detail');root.hidden=false;root.replaceChildren(el('h2',s.name),el('p',s.label),el('p',progressConditions(s),'muted'));root.append(makeChart(s.label+(s.unit==='с'?' · мин:сек':''),s.points.map(p=>({label:p.date.slice(8)+'.'+p.date.slice(5,7),value:p.value,display:progressValue(s,p)}))));
 for(const point of [...s.points].reverse()){const box=el('details','','progress-source');box.append(el('summary',dateLabel(point.date)+' · '+progressValue(s,point)));for(const source of point.sources)box.append(el('p',source.name+': '+result(source.record)));root.append(box)}
 root.append(el('p','Каждая точка — одно сохранённое занятие. Показан лучший результат записи; успешность объединяет только попытки на тех же условиях.','muted'),btn('Закрыть разбор',()=>root.hidden=true,'text-button'));root.scrollIntoView({behavior:'smooth',block:'start'});
}
function renderProgress(){
 const days=Number($('#progress-period').value);progressData=Hybrid.progress.analyze(history,allProfiles(),{days});const root=$('#progress-cards');root.replaceChildren();
 $('#progress-detail').hidden=true;$('#progress-range').textContent=dateLabel(progressData.start)+' — '+dateLabel(progressData.end);
 for(const section of sections){const card=el('article','','progress-card');card.dataset.progressSection=section.id;card.append(el('h2',section.title));const {candidates,requested,series:s}=selectedProgress(section.id),label=el('label','Контрольный показатель'),select=document.createElement('select');select.setAttribute('aria-label','Показатель · '+section.title);
 select.add(new Option('Автоматический выбор',''));for(const item of candidates)select.add(new Option(item.name+' — '+item.label+' · '+progressConditions(item),item.id));
 if(requested&&!s)select.add(new Option('Сохранённый показатель: нет данных за период',requested));select.value=s?.id||requested||'';select.disabled=!candidates.length;label.append(select);card.append(label);
 select.onchange=()=>{const selected=candidates.find(s=>s.id===select.value);if(!selected){progressSelection.delete(section.id);for(const d of catalog)if(d.progressChoices)delete d.progressChoices[section.id];saveCatalog();renderProgress();return}progressSelection.set(section.id,selected.id);for(const d of catalog)if(d.progressChoices)delete d.progressChoices[section.id];const name=sections.flatMap(s=>s.exercises).find(([id])=>id===selected.exerciseId)?.[1]||selected.name,d=definition(selected.exerciseId,name);d.progressChoices??={};d.progressChoices[section.id]=selected.id;saveCatalog();renderProgress()};
 if(s){card.dataset.status=s.status;card.append(el('p',s.name,'progress-exercise'),el('p',s.label,'muted'),el('p',(s.previous?progressValue(s,s.previous)+' → ':'')+progressValue(s,s.latest),'progress-value'),el('p',progressStates[s.status],'progress-status'),el('p',progressConditions(s),'progress-conditions'));
 if(s.previous)card.append(el('p',dateLabel(s.previous.date)+' → '+dateLabel(s.latest.date)+(s.metric==='successRate'?' · изменение '+fmt(s.delta)+' п.п.':''),'muted'));
 for(const warning of s.warnings)card.append(el('p',warning,'progress-note'));card.append(btn('Разобрать показатель',()=>showProgressDetail(s),'secondary'));
 }else{card.dataset.status='insufficient';card.append(el('p','Недостаточно данных для сравнения','progress-status'),el('p',requested?'Выбранного сочетания условий нет в этом периоде. Можно выбрать другое или расширить период.':'Нужны записи с измеримым результатом: известные исходы попыток, вес и повторы либо время и дистанция.','muted'))}
 card.append(el('p','Занятий с работой в блоке: '+progressData.coverage[section.id].sessions,'progress-coverage'));root.append(card)}
 const report=$('#progress-summary');report.replaceChildren(el('p','Сохранено занятий: '+progressData.workouts.length+'. Оценка общей сложности заполнена: '+progressData.rated+' из '+progressData.workouts.length+'.'));
 const list=el('ul');for(const section of sections){const {series:s}=selectedProgress(section.id);list.append(el('li',section.title+': '+(s?progressStates[s.status].toLocaleLowerCase('ru'):'нет сопоставимого показателя')))}report.append(list,el('p','Сравнение двух последних выполнений каждого выбранного показателя за период. Совпадение результатов не доказывает сохранение физического качества; отсутствие записей не означает ухудшения.','muted'));
 const patterns=$('#progress-patterns');patterns.replaceChildren(el('p','Присутствие измеренной или явно отмеченной работы, без помеченной разминки. Каждый паттерн учитывается один раз за занятие.'));
 const table=el('table','','profile-table'),head=el('tr');head.append(el('th','Паттерн'),el('th','Занятий'),el('th','Оценки блоков'));table.append(head);
 const byId=new Map(progressData.patterns.map(p=>[p.id,p]));for(const [id,name] of Object.entries(Hybrid.traitLabels.patterns)){const p=byId.get(id),row=el('tr');row.append(el('td',name),el('td',(p?.sessions||0)+' / '+progressData.workouts.length),el('td',p?.ratedSessions?p.ratedSessions+' занятий · макс. '+p.maxBlockRpe+'/10':'нет отметок'));table.append(row)}patterns.append(table,el('p','Оценка относится ко всему блоку, а не к конкретному паттерну. Она не устанавливает тяжесть каждого упражнения.','muted'));if(progressData.unknown)patterns.append(el('p','Выполнений упражнений без известных паттернов: '+progressData.unknown+'.','muted'));
}
function renderStats(){
 renderProgress();
 const grid=$('#activity-grid');grid.replaceChildren();
 const counts=new Map();history.forEach(w=>counts.set(w.date,(counts.get(w.date)||0)+1));
 const end=new Date(model.today()+'T12:00:00'),start=new Date(end);start.setDate(start.getDate()-364-((start.getDay()+6)%7));
 for(let day=new Date(start);day<=end;day.setDate(day.getDate()+1)){
  const date=day.getFullYear()+'-'+String(day.getMonth()+1).padStart(2,'0')+'-'+String(day.getDate()).padStart(2,'0');
  const cell=el('span','','activity-cell level-'+Math.min(counts.get(date)||0,4));cell.title=date+': '+(counts.get(date)||0);cell.setAttribute('aria-label',cell.title);grid.append(cell);
 }
 renderDistribution();renderProfileAnalysis();
 const effortWorkouts=[...history].filter(workout=>workout.sessionRpe).sort((a,b)=>a.date.localeCompare(b.date)||a.completedAt.localeCompare(b.completedAt));
 const sectionEffort=sections.map(section=>({section,workouts:[...history].filter(workout=>workout.sectionRpe?.[section.id]).sort((a,b)=>a.date.localeCompare(b.date)||a.completedAt.localeCompare(b.completedAt))})).filter(entry=>entry.workouts.length);
 $('#effort-panel').hidden=!effortWorkouts.length&&!sectionEffort.length;const effortChart=$('#effort-chart');effortChart.replaceChildren();
 if(effortWorkouts.length)effortChart.append(makeChart('Сложность по тренировкам',effortWorkouts.map(workout=>({label:workout.date.slice(8)+'.'+workout.date.slice(5,7),value:workout.sessionRpe})),10));
 sectionEffort.forEach(({section,workouts})=>effortChart.append(makeChart(section.number+' · '+section.title,workouts.map(workout=>({label:workout.date.slice(8)+'.'+workout.date.slice(5,7),value:workout.sectionRpe[section.id]})),10)));
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
function renderSpecializedStats(exercises){
 const root=$('#specialized-stats');root.replaceChildren();
 const table=(headers,rows)=>{const scroll=el('div','','analytics-scroll'),body=el('table','','profile-table'),head=el('tr');headers.forEach(label=>head.append(el('th',label)));body.append(head);for(const values of rows){const row=el('tr');values.forEach(value=>row.append(el('td',String(value))));body.append(row)}scroll.append(body);root.append(scroll)};
 if(exercises.some(e=>e.records.some(r=>r.attempts))){
  root.append(el('h3','Попытки по весам'),el('p','Процент считается только по учтённым попыткам. Для записей без результата число попыток не угадывается. Разные варианты и способы указания веса разделены.','muted'));
  const rows=model.attemptBreakdown(exercises);table(['Вариант / вес','Успешные','Неудачные','Успешность','Записи без результата'],rows.map(row=>[(row.variant||'Без варианта')+' · '+(row.weight===null?'Вес не указан':fmt(row.weight)+' кг')+' · '+(basisNames[row.basis]||'способ веса не указан'),row.successful,row.failed,row.rate===null?'—':fmt(row.rate)+'%',row.unknownRecords]));
 }
 const distances=model.distanceResults(exercises);
 if(distances.length){root.append(el('h3','Время на одинаковой дистанции'),el('p','Минимальное время среди введённых записей с одинаковой дистанцией и вариантом. Условия и формат работы могут отличаться; это не оценка готовности.','muted'));table(['Вариант','Дистанция, м','Лучшее время, с','Записей'],distances.map(row=>[row.variant||'Без варианта',fmt(row.distance),fmt(row.bestSec),row.count]));}
}

function renderExerciseStats(){
 const id=$('#stats-exercise').value,variant=$('#stats-variant').value,basis=$('#stats-basis').value,metric=$('#stats-metric'),graph=$('#stats-graph'),list=$('#stats-history');
 graph.replaceChildren();list.replaceChildren();$('#specialized-stats').replaceChildren();
 $('#volume-option').hidden=!id;
 if(!id){$('#stats-latest').textContent='';metric.replaceChildren();list.append(el('p','Выбери упражнение.','muted'));return}
 const def=definition(id,$('#stats-exercise').selectedOptions[0]?.textContent||id);
 $('#volume-toggle').checked=!!def.volumeEnabled;
 const context=$('#stats-context').value,format=$('#stats-format').value,period=$('#exercise-period').value,kind=$('#exercise-kind').value,end=model.today(),start=new Date(end+'T12:00:00Z');if(period!=='all')start.setUTCDate(start.getUTCDate()-Number(period)+1);
 let filteredHistory=history.filter(w=>period==='all'||w.date>=start.toISOString().slice(0,10)&&w.date<=end).map(w=>({...w,sections:w.sections.map(s=>({...s,exercises:s.exercises.filter(e=>(context==='all'||s.id===context)&&(format==='all'||(e.format||'')===format)).map(e=>({...e,records:e.records.filter(r=>kind==='all'||(kind==='noWarmup'?r.kind!=='warmup':r.kind===kind))}))}))}));
 const weights=[...new Set(filteredHistory.flatMap(w=>matches(w,id).filter(e=>!variant||(e.variant||'')===variant).flatMap(e=>e.records.filter(r=>(basis==='all'||(r.weightBasis||'')===basis)&&r.weightKg!==undefined).map(r=>Number(r.weightKg)))))].sort((a,b)=>a-b),weightSelect=$('#stats-weight'),previousWeight=weightSelect.value;
 weightSelect.replaceChildren(new Option('Все веса','all'));weights.forEach(weight=>weightSelect.add(new Option(fmt(weight),String(weight))));weightSelect.value=weights.length>1&&weights.some(weight=>String(weight)===previousWeight)?previousWeight:'all';$('#stats-weight-option').hidden=weights.length<2;
 if(weightSelect.value!=='all')filteredHistory=filteredHistory.map(w=>({...w,sections:w.sections.map(s=>({...s,exercises:s.exercises.map(e=>({...e,records:e.records.filter(r=>r.weightKg!==undefined&&Number(r.weightKg)===Number(weightSelect.value))}))}))}));
 const selectedBasis=basis==='all'?null:basis,days=model.dailyMetrics(filteredHistory,id,variant,selectedBasis),available=new Set(days.flatMap(day=>Object.keys(day.metrics))),previous=metric.value,mixedBasis=!$('#basis-option').hidden&&basis==='all';
 metric.replaceChildren();
 Object.entries(metricNames).filter(([key])=>available.has(key)&&!(mixedBasis&&['weightKgMax','successfulWeightKgMax','volume'].includes(key))&&(key!=='volume'||def.volumeEnabled)).forEach(([key,label])=>metric.add(new Option(label,key)));
 const preferred=id==='broad-jump'||id==='vertical-jump'?'distanceMMax':def.fields.includes('distanceM')&&def.fields.includes('durationSec')?'pace':def.fields.includes('weightKg')?'weightKgMax':'repsSum';
 metric.value=statsExerciseId===id&&[...metric.options].some(o=>o.value===previous)?previous:[preferred,'successfulWeightKgMax','addedWeightKgMax','repsSum','durationSecSum','setsCount'].find(k=>[...metric.options].some(o=>o.value===k))||metric.options[0]?.value||'';statsExerciseId=id;
 $('#stats-filters > summary').textContent='Фильтры и показатель'+([context!=='all',format!=='all',period!=='all',kind!=='all',!!variant,basis!=='all',weightSelect.value!=='all'].filter(Boolean).length?' · есть активные фильтры':'');
 const key=metric.value,points=days.map(day=>({label:day.date.slice(8)+'.'+day.date.slice(5,7),value:chartValue(key,day.metrics[key])}));
 if(points.length)graph.append(makeChart(metricNames[key]+' по дням',points));
 else graph.append(el('p','Для выбранной метрики пока нет данных.','muted'));
 const entries=[...filteredHistory].sort((a,b)=>b.date.localeCompare(a.date)||b.completedAt.localeCompare(a.completedAt)).flatMap(w=>matches(w,id).filter(e=>!variant||(e.variant||'')===variant).map(e=>({date:w.date,exercise:e,records:selectedBasis===null?e.records:e.records.filter(record=>(record.weightBasis||'')===selectedBasis)})).filter(e=>e.records.length));
 renderSpecializedStats(entries.map(entry=>({...entry.exercise,records:entry.records})));
 $('#stats-latest').textContent=entries.length?'Последнее выполнение · '+dateLabel(entries[0].date)+': '+entries[0].records.length+' записей · последняя: '+result(entries[0].records.at(-1)):'Нет результатов для выбранных условий.';
 entries.forEach(entry=>{
  const card=el('div','','stats-entry');
  card.append(el('strong',dateLabel(entry.date)+(entry.exercise.variant?' · '+entry.exercise.variant:'')));
  entry.records.forEach((record,index)=>card.append(el('p',(index+1)+'. '+result(record))));
  if(entry.exercise.note)card.append(el('p',entry.exercise.note,'muted'));
  list.append(card);
 });
 if(!entries.length)list.append(el('p','Пока нет результатов.','muted'));
}
function switchView(name){document.querySelectorAll('.view').forEach(e=>e.hidden=e.id!==name+'-view');document.querySelectorAll('[data-view]').forEach(b=>{const active=b.dataset.view===name;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});if(name==='history')renderHistory();if(name==='stats')renderStats();if(name==='data'){renderTemplates();renderLibrarySettings()};window.scrollTo(0,0)}
function validateDefinition(d){
 if(!d||typeof d.id!=='string'||!d.id||d.id.length>150||typeof d.name!=='string'||!d.name.trim()||d.name.length>100||!Array.isArray(d.fields)||d.fields.some(k=>!keys.includes(k))||!['m','km'].includes(d.distanceUnit)||typeof d.volumeEnabled!=='boolean'||(d.bodyweight!==undefined&&typeof d.bodyweight!=='boolean')||(d.favorite!==undefined&&typeof d.favorite!=='boolean'))throw Error('Некорректная настройка упражнения.');
 const equipment=d.equipment??Hybrid.equipment[d.id]??'',allowed=new Set(Hybrid.equipmentLabels.map(([key])=>key));
 if(equipment!==''&&!allowed.has(equipment)||equipment==='all'||(d.variants!==undefined&&(!Array.isArray(d.variants)||d.variants.length>50||d.variants.some(value=>typeof value!=='string'||!value.trim()||value.length>100))))throw Error('Некорректные варианты или инвентарь упражнения.');
 if(d.progressChoices!==undefined&&(!d.progressChoices||typeof d.progressChoices!=='object'||Array.isArray(d.progressChoices)||Object.entries(d.progressChoices).some(([key,value])=>!sections.some(s=>s.id===key)||typeof value!=='string'||value.length>500000)))throw Error('Некорректный выбор показателей.');
 if(d.favoriteSections!==undefined&&(!Array.isArray(d.favoriteSections)||d.favoriteSections.some(id=>!sections.some(s=>s.id===id))))throw Error('Некорректное избранное по направлениям.');
 if(d.status!==undefined&&!['main','additional','hidden'].includes(d.status))throw Error('Некорректная видимость упражнения.');if(d.excluded!==undefined&&typeof d.excluded!=='boolean')throw Error('Некорректное исключение упражнения.');if(d.sectionId!=null&&!sections.some(s=>s.id===d.sectionId))throw Error('Некорректный блок упражнения.');
 return{...(d.progressChoices!==undefined?{progressChoices:{...d.progressChoices}}:{}),...(d.favoriteSections!==undefined?{favoriteSections:[...new Set(d.favoriteSections)]}:{}),...(d.status!==undefined?{status:d.status}:{}),...(d.excluded!==undefined?{excluded:d.excluded}:{}),...(d.profile!==undefined?{profile:Hybrid.coach.validateProfile(d.profile)}:{}),id:d.id,name:d.name,sectionId:d.sectionId||null,fields:[...new Set(d.fields)],distanceUnit:d.distanceUnit,volumeEnabled:d.volumeEnabled,bodyweight:d.bodyweight??Hybrid.bodyweightIds.includes(d.id),equipment,favorite:d.favorite??false,variants:[...new Set(d.variants||[])]};
}
function validateEditing(value){if(!value||typeof value.workoutId!=='string')throw Error('Некорректное редактирование истории.');const base=model.validate(value.base,true),workout=model.validate(value.workout,true,true);if(base.id!==value.workoutId||workout.id!==value.workoutId)throw Error('ID редактируемой тренировки не совпадает.');return{workoutId:value.workoutId,base,workout}}
function validateBackup(raw){if(!raw||raw.app!=='hybrid-training'||![1,2,3].includes(raw.schemaVersion)||!Array.isArray(raw.history)||raw.history.length>10000)throw Error('Нужен JSON-экспорт «Гибрид» версии 1, 2 или 3.');const data={editing:raw.editing==null?null:validateEditing(raw.editing),legacySnapshot:raw.legacySnapshot??null,lastBackup:raw.lastBackup??null,history:raw.history.map(w=>raw.schemaVersion===1?model.legacy(w,true):model.validate(w,true)),draft:raw.draft==null?null:raw.schemaVersion===1?model.legacy(raw.draft):model.validate(raw.draft,false,true),catalog:raw.schemaVersion>=2&&Array.isArray(raw.catalog)?raw.catalog.map(validateDefinition):[],templates:raw.schemaVersion>=2&&Array.isArray(raw.templates)?raw.templates.map(model.template):[]},ids=new Set(),templateIds=new Set();data.history.forEach(w=>{if(ids.has(w.id))throw Error('Повторяются ID тренировок.');ids.add(w.id)});data.templates.forEach(template=>{if(templateIds.has(template.id))throw Error('Повторяются ID шаблонов.');templateIds.add(template.id)});return data}
function planImport(backup,current){if(backup.editing){const local=editingState()||current.editing;if(local&&JSON.stringify(local)!==JSON.stringify(backup.editing))throw Error('Сначала сохрани или отмени текущее редактирование истории.');const target=current.history.find(w=>w.id===backup.editing.workoutId)||backup.history.find(w=>w.id===backup.editing.workoutId);if(JSON.stringify(target)!==JSON.stringify(backup.editing.base))throw Error('Редактируемая тренировка изменилась: правка из файла конфликтует с историей.');if(backup.draft&&!empty(current.draft)&&JSON.stringify(current.draft)!==JSON.stringify(backup.draft))throw Error('Черновики различаются. Сначала сохрани текущий, чтобы восстановить оба состояния из файла.')}const byId=new Map(current.history.map(w=>[w.id,w])),added=[];let skipped=0;backup.history.forEach(w=>{const old=byId.get(w.id);if(!old)added.push(w);else if(JSON.stringify(old)===JSON.stringify(w))skipped++;else throw Error('Конфликт: тренировки с одинаковым ID отличаются. Импорт отменён.')});const nextCatalog=clone(catalog);backup.catalog.forEach(d=>{const old=nextCatalog.find(e=>e.id===d.id);if(!old)nextCatalog.push(d);else{if(old.favoriteSections&&d.favoriteSections)old.favoriteSections=[...new Set([...old.favoriteSections,...d.favoriteSections])];else if(!old.favorite&&d.favoriteSections)old.favoriteSections=[...d.favoriteSections];else if(d.favorite&&!d.favoriteSections)delete old.favoriteSections;old.favorite=old.favorite||d.favorite;old.variants=[...new Set([...(old.variants||[]),...(d.variants||[])])].slice(0,50);if(!old.equipment)old.equipment=d.equipment}});const nextTemplates=clone(current.templates||[]),knownTemplates=new Map(nextTemplates.map(template=>[template.id,template]));backup.templates.forEach(template=>{const old=knownTemplates.get(template.id);if(!old){nextTemplates.push(template);knownTemplates.set(template.id,template)}else if(JSON.stringify(old)!==JSON.stringify(template))throw Error('Конфликт: шаблоны с одинаковым ID отличаются. Импорт отменён.')});return{added,skipped,draft:backup.draft&&(!current.draft||empty(current.draft))?backup.draft:null,catalog:nextCatalog,templates:nextTemplates,editing:backup.editing||null,legacySnapshot:current.legacySnapshot||backup.legacySnapshot||null,backup:current.backup||backup.lastBackup||null}}
async function finish(){if(!ready||busy||(!count(draft)&&!(draft.groups||[]).length))return;const invalid=[...document.querySelectorAll('#today-view input')].find(e=>!e.closest('.pending-record')&&!e.checkValidity());if(invalid){invalid.reportValidity();return}const editingId=editingWorkoutId;const pending=model.pendingCount(draft),actual=model.actualize(draft);if(pending){const actualRecords=actual.sections.reduce((n,s)=>n+s.exercises.reduce((m,e)=>m+e.records.filter(model.isActual).length,0),0),groupResults=(actual.groups||[]).some(g=>g.rounds||g.result&&model.isActual(g.result)||g.roundResults?.some(model.isActual));if(!actualRecords&&!groupResults){toast('Нет выполненных записей. Подтверди выполненное или продолжи позже; заготовки сохранены.');return}if(!confirm('Сохранить выполненные записи: '+actualRecords+'? Неподтверждённых заготовок: '+pending+'. Они не войдут в историю.'))return}let workout;try{workout=model.validate({...actual,id:editingId||uid(),completedAt:editingId?draft.completedAt:new Date().toISOString()},true)}catch(e){toast(e.message);return}if(!workout.sections.some(s=>s.exercises.some(e=>e.records.length||e.note.trim()))&&!(workout.groups||[]).some(g=>g.rounds||g.result||g.roundResults?.length)&&!workout.note.trim()){toast('Добавь результат или заметку.');return}setBusy(true);try{if(editingId){await enqueue(()=>db.updateWorkout(workout));history=history.map(item=>item.id===editingId?workout:item);draft=editingOriginalDraft?clone(editingOriginalDraft):model.empty();editingWorkoutId=undefined;editingOriginalDraft=undefined;editingBase=undefined;toast('Тренировка обновлена.')}else{await enqueue(()=>db.finish(workout));history.push(workout);draft=model.empty();toast('Тренировка сохранена.')}renderToday();storageOK();switchView('history')}catch(e){storageError(e)}finally{setBusy(false)}}
async function exportData(){if(busy)return;await queue;const stored=await db.read();const data={app:'hybrid-training',schemaVersion:3,exportedAt:new Date().toISOString(),history:clone(stored.history),draft:clone(editingWorkoutId?editingOriginalDraft:stored.draft||draft),editing:editingState()||stored.editing||null,catalog:clone(stored.catalog||catalog),templates:clone(stored.templates||templates),lastBackup:stored.backup||null};if(legacySnapshot)data.legacySnapshot=legacySnapshot;const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='hybrid-training-'+model.today()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);$('#backup-info').textContent='Файл подготовлен. Сохрани его в «Файлы» или iCloud Drive.';if(ready)enqueue(()=>db.backup(new Date().toISOString())).catch(storageError)}
async function previewImport(ev){const file=ev.target.files[0];ev.target.value='';pendingImport=null;const box=$('#import-preview');box.replaceChildren();box.hidden=true;if(!file||!ready||busy)return;try{if(file.size>10*1024*1024)throw Error('Максимальный размер файла — 10 МБ.');const backup=validateBackup(JSON.parse(await file.text()));await queue;const current=await db.read(),plan=planImport(backup,{history:current.history,draft:editingWorkoutId?editingOriginalDraft:draft,templates:current.templates,editing:current.editing,legacySnapshot:current.legacySnapshot,backup:current.backup});pendingImport=backup;box.append(el('p','Новых тренировок: '+plan.added.length+'. Уже есть: '+plan.skipped+'. Шаблонов: '+backup.templates.length+'. '+(plan.draft?'Черновик восстановится.':'Текущий черновик сохранится.')+(backup.editing?' Несохранённая правка истории восстановится отдельно.':'')));const b=btn('Импортировать',applyImport,'primary');b.id='confirm-import';box.append(b);box.hidden=false}catch(e){box.append(el('p',e instanceof SyntaxError?'Не удалось прочитать JSON.':e.message));box.hidden=false}}
async function applyImport(){if(!pendingImport||busy||!ready)return;setBusy(true);try{const plan=await enqueue(async()=>{const current=await db.read(),plan=planImport(pendingImport,{history:current.history,draft:editingWorkoutId?editingOriginalDraft:draft,templates:current.templates,editing:current.editing,legacySnapshot:current.legacySnapshot,backup:current.backup});await db.import(plan.added,plan.draft,plan.catalog,plan.templates,{editing:plan.editing,legacySnapshot:plan.legacySnapshot,backup:plan.backup});history=[...current.history,...plan.added];catalog=plan.catalog;templates=plan.templates;return plan});if(plan.draft){if(editingWorkoutId)editingOriginalDraft=clone(plan.draft);else draft=plan.draft;}if(plan.legacySnapshot)legacySnapshot=plan.legacySnapshot;if(plan.editing){if(!editingWorkoutId)editingOriginalDraft=clone(draft);editingWorkoutId=plan.editing.workoutId;editingBase=clone(plan.editing.base);draft=clone(plan.editing.workout)}pendingImport=null;$('#import-preview').hidden=true;renderToday();renderHistory();renderTemplates();storageOK();toast('Добавлено тренировок: '+plan.added.length+'.')}catch(e){toast(e.message)}finally{setBusy(false)}}
function setupWorker(){if(!('serviceWorker'in navigator)){$('#connection').textContent='Офлайн недоступен';return}const state=()=>$('#connection').textContent=!navigator.onLine?(navigator.serviceWorker.controller?'Без сети · офлайн':'Без сети'):(navigator.serviceWorker.controller?'Офлайн готов':'Готовим офлайн…');navigator.serviceWorker.addEventListener('controllerchange',state);window.addEventListener('online',state);window.addEventListener('offline',state);navigator.serviceWorker.register('./service-worker.js').then(reg=>{const show=()=>{if(reg.waiting&&navigator.serviceWorker.controller){waitingWorker=reg.waiting;$('#update-banner').hidden=false}};show();reg.addEventListener('updatefound',()=>reg.installing?.addEventListener('statechange',show));state()}).catch(e=>{console.error(e);$('#connection').textContent='Офлайн недоступен'});$('#update-app').onclick=async()=>{if(!waitingWorker||busy||!ready)return;if(editingWorkoutId){toast('Сначала сохрани изменения истории или отмени редактирование.');return}setBusy(true);try{await enqueue(()=>db.draft(clone(draft)));navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});waitingWorker.postMessage({type:'SKIP_WAITING'})}catch(e){storageError(e);setBusy(false)}}}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));$('#close-picker').onclick=()=>$('#picker').close();$('#exercise-search').oninput=renderPicker;
Hybrid.equipmentLabels.forEach(([key,label])=>$('#equipment-filter').add(new Option(label,key)));$('#custom-equipment').add(new Option('Не указывать',''));Hybrid.equipmentLabels.filter(([key])=>key!=='all').forEach(([key,label])=>$('#custom-equipment').add(new Option(label,key)));$('#equipment-filter').onchange=renderPicker;
$('#picker-section').add(new Option('Автоматически по упражнению',''));$('#stats-context').add(new Option('Все направления','all'));sections.forEach(s=>$('#stats-context').add(new Option(s.title,s.id)));$('#stats-format').add(new Option('Все форматы','all'));$('#stats-format').add(new Option('Без отметки',''));Object.entries(Hybrid.formatLabels).forEach(([id,label])=>$('#stats-format').add(new Option(label,id)));$('#group-section').add(new Option('Без направления',''));sections.forEach(section=>$('#group-section').add(new Option(section.title,section.id)));
sections.forEach(section=>$('#picker-section').add(new Option(section.title,section.id)));$('#picker-section').onchange=()=>{pickerSection=sections.find(section=>section.id===$('#picker-section').value)||null;$('#exercise-search').value='';renderPicker()};
$('#add-group').onclick=()=>{$('#add-dialog').close();openGroup()};$('#add-exercise').onclick=()=>{$('#add-dialog').close();openPicker()};$('#add-item').onclick=()=>{if(ready&&!busy)$('#add-dialog').showModal()};$('#close-add').onclick=()=>$('#add-dialog').close();$('#start-free').onclick=()=>{if(!ready||busy)return;if(editingWorkoutId){toast('Сначала сохрани или отмени редактирование истории.');return}if(!empty(draft)&&!confirm('Начать свободную тренировку вместо текущего черновика?'))return;draft=model.empty();saveDraft();renderToday()};$('#start-template').onclick=()=>{renderTemplates();$('#templates-dialog').showModal()};$('#close-templates').onclick=()=>$('#templates-dialog').close();$('#repeat-last').onclick=()=>{if(history.length)repeatWorkout(sorted()[0])};
$('#close-group').onclick=()=>$('#group-dialog').close();
$('#group-form').onsubmit=event=>{
 event.preventDefault();if(!ready||busy)return;ensureDraftOrder();
 const selected=new Set([...document.querySelectorAll('#group-member-options input:checked')].map(input=>input.value)),id=editingGroupId||uid(),previous=(draft.groups||[]).find(item=>item.id===id);
 groupSectionId=$('#group-section').value||null;
 const group={id,name:$('#group-name').value.trim(),note:$('#group-note').value.trim(),...(groupSectionId?{sectionId:groupSectionId}:{})};
 if(previous?.plannedRounds)group.plannedRounds=previous.plannedRounds;if(previous?.result)group.result=clone(previous.result);if(previous?.roundResults?.length)group.roundResults=clone(previous.roundResults);
 if($('#group-rounds').value!==''){group.rounds=Number($('#group-rounds').value);delete group.plannedRounds}
 if($('#group-rest').value!=='')group.restSec=Number($('#group-rest').value);
 const prior=previous?groupMembers(draft,previous).map(item=>item.exercise.id):[],order=prior.filter(item=>selected.has(item)),released=prior.filter(item=>!selected.has(item));
 for(const item of flowItems(draft).flatMap(entry=>entry.type==='group'?groupMembers(draft,entry.group):[entry]))if(selected.has(item.exercise.id)&&!order.includes(item.exercise.id))order.push(item.exercise.id);
 group.order=order;
 const selectedPositions=[...selected].map(item=>draft.order.indexOf('e:'+item)).filter(item=>item>=0),insertAt=selectedPositions.length?Math.min(...selectedPositions):draft.order.length;
 draft.groups??=[];const position=draft.groups.findIndex(item=>item.id===id);if(position<0){draft.groups.push(group);draft.order.splice(insertAt,0,'g:'+id)}else draft.groups[position]=group;
 draftExercises().forEach(({exercise})=>{if(selected.has(exercise.id))exercise.groupId=id;else if(exercise.groupId===id)delete exercise.groupId});
 const groupPosition=draft.order.indexOf('g:'+id);draft.order.splice(groupPosition+1,0,...released.map(item=>'e:'+item));
 syncDraftOrder();$('#group-dialog').close();
};
$('#custom-form').onsubmit=ev=>{ev.preventDefault();const name=$('#custom-name').value.trim();if(!name)return;pickerSection??=sections[1];const normalized=name.toLocaleLowerCase('ru').replace(/\s+/g,' '),match=pickerSection.exercises.find(([,n])=>n.toLocaleLowerCase('ru')===normalized)||catalog.find(e=>e.id.startsWith('custom:')&&(!e.sectionId||e.sectionId===pickerSection.id)&&e.name.toLocaleLowerCase('ru').replace(/\s+/g,' ')===normalized),id=match?(Array.isArray(match)?match[0]:match.id):'custom:'+uid();if(!match){catalog.push({id,name,sectionId:pickerSection.id,fields:['weightKg','reps'],distanceUnit:'m',volumeEnabled:false,bodyweight:false,equipment:$('#custom-equipment').value,favorite:false,variants:[]});saveCatalog()}addExercise(id,name)};
$('#workout-date').oninput=()=>{draft.date=$('#workout-date').value;saveDraft()};$('#workout-note').oninput=()=>{draft.note=$('#workout-note').value;saveDraft();updateTotal()};$('#session-rpe').onchange=()=>{if($('#session-rpe').value)draft.sessionRpe=Number($('#session-rpe').value);else delete draft.sessionRpe;saveDraft()};$('#finish').onclick=finish;$('#clear-draft').onclick=()=>{if(!ready||busy||!confirm('Очистить черновик?'))return;draft=model.empty();saveDraft();renderToday()};$('#save-template').onclick=openTemplateDialog;$('#close-template').onclick=()=>$('#template-dialog').close();$('#template-form').onsubmit=event=>{event.preventDefault();saveTemplate()};$('#export').onclick=exportData;$('#import-file').onchange=previewImport;$('#stats-workout').onchange=renderWorkoutStats;$('#stats-exercise').onchange=()=>{$('#stats-weight').value='all';renderVariantOptions();renderBasisOptions();renderExerciseStats()};$('#stats-variant').onchange=()=>{renderBasisOptions();renderExerciseStats()};$('#stats-basis').onchange=renderExerciseStats;$('#stats-metric').onchange=renderExerciseStats;$('#profile-period').onchange=renderProfileAnalysis;$('#exercise-period').onchange=renderExerciseStats;$('#exercise-kind').onchange=renderExerciseStats;$('#progress-period').onchange=renderProgress;$('#stats-context').onchange=renderExerciseStats;$('#stats-format').onchange=renderExerciseStats;$('#stats-weight').onchange=renderExerciseStats;$('#volume-toggle').onchange=()=>{const d=catalog.find(e=>e.id===$('#stats-exercise').value);if(!d)return;d.volumeEnabled=$('#volume-toggle').checked;saveCatalog();renderExerciseStats()};
setBusy(true);renderToday();db.open().then(async()=>{let data=await db.read();if(data.history.some(w=>w.schemaVersion!==2)||(data.draft&&data.draft.schemaVersion!==2)){const snapshot={migratedAt:new Date().toISOString(),history:data.history,draft:data.draft},migrated=data.history.map(w=>w.schemaVersion===2?w:model.legacy(w,true)),next=data.draft?(data.draft.schemaVersion===2?data.draft:model.legacy(data.draft)):null;await db.migrate(migrated,next,snapshot);data=await db.read();toast('Старая история перенесена.')}history=data.history.map(w=>model.validate(w,true));draft=data.draft?model.validate(data.draft,false,true):model.empty();catalog=Array.isArray(data.catalog)?data.catalog.map(validateDefinition):[];templates=Array.isArray(data.templates)?data.templates.map(model.template):[];legacySnapshot=data.legacySnapshot;if(data.editing){const session=validateEditing(data.editing),base=history.find(w=>w.id===session.workoutId);if(JSON.stringify(base)!==JSON.stringify(session.base))throw Error('Конфликт сохранённой правки истории. Экспортируй данные перед восстановлением.');editingOriginalDraft=clone(draft);editingWorkoutId=session.workoutId;editingBase=session.base;draft=session.workout}ready=true;renderToday();renderTemplates();storageOK();setBusy(false);if(data.backup)$('#backup-info').textContent='Последний экспорт: '+new Date(data.backup).toLocaleString('ru-RU')}).catch(e=>{setBusy(false);storageError(e)});setupWorker();
$('#clear-draft').onclick=()=>{if(editingWorkoutId){cancelWorkoutEdit();return}if(!ready||busy||!confirm('Очистить черновик?'))return;draft=model.empty();saveDraft();renderToday()};
})();
