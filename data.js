'use strict';
window.Hybrid = {
  sections: [
    { id: 'skill', number: '01', title: 'Навык / мощность', subtitle: 'Техника. Скорость. Взрывное усилие.', exercises: [
      ['broad-jump', 'Прыжок в длину с места'], ['sprint', 'Спринт'], ['kb-snatch', 'Рывок гири'],
      ['clean', 'Взятие штанги на грудь'], ['handstand', 'Стойка на руках'], ['medball', 'Броски медбола'],
      ['barbell-snatch', 'Рывок штанги'], ['barbell-jerk', 'Толчок штанги от груди'],
      ['clean-and-jerk', 'Взятие и толчок штанги'], ['kb-clean', 'Взятие гири на грудь'],
      ['kb-jerk', 'Толчок гири'], ['push-press', 'Пуш-пресс'],
      ["single-leg-hop","Прыжки на одной ноге"], ["direction-jump","Прыжки со сменой направления"], ["explosive-pushup","Взрывные отжимания"], ["pogo-jump","Подскоки"], ["jump-lunge","Прыжковые выпады"], ["skips","Подскоки с продвижением (скипы)"]
    ]},
    { id: 'strength', number: '02', title: 'Сила', subtitle: 'Контролируемая работа с сопротивлением.', exercises: [
      ['squat', 'Приседания со штангой'], ['deadlift', 'Становая тяга'], ['bench', 'Жим лёжа'],
      ['press', 'Жим стоя'], ['pullup', 'Подтягивания'], ['dip', 'Отжимания на брусьях'],
      ['row', 'Тяга в наклоне'], ['lunge', 'Выпады'], ['pushup', 'Отжимания'],
      ['romanian-deadlift', 'Румынская тяга'], ['bulgarian-split-squat', 'Болгарские сплит-приседания'],
      ['lat-pulldown', 'Тяга вертикального блока'], ['seated-row', 'Тяга горизонтального блока'],
      ['hip-thrust', 'Ягодичный мост со штангой'],
      ["front-squat","Фронтальный присед"], ["back-extension","Гиперэкстензия"], ["neck-work","Упражнения для мышц шеи"]
    ]},
    { id: 'capacity', number: '03', title: 'Работоспособность / прикладная сила', subtitle: 'Повторные усилия. Удержание. Перемещение.', exercises: [
      ['jump', 'Прыжки на тумбу'], ['farmer', 'Фермерская прогулка'], ['sled-push', 'Толкание саней'],
      ['sled-pull', 'Тяга саней'], ['sandbag', 'Перенос мешка'], ['burpee', 'Бёрпи'],
      ['kb-swing', 'Махи гирей'], ['stepup', 'Зашагивания на тумбу'], ['ruck', 'Ходьба с рюкзаком'],
      ['kb-goblet-squat', 'Приседания с гирей'], ['sandbag-shoulder', 'Подъём мешка на плечо'],
      ['loaded-hold', 'Удержание груза'], ['overhead-carry', 'Перенос груза над головой'],
      ['battle-ropes', 'Работа с канатами'],
      ["shoulder-carry","Перенос груза на плече"], ["front-carry","Перенос груза перед собой"], ["kb-long-cycle","Гиревой длинный цикл"]
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

// Library metadata never rewrites saved workout IDs or results.
(() => {
 const h=window.Hybrid;
 h.libraryStatus={};
 const additional=new Set(['skips','handstand','medball','kb-clean','lat-pulldown','seated-row','hip-thrust','jump','stepup','ruck','kb-goblet-squat','sandbag-shoulder','overhead-carry','battle-ropes','walk','ski','airbike','elliptical','xc-ski','stair-climber']);
 h.sections.forEach(s=>s.exercises.forEach(([id])=>h.libraryStatus[id]=additional.has(id)?'additional':'main'));
 h.defaultVariants={lunge:['На месте','В ходьбе','Назад'],bench:['Со штангой','С гантелями','На наклонной скамье'],'explosive-pushup':['С отрывом рук','С хлопком','С перемещением к цели'],'single-leg-hop':['На месте','С продвижением'],'direction-jump':['В стороны','К заданной цели'],'broad-jump':['Одиночный прыжок','С последующим вертикальным прыжком'],'jump-rope':['На двух ногах','На одной ноге'],pullup:['Прямой хват','Обратный хват','Нейтральный хват'],row:['Со штангой','С гантелью','С опорой грудью'],'barbell-snatch':['С пола','С виса'],clean:['С пола','С виса'],run:['Непрерывно','Интервалы']};
 Object.assign(h.equipment,{skips:'bodyweight','single-leg-hop':'bodyweight','direction-jump':'bodyweight','explosive-pushup':'bodyweight','pogo-jump':'bodyweight','jump-lunge':'bodyweight','front-squat':'barbell','back-extension':'bodyweight','neck-work':'other','shoulder-carry':'load','front-carry':'load','kb-long-cycle':'kettlebell','bulgarian-split-squat':'load',lunge:'load'});
 Object.assign(h.presets,{skips:['distanceM','reps'],'single-leg-hop':['reps','distanceM'],'direction-jump':['reps'],'explosive-pushup':['reps'],'pogo-jump':['reps'],'jump-lunge':['reps'],'back-extension':['reps','weightKg'],'neck-work':['reps'],'shoulder-carry':['weightKg','distanceM'],'front-carry':['weightKg','distanceM'],'kb-long-cycle':['weightKg','durationSec','reps']});
 const traits=(area,patterns,muscles)=>({area,patterns,muscles});
 for(const id of ['single-leg-hop','direction-jump','pogo-jump','jump-lunge'])h.exerciseTraits[id]=traits('lower',['jump'],['quads','glutes','calves','core']);
 h.exerciseTraits.skips=traits('full',['jump','locomotion'],['quads','glutes','calves','core']);
 h.exerciseTraits['explosive-pushup']=traits('upper',['horizontalPress'],['chest','shoulders','arms','core']);
 h.exerciseTraits['front-squat']=traits('lower',['squat'],['quads','glutes','core']);
 h.exerciseTraits['back-extension']=traits('lower',['hinge'],['glutes','hamstrings','back']);
 h.traitLabels.patterns.neck='движения шеи';h.traitLabels.muscles.neck='мышцы шеи';
 h.exerciseTraits['neck-work']=traits('upper',['neck'],['neck']);
 for(const id of ['shoulder-carry','front-carry'])h.exerciseTraits[id]=traits('full',['carry'],['back','core','grip','quads','glutes']);
 h.exerciseTraits['kb-long-cycle']=traits('full',['hinge','verticalPress','cyclic'],['quads','glutes','back','shoulders','arms','core','grip']);
 h.traitLabels.qualities={maxStrength:'Максимальная сила',relativeStrength:'Относительная сила',power:'Взрывная мощность',reactivity:'Реактивность',speed:'Максимальная скорость',coordination:'Координация',strengthEndurance:'Силовая работоспособность',aerobic:'Аэробная выносливость',anaerobic:'Анаэробная работоспособность'};
 // Qualities describe typical use, not the measured intensity of a record.
 h.exerciseQualities={};
 const assign=(ids,primary,secondary=[])=>ids.split(' ').forEach(id=>h.exerciseQualities[id]={primary,secondary});
 assign('barbell-snatch clean barbell-jerk clean-and-jerk kb-snatch kb-clean kb-jerk push-press medball explosive-pushup broad-jump','power'.split(' '),['coordination']);
 assign('pogo-jump',['reactivity'],['coordination']);
 assign('single-leg-hop jump-lunge',['power'],['coordination']);
 assign('direction-jump',['coordination'],['power']);
 assign('skips',['coordination'],['reactivity']);assign('sprint',['speed'],['power']);assign('handstand',['coordination'],['relativeStrength']);
 assign(h.sections.find(s=>s.id==='strength').exercises.map(([id])=>id).join(' '),['maxStrength'],['strengthEndurance']);
 assign('pullup dip pushup',['relativeStrength'],['maxStrength']);
 assign(h.sections.find(s=>s.id==='capacity').exercises.map(([id])=>id).join(' '),['strengthEndurance'],['anaerobic']);
 assign('jump',['power'],['coordination']);
 assign(h.sections.find(s=>s.id==='endurance').exercises.map(([id])=>id).join(' '),['aerobic'],['anaerobic']);
})();

// Revision before personalization: explicit directions, stable independent IDs.
(() => {
 const h=window.Hybrid;
 const add=(section,id,name,equipment,traits,qualities,fields)=>{
   h.sections.find(s=>s.id===section).exercises.push([id,name]);h.equipment[id]=equipment;
   h.exerciseTraits[id]=traits;h.exerciseQualities[id]=qualities;h.presets[id]=fields;
 };
 add('strength','zercher-squat','Присед Зерхера','barbell',{area:'lower',patterns:['squat','hold'],muscles:['quads','glutes','back','core','arms']},{primary:['maxStrength'],secondary:['strengthEndurance']},['weightKg','reps']);
 add('strength','dumbbell-row','Тяга гантели','load',{area:'upper',patterns:['horizontalPull'],muscles:['back','lats','arms','core']},{primary:['maxStrength'],secondary:['strengthEndurance']},['weightKg','reps']);
 add('skill','vertical-jump','Вертикальный прыжок','bodyweight',{area:'lower',patterns:['jump'],muscles:['quads','glutes','calves','core']},{primary:['power'],secondary:['coordination']},['reps','distanceM']);
 h.directionLabels={olympic:'Тяжелоатлетическая мощность',kettlebellPower:'Гиревой навык и мощность',jumpPower:'Прыжковая мощность',reactivity:'Реактивность',speed:'Максимальная скорость',upperPower:'Взрывная сила верха',coordination:'Координация',squat:'Приседание',hinge:'Тазовый шарнир',unilateral:'Односторонняя сила ног',verticalPull:'Вертикальная тяга',horizontalPull:'Горизонтальная тяга',press:'Жим',neck:'Сила шеи',handCarry:'Перенос в руках',awkwardCarry:'Неудобный груз',repeatedStrength:'Повторная силовая работа',longCycle:'Продолжительная комплексная работа',hold:'Удержание',cyclic:'Циклическая выносливость'};
 const directions={};
 const group=(direction,ids)=>ids.split(' ').forEach(id=>directions[id]=direction);
 group('olympic','barbell-snatch barbell-jerk clean clean-and-jerk');group('kettlebellPower','kb-snatch kb-jerk kb-clean');
 group('jumpPower','broad-jump vertical-jump jump jump-lunge');group('reactivity','pogo-jump single-leg-hop');group('speed','sprint');group('upperPower','explosive-pushup medball push-press');group('coordination','handstand direction-jump skips');
 group('squat','squat front-squat zercher-squat kb-goblet-squat');group('hinge','deadlift romanian-deadlift back-extension hip-thrust');group('unilateral','lunge bulgarian-split-squat stepup');group('verticalPull','pullup lat-pulldown');group('horizontalPull','row dumbbell-row seated-row');group('press','press dip bench pushup');group('neck','neck-work');
 group('handCarry','farmer');group('awkwardCarry','sandbag shoulder-carry front-carry sandbag-shoulder overhead-carry ruck');group('repeatedStrength','kb-swing burpee sled-push sled-pull battle-ropes');group('longCycle','kb-long-cycle');group('hold','loaded-hold');
 group('cyclic',h.sections.find(s=>s.id==='endurance').exercises.map(([id])=>id).join(' '));
 const main=new Set('barbell-snatch barbell-jerk kb-snatch kb-jerk broad-jump pogo-jump sprint explosive-pushup squat front-squat zercher-squat romanian-deadlift lunge pullup dumbbell-row press dip bench farmer sandbag kb-swing kb-long-cycle run rowing bike'.split(' '));
 h.defaultVariants.farmer=['В двух руках','В одной руке'];h.defaultVariants.sandbag=['Перед собой','На плече'];h.defaultVariants['kb-snatch']=['С одной гирей','С двумя гирями'];h.defaultVariants['kb-jerk']=['С одной гирей','С двумя гирями'];
 h.defaultVariants['dumbbell-row']=['С опорой рукой','С опорой грудью'];h.defaultVariants['vertical-jump']=['С места','С разбега'];
 h.formatLabels={sets:'Подходы',continuous:'Непрерывная работа',intervals:'Интервалы',circuit:'В составе комплекса'};
 h.exerciseProfiles={};
 for(const section of h.sections)for(const [id,name] of section.exercises){
   const t=h.exerciseTraits[id],q=h.exerciseQualities[id];
   h.libraryStatus[id]=main.has(id)?'main':'additional';
   h.exerciseProfiles[id]={id,name,sectionId:section.id,direction:directions[id],areas:t.area==='full'?['upper','lower']: [t.area],area:t.area,patterns:[...t.patterns],muscles:[...t.muscles],primaryQualities:[...q.primary],secondaryQualities:[...q.secondary],fields:[...(h.presets[id]||['weightKg','reps'])],formats:['sets','continuous','intervals','circuit'],equipment:[h.equipment[id]],status:h.libraryStatus[id]};
 }
 // Holding a bar in a squat does not count as carrying a load.
})();
