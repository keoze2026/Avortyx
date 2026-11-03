/** Buyers: the daily Buyer Cap typed in place (CH-487, 3 Nov). */
import type { ExtraTranslations } from "./types";

export const buyerCapEdit: ExtraTranslations = {
  en: {
    "x487.edit": "Click to change the daily buyer cap (0 = no cap)",
    "x487.input": "Daily buyer cap (0 = no cap)",
    "x487.saved": "{name}: daily cap set to {cap}",
    "x487.error": "The cap was not saved. Please try again.",
  },
  ru: {
    "x487.edit": "Нажмите, чтобы изменить дневной лимит покупателя (0 = без лимита)",
    "x487.input": "Дневной лимит покупателя (0 = без лимита)",
    "x487.saved": "{name}: дневной лимит — {cap}",
    "x487.error": "Лимит не сохранён. Попробуйте ещё раз.",
  },
  ja: {
    "x487.edit": "クリックしてバイヤーの1日上限を変更（0 = 上限なし）",
    "x487.input": "バイヤーの1日上限（0 = 上限なし）",
    "x487.saved": "{name}：1日上限を {cap} に設定しました",
    "x487.error": "上限を保存できませんでした。もう一度お試しください。",
  },
  zh: {
    "x487.edit": "点击修改买家每日上限（0 = 不限）",
    "x487.input": "买家每日上限（0 = 不限）",
    "x487.saved": "{name}：每日上限已设为 {cap}",
    "x487.error": "上限未保存，请重试。",
  },
};
