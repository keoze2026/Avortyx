/** CH-563: Destinations - Refresh, and a pause / resume from someone else not undone by a click. */
import type { ExtraTranslations } from "./types";

export const destinationsRefresh: ExtraTranslations = {
  en: {
    "x563.refresh": "Refresh",
    "x563.refreshed": "Destinations updated",
    "x563.justPaused": "{name} was just paused by someone else - nothing changed. Click again if you want it on.",
    "x563.justResumed": "{name} was just switched on by someone else - nothing changed. Click again if you want it paused.",
  },
  ru: {
    "x563.refresh": "Обновить",
    "x563.refreshed": "Получатели обновлены",
    "x563.justPaused": "{name} только что поставил на паузу кто-то другой - ничего не изменено. Нажмите ещё раз, если нужно включить.",
    "x563.justResumed": "{name} только что включил кто-то другой - ничего не изменено. Нажмите ещё раз, если нужна пауза.",
  },
  ja: {
    "x563.refresh": "更新",
    "x563.refreshed": "宛先を更新しました",
    "x563.justPaused": "{name} は他の人が一時停止したところです - 何も変更していません。オンにするにはもう一度クリックしてください。",
    "x563.justResumed": "{name} は他の人がオンにしたところです - 何も変更していません。一時停止するにはもう一度クリックしてください。",
  },
  zh: {
    "x563.refresh": "刷新",
    "x563.refreshed": "目的地已更新",
    "x563.justPaused": "{name} 刚被其他人暂停 - 未做任何更改。如需开启请再点一次。",
    "x563.justResumed": "{name} 刚被其他人开启 - 未做任何更改。如需暂停请再点一次。",
  },
};
