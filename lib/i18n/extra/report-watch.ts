/** CH-220: the Reports page keeps itself current and shows when it was last confirmed. */
import type { ExtraTranslations } from "./types";

export const reportWatch: ExtraTranslations = {
  en: {
    "toolsUI.reports.toolbar.updatedAt": "Updated {time}",
    "toolsUI.reports.toolbar.updatedHint":
      "Today's report updates by itself when a call arrives, is answered or ends, even with auto refresh off.",
  },
  ru: {
    "toolsUI.reports.toolbar.updatedAt": "Обновлено {time}",
    "toolsUI.reports.toolbar.updatedHint":
      "Отчёт за сегодня обновляется сам, когда звонок поступает, принимается или завершается, даже при выключенном автообновлении.",
  },
  ja: {
    "toolsUI.reports.toolbar.updatedAt": "更新 {time}",
    "toolsUI.reports.toolbar.updatedHint":
      "自動更新がオフでも、通話の着信・応答・終了時に今日のレポートは自動で更新されます。",
  },
  zh: {
    "toolsUI.reports.toolbar.updatedAt": "更新于 {time}",
    "toolsUI.reports.toolbar.updatedHint":
      "即使关闭自动刷新，今日报表也会在来电、接听或结束时自动更新。",
  },
};
