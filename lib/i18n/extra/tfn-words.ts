/**
 * TFN in full words for Russian, Japanese and Chinese (CH-307, Sir 27 Oct:
 * "TFN isn't changing their language"). Same words as acronyms.ts:
 * бесплатный номер / フリーダイヤル番号 / 免费号码. English keeps "TFN".
 * Listed in OVERRIDE (extra/index.ts), so these win over the main dictionaries.
 */
import type { ExtraTranslations } from "./types";

export const tfnWords: ExtraTranslations = {
  en: {},
  ru: {
    // Menu: short enough to fit (CH-308); the page title keeps the full words.
    // "8-800" is how toll-free numbers are said in Russian; "Проверка номеров"
    // alone lost the "toll-free" and read like Phone Numbers ("Номера").
    "nav.tfnCheck": "Проверка 8-800",
    "tfnCheck.title": "Проверка бесплатных номеров",
    "tfnCheck.links.createBody": "Закрытая ссылка на страницу проверки бесплатных номеров. Вход для неё не нужен.",
    "x2.partnerPerm.tfnTest": "Тестовые звонки на бесплатные номера",
    "x2.partnerPerm.tfnTestDesc": "Может проверять свои бесплатные номера и делать на них тестовые звонки в разделе «Проверка бесплатных номеров».",
    "deletedTfns.replace": "Добавьте бесплатные номера на замену, чтобы звонки продолжали маршрутизироваться без перерыва.",
    "deletedTfnsOne.replace": "Добавьте бесплатный номер на замену, чтобы звонки продолжали маршрутизироваться без перерыва.",
    "owner.profit.tfn": "Покупка бесплатных номеров",
    "owner.costs.sum.tfnFees": "Плата за бесплатные номера",
    "owner.costs.sum.monthlyCharges": "Ежемесячная плата операторам бесплатных номеров",
    "owner.costs.sum.inboundMinutes": "Минуты бесплатных номеров",
    "owner.costs.sum.note": "Все операторы бесплатных номеров плюс переадресация звонков покупателям ({routing}) за {month} по восточному времени.",
    "owner.costs.warn.noNumberFee": "У {carrier} бесплатных номеров: {numbers}, но плата за номер не задана, поэтому они считаются как $0. Укажите тарифы, если оператор её берёт.",
    "owner.costs.warn.noCarrier": "Бесплатных номеров без оператора: {numbers}, поэтому их расходы не учитываются. Назначьте их ниже.",
  },
  ja: {
    "nav.tfnCheck": "フリーダイヤル確認",
    "tfnCheck.title": "フリーダイヤル番号チェック",
    "tfnCheck.links.createBody": "フリーダイヤル番号チェックページへの非公開リンクです。利用にログインは不要です。",
    "x2.partnerPerm.tfnTest": "フリーダイヤル番号のテストコール",
    "x2.partnerPerm.tfnTestDesc": "フリーダイヤル番号チェックで自分のフリーダイヤル番号を確認し、テストコールできます。",
    "deletedTfns.replace": "通話を途切れなくルーティングするため、代わりのフリーダイヤル番号を追加してください。",
    "deletedTfnsOne.replace": "通話を途切れなくルーティングするため、代わりのフリーダイヤル番号を追加してください。",
    "owner.profit.tfn": "フリーダイヤル番号の購入",
    "owner.costs.sum.tfnFees": "フリーダイヤル番号の料金",
    "owner.costs.sum.monthlyCharges": "フリーダイヤル番号キャリアの月額料金",
    "owner.costs.sum.inboundMinutes": "フリーダイヤル番号の通話分数",
    "owner.costs.sum.note": "すべてのフリーダイヤル番号キャリアと、バイヤーへの転送通話（{routing}）の {month} 分（米国東部時間）。",
    "owner.costs.warn.noNumberFee": "{carrier} には {numbers} 件のフリーダイヤル番号がありますが番号料金が未設定のため、$0 として計算されます。料金がかかる場合は設定してください。",
    "owner.costs.warn.noCarrier": "{numbers} 件のフリーダイヤル番号にキャリアが設定されていないため、その費用は計上されません。下で割り当ててください。",
  },
  zh: {
    "nav.tfnCheck": "免费号码检查",
    "tfnCheck.title": "免费号码检查",
    "tfnCheck.links.createBody": "指向免费号码检查页面的私密链接。使用时无需登录。",
    "x2.partnerPerm.tfnTest": "免费号码测试电话",
    "x2.partnerPerm.tfnTestDesc": "可在免费号码检查中检查并测试拨打自己的免费号码。",
    "deletedTfns.replace": "请添加替换的免费号码，以保持通话路由不中断。",
    "deletedTfnsOne.replace": "请添加替换的免费号码，以保持通话路由不中断。",
    "owner.profit.tfn": "免费号码购买",
    "owner.costs.sum.tfnFees": "免费号码费用",
    "owner.costs.sum.monthlyCharges": "免费号码运营商月费",
    "owner.costs.sum.inboundMinutes": "免费号码分钟",
    "owner.costs.sum.note": "所有免费号码运营商加上转接给买家的路由通话（{routing}），{month}，美国东部时间。",
    "owner.costs.warn.noNumberFee": "{carrier} 有 {numbers} 个免费号码，但没有号码费用，因此按 $0 计算。如收费请设置其费率。",
    "owner.costs.warn.noCarrier": "{numbers} 个免费号码没有运营商，因此其费用未计入。请在下方分配。",
  },
};
