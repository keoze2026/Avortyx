import { COUNTRIES } from "@/lib/countries";
import { uiLocaleTag } from "@/lib/format";

const CODE_BY_NAME = new Map(COUNTRIES.map((c) => [c.name.toLowerCase(), c.code]));
const NAMES = new Map<string, Intl.DisplayNames | null>();

/**
 * A country (stored as its English name, e.g. "United States", or as its
 * ISO code, e.g. "US") in the language chosen in the app: "Соединённые
 * Штаты", "アメリカ合衆国", "美国" (CH-318). Display only - the stored value
 * stays English. English keeps the value exactly as stored.
 */
export function countryLabel(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return raw;
  const tag = uiLocaleTag();
  if (tag === "en-US") return raw;
  const code = /^[A-Za-z]{2}$/.test(raw) ? raw.toUpperCase() : CODE_BY_NAME.get(raw.toLowerCase());
  if (!code) return raw;
  let names = NAMES.get(tag);
  if (names === undefined) {
    try {
      names = new Intl.DisplayNames([tag], { type: "region" });
    } catch {
      names = null;
    }
    NAMES.set(tag, names);
  }
  const shown = names?.of(code);
  return shown && shown !== code ? shown : raw;
}
