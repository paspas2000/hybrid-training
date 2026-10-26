'use strict';
window.Hybrid = {
  sections: [
    { id: 'skill', number: '01', title: 'Навык / мощность', subtitle: 'Техника. Скорость. Взрывное усилие.', icon: '↗', exercises: [
      ['jump', 'Прыжки на тумбу'], ['broad-jump', 'Прыжок в длину с места'], ['sprint', 'Спринт'], ['kb-snatch', 'Рывок гири'], ['clean', 'Взятие на грудь'], ['handstand', 'Стойка на руках'], ['jump-rope', 'Скакалка'], ['medball', 'Броски медбола']
    ]},
    { id: 'strength', number: '02', title: 'Сила', subtitle: 'Качественные повторы. Уверенный прогресс.', icon: '▰', exercises: [
      ['squat', 'Приседания со штангой'], ['deadlift', 'Становая тяга'], ['bench', 'Жим лёжа'], ['press', 'Жим стоя'], ['pullup', 'Подтягивания'], ['dip', 'Отжимания на брусьях'], ['row', 'Тяга в наклоне'], ['lunge', 'Выпады'], ['pushup', 'Отжимания']
    ]},
    { id: 'capacity', number: '03', title: 'Прикладная работа', subtitle: 'Work capacity. Двигаться и справляться.', icon: '⌁', exercises: [
      ['farmer', 'Фермерская прогулка'], ['sled-push', 'Толкание саней'], ['sled-pull', 'Тяга саней'], ['sandbag', 'Перенос мешка'], ['burpee', 'Бёрпи'], ['kb-swing', 'Махи гирей'], ['stepup', 'Зашагивания на тумбу'], ['circuit', 'Круговая работа']
    ]},
    { id: 'endurance', number: '04', title: 'Выносливость', subtitle: 'Дыхание. Ритм. Длинная дистанция.', icon: '≈', exercises: [
      ['run', 'Бег'], ['bike', 'Велосипед'], ['rowing', 'Гребля'], ['swim', 'Плавание'], ['walk', 'Быстрая ходьба'], ['ski', 'Лыжный тренажёр'], ['airbike', 'AirBike'], ['ruck', 'Ходьба с рюкзаком']
    ]}
  ],
  // Editable starting fields only; every exercise can use every metric.
  presets: {
    run: ['durationSec', 'distanceM'], bike: ['durationSec', 'distanceM'], rowing: ['durationSec', 'distanceM'],
    swim: ['durationSec', 'distanceM'], walk: ['durationSec', 'distanceM'], ski: ['durationSec', 'distanceM'],
    airbike: ['durationSec', 'distanceM'], ruck: ['durationSec', 'distanceM'],
    sprint: ['durationSec', 'distanceM'], handstand: ['durationSec'], 'jump-rope': ['durationSec', 'reps'],
    farmer: ['weightKg', 'distanceM'], sandbag: ['weightKg', 'distanceM'],
    'sled-push': ['weightKg', 'distanceM'], 'sled-pull': ['weightKg', 'distanceM'],
    circuit: ['rounds', 'durationSec']
  }
};
