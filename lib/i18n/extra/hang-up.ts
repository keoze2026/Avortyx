/** Hang Up column from the real dial result (CH-278, Sir 26 Oct). */
import type { ExtraTranslations } from "./types";

export const hangUp: ExtraTranslations = {
  en: {
    "hangUp.noAnswer": "No answer",
    "hangUp.busy": "Buyer busy",
  },
  ru: {
    "hangUp.noAnswer": "Без ответа",
    "hangUp.busy": "Покупатель занят",
  },
  ja: {
    "hangUp.noAnswer": "応答なし",
    "hangUp.busy": "バイヤー話し中",
  },
  zh: {
    "hangUp.noAnswer": "无人接听",
    "hangUp.busy": "买家忙线",
  },
};
