/** Bulk Play / Pause on the Destinations page: what to say when some are refused. */
import type { ExtraTranslations } from "./types";

export const bulk: ExtraTranslations = {
  en: {
    "bulk.destinations.playPartial": "{ok} of {total} played. {failed} couldn't be turned on:",
    "bulk.destinations.pausePartial": "{ok} of {total} paused. {failed} couldn't be paused:",
  },
  ru: {
    "bulk.destinations.playPartial": "Запущено {ok} из {total}. Не удалось включить: {failed}.",
    "bulk.destinations.pausePartial": "Приостановлено {ok} из {total}. Не удалось приостановить: {failed}.",
  },
  ja: {
    "bulk.destinations.playPartial": "{total} 件中 {ok} 件を再生しました。{failed} 件はオンにできませんでした：",
    "bulk.destinations.pausePartial": "{total} 件中 {ok} 件を一時停止しました。{failed} 件は一時停止できませんでした：",
  },
  zh: {
    "bulk.destinations.playPartial": "已启用 {ok}/{total}。有 {failed} 个无法启用：",
    "bulk.destinations.pausePartial": "已暂停 {ok}/{total}。有 {failed} 个无法暂停：",
  },
};