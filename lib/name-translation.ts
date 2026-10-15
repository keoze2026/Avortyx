/**
 * Campaign, publisher, buyer and destination names in the chosen language.
 *
 * These names are typed by the team ("C-02", "Taboola", "TBLA"), so there is
 * no dictionary to look them up in. They are written in the language's own
 * script instead - the way a brand name is written in a Russian, Japanese or
 * Chinese newspaper:
 *
 *   Russian   Cyrillic letters       Taboola -> Табула, Crug -> Круг, TBLA -> ТБЛА
 *   Japanese  katakana               Taboola -> タブーラ, Crug -> クルグ, TBLA -> ティービーエルエー
 *   Chinese   transliteration chars  Taboola -> 塔布拉, Crug -> 克鲁格
 *
 * Only what is SHOWN changes. Filters, search, sorting, the click-to-filter
 * and exports keep the real name, and the real name is shown on hover, so the
 * rows still match the Campaigns / Buyers / Publishers pages.
 *
 * NAME_OVERRIDES: put an exact translation here when the automatic spelling
 * is not the one the team wants. An override always wins.
 */

export type NameLocale = "zh" | "ja" | "ru";

export const NAME_OVERRIDES: Record<string, Partial<Record<NameLocale, string>>> = {
  // "Example Media": { ru: "Пример Медиа", ja: "エグザンプル・メディア", zh: "范例传媒" },
};

const cache = new Map<string, string>();

