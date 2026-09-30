// Проверка поиска на маленьком индексе: нормализация, таджикские буквы, латиница,
// забытая раскладка, адреса с номером дома, рубрики, обратный поиск и здания.

import { createSearch, normalize } from '../src/search.js';

let failed = 0;
const check = (name, cond) => {
  if (cond) console.log(`✓ ${name}`);
  else { failed++; console.error(`✗ ${name}`); }
};

const fields = ['name', 'name_tg', 'name_en', 'kind', 'category', 'type', 'lon', 'lat', 'place', 'info'];
const items = [
  ['Душанбе', 'Душанбе', 'Dushanbe', 'place', 'city', '', 68.7738, 38.5737, 0],
  ['Худжанд', 'Хуҷанд', 'Khujand', 'place', 'city', '', 69.6222, 40.2826, 1],
  ['Душанбе', '', '', 'poi', 'food', 'cafe', 68.80, 38.56, 0],
  ['проспект Рудаки', 'хиёбони Рӯдакӣ', '', 'street', '', '', 68.7760, 38.5800, 0],
  ['хиёбони Рӯдакӣ, 10', '', '', 'address', '', '', 68.7770, 38.5790, 0],
  ['хиёбони Рӯдакӣ, 100', '', '', 'address', '', '', 68.7800, 38.5700, 0],
  ['кучаи Рудаки, 10', '', '', 'address', '', '', 69.6300, 40.2800, 1],
  ['Садбарг', '', '', 'poi', 'pharmacy', 'pharmacy', 68.7771, 38.57905, 0, { hours: 'Mo-Su 08:00-22:00' }],
  ['Школа № 12', '', '', 'poi', 'edu', 'school', 68.75, 38.55, 0],
  ['Аэропорт Душанбе', '', 'Dushanbe International Airport', 'poi', 'airport', 'aerodrome', 68.825, 38.543, 0],
];
const s = createSearch({ version: 2, fields, places: ['Душанбе', 'Худжанд'], items });
const center = [68.7738, 38.5737];
const first = (q, o = {}) => s.search(q, { center, ...o })[0];

check('нормализация: ҳ қ ӯ ӣ ё и ударения',
  normalize('Ҳисор Қӯрғон Фирдавсӣ Ёвон Хистева\u0301рз') === 'хисор кургон фирдавси евон хистеварз');
check('город раньше кафе с тем же именем', first('душанбе')?.kind === 'place');
check('латиница', first('Khujand')?.title === 'Худжанд');
check('транслит по таджикскому имени', first('hujand')?.title === 'Худжанд');
check('забытая раскладка', first('leify,t')?.title === 'Душанбе');
check('адрес: улица и номер', first('рудаки 10')?.title === 'Хиёбони Рӯдакӣ, 10');
const titles = s.search('рудаки 10', { center }).map((r) => r.title);
check('адрес: сначала ближний город', titles.indexOf('Хиёбони Рӯдакӣ, 10') < titles.indexOf('Кучаи Рудаки, 10'));
check('нет дома — хотя бы улица', first('рудаки 999')?.kind === 'street');
check('рубрика во множественном числе', first('аптеки')?.title === 'Садбарг');
check('рубрика по-таджикски', first('дорухона')?.title === 'Садбарг');
check('номер в названии', first('школа 12')?.title === 'Школа № 12');
check('аэропорт по рубрике', first('аэропорт')?.category === 'airport');
check('подпись места: тип и адрес', first('садбарг')?.subtitle === 'Аптека · Душанбе');
check('часы работы в сведениях', first('садбарг')?.info?.hours === 'Mo-Su 08:00-22:00');
check('обратный поиск', s.reverse(68.77702, 38.57902)?.title === 'Хиёбони Рӯдакӣ, 10');
check('что рядом', s.nearby(68.7771, 38.5790, { radius: 50 })[0]?.title === 'Садбарг');
const building = {
  type: 'Polygon',
  coordinates: [[[68.7768, 38.5788], [68.7773, 38.5788], [68.7773, 38.5792], [68.7768, 38.5792], [68.7768, 38.5788]]],
};
const inside = s.inside(building);
check('в здании: адрес', inside.address?.title === 'Хиёбони Рӯдакӣ, 10');
check('в здании: организации', inside.places.map((p) => p.title).join() === 'Садбарг');
check('английский язык подписи', s.search('dushanbe', { center, lang: 'en' })[0]?.title === 'Dushanbe');

if (failed) {
  console.error(`\nОшибок поиска: ${failed}`);
  process.exit(1);
}
console.log('\nПоиск в порядке');
