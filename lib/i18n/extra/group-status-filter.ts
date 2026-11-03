/** Campaign group: Active / Paused filters and bulk Activate (CH-479, Sir 3 Nov). */
import type { ExtraTranslations } from "./types";

export const groupStatusFilter: ExtraTranslations = {
  en: {
    "x479.fActive": "Active",
    "x479.fPaused": "Paused",
    "x479.activate": "Activate",
    "x479.activatedN": "{n} destinations activated",
    "x479.activateFailed": "{n} could not be activated",
  },
  ru: {
    "x479.fActive": "Активные",
    "x479.fPaused": "На паузе",
    "x479.activate": "Включить",
    "x479.activatedN": "Включено: {n}",
    "x479.activateFailed": "Не удалось включить: {n}",
  },
  ja: {
    "x479.fActive": "有効",
    "x479.fPaused": "一時停止中",
    "x479.activate": "有効にする",
    "x479.activatedN": "{n}件を有効にしました",
    "x479.activateFailed": "{n}件を有効にできませんでした",
  },
  zh: {
    "x479.fActive": "启用中",
    "x479.fPaused": "已暂停",
    "x479.activate": "启用",
    "x479.activatedN": "已启用 {n} 个目的地",
    "x479.activateFailed": "{n} 个无法启用",
  },
};