/** The name in the chosen language; English (or an empty name) is returned as is. */
export function localizeName(name: string | null | undefined, locale: string): string {
  const value = name ?? "";
  if (!value || locale === "en" || (locale !== "zh" && locale !== "ja" && locale !== "ru")) return value;
  const override = NAME_OVERRIDES[value]?.[locale as NameLocale];
  if (override) return override;
  const key = `${locale}|${value}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const loc = locale as NameLocale;
  // "23 JUNE" / "June 23": a date, written the local way.
  const date = localDate(value, loc);
  const out = date ?? value.replace(/[A-Za-z]+/g, (word) => WORDS[word.toLowerCase()]?.[loc] ?? spellWord(word, loc));
  // Words in Chinese run together; Japanese separates foreign words with "・".
  const joined =
    loc === "zh"
      ? out.replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, "$1")
      : loc === "ja"
        ? out.replace(/([\u30a0-\u30ff])\s+(?=[\u30a0-\u30ff])/g, "$1・")
        : out;
  cache.set(key, joined);
  return joined;
}

/* ─── common words and dates ─────────────────────────────────────────── */

/** Everyday words that appear in names, translated by meaning. */
const WORDS: Record<string, Record<NameLocale, string>> = {
  and: { ru: "и", ja: "＆", zh: "和" },
  media: { ru: "Медиа", ja: "メディア", zh: "传媒" },
  group: { ru: "Групп", ja: "グループ", zh: "集团" },
  test: { ru: "Тест", ja: "テスト", zh: "测试" },
  free: { ru: "Фри", ja: "フリー", zh: "免费" },
  network: { ru: "Нетворк", ja: "ネットワーク", zh: "网络" },
  digital: { ru: "Диджитал", ja: "デジタル", zh: "数字" },
  marketing: { ru: "Маркетинг", ja: "マーケティング", zh: "营销" },
  calls: { ru: "Звонки", ja: "コール", zh: "来电" },
  call: { ru: "Звонок", ja: "コール", zh: "来电" },
  live: { ru: "Лайв", ja: "ライブ", zh: "实时" },
  campaign: { ru: "Кампания", ja: "キャンペーン", zh: "营销活动" },
  insurance: { ru: "Страхование", ja: "保険", zh: "保险" },
  health: { ru: "Здоровье", ja: "ヘルス", zh: "健康" },
  auto: { ru: "Авто", ja: "オート", zh: "汽车" },
  home: { ru: "Хоум", ja: "ホーム", zh: "家居" },
  solar: { ru: "Солар", ja: "ソーラー", zh: "太阳能" },
  inc: { ru: "Инк.", ja: "インク", zh: "公司" },
  llc: { ru: "ООО", ja: "合同会社", zh: "有限责任公司" },
  ltd: { ru: "Лтд", ja: "株式会社", zh: "有限公司" },
};

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_SHORT = MONTHS.map((m) => m.slice(0, 3));
const RU_MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

function monthIndex(word: string): number {
  const w = word.toLowerCase();
  const full = MONTHS.indexOf(w);
  return full >= 0 ? full : MONTH_SHORT.indexOf(w);
}

/** "23 JUNE", "June 23" -> "23 июня" / "6月23日"; null when the name isn't a date. */
function localDate(value: string, locale: NameLocale): string | null {
  const m1 = value.trim().match(/^(\d{1,2})\s+([A-Za-z]+)$/);
  const m2 = value.trim().match(/^([A-Za-z]+)\s+(\d{1,2})$/);
  const day = m1 ? m1[1] : m2 ? m2[2] : null;
  const word = m1 ? m1[2] : m2 ? m2[1] : null;
  if (!day || !word) return null;
  const month = monthIndex(word);
  if (month < 0) return null;
  if (locale === "ru") return `${Number(day)} ${RU_MONTHS_GEN[month]}`.toUpperCase() === value.toUpperCase() ? value : `${Number(day)} ${RU_MONTHS_GEN[month]}`;
  return `${month + 1}月${Number(day)}日`;
}

/* ─── one Latin word ─────────────────────────────────────────────────── */

function spellWord(word: string, locale: NameLocale): string {
  // Codes and acronyms (C, TBLA, NB) are read letter by letter.
  const acronym = word.length <= 5 && word === word.toUpperCase();
  if (acronym) return [...word].map((ch) => LETTER_NAMES[locale][ch.toUpperCase()] ?? ch).join("");
  if (locale === "ru") return toCyrillic(word);
  return syllablesToScript(toSyllables(word), locale);
}

/* ─── Russian: Latin -> Cyrillic ─────────────────────────────────────── */

const RU_MULTI: Array<[string, string]> = [
  ["shch", "щ"], ["sch", "ш"], ["sh", "ш"], ["ch", "ч"], ["zh", "ж"], ["kh", "х"], ["ts", "ц"],
  ["ph", "ф"], ["th", "т"], ["ck", "к"], ["oo", "у"], ["ee", "и"], ["ya", "я"], ["yu", "ю"],
  ["yo", "ё"], ["qu", "кв"], ["ou", "у"],
];
const RU_SINGLE: Record<string, string> = {
  a: "а", b: "б", c: "к", d: "д", e: "е", f: "ф", g: "г", h: "х", i: "и", j: "дж", k: "к", l: "л", m: "м",
  n: "н", o: "о", p: "п", q: "к", r: "р", s: "с", t: "т", u: "у", v: "в", w: "в", x: "кс", y: "й", z: "з",
};

function toCyrillic(word: string): string {
  const lower = word.toLowerCase();
  let out = "";
  for (let i = 0; i < lower.length; ) {
    const multi = RU_MULTI.find(([lat]) => lower.startsWith(lat, i));
    if (multi) {
      out += multi[1];
      i += multi[0].length;
      continue;
    }
    const ch = lower[i];
    const next = lower[i + 1] ?? "";
    // "c" sounds like "s" before e, i, y (Cisco -> Сиско), "k" elsewhere.
    if (ch === "c" && /[eiy]/.test(next)) out += "с";
    // "y" between consonants or at the end is a vowel.
    else if (ch === "y" && i > 0 && !/[aeiou]/.test(next)) out += "и";
    else out += RU_SINGLE[ch] ?? ch;
    i += 1;
  }
  // Keep the capital letter the name was written with.
  return word[0] === word[0].toUpperCase() ? out.charAt(0).toUpperCase() + out.slice(1) : out;
}

/* ─── Japanese / Chinese: syllables ──────────────────────────────────── */

interface Syllable {
  /** Consonant part in romaji ("", "k", "sh", "ch", ...). */
  c: string;
  /** Vowel ("a" | "i" | "u" | "e" | "o"), or "" for a consonant on its own. */
  v: string;
  /** Long vowel (Taboola: the "oo"). */
  long?: boolean;
}

/** English spelling -> romaji-like syllables ("Taboola" -> ta bu: la). */
function toSyllables(word: string): Syllable[] {
  let s = word.toLowerCase();
  s = s
    .replace(/ph/g, "f")
    .replace(/ck/g, "k")
    .replace(/qu/g, "kw")
    .replace(/q/g, "k")
    .replace(/x/g, "ks")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/ch/g, "\u0001") // keep "ch" while plain c -> k
    .replace(/c/g, "k")
    .replace(/\u0001/g, "ch")
    .replace(/th/g, "s")
    .replace(/l/g, "r")
    .replace(/v/g, "b");
  const out: Syllable[] = [];
  const isVowel = (ch: string) => "aeiou".includes(ch);
  let i = 0;
  while (i < s.length) {
    let c = "";
    for (const cluster of ["sh", "ch", "ts"]) {
      if (s.startsWith(cluster, i)) {
        c = cluster;
        break;
      }
    }
    if (!c && !isVowel(s[i]) && s[i] !== "y") c = s[i];
    if (!c && s[i] === "y" && i + 1 < s.length && isVowel(s[i + 1])) c = "y";
    i += c.length;
    let v = "";
    let long = false;
    if (i < s.length && (isVowel(s[i]) || s[i] === "y")) {
      const ch = s[i] === "y" ? "i" : s[i];
      const pair = s.slice(i, i + 2);
      if (pair === "oo") { v = "u"; long = true; i += 2; }
      else if (pair === "ee") { v = "i"; long = true; i += 2; }
      else if (pair === "ea") { v = "i"; long = true; i += 2; }
      else if (pair === "ou") { v = "a"; i += 2; }
      else { v = ch; i += 1; }
    }
    if (!c && !v) {
      i += 1;
      continue;
    }
    out.push({ c, v, long });
  }
  return out;
}

const KANA: Record<string, string[]> = {
  // a     i     u     e     o
  "": ["ア", "イ", "ウ", "エ", "オ"],
  k: ["カ", "キ", "ク", "ケ", "コ"],
  g: ["ガ", "ギ", "グ", "ゲ", "ゴ"],
  s: ["サ", "シ", "ス", "セ", "ソ"],
  z: ["ザ", "ジ", "ズ", "ゼ", "ゾ"],
  t: ["タ", "ティ", "トゥ", "テ", "ト"],
  d: ["ダ", "ディ", "ドゥ", "デ", "ド"],
  n: ["ナ", "ニ", "ヌ", "ネ", "ノ"],
  h: ["ハ", "ヒ", "フ", "ヘ", "ホ"],
  b: ["バ", "ビ", "ブ", "ベ", "ボ"],
  p: ["パ", "ピ", "プ", "ペ", "ポ"],
  m: ["マ", "ミ", "ム", "メ", "モ"],
  y: ["ヤ", "イ", "ユ", "イェ", "ヨ"],
  r: ["ラ", "リ", "ル", "レ", "ロ"],
  w: ["ワ", "ウィ", "ウ", "ウェ", "ウォ"],
  f: ["ファ", "フィ", "フ", "フェ", "フォ"],
  j: ["ジャ", "ジ", "ジュ", "ジェ", "ジョ"],
  sh: ["シャ", "シ", "シュ", "シェ", "ショ"],
  ch: ["チャ", "チ", "チュ", "チェ", "チョ"],
  ts: ["ツァ", "ツィ", "ツ", "ツェ", "ツォ"],
};
/** A consonant with no vowel after it (Crug: the final "g"). */
const KANA_BARE: Record<string, string> = {
  k: "ク", g: "グ", s: "ス", z: "ズ", t: "ト", d: "ド", n: "ン", h: "フ", b: "ブ", p: "プ", m: "ム",
  y: "イ", r: "ル", w: "ウ", f: "フ", j: "ジ", sh: "シュ", ch: "チ", ts: "ツ",
};

const HANZI: Record<string, string[]> = {
  // a     i     u     e     o
  "": ["阿", "伊", "乌", "埃", "奥"],
  k: ["卡", "基", "库", "克", "科"],
  g: ["加", "吉", "古", "格", "戈"],
  s: ["萨", "西", "苏", "塞", "索"],
  z: ["扎", "齐", "祖", "泽", "佐"],
  t: ["塔", "蒂", "图", "特", "托"],
  d: ["达", "迪", "杜", "德", "多"],
  n: ["纳", "尼", "努", "内", "诺"],
  h: ["哈", "希", "胡", "赫", "霍"],
  b: ["巴", "比", "布", "贝", "博"],
  p: ["帕", "皮", "普", "佩", "波"],
  m: ["马", "米", "穆", "梅", "莫"],
  y: ["亚", "伊", "尤", "耶", "约"],
  r: ["拉", "里", "鲁", "雷", "罗"],
  w: ["瓦", "维", "武", "韦", "沃"],
  f: ["法", "菲", "富", "费", "福"],
  j: ["贾", "吉", "朱", "杰", "乔"],
  sh: ["沙", "希", "舒", "谢", "肖"],
  ch: ["查", "奇", "丘", "切", "乔"],
  ts: ["察", "齐", "楚", "策", "措"],
};
const HANZI_BARE: Record<string, string> = {
  k: "克", g: "格", s: "斯", z: "兹", t: "特", d: "德", n: "恩", h: "赫", b: "布", p: "普", m: "姆",
  y: "伊", r: "尔", w: "乌", f: "夫", j: "吉", sh: "什", ch: "奇", ts: "茨",
};

const VOWEL_INDEX: Record<string, number> = { a: 0, i: 1, u: 2, e: 3, o: 4 };

function syllablesToScript(syllables: Syllable[], locale: "ja" | "zh"): string {
  const full = locale === "ja" ? KANA : HANZI;
  const bare = locale === "ja" ? KANA_BARE : HANZI_BARE;
  return syllables
    .map((s) => {
      if (!s.v) return bare[s.c] ?? "";
      const row = full[s.c] ?? full[""];
      const ch = row[VOWEL_INDEX[s.v] ?? 0];
      return locale === "ja" && s.long ? `${ch}ー` : ch;
    })
    .join("");
}

/* ─── letter names for codes and acronyms ────────────────────────────── */

const LETTER_NAMES: Record<NameLocale, Record<string, string>> = {
  ru: {
    A: "А", B: "Б", C: "С", D: "Д", E: "Е", F: "Ф", G: "Г", H: "Х", I: "И", J: "Дж", K: "К", L: "Л", M: "М",
    N: "Н", O: "О", P: "П", Q: "К", R: "Р", S: "С", T: "Т", U: "У", V: "В", W: "В", X: "Кс", Y: "Й", Z: "З",
  },
  ja: {
    A: "エー", B: "ビー", C: "シー", D: "ディー", E: "イー", F: "エフ", G: "ジー", H: "エイチ", I: "アイ",
    J: "ジェー", K: "ケー", L: "エル", M: "エム", N: "エヌ", O: "オー", P: "ピー", Q: "キュー", R: "アール",
    S: "エス", T: "ティー", U: "ユー", V: "ブイ", W: "ダブリュー", X: "エックス", Y: "ワイ", Z: "ゼット",
  },
  zh: {
    A: "埃", B: "比", C: "西", D: "迪", E: "伊", F: "艾夫", G: "吉", H: "艾奇", I: "艾", J: "杰", K: "凯",
    L: "艾尔", M: "艾姆", N: "恩", O: "欧", P: "皮", Q: "丘", R: "阿尔", S: "艾斯", T: "提", U: "尤",
    V: "维", W: "达布留", X: "艾克斯", Y: "瓦伊", Z: "泽德",
  },
};
