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
  traitLabels: {
    areas: { upper: 'верх', lower: 'низ', full: 'всё тело' },
    patterns: { olympic: 'тяжелоатлетическое движение', jump: 'прыжок', sprint: 'спринт', squat: 'приседание', hinge: 'тяга / сгибание в тазу', horizontalPress: 'горизонтальный жим', verticalPress: 'вертикальный жим', horizontalPull: 'горизонтальная тяга', verticalPull: 'вертикальная тяга', carry: 'перенос', hold: 'удержание', locomotion: 'локомоция', cyclic: 'циклическая работа' },
    muscles: { quads: 'квадрицепсы', glutes: 'ягодицы', hamstrings: 'задняя поверхность бедра', calves: 'икры', chest: 'грудь', back: 'спина', lats: 'широчайшие', shoulders: 'плечи', arms: 'руки', core: 'кор', grip: 'хват' }
  },
  // Характеристики дополняют блоки библиотеки и нужны только для обзора статистики.
  exerciseTraits: {
    'broad-jump':{area:'lower',patterns:['jump'],muscles:['quads','glutes','calves','core']},sprint:{area:'lower',patterns:['sprint','locomotion'],muscles:['quads','glutes','hamstrings','calves','core']},'kb-snatch':{area:'full',patterns:['hinge','verticalPress'],muscles:['glutes','hamstrings','back','shoulders','core','grip']},clean:{area:'full',patterns:['olympic','hinge','squat'],muscles:['quads','glutes','hamstrings','back','shoulders','core']},handstand:{area:'upper',patterns:['hold','verticalPress'],muscles:['shoulders','arms','core']},medball:{area:'full',patterns:['horizontalPress'],muscles:['chest','shoulders','arms','core']},'barbell-snatch':{area:'full',patterns:['olympic','hinge','squat'],muscles:['quads','glutes','hamstrings','back','shoulders','core']},'barbell-jerk':{area:'full',patterns:['olympic','verticalPress'],muscles:['quads','glutes','shoulders','arms','core']},'clean-and-jerk':{area:'full',patterns:['olympic','hinge','squat','verticalPress'],muscles:['quads','glutes','hamstrings','back','shoulders','core']},'kb-clean':{area:'full',patterns:['hinge'],muscles:['glutes','hamstrings','back','shoulders','core','grip']},'kb-jerk':{area:'full',patterns:['verticalPress'],muscles:['quads','glutes','shoulders','arms','core']},'push-press':{area:'full',patterns:['verticalPress'],muscles:['quads','glutes','shoulders','arms','core']},
    squat:{area:'lower',patterns:['squat'],muscles:['quads','glutes','core']},deadlift:{area:'lower',patterns:['hinge'],muscles:['glutes','hamstrings','back','core','grip']},bench:{area:'upper',patterns:['horizontalPress'],muscles:['chest','shoulders','arms']},press:{area:'upper',patterns:['verticalPress'],muscles:['shoulders','arms','core']},pullup:{area:'upper',patterns:['verticalPull'],muscles:['lats','back','arms','core']},dip:{area:'upper',patterns:['verticalPress'],muscles:['chest','shoulders','arms']},row:{area:'upper',patterns:['horizontalPull'],muscles:['back','lats','arms','core']},lunge:{area:'lower',patterns:['squat'],muscles:['quads','glutes','hamstrings','core']},pushup:{area:'upper',patterns:['horizontalPress'],muscles:['chest','shoulders','arms','core']},'romanian-deadlift':{area:'lower',patterns:['hinge'],muscles:['glutes','hamstrings','back','core','grip']},'bulgarian-split-squat':{area:'lower',patterns:['squat'],muscles:['quads','glutes','hamstrings','core']},'lat-pulldown':{area:'upper',patterns:['verticalPull'],muscles:['lats','back','arms']},'seated-row':{area:'upper',patterns:['horizontalPull'],muscles:['back','lats','arms']},'hip-thrust':{area:'lower',patterns:['hinge'],muscles:['glutes','hamstrings','core']},
    jump:{area:'lower',patterns:['squat','jump'],muscles:['quads','glutes','calves','core']},farmer:{area:'full',patterns:['carry'],muscles:['quads','glutes','back','core','grip']},'sled-push':{area:'full',patterns:['locomotion'],muscles:['quads','glutes','calves','shoulders','core']},'sled-pull':{area:'full',patterns:['locomotion','horizontalPull'],muscles:['quads','glutes','back','arms','core']},sandbag:{area:'full',patterns:['carry'],muscles:['quads','glutes','back','core','grip']},burpee:{area:'full',patterns:['squat','horizontalPress'],muscles:['quads','glutes','chest','shoulders','arms','core']},'kb-swing':{area:'full',patterns:['hinge'],muscles:['glutes','hamstrings','back','shoulders','core','grip']},stepup:{area:'lower',patterns:['squat'],muscles:['quads','glutes','calves','core']},ruck:{area:'lower',patterns:['locomotion','carry'],muscles:['quads','glutes','calves','back','core']},'kb-goblet-squat':{area:'lower',patterns:['squat'],muscles:['quads','glutes','core','grip']},'sandbag-shoulder':{area:'full',patterns:['hinge','carry'],muscles:['quads','glutes','hamstrings','back','shoulders','core','grip']},'loaded-hold':{area:'full',patterns:['hold'],muscles:['shoulders','back','core','grip']},'overhead-carry':{area:'full',patterns:['carry'],muscles:['shoulders','back','core','grip']},'battle-ropes':{area:'upper',patterns:['cyclic'],muscles:['shoulders','arms','core']},
    run:{area:'lower',patterns:['locomotion','cyclic'],muscles:['quads','glutes','hamstrings','calves','core']},bike:{area:'lower',patterns:['cyclic'],muscles:['quads','glutes','hamstrings','calves']},rowing:{area:'full',patterns:['cyclic','hinge'],muscles:['quads','glutes','hamstrings','back','arms','core']},swim:{area:'full',patterns:['cyclic'],muscles:['shoulders','back','chest','core']},walk:{area:'lower',patterns:['locomotion','cyclic'],muscles:['quads','glutes','calves','core']},ski:{area:'full',patterns:['cyclic'],muscles:['quads','glutes','back','arms','core']},airbike:{area:'full',patterns:['cyclic'],muscles:['quads','glutes','shoulders','arms','core']},'jump-rope':{area:'lower',patterns:['cyclic','jump'],muscles:['calves','quads','glutes','core']},elliptical:{area:'lower',patterns:['cyclic'],muscles:['quads','glutes','hamstrings','calves']},'xc-ski':{area:'full',patterns:['locomotion','cyclic'],muscles:['quads','glutes','back','arms','core']},'stair-climber':{area:'lower',patterns:['cyclic','squat'],muscles:['quads','glutes','calves','core']}
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
