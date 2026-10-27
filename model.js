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
    out.note = str(value.note ?? '', 1000, 'Заметка записи');
    return out;
  }
  const filled = rec => keys.some(key => rec[key] !== undefined && rec[key] !== null && rec[key] !== '') || !!rec.note?.trim();
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
        if (group.restSec != null && group.restSec !== '') {
          const restSec = Number(group.restSec);
          if (!Number.isFinite(restSec) || restSec < 0 || restSec > 86400) throw new Error('Некорректный отдых группы.');
          clean.restSec = restSec;
        }
        if (group.result != null) {
          const result = record(group.result);
          if (filled(result)) clean.result = result;
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
          }).filter(result => filled(result));
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
        }).filter(clean => incomplete || filled(clean));
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
      if (!count || typeof value.completedAt !== 'string' || Number.isNaN(Date.parse(value.completedAt))) throw new Error('Некорректная завершённая тренировка.');
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
    const records = exercise.records || [];
    const values = key => records.map(r => Number(r[key])).filter((n, i) => rHas(records[i], key) && Number.isFinite(n));
    const sum = key => values(key).reduce((a, b) => a + b, 0);
    const max = key => Math.max(...values(key));
    const result = { setsCount: records.length };
    for (const key of keys) if (values(key).length) result[key === 'weightKg' || key === 'addedWeightKg' ? key + 'Max' : key + 'Sum'] = key === 'weightKg' || key === 'addedWeightKg' ? max(key) : sum(key);
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
  Hybrid.model = { fields, keys, weightBases, bodyweightModes, uid, today, empty, validate, legacy, template, filled, metrics, dailyMetrics };
})();
