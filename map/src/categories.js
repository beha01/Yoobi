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
  door: 'M19 19V5c0-1.1-.9-2-2-2H7c-1.1 0-2 .9-2 2v14H3v2h18v-2h-2zm-4-6h-2v-2h2v2z',
  lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
  plane: 'M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z',
  // Городские мелочи вблизи (слой point дополнительных тайлов).
  parking: 'M13 3H6v18h4v-6h3c3.31 0 6-2.69 6-6s-2.69-6-6-6zm.2 8H10V7h3.2c1.1 0 2 .9 2 2s-.9 2-2 2z',
  wc: 'M5.5 22v-7.5H4V9c0-1.1.9-2 2-2h3c1.1 0 2 .9 2 2v5.5H9.5V22h-4zM18 22v-6h3l-2.54-7.63C18.18 7.55 17.42 7 16.56 7h-.12c-.86 0-1.63.55-1.9 1.37L12 16h3v6h3zM7.5 6c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zm9 0c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2z',
  drop: 'M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z',
  bench: 'M3 7h18v3H3zM2 11.5h20v3H2zM4 14.5h2.5V20H4zM17.5 14.5H20V20h-2.5z',
  gate: 'M3 3h2.5v18H3zM18.5 3H21v18h-2.5zM6 6h12v2H6zM6 11h12v2H6zM6 16h12v2H6z',
  fountain: 'M12 3C7.9 3 4.8 6 4.5 10.5h2.2C7 7.3 9.2 5.2 12 5.2s5 2.1 5.3 5.3h2.2C19.2 6 16.1 3 12 3zM11 7.5h2V15h-2zM3 15h18v1.8c0 2.3-1.9 4.2-4.2 4.2H7.2C4.9 21 3 19.1 3 16.8z',
  // Значки типов мест: продукты, одежда, связь, салоны, автосервис, банкомат, спорт…
  basket: 'M17.21 9l-4.38-6.56a1 1 0 0 0-1.66 0L6.79 9H2c-.55 0-1 .45-1 1l.04.27 2.54 9.27c.23.84 1 1.46 1.92 1.46h13c.92 0 1.69-.62 1.93-1.46l2.54-9.27L23 10c0-.55-.45-1-1-1h-4.79zM9 9l3-4.4L15 9H9zm3 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4z',
  hanger: 'M21.6 18.2L13 11.75v-.91a3 3 0 0 0 2.43-4.05 3.1 3.1 0 0 0-2.61-2.7C10.54 3.57 8.5 5.3 8.5 7.5h2a1.5 1.5 0 1 1 1.47 1.5c-.54-.01-.97.45-.97.99v1.76L2.4 18.2c-.77.58-.36 1.8.6 1.8h18c.96 0 1.37-1.22.6-1.8zM6 18l6-4.5 6 4.5H6z',
  phone: 'M15.5 1h-8A2.5 2.5 0 0 0 5 3.5v17A2.5 2.5 0 0 0 7.5 23h8a2.5 2.5 0 0 0 2.5-2.5v-17A2.5 2.5 0 0 0 15.5 1zm-4 21a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm4.5-4H7V4h9v14z',
  scissors: 'M9.64 7.64A4 4 0 1 0 6 10c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36A4 4 0 1 0 10 18c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm0 12a2 2 0 1 1 0-4 2 2 0 0 1 0 4zM19 3l-6 6 2 2 7-7V3z',
  car: 'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm11 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM5 11l1.5-4.5h11L19 11H5z',
  wrench: 'M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z',
  burger: 'M2 16h20v2a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3zM3 12.5h18a1.5 1.5 0 0 1 0 3H3a1.5 1.5 0 0 1 0-3zM12 3c5.2 0 9 3 9 7.5H3C3 6 6.8 3 12 3z',
  bar: 'M21 5V3H3v2l8 9v5H6v2h12v-2h-5v-5l8-9zM7.43 7L5.66 5h12.69l-1.78 2H7.43z',
  sofa: 'M7 11v2h10v-2c0-1.86 1.28-3.41 3-3.86V6c0-1.65-1.35-3-3-3H7C5.35 3 4 4.35 4 6v1.14c1.72.45 3 2 3 3.86zm14-2a2 2 0 0 0-2 2v4H5v-4a2 2 0 1 0-4 0v5c0 1.65 1.35 3 3 3v1a1 1 0 0 0 2 0v-1h12v1a1 1 0 0 0 2 0v-1c1.65 0 3-1.35 3-3v-5a2 2 0 0 0-2-2z',
  paw: 'M4.5 7a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm4.5-4a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm6 0a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm4.5 4a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM12 10.6c1.3 0 2.2.8 3.1 1.9l2.4 2.9c1.2 1.3 2.5 2.7 2.2 4.4-.3 1.2-1.1 2-2.3 2.2-.8.1-3-.5-5.4-.5s-4.6.6-5.4.5c-1.2-.2-2-1-2.3-2.2-.3-1.7 1-3.1 2.2-4.4l2.4-2.9c.9-1.1 1.8-1.9 3.1-1.9z',
  atm: 'M11 17h2v-1h1c.55 0 1-.45 1-1v-3c0-.55-.45-1-1-1h-3v-1h4V8h-2V7h-2v1h-1c-.55 0-1 .45-1 1v3c0 .55.45 1 1 1h3v1H9v2h2v1zm9-13H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4V6h16v12z',
  stroller: 'M13 2v8h8c0-4.42-3.58-8-8-8zm6.32 13.89A6.95 6.95 0 0 0 21 11H6.44l-.95-2H2v2h2.22s1.89 4.07 2.12 4.42A3.5 3.5 0 1 0 11.46 19h2.08a3.5 3.5 0 1 0 5.78-3.11zM8 20a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm9 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
  museum: 'M22 11V9L12 2 2 9v2h2v9H2v2h20v-2h-2v-9h2zm-6 7h-2v-4l-2 3-2-3v4H8v-7h2l2 3 2-3h2v7z',
  shield: 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z',
  mail: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
  church: 'M11 1h2v2.5h2.5v2H13V8l6 4v10h-5v-4.5a2 2 0 0 0-4 0V22H5V12l6-4V5.5H8.5v-2H11z',
  taxi: 'M18.92 6.01C18.72 5.42 18.16 5 17.5 5H15V3H9v2H6.5c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm11 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM5 11l1.5-4.5h11L19 11H5z',
  dumbbell: 'M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z',
  briefcase: 'M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z',
};

