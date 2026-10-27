'use strict';
(() => {
  const fields = [
    ['weightKg', 'Вес', 'кг'], ['addedWeightKg', 'Доп. вес', 'кг'],
    ['reps', 'Повторы', ''], ['durationSec', 'Время', 'мин'],
    ['distanceM', 'Дистанция', 'м'], ['rounds', 'Круги', '']
  ];
  const keys = fields.map(field => field[0]);
  const weightBases = ['total', 'perHand', 'perImplement'];
  const bodyweightModes = ['self', 'weighted', 'assisted'];
  const limits = { weightKg: 100000, addedWeightKg: 100000, reps: 100000, durationSec: 86400000, distanceM: 100000000, rounds: 100000 };
  const uid = () => crypto.randomUUID();
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const empty = () => ({ schemaVersion: 2, date: today(), note: '', sections: Hybrid.sections.map(s => ({ id: s.id, exercises: [] })), groups: [], order: [] });
  const str = (value, max, name, required = false) => {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`Некорректное поле «${name}».`);
    return value;
  };
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T12:00:00Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function number(value, key, incomplete) {
    if (value == null || value === '') return null;
    if (incomplete && typeof value === 'string' && value.length < 32 && /^[0-9.,]*$/.test(value)) return value;
    const n = Number(typeof value === 'string' ? value.replace(',', '.') : value);
    if (!Number.isFinite(n) || n < 0 || n > limits[key] || ((key === 'reps' || key === 'rounds') && !Number.isInteger(n))) throw new Error(`Некорректное значение «${fields.find(f => f[0] === key)[1]}».`);
    return n;
  }
  function record(value, incomplete = false) {
    if (!value || typeof value !== 'object') throw new Error('Некорректная запись.');
    const out = { id: str(value.id, 150, 'id записи', true) };
    keys.forEach(key => { const n = number(value[key], key, incomplete); if (n !== null) out[key] = n; });
    if (value.weightBasis != null && value.weightBasis !== '') {
      if (!weightBases.includes(value.weightBasis)) throw new Error('Некорректный способ указания веса.');
      out.weightBasis = value.weightBasis;
    }
    if (value.bodyweightMode != null && value.bodyweightMode !== '') {
      if (!bodyweightModes.includes(value.bodyweightMode)) throw new Error('Некорректный способ выполнения с собственным весом.');
      out.bodyweightMode = value.bodyweightMode;
    }
    if (out.bodyweightMode && out.bodyweightMode !== 'weighted' && Number(out.addedWeightKg) > 0) throw new Error('Дополнительный вес не соответствует способу выполнения.');
    if (value.attempts != null) {
      const a=value.attempts;
      if (!a || typeof a!=='object' || Array.isArray(a)) throw new Error('Некорректные попытки.');
      out.attempts={};
      for (const key of ['successful','failed']) {
        const raw=a[key], n=Number(raw);
        if ((typeof raw!=='number' && typeof raw!=='string') || (typeof raw==='string' && !raw.trim()) || !Number.isInteger(n) || n<0 || n>100000) throw new Error('Попытки должны быть целыми числами от 0 до 100000.');
        out.attempts[key]=n;
      }
      const total=out.attempts.successful+out.attempts.failed;
      if (a.total!==undefined && a.total!==total) throw new Error('Общее число попыток не совпадает с результатами.');
    }
    if (value.kind != null && value.kind!=='') {
      if (!['warmup','technique','working'].includes(value.kind)) throw new Error('Некорректный тип подхода.');
      out.kind=value.kind;
    }
    for(const key of ['pending','marked'])if(value[key]!==undefined){if(typeof value[key]!=='boolean')throw Error('Некорректное состояние записи.');if(value[key])out[key]=true}
    out.note = str(value.note ?? '', 1000, 'Заметка записи');
    return out;
  }
  const filled = rec => keys.some(key => rec[key] !== undefined && rec[key] !== null && rec[key] !== '') || !!rec.note?.trim() || Number(rec.attempts?.successful)>0 || Number(rec.attempts?.failed)>0 || rec.marked===true;
  function validate(value, completed = false, incomplete = false) {
    if (!value || value.schemaVersion !== 2 || !validDate(value.date) || !Array.isArray(value.sections) || value.sections.length !== Hybrid.sections.length) throw new Error('Некорректная структура тренировки.');
    const ids = new Set(); let count = 0;
    const out = { schemaVersion: 2, date: value.date, note: str(value.note, 2000, 'Заметка тренировки'), sections: [] };
    if (value.sessionRpe != null && value.sessionRpe !== '') {
      const effort = Number(value.sessionRpe);
      if (!Number.isInteger(effort) || effort < 1 || effort > 10) throw new Error('Оценка сложности должна быть от 1 до 10.');
      out.sessionRpe = effort;
    }
    if (value.sectionRpe != null) {
      if (!value.sectionRpe || typeof value.sectionRpe !== 'object' || Array.isArray(value.sectionRpe)) throw new Error('Некорректные оценки блоков.');
      const ratings = {};
      for (const section of Hybrid.sections) {
        const valueForSection = value.sectionRpe[section.id];
        if (valueForSection == null || valueForSection === '') continue;
        const effort = Number(valueForSection);
        if (!Number.isInteger(effort) || effort < 1 || effort > 10) throw new Error('Оценка сложности блока должна быть от 1 до 10.');
        ratings[section.id] = effort;
      }
      if (Object.keys(ratings).length) out.sectionRpe = ratings;
    }
    if (value.groups !== undefined) {
      if (!Array.isArray(value.groups) || value.groups.length > 30) throw new Error('Некорректные группы упражнений.');
      const groupIds = new Set();
      const groups = value.groups.map(group => {
        if (!group || typeof group !== 'object') throw new Error('Некорректная группа упражнений.');
        const id = str(group.id, 150, 'ID группы', true);
        if (groupIds.has(id)) throw new Error('Повторяющийся ID группы.');
        groupIds.add(id);
        const clean = { id, name: str(group.name, 100, 'Название группы', true), note: str(group.note ?? '', 1000, 'Заметка группы') };
        if (group.sectionId != null && group.sectionId !== '') {
          const sectionId = str(group.sectionId, 50, 'Секция комплекса', true);
          if (!Hybrid.sections.some(section => section.id === sectionId)) throw new Error('Некорректная секция комплекса.');
          clean.sectionId = sectionId;
        }
        if (group.rounds != null && group.rounds !== '') {
          const rounds = Number(group.rounds);
          if (!Number.isInteger(rounds) || rounds < 1 || rounds > 1000) throw new Error('Некорректное число кругов группы.');
          clean.rounds = rounds;
        }
        if(group.plannedRounds!==undefined){const n=Number(group.plannedRounds);if(!Number.isInteger(n)||n<1||n>1000)throw Error('Некорректный план кругов.');if(!completed)clean.plannedRounds=n}
        if (group.restSec != null && group.restSec !== '') {
          const restSec = Number(group.restSec);
          if (!Number.isFinite(restSec) || restSec < 0 || restSec > 86400) throw new Error('Некорректный отдых группы.');
          clean.restSec = restSec;
        }
        if (group.result != null) {
          const result = record(group.result);
          if (filled(result)&&(!completed||!result.pending)) clean.result = result;
        }
        if (group.roundResults !== undefined) {
          if (!Array.isArray(group.roundResults) || group.roundResults.length > 1000) throw new Error('Некорректные результаты кругов.');
          const seenRounds = new Set();
          const roundResults = group.roundResults.map(value => {
            if (!value || typeof value !== 'object') throw new Error('Некорректный результат круга.');
            const round = Number(value.round);
            if (!Number.isInteger(round) || round < 1 || round > 1000 || seenRounds.has(round)) throw new Error('Некорректный номер круга.');
            seenRounds.add(round);
            return { round, ...record(value) };
          }).filter(result => filled(result)&&(!completed||!result.pending));
          if (roundResults.length) clean.roundResults = roundResults;
        }
        if (group.order !== undefined) {
          if (!Array.isArray(group.order) || group.order.length > 100 || group.order.some(item => typeof item !== 'string' || !item || item.length > 150) || new Set(group.order).size !== group.order.length) throw new Error('Некорректный порядок упражнений комплекса.');
          clean.order = [...group.order];
        }
        return clean;
      });
      if (groups.length) out.groups = groups;
    }
    const groupIds = new Set((out.groups || []).map(group => group.id));
    value.sections.forEach((section, index) => {
      if (section?.id !== Hybrid.sections[index].id || !Array.isArray(section.exercises)) throw new Error('Некорректная секция.');
      const exercises = section.exercises.map(exercise => {
        if (!exercise || !Array.isArray(exercise.records) || exercise.records.length > 500) throw new Error('Некорректное упражнение.');
        const id = str(exercise.id, 150, 'id упражнения', true);
        if (ids.has(id)) throw new Error('Повторяющийся ID упражнения.'); ids.add(id);
        const recordIds = new Set();
        const records = exercise.records.map(raw => {
          const clean = record(raw, incomplete);
          if (recordIds.has(clean.id)) throw new Error('Повторяющийся ID записи.'); recordIds.add(clean.id);
          return clean;
        }).filter(clean => (!completed||!clean.pending)&&(incomplete || filled(clean)));
        count++;
        const clean = { id, exerciseId: str(exercise.exerciseId, 150, 'ID каталога', true), name: str(exercise.name, 100, 'Название', true), note: str(exercise.note ?? '', 2000, 'Заметка упражнения'), records };
        const variant = str(exercise.variant ?? '', 100, 'Вариант выполнения').trim();
        if (variant) clean.variant = variant;
        if (exercise.groupId != null && exercise.groupId !== '') {
          const groupId = str(exercise.groupId, 150, 'ID группы упражнения', true);
          if (!groupIds.has(groupId)) throw new Error('Упражнение ссылается на отсутствующую группу.');
          clean.groupId = groupId;
        }
        return clean;
      });
      out.sections.push({ id: section.id, exercises });
    });
    if (out.sectionRpe) {
      for (const sectionId of Object.keys(out.sectionRpe)) if (!out.sections.find(section => section.id === sectionId)?.exercises.length) delete out.sectionRpe[sectionId];
      if (!Object.keys(out.sectionRpe).length) delete out.sectionRpe;
    }
    if (count > 100) throw new Error('Слишком много упражнений.');
    for (const group of out.groups || []) {
      if (group.order) group.order = group.order.filter(id => out.sections.some(section => section.exercises.some(exercise => exercise.id === id && exercise.groupId === group.id)));
      if (!group.sectionId) {
        const memberSections = out.sections.filter(section => section.exercises.some(exercise => exercise.groupId === group.id));
        if (memberSections.length === 1) group.sectionId = memberSections[0].id;
      }
    }
    if (value.order !== undefined) {
      if (!Array.isArray(value.order) || value.order.length > 130 || value.order.some(item => typeof item !== 'string' || item.length > 152 || !/^[eg]:.+$/.test(item)) || new Set(value.order).size !== value.order.length) throw new Error('Некорректный порядок тренировки.');
      const available = new Set([...(out.groups || []).map(group => 'g:' + group.id), ...out.sections.flatMap(section => section.exercises.filter(exercise => !exercise.groupId).map(exercise => 'e:' + exercise.id))]);
      out.order = value.order.filter(item => available.has(item));
      for (const item of available) if (!out.order.includes(item)) out.order.push(item);
    }
    if (completed) {
      if ((!count && !(out.groups||[]).some(g=>g.rounds||g.result||g.roundResults?.length)) || typeof value.completedAt !== 'string' || Number.isNaN(Date.parse(value.completedAt))) throw new Error('Некорректная завершённая тренировка.');
      out.id = str(value.id, 150, 'id тренировки', true); out.completedAt = new Date(value.completedAt).toISOString();
    }
    return out;
  }
  function legacy(value, completed = false) {
    if (!value || !(validDate(value.date) || (!completed && value.date === '')) || !Array.isArray(value.items)) throw new Error('Некорректная старая тренировка.');
    const out = empty(); delete out.order; out.date = value.date || today(); out.note = str(value.note ?? '', 2000, 'Заметка');
    for (const item of value.items) {
      const section = out.sections.find(s => s.id === item.sectionId);
      if (!section) throw new Error('Неизвестная секция старой тренировки.');
      const sets = item.sets === '' ? 1 : Number(item.sets);
      if (!Number.isInteger(sets) || sets < 0 || sets > 10000) throw new Error('Некорректные подходы старой тренировки.');
      const base = { id: uid(), note: '' };
      if (item.weight !== '') base.weightKg = number(item.weight, 'weightKg', false);
      if (item.reps !== '') base.reps = number(item.reps, 'reps', false);
      const notes = [];
      if (item.note) notes.push(item.note);
      if (item.time !== '') {
        if (sets <= 1) base.durationSec = number(Number(item.time) * 60, 'durationSec', false);
        else notes.push(`Время в старой записи: ${item.time} мин (общее, не распределено по подходам)`);
      }
      const hasBase = filled(base);
      if (sets > 500) notes.push(`В старой записи: ${sets} подходов; подробности сохранены в исходной копии`);
      const records = hasBase ? Array.from({ length: Math.max(Math.min(sets, 500), 1) }, (_, index) => ({ ...base, id: `${item.id || item.exerciseId}:record:${index + 1}` })) : [];
      if (item.sets === '0') notes.push('В старой записи: 0 подходов');
      section.exercises.push({ id: item.id || uid(), exerciseId: item.exerciseId, name: item.name, note: notes.join(' · '), records });
    }
    if (completed) { out.id = value.id; out.completedAt = value.completedAt; }
    return validate(out, completed);
  }
  function template(value) {
    if (!value || typeof value !== 'object') throw new Error('Некорректный шаблон.');
    const out = {
      id: str(value.id, 150, 'ID шаблона', true),
      name: str(value.name, 100, 'Название шаблона', true),
      createdAt: str(value.createdAt, 80, 'Дата создания шаблона', true),
      workout: validate(value.workout, false, false)
    };
    if (Number.isNaN(Date.parse(out.createdAt))) throw new Error('Некорректная дата создания шаблона.');
    if (!out.workout.sections.some(section => section.exercises.length)) throw new Error('Шаблон должен содержать хотя бы одно упражнение.');
    return out;
  }
  function metrics(exercise) {
    const records = (exercise.records || []).filter(r=>!r.pending);
    const values = key => records.map(r => Number(r[key])).filter((n, i) => rHas(records[i], key) && Number.isFinite(n));
    const sum = key => values(key).reduce((a, b) => a + b, 0);
    const max = key => Math.max(...values(key));
    const result = { setsCount: records.length };
    const known=records.filter(r=>r.attempts && r.attempts.successful+r.attempts.failed>0);
    if (known.length) {
      result.successfulAttempts=known.reduce((n,r)=>n+r.attempts.successful,0);
      result.failedAttempts=known.reduce((n,r)=>n+r.attempts.failed,0);
      result.totalAttempts=result.successfulAttempts+result.failedAttempts;
      result.successRate=result.successfulAttempts/result.totalAttempts*100;
    }
    for (const key of keys) if (values(key).length) result[key === 'weightKg' || key === 'addedWeightKg' ? key + 'Max' : key + 'Sum'] = key === 'weightKg' || key === 'addedWeightKg' ? max(key) : sum(key);
    const successfulWeights=records.filter(r=>Number(r.attempts?.successful)>0&&rHas(r,'weightKg')).map(r=>Number(r.weightKg));
    if(successfulWeights.length)result.successfulWeightKgMax=Math.max(...successfulWeights);
    if(values('distanceM').length)result.distanceMMax=max('distanceM');
    const volumeRecords = records.filter(r => rHas(r, 'weightKg') && rHas(r, 'reps'));
    if (volumeRecords.length && volumeRecords.every(r => !r.weightBasis || r.weightBasis === 'total')) result.volume = volumeRecords.reduce((total, r) => total + Number(r.weightKg) * Number(r.reps), 0);
    const paceRecords = records.filter(r => Number(r.durationSec) > 0 && Number(r.distanceM) > 0);
    if (paceRecords.length) result.pace = paceRecords.reduce((a, r) => a + Number(r.durationSec), 0) / paceRecords.reduce((a, r) => a + Number(r.distanceM), 0) * 1000 / 60;
    return result;
  }
  const rHas = (r, key) => r[key] !== undefined && r[key] !== null && r[key] !== '';
  function dailyMetrics(workouts, exerciseId, variant = '', weightBasis = null) {
    const days = new Map();
    for (const workout of workouts) {
      for (const section of workout.sections) {
        for (const exercise of section.exercises) {
          if (exercise.exerciseId !== exerciseId || (variant && (exercise.variant || '') !== variant)) continue;
          const records = weightBasis === null ? exercise.records : exercise.records.filter(record => (record.weightBasis || '') === weightBasis);
          if (!records.length) continue;
          if (!days.has(workout.date)) days.set(workout.date, []);
          days.get(workout.date).push(...records);
        }
      }
    }
    return [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, records]) => ({ date, metrics: metrics({ records }) }));
  }

  function attemptBreakdown(exercises){
    const groups=new Map();
    for(const e of exercises)for(const r of e.records.filter(r=>!r.pending)){
      const weight=rHas(r,'weightKg')?Number(r.weightKg):null,basis=r.weightBasis||'',variant=e.variant||'',key=JSON.stringify([variant,basis,weight]);
      if(!groups.has(key))groups.set(key,{variant,basis,weight,successful:0,failed:0,unknownRecords:0});
      const row=groups.get(key),total=Number(r.attempts?.successful||0)+Number(r.attempts?.failed||0);
      if(total>0){row.successful+=Number(r.attempts.successful);row.failed+=Number(r.attempts.failed)}else row.unknownRecords++;
    }
    return [...groups.values()].map(row=>({...row,total:row.successful+row.failed,rate:row.successful+row.failed?row.successful/(row.successful+row.failed)*100:null})).sort((a,b)=>a.variant.localeCompare(b.variant)||a.basis.localeCompare(b.basis)||(a.weight??-1)-(b.weight??-1));
  }
  function distanceResults(exercises){
    const groups=new Map();
    for(const e of exercises)for(const r of e.records.filter(r=>!r.pending)){
      if(!(Number(r.distanceM)>0&&Number(r.durationSec)>0))continue;
      const distance=Number(r.distanceM),variant=e.variant||'',key=JSON.stringify([variant,distance]);
      if(!groups.has(key))groups.set(key,{variant,distance,bestSec:Number(r.durationSec),count:0});
      const row=groups.get(key);row.count++;row.bestSec=Math.min(row.bestSec,Number(r.durationSec));
    }
    return [...groups.values()].sort((a,b)=>a.variant.localeCompare(b.variant)||a.distance-b.distance);
  }


  const isActual=r=>!r.pending&&filled(r);
  function pendingCount(w){return w.sections.reduce((n,s)=>n+s.exercises.reduce((m,e)=>m+e.records.filter(r=>r.pending).length,0),0)+(w.groups||[]).reduce((n,g)=>n+Number(!!g.result?.pending)+(g.roundResults||[]).filter(r=>r.pending).length+Number(!!g.plannedRounds),0)}
  function actualize(value){const out=JSON.parse(JSON.stringify(value));
    for(const s of out.sections)s.exercises=s.exercises.filter(e=>{const hadPending=e.records.some(r=>r.pending);e.records=e.records.filter(r=>!r.pending);return e.records.some(filled)||!hadPending&&!!e.note?.trim()});
    out.groups=(out.groups||[]).filter(g=>{delete g.plannedRounds;if(g.result?.pending)delete g.result;g.roundResults=(g.roundResults||[]).filter(r=>!r.pending);if(!g.rounds&&g.roundResults.some(filled))g.rounds=g.roundResults.filter(filled).length;return out.sections.some(s=>s.exercises.some(e=>e.groupId===g.id))||g.rounds||g.result&&filled(g.result)||g.roundResults.some(filled)});
    return out;
  }
  function parseDuration(value){const text=String(value).trim();if(!text)return null;let n;if(/^\d+:\d{2}(?:[.,]\d+)?$/.test(text)){const [min,sec]=text.replace(',','.').split(':');if(Number(sec)>=60)throw Error('Секунды после двоеточия: от 00 до 59.');n=Number(min)*60+Number(sec)}else if(/^\d+(?:[.,]\d+)?$/.test(text))n=Number(text.replace(',','.'));else throw Error('Время: секунды или мин:сек, например 5 или 1:30.');if(!Number.isFinite(n)||n>limits.durationSec)throw Error('Слишком большая длительность.');return n}
  function formatDuration(value){if(value===undefined||value===null||value==='')return '';const n=Math.round(Number(value)*1000)/1000,min=Math.floor(n/60),sec=Math.round((n-min*60)*1000)/1000;return min+':'+(sec<10?'0':'')+String(sec)}

  Hybrid.model = { isActual, pendingCount, actualize, parseDuration, formatDuration, attemptBreakdown, distanceResults, fields, keys, weightBases, bodyweightModes, uid, today, empty, validate, legacy, template, filled, metrics, dailyMetrics };
})();
