/** CH-334: Carrier Costs - the portal's own date picker, company profit for any days, routing cost per call. */
import type { ExtraTranslations } from "./types";

export const profitPeriod: ExtraTranslations = {
  en: {
    "datePicker.today": "Today",
    "datePicker.prevMonth": "Previous month",
    "datePicker.nextMonth": "Next month",
    "routingCost.aht": "Average Call",
    "routingCost.perCall": "Cost per Call",
    "routingCost.howCounted":
      "{minutes} minutes x {rate} a minute = {cost}. Every call we forwarded to a buyer, counted as in the reports; each call's seconds rounded as set under Edit rate. An estimate to check the carrier's invoice against; the monthly fee is billed separately.",
    "owner.profit.loadFailed": "Couldn't load the company profit. Try again.",
    "owner.profit.notePeriod":
      "What customer workspaces were charged in these days (call minutes include recording and VoIP Shield on answered calls), minus the carriers' bill for them. Our own portal's charges to itself are not counted.",
    "owner.profit.noteDays":
      "What customer workspaces were charged in these days (call minutes include recording and VoIP Shield on answered calls), minus the carriers' bill for them: minutes as they happened, monthly fees by the day (1/31 of the month for a day of October). Our own portal's charges to itself are not counted.",
  },
  ru: {
    "datePicker.today": "Сегодня",
    "datePicker.prevMonth": "Предыдущий месяц",
    "datePicker.nextMonth": "Следующий месяц",
    "routingCost.aht": "Средний звонок",
    "routingCost.perCall": "Стоимость звонка",
    "routingCost.howCounted":
      "{minutes} мин. x {rate} за минуту = {cost}. Каждый звонок, переданный покупателю, считается так же, как в отчётах; секунды каждого звонка округляются, как задано в «Изменить тариф». Оценка для сверки со счётом оператора; ежемесячная плата начисляется отдельно.",
    "owner.profit.loadFailed": "Не удалось загрузить прибыль компании. Попробуйте ещё раз.",
    "owner.profit.notePeriod":
      "Сколько начислено клиентским пространствам за эти дни (минуты звонков включают запись и VoIP Shield по отвеченным звонкам) минус счёт операторов за них. Начисления нашего портала самому себе не учитываются.",
    "owner.profit.noteDays":
      "Сколько начислено клиентским пространствам за эти дни (минуты звонков включают запись и VoIP Shield по отвеченным звонкам) минус счёт операторов за них: минуты — как были, ежемесячные платы — по дням (1/31 месяца за день октября). Начисления нашего портала самому себе не учитываются.",
  },
  ja: {
    "datePicker.today": "今日",
    "datePicker.prevMonth": "前月",
    "datePicker.nextMonth": "翌月",
    "routingCost.aht": "平均通話",
    "routingCost.perCall": "1 通話あたり",
    "routingCost.howCounted":
      "{minutes} 分 x 1 分 {rate} = {cost}。バイヤーに転送したすべての通話を、レポートと同じ方法で数えます。各通話の秒数は「料金を編集」の設定どおりに丸めます。キャリアの請求書と照合するための見積もりで、月額料金は別に請求されます。",
    "owner.profit.loadFailed": "会社の利益を読み込めませんでした。もう一度お試しください。",
    "owner.profit.notePeriod":
      "この期間に顧客ワークスペースに請求した額（通話分数には応答した通話の録音と VoIP Shield を含む）から、その期間のキャリア請求額を差し引いたものです。当社ポータル自身への請求は含みません。",
    "owner.profit.noteDays":
      "この期間に顧客ワークスペースに請求した額（通話分数には応答した通話の録音と VoIP Shield を含む）から、その期間のキャリア請求額を差し引いたものです。分数は実際のとおり、月額料金は日割り（10 月の 1 日は月額の 1/31）です。当社ポータル自身への請求は含みません。",
  },
  zh: {
    "datePicker.today": "今天",
    "datePicker.prevMonth": "上个月",
    "datePicker.nextMonth": "下个月",
    "routingCost.aht": "平均通话",
    "routingCost.perCall": "每通费用",
    "routingCost.howCounted":
      "{minutes} 分钟 x 每分钟 {rate} = {cost}。我们转给买家的每通电话，按报表的方式计数；每通电话的秒数按“编辑费率”中的设置取整。这是用于核对运营商账单的估算；月费另行计费。",
    "owner.profit.loadFailed": "无法加载公司利润，请重试。",
    "owner.profit.notePeriod":
      "这些天向客户工作区收取的费用（通话分钟包括已接听通话的录音和 VoIP Shield），减去这些天的运营商账单。我们门户向自身的收费不计入。",
    "owner.profit.noteDays":
      "这些天向客户工作区收取的费用（通话分钟包括已接听通话的录音和 VoIP Shield），减去这些天的运营商账单：分钟按实际发生计算，月费按天分摊（十月的一天为月费的 1/31）。我们门户向自身的收费不计入。",
  },
};
