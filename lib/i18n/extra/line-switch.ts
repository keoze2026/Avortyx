/** Who switched a buyer line on or off (Sir, 22 Oct, CH-200). */
import type { ExtraTranslations } from "./types";

export const lineSwitch: ExtraTranslations = {
  en: {
    "lineSwitch.offBy": "Switched off by {name}, {when}",
    "lineSwitch.onBy": "Switched on by {name}, {when}",
    "lineSwitch.switchedOff": "Switched Off",
    "lineSwitch.switchedOn": "Switched On",
  },
  ru: {
    "lineSwitch.offBy": "Выключил(а) {name}, {when}",
    "lineSwitch.onBy": "Включил(а) {name}, {when}",
    "lineSwitch.switchedOff": "Выключено",
    "lineSwitch.switchedOn": "Включено",
  },
  ja: {
    "lineSwitch.offBy": "{name} がオフにしました（{when}）",
    "lineSwitch.onBy": "{name} がオンにしました（{when}）",
    "lineSwitch.switchedOff": "オフにした",
    "lineSwitch.switchedOn": "オンにした",
  },
  zh: {
    "lineSwitch.offBy": "{name} 于 {when} 关闭",
    "lineSwitch.onBy": "{name} 于 {when} 开启",
    "lineSwitch.switchedOff": "已关闭",
    "lineSwitch.switchedOn": "已开启",
  },
};
