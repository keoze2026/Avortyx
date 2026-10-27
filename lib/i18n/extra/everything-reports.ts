/** CH-318 (ZDFRS, 27 Oct): "everything ... translated to the language the user selected". */
import type { ExtraTranslations } from "./types";

export const everythingReports: ExtraTranslations = {
  en: {
    "x318.reports.updating": "Updating…",
    "x318.reports.compass.n": "N",
    "x318.reports.compass.e": "E",
    "x318.reports.compass.s": "S",
    "x318.reports.compass.w": "W",
  },
  ru: {
    "x318.reports.updating": "Обновление…",
    "x318.reports.compass.n": "С",
    "x318.reports.compass.e": "В",
    "x318.reports.compass.s": "Ю",
    "x318.reports.compass.w": "З",
    // Existing keys that still showed English words / acronyms in this area.
    "toolsUI.insights.pageTitle": "ИИ-аналитика",
    "autoReports.feature.email": "Сводки по электронной почте",
    "y.call.lineType.VoIP": "IP-телефония",
    "x5.autopilot.rules.alertOnNoCalls.desc": "Отправлять письмо администраторам, если в рабочее время (с 8:00 до 21:00 по восточному времени США) звонков нет {n} ч.",
    "x5.autopilot.rules.alertOnNoCalls.descOne": "Отправлять письмо администраторам, если в рабочее время (с 8:00 до 21:00 по восточному времени США) звонков нет {n} ч.",
  },
  ja: {
    "x318.reports.updating": "更新中…",
    "x318.reports.compass.n": "北",
    "x318.reports.compass.e": "東",
    "x318.reports.compass.s": "南",
    "x318.reports.compass.w": "西",
    "toolsUI.insights.pageTitle": "人工知能インサイト",
    "y.call.lineType.VoIP": "IP電話",
    "x5.autopilot.rules.alertOnNoCalls.desc": "営業時間中（米国東部時間 8 時〜21 時）に {n} 時間通話がない場合、管理者にメールします。",
    "x5.autopilot.rules.alertOnNoCalls.descOne": "営業時間中（米国東部時間 8 時〜21 時）に {n} 時間通話がない場合、管理者にメールします。",
  },
  zh: {
    "x318.reports.updating": "正在更新…",
    "x318.reports.compass.n": "北",
    "x318.reports.compass.e": "东",
    "x318.reports.compass.s": "南",
    "x318.reports.compass.w": "西",
    "toolsUI.insights.pageTitle": "人工智能洞察",
    "dashboard.topCampaigns": "热门营销活动",
    "toolsUI.insights.autopilot.toastEnabled": "自动运行规则已启用",
    "toolsUI.insights.autopilot.toastDisabled": "自动运行规则已禁用",
    "x5.autopilot.rules.alertOnNoCalls.desc": "在工作时间（美国东部时间早 8 点至晚 9 点）内连续 {n} 小时没有来电时，给管理员发送邮件。",
    "x5.autopilot.rules.alertOnNoCalls.descOne": "在工作时间（美国东部时间早 8 点至晚 9 点）内连续 {n} 小时没有来电时，给管理员发送邮件。",
  },
};