// Порядок важен: подкатегории-исключения (например, «mall») проверяются раньше классов.
// landmark: true — «знаковые» места (госучреждения, вузы, культура, мечети):
// значок над зданием и подпись в плашке под ним. Остальные — значок слева от
// названия в белой «таблетке».
export const CATEGORIES = [
  {
    id: 'food', label: 'Рестораны', color: '#F7931E', icon: 'restaurant',
    classes: ['restaurant', 'fast_food', 'cafe', 'bar', 'beer', 'ice_cream'],
    icons: { cafe: 'cafe', ice_cream: 'cafe', fast_food: 'burger', bar: 'bar', beer: 'bar', pub: 'bar' },
  },
  {
    id: 'shop', label: 'Магазины', color: '#1FAA59', icon: 'cart',
    classes: ['shop', 'grocery', 'alcohol_shop', 'clothing_store', 'bakery', 'butcher',
      'florist', 'mobile_phone', 'hairdresser', 'optician', 'jewelry', 'furniture',
      'hardware', 'books', 'music', 'car', 'bicycle'],
    // Значки по типу: продукты, одежда, связь, салоны, авто, мебель, книги.
    icons: {
      grocery: 'basket', supermarket: 'basket', convenience: 'basket', greengrocer: 'basket', bakery: 'basket',
      butcher: 'basket', clothing_store: 'hanger', clothes: 'hanger', shoes: 'hanger', boutique: 'hanger',
      mobile_phone: 'phone', electronics: 'phone', computer: 'phone', hairdresser: 'scissors', beauty: 'scissors',
      cosmetics: 'scissors', car: 'car', car_parts: 'car', car_repair: 'wrench', hardware: 'wrench',
      furniture: 'sofa', books: 'book',
    },
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
    icons: { veterinary: 'paw' },
  },
  {
    id: 'bank', label: 'Банки и банкоматы', color: '#0E9F8E', icon: 'bank',
    classes: ['bank', 'atm'],
    icons: { atm: 'atm' },
  },
  {
    id: 'fuel', label: 'АЗС', color: '#3949AB', icon: 'fuel',
    classes: ['fuel'],
  },
  {
    id: 'edu', label: 'Образование', color: '#56657C', icon: 'school', landmark: true,
    classes: ['college', 'school', 'kindergarten', 'library'],
    icons: { library: 'book', kindergarten: 'stroller' },
  },
  {
    id: 'culture', label: 'Культура и досуг', color: '#7B5EA7', icon: 'star', landmark: true,
    classes: ['museum', 'theatre', 'cinema', 'art_gallery', 'attraction', 'monument',
      'memorial', 'castle', 'zoo', 'stadium'],
    icons: { theatre: 'theater', cinema: 'theater', museum: 'museum', zoo: 'paw' },
  },
  {
    id: 'gov', label: 'Госучреждения', color: '#4F5D73', icon: 'landmark', landmark: true,
    subclasses: ['government'],
    classes: ['town_hall', 'police', 'post', 'fire_station', 'embassy'],
    icons: { police: 'shield', post: 'mail', post_office: 'mail' },
  },
  {
    id: 'worship', label: 'Мечети и храмы', color: '#16A085', icon: 'mosque', landmark: true,
    classes: ['place_of_worship'],
    icons: { christian: 'church', church: 'church' },
  },
  {
    id: 'transport', label: 'Транспорт', color: '#455A64', icon: 'train',
    subclasses: ['station', 'halt', 'bus_station', 'bus_stop', 'tram_stop'],
    icons: { bus_station: 'bus', bus_stop: 'bus', taxi: 'taxi' },
  },
];

