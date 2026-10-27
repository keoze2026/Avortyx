/** TFN test calls in the reports, caller ID "Test" (CH-313). */
import type { ExtraTranslations } from "./types";

export const tfnTestReport: ExtraTranslations = {
  en: {
    "toolsUI.reports.callLog.failReason.notConnected": "Not Connected",
    "toolsUI.reports.callLog.failReason.tfnTest": "TFN Test",
    "toolsUI.reports.callLog.failReason.tfnTestFailed": "TFN Test failed: {why}",
    "tfnCheck.test.inReports": "It also shows in Reports, with caller ID \"Test\".",
  },
  ru: {
    "toolsUI.reports.callLog.failReason.notConnected": "Не соединён",
    "toolsUI.reports.callLog.failReason.tfnTest": "Тест бесплатного номера",
    "toolsUI.reports.callLog.failReason.tfnTestFailed": "Тест бесплатного номера не пройден: {why}",
    "tfnCheck.test.inReports": "Он также виден в отчётах, номер звонящего «Test».",
  },
  ja: {
    "toolsUI.reports.callLog.failReason.notConnected": "未接続",
    "toolsUI.reports.callLog.failReason.tfnTest": "フリーダイヤル テスト",
    "toolsUI.reports.callLog.failReason.tfnTestFailed": "フリーダイヤル テスト失敗：{why}",
    "tfnCheck.test.inReports": "レポートにも発信者番号「Test」として表示されます。",
  },
  zh: {
    "toolsUI.reports.callLog.failReason.notConnected": "未接通",
    "toolsUI.reports.callLog.failReason.tfnTest": "免费号码测试",
    "toolsUI.reports.callLog.failReason.tfnTestFailed": "免费号码测试失败：{why}",
    "tfnCheck.test.inReports": "它也会显示在报表中，来电号码为“Test”。",
  },
};
