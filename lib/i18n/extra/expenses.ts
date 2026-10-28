/** CH-336: Carrier Costs - the day's expenses, line by line. */
import type { ExtraTranslations } from "./types";

export const expenses: ExtraTranslations = {
  en: {
    "expenses.title": "Expenses",
    "expenses.tfn": "TFN cost",
    "expenses.tfnDetail": "{count} TFNs, monthly fee by the day",
    "expenses.carrierMinutes": "{carrier} minutes",
    "expenses.minutesDetail": "{minutes} min x {rate}",
    "expenses.monthly": "Monthly charges",
    "expenses.byTheDay": "monthly fee by the day",
    "expenses.routing": "Routing minutes ({route})",
    "expenses.routingFee": "Routing monthly fee",
    "expenses.total": "Total expense",
    "expenses.noCarrier":
      "{numbers} TFNs with no carrier had {calls} calls ({minutes} min). They have no rate, so they are not in the total: give them a carrier below.",
    "expenses.note":
      "What our carriers charge us for these days: minutes as they happened, monthly fees by the day (1/31 of the month for a day of October). The total is the company profit's carrier costs.",
    "expenses.loadFailed": "Couldn't load the expenses. Try again.",
  },
  ru: {
    "expenses.title": "Расходы",
    "expenses.tfn": "Стоимость номеров",
    "expenses.tfnDetail": "{count} номеров, месячная плата по дням",
    "expenses.carrierMinutes": "Минуты {carrier}",
    "expenses.minutesDetail": "{minutes} мин. x {rate}",
    "expenses.monthly": "Ежемесячные платежи",
    "expenses.byTheDay": "месячная плата по дням",
    "expenses.routing": "Минуты маршрутизации ({route})",
    "expenses.routingFee": "Ежемесячная плата за маршрутизацию",
    "expenses.total": "Итого расходов",
    "expenses.noCarrier":
      "У {numbers} номеров без оператора было {calls} звонков ({minutes} мин.). У них нет тарифа, поэтому они не входят в итог: назначьте им оператора ниже.",
    "expenses.note":
      "Сколько операторы берут с нас за эти дни: минуты — как были, месячные платы — по дням (1/31 месяца за день октября). Итог равен расходам на операторов в прибыли компании.",
    "expenses.loadFailed": "Не удалось загрузить расходы. Попробуйте ещё раз.",
  },
  ja: {
    "expenses.title": "経費",
    "expenses.tfn": "番号の費用",
    "expenses.tfnDetail": "{count} 番号、月額料金を日割り",
    "expenses.carrierMinutes": "{carrier} の通話分数",
    "expenses.minutesDetail": "{minutes} 分 x {rate}",
    "expenses.monthly": "月額料金",
    "expenses.byTheDay": "月額料金を日割り",
    "expenses.routing": "ルーティング分数（{route}）",
    "expenses.routingFee": "ルーティング月額料金",
    "expenses.total": "経費合計",
    "expenses.noCarrier":
      "キャリア未設定の {numbers} 番号に {calls} 件の通話（{minutes} 分）がありました。料金がないため合計に含まれません。下でキャリアを設定してください。",
    "expenses.note":
      "この期間にキャリアから請求される額です。分数は実際のとおり、月額料金は日割り（10 月の 1 日は月額の 1/31）です。合計は会社の利益のキャリア費用と同じです。",
    "expenses.loadFailed": "経費を読み込めませんでした。もう一度お試しください。",
  },
  zh: {
    "expenses.title": "支出",
    "expenses.tfn": "号码费用",
    "expenses.tfnDetail": "{count} 个号码，月费按天分摊",
    "expenses.carrierMinutes": "{carrier} 分钟",
    "expenses.minutesDetail": "{minutes} 分钟 x {rate}",
    "expenses.monthly": "月度费用",
    "expenses.byTheDay": "月费按天分摊",
    "expenses.routing": "路由分钟（{route}）",
    "expenses.routingFee": "路由月费",
    "expenses.total": "支出合计",
    "expenses.noCarrier":
      "{numbers} 个未设置运营商的号码有 {calls} 通电话（{minutes} 分钟）。它们没有费率，因此不计入合计：请在下方为其设置运营商。",
    "expenses.note":
      "这些天运营商向我们收取的费用：分钟按实际发生计算，月费按天分摊（十月的一天为月费的 1/31）。合计等于公司利润中的运营商成本。",
    "expenses.loadFailed": "无法加载支出，请重试。",
  },
};
