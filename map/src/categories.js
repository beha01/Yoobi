// Категории мест и их иконки. Классы — из слоя `poi` схемы OpenMapTiles
// (https://openmaptiles.org/schema/#poi).

// Контуры иконок в сетке 24×24 (стиль Material Icons, Apache 2.0).
export const ICONS = {
  restaurant: 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z',
  cafe: 'M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z',
  cart: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z',
  bag: 'M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-1.99.9-1.99 2L3 20c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm0 10c-2.76 0-5-2.24-5-5h2c0 1.66 1.34 3 3 3s3-1.34 3-3h2c0 2.76-2.24 5-5 5z',
  plus: 'M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z',
  hospital: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z',
  bed: 'M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z',
  bank: 'M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z',
  fuel: 'M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H6V5h6v5zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z',
  school: 'M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z',
  book: 'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z',
  star: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  theater: 'M4 2h16v2H4zm1 3h14l-1 4H6zm1.5 5h3v9h-3zm8 0h3v9h-3zM3 20h18v2H3z',
  mosque: 'M12 2.5c.4 1.3 1.5 2.1 2.8 2.5C17 5.7 18.5 7.4 18.5 9.5V11h-13V9.5c0-2.1 1.5-3.8 3.7-4.5 1.3-.4 2.4-1.2 2.8-2.5zM5 12h14v9h-4.5v-3.5a2.5 2.5 0 0 0-5 0V21H5z',
  landmark: 'M12 1l9.5 5v2h-19V6zM4 10h3v7H4zm6.5 0h3v7h-3zm6.5 0h3v7h-3zM2 19h20v3H2z',
  tree: 'M12 2L6.5 9.5h3L5 15.5h6V22h2v-6.5h6l-4.5-6h3z',
  dot: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
  peak: 'M12 4l9 16H3z',
  train: 'M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm2 0V6h5v4h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
  bus: 'M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z',
  plane: 'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z',
};

// Порядок важен: подкатегории-исключения (например, «mall») проверяются раньше классов.
export const CATEGORIES = [
  {
    id: 'food', label: 'Рестораны', color: '#F7931E', icon: 'restaurant',
    classes: ['restaurant', 'fast_food', 'cafe', 'bar', 'beer', 'ice_cream'],
    icons: { cafe: 'cafe', ice_cream: 'cafe' },
  },
  {
    id: 'shop', label: 'Магазины', color: '#1FAA59', icon: 'cart',
    classes: ['shop', 'grocery', 'alcohol_shop', 'clothing_store', 'bakery', 'butcher',
      'florist', 'mobile_phone', 'hairdresser', 'optician', 'jewelry', 'furniture',
      'hardware', 'books', 'music', 'car', 'bicycle'],
  },
  {
    id: 'pharmacy', label: 'Аптеки', color: '#E53935', icon: 'plus',
    classes: ['pharmacy'],
  },
  {
    id: 'hotel', label: 'Гостиницы', color: '#2F80ED', icon: 'bed',
    classes: ['lodging'],
  },
  {
    id: 'mall', label: 'Торговые центры', color: '#1A73E8', icon: 'bag',
    subclasses: ['mall', 'department_store', 'marketplace'],
  },
  {
    id: 'health', label: 'Больницы и клиники', color: '#EC407A', icon: 'hospital',
    classes: ['hospital', 'doctors', 'dentist', 'veterinary'],
  },
  {
    id: 'bank', label: 'Банки и банкоматы', color: '#0E9F8E', icon: 'bank',
    classes: ['bank', 'atm'],
  },
  {
    id: 'fuel', label: 'АЗС', color: '#3949AB', icon: 'fuel',
    classes: ['fuel'],
  },
  {
    id: 'edu', label: 'Образование', color: '#5C6B82', icon: 'school',
    classes: ['college', 'school', 'kindergarten', 'library'],
    icons: { library: 'book' },
  },
  {
    id: 'culture', label: 'Культура и досуг', color: '#8E44AD', icon: 'star',
    classes: ['museum', 'theatre', 'cinema', 'art_gallery', 'attraction', 'monument',
      'memorial', 'castle', 'zoo', 'stadium'],
    icons: { theatre: 'theater', cinema: 'theater' },
  },
  {
    id: 'gov', label: 'Госучреждения', color: '#546E7A', icon: 'landmark',
    classes: ['town_hall', 'police', 'post', 'fire_station', 'embassy'],
  },
  {
    id: 'worship', label: 'Мечети и храмы', color: '#16A085', icon: 'mosque',
    classes: ['place_of_worship'],
  },
  {
    id: 'transport', label: 'Транспорт', color: '#455A64', icon: 'train',
    subclasses: ['station', 'halt', 'bus_station', 'bus_stop', 'tram_stop'],
    icons: { bus_station: 'bus', bus_stop: 'bus' },
  },
];

// Аэропорты (слой aerodrome_label) — отдельный значок того же цвета.
export const AIRPORT = { id: 'airport', label: 'Аэропорты', color: '#455A64', icon: 'plane' };

export const OTHER = { id: 'other', label: 'Прочее', color: '#8D8D8D', icon: 'dot' };

export const CATEGORY_BY_ID = Object.fromEntries(
  [...CATEGORIES, OTHER, AIRPORT].map((c) => [c.id, c]),
);

// Классы, которые рисуются не значками (парки — зелёной подписью) или не нужны вовсе.
export const HIDDEN_CLASSES = ['park', 'entrance', 'harbor', 'golf', 'campsite', 'cemetery', 'swimming'];

