/** CH-360: carrier watch - "Working" needs proof from the last hour; a carrier that stops delivering. */
import type { ExtraTranslations } from "./types";

export const carrierWatch: ExtraTranslations = {
  en: {
    "tfnCheck.legend.working": "Live, and a call, a test call or the carrier check reached us in the last hour.",
    "tfnCheck.legend.active": "Live, but nothing has proven it in the last hour.",
    "tfnCheck.legend.not_working": "Live, but calls are not reaching us (a test call failed, or its carrier stopped delivering).",
    "x360.detail.carrierDown": "Calls to this number are not reaching us right now.",
    "x360.detail.carrierOk": "The carrier delivered a test call {ago}.",
    "x360.detail.activeHour": "Active, no calls in the last hour.",
    "x360.detail.activeOld": "Active. Last call {ago}; not proven in the last hour.",
  },
  ru: {
    "tfnCheck.legend.working": "Активен, и за последний час до нас дошёл звонок, тестовый звонок или проверка оператора.",
    "tfnCheck.legend.active": "Активен, но за последний час это ничем не подтверждено.",
    "tfnCheck.legend.not_working": "Активен, но звонки до нас не доходят (тестовый звонок не прошёл или оператор перестал их доставлять).",
    "x360.detail.carrierDown": "Звонки на этот номер сейчас до нас не доходят.",
    "x360.detail.carrierOk": "Оператор доставил тестовый звонок {ago}.",
    "x360.detail.activeHour": "Активен, за последний час звонков не было.",
    "x360.detail.activeOld": "Активен. Последний звонок {ago}; за последний час не подтверждён.",
  },
  ja: {
    "tfnCheck.legend.working": "有効で、過去1時間に着信・テストコール・キャリア確認のいずれかが届いています。",
    "tfnCheck.legend.active": "有効ですが、過去1時間に確認できていません。",
    "tfnCheck.legend.not_working": "有効ですが、着信が届いていません（テストコール失敗、またはキャリアが配信を停止）。",
    "x360.detail.carrierDown": "現在、この番号への着信は届いていません。",
    "x360.detail.carrierOk": "キャリアが{ago}にテストコールを配信しました。",
    "x360.detail.activeHour": "有効。過去1時間に着信はありません。",
    "x360.detail.activeOld": "有効。最後の着信は{ago}。過去1時間は未確認です。",
  },
  zh: {
    "tfnCheck.legend.working": "在用，且过去 1 小时内有来电、测试电话或运营商检查到达我们。",
    "tfnCheck.legend.active": "在用，但过去 1 小时内没有任何证明。",
    "tfnCheck.legend.not_working": "在用，但来电未到达我们（测试电话失败，或其运营商已停止送达）。",
    "x360.detail.carrierDown": "目前拨打此号码的来电无法到达我们。",
    "x360.detail.carrierOk": "运营商在{ago}送达了一次测试电话。",
    "x360.detail.activeHour": "有效，过去 1 小时内没有来电。",
    "x360.detail.activeOld": "有效。最后一次来电在{ago}；过去 1 小时未得到证明。",
  },
};
