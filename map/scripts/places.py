"""Адреса и организации для поиска и карточек — в том виде, как их пишут 2ГИС и Яндекс Карты.

Адрес. «улица Бободжана Гафурова, 46/2»: улица из addr:street сверяется с ближайшей
улицей OSM с тем же названием, у которой берутся name:ru, name и name:en. Если
русского названия у улицы нет, таджикский тип переводится (кӯчаи → улица,
хиёбони → проспект, гузаргоҳи → проезд…), а буквы ӣ ӯ ҳ қ ғ ҷ передаются
по-русски. Сокращения («ул», «пр.») раскрываются, «12 мкр» → «12-й микрорайон».
Номер дома приводится к одному виду: «32\\1» и «46 / 2» → «32/1» и «46/2», «5 а» → «5а»;
вместо номера в OSM иногда стоит название («Кафе Сахо») — такие адреса пропускаются.

Организации Overture Maps (scripts/overture.py) сверяются с OSM:
  * слабые записи (уверенность ниже MIN_CONFIDENCE) и природа (реки, горы) отбрасываются;
  * запись с тем же названием в пределах SAME_RADIUS от места OSM — это то же место:
    OSM дополняется телефонами, сайтом и соцсетями из Overture, дубликат не добавляется;
  * много записей в одной точке — это центр города, а не адрес: такие места
    ставятся на свой дом по адресу из Overture (если дом с этим номером есть в OSM),
    иначе попадают только в поиск с пометкой «расположение приблизительное».
"""

import math
import re
import unicodedata
from collections import defaultdict

# ——— Нормализация для сравнения ———

_FOLD = str.maketrans({'ҳ': 'х', 'қ': 'к', 'ғ': 'г', 'ҷ': 'ч', 'ъ': '', 'ь': ''})


def fold(s):
    """Нижний регистр, без ударений и знаков; таджикские буквы — как русские; й → и, ё → е."""
    s = unicodedata.normalize('NFD', (s or '').lower())
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn').translate(_FOLD)


# Латиница Overture («Ayni Street 46», «Mirzo Tursunzoda») → кириллица для сравнения с OSM.
_LAT = [('shch', 'щ'), ('sh', 'ш'), ('ch', 'ч'), ('zh', 'ж'), ('kh', 'х'), ('ts', 'ц'), ('yo', 'е'),
        ('yu', 'ю'), ('ya', 'я'), ('ye', 'е'), ('gh', 'г'), ('dzh', 'ч'), ('dj', 'ч'), ('j', 'ч'),
        ('a', 'а'), ('b', 'б'), ('v', 'в'), ('w', 'в'), ('g', 'г'), ('d', 'д'), ('e', 'е'), ('z', 'з'),
        ('i', 'и'), ('y', 'и'), ('k', 'к'), ('q', 'к'), ('c', 'к'), ('l', 'л'), ('m', 'м'), ('n', 'н'),
        ('o', 'о'), ('p', 'п'), ('r', 'р'), ('s', 'с'), ('t', 'т'), ('u', 'у'), ('f', 'ф'), ('h', 'х'),
        ('x', 'х')]


def latin_to_cyrillic(s):
    out, i = [], 0
    while i < len(s):
        for lat, cyr in _LAT:
            if s.startswith(lat, i):
                out.append(cyr)
                i += len(lat)
                break
        else:
            out.append(s[i])
            i += 1
    return ''.join(out)


# Слова типа улицы — при сравнении названий не учитываются.
TYPE_WORDS = {fold(w) for w in (
    'кӯчаи', 'кучаи', 'кӯч', 'куч', 'хиёбони', 'гузаргоҳи', 'майдони', 'шоҳроҳи', 'бунбасти', 'тупики',
    'танкӯчаи', 'маҳаллаи', 'мавзеи', 'улица', 'ул', 'проспект', 'пр', 'просп', 'переулок', 'пер', 'проезд',
    'тупик', 'бульвар', 'шоссе', 'площадь', 'пл', 'street', 'str', 'st', 'avenue', 'ave', 'prospect',
    'lane', 'road', 'rd', 'kuchai', 'kochasi', 'кӯчаҳои', 'мкр', 'мкрн', 'микрорайон', 'mkr')}


