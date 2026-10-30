/**
 * Routing texts.
 *  - nav.advancedRouting: kept for older links.
 *  - settings.rail.advancedRouting.*: Settings -> Advanced Routing, the
 *    rule-based plan editor that moved there from the Routing page.
 */
import type { ExtraTranslations } from "./types";

export const routing: ExtraTranslations = {
  en: {
    "nav.advancedRouting": "Advanced Routing",
    "settings.rail.advancedRouting.label": "Advanced Routing",
    "settings.rail.advancedRouting.description": "Rule-based routing plans",
    "settings.rail.advancedRouting.eyebrow": "Call flows",
    "settings.rail.advancedRouting.intro":
      "Plans with conditions: time of day, caller location, caller ID, tags, overflow. For everyday setup (a campaign and the TFN its calls ring), use Routing in the menu.",
    "settings.rail.advancedRouting.simpleLink": "Open Simple Routing",
  },
  ru: {
    "nav.advancedRouting": "Расширенная маршрутизация",
    "settings.rail.advancedRouting.label": "Расширенная маршрутизация",
    "settings.rail.advancedRouting.description": "Планы маршрутизации с правилами",
    "settings.rail.advancedRouting.eyebrow": "Потоки звонков",
    "settings.rail.advancedRouting.intro":
      "Планы с условиями: время, местоположение звонящего, номер звонящего, теги, перелив. Для обычной настройки (кампания и TFN, на который идут звонки) используйте «Маршрутизация» в меню.",
    "settings.rail.advancedRouting.simpleLink": "Открыть простую маршрутизацию",
  },
  ja: {
    "nav.advancedRouting": "高度なルーティング",
    "settings.rail.advancedRouting.label": "高度なルーティング",
    "settings.rail.advancedRouting.description": "ルールベースのルーティングプラン",
    "settings.rail.advancedRouting.eyebrow": "コールフロー",
    "settings.rail.advancedRouting.intro":
      "条件付きプラン：時間帯、発信者の地域、発信者番号、タグ、オーバーフロー。通常の設定（キャンペーンと着信先 TFN）はメニューの「ルーティング」を使用してください。",
    "settings.rail.advancedRouting.simpleLink": "シンプルなルーティングを開く",
  },
  zh: {
    "nav.advancedRouting": "高级路由",
    "settings.rail.advancedRouting.label": "高级路由",
    "settings.rail.advancedRouting.description": "基于规则的路由方案",
    "settings.rail.advancedRouting.eyebrow": "呼叫流程",
    "settings.rail.advancedRouting.intro":
      "带条件的方案：时间、来电地区、来电号码、标签、溢出。日常设置（活动及其来电转接的 TFN）请使用菜单中的「路由」。",
    "settings.rail.advancedRouting.simpleLink": "打开简单路由",
  },
};
