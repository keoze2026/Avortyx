/** Bulk select on a campaign's Tracking Numbers (Sir, 21 Oct: check boxes to work in bulk, like Revo). */
import type { ExtraTranslations } from "./types";

export const campaignNumbers: ExtraTranslations = {
  en: {
    "common.bulk.detachAria": "Detach {count} selected {entity} from this campaign",
    "campaignNumbers.bulk.entity": "tracking numbers",
    "campaignNumbers.bulk.selectAll": "Select all tracking numbers",
    "campaignNumbers.bulk.selectRow": "Select {number}",
    "campaignNumbers.bulk.activated": "Activated {count} tracking numbers",
    "campaignNumbers.bulk.paused": "Paused {count} tracking numbers",
    "campaignNumbers.bulk.detached": "Detached {count} tracking numbers from this campaign",
    "campaignNumbers.bulk.partial": "{ok} of {total} done. {failed} couldn't be changed and are still selected.",
  },
  ru: {
    "common.bulk.detachAria": "Отвязать {count} выбранных ({entity}) от этой кампании",
    "campaignNumbers.bulk.entity": "номера отслеживания",
    "campaignNumbers.bulk.selectAll": "Выбрать все номера отслеживания",
    "campaignNumbers.bulk.selectRow": "Выбрать {number}",
    "campaignNumbers.bulk.activated": "Включено номеров: {count}",
    "campaignNumbers.bulk.paused": "Приостановлено номеров: {count}",
    "campaignNumbers.bulk.detached": "Отвязано от кампании номеров: {count}",
    "campaignNumbers.bulk.partial": "Выполнено {ok} из {total}. {failed} не удалось изменить, они остались выбранными.",
  },
  ja: {
    "common.bulk.detachAria": "選択した {count} 件の{entity}をこのキャンペーンから外す",
    "campaignNumbers.bulk.entity": "トラッキング番号",
    "campaignNumbers.bulk.selectAll": "すべてのトラッキング番号を選択",
    "campaignNumbers.bulk.selectRow": "{number} を選択",
    "campaignNumbers.bulk.activated": "{count} 件のトラッキング番号を有効にしました",
    "campaignNumbers.bulk.paused": "{count} 件のトラッキング番号を一時停止しました",
    "campaignNumbers.bulk.detached": "{count} 件のトラッキング番号をこのキャンペーンから外しました",
    "campaignNumbers.bulk.partial": "{total} 件中 {ok} 件完了。{failed} 件は変更できず、選択されたままです。",
  },
  zh: {
    "common.bulk.detachAria": "将所选 {count} 个{entity}从此活动中移除",
    "campaignNumbers.bulk.entity": "跟踪号码",
    "campaignNumbers.bulk.selectAll": "选择全部跟踪号码",
    "campaignNumbers.bulk.selectRow": "选择 {number}",
    "campaignNumbers.bulk.activated": "已启用 {count} 个跟踪号码",
    "campaignNumbers.bulk.paused": "已暂停 {count} 个跟踪号码",
    "campaignNumbers.bulk.detached": "已从此活动移除 {count} 个跟踪号码",
    "campaignNumbers.bulk.partial": "已完成 {ok}/{total}。{failed} 个无法更改，仍保持选中。",
  },
};