def street_key(name):
    """Ключ улицы для сравнения: слова названия без типа улицы, порядковых окончаний и пунктуации."""
    s = re.sub(r'(\d+)\s*-?\s*(?:й|ый|ой|ий|го|уми|юми|ум|юм)(?![а-яӣӯ])', r'\1', (name or '').lower())
    words = [w for w in re.findall(r'[0-9a-zа-я]+', fold(s)) if w not in TYPE_WORDS]
    words = [fold(latin_to_cyrillic(w)) if re.search(r'[a-z]', w) else w for w in words]
    return ' '.join(w for w in words if w not in TYPE_WORDS)


def surname_key(key):
    """Последнее слово названия («с хофиз» → «хофиз»): запасной ключ для «кучаи С.Хофиз»."""
    words = key.split()
    return words[-1] if words and len(words[-1]) >= 4 and not words[-1].isdigit() else ''


_HOUSE_OK = re.compile(r'^\d+[а-яa-zӣӯҳқғҷ]?(?:[/\-]\d+[а-яa-zӣӯҳқғҷ]?)*(?:\s*(?:корпус|корп|к|блок|стр)\.?\s*\d+)?$', re.I)


def house_number(value):
    """Номер дома в одном виде («46/2», «5а», «12 корпус 1») или '' если это не номер."""
    s = ' '.join((value or '').replace('\\', '/').split())
    s = re.sub(r'^(?:дом|д\.|хонаи|№)\s*', '', s, flags=re.I)
    s = re.sub(r'\s*/\s*', '/', s)
    s = re.sub(r'(\d)\s+([а-яa-zӣӯ])(?=$|/)', r'\1\2', s, flags=re.I)  # «5 а» → «5а»
    if _HOUSE_OK.match(s):
        return s
    return s if re.match(r'^\d', s) and len(s) <= 12 else ''


# ——— Название улицы по-русски ———

_TG_RU = str.maketrans({'ӣ': 'и', 'ӯ': 'у', 'ҳ': 'х', 'қ': 'к', 'ғ': 'г',
                        'Ӣ': 'И', 'Ӯ': 'У', 'Ҳ': 'Х', 'Қ': 'К', 'Ғ': 'Г'})


def tg_to_ru(s):
    """Таджикские буквы — по-русски: Ҷомӣ → Джоми, Ғафуров → Гафуров."""
    s = s.replace('ҷ', 'дж').replace('Ҷ', 'Дж')
    return s.translate(_TG_RU)


# Таджикский тип улицы (стоит перед названием) → русский.
TG_TYPES = [
    (r'кӯчаи|кучаи|кӯч\.|куч\.', 'улица'), (r'хиёбони', 'проспект'), (r'гузаргоҳи|гузаргохи', 'проезд'),
    (r'майдони', 'площадь'), (r'шоҳроҳи|шохрохи', 'шоссе'), (r'бунбасти|тупики', 'тупик'),
    (r'танкӯчаи|танкучаи', 'переулок'), (r'маҳаллаи|махаллаи', 'махалля'), (r'мавзеи', 'массив'),
]
RU_ABBR = [
    (r'ул\.?', 'улица'), (r'пр-т\.?|просп\.?|пр\.', 'проспект'), (r'пер\.?', 'переулок'), (r'пр-д\.?', 'проезд'),
    (r'б-р\.?', 'бульвар'), (r'пл\.', 'площадь'), (r'ш\.', 'шоссе'), (r'мкрн?\.?', 'микрорайон'),
]


def tidy(s):
    s = ' '.join(s.split())
    return re.sub(r'\(\s+', '(', re.sub(r'\s+\)', ')', s))


