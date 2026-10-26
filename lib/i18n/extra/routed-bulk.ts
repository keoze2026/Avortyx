/** Bulk select on a campaign's Routed Destinations (CH-273, Sir 24 Oct). */
import type { ExtraTranslations } from "./types";

export const routedBulk: ExtraTranslations = {
  en: {
    "routedBulk.entity": "destinations",
    "routedBulk.selectAll": "Select all destinations on this page",
    "routedBulk.selectRow": "Select {name}",
    "routedBulk.activated": "Switched on {count} destinations",
    "routedBulk.paused": "Switched off {count} destinations",
    "routedBulk.detached": "Removed {count} destinations from this campaign",
  },
  ru: {
    "routedBulk.entity": "назначения",
    "routedBulk.selectAll": "Выбрать все назначения на этой странице",
    "routedBulk.selectRow": "Выбрать {name}",
    "routedBulk.activated": "Включено назначений: {count}",
    "routedBulk.paused": "Выключено назначений: {count}",
    "routedBulk.detached": "Удалено из кампании назначений: {count}",
  },
  ja: {
    "routedBulk.entity": "転送先",
    "routedBulk.selectAll": "このページの転送先をすべて選択",
    "routedBulk.selectRow": "{name} を選択",
    "routedBulk.activated": "{count} 件の転送先をオンにしました",
    "routedBulk.paused": "{count} 件の転送先をオフにしました",
    "routedBulk.detached": "{count} 件の転送先をこのキャンペーンから外しました",
  },
  zh: {
    "routedBulk.entity": "目的地",
    "routedBulk.selectAll": "选择本页所有目的地",
    "routedBulk.selectRow": "选择 {name}",
    "routedBulk.activated": "已开启 {count} 个目的地",
    "routedBulk.paused": "已关闭 {count} 个目的地",
    "routedBulk.detached": "已从此活动移除 {count} 个目的地",
  },
};