// Мелкие объекты, которые показываются только на самых крупных масштабах.
export const MINOR_SUBCLASSES = ['bus_stop', 'tram_stop'];

// Русские названия типов мест для карточки.
export const SUBCLASS_RU = {
  restaurant: 'Ресторан', fast_food: 'Фастфуд', food_court: 'Фудкорт', cafe: 'Кафе',
  bar: 'Бар', pub: 'Паб', nightclub: 'Ночной клуб', ice_cream: 'Мороженое',
  confectionery: 'Кондитерская', bakery: 'Пекарня', butcher: 'Мясная лавка',
  supermarket: 'Супермаркет', convenience: 'Продуктовый магазин', mall: 'Торговый центр',
  department_store: 'Универмаг', marketplace: 'Рынок', greengrocer: 'Овощи и фрукты',
  clothes: 'Одежда', shoes: 'Обувь', mobile_phone: 'Мобильная связь', electronics: 'Электроника',
  jewelry: 'Ювелирный магазин', florist: 'Цветы', hairdresser: 'Парикмахерская',
  beauty: 'Салон красоты', cosmetics: 'Косметика', optician: 'Оптика', books: 'Книжный магазин',
  furniture: 'Мебель', hardware: 'Хозтовары', car: 'Автосалон', car_repair: 'Автосервис',
  car_parts: 'Автозапчасти', kiosk: 'Киоск', gift: 'Подарки', toys: 'Игрушки',
  pharmacy: 'Аптека', chemist: 'Бытовая химия', hospital: 'Больница', clinic: 'Клиника',
  doctors: 'Врач', dentist: 'Стоматология', veterinary: 'Ветклиника',
  hotel: 'Гостиница', hostel: 'Хостел', guest_house: 'Гостевой дом', motel: 'Мотель',
  bank: 'Банк', atm: 'Банкомат', bureau_de_change: 'Обмен валют', fuel: 'АЗС',
  university: 'Университет', college: 'Колледж', school: 'Школа', kindergarten: 'Детский сад',
  library: 'Библиотека', museum: 'Музей', theatre: 'Театр', cinema: 'Кинотеатр',
  arts_centre: 'Культурный центр', gallery: 'Галерея', attraction: 'Достопримечательность',
  viewpoint: 'Смотровая площадка', monument: 'Памятник', memorial: 'Мемориал',
  castle: 'Крепость', ruins: 'Руины', zoo: 'Зоопарк', stadium: 'Стадион',
  townhall: 'Администрация', public_building: 'Общественное здание', courthouse: 'Суд',
  community_centre: 'Дом культуры', police: 'Полиция', post_office: 'Почта',
  fire_station: 'Пожарная часть', embassy: 'Посольство', place_of_worship: 'Место поклонения',
  park: 'Парк', square: 'Площадь',
  station: 'Вокзал / станция', halt: 'Остановочный пункт', bus_station: 'Автовокзал',
  bus_stop: 'Остановка', tram_stop: 'Трамвайная остановка', subway_entrance: 'Вход в метро',
  aerodrome: 'Аэропорт', international: 'Международный аэропорт',
};

// Выражение MapLibre, которое вычисляет id категории для объекта слоя poi.
export function categoryExpression() {
  const expr = ['match', ['get', 'subclass']];
  for (const c of CATEGORIES) {
    if (c.subclasses) expr.push(c.subclasses, c.id);
  }
  const byClass = ['match', ['get', 'class']];
  for (const c of CATEGORIES) {
    if (c.classes) byClass.push(c.classes, c.id);
  }
  byClass.push(OTHER.id);
  expr.push(byClass);
  return expr;
}

// Выражение, дающее id картинки из спрайта: `${prefix}-<категория>-<иконка>`.
// prefix: 'poi' — круглый значок, 'pill' — значок с белой «таблеткой» под подпись.
export function imageExpression(prefix) {
  const cases = ['case'];
  for (const c of CATEGORIES) {
    for (const [cls, icon] of Object.entries(c.icons || {})) {
      cases.push(['any', ['==', ['get', 'class'], cls], ['==', ['get', 'subclass'], cls]],
        `${prefix}-${c.id}-${icon}`);
    }
  }
  const byCategory = ['match', categoryExpression()];
  for (const c of CATEGORIES) byCategory.push(c.id, `${prefix}-${c.id}-${c.icon}`);
  byCategory.push(`${prefix}-${OTHER.id}-${OTHER.icon}`);
  cases.push(byCategory);
  return cases;
}

// Все сочетания «категория + иконка», которые нужны в спрайте.
export function categoryIcons() {
  const list = [];
  for (const c of [...CATEGORIES, OTHER, AIRPORT]) {
    for (const icon of new Set([c.icon, ...Object.values(c.icons || {})])) {
      list.push({ category: c.id, icon, color: c.color });
    }
  }
  return list;
}

// Определить категорию по классу/подклассу (для карточки и поиска).
export function categoryFor(cls, subclass) {
  for (const c of CATEGORIES) {
    if (c.subclasses?.includes(subclass)) return c;
  }
  for (const c of CATEGORIES) {
    if (c.classes?.includes(cls)) return c;
  }
  return OTHER;
}

export function iconFor(cls, subclass) {
  const c = categoryFor(cls, subclass);
  return c.icons?.[cls] || c.icons?.[subclass] || c.icon;
}
