/** CH-355 Avortyx Guard: the banner that tells admins a server update is waiting for its restart. */
import type { ExtraTranslations } from "./types";

export const serverUpdate: ExtraTranslations = {
  en: {
    "x355.pending": "Server update waiting for the quiet-time restart: {list}. Features from these changes work after the restart.",
    "x355.old": "The server is running older code than this portal needs ({need}). New features work after the quiet-time restart.",
    "x355.dismiss": "Hide until next visit",
  },
  ru: {
    "x355.pending": "Обновление сервера ждёт перезапуска в спокойное время: {list}. Новые функции заработают после перезапуска.",
    "x355.old": "На сервере работает более старый код, чем нужен этому порталу ({need}). Новые функции заработают после перезапуска в спокойное время.",
    "x355.dismiss": "Скрыть до следующего входа",
  },
  ja: {
    "x355.pending": "サーバー更新が閑散時の再起動待ちです: {list}。これらの変更の機能は再起動後に使えます。",
    "x355.old": "サーバーはこのポータルが必要とするより古いコードで動いています（{need}）。新機能は閑散時の再起動後に使えます。",
    "x355.dismiss": "次回まで非表示",
  },
  zh: {
    "x355.pending": "服务器更新正在等待空闲时重启：{list}。这些更改的功能在重启后生效。",
    "x355.old": "服务器运行的代码比此门户所需的旧（{need}）。新功能在空闲时重启后生效。",
    "x355.dismiss": "下次访问前隐藏",
  },
};
