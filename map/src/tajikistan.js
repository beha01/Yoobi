// География Таджикистана — удобные константы для настройки карты в проекте.

// Область, за которую нельзя увести карту: [[запад, юг], [восток, север]].
// С запасом по высоте: на вытянутом экране телефона (390×844, 360×800) страна
// помещается по ширине только на ~5 зуме, и тогда по высоте видно ~15° широты — если
// границы ниже, MapLibre не даёт отдалиться и страна обрезается. Всё вокруг
// Таджикистана и так закрыто «заморозкой».
export const TAJIKISTAN_BOUNDS = [[60.0, 30.5], [82.5, 47.0]];

// Центр Душанбе (площадь Исмоила Сомони) и рекомендуемый стартовый вид.
export const DUSHANBE_VIEW = {
  center: [68.7788, 38.5772],
  zoom: 16.2,
  pitch: 50,
  bearing: -12,
};

// Вся страна целиком.
export const COUNTRY_VIEW = {
  center: [71.2, 38.85],
  zoom: 6.3,
  pitch: 0,
  bearing: 0,
};

// Области — точки подписей на обзорных масштабах. Свои, а не из OSM: там у Согдийской
// области две точки, а подпись Хатлона ложится на Бохтар и Куляб.
const region = (id, coordinates, ru, tg, en) => ({
  type: 'Feature', properties: { id, name_ru: ru, name_tg: tg, name_en: en }, geometry: { type: 'Point', coordinates },
});
export const REGIONS = {
  type: 'FeatureCollection',
  features: [
    region('SU', [69.96, 40.52], 'Согдийская область', 'Вилояти Суғд', 'Sughd Region'),
    region('RR', [70.09, 38.97], 'Районы республиканского подчинения', 'Ноҳияҳои тобеи ҷумҳурӣ',
      'Districts of Republican Subordination'),
    region('KH', [68.95, 37.5], 'Хатлонская область', 'Вилояти Хатлон', 'Khatlon Region'),
    region('GB', [73.0, 38.35], 'Горно-Бадахшанская автономная область', 'Вилояти Мухтори Кӯҳистони Бадахшон',
      'Gorno-Badakhshan Autonomous Region'),
  ],
};

// Крупные города: name — именительный падеж, in — предложный («в Худжанде»),
// name_tg и name_en — как в OSM. На обзоре страны (до 7 зума) подписываются именно они.
export const CITIES = [
  { name: 'Душанбе', in: 'Душанбе', name_tg: 'Душанбе', name_en: 'Dushanbe', capital: true, center: [68.7870, 38.5598], zoom: 13 },
  { name: 'Худжанд', in: 'Худжанде', name_tg: 'Хуҷанд', name_en: 'Khujand', center: [69.6222, 40.2826], zoom: 13 },
  { name: 'Бохтар', in: 'Бохтаре', name_tg: 'Бохтар', name_en: 'Bokhtar', center: [68.7803, 37.8364], zoom: 13.5 },
  { name: 'Куляб', in: 'Кулябе', name_tg: 'Кӯлоб', name_en: 'Kulob', center: [69.7845, 37.9146], zoom: 13.5 },
  { name: 'Истаравшан', in: 'Истаравшане', name_tg: 'Истаравшан', name_en: 'Istaravshan', center: [69.0064, 39.9108], zoom: 13.5 },
  { name: 'Турсунзаде', in: 'Турсунзаде', name_tg: 'Турсунзода', name_en: 'Tursunzoda', center: [68.2303, 38.5108], zoom: 13.5 },
  { name: 'Вахдат', in: 'Вахдате', name_tg: 'Ваҳдат', name_en: 'Vahdat', center: [69.0135, 38.5563], zoom: 13.5 },
  { name: 'Пенджикент', in: 'Пенджикенте', name_tg: 'Панҷакент', name_en: 'Panjakent', center: [67.6093, 39.4952], zoom: 13.5 },
  { name: 'Исфара', in: 'Исфаре', name_tg: 'Исфара', name_en: 'Isfara', center: [70.6254, 40.1265], zoom: 13.5 },
  { name: 'Канибадам', in: 'Канибадаме', name_tg: 'Конибодом', name_en: 'Konibodom', center: [70.4312, 40.2962], zoom: 13.5 },
  { name: 'Гиссар', in: 'Гиссаре', name_tg: 'Ҳисор', name_en: 'Hisor', center: [68.5510, 38.5264], zoom: 13.5 },
  { name: 'Нурек', in: 'Нуреке', name_tg: 'Норак', name_en: 'Norak', center: [69.3219, 38.3864], zoom: 13.5 },
  { name: 'Хорог', in: 'Хороге', name_tg: 'Хоруғ', name_en: 'Khorugh', center: [71.5530, 37.4897], zoom: 14 },
  { name: 'Мургаб', in: 'Мургабе', name_tg: 'Мурғоб', name_en: 'Murghob', center: [73.9646, 38.1705], zoom: 14 },
];