def ru_street(name):
    """Русское написание улицы из названия OSM: «кӯчаи Айнӣ» → «улица Айни», «ул Джура Закиров» → «улица …»."""
    s = tidy(name)
    m = (re.match(r'^(\d+)(?:-?[йи]й?)?\s*(?:мкрн?\.?|микрорайон)$', s, re.I)
         or re.match(r'^(?:мкрн?\.?|микрорайон)\s*(\d+)$', s, re.I))
    if m:
        return f'{m.group(1)}-й микрорайон'
    for pat, ru in TG_TYPES:
        m = re.match(rf'^(?:{pat})\s+(.+)$', s, re.I)
        if m:
            return f'{ru} {tg_to_ru(m.group(1))}'
    for pat, ru in RU_ABBR:
        m = re.match(rf'^(?:{pat})\s*(.+)$', s, re.I)
        if m and not re.match(r'^(?:улица|проспект|переулок|проезд|бульвар|площадь|шоссе|микрорайон)\b', s, re.I):
            return f'{ru} {tg_to_ru(m.group(1))}'
    return tg_to_ru(s)


# ——— Улицы: сопоставление addr:street с улицей OSM ———

RU_TYPE_WORDS = {'улица', 'проспект', 'переулок', 'проезд', 'бульвар', 'площадь', 'шоссе', 'тупик', 'набережная',
                 'микрорайон', 'махалля', 'массив'}


def ru_quality(name):
    """Насколько хорошо русское имя улицы: с типом («улица …»), фамилия в родительном падеже
    («Гафурова», «Горького», а не «Гафуров», «Горкий»), «дж» на месте таджикской «ҷ» («Джура»,
    а не «Чура»), без опечаток."""
    low = (name or '').lower()
    words = re.findall(r'[а-яё]+', low)
    body = [w for w in words if w not in RU_TYPE_WORDS]
    typed = len(body) < len(words)
    last = body[-1] if body else ''
    # «Турсунзода», «Хусейнзода» — именительный падеж, хоть и на «-а».
    declined = len(last) > 3 and last.endswith(('а', 'я', 'ого', 'его')) and not last.endswith(('зода', 'зада'))
    return (typed, declined, low.count('дж') - low.count('ч') - low.count(','))


def ru_name(names, street=''):
    """Русское имя улицы для адреса: name:ru, а если его нет — из таджикского названия."""
    return ru_street(names[1]) if names[1] else ru_street(names[0] or street)


def street_type(name):
    """Тип улицы по первому слову русского имени: «улица», «проспект», «переулок»… или ''."""
    first = (name or '').split(' ', 1)[0].lower()
    return first if first in ('улица', 'проспект', 'переулок', 'проезд', 'бульвар', 'шоссе', 'тупик',
                              'площадь', 'набережная') else ''


