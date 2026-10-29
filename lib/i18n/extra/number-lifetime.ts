/** CH-369 Numbers > Lifetime: a number with an end date shows the days it has left. */
import type { ExtraTranslations } from "./types";

export const numberLifetime: ExtraTranslations = {
  en: {
    "x369.daysLeft": "{n}d left",
    "x369.endsOn": "Stops taking calls on {date}",
  },
  ru: {
    "x369.daysLeft": "осталось {n} д",
    "x369.endsOn": "Перестаёт принимать звонки {date}",
  },
  ja: {
    "x369.daysLeft": "残り{n}日",
    "x369.endsOn": "{date}に着信を停止します",
  },
  zh: {
    "x369.daysLeft": "剩余{n}天",
    "x369.endsOn": "将于{date}停止接听来电",
  },
};
