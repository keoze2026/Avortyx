/** Campaign > Destinations: search (CH-489) and lines missing from the Destinations page (CH-493), 3 Nov. */
import type { ExtraTranslations } from "./types";

export const campaignDestSearch: ExtraTranslations = {
  en: { "x493.orphan": "Not on Destinations page", "x493.orphanHint": "No line for this buyer and number on the Destinations page, so it has no switch or limits. Routing can still send calls to it - add it on Destinations, or remove it from the campaign.", "x489.search": "Search buyer or TFN...", "x489.noMatch": "No destination matches the search." },
  ru: { "x493.orphan": "Нет на странице направлений", "x493.orphanHint": "Для этого покупателя и номера нет строки на странице направлений, поэтому нет переключателя и лимитов. Маршрутизация всё ещё может отправлять на него звонки - добавьте его в направления или уберите из кампании.", "x489.search": "Поиск покупателя или TFN...", "x489.noMatch": "Нет направлений по этому запросу." },
  ja: { "x493.orphan": "転送先ページにありません", "x493.orphanHint": "このバイヤーと番号の行が転送先ページにないため、スイッチも上限もありません。ルーティングは引き続き通話を送る可能性があります。転送先に追加するか、キャンペーンから外してください。", "x489.search": "バイヤーまたはTFNを検索...", "x489.noMatch": "検索に一致する転送先はありません。" },
  zh: { "x493.orphan": "不在目的地页面", "x493.orphanHint": "目的地页面没有该买家和号码的条目，因此没有开关和限制。路由仍可能把通话发到这里——请在目的地页面添加，或从广告系列中移除。", "x489.search": "搜索买家或 TFN...", "x489.noMatch": "没有符合搜索的目的地。" },
};