class StreetIndex:
    """Улицы OSM по ключу названия; поиск ближайшей к дому улицы с тем же названием."""

    def __init__(self, streets, to_xy):
        self.to_xy = to_xy
        self.exact = defaultdict(list)
        self.surname = defaultdict(list)
        for lon, lat, names in streets:
            x, y = to_xy(lon, lat)
            keys = {street_key(n) for n in names if n}
            for k in keys - {''}:
                self.exact[k].append((x, y, names))
                sk = surname_key(k)
                if sk:
                    self.surname[sk].append((x, y, names))

    def find(self, street, lon, lat):
        """Названия (name, name:ru, name:tg, name:en) ближайшей подходящей улицы или None."""
        x, y = self.to_xy(lon, lat)
        key = street_key(street)
        items = self.exact.get(key, ())
        best = self._nearest(items, x, y, 3000)
        if best is None and surname_key(key):
            items = self.surname.get(surname_key(key), ())
            best = self._nearest(items, x, y, 800)
        if best is None:
            return None
        return self._fuller(self._usual(best, items, x, y), x, y)

    @staticmethod
    def _usual(best, items, x, y, limit=1500):
        """Одно написание на улицу: участки одной улицы в OSM подписаны по-разному («улица
        А. Расулова», «улица А.Расулов») — берётся самое частое русское имя у участков той же
        улицы рядом с домом; при равенстве — ближайшее."""
        key = street_key(best[0] or best[1])
        groups = defaultdict(list)
        for sx, sy, names in items:
            if street_key(names[0] or names[1]) == key:
                d = math.hypot(sx - x, sy - y)
                if d < limit:
                    groups[ru_name(names)].append((d, names))
        if len(groups) < 2:
            return best
        # Лучшее написание (ru_quality); при равенстве — настоящее русское имя из OSM, а не
        # переложение таджикского («Турсунзаде», а не «Турсунзода»), затем самое частое и ближайшее.
        group = max(groups.items(), key=lambda g: (ru_quality(g[0]), any(n[1] for _d, n in g[1]), len(g[1]),
                                                   -min(g[1])[0]))[1]
        return min(group, key=lambda item: item[0])[1]

    def _fuller(self, names, x, y, limit=1500):
        """«улица Гафурова» → «улица Бабаджана Гафурова»: если та же улица рядом названа полностью
        (имя и фамилия), адрес пишется полным именем, как в 2ГИС и Яндекс Картах."""
        key = street_key(names[0] or names[1])
        kind = street_type(ru_name(names))
        if len(key.split()) != 1 or not surname_key(key) or not kind:
            return names
        # Только продолжение той же улицы: участок с полным именем примыкает к ней (ближе 250 м
        # к её участкам у дома), русское имя того же типа («улица» — не «проспект»), имя и фамилия
        # без инициалов, скобок и номеров. «Худжанди» в 2 км — другая улица («Муроди Худжанди»).
        # Из нескольких написаний («Бабаджана», «Бободжона») — самое частое.
        local = [(px, py) for px, py, _n in self.exact.get(key, ()) if math.hypot(px - x, py - y) < limit]
        found = defaultdict(list)
        for sx, sy, other in self.surname.get(key, ()):
            ru = other[1]
            words = street_key(other[0] or ru).split()
            if (not ru or street_type(ru) != kind or re.search(r'[().\d]', ru) or len(words) != 2
                    or words[-1] != key or len(words[0]) < 3):
                continue
            if min((math.hypot(sx - px, sy - py) for px, py in local), default=limit) < 250:
                found[ru].append((math.hypot(sx - x, sy - y), other))
        if not found:
            return names
        group = max(found.values(), key=lambda g: (len(g), -min(g)[0]))
        return min(group, key=lambda item: item[0])[1]

    @staticmethod
    def _nearest(items, x, y, limit):
        best, best_d = None, limit
        for sx, sy, names in items:
            d = math.hypot(sx - x, sy - y)
            if d < best_d:
                best, best_d = names, d
        return best


def address_names(street, number, names):
    """(ru, tg, en) — адрес для заголовка карточки на трёх языках."""
    if names:
        name, name_ru, name_tg, name_en = names
        ru = ru_name(names, street)
        tg = tidy(name_tg or name or street)
        en = tidy(name_en) if name_en else ''
    else:
        ru, tg, en = ru_street(street), tidy(street), ''
    if re.search(r'[a-z]', street, re.I) and not names:
        ru = tg = tidy(street)  # латинское название улицы оставляем как есть
    return (f'{ru}, {number}', f'{tg}, {number}' if fold(tg) != fold(ru) else '',
            f'{en}, {number}' if en else '')


# ——— Организации Overture ———

MIN_CONFIDENCE = 0.5
SAME_RADIUS = 120      # м: то же название ближе — это то же место, что в OSM
CLUSTER = 3            # столько записей в одной точке — это центр города, а не адрес