// Аэропорты (слой aerodrome_label) — отдельный значок того же цвета.
export const AIRPORT = { id: 'airport', label: 'Аэропорты', color: '#455A64', icon: 'plane' };

export const OTHER = {
  id: 'other', label: 'Прочее', color: '#8D8D8D', icon: 'dot',
  icons: { fitness_centre: 'dumbbell', sports_centre: 'dumbbell', office: 'briefcase', car_repair: 'wrench', taxi: 'taxi' },
};

export const CATEGORY_BY_ID = Object.fromEntries(
  [...CATEGORIES, OTHER, AIRPORT].map((c) => [c.id, c]),
);

export const LANDMARK_CATEGORIES = CATEGORIES.filter((c) => c.landmark).map((c) => c.id);

// Классы, которые рисуются не значками (парки и сады — зелёной подписью) или не нужны.
// Парковки рисуются своим значком «P» из дополнительных тайлов (слой point).
export const HIDDEN_CLASSES = ['park', 'garden', 'entrance', 'harbor', 'golf', 'campsite',
  'cemetery', 'swimming', 'playground', 'parking'];

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
  fire_station: 'Пожарная часть', embassy: 'Посольство', government: 'Госучреждение',
  place_of_worship: 'Место поклонения', muslim: 'Мечеть', christian: 'Церковь',
  garden: 'Сад', parking: 'Парковка',
  park: 'Парк', square: 'Площадь',
  station: 'Вокзал / станция', halt: 'Остановочный пункт', bus_station: 'Автовокзал',
  bus_stop: 'Остановка', tram_stop: 'Трамвайная остановка', subway_entrance: 'Вход в метро',
  aerodrome: 'Аэропорт', international: 'Международный аэропорт',
  // Типы организаций Overture Maps (scripts/places.py).
  financial: 'Финансовые услуги', laboratory: 'Лаборатория', office: 'Офис', craft: 'Мастерская',
  event: 'Организация праздников', rental: 'Прокат', sports_centre: 'Спортивный центр',
  fitness_centre: 'Фитнес-клуб', travel_agency: 'Турагентство', estate_agent: 'Агентство недвижимости',
  sports: 'Спорттовары', second_hand: 'Комиссионный магазин', wholesale: 'Оптовая торговля',
  stationery: 'Канцтовары', variety_store: 'Магазин низких цен', apartment: 'Апартаменты', resort: 'База отдыха',
  research_institute: 'НИИ', theme_park: 'Парк развлечений', amusement_arcade: 'Игровой клуб', casino: 'Казино',
  church: 'Церковь', mosque: 'Мечеть', taxi: 'Такси', lawyer: 'Юридические услуги', laundry: 'Прачечная',
  courier: 'Доставка', copyshop: 'Типография', industrial: 'Производство', swimming_pool: 'Бассейн',
  education: 'Образование', tutoring: 'Курсы и репетиторы', shop: 'Магазин',
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

// Выражение, дающее id картинки из спрайта: `${prefix}-<категория>-<иконка>` (prefix — 'poi').
// Сначала — значок по типу места (кафе, банкомат, одежда), потом — по категории.
// only — ограничить выражение этими категориями.
export function imageExpression(prefix, only = null) {
  const cats = only ? CATEGORIES.filter((c) => only.includes(c.id)) : CATEGORIES;
  const fallback = only ? `${prefix}-${cats[0].id}-${cats[0].icon}` : `${prefix}-${OTHER.id}-${OTHER.icon}`;
  const cases = ['case'];
  for (const c of only ? cats : [...cats, OTHER]) {
    for (const [cls, icon] of Object.entries(c.icons || {})) {
      // Классы-исключения принадлежат только своей категории, поэтому хватает класса.
      cases.push(['any', ['==', ['get', 'class'], cls], ['==', ['get', 'subclass'], cls]],
        `${prefix}-${c.id}-${icon}`);
    }
  }
  const byCategory = ['match', categoryExpression()];
  for (const c of cats) byCategory.push(c.id, `${prefix}-${c.id}-${c.icon}`);
  byCategory.push(fallback);
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
