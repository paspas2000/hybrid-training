'use strict';
(() => {
const $=s=>document.querySelector(s), {sections,db,model}=Hybrid, {fields,keys,uid}=model;
const clone=x=>JSON.parse(JSON.stringify(x)), names=Object.fromEntries(fields.map(f=>[f[0],f]));
const metricNames={setsCount:'Записи / подходы',weightKgMax:'Максимальный вес, кг',addedWeightKgMax:'Максимальный доп. вес, кг',repsSum:'Повторения',durationSecSum:'Время, мин',distanceMSum:'Дистанция, км',roundsSum:'Круги',volume:'Объём, кг × повт.',pace:'Темп, мин/км'};
let history=[],draft=model.empty(),catalog=[],templates=[],legacySnapshot,ready=false,busy=false,pickerSection,pickerGroupId,editingGroupId,groupSectionId,pendingImport,waitingWorker,queue=Promise.resolve(),toastTimer;
const el=(tag,value='',className='')=>{const e=document.createElement(tag);e.textContent=value;e.className=className;return e};
const btn=(value,action,className='text-button',aria='')=>{const e=el('button',value,className);e.type='button';if(aria)e.setAttribute('aria-label',aria);e.onclick=action;return e};
const count=w=>w.sections.reduce((n,s)=>n+s.exercises.length,0),empty=w=>!count(w)&&!w.note&&!w.sessionRpe&&!(w.groups?.length);
const sorted=()=>[...history].sort((a,b)=>b.date.localeCompare(a.date)||b.completedAt.localeCompare(a.completedAt));
const dateLabel=s=>new Date(s+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
const matches=(w,id)=>w.sections.flatMap(s=>s.exercises).filter(e=>e.exerciseId===id);
function variantsFor(id,def){const seen=new Set(),values=[];for(const value of [...sorted().flatMap(workout=>matches(workout,id).map(exercise=>exercise.variant).filter(Boolean)),...(def.variants||[])]){const key=value.toLocaleLowerCase('ru').trim();if(key&&!seen.has(key)){seen.add(key);values.push(value)}}return values}
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
function saveTemplates(){const snapshot=clone(templates);enqueue(()=>db.templates(snapshot)).catch(storageError)}
function plural(n,words){return words[n%10===1&&n%100!==11?0:n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?1:2]}
function updateTotal(){const n=count(draft);$('#exercise-total').textContent=n+' '+plural(n,['упражнение','упражнения','упражнений']);$('#finish').disabled=!ready||busy||!n;$('#clear-draft').disabled=!ready||busy||empty(draft)}
function setBusy(v){busy=v;if(v)document.querySelectorAll('#today-view input,#today-view textarea,#today-view select,#today-view button,#data-view button,#import-file,#confirm-import').forEach(e=>e.disabled=true);else{renderToday();renderTemplates();$('#workout-date').disabled=!ready;$('#workout-note').disabled=!ready;$('#session-rpe').disabled=!ready;$('#import-file').disabled=!ready}updateTotal()}
function definition(id,name){let d=catalog.find(x=>x.id===id);if(!d){d={id,name,sectionId:null,fields:Hybrid.presets[id]||['weightKg','reps'],distanceUnit:'m',volumeEnabled:false,bodyweight:Hybrid.bodyweightIds.includes(id),equipment:Hybrid.equipment[id]||'',favorite:false,variants:[]};catalog.push(d);saveCatalog()}return d}
function visible(d){return d.fields.filter(k=>keys.includes(k))}
function makeRecord(source){const r={id:uid(),note:source?.note||''};keys.forEach(k=>{if(source?.[k]!==undefined&&source[k]!=='')r[k]=source[k]});for(const key of ['weightBasis','bodyweightMode'])if(source?.[key])r[key]=source[key];return r}
function renderToday(){
 $('#workout-date').value=draft.date;$('#workout-note').value=draft.note;$('#session-rpe').value=draft.sessionRpe||'';const root=$('#sections');root.replaceChildren();
 sections.forEach(section=>{const card=el('section','','section-card');card.dataset.section=section.id;const head=el('div','','section-head'),title=el('div','','section-text'),actions=el('div','','section-actions');title.append(el('h2',section.title),el('p',section.subtitle));actions.append(btn('+ Комплекс',()=>openGroup(null,section),'add-button'),btn('+ Добавить',()=>openPicker(section),'add-button'));head.append(el('span',section.number,'section-number'),title,actions);card.append(head);renderSectionItems(section,card);root.append(card)});
 renderFlow();
 updateTotal()
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
 const root=$('#group-list');root.replaceChildren();const flow=flowItems(draft);if(!flow.length){root.append(el('p','Добавь упражнение или комплекс в одном из блоков ниже.','flow-empty'));return}
 for(const item of flow){
  const label=item.type==='group'?'Комплекс · '+item.group.name:item.exercise.name,sectionId=item.type==='group'?groupSection(item.group):item.section.id,section=sections.find(value=>value.id===sectionId),row=el('div','','flow-item');
  const position=flow.findIndex(entry=>entry.token===item.token),up=btn('↑',()=>moveFlowItem(item.token,-1),'icon-button','Поднять '+label),down=btn('↓',()=>moveFlowItem(item.token,1),'icon-button','Опустить '+label);up.disabled=position===0;down.disabled=position===flow.length-1;
  row.append(el('span',String(position+1),'flow-number'),el('div',label+(section?' · '+section.title:''),'flow-label'),up,down);root.append(row);
 }
}
function renderSectionItems(section,root){
 const items=flowItems(draft).filter(item=>item.type==='group'?groupSection(item.group)===section.id:item.section.id===section.id);
 if(!items.length){root.append(el('p','Добавь упражнение или создай комплекс в этом блоке.','empty-section'));return}
 for(const item of items){
  if(item.type==='exercise'){root.append(renderExercise(item.exercise,item.section,item.position));continue}
  const group=item.group;
  const card=el('div','','group-card'),members=groupMembers(draft,group),head=el('div','','group-card-head');
  head.append(el('strong',group.name),btn('Изменить',()=>openGroup(group),'text-button'),btn('×',()=>removeGroup(group),'icon-button','Удалить комплекс '+group.name));card.append(head);
  const details=[group.rounds?group.rounds+' '+plural(group.rounds,['круг','круга','кругов']):'',group.restSec!==undefined?'отдых '+fmt(group.restSec)+' сек':''].filter(Boolean);
  if(details.length)card.append(el('p',details.join(' · '),'muted'));if(group.note)card.append(el('p',group.note,'muted note-text'));
  card.append(renderGroupResults(group));
  if(!members.length)card.append(el('p','Добавь первое упражнение комплекса.','group-empty'));
  members.forEach(({exercise,index,position})=>card.append(renderExercise(exercise,draft.sections[index],position,group)));
  card.append(btn('+ Упражнение в комплекс',()=>openPicker(section,group.id),'secondary group-add'));root.append(card);
 }
}
function renderGroupResults(group){
 const panel=el('details','','group-results');panel.open=!!group.result||!!group.roundResults?.length;panel.append(el('summary','Результат комплекса и кругов'));
 const hint=el('p','Необязательно. Здесь можно отметить общий итог и время или заметку по каждому кругу.','muted');panel.append(hint);
 const overall=group.result||{id:uid(),note:''},fieldsWrap=el('div','','group-result-fields');
 for(const [key,label,unit] of fields){const wrap=el('label',label+(unit?' · '+unit:''));const input=document.createElement('input');input.type='number';input.min='0';input.step=key==='reps'||key==='rounds'?'1':'any';input.inputMode=key==='reps'||key==='rounds'?'numeric':'decimal';input.placeholder='—';input.value=overall[key]===undefined?'':String(key==='durationSec'?Number(overall[key])/60:overall[key]);input.oninput=()=>{group.result=overall;if(input.value==='')delete overall[key];else overall[key]=String(key==='durationSec'?Number(input.value)*60:Number(input.value));saveDraft()};wrap.append(input);fieldsWrap.append(wrap)}
 const overallNote=document.createElement('input');overallNote.type='text';overallNote.maxLength=1000;overallNote.placeholder='Заметка к итогу комплекса';overallNote.value=overall.note||'';overallNote.oninput=()=>{group.result=overall;overall.note=overallNote.value;saveDraft()};panel.append(el('h4','Общий итог'),fieldsWrap,overallNote);
 const rounds=group.roundResults||[];const roundList=el('div','','round-result-list');rounds.forEach(round=>{const row=el('div','','round-result'),head=el('div','','round-result-head');head.append(el('strong','Круг '+round.round),btn('×',()=>{group.roundResults=rounds.filter(item=>item.id!==round.id);saveDraft();renderToday()},'icon-button','Удалить результат круга '+round.round));row.append(head);const time=el('label','Время · мин'),timeInput=document.createElement('input');timeInput.type='number';timeInput.min='0';timeInput.step='any';timeInput.inputMode='decimal';timeInput.placeholder='—';timeInput.value=round.durationSec===undefined?'':String(Number(round.durationSec)/60);timeInput.oninput=()=>{if(timeInput.value==='')delete round.durationSec;else round.durationSec=String(Number(timeInput.value)*60);saveDraft()};time.append(timeInput);const note=document.createElement('input');note.type='text';note.maxLength=1000;note.placeholder='Заметка к кругу';note.value=round.note||'';note.oninput=()=>{round.note=note.value;saveDraft()};row.append(time,note);roundList.append(row)});panel.append(el('h4','Отдельные круги'),roundList);
 const nextRound=()=>{const used=new Set(rounds.map(item=>item.round));for(let n=1;n<=1000;n++)if(!used.has(n))return n;return null};const add=btn('+ Отметить круг',()=>{const round=nextRound();if(!round)return;group.roundResults??=[];group.roundResults.push({id:uid(),round,note:''});saveDraft();renderToday()},'secondary small');if(group.rounds&&rounds.length>=group.rounds)add.disabled=true;panel.append(add);return panel
}
function openGroup(group=null,section=null){
 if(!ready||busy||(!group&&(draft.groups||[]).length>=30))return;
 editingGroupId=group?.id||null;groupSectionId=group?groupSection(group):section?.id||'capacity';$('#group-title').textContent=group?'Изменить комплекс':'Новый комплекс';$('#group-section').textContent=(sections.find(item=>item.id===groupSectionId)?.number||'')+' · '+(sections.find(item=>item.id===groupSectionId)?.title||'Общий ход тренировки');$('#group-name').value=group?.name||'';$('#group-rounds').value=group?.rounds??'';$('#group-rest').value=group?.restSec??'';$('#group-note').value=group?.note||'';$('#group-error').hidden=true;$('#group-members-field').hidden=!count(draft);
 const root=$('#group-member-options');root.replaceChildren();flowItems(draft).flatMap(item=>item.type==='group'?groupMembers(draft,item.group):[item]).forEach(({exercise,index})=>{const label=el('label','','group-member'),input=document.createElement('input');input.type='checkbox';input.value=exercise.id;input.checked=!!group&&exercise.groupId===group.id;label.append(input,document.createTextNode(sections[index].number+' · '+exercise.name));root.append(label)});
 $('#group-dialog').showModal();
}
function removeGroup(group){
 if(!confirm('Удалить связку «'+group.name+'»? Упражнения и записи останутся.'))return;
 ensureDraftOrder();const members=groupMembers(draft,group).map(item=>'e:'+item.exercise.id),position=draft.order.indexOf('g:'+group.id);draft.order.splice(position,1,...members);draft.groups=draft.groups.filter(item=>item.id!==group.id);draftExercises().forEach(({exercise})=>{if(exercise.groupId===group.id)delete exercise.groupId});syncDraftOrder();
}
function moveFlowItem(token,delta){ensureDraftOrder();const i=draft.order.indexOf(token),j=i+delta;if(i<0||j<0||j>=draft.order.length)return;[draft.order[i],draft.order[j]]=[draft.order[j],draft.order[i]];saveDraft();renderToday()}
function moveGroupMember(group,exercise,delta){const order=groupMembers(draft,group).map(item=>item.exercise.id),i=order.indexOf(exercise.id),j=i+delta;if(j<0||j>=order.length)return;[order[i],order[j]]=[order[j],order[i]];group.order=order;saveDraft();renderToday()}
function addRecord(exercise,source){if(exercise.records.length>=500){toast('Максимум 500 записей.');return}const record=makeRecord(source);if(definition(exercise.exerciseId,exercise.name).bodyweight&&!record.bodyweightMode)record.bodyweightMode='self';exercise.records.push(record);saveDraft();renderToday();const input=document.querySelector('[data-record="'+record.id+'"] input[type="number"]');input?.focus()}
function renderExercise(exercise,section,index,group=null){
 const card=el('article','','exercise');card.dataset.item=exercise.id;const def=definition(exercise.exerciseId,exercise.name);
 const head=el('div','','exercise-title'),controls=el('div','','exercise-controls');head.append(el('h3',exercise.name));
 const peers=group?groupMembers(draft,group).map(item=>item.exercise):flowItems(draft).map(item=>item.type==='exercise'?item.exercise:item.group),peerIndex=peers.indexOf(exercise);
 const up=btn('↑',()=>group?moveGroupMember(group,exercise,-1):moveFlowItem('e:'+exercise.id,-1),'icon-button','Поднять '+exercise.name),down=btn('↓',()=>group?moveGroupMember(group,exercise,1):moveFlowItem('e:'+exercise.id,1),'icon-button','Опустить '+exercise.name);up.disabled=peerIndex===0;down.disabled=peerIndex===peers.length-1;
 controls.append(up,down,btn('×',()=>{if((exercise.records.some(model.filled)||exercise.note)&&!confirm('Убрать «'+exercise.name+'»?'))return;section.exercises.splice(index,1);if(group?.order)group.order=group.order.filter(id=>id!==exercise.id);syncDraftOrder()},'icon-button','Убрать '+exercise.name));head.append(controls);card.append(head);
 card.append(el('p',(sections.find(item=>item.id===section.id)?.title||section.id)+(exercise.variant?' · '+exercise.variant:''),'group-tag'));
 const last=latest(exercise.exerciseId,exercise.variant||''),lastRecord=last?.exercise.records[last.exercise.records.length-1];card.append(el('p',last?'Последний раз '+dateLabel(last.workout.date)+': '+(lastRecord?result(lastRecord)+(last.exercise.records.length>1?' · '+last.exercise.records.length+' '+plural(last.exercise.records.length,['запись','записи','записей']):''):last.exercise.note||'без параметров'):'Пока нет результатов','last-result'));
 const settings=el('details','','exercise-settings');settings.append(el('summary','Вариант и поля упражнения'));card.append(settings);
 const variantWrap=el('label','Вариант выполнения (необязательно)','variant-label'),variant=document.createElement('input');variant.type='text';variant.maxLength=100;variant.placeholder='Например: с виса, фронтальный, интервальный';variant.value=exercise.variant||'';variant.oninput=()=>{if(variant.value.trim())exercise.variant=variant.value;else delete exercise.variant;saveDraft()};variant.onchange=()=>{const value=variant.value.trim(),known=variantsFor(exercise.exerciseId,def),canonical=known.find(item=>item.toLocaleLowerCase('ru')===value.toLocaleLowerCase('ru'));if(value){exercise.variant=canonical||value;def.variants??=[];if(!canonical&&def.variants.length<50){def.variants.push(value);saveCatalog()}}else delete exercise.variant;saveDraft();renderToday()};variantWrap.append(variant);settings.append(variantWrap);
 const suggestions=variantsFor(exercise.exerciseId,def).slice(0,5);if(suggestions.length){const chips=el('div','','variant-suggestions');suggestions.forEach(value=>chips.append(btn(value,()=>{exercise.variant=value;saveDraft();renderToday()},'variant-chip')));settings.append(chips)}
 const options=el('details','','field-options');options.append(el('summary','Поля записи'));const toggles=el('div','','field-toggles');
 fields.forEach(([key,label])=>{const wrap=el('label','','field-toggle'),input=document.createElement('input');input.type='checkbox';input.checked=visible(def).includes(key);input.onchange=()=>{def.fields=input.checked?[...new Set([...visible(def),key])]:visible(def).filter(x=>x!==key);saveCatalog();renderToday()};wrap.append(input,document.createTextNode(label));toggles.append(wrap)});options.append(toggles);settings.append(options);
 const bodyweightToggle=el('label','','field-toggle'),bodyweightInput=document.createElement('input');bodyweightInput.type='checkbox';bodyweightInput.checked=!!def.bodyweight;bodyweightInput.onchange=()=>{def.bodyweight=bodyweightInput.checked;saveCatalog();renderToday()};bodyweightToggle.append(bodyweightInput,document.createTextNode('Работа с собственным весом'));toggles.append(bodyweightToggle);
 if(visible(def).includes('distanceM')){const wrap=el('label','Единица дистанции ','unit-label'),select=document.createElement('select');[['m','метры'],['km','километры']].forEach(([v,t])=>select.add(new Option(t,v)));select.value=def.distanceUnit;select.onchange=()=>{def.distanceUnit=select.value;saveCatalog();renderToday()};wrap.append(select);settings.append(wrap)}
 const rows=el('div','','record-list');exercise.records.forEach((r,j)=>rows.append(renderRecord(exercise,r,j,def)));card.append(rows);
 const actions=el('div','','record-actions');actions.append(btn('+ Следующая запись',()=>addRecord(exercise,exercise.records.length?{...exercise.records[exercise.records.length-1],note:''}:null),'secondary small'));actions.append(btn('Пустая запись',()=>addRecord(exercise)));if(last?.exercise.records.length)actions.append(btn('Взять прошлую запись',()=>addRecord(exercise,last.exercise.records[last.exercise.records.length-1])));card.append(actions);
 const note=document.createElement('textarea');note.rows=1;note.maxLength=2000;note.className='exercise-note';note.placeholder='Заметка ко всему упражнению';note.value=exercise.note;note.oninput=()=>{exercise.note=note.value;saveDraft()};card.append(note);return card
}
function renderRecord(exercise,r,index,def){
 const row=el('div','','record-row compact-record');row.dataset.record=r.id;const shown=visible(def),main=el('div','','record-main');main.append(el('strong',String(index+1),'record-number'));
 function field(key){const[,label,unit]=names[key],factor=key==='durationSec'?60:key==='distanceM'&&def.distanceUnit==='km'?1000:1,caption=key==='addedWeightKg'?'Доп. вес, кг':label+(unit?', '+(key==='distanceM'&&def.distanceUnit==='km'?'км':unit):''),wrap=el('label',caption),input=document.createElement('input');input.type='number';input.min='0';input.step=key==='reps'||key==='rounds'?'1':'any';input.inputMode=key==='reps'||key==='rounds'?'numeric':'decimal';input.placeholder='—';input.value=r[key]===undefined||r[key]===''?'':String(Number(r[key])/factor);input.oninput=()=>{if(input.value==='')delete r[key];else r[key]=String(Number(input.value)*factor);if(key==='addedWeightKg'&&def.bodyweight){r.bodyweightMode=input.value&&Number(input.value)>0?'weighted':'self';const mode=row.querySelector('.bodyweight-mode');if(mode)mode.value=r.bodyweightMode}saveDraft()};wrap.append(input);return wrap}
 shown.slice(0,2).forEach(key=>main.append(field(key)));main.append(btn('×',()=>{exercise.records.splice(index,1);saveDraft();renderToday()},'icon-button','Удалить запись '+(index+1)));row.append(main);
 const extra=el('details','','record-extra');extra.open=!!r.note||shown.slice(2).some(key=>r[key]!==undefined)||!!r.weightBasis||(def.bodyweight&&r.bodyweightMode&&r.bodyweightMode!=='self');extra.append(el('summary','Ещё параметры / заметка'));const grid=el('div','','record-fields');shown.slice(2).forEach(key=>grid.append(field(key)));if(grid.children.length)extra.append(grid);
 if(shown.includes('weightKg')){const wrap=el('label','Как указан вес','record-context'),select=document.createElement('select');[['','Не уточнять'],['total','Общий вес'],['perHand','На одну руку'],['perImplement','На один снаряд']].forEach(([value,label])=>select.add(new Option(label,value)));select.value=r.weightBasis||'';select.onchange=()=>{if(select.value)r.weightBasis=select.value;else delete r.weightBasis;saveDraft()};wrap.append(select);extra.append(wrap)}
 if(def.bodyweight){const wrap=el('label','Нагрузка собственным весом','record-context'),select=document.createElement('select');select.className='bodyweight-mode';[['self','Свой вес'],['weighted','С дополнительным весом'],['assisted','С помощью / резиной']].forEach(([value,label])=>select.add(new Option(label,value)));select.value=r.bodyweightMode||(Number(r.addedWeightKg)>0?'weighted':'self');select.onchange=()=>{r.bodyweightMode=select.value;if(select.value!=='weighted')delete r.addedWeightKg;saveDraft();renderToday()};wrap.append(select);extra.append(wrap)}
 const note=document.createElement('input');note.type='text';note.maxLength=1000;note.placeholder='Заметка к записи';note.value=r.note||'';note.setAttribute('aria-label','Заметка к записи '+(index+1));note.oninput=()=>{r.note=note.value;saveDraft()};extra.append(note);row.append(extra);return row
}
function openPicker(section,groupId=null){pickerSection=section;pickerGroupId=groupId;$('#picker-title').textContent=groupId?(draft.groups||[]).find(item=>item.id===groupId)?.name||'Комплекс':section.title;$('#picker-section-label').hidden=!groupId;$('#picker-section').value=section.id;$('#exercise-search').value='';$('#equipment-filter').value='all';$('#custom-name').value='';$('#custom-equipment').value='';renderPicker();$('#picker').showModal()}
function renderPicker(){
 const root=$('#exercise-options'),q=$('#exercise-search').value.toLocaleLowerCase('ru').trim(),equipment=$('#equipment-filter').value;root.replaceChildren();
 const retired=new Set(Hybrid.retiredIds||[]),map=new Map(pickerSection.exercises),recent=new Map();
 catalog.filter(item=>item.id.startsWith('custom:')&&(!item.sectionId||item.sectionId===pickerSection.id)).forEach(item=>map.set(item.id,item.name));
 sorted().forEach(workout=>workout.sections.find(section=>section.id===pickerSection.id)?.exercises.forEach(exercise=>{if(exercise.exerciseId.startsWith('custom:')&&!map.has(exercise.exerciseId))map.set(exercise.exerciseId,exercise.name);if(!recent.has(exercise.exerciseId))recent.set(exercise.exerciseId,recent.size)}));
 const entries=[...map].filter(([id,name])=>!retired.has(id)&&name.toLocaleLowerCase('ru').includes(q)&&(equipment==='all'||(catalog.find(item=>item.id===id)?.equipment||Hybrid.equipment[id]||'')===equipment)).map(([id,name])=>({id,name,favorite:!!catalog.find(item=>item.id===id)?.favorite}));
 function appendGroup(title,items){if(!items.length)return;root.append(el('p',title,'picker-group-title'));items.forEach(({id,name,favorite})=>{const row=el('div','','picker-option-row');row.append(btn(name+'  +',()=>addExercise(id,name),'exercise-option'),btn(favorite?'★':'☆',()=>{const def=definition(id,name);def.favorite=!def.favorite;saveCatalog();renderPicker()},'favorite-button',(favorite?'Убрать из избранного: ':'В избранное: ')+name));root.append(row)})}
 appendGroup('ИЗБРАННОЕ',entries.filter(item=>item.favorite));appendGroup('НЕДАВНИЕ',entries.filter(item=>!item.favorite&&recent.has(item.id)).sort((a,b)=>recent.get(a.id)-recent.get(b.id)));appendGroup('ВСЕ УПРАЖНЕНИЯ',entries.filter(item=>!item.favorite&&!recent.has(item.id)));
 if(!entries.length)root.append(el('p','Ничего не найдено. Можно добавить своё упражнение.','muted'));
}
function addExercise(id,name){if(!ready||busy)return;if(count(draft)>=100){toast('Максимум 100 упражнений.');return}ensureDraftOrder();const def=definition(id,name),record=makeRecord();if(def.bodyweight)record.bodyweightMode='self';const exercise={id:uid(),exerciseId:id,name,note:'',records:[record]};if(pickerGroupId){const group=(draft.groups||[]).find(item=>item.id===pickerGroupId);if(!group)return;exercise.groupId=group.id;group.order??=groupMembers(draft,group).map(item=>item.exercise.id);group.order.push(exercise.id)}else draft.order.push('e:'+exercise.id);draft.sections.find(s=>s.id===pickerSection.id).exercises.push(exercise);saveDraft();renderToday();$('#picker').close()}
function renderHistory(){
 const summary=$('#history-summary'),n=history.length;summary.replaceChildren(el('strong',String(n)),el('span',plural(n,['тренировка сохранена','тренировки сохранены','тренировок сохранено'])));
 const root=$('#history-list');root.replaceChildren();
 if(!history.length){root.append(el('p','Собери и заверши первую тренировку.','muted'));return}
 sorted().forEach(w=>{
  const card=el('details','','history-card'),head=el('summary');
  const exercises=count(w);head.append(el('span',dateLabel(w.date),'history-date'),el('span',exercises+' '+plural(exercises,['упражнение','упражнения','упражнений']),'history-meta'));
  const body=el('div','','history-content');
  if(w.sessionRpe)body.append(el('p','Сложность: '+w.sessionRpe+'/10','effort-summary'));
  for(const flow of flowItems(w)){
   if(flow.type==='group'){const group=flow.group,members=groupMembers(w,group);if(!members.length)continue;const grouped=el('section','','history-group');grouped.append(el('h3','Комплекс «'+group.name+'»'+(group.rounds?' · '+group.rounds+' '+plural(group.rounds,['круг','круга','кругов']):'')+(group.restSec!==undefined?' · отдых '+fmt(group.restSec)+' сек':'')));if(group.note)grouped.append(el('p',group.note,'muted note-text'));const outcome=groupResultText(group);if(outcome)grouped.append(el('p',outcome,'muted note-text'));members.forEach(({exercise,index})=>{const item=el('div','','history-item');item.append(el('strong',exercise.name+(exercise.variant?' · '+exercise.variant:'')+' · '+sections[index].title));exercise.records.forEach((record,j)=>item.append(el('p',(j+1)+'. '+result(record))));if(exercise.note)item.append(el('p',exercise.note,'muted note-text'));grouped.append(item)});body.append(grouped);continue}
   const e=flow.exercise,item=el('div','','history-item');item.append(el('strong',e.name+(e.variant?' · '+e.variant:'')+' · '+sections[flow.index].title));e.records.forEach((r,j)=>item.append(el('p',(j+1)+'. '+result(r))));if(e.note)item.append(el('p',e.note,'muted note-text'));body.append(item);
  }
  if(w.note)body.append(el('p',w.note,'note-text'));
  const actions=el('div','','history-actions');
  actions.append(btn('Разбор тренировки',()=>{switchView('stats');$('#stats-workout').value=w.id;renderWorkoutStats()},'secondary'));
  actions.append(btn('Повторить тренировку',()=>repeatWorkout(w),'secondary'));
  actions.append(btn('Удалить тренировку',()=>deleteWorkout(w),'text-button danger','Удалить тренировку за '+dateLabel(w.date)));
  body.append(actions);
  card.append(head,body);root.append(card);
 });
}
function makeFreshDraft(source){
 const copy=clone(source),groupIds=new Map(),exerciseIds=new Map();
 for(const group of copy.groups||[]){const old=group.id;group.id=uid();groupIds.set(old,group.id);if(group.result)group.result.id=uid();(group.roundResults||[]).forEach(round=>round.id=uid())}
 for(const section of copy.sections)for(const exercise of section.exercises){const old=exercise.id;exercise.id=uid();exerciseIds.set(old,exercise.id);if(exercise.groupId)exercise.groupId=groupIds.get(exercise.groupId);exercise.records.forEach(record=>record.id=uid())}
 for(const group of copy.groups||[])if(group.order)group.order=group.order.map(id=>exerciseIds.get(id)).filter(Boolean);
 copy.order=flowItems(source).map(item=>item.type==='group'?'g:'+groupIds.get(item.group.id):'e:'+exerciseIds.get(item.exercise.id));
 copy.date=model.today();copy.note='';delete copy.id;delete copy.completedAt;delete copy.sessionRpe;
 return model.validate(copy,false,true);
}
async function repeatWorkout(workout){
 if(!ready||busy)return;
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
 if(!empty(draft)&&!confirm('Заменить текущий черновик шаблоном «'+template.name+'»? Сначала экспортируй JSON, если хочешь сохранить черновик.'))return;
 let next;try{next=makeFreshDraft(template.workout)}catch(error){toast(error.message);return}
 setBusy(true);try{await enqueue(()=>db.draft(next));draft=next;renderToday();switchView('today');storageOK();toast('Шаблон открыт в новом черновике.')}catch(error){storageError(error);toast('Не удалось открыть шаблон.')}finally{setBusy(false)}
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
 const ordered=[];for(const item of flowItems(workout)){if(item.type==='group'){ordered.push(item,...groupMembers(workout,item.group))}else ordered.push(item)}
 ordered.forEach(item=>{
  if(item.type==='group'){const group=item.group,members=groupMembers(workout,group),outcome=groupResultText(group);if(members.length)root.append(el('p','Комплекс «'+group.name+'»: '+members.map(entry=>entry.exercise.name).join(' → ')+(group.rounds?' · '+group.rounds+' '+plural(group.rounds,['круг','круга','кругов']):'')+(group.restSec!==undefined?' · отдых '+fmt(group.restSec)+' сек':'')+(outcome?' · '+outcome:''),'group-history'));return}
  const {exercise,index}=item;
  root.append(el('h3',sections[index].title,'workout-section-title'));
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
function switchView(name){document.querySelectorAll('.view').forEach(e=>e.hidden=e.id!==name+'-view');document.querySelectorAll('[data-view]').forEach(b=>{const active=b.dataset.view===name;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});if(name==='history')renderHistory();if(name==='stats')renderStats();if(name==='data')renderTemplates();window.scrollTo(0,0)}
function validateDefinition(d){
 if(!d||typeof d.id!=='string'||!d.id||d.id.length>150||typeof d.name!=='string'||!d.name.trim()||d.name.length>100||!Array.isArray(d.fields)||d.fields.some(k=>!keys.includes(k))||!['m','km'].includes(d.distanceUnit)||typeof d.volumeEnabled!=='boolean'||(d.bodyweight!==undefined&&typeof d.bodyweight!=='boolean')||(d.favorite!==undefined&&typeof d.favorite!=='boolean'))throw Error('Некорректная настройка упражнения.');
 const equipment=d.equipment??Hybrid.equipment[d.id]??'',allowed=new Set(Hybrid.equipmentLabels.map(([key])=>key));
 if(equipment!==''&&!allowed.has(equipment)||equipment==='all'||(d.variants!==undefined&&(!Array.isArray(d.variants)||d.variants.length>50||d.variants.some(value=>typeof value!=='string'||!value.trim()||value.length>100))))throw Error('Некорректные варианты или инвентарь упражнения.');
 return{id:d.id,name:d.name,sectionId:d.sectionId||null,fields:[...new Set(d.fields)],distanceUnit:d.distanceUnit,volumeEnabled:d.volumeEnabled,bodyweight:d.bodyweight??Hybrid.bodyweightIds.includes(d.id),equipment,favorite:d.favorite??false,variants:[...new Set(d.variants||[])]};
}
function validateBackup(raw){if(!raw||raw.app!=='hybrid-training'||![1,2].includes(raw.schemaVersion)||!Array.isArray(raw.history)||raw.history.length>10000)throw Error('Нужен JSON-экспорт «Гибрид» версии 1 или 2.');const data={history:raw.history.map(w=>raw.schemaVersion===1?model.legacy(w,true):model.validate(w,true)),draft:raw.draft==null?null:raw.schemaVersion===1?model.legacy(raw.draft):model.validate(raw.draft,false,true),catalog:raw.schemaVersion===2&&Array.isArray(raw.catalog)?raw.catalog.map(validateDefinition):[],templates:raw.schemaVersion===2&&Array.isArray(raw.templates)?raw.templates.map(model.template):[]},ids=new Set(),templateIds=new Set();data.history.forEach(w=>{if(ids.has(w.id))throw Error('Повторяются ID тренировок.');ids.add(w.id)});data.templates.forEach(template=>{if(templateIds.has(template.id))throw Error('Повторяются ID шаблонов.');templateIds.add(template.id)});return data}
function planImport(backup,current){const byId=new Map(current.history.map(w=>[w.id,w])),added=[];let skipped=0;backup.history.forEach(w=>{const old=byId.get(w.id);if(!old)added.push(w);else if(JSON.stringify(old)===JSON.stringify(w))skipped++;else throw Error('Конфликт: тренировки с одинаковым ID отличаются. Импорт отменён.')});const nextCatalog=clone(catalog);backup.catalog.forEach(d=>{const old=nextCatalog.find(e=>e.id===d.id);if(!old)nextCatalog.push(d);else{old.favorite=old.favorite||d.favorite;old.variants=[...new Set([...(old.variants||[]),...(d.variants||[])])].slice(0,50);if(!old.equipment)old.equipment=d.equipment}});const nextTemplates=clone(current.templates||[]),knownTemplates=new Map(nextTemplates.map(template=>[template.id,template]));backup.templates.forEach(template=>{const old=knownTemplates.get(template.id);if(!old){nextTemplates.push(template);knownTemplates.set(template.id,template)}else if(JSON.stringify(old)!==JSON.stringify(template))throw Error('Конфликт: шаблоны с одинаковым ID отличаются. Импорт отменён.')});return{added,skipped,draft:backup.draft&&(!current.draft||empty(current.draft))?backup.draft:null,catalog:nextCatalog,templates:nextTemplates}}
async function finish(){if(!ready||busy||!count(draft))return;const invalid=[...document.querySelectorAll('#today-view input')].find(e=>!e.checkValidity());if(invalid){invalid.reportValidity();return}let workout;try{workout=model.validate({...clone(draft),id:uid(),completedAt:new Date().toISOString()},true)}catch(e){toast(e.message);return}if(!workout.sections.some(s=>s.exercises.some(e=>e.records.length||e.note.trim()))&&!workout.note.trim()){toast('Добавь результат или заметку.');return}setBusy(true);try{await enqueue(()=>db.finish(workout));history.push(workout);draft=model.empty();renderToday();storageOK();switchView('history');toast('Тренировка сохранена.')}catch(e){storageError(e)}finally{setBusy(false)}}
async function exportData(){if(busy)return;const data={app:'hybrid-training',schemaVersion:2,exportedAt:new Date().toISOString(),history:clone(history),draft:clone(draft),catalog:clone(catalog),templates:clone(templates)};if(legacySnapshot)data.legacySnapshot=legacySnapshot;const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='hybrid-training-'+model.today()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);$('#backup-info').textContent='Файл подготовлен. Сохрани его в «Файлы» или iCloud Drive.';if(ready)enqueue(()=>db.backup(new Date().toISOString())).catch(storageError)}
async function previewImport(ev){const file=ev.target.files[0];ev.target.value='';pendingImport=null;const box=$('#import-preview');box.replaceChildren();box.hidden=true;if(!file||!ready||busy)return;try{if(file.size>10*1024*1024)throw Error('Максимальный размер файла — 10 МБ.');const backup=validateBackup(JSON.parse(await file.text()));await queue;const current=await db.read(),plan=planImport(backup,{history:current.history,draft,templates:current.templates});pendingImport=backup;box.append(el('p','Новых тренировок: '+plan.added.length+'. Уже есть: '+plan.skipped+'. Шаблонов: '+backup.templates.length+'. '+(plan.draft?'Черновик восстановится.':'Текущий черновик сохранится.')));const b=btn('Импортировать',applyImport,'primary');b.id='confirm-import';box.append(b);box.hidden=false}catch(e){box.append(el('p',e instanceof SyntaxError?'Не удалось прочитать JSON.':e.message));box.hidden=false}}
async function applyImport(){if(!pendingImport||busy||!ready)return;setBusy(true);try{const plan=await enqueue(async()=>{const current=await db.read(),plan=planImport(pendingImport,{history:current.history,draft,templates:current.templates});await db.import(plan.added,plan.draft,plan.catalog,plan.templates);history=[...current.history,...plan.added];catalog=plan.catalog;templates=plan.templates;return plan});if(plan.draft)draft=plan.draft;pendingImport=null;$('#import-preview').hidden=true;renderToday();renderHistory();renderTemplates();storageOK();toast('Добавлено тренировок: '+plan.added.length+'.')}catch(e){toast(e.message)}finally{setBusy(false)}}
function setupWorker(){if(!('serviceWorker'in navigator)){$('#connection').textContent='Офлайн недоступен';return}const state=()=>$('#connection').textContent=!navigator.onLine?(navigator.serviceWorker.controller?'Без сети · офлайн':'Без сети'):(navigator.serviceWorker.controller?'Офлайн готов':'Готовим офлайн…');navigator.serviceWorker.addEventListener('controllerchange',state);window.addEventListener('online',state);window.addEventListener('offline',state);navigator.serviceWorker.register('./service-worker.js').then(reg=>{const show=()=>{if(reg.waiting&&navigator.serviceWorker.controller){waitingWorker=reg.waiting;$('#update-banner').hidden=false}};show();reg.addEventListener('updatefound',()=>reg.installing?.addEventListener('statechange',show));state()}).catch(e=>{console.error(e);$('#connection').textContent='Офлайн недоступен'});$('#update-app').onclick=async()=>{if(!waitingWorker||busy||!ready)return;setBusy(true);try{await enqueue(()=>db.draft(clone(draft)));navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});waitingWorker.postMessage({type:'SKIP_WAITING'})}catch(e){storageError(e);setBusy(false)}}}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));$('#close-picker').onclick=()=>$('#picker').close();$('#exercise-search').oninput=renderPicker;
Hybrid.equipmentLabels.forEach(([key,label])=>$('#equipment-filter').add(new Option(label,key)));$('#custom-equipment').add(new Option('Не указывать',''));Hybrid.equipmentLabels.filter(([key])=>key!=='all').forEach(([key,label])=>$('#custom-equipment').add(new Option(label,key)));$('#equipment-filter').onchange=renderPicker;
sections.forEach(section=>$('#picker-section').add(new Option(section.title,section.id)));$('#picker-section').onchange=()=>{pickerSection=sections.find(section=>section.id===$('#picker-section').value);$('#exercise-search').value='';renderPicker()};
$('#close-group').onclick=()=>$('#group-dialog').close();
$('#group-form').onsubmit=event=>{
 event.preventDefault();if(!ready||busy)return;ensureDraftOrder();
 const selected=new Set([...document.querySelectorAll('#group-member-options input:checked')].map(input=>input.value)),id=editingGroupId||uid(),previous=(draft.groups||[]).find(item=>item.id===id);
 const group={id,name:$('#group-name').value.trim(),note:$('#group-note').value.trim(),sectionId:groupSectionId||'capacity'};
 if(previous?.result)group.result=clone(previous.result);if(previous?.roundResults?.length)group.roundResults=clone(previous.roundResults);
 if($('#group-rounds').value!=='')group.rounds=Number($('#group-rounds').value);
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
$('#custom-form').onsubmit=ev=>{ev.preventDefault();const name=$('#custom-name').value.trim();if(!name||!pickerSection)return;const normalized=name.toLocaleLowerCase('ru').replace(/\s+/g,' '),match=pickerSection.exercises.find(([,n])=>n.toLocaleLowerCase('ru')===normalized)||catalog.find(e=>e.id.startsWith('custom:')&&(!e.sectionId||e.sectionId===pickerSection.id)&&e.name.toLocaleLowerCase('ru').replace(/\s+/g,' ')===normalized),id=match?(Array.isArray(match)?match[0]:match.id):'custom:'+uid();if(!match){catalog.push({id,name,sectionId:pickerSection.id,fields:['weightKg','reps'],distanceUnit:'m',volumeEnabled:false,bodyweight:false,equipment:$('#custom-equipment').value,favorite:false,variants:[]});saveCatalog()}addExercise(id,name)};
$('#workout-date').oninput=()=>{draft.date=$('#workout-date').value;saveDraft()};$('#workout-note').oninput=()=>{draft.note=$('#workout-note').value;saveDraft();updateTotal()};$('#session-rpe').onchange=()=>{if($('#session-rpe').value)draft.sessionRpe=Number($('#session-rpe').value);else delete draft.sessionRpe;saveDraft()};$('#finish').onclick=finish;$('#clear-draft').onclick=()=>{if(!ready||busy||!confirm('Очистить черновик?'))return;draft=model.empty();saveDraft();renderToday()};$('#save-template').onclick=openTemplateDialog;$('#close-template').onclick=()=>$('#template-dialog').close();$('#template-form').onsubmit=event=>{event.preventDefault();saveTemplate()};$('#export').onclick=exportData;$('#import-file').onchange=previewImport;$('#stats-workout').onchange=renderWorkoutStats;$('#stats-exercise').onchange=()=>{renderVariantOptions();renderBasisOptions();renderExerciseStats()};$('#stats-variant').onchange=()=>{renderBasisOptions();renderExerciseStats()};$('#stats-basis').onchange=renderExerciseStats;$('#stats-metric').onchange=renderExerciseStats;$('#volume-toggle').onchange=()=>{const d=catalog.find(e=>e.id===$('#stats-exercise').value);if(!d)return;d.volumeEnabled=$('#volume-toggle').checked;saveCatalog();renderExerciseStats()};
setBusy(true);renderToday();db.open().then(async()=>{let data=await db.read();if(data.history.some(w=>w.schemaVersion!==2)||(data.draft&&data.draft.schemaVersion!==2)){const snapshot={migratedAt:new Date().toISOString(),history:data.history,draft:data.draft},migrated=data.history.map(w=>w.schemaVersion===2?w:model.legacy(w,true)),next=data.draft?(data.draft.schemaVersion===2?data.draft:model.legacy(data.draft)):null;await db.migrate(migrated,next,snapshot);data=await db.read();toast('Старая история перенесена.')}history=data.history.map(w=>model.validate(w,true));draft=data.draft?model.validate(data.draft,false,true):model.empty();catalog=Array.isArray(data.catalog)?data.catalog.map(validateDefinition):[];templates=Array.isArray(data.templates)?data.templates.map(model.template):[];legacySnapshot=data.legacySnapshot;ready=true;renderToday();renderTemplates();storageOK();setBusy(false);if(data.backup)$('#backup-info').textContent='Последний экспорт: '+new Date(data.backup).toLocaleString('ru-RU')}).catch(e=>{setBusy(false);storageError(e)});setupWorker();
})();