# basic_category Overture → (категория стиля, подкласс OSM для подписи типа).
OVERTURE_CATEGORIES = {
    'restaurant': ('food', 'restaurant'), 'cafe': ('food', 'cafe'), 'coffee_shop': ('food', 'cafe'),
    'casual_eatery': ('food', 'fast_food'), 'fast_food_restaurant': ('food', 'fast_food'), 'bar': ('food', 'bar'),
    'lounge': ('food', 'bar'), 'food_service': ('food', 'restaurant'), 'food_and_drink': ('food', 'restaurant'),
    'non_alcoholic_beverage_venue': ('food', 'cafe'), 'alcoholic_beverage_venue': ('food', 'bar'),
    'brewery': ('food', 'pub'), 'dance_club': ('culture', 'nightclub'), 'music_venue': ('culture', 'arts_centre'),
    'fashion_and_apparel_store': ('shop', 'clothes'), 'shopping': ('shop', 'shop'),
    'hardware_home_and_garden_store': ('shop', 'hardware'), 'food_and_beverage_store': ('shop', 'convenience'),
    'electronics_store': ('shop', 'electronics'), 'flowers_and_gifts_store': ('shop', 'florist'),
    'vehicle_parts_store': ('shop', 'car_parts'), 'department_store': ('mall', 'department_store'),
    'arts_crafts_and_hobby_store': ('shop', 'gift'), 'books_music_and_video_store': ('shop', 'books'),
    'personal_care_and_beauty_store': ('shop', 'cosmetics'), 'sporting_goods_store': ('shop', 'sports'),
    'second_hand_store': ('shop', 'second_hand'), 'warehouse_club_store': ('shop', 'wholesale'),
    'specialty_store': ('shop', 'shop'), 'convenience_store': ('shop', 'convenience'),
    'toys_and_games_store': ('shop', 'toys'), 'office_supply_store': ('shop', 'stationery'),
    'discount_store': ('shop', 'variety_store'), 'market': ('mall', 'marketplace'),
    'farmers_market': ('mall', 'marketplace'), 'shopping_mall': ('mall', 'mall'), 'auto_dealer': ('shop', 'car'),
    'vehicle_dealer': ('shop', 'car'), 'wholesaler': ('shop', 'wholesale'), 'supplier_or_distributor': ('shop', 'wholesale'),
    'pharmacy_and_drug_store': ('pharmacy', 'pharmacy'),
    'hotel': ('hotel', 'hotel'), 'lodging': ('hotel', 'guest_house'), 'private_lodging': ('hotel', 'apartment'),
    'bed_and_breakfast': ('hotel', 'guest_house'), 'inn': ('hotel', 'guest_house'), 'resort': ('hotel', 'resort'),
    'hospital': ('health', 'hospital'), 'health_care': ('health', 'clinic'), 'dental_clinic': ('health', 'dentist'),
    'diagnostics_imaging_or_lab_service': ('health', 'laboratory'), 'outpatient_care_facility': ('health', 'clinic'),
    'specialized_health_care': ('health', 'clinic'), 'behavioral_or_mental_health_clinic': ('health', 'clinic'),
    'surgery': ('health', 'clinic'), 'complementary_and_alternative_medicine': ('health', 'clinic'),
    'primary_care_or_general_clinic': ('health', 'clinic'), 'vision_or_eye_care_clinic': ('health', 'optician'),
    'physical_medicine_and_rehabilitation': ('health', 'clinic'), 'walk_in_clinic': ('health', 'clinic'),
    'reproductive_perinatal_and_womens_care': ('health', 'clinic'), 'specialized_medical_facility': ('health', 'clinic'),
    'animal_or_pet_service': ('health', 'veterinary'),
    'bank_or_credit_union': ('bank', 'bank'), 'financial_service': ('bank', 'financial'), 'atm': ('bank', 'atm'),
    'fueling_station': ('fuel', 'fuel'), 'gas_station': ('fuel', 'fuel'),
    'college_university': ('edu', 'university'), 'place_of_learning': ('edu', 'education'),
    'education': ('edu', 'education'), 'specialty_school': ('edu', 'education'), 'middle_school': ('edu', 'school'),
    'high_school': ('edu', 'school'), 'elementary_school': ('edu', 'school'), 'preschool': ('edu', 'kindergarten'),
    'educational_service': ('edu', 'education'), 'tutoring_service': ('edu', 'tutoring'), 'library': ('edu', 'library'),
    'campus_building': ('edu', 'university'),
    'research_institute': ('edu', 'research_institute'),
    'historic_site': ('culture', 'attraction'), 'museum': ('culture', 'museum'), 'movie_theater': ('culture', 'cinema'),
    'theatre_venue': ('culture', 'theatre'), 'performing_arts_venue': ('culture', 'theatre'),
    'arts_and_entertainment': ('culture', 'arts_centre'), 'art_gallery': ('culture', 'gallery'),
    'cultural_center': ('culture', 'arts_centre'), 'monument': ('culture', 'monument'),
    'sculpture_statue': ('culture', 'monument'), 'stadium_arena': ('culture', 'stadium'),
    'amusement_park': ('culture', 'theme_park'), 'amusement_attraction': ('culture', 'theme_park'),
    'zoo': ('culture', 'zoo'), 'animal_attraction': ('culture', 'zoo'), 'arcade': ('culture', 'amusement_arcade'),
    'gaming_venue': ('culture', 'amusement_arcade'), 'casino': ('culture', 'casino'),
    'government_office': ('gov', 'government'), 'community_and_government': ('gov', 'government'),
    'embassy': ('gov', 'embassy'), 'courthouse': ('gov', 'courthouse'), 'police_station': ('gov', 'police'),
    'muslim_place_of_worship': ('worship', 'mosque'), 'christian_place_of_worship': ('worship', 'church'),
    'religious_organization': ('worship', 'place_of_worship'),
    'train_station': ('transport', 'station'), 'public_transit_facility_or_service': ('transport', 'bus_station'),
    'taxi_or_ride_share_service': ('other', 'taxi'),
    'travel_service': ('other', 'travel_agency'), 'professional_service': ('other', 'office'),
    'corporate_or_business_office': ('other', 'office'), 'real_estate_service': ('other', 'estate_agent'),
    'personal_or_beauty_service': ('shop', 'beauty'), 'wellness_service': ('shop', 'beauty'),
    'home_service': ('other', 'craft'), 'building_or_construction_service': ('other', 'craft'),
    'automotive_service': ('other', 'car_repair'), 'vehicle_service': ('other', 'car_repair'),
    'media_service': ('other', 'office'), 'design_service': ('other', 'office'), 'printing_service': ('other', 'copyshop'),
    'technical_service': ('other', 'office'), 'manufacturer': ('other', 'industrial'),
    'rental_service': ('other', 'rental'), 'recreational_equipment_rental': ('other', 'rental'),
    'laundry_service': ('other', 'laundry'), 'attorney_or_law_firm': ('other', 'lawyer'), 'legal_service': ('other', 'lawyer'),
    'shipping_or_delivery_service': ('other', 'courier'), 'event_or_party_service': ('other', 'event'),
    'gym': ('other', 'fitness_centre'), 'fitness_studio': ('other', 'fitness_centre'),
    'sport_or_fitness_facility': ('other', 'sports_centre'), 'sports_and_recreation': ('other', 'sports_centre'),
    'sport_field': ('other', 'sports_centre'), 'sport_court': ('other', 'sports_centre'),
    'swimming_pool': ('other', 'swimming_pool'), 'sport_or_recreation_club': ('other', 'sports_centre'),
    'sport_league': ('other', 'sports_centre'),
}
# Корень таксономии → категория, если basic_category нет в таблице.
OVERTURE_ROOTS = {
    'eat_and_drink': ('food', 'restaurant'), 'shopping': ('shop', 'shop'), 'health_care': ('health', 'clinic'),
    'lodging': ('hotel', 'hotel'), 'education': ('edu', 'school'), 'arts_and_entertainment': ('culture', 'arts_centre'),
    'community_and_government': ('other', 'office'), 'religious': ('worship', 'place_of_worship'),
    'financial_service': ('bank', 'financial'), 'services_and_business': ('other', 'office'),
    'sports_and_recreation': ('other', 'sports_centre'), 'travel_and_transportation': ('other', 'travel_agency'),
}
# Природа и то, что лучше знает OSM: реки, горы, парки, аэропорты, парковки.
OVERTURE_SKIP = {'geographic_entities', 'river', 'lake', 'mountain', 'canal', 'beach', 'park', 'national_park',
                 'nature_reserve', 'garden', 'bridge', 'hot_springs', 'public_plaza', 'public_fountain', 'airport',
                 'air_transport_facility_or_service', 'parking', 'military_site', 'jail_or_prison', 'campground',
                 'electric_utility_provider', 'water_utility_provider', 'radio_station'}


