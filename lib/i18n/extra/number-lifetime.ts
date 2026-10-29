/** CH-369 Numbers > Lifetime: a number with an end date shows the days it has left (as plain "30d", Sir 29 Oct). */
import type { ExtraTranslations } from "./types";

export const numberLifetime: ExtraTranslations = {
  en: {
    "x369.endsOn": "Stops taking calls on {date}",
  },
  ru: {
    "x369.endsOn": "Перестаёт принимать звонки {date}",
  },
  ja: {
    "x369.endsOn": "{date}に着信を停止します",
  },
  zh: {
    "x369.endsOn": "将于{date}停止接听来电",
  },
};
