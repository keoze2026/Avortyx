/** CH-532: the staff-only Voice column of the Call Log (backend CH-531). */
import type { ExtraTranslations } from "./types";

export const voiceCheck: ExtraTranslations = {
  en: {
    "x531.voice": "Voice",
    "x531.noVoice": "No voice",
    "x531.hasVoice": "Voice",
    "x531.missing": "No file",
    "x531.unchecked": "Not checked yet",
    "x531.tip": "Seconds of speech heard in the recording (checked on our server). Team only - buyers and publishers never see this.",
  },
  ru: {
    "x531.voice": "Голос",
    "x531.noVoice": "Нет голоса",
    "x531.hasVoice": "Голос",
    "x531.missing": "Нет файла",
    "x531.unchecked": "Ещё не проверен",
    "x531.tip": "Секунды речи в записи (проверка на нашем сервере). Только для команды - покупатели и паблишеры этого не видят.",
  },
  ja: {
    "x531.voice": "音声",
    "x531.noVoice": "音声なし",
    "x531.hasVoice": "音声あり",
    "x531.missing": "ファイルなし",
    "x531.unchecked": "未確認",
    "x531.tip": "録音内で検出された発話の秒数（当社サーバーで確認）。チーム専用 - 購入者・パブリッシャーには表示されません。",
  },
  zh: {
    "x531.voice": "语音",
    "x531.noVoice": "无语音",
    "x531.hasVoice": "有语音",
    "x531.missing": "无文件",
    "x531.unchecked": "尚未检查",
    "x531.tip": "录音中检测到的讲话秒数（在我们的服务器上检查）。仅团队可见 - 买家和发布商看不到。",
  },
};
