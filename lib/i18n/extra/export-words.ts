/** CH-533: the last words a call-log file could still carry in English. */
import type { ExtraTranslations } from "./types";

export const exportWords: ExtraTranslations = {
  en: {
    "x533.status.voicemail": "Voicemail",
    "x533.status.initiated": "Initiated",
    "x533.status.queued": "Queued",
    "x533.status.canceled": "Canceled",
    "x533.reason.callerAbandoned": "Caller Abandoned",
  },
  ru: {
    "x533.status.voicemail": "Голосовая почта",
    "x533.status.initiated": "Инициирован",
    "x533.status.queued": "В очереди",
    "x533.status.canceled": "Отменён",
    "x533.reason.callerAbandoned": "Абонент положил трубку",
  },
  ja: {
    "x533.status.voicemail": "留守番電話",
    "x533.status.initiated": "発信開始",
    "x533.status.queued": "待機中",
    "x533.status.canceled": "キャンセル",
    "x533.reason.callerAbandoned": "発信者が切断",
  },
  zh: {
    "x533.status.voicemail": "语音信箱",
    "x533.status.initiated": "已发起",
    "x533.status.queued": "排队中",
    "x533.status.canceled": "已取消",
    "x533.reason.callerAbandoned": "来电者放弃",
  },
};
