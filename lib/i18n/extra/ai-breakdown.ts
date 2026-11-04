/** CH-557: No Voice per publisher / campaign / buyer on the AI Audit page. */
import type { ExtraTranslations } from "./types";

export const aiBreakdown: ExtraTranslations = {
  en: {
    "x557.title": "No Voice by Publisher, Campaign and Buyer",
    "x557.desc": "Calls the AI checked this day. No Voice % = No Voice calls ÷ calls checked; highest first.",
    "x557.by.publisher": "Publisher",
    "x557.by.campaign": "Campaign",
    "x557.by.buyer": "Buyer",
    "x557.checked": "Checked",
    "x557.none": "No calls checked this day.",
  },
  ru: {
    "x557.title": "Без голоса по паблишерам, кампаниям и покупателям",
    "x557.desc": "Звонки, проверенные ИИ за этот день. % без голоса = звонки без голоса ÷ проверенные; сначала самые высокие.",
    "x557.by.publisher": "Паблишер",
    "x557.by.campaign": "Кампания",
    "x557.by.buyer": "Покупатель",
    "x557.checked": "Проверено",
    "x557.none": "За этот день нет проверенных звонков.",
  },
  ja: {
    "x557.title": "パブリッシャー・キャンペーン・バイヤー別の音声なし",
    "x557.desc": "この日に AI がチェックした通話。音声なし % = 音声なし通話 ÷ チェック済み通話（高い順）。",
    "x557.by.publisher": "パブリッシャー",
    "x557.by.campaign": "キャンペーン",
    "x557.by.buyer": "バイヤー",
    "x557.checked": "チェック済み",
    "x557.none": "この日にチェックされた通話はありません。",
  },
  zh: {
    "x557.title": "按发布商、活动和买家统计的无语音",
    "x557.desc": "当天 AI 检查过的通话。无语音 % = 无语音通话 ÷ 已检查通话;从高到低。",
    "x557.by.publisher": "发布商",
    "x557.by.campaign": "活动",
    "x557.by.buyer": "买家",
    "x557.checked": "已检查",
    "x557.none": "当天没有已检查的通话。",
  },
};
