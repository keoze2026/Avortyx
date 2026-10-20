/** "TFNs deleted" notice (Sir, 21 Oct): stays in the bell menu until the user clicks Seen. */
import type { ExtraTranslations } from "./types";

export const deletedTfns: ExtraTranslations = {
  en: {
    "deletedTfns.title": "{count} TFNs deleted",
    "deletedTfnsOne.title": "1 TFN deleted",
    "deletedTfns.body": "These TFNs are deleted. Use or add other TFNs.",
    "deletedTfns.more": "and {count} more",
    "deletedTfns.seen": "Seen",
    "deletedTfns.addTfns": "Add TFNs",
    "deletedTfns.seenFailed": "Couldn't save. Please try again.",
  },
  ru: {
    "deletedTfns.title": "Удалено TFN: {count}",
    "deletedTfnsOne.title": "Удалён 1 TFN",
    "deletedTfns.body": "Эти TFN удалены. Используйте или добавьте другие TFN.",
    "deletedTfns.more": "и ещё {count}",
    "deletedTfns.seen": "Просмотрено",
    "deletedTfns.addTfns": "Добавить TFN",
    "deletedTfns.seenFailed": "Не удалось сохранить. Попробуйте ещё раз.",
  },
  ja: {
    "deletedTfns.title": "{count} 件の TFN が削除されました",
    "deletedTfnsOne.title": "1 件の TFN が削除されました",
    "deletedTfns.body": "これらの TFN は削除されました。別の TFN を使用または追加してください。",
    "deletedTfns.more": "他 {count} 件",
    "deletedTfns.seen": "確認済み",
    "deletedTfns.addTfns": "TFN を追加",
    "deletedTfns.seenFailed": "保存できませんでした。もう一度お試しください。",
  },
  zh: {
    "deletedTfns.title": "已删除 {count} 个 TFN",
    "deletedTfnsOne.title": "已删除 1 个 TFN",
    "deletedTfns.body": "这些 TFN 已删除。请使用或添加其他 TFN。",
    "deletedTfns.more": "还有 {count} 个",
    "deletedTfns.seen": "已查看",
    "deletedTfns.addTfns": "添加 TFN",
    "deletedTfns.seenFailed": "无法保存，请重试。",
  },
};
