/** Bulk Play / Pause on the Destinations page: what to say when some are refused. */
import type { ExtraTranslations } from "./types";

export const bulk: ExtraTranslations = {
  en: {
    "bulk.destinations.switchedOff": "Switched off to make room (one live destination per buyer / number): {names}",
    "bulk.destinations.skipped": "Not played - another selected destination of the same buyer or number went live: {names}",
    "bulk.destinations.playPartial": "{ok} of {total} played. {failed} couldn't be turned on:",
    "bulk.destinations.pausePartial": "{ok} of {total} paused. {failed} couldn't be paused:",
  },
  ru: {
    "bulk.destinations.switchedOff": "Выключены, чтобы освободить место (одно активное назначение на покупателя / номер): {names}",
    "bulk.destinations.skipped": "Не запущены — активным стало другое выбранное назначение того же покупателя или номера: {names}",
    "bulk.destinations.playPartial": "Запущено {ok} из {total}. Не удалось включить: {failed}.",
    "bulk.destinations.pausePartial": "Приостановлено {ok} из {total}. Не удалось приостановить: {failed}.",
  },
  ja: {
    "bulk.destinations.switchedOff": "切り替えのためオフにしました（バイヤー／番号ごとにライブは1件）：{names}",
    "bulk.destinations.skipped": "再生されませんでした — 同じバイヤーまたは番号の別の選択済み転送先がライブになりました：{names}",
    "bulk.destinations.playPartial": "{total} 件中 {ok} 件を再生しました。{failed} 件はオンにできませんでした：",
    "bulk.destinations.pausePartial": "{total} 件中 {ok} 件を一時停止しました。{failed} 件は一時停止できませんでした：",
  },
  zh: {
    "bulk.destinations.switchedOff": "已关闭以腾出位置（每个买家/号码仅一个实时目标）：{names}",
    "bulk.destinations.skipped": "未启用——同一买家或号码的另一个已选目标已上线：{names}",
    "bulk.destinations.playPartial": "已启用 {ok}/{total}。有 {failed} 个无法启用：",
    "bulk.destinations.pausePartial": "已暂停 {ok}/{total}。有 {failed} 个无法暂停：",
  },
};