/** Buyers: delete asks first (CH-484, Sir 3 Nov). Cancel / Confirm reuse cdel.*. */
import type { ExtraTranslations } from "./types";

export const buyerDelete: ExtraTranslations = {
  en: {
    "bdel.title": "Delete this buyer?",
    "bdel.titleMany": "Delete {count} buyers?",
    "bdel.desc": "Are You Sure You Want to Delete {name}?",
    "bdel.descMany": "Are You Sure You Want to Delete These Buyers?",
  },
  ru: {
    "bdel.title": "Удалить этого покупателя?",
    "bdel.titleMany": "Удалить покупателей: {count}?",
    "bdel.desc": "Вы уверены, что хотите удалить {name}?",
    "bdel.descMany": "Вы уверены, что хотите удалить этих покупателей?",
  },
  ja: {
    "bdel.title": "このバイヤーを削除しますか？",
    "bdel.titleMany": "{count}件のバイヤーを削除しますか？",
    "bdel.desc": "{name} を削除してもよろしいですか？",
    "bdel.descMany": "これらのバイヤーを削除してもよろしいですか？",
  },
  zh: {
    "bdel.title": "删除此买家？",
    "bdel.titleMany": "删除 {count} 个买家？",
    "bdel.desc": "确定要删除 {name} 吗？",
    "bdel.descMany": "确定要删除这些买家吗？",
  },
};
