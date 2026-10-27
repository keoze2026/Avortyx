/** CH-332: the Add Numbers list says it shows only numbers not in any campaign (Sir, 28 Oct). */
import type { ExtraTranslations } from "./types";

export const attachUnassigned: ExtraTranslations = {
  en: {
    "x332.attach.onlyUnassigned": "Only numbers that are not in any campaign are listed. A number already in a campaign must be removed there first.",
    "x332.attach.countUnassigned": "{shown} of {total} unassigned",
  },
  ru: {
    "x332.attach.onlyUnassigned": "Показаны только номера, не привязанные ни к одной кампании. Номер из другой кампании сначала нужно убрать оттуда.",
    "x332.attach.countUnassigned": "Свободно {shown} из {total}",
  },
  ja: {
    "x332.attach.onlyUnassigned": "どのキャンペーンにも割り当てられていない番号のみ表示しています。他のキャンペーンの番号は、先にそちらから外してください。",
    "x332.attach.countUnassigned": "未割り当て {total} 件中 {shown} 件",
  },
  zh: {
    "x332.attach.onlyUnassigned": "仅列出未分配给任何广告系列的号码。已在其他广告系列中的号码，需先从那里移除。",
    "x332.attach.countUnassigned": "未分配 {shown} / {total}",
  },
};
