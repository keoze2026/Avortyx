/** CH-358: TFN Check "Not Taking Calls" - live, but routing would refuse a call right now. */
import type { ExtraTranslations } from "./types";

export const tfnNotReady: ExtraTranslations = {
  en: {
    "tfnCheck.status.not_ready": "Not Taking Calls",
    "tfnCheck.legend.not_ready": "Live, but a call would not go through right now (for example no buyer is open).",
    "tfnCheck.detail.not_ready": "This number is live, but a call to it would not go through right now.",
    "x358.why.balance": "The account balance is too low for one call.",
    "x358.why.noBuyer": "No buyer line is open right now (all off, outside their hours, or at their cap).",
    "x358.why.cap": "The campaign is at its limit right now.",
  },
  ru: {
    "tfnCheck.status.not_ready": "Не принимает звонки",
    "tfnCheck.legend.not_ready": "Номер активен, но звонок сейчас не пройдёт (например, нет открытого покупателя).",
    "tfnCheck.detail.not_ready": "Номер активен, но звонок на него сейчас не пройдёт.",
    "x358.why.balance": "Баланса аккаунта не хватает на один звонок.",
    "x358.why.noBuyer": "Сейчас нет открытой линии покупателя (все выключены, вне часов работы или на лимите).",
    "x358.why.cap": "Кампания сейчас на своём лимите.",
  },
  ja: {
    "tfnCheck.status.not_ready": "着信不可",
    "tfnCheck.legend.not_ready": "番号は有効ですが、現在は通話がつながりません（例：受付中のバイヤーがいない）。",
    "tfnCheck.detail.not_ready": "この番号は有効ですが、現在この番号への通話はつながりません。",
    "x358.why.balance": "アカウント残高が1通話分に足りません。",
    "x358.why.noBuyer": "現在受付中のバイヤー回線がありません（すべてオフ、営業時間外、または上限到達）。",
    "x358.why.cap": "キャンペーンが現在上限に達しています。",
  },
  zh: {
    "tfnCheck.status.not_ready": "暂不接听",
    "tfnCheck.legend.not_ready": "号码有效，但当前来电无法接通（例如没有开放的买家）。",
    "tfnCheck.detail.not_ready": "该号码有效，但当前拨打此号码无法接通。",
    "x358.why.balance": "账户余额不足以支付一次通话。",
    "x358.why.noBuyer": "当前没有开放的买家线路（全部关闭、不在营业时间或已达上限）。",
    "x358.why.cap": "活动当前已达上限。",
  },
};
