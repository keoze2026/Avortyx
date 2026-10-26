/** Hang Up column from the real dial result (CH-278, Sir 26 Oct). */
import type { ExtraTranslations } from "./types";

export const hangUp: ExtraTranslations = {
  en: {
    "hangUp.noAnswer": "No Answer",
    "hangUp.busy": "Destination Busy",
  },
  ru: {
    "hangUp.noAnswer": "Без ответа",
    "hangUp.busy": "Направление занято",
  },
  ja: {
    "hangUp.noAnswer": "応答なし",
    "hangUp.busy": "転送先が話し中",
  },
  zh: {
    "hangUp.noAnswer": "无人接听",
    "hangUp.busy": "目的地忙线",
  },
};
