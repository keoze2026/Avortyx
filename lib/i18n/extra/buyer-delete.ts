/** Buyers (CH-484) and Destinations (CH-488): delete asks first. Cancel / Confirm reuse cdel.*. */
import type { ExtraTranslations } from "./types";

export const buyerDelete: ExtraTranslations = {
  en: {
    "ddel.title": "Delete this destination?",
    "ddel.titleMany": "Delete {count} destinations?",
    "ddel.desc": "Are You Sure You Want to Delete {name}?",
    "ddel.descMany": "Are You Sure You Want to Delete These Destinations?",
    "bdel.title": "Delete this buyer?",
    "bdel.titleMany": "Delete {count} buyers?",
    "bdel.desc": "Are You Sure You Want to Delete {name}?",
    "bdel.descMany": "Are You Sure You Want to Delete These Buyers?",
  },
  ru: {
    "ddel.title": "Удалить это направление?",
    "ddel.titleMany": "Удалить направления: {count}?",
    "ddel.desc": "Вы уверены, что хотите удалить {name}?",
    "ddel.descMany": "Вы уверены, что хотите удалить эти направления?",
    "bdel.title": "Удалить этого покупателя?",
    "bdel.titleMany": "Удалить покупателей: {count}?",
    "bdel.desc": "Вы уверены, что хотите удалить {name}?",
    "bdel.descMany": "Вы уверены, что хотите удалить этих покупателей?",
  },
  ja: {
    "ddel.title": "この転送先を削除しますか？",
    "ddel.titleMany": "{count}件の転送先を削除しますか？",
    "ddel.desc": "{name} を削除してもよろしいですか？",
    "ddel.descMany": "これらの転送先を削除してもよろしいですか？",
    "bdel.title": "このバイヤーを削除しますか？",
    "bdel.titleMany": "{count}件のバイヤーを削除しますか？",
    "bdel.desc": "{name} を削除してもよろしいですか？",
    "bdel.descMany": "これらのバイヤーを削除してもよろしいですか？",
  },
  zh: {
    "ddel.title": "删除此目的地？",
    "ddel.titleMany": "删除 {count} 个目的地？",
    "ddel.desc": "确定要删除 {name} 吗？",
    "ddel.descMany": "确定要删除这些目的地吗？",
    "bdel.title": "删除此买家？",
    "bdel.titleMany": "删除 {count} 个买家？",
    "bdel.desc": "确定要删除 {name} 吗？",
    "bdel.descMany": "确定要删除这些买家吗？",
  },
};