def overture_category(rec):
    root = (rec.get('hierarchy') or [''])[0]
    if rec['category'] in OVERTURE_SKIP or root == 'geographic_entities':
        return None
    return OVERTURE_CATEGORIES.get(rec['category']) or OVERTURE_ROOTS.get(root) or ('other', 'office')


# Общие слова не отличают одно место от другого: «Кафе» и «Кафе Лола» — разные места.
GENERIC = {fold(w) for w in (
    'кафе', 'ресторан', 'магазин', 'аптека', 'банк', 'отель', 'гостиница', 'салон', 'школа', 'центр', 'тц',
    'супермаркет', 'ооо', 'оао', 'зао', 'мчж', 'чдм', 'филиал', 'офис', 'дорухона', 'мағоза', 'тарабхона',
    'cafe', 'restaurant', 'shop', 'store', 'market', 'hotel', 'pharmacy', 'bank', 'llc', 'center', 'centre',
    'the', 'and', 'tj', 'tajikistan', 'таджикистан', 'тоҷикистон', 'душанбе', 'dushanbe')}


def name_key(s):
    words = set()
    for w in re.findall(r'[0-9a-zа-я]+', fold(s)):
        if re.search(r'[a-z]', w):
            words.add(w)
            w = fold(latin_to_cyrillic(w))
        words.add(w)
    return {w for w in words if len(w) > 1 and w not in GENERIC}


