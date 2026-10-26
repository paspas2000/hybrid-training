'use strict';
window.Hybrid = {
  sections: [
    { id: 'skill', number: '01', title: 'Навык / мощность', subtitle: 'Техника. Скорость. Взрывное усилие.', exercises: [
      ['broad-jump', 'Прыжок в длину с места'], ['sprint', 'Спринт'], ['kb-snatch', 'Рывок гири'],
      ['clean', 'Взятие штанги на грудь'], ['handstand', 'Стойка на руках'], ['medball', 'Броски медбола'],
      ['barbell-snatch', 'Рывок штанги'], ['barbell-jerk', 'Толчок штанги от груди'],
      ['clean-and-jerk', 'Взятие и толчок штанги'], ['kb-clean', 'Взятие гири на грудь'],
      ['kb-jerk', 'Толчок гири'], ['push-press', 'Пуш-пресс']
    ]},
    { id: 'strength', number: '02', title: 'Сила', subtitle: 'Контролируемая работа с сопротивлением.', exercises: [
      ['squat', 'Приседания со штангой'], ['deadlift', 'Становая тяга'], ['bench', 'Жим лёжа'],
      ['press', 'Жим стоя'], ['pullup', 'Подтягивания'], ['dip', 'Отжимания на брусьях'],
      ['row', 'Тяга в наклоне'], ['lunge', 'Выпады'], ['pushup', 'Отжимания'],
      ['romanian-deadlift', 'Румынская тяга'], ['bulgarian-split-squat', 'Болгарские сплит-приседания'],
      ['lat-pulldown', 'Тяга вертикального блока'], ['seated-row', 'Тяга горизонтального блока'],
      ['hip-thrust', 'Ягодичный мост со штангой']
    ]},
    { id: 'capacity', number: '03', title: 'Работоспособность / прикладная сила', subtitle: 'Повторные усилия. Удержание. Перемещение.', exercises: [
      ['jump', 'Прыжки на тумбу'], ['farmer', 'Фермерская прогулка'], ['sled-push', 'Толкание саней'],
      ['sled-pull', 'Тяга саней'], ['sandbag', 'Перенос мешка'], ['burpee', 'Бёрпи'],
      ['kb-swing', 'Махи гирей'], ['stepup', 'Зашагивания на тумбу'], ['ruck', 'Ходьба с рюкзаком'],
      ['kb-goblet-squat', 'Приседания с гирей'], ['sandbag-shoulder', 'Подъём мешка на плечо'],
      ['loaded-hold', 'Удержание груза'], ['overhead-carry', 'Перенос груза над головой'],
      ['battle-ropes', 'Работа с канатами']
    ]},
    { id: 'endurance', number: '04', title: 'Выносливость', subtitle: 'Продолжительная и интервальная циклическая работа.', exercises: [
      ['run', 'Бег'], ['bike', 'Велосипед'], ['rowing', 'Гребля'], ['swim', 'Плавание'],
      ['walk', 'Ходьба'], ['ski', 'SkiErg'], ['airbike', 'AirBike'], ['jump-rope', 'Скакалка'],
      ['elliptical', 'Эллиптический тренажёр'], ['xc-ski', 'Лыжные гонки'], ['stair-climber', 'Степпер']
    ]}
  ],
  retiredIds: ['circuit'],
  bodyweightIds: ['pullup', 'dip', 'pushup'],
  equipmentLabels: [['all', 'Любой инвентарь'], ['bodyweight', 'Без снаряда'], ['barbell', 'Штанга'], ['kettlebell', 'Гиря'], ['load', 'Грузы / гантели'], ['machine', 'Тренажёр'], ['sandbag', 'Мешок / сани'], ['other', 'Другое']],
  equipment: {
    'broad-jump':'bodyweight',sprint:'bodyweight','kb-snatch':'kettlebell',clean:'barbell',handstand:'bodyweight',medball:'other',
    'barbell-snatch':'barbell','barbell-jerk':'barbell','clean-and-jerk':'barbell','kb-clean':'kettlebell','kb-jerk':'kettlebell','push-press':'barbell',
    squat:'barbell',deadlift:'barbell',bench:'barbell',press:'barbell',pullup:'bodyweight',dip:'bodyweight',row:'barbell',pushup:'bodyweight',
    'romanian-deadlift':'barbell','lat-pulldown':'machine','seated-row':'machine','hip-thrust':'barbell',
    jump:'bodyweight',farmer:'load','sled-push':'sandbag','sled-pull':'sandbag',sandbag:'sandbag',burpee:'bodyweight','kb-swing':'kettlebell',
    stepup:'bodyweight',ruck:'load','kb-goblet-squat':'kettlebell','sandbag-shoulder':'sandbag','loaded-hold':'load','overhead-carry':'load','battle-ropes':'other',
    run:'bodyweight',bike:'other',rowing:'machine',swim:'other',walk:'bodyweight',ski:'machine',airbike:'machine','jump-rope':'other',
    elliptical:'machine','xc-ski':'other','stair-climber':'machine'
  },
  // These are editable starting fields. Every exercise can use every metric.
  presets: {
    'broad-jump': ['distanceM', 'reps'], sprint: ['durationSec', 'distanceM'],
    handstand: ['durationSec'], medball: ['weightKg', 'reps'],
    jump: ['reps'],
    pullup: ['reps', 'addedWeightKg'], dip: ['reps', 'addedWeightKg'], pushup: ['reps'],
    farmer: ['weightKg', 'distanceM'], sandbag: ['weightKg', 'distanceM'],
    'sled-push': ['weightKg', 'distanceM'], 'sled-pull': ['weightKg', 'distanceM'],
    ruck: ['weightKg', 'durationSec', 'distanceM'],
    'loaded-hold': ['weightKg', 'durationSec'], 'overhead-carry': ['weightKg', 'distanceM'],
    burpee: ['reps', 'durationSec'], stepup: ['reps', 'weightKg'],
    'battle-ropes': ['durationSec', 'reps'],
    run: ['durationSec', 'distanceM'], bike: ['durationSec', 'distanceM'],
    rowing: ['durationSec', 'distanceM'], swim: ['durationSec', 'distanceM'],
    walk: ['durationSec', 'distanceM'], ski: ['durationSec', 'distanceM'],
    airbike: ['durationSec', 'distanceM'], 'jump-rope': ['durationSec', 'reps'],
    elliptical: ['durationSec', 'distanceM'], 'xc-ski': ['durationSec', 'distanceM'],
    'stair-climber': ['durationSec', 'reps']
  }
};
