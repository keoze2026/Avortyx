/** "TFNs deleted" notice (Sir, 21 Oct): stays in the bell menu until 12 PM Eastern (CH-182). */
import type { ExtraTranslations } from "./types";

export const deletedTfns: ExtraTranslations = {
  en: {
    "deletedTfns.title": "{count} TFNs Expired",
    "deletedTfnsOne.title": "1 TFN Expired",
    "deletedTfns.body": "Please add new TFNs to continue routing calls.",
    "deletedTfns.more": "and {count} more",
    "deletedTfns.seen": "Seen",
    "deletedTfns.until": "Shown here until 12 PM Eastern.",
    "deletedTfns.addTfns": "Add TFNs",
    "deletedTfns.seenFailed": "Couldn't save. Please try again.",
  },
  ru: {
    "deletedTfns.title": "Истекло бесплатных номеров: {count}",
    "deletedTfnsOne.title": "Истёк 1 бесплатный номер",
    "deletedTfns.body": "Добавьте новые бесплатные номера, чтобы продолжить маршрутизацию звонков.",
    "deletedTfns.more": "и ещё {count}",
    "deletedTfns.seen": "Просмотрено",
    "deletedTfns.until": "Показываются здесь до 12:00 по восточному времени.",
    "deletedTfns.addTfns": "Добавить TFN",
    "deletedTfns.seenFailed": "Не удалось сохранить. Попробуйте ещё раз.",
  },
  ja: {
    "deletedTfns.title": "{count} 件のフリーダイヤル番号の期限が切れました",
    "deletedTfnsOne.title": "1 件のフリーダイヤル番号の期限が切れました",
    "deletedTfns.body": "通話のルーティングを続けるには、新しいフリーダイヤル番号を追加してください。",
    "deletedTfns.more": "他 {count} 件",
    "deletedTfns.seen": "確認済み",
    "deletedTfns.until": "米国東部時間の正午までここに表示されます。",
    "deletedTfns.addTfns": "TFN を追加",
    "deletedTfns.seenFailed": "保存できませんでした。もう一度お試しください。",
  },
  zh: {
    "deletedTfns.title": "{count} 个免费号码已过期",
    "deletedTfnsOne.title": "1 个免费号码已过期",
    "deletedTfns.body": "请添加新的免费号码以继续路由通话。",
    "deletedTfns.more": "还有 {count} 个",
    "deletedTfns.seen": "已查看",
    "deletedTfns.until": "将在此显示至美国东部时间中午 12 点。",
    "deletedTfns.addTfns": "添加 TFN",
    "deletedTfns.seenFailed": "无法保存，请重试。",
  },
};