def same_name(a, b):
    """Названия одного места: совпадает хотя бы половина значимых слов (латиница, таджикские буквы — тоже)."""
    ka, kb = name_key(a), name_key(b)
    if not ka or not kb:
        return False
    common = len(ka & kb)
    return common > 0 and common / min(len(ka), len(kb)) >= 0.5


def social_link(url):
    """Instagram / Facebook / Telegram — короткая подпись для карточки."""
    m = re.search(r'(instagram|facebook|t\.me|telegram|vk|ok)\.[a-z]+/?(.*)', url or '', re.I)
    if not m:
        return None
    return url


def split_address(freeform):
    """«улица Фучика 88», «Ayni Street 46», «ул.Айни 71/48 (Поворот аэропорта)» → (улица, номер)."""
    s = re.sub(r'\(.*?\)', ' ', freeform or '')
    m = re.search(r'(.*?)[,\s]+(?:д\.?\s*|дом\s*|№\s*)?(\d+[а-яa-z]?(?:\s*/\s*(?:\d+[а-яa-z]?|[а-яa-z]))?)\s*$',
                  s.strip(), re.I)
    if not m or not m.group(1).strip():
        return None, None
    return m.group(1).strip(' ,.'), house_number(m.group(2))


class AddressIndex:
    """Дома OSM по (улица, номер) — для привязки организаций Overture к дому по адресу."""

    def __init__(self, addresses, to_xy):
        self.to_xy = to_xy
        self.homes = defaultdict(list)
        for lon, lat, street, number, *_ in addresses:
            k = street_key(street)
            n = house_number(number).lower()
            if k and n:
                self.homes[(k, n)].append((lon, lat))
                sk = surname_key(k)
                if sk:
                    self.homes[(sk, n)].append((lon, lat))

    def locate(self, freeform, lon, lat, radius=20000):
        street, number = split_address(freeform)
        if not street or not number:
            return None
        k = street_key(street)
        cands = self.homes.get((k, number.lower())) or self.homes.get((surname_key(k), number.lower())) or []
        x, y = self.to_xy(lon, lat)
        best, best_d = None, radius
        for hlon, hlat in cands:
            hx, hy = self.to_xy(hlon, hlat)
            d = math.hypot(hx - x, hy - y)
            if d < best_d:
                best, best_d = (hlon, hlat), d
        return best


