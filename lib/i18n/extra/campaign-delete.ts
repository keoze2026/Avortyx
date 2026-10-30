/** CH-331: "Are you sure?" before a campaign is deleted (Sir, 28 Oct). */
import type { ExtraTranslations } from "./types";

export const campaignDelete: ExtraTranslations = {
  en: {
    "cdel.title": "Delete this campaign?",
    "cdel.titleMany": "Delete {count} campaigns?",
    "cdel.desc": "Are You Sure You Want to Delete {name}?",
    "cdel.descMany": "Are You Sure You Want to Delete These Campaigns?",
    "cdel.confirm": "Confirm",
    "cdel.cancel": "Cancel",
  },
  ru: {
    "cdel.title": "Удалить эту кампанию?",
    "cdel.titleMany": "Удалить кампании: {count}?",
    "cdel.desc": "Вы уверены, что хотите удалить {name}?",
    "cdel.descMany": "Вы уверены, что хотите удалить эти кампании?",
    "cdel.confirm": "Подтвердить",
    "cdel.cancel": "Отмена",
  },
  ja: {
    "cdel.title": "このキャンペーンを削除しますか？",
    "cdel.titleMany": "{count} 件のキャンペーンを削除しますか？",
    "cdel.desc": "{name} を削除してもよろしいですか？",
    "cdel.descMany": "これらのキャンペーンを削除してもよろしいですか？",
    "cdel.confirm": "確認",
    "cdel.cancel": "キャンセル",
  },
  zh: {
    "cdel.title": "删除此广告系列？",
    "cdel.titleMany": "删除 {count} 个广告系列？",
    "cdel.desc": "确定要删除 {name} 吗？",
    "cdel.descMany": "确定要删除这些广告系列吗？",
    "cdel.confirm": "确认",
    "cdel.cancel": "取消",
  },
};