def merge_overture(records, pois, addresses, contains, to_xy):
    """Слить организации Overture с местами OSM.

    records — строки scripts/overture.py; pois — список мест OSM поиска
    (lon, lat, имена, категория, тип, сведения), дополняется на месте.
    Возвращает (новые места для тайлов, статистика)."""
    stats = defaultdict(int)
    grid = defaultdict(list)
    for i, (lon, lat, names, *_rest) in enumerate(pois):
        x, y = to_xy(lon, lat)
        grid[(int(x // SAME_RADIUS), int(y // SAME_RADIUS))].append((i, x, y))
    counts = defaultdict(int)
    for r in records:
        counts[(round(r['lon'], 4), round(r['lat'], 4))] += 1
    homes = AddressIndex(addresses, to_xy)
    fresh, seen = [], defaultdict(list)
    for r in sorted(records, key=lambda r: -r['confidence']):
        if not contains(r['lon'], r['lat']):
            continue
        stats['в стране'] += 1
        cat = overture_category(r)
        if not cat or r['confidence'] < MIN_CONFIDENCE or not r['name'].strip():
            stats['отброшено'] += 1
            continue
        lon, lat = r['lon'], r['lat']
        approx = counts[(round(lon, 4), round(lat, 4))] >= CLUSTER
        if approx:
            home = homes.locate(r['address'].get('freeform'), lon, lat)
            if home:
                lon, lat = home
                approx = False
                stats['поставлено на дом по адресу'] += 1
        info = {}
        phones = [p for p in r['phones'] if re.sub(r'\D', '', p)[-9:] not in ('', '000000000')]
        if phones:
            info['phone'] = '; '.join(phones[:3])
        if r['websites']:
            info['site'] = r['websites'][0][:120]
        socials = [s for s in r['socials'] if social_link(s)]
        if socials:
            info['social'] = socials[0][:120]
        if r['address'].get('freeform'):
            # В адресах Overture встречаются «\\n» и лишние пробелы: «Шотемур 21\\n».
            free = re.sub(r'\\[nrt]', ' ', r['address']['freeform'])
            info['addr'] = ' '.join(free.split()).strip(' ,')[:100]
        if r['address'].get('postcode'):
            info['pc'] = r['address']['postcode']
        # То же место уже есть в OSM — дополняем его контактами.
        x, y = to_xy(lon, lat)
        radius = 15000 if approx else SAME_RADIUS
        match = None
        cells = range(-1, 2) if not approx else range(-(radius // SAME_RADIUS), radius // SAME_RADIUS + 1)
        for di in cells:
            for dj in cells:
                for i, px, py in grid.get((int(x // SAME_RADIUS) + di, int(y // SAME_RADIUS) + dj), ()):
                    if math.hypot(px - x, py - y) <= radius and any(same_name(r['name'], n) for n in pois[i][2] if n):
                        match = i
                        break
                if match is not None:
                    break
            if match is not None:
                break
        if match is not None:
            old = pois[match][5]
            added = {k: v for k, v in info.items() if k in ('phone', 'site', 'social') and k not in old}
            if added:
                old.update(added)
                stats['дополнено мест OSM'] += 1
            else:
                stats['уже есть в OSM'] += 1
            continue
        # Повтор внутри Overture: то же название рядом.
        key = fold(r['name'])
        if any(math.hypot(sx - x, sy - y) < 60 for sx, sy in seen[key]):
            stats['повтор'] += 1
            continue
        seen[key].append((x, y))
        if approx:
            info['approx'] = 1
            stats['только в поиске (нет точного адреса)'] += 1
        else:
            stats['добавлено на карту'] += 1
        info['src'] = 'overture'
        names = (r['name'], r['names'].get('ru', ''), r['names'].get('tg', ''), r['names'].get('en', ''))
        pois.append((lon, lat, names, cat[0], cat[1], info))
        if not approx:
            rank = 1 if r['confidence'] >= 0.8 else 2 if r['confidence'] >= 0.65 else 3
            fresh.append((lon, lat, names, cat[0], cat[1], rank))
    return fresh, dict(stats)
