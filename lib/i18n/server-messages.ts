/**
 * CH-427: messages the server writes (errors, confirmations, AI Insights,
 * alerts) in the chosen language.
 *
 * The server answers in English. Every message it can send to the portal is
 * listed here with its Russian, Japanese and Chinese text, so a toast such as
 * "Buyer not found" or an AI Insights card reads in the language picked in
 * the app. "{}" in the English text stands for a value the server fills in (a
 * name, a number); {0}, {1} ... put those values back in the translation.
 * A message not in this list is shown as the server sent it.
 *
 * (TFN Check details and report texts have their own helpers in
 * lib/i18n/server-text.ts.)
 */

import type { LocaleId } from "./locales";

type Row = [en: string, ru: string, ja: string, zh: string];

const ROWS: Row[] = [
  // ── Common answers ────────────────────────────────────────────────────
  ["Something went wrong", "Что-то пошло не так", "問題が発生しました", "出了点问题"],
  ["Something went wrong. Please try again.", "Что-то пошло не так. Попробуйте ещё раз.", "問題が発生しました。もう一度お試しください。", "出了点问题，请重试。"],
  ["Something went wrong on our end. Please try again in a moment.", "Ошибка на нашей стороне. Попробуйте ещё раз чуть позже.", "サーバー側で問題が発生しました。しばらくしてからもう一度お試しください。", "我们这边出了问题，请稍后重试。"],
  ["Something went wrong on our side. Quote this reference if you contact support.", "Ошибка на нашей стороне. Укажите этот номер, если обратитесь в поддержку.", "サーバー側で問題が発生しました。サポートへ連絡する際はこの参照番号をお伝えください。", "我们这边出了问题。联系客服时请提供此参考编号。"],
  ["Couldn't reach the server. Check your connection and try again.", "Не удалось связаться с сервером. Проверьте подключение и попробуйте ещё раз.", "サーバーに接続できません。接続を確認してもう一度お試しください。", "无法连接服务器。请检查网络后重试。"],
  ["Couldn't reach the server. Check your internet connection and try again.", "Не удалось связаться с сервером. Проверьте интернет и попробуйте ещё раз.", "サーバーに接続できません。インターネット接続を確認してもう一度お試しください。", "无法连接服务器。请检查网络连接后重试。"],
  ["Request couldn't be processed. Please double-check the values and try again.", "Запрос не обработан. Проверьте значения и попробуйте ещё раз.", "リクエストを処理できませんでした。入力値を確認してもう一度お試しください。", "请求无法处理。请检查填写的内容后重试。"],
  ["Your session has expired. Please sign in again.", "Сеанс истёк. Войдите снова.", "セッションの有効期限が切れました。もう一度サインインしてください。", "会话已过期，请重新登录。"],
  ["You don't have permission to do that.", "У вас нет прав на это действие.", "この操作を行う権限がありません。", "您没有执行此操作的权限。"],
  ["We couldn't find what you were looking for.", "Ничего не найдено.", "お探しのものが見つかりませんでした。", "未找到您要查找的内容。"],
  ["This action conflicts with the current state. Please refresh and try again.", "Действие конфликтует с текущим состоянием. Обновите страницу и попробуйте ещё раз.", "現在の状態と競合しています。ページを更新してもう一度お試しください。", "此操作与当前状态冲突。请刷新后重试。"],
  ["Some fields are missing or invalid. Please review and try again.", "Некоторые поля не заполнены или заполнены неверно. Проверьте и попробуйте ещё раз.", "未入力または不正な項目があります。確認してもう一度お試しください。", "部分字段缺失或无效。请检查后重试。"],
  ["This is locked. Enter the reports PIN on the Reports page to view it.", "Доступ закрыт. Введите PIN отчётов на странице «Отчёты».", "ロックされています。表示するにはレポートページでレポートPINを入力してください。", "已锁定。请在报告页面输入报告 PIN 查看。"],
  ["Too many requests — please wait a moment and try again.", "Слишком много запросов — подождите немного и попробуйте ещё раз.", "リクエストが多すぎます。少し待ってからもう一度お試しください。", "请求过多，请稍候再试。"],
  ["Invalid", "Неверное значение", "無効です", "无效"],
  ["Field required", "Обязательное поле", "必須項目です", "必填字段"],
  ["Not Found", "Не найдено", "見つかりません", "未找到"],
  ["Forbidden", "Доступ запрещён", "アクセスが拒否されました", "禁止访问"],
  ["Unauthorized", "Требуется вход", "認証が必要です", "未授权"],
  ["Updated", "Обновлено", "更新しました", "已更新"],

  // ── Sign in, password, account ────────────────────────────────────────
  ["Invalid email or password", "Неверный email или пароль", "メールアドレスまたはパスワードが正しくありません", "邮箱或密码错误"],
  ["Account is disabled. Please contact support", "Аккаунт отключён. Обратитесь в поддержку", "アカウントは無効化されています。サポートにお問い合わせください", "账户已停用，请联系客服"],
  ["Invalid MFA code", "Неверный код двухфакторной защиты", "二段階認証コードが正しくありません", "两步验证码错误"],
  ["Invalid MFA token", "Неверный токен двухфакторной защиты", "二段階認証トークンが無効です", "两步验证令牌无效"],
  ["Invalid or expired MFA session", "Сеанс двухфакторной защиты недействителен или истёк", "二段階認証のセッションが無効か期限切れです", "两步验证会话无效或已过期"],
  ["No MFA setup in progress", "Настройка двухфакторной защиты не начата", "二段階認証の設定は開始されていません", "未在进行两步验证设置"],
  ["No MFA challenge in progress.", "Проверка двухфакторной защиты не начата.", "二段階認証の確認は開始されていません。", "未在进行两步验证。"],
  ["Invalid or expired reset token", "Ссылка для сброса пароля недействительна или истекла", "リセット用リンクが無効か期限切れです", "重置链接无效或已过期"],
  ["Invalid refresh token", "Недействительный токен обновления", "更新トークンが無効です", "刷新令牌无效"],
  ["Invalid token", "Недействительный токен", "トークンが無効です", "令牌无效"],
  ["Token already used", "Ссылка уже использована", "このリンクは使用済みです", "链接已使用"],
  ["Token has expired", "Срок действия ссылки истёк", "リンクの有効期限が切れました", "链接已过期"],
  ["Token and password are required", "Нужны ссылка и пароль", "リンクとパスワードが必要です", "需要链接和密码"],
  ["Current password is incorrect", "Текущий пароль неверный", "現在のパスワードが正しくありません", "当前密码错误"],
  ["Password must be at least 8 characters", "Пароль должен быть не короче 8 символов", "パスワードは8文字以上にしてください", "密码至少需要 8 个字符"],
  ["Password must contain at least one lowercase letter", "Пароль должен содержать хотя бы одну строчную букву", "パスワードには小文字を1つ以上含めてください", "密码至少需要一个小写字母"],
  ["Password must contain at least one number", "Пароль должен содержать хотя бы одну цифру", "パスワードには数字を1つ以上含めてください", "密码至少需要一个数字"],
  ["Password must contain at least one uppercase letter", "Пароль должен содержать хотя бы одну заглавную букву", "パスワードには大文字を1つ以上含めてください", "密码至少需要一个大写字母"],
  ["Password changed successfully", "Пароль изменён", "パスワードを変更しました", "密码已修改"],
  ["Password reset successfully", "Пароль сброшен", "パスワードをリセットしました", "密码已重置"],
  ["If an account exists with that email, a reset link has been sent", "Если аккаунт с этим email существует, ссылка для сброса отправлена", "そのメールアドレスのアカウントが存在する場合、リセット用リンクを送信しました", "如果该邮箱对应的账户存在，重置链接已发送"],
  ["Too many attempts. Please wait 1 minute.", "Слишком много попыток. Подождите 1 минуту.", "試行回数が多すぎます。1分お待ちください。", "尝试次数过多，请等待 1 分钟。"],
  ["Too many login attempts. Please wait 1 minute.", "Слишком много попыток входа. Подождите 1 минуту.", "ログイン試行回数が多すぎます。1分お待ちください。", "登录尝试次数过多，请等待 1 分钟。"],
  ["Too many reset requests. Please wait 1 minute.", "Слишком много запросов на сброс. Подождите 1 минуту.", "リセットのリクエストが多すぎます。1分お待ちください。", "重置请求过多，请等待 1 分钟。"],
  ["Too many requests. Please try again later.", "Слишком много запросов. Попробуйте позже.", "リクエストが多すぎます。後でもう一度お試しください。", "请求过多，请稍后再试。"],
  ["Too many requests. Please wait a minute.", "Слишком много запросов. Подождите минуту.", "リクエストが多すぎます。1分お待ちください。", "请求过多，请等待一分钟。"],
  ["Email already registered", "Этот email уже зарегистрирован", "このメールアドレスは既に登録されています", "该邮箱已注册"],
  ["User with this email already exists", "Пользователь с таким email уже есть", "このメールアドレスのユーザーは既に存在します", "该邮箱的用户已存在"],
  ["Email is required", "Нужен email", "メールアドレスは必須です", "邮箱为必填项"],
  ["Valid email is required", "Нужен правильный email", "有効なメールアドレスが必要です", "需要有效的邮箱"],
  ["'{}' is not a valid email address", "«{0}» — неверный адрес email", "「{0}」は有効なメールアドレスではありません", "“{0}”不是有效的邮箱地址"],
  ["'{}' is not a valid email address.", "«{0}» — неверный адрес email.", "「{0}」は有効なメールアドレスではありません。", "“{0}”不是有效的邮箱地址。"],
  ["Name is required", "Нужно имя", "名前は必須です", "名称为必填项"],
  ["Message is required", "Нужно сообщение", "メッセージは必須です", "消息为必填项"],
  ["Message must be 5-4000 characters", "Сообщение должно быть от 5 до 4000 символов", "メッセージは5〜4000文字にしてください", "消息需为 5–4000 个字符"],
  ["Self-registration is closed. Request access instead.", "Самостоятельная регистрация закрыта. Отправьте запрос на доступ.", "セルフ登録は受け付けていません。アクセスをリクエストしてください。", "已关闭自助注册，请申请访问权限。"],
  ["This link has already been used", "Эта ссылка уже использована", "このリンクは使用済みです", "该链接已被使用"],
  ["This link has expired. Please request a new one.", "Срок действия ссылки истёк. Запросите новую.", "このリンクの有効期限が切れました。新しいリンクをリクエストしてください。", "该链接已过期，请重新申请。"],
  ["Already approved", "Уже одобрено", "承認済みです", "已批准"],
  ["Request approved", "Запрос одобрен", "リクエストを承認しました", "已批准申请"],
  ["Request rejected", "Запрос отклонён", "リクエストを却下しました", "已拒绝申请"],
  ["Request not found", "Запрос не найден", "リクエストが見つかりません", "未找到该申请"],
  ["Request was rejected. Cannot approve a rejected request.", "Запрос отклонён. Отклонённый запрос нельзя одобрить.", "このリクエストは却下済みです。却下したリクエストは承認できません。", "该申请已被拒绝，无法批准。"],
  ["Logged out successfully", "Вы вышли из аккаунта", "ログアウトしました", "已退出登录"],
  ["MFA disabled successfully", "Двухфакторная защита отключена", "二段階認証を無効にしました", "已关闭两步验证"],
  ["MFA enabled successfully", "Двухфакторная защита включена", "二段階認証を有効にしました", "已开启两步验证"],
  ["Avatar uploaded", "Аватар загружен", "アバターをアップロードしました", "头像已上传"],
  ["Invalid file type", "Недопустимый тип файла", "このファイル形式は使用できません", "文件类型无效"],
  ["Telegram unlinked", "Telegram отвязан", "Telegramの連携を解除しました", "已解除 Telegram 绑定"],
  ["Link your own Telegram first: Settings > Profile > Telegram.", "Сначала привяжите свой Telegram: Настройки > Профиль > Telegram.", "先にご自身のTelegramを連携してください：設定 > プロフィール > Telegram。", "请先绑定您自己的 Telegram：设置 > 个人资料 > Telegram。"],
  ["The server did not return a Telegram link.", "Сервер не прислал ссылку Telegram.", "サーバーからTelegramのリンクが返されませんでした。", "服务器未返回 Telegram 链接。"],
  ["Registration succeeded but the account already has MFA — unexpected. Please sign in directly.", "Регистрация прошла, но у аккаунта уже есть двухфакторная защита. Войдите напрямую.", "登録は完了しましたが、このアカウントには既に二段階認証が設定されています。直接サインインしてください。", "注册成功，但该账户已开启两步验证。请直接登录。"],

  // ── Team, roles, members ──────────────────────────────────────────────
  ["Member not found", "Участник не найден", "メンバーが見つかりません", "未找到该成员"],
  ["Member removed", "Участник удалён", "メンバーを削除しました", "已移除成员"],
  ["Cannot remove yourself", "Нельзя удалить самого себя", "自分自身は削除できません", "不能移除自己"],
  ["Role not found", "Роль не найдена", "ロールが見つかりません", "未找到该角色"],
  ["Built-in roles cannot be deleted.", "Встроенные роли нельзя удалить.", "組み込みロールは削除できません。", "内置角色不能删除。"],
  ["The Admin role is locked and cannot be edited.", "Роль администратора закрыта для изменений.", "管理者ロールはロックされており編集できません。", "管理员角色已锁定，无法编辑。"],
  ["{} member(s) still hold this role. Reassign them first.", "Эту роль ещё имеют участники: {0}. Сначала назначьте им другую.", "まだ {0} 人のメンバーがこのロールを持っています。先に別のロールを割り当ててください。", "仍有 {0} 名成员使用此角色。请先为他们重新分配角色。"],
  ["Unknown role {} for this workspace.", "Неизвестная роль {0} для этого рабочего пространства.", "このワークスペースに {0} というロールはありません。", "此工作区不存在角色 {0}。"],
  ["Your role ({}) cannot {}. Ask an admin of this workspace.", "Ваша роль ({0}) не может: {1}. Обратитесь к администратору.", "あなたのロール（{0}）では {1} できません。このワークスペースの管理者に依頼してください。", "您的角色（{0}）无法{1}。请联系此工作区的管理员。"],
  ["Your role doesn't have access to {} ({}).", "У вашей роли нет доступа: {0} ({1}).", "あなたのロールには {0}（{1}）へのアクセス権がありません。", "您的角色无权访问 {0}（{1}）。"],
  ["Only the main account of this workspace can see or manage API keys.", "Только главный аккаунт рабочего пространства видит и управляет API-ключами.", "APIキーを表示・管理できるのはこのワークスペースのメインアカウントのみです。", "只有此工作区的主账户可以查看或管理 API 密钥。"],
  ["API key not found", "API-ключ не найден", "APIキーが見つかりません", "未找到 API 密钥"],
  ["API key revoked", "API-ключ отозван", "APIキーを取り消しました", "API 密钥已撤销"],
  ["API key revoked successfully", "API-ключ отозван", "APIキーを取り消しました", "API 密钥已撤销"],
  ["Save this key — it will not be shown again", "Сохраните этот ключ — он больше не будет показан", "このキーを保存してください。再表示されません", "请保存此密钥，之后不会再显示"],
  ["For the team only.", "Только для команды.", "チーム専用です。", "仅限团队成员。"],
  ["Platform staff only.", "Только для сотрудников платформы.", "プラットフォームのスタッフ専用です。", "仅限平台工作人员。"],
  ["This area belongs to the system owner.", "Этот раздел доступен только владельцу системы.", "このエリアはシステムオーナー専用です。", "此区域仅限系统所有者。"],
  ["That account is a staff login and was not changed.", "Это аккаунт сотрудника, он не изменён.", "このアカウントはスタッフ用のため変更されていません。", "该账户为员工账户，未作更改。"],
  ["{} is not a member of this buyer.", "{0} не является участником этого покупателя.", "{0} はこのバイヤーのメンバーではありません。", "{0} 不是此买家的成员。"],
  ["{} is not a member of this publisher.", "{0} не является участником этого паблишера.", "{0} はこのパブリッシャーのメンバーではありません。", "{0} 不是此发布商的成员。"],
  ["{} already has an account.", "У {0} уже есть аккаунт.", "{0} は既にアカウントを持っています。", "{0} 已有账户。"],
  ["Only a buyer's own login has this switch.", "Этот переключатель есть только у собственного входа покупателя.", "このスイッチはバイヤー本人のログインにのみあります。", "只有买家本人的登录才有此开关。"],
  ["Only a buyer's own login has this.", "Это есть только у собственного входа покупателя.", "これはバイヤー本人のログインにのみあります。", "只有买家本人的登录才有此功能。"],
  ["Unknown time zone", "Неизвестный часовой пояс", "不明なタイムゾーンです", "未知时区"],
  ["Unknown time zone.", "Неизвестный часовой пояс.", "不明なタイムゾーンです。", "未知时区。"],
  ["Nothing to save.", "Нечего сохранять.", "保存する変更はありません。", "没有需要保存的内容。"],

  // ── Owner ─────────────────────────────────────────────────────────────
  ["Organization not found", "Организация не найдена", "組織が見つかりません", "未找到该组织"],
  ["An organization named '{}' already exists.", "Организация «{0}» уже существует.", "「{0}」という名前の組織は既に存在します。", "名为“{0}”的组织已存在。"],
  ["The organization needs a name.", "Укажите название организации.", "組織名を入力してください。", "请输入组织名称。"],
  ["The name you typed does not match this organization.", "Введённое название не совпадает с организацией.", "入力した名前がこの組織と一致しません。", "您输入的名称与该组织不符。"],
  ["This is your own workspace. It cannot be suspended.", "Это ваше собственное рабочее пространство, его нельзя приостановить.", "これはご自身のワークスペースのため、停止できません。", "这是您自己的工作区，无法暂停。"],
  ["A carrier needs both a name and a code.", "У оператора должны быть название и код.", "キャリアには名前とコードの両方が必要です。", "运营商需要名称和代码。"],
  ["Carrier not found", "Оператор не найден", "キャリアが見つかりません", "未找到该运营商"],
  ["Carrier not found.", "Оператор не найден.", "キャリアが見つかりません。", "未找到该运营商。"],
  ["The code {} is already used by another carrier.", "Код {0} уже используется другим оператором.", "コード {0} は別のキャリアで使用されています。", "代码 {0} 已被其他运营商使用。"],
  ["Carrier removed from {} number(s).", "Оператор убран с номеров: {0}.", "{0} 件の番号からキャリアを外しました。", "已从 {0} 个号码移除运营商。"],
  ["Pick at most {} days.", "Выберите не больше {0} дней.", "最大 {0} 日まで選択できます。", "最多选择 {0} 天。"],
  ["end must not be before start.", "Конец не может быть раньше начала.", "終了日は開始日より前にできません。", "结束日期不能早于开始日期。"],
  ["month must look like 2026-10.", "Месяц должен быть в формате 2026-10.", "月は 2026-10 の形式で入力してください。", "月份格式应为 2026-10。"],
  ["day must look like 2026-10-13", "День должен быть в формате 2026-10-13", "日付は 2026-10-13 の形式で入力してください", "日期格式应为 2026-10-13"],
  ["billing_increment must be 1, 6, 30 or 60 seconds.", "Шаг тарификации: 1, 6, 30 или 60 секунд.", "課金単位は 1、6、30、60 秒のいずれかにしてください。", "计费步长须为 1、6、30 或 60 秒。"],
  ["{} must be a number.", "{0}: нужно число.", "{0} は数値で入力してください。", "{0} 必须是数字。"],
  ["{} must be between 0 and 100000.", "{0}: значение от 0 до 100000.", "{0} は 0〜100000 の範囲で入力してください。", "{0} 必须在 0 到 100000 之间。"],
  ["{} must look like 2026-10-20.", "{0}: формат 2026-10-20.", "{0} は 2026-10-20 の形式で入力してください。", "{0} 格式应为 2026-10-20。"],
  ["`amount` must be greater than zero.", "Сумма должна быть больше нуля.", "金額は0より大きくしてください。", "金额必须大于零。"],
  ["`{}` cannot be negative.", "{0} не может быть отрицательным.", "{0} は負の値にできません。", "{0} 不能为负数。"],
  ["`{}` is not a number.", "{0} — не число.", "{0} は数値ではありません。", "{0} 不是数字。"],
  ["Risk must be high, low or left empty.", "Риск: высокий, низкий или пусто.", "リスクは「高」「低」または空欄にしてください。", "风险须为高、低或留空。"],

  // ── Buyers, publishers, destinations ──────────────────────────────────
  ["Buyer not found", "Покупатель не найден", "バイヤーが見つかりません", "未找到该买家"],
  ["Buyer not found or invalid buyer_id", "Покупатель не найден", "バイヤーが見つかりません", "未找到该买家"],
  ["Buyer is already active", "Покупатель уже активен", "バイヤーは既に有効です", "买家已处于启用状态"],
  ["Buyer is already paused", "Покупатель уже на паузе", "バイヤーは既に一時停止中です", "买家已暂停"],
  ["Buyer name must be at least 2 characters", "Имя покупателя — не короче 2 символов", "バイヤー名は2文字以上にしてください", "买家名称至少需要 2 个字符"],
  ["Buyer activated successfully", "Покупатель активирован", "バイヤーを有効にしました", "已启用买家"],
  ["Buyer paused successfully", "Покупатель поставлен на паузу", "バイヤーを一時停止しました", "已暂停买家"],
  ["Buyer archived successfully", "Покупатель архивирован", "バイヤーをアーカイブしました", "已归档买家"],
  ["Buyer removed from campaign successfully", "Покупатель убран из кампании", "バイヤーをキャンペーンから外しました", "已将买家从广告系列中移除"],
  ["A buyer called '{}' already exists in this workspace. Names have to be unique so reports can tell them apart.", "Покупатель «{0}» уже есть. Имена должны быть разными, чтобы отчёты их различали.", "「{0}」というバイヤーは既に存在します。レポートで区別できるよう、名前は重複できません。", "此工作区已有名为“{0}”的买家。名称必须唯一，以便报告区分。"],
  ["Publisher not found", "Паблишер не найден", "パブリッシャーが見つかりません", "未找到该发布商"],
  ["Publisher is already active", "Паблишер уже активен", "パブリッシャーは既に有効です", "发布商已处于启用状态"],
  ["Publisher is already paused", "Паблишер уже на паузе", "パブリッシャーは既に一時停止中です", "发布商已暂停"],
  ["Publisher name must be at least 2 characters", "Имя паблишера — не короче 2 символов", "パブリッシャー名は2文字以上にしてください", "发布商名称至少需要 2 个字符"],
  ["Publisher activated successfully", "Паблишер активирован", "パブリッシャーを有効にしました", "已启用发布商"],
  ["Publisher paused successfully", "Паблишер поставлен на паузу", "パブリッシャーを一時停止しました", "已暂停发布商"],
  ["Publisher archived successfully", "Паблишер архивирован", "パブリッシャーをアーカイブしました", "已归档发布商"],
  ["Publisher removed from campaign successfully", "Паблишер убран из кампании", "パブリッシャーをキャンペーンから外しました", "已将发布商从广告系列中移除"],
  ["A publisher called '{}' already exists in this workspace. Names have to be unique so reports can tell them apart.", "Паблишер «{0}» уже есть. Имена должны быть разными, чтобы отчёты их различали.", "「{0}」というパブリッシャーは既に存在します。レポートで区別できるよう、名前は重複できません。", "此工作区已有名为“{0}”的发布商。名称必须唯一，以便报告区分。"],
  ["Payout amount cannot be negative", "Выплата не может быть отрицательной", "支払額は負の値にできません", "付款金额不能为负数"],
  ["Assignment not found", "Привязка не найдена", "割り当てが見つかりません", "未找到该分配"],
  ["Destination not found", "Направление не найдено", "転送先が見つかりません", "未找到该目的地"],
  ["Destination deleted", "Направление удалено", "転送先を削除しました", "已删除目的地"],
  ["Destination deleted successfully", "Направление удалено", "転送先を削除しました", "已删除目的地"],
  ["buyer_id is required - a destination with no buyer can never receive calls", "Выберите покупателя — направление без покупателя не получает звонки", "バイヤーを選択してください。バイヤーのない転送先は通話を受けられません", "请选择买家——没有买家的目的地无法接收呼叫"],
  ["No destination ends in {}", "Нет направления, оканчивающегося на {0}", "末尾が {0} の転送先はありません", "没有以 {0} 结尾的目的地"],
  ["Campaign detached", "Кампания отвязана", "キャンペーンの紐付けを解除しました", "已解除广告系列关联"],
  ["min_call_duration cannot be negative", "Минимальная длительность не может быть отрицательной", "最小通話時間は負の値にできません", "最短通话时长不能为负数"],
  ["Your account is not allowed to block numbers", "Вашему аккаунту нельзя блокировать номера", "あなたのアカウントでは番号をブロックできません", "您的账户无权屏蔽号码"],
  ["Not your buyer's entry", "Это запись другого покупателя", "このエントリーはあなたのバイヤーのものではありません", "这不是您买家的记录"],
  ["Not your publisher's entry", "Это запись другого паблишера", "このエントリーはあなたのパブリッシャーのものではありません", "这不是您发布商的记录"],

  // ── Campaigns and Campaign Groups ─────────────────────────────────────
  ["Campaign not found", "Кампания не найдена", "キャンペーンが見つかりません", "未找到该广告系列"],
  ["Campaign not found or inactive", "Кампания не найдена или не активна", "キャンペーンが見つからないか無効です", "广告系列不存在或未启用"],
  ["Campaign is already active", "Кампания уже активна", "キャンペーンは既に有効です", "广告系列已处于启用状态"],
  ["Campaign is already paused", "Кампания уже на паузе", "キャンペーンは既に一時停止中です", "广告系列已暂停"],
  ["Campaign name must be at least 2 characters", "Название кампании — не короче 2 символов", "キャンペーン名は2文字以上にしてください", "广告系列名称至少需要 2 个字符"],
  ["Campaign activated successfully", "Кампания активирована", "キャンペーンを有効にしました", "已启用广告系列"],
  ["Campaign paused successfully", "Кампания поставлена на паузу", "キャンペーンを一時停止しました", "已暂停广告系列"],
  ["Campaign archived successfully", "Кампания архивирована", "キャンペーンをアーカイブしました", "已归档广告系列"],
  ["Schedules updated", "Расписание обновлено", "スケジュールを更新しました", "已更新时间表"],
  ["Amount cannot be negative", "Сумма не может быть отрицательной", "金額は負の値にできません", "金额不能为负数"],
  ["Time must be in HH:MM format", "Время в формате ЧЧ:ММ", "時刻は HH:MM 形式で入力してください", "时间格式应为 HH:MM"],
  ["day_of_week must be between 0 and 6", "День недели — от 0 до 6", "曜日は 0〜6 で指定してください", "星期须在 0 到 6 之间"],
  ["rtb_timeout_seconds must be between 1 and 30", "Тайм-аут RTB — от 1 до 30 секунд", "RTBタイムアウトは1〜30秒にしてください", "RTB 超时须在 1 到 30 秒之间"],
  ["Campaign Groups are for the team only.", "Группы кампаний доступны только команде.", "キャンペーングループはチーム専用です。", "广告系列组仅限团队成员使用。"],
  ["Group not found", "Группа не найдена", "グループが見つかりません", "未找到该组"],
  ["Give the group a name", "Укажите название группы", "グループ名を入力してください", "请为该组命名"],
  ["There is already a group called {}", "Группа «{0}» уже есть", "「{0}」という名前のグループは既に存在します", "已存在名为“{0}”的组"],
  ["{} deleted. Its campaigns keep their destinations.", "«{0}» удалена. Её кампании сохраняют свои направления.", "「{0}」を削除しました。キャンペーンの転送先はそのまま残ります。", "已删除“{0}”。其广告系列保留各自的目的地。"],
  ["Campaign not in this group", "Кампании нет в этой группе", "このキャンペーンはこのグループにありません", "该广告系列不在此组中"],
  ["These groups have no campaigns yet", "В этих группах пока нет кампаний", "これらのグループにはまだキャンペーンがありません", "这些组还没有广告系列"],
  ["Pick at least one campaign", "Выберите хотя бы одну кампанию", "キャンペーンを1つ以上選択してください", "请至少选择一个广告系列"],
  ["Pick at least one destination", "Выберите хотя бы одно направление", "転送先を1つ以上選択してください", "请至少选择一个目的地"],
  ["The same destination is picked twice", "Одно направление выбрано дважды", "同じ転送先が2回選択されています", "同一个目的地被选了两次"],
  ["A destination number needs 10 digits", "Номер направления должен содержать 10 цифр", "転送先の番号は10桁必要です", "目的地号码需要 10 位数字"],
  ["Convert ON is required when adding a destination", "При добавлении направления укажите «Конверсия при»", "転送先を追加するときは「コンバージョン条件」が必要です", "添加目的地时必须选择“转化条件”"],
  ["Convert ON must be Incoming Call, Call Connected or Call Length", "«Конверсия при»: входящий звонок, соединение или длительность", "コンバージョン条件は「着信」「接続」「通話時間」のいずれかにしてください", "转化条件须为来电、接通或通话时长"],
  ["Rate is required when adding a destination", "При добавлении направления укажите ставку", "転送先を追加するときは単価が必要です", "添加目的地时必须填写费率"],
  ["Rate must be a number", "Ставка должна быть числом", "単価は数値で入力してください", "费率必须是数字"],
  ["Rate cannot be negative", "Ставка не может быть отрицательной", "単価は負の値にできません", "费率不能为负数"],
  ["Nothing to change: give a priority, weight, rate or Convert ON", "Нечего менять: укажите приоритет, вес, ставку или «Конверсия при»", "変更内容がありません。優先度・ウェイト・単価・コンバージョン条件のいずれかを入力してください", "没有可更改的内容：请填写优先级、权重、费率或转化条件"],
  ["action must be add, remove or update", "Действие: добавить, удалить или изменить", "操作は追加・削除・更新のいずれかにしてください", "操作须为添加、移除或更新"],
  ["{} is listed twice", "{0} указан дважды", "{0} が2回指定されています", "{0} 被列出两次"],
  ["{} must be a whole number", "{0}: нужно целое число", "{0} は整数で入力してください", "{0} 必须是整数"],
  ["{} must be between {} and {}", "{0}: значение от {1} до {2}", "{0} は {1}〜{2} の範囲で入力してください", "{0} 必须在 {1} 到 {2} 之间"],

  // ── Routing, calls, IVR ───────────────────────────────────────────────
  ["Call not found", "Звонок не найден", "通話が見つかりません", "未找到该通话"],
  ["Call log not found", "Запись звонка не найдена", "通話記録が見つかりません", "未找到通话记录"],
  ["Call is already {}, nothing to hang up", "Звонок уже в статусе «{0}», нечего завершать", "通話は既に「{0}」のため、切断するものはありません", "通话已是“{0}”，无需挂断"],
  ["Call record closed. Live audio, if any, is not affected.", "Запись звонка закрыта. Живой звук, если он есть, не затронут.", "通話記録を閉じました。進行中の音声には影響しません。", "已关闭通话记录。如有实时音频，不受影响。"],
  ["Call Length needs a number of seconds above 0", "Для «Длительности звонка» укажите больше 0 секунд", "「通話時間」には0より大きい秒数を入力してください", "“通话时长”需要大于 0 的秒数"],
  ["convert_on must be one of: incoming, connected, length, or empty", "«Конверсия при»: входящий, соединение, длительность или пусто", "コンバージョン条件は「着信」「接続」「通話時間」または空欄にしてください", "转化条件须为来电、接通、通话时长或留空"],
  ["convert_seconds cannot be negative", "Секунды конверсии не могут быть отрицательными", "コンバージョン秒数は負の値にできません", "转化秒数不能为负数"],
  ["revenue cannot be negative", "Доход не может быть отрицательным", "収益は負の値にできません", "收入不能为负数"],
  ["revenue must be a number", "Доход должен быть числом", "収益は数値で入力してください", "收入必须是数字"],
  ["destination or phone_number is required", "Укажите направление или номер телефона", "転送先または電話番号が必要です", "需要目的地或电话号码"],
  ["Routing rule not found", "Правило маршрутизации не найдено", "ルーティングルールが見つかりません", "未找到路由规则"],
  ["Rule not found", "Правило не найдено", "ルールが見つかりません", "未找到规则"],
  ["Rule deleted successfully", "Правило удалено", "ルールを削除しました", "已删除规则"],
  ["No matching rule found", "Подходящее правило не найдено", "一致するルールがありません", "没有匹配的规则"],
  ["IVR flow not found", "IVR-сценарий не найден", "IVRフローが見つかりません", "未找到 IVR 流程"],
  ["IVR flow deleted successfully", "IVR-сценарий удалён", "IVRフローを削除しました", "已删除 IVR 流程"],
  ["From node not found", "Начальный узел не найден", "接続元ノードが見つかりません", "未找到起始节点"],
  ["To node not found", "Конечный узел не найден", "接続先ノードが見つかりません", "未找到目标节点"],
  ["No recording available for this call", "У этого звонка нет записи", "この通話の録音はありません", "该通话没有录音"],
  ["No recording URL returned", "Ссылка на запись не получена", "録音のURLが返されませんでした", "未返回录音链接"],
  ["Your account is not allowed to download reports", "Вашему аккаунту нельзя скачивать отчёты", "あなたのアカウントではレポートをダウンロードできません", "您的账户无权下载报告"],

  // ── Phone numbers, TFN Check, pools ───────────────────────────────────
  ["Phone number not found", "Номер не найден", "電話番号が見つかりません", "未找到该电话号码"],
  ["Number already exists in platform", "Номер уже есть на платформе", "この番号は既にプラットフォームに登録されています", "该号码已在平台中"],
  ["Number already purchased", "Номер уже куплен", "この番号は購入済みです", "该号码已购买"],
  ["Number released successfully", "Номер освобождён", "番号を解放しました", "已释放号码"],
  ["Number removed", "Номер удалён", "番号を削除しました", "已移除号码"],
  ["Number not found in pool", "Номер не найден в пуле", "プールに番号が見つかりません", "号码池中未找到该号码"],
  ["Pool not found", "Пул не найден", "プールが見つかりません", "未找到号码池"],
  ["Pool not found or inactive", "Пул не найден или не активен", "プールが見つからないか無効です", "号码池不存在或未启用"],
  ["Pool deleted", "Пул удалён", "プールを削除しました", "已删除号码池"],
  ["User has no organization", "У пользователя нет организации", "ユーザーに組織がありません", "用户没有所属组织"],
  ["Insufficient balance: provisioning a number costs ${}, available ${}", "Недостаточно средств: номер стоит ${0}, доступно ${1}", "残高不足：番号の取得には ${0} 必要ですが、利用可能額は ${1} です", "余额不足：开通号码需要 ${0}，可用余额 ${1}"],
  ["Twilio error: {}", "Ошибка Twilio: {0}", "Twilioエラー：{0}", "Twilio 错误：{0}"],
  ["A test call for this number is already running", "Тестовый звонок на этот номер уже идёт", "この番号のテスト通話は既に実行中です", "此号码的测试呼叫正在进行中"],
  ["A test for this number is already running", "Тест этого номера уже идёт", "この番号のテストは既に実行中です", "此号码的测试正在进行中"],
  ["At most {} test calls per number in 24 hours", "Не больше {0} тестовых звонков на номер за 24 часа", "1つの番号につき24時間でテスト通話は最大 {0} 回です", "每个号码 24 小时内最多 {0} 次测试呼叫"],
  ["At most {} tests per number in 24 hours", "Не больше {0} тестов на номер за 24 часа", "1つの番号につき24時間でテストは最大 {0} 回です", "每个号码 24 小时内最多 {0} 次测试"],
  ["Test not found", "Тест не найден", "テストが見つかりません", "未找到该测试"],
  ["Give the link a name", "Укажите название ссылки", "リンク名を入力してください", "请为链接命名"],
  ["Link not found", "Ссылка не найдена", "リンクが見つかりません", "未找到该链接"],
  ["Not a phone number", "Это не номер телефона", "電話番号ではありません", "不是电话号码"],
  ["This link is not valid or has been cancelled", "Ссылка недействительна или отменена", "このリンクは無効か取り消されています", "该链接无效或已取消"],
  ["This number is not on the platform", "Этого номера нет на платформе", "この番号はプラットフォームにありません", "该号码不在平台上"],
  ["Test calls are not switched on for your account", "Тестовые звонки для вашего аккаунта не включены", "あなたのアカウントではテスト通話が有効になっていません", "您的账户未开启测试呼叫"],
  ["Too many checks in a minute. Please wait a moment and try again.", "Слишком много проверок за минуту. Подождите и попробуйте ещё раз.", "1分間の確認回数が多すぎます。少し待ってからもう一度お試しください。", "一分钟内检查次数过多，请稍候再试。"],
  ["Your account cannot make check links", "Ваш аккаунт не может создавать ссылки проверки", "あなたのアカウントでは確認リンクを作成できません", "您的账户无法创建检查链接"],
  ["Your account has no numbers to check", "У вашего аккаунта нет номеров для проверки", "あなたのアカウントには確認する番号がありません", "您的账户没有可检查的号码"],
  ["Your account has no numbers to test", "У вашего аккаунта нет номеров для теста", "あなたのアカウントにはテストする番号がありません", "您的账户没有可测试的号码"],
  ["phone_number is immutable after creation. Delete and recreate to change the number.", "Номер нельзя изменить после создания. Удалите запись и создайте заново.", "電話番号は作成後に変更できません。変更するには削除して作り直してください。", "号码创建后无法修改。如需更改，请删除后重新创建。"],

  // ── Blocking and shields ──────────────────────────────────────────────
  ["Anonymous block updated", "Блокировка анонимных обновлена", "非通知のブロック設定を更新しました", "已更新匿名屏蔽"],
  ["Blacklist entry deleted", "Запись чёрного списка удалена", "ブラックリストの項目を削除しました", "已删除黑名单条目"],
  ["Whitelist entry deleted", "Запись белого списка удалена", "ホワイトリストの項目を削除しました", "已删除白名单条目"],
  ["Shield deleted", "Защита удалена", "シールドを削除しました", "已删除防护"],
  ["Shield not found", "Защита не найдена", "シールドが見つかりません", "未找到防护"],

  // ── Billing ───────────────────────────────────────────────────────────
  ["Billing is not available to partner logins.", "Оплата недоступна партнёрам.", "パートナーのログインでは請求機能を利用できません。", "合作方登录无法使用账单功能。"],
  ["Billing account not found", "Платёжный аккаунт не найден", "請求アカウントが見つかりません", "未找到账单账户"],
  ["Amount must be greater than 0", "Сумма должна быть больше 0", "金額は0より大きくしてください", "金额必须大于 0"],
  ["Amount must be greater than zero", "Сумма должна быть больше нуля", "金額は0より大きくしてください", "金额必须大于零"],
  ["Deposit amount must be greater than zero", "Сумма пополнения должна быть больше нуля", "入金額は0より大きくしてください", "充值金额必须大于零"],
  ["${} deposited successfully", "Зачислено ${0}", "${0} を入金しました", "已充值 ${0}"],
  ["Payment method removed", "Способ оплаты удалён", "支払い方法を削除しました", "已移除付款方式"],
  ["Payment method saved successfully", "Способ оплаты сохранён", "支払い方法を保存しました", "已保存付款方式"],
  ["Stripe error: {}", "Ошибка Stripe: {0}", "Stripeエラー：{0}", "Stripe 错误：{0}"],
  ["CoinGate error: {}", "Ошибка CoinGate: {0}", "CoinGateエラー：{0}", "CoinGate 错误：{0}"],
  ["Calls are being refused — the balance cannot cover one call.", "Звонки отклоняются — баланса не хватает даже на один звонок.", "通話が拒否されています。残高が1通話分にも足りません。", "呼叫正被拒绝——余额不足以支付一通呼叫。"],
  ["Balance is at or below the ${} warning level.", "Баланс на уровне предупреждения ${0} или ниже.", "残高が警告ライン ${0} 以下です。", "余额已达到或低于 ${0} 的警告线。"],
  ["The ${} portal fee is due on {} and would leave ${}, below what a call needs.", "Плата за портал ${0} списывается {1}, после неё останется ${2} — меньше, чем нужно на звонок.", "ポータル利用料 ${0} が {1} に引き落とされ、残高は ${2} となり通話に必要な額を下回ります。", "门户费 ${0} 将于 {1} 扣除，之后余额为 ${2}，不足以支付一通呼叫。"],

  // ── Reports, KYC, support, integrations, marketplace ──────────────────
  ["Report not found", "Отчёт не найден", "レポートが見つかりません", "未找到报告"],
  ["Report deleted", "Отчёт удалён", "レポートを削除しました", "已删除报告"],
  ["Report paused", "Отчёт на паузе", "レポートを一時停止しました", "已暂停报告"],
  ["Report activated", "Отчёт включён", "レポートを有効にしました", "已启用报告"],
  ["Report was already triggered recently. Please wait before running again.", "Отчёт недавно уже запускался. Подождите перед повторным запуском.", "このレポートは最近実行されました。しばらく待ってから再実行してください。", "报告最近已运行过，请稍候再试。"],
  ["Format must be CSV or Excel.", "Формат: CSV или Excel.", "形式は CSV または Excel にしてください。", "格式须为 CSV 或 Excel。"],
  ["Send time must look like 09:00", "Время отправки в формате 09:00", "送信時刻は 09:00 の形式で入力してください", "发送时间格式应为 09:00"],
  ["Save your schedule first — there's no report on the backend to run yet.", "Сначала сохраните расписание — отчёта для запуска ещё нет.", "先にスケジュールを保存してください。まだ実行できるレポートがありません。", "请先保存时间表——目前还没有可运行的报告。"],
  ["Chat not found", "Чат не найден", "チャットが見つかりません", "未找到聊天"],
  ["KYC not found", "Проверка личности не найдена", "本人確認情報が見つかりません", "未找到身份验证"],
  ["KYC not submitted yet", "Проверка личности ещё не отправлена", "本人確認はまだ提出されていません", "尚未提交身份验证"],
  ["No file provided", "Файл не выбран", "ファイルが選択されていません", "未提供文件"],
  ["Only jpg, jpeg, png, pdf allowed", "Только jpg, jpeg, png, pdf", "jpg・jpeg・png・pdf のみ使用できます", "仅允许 jpg、jpeg、png、pdf"],
  ["Upload succeeded but the server returned no URL.", "Файл загружен, но сервер не вернул ссылку.", "アップロードは完了しましたが、サーバーからURLが返されませんでした。", "上传成功，但服务器未返回链接。"],
  ["Chat started. An agent will respond shortly.", "Чат начат. Специалист скоро ответит.", "チャットを開始しました。まもなく担当者が返信します。", "已开始聊天，客服将很快回复。"],
  ["Message sent", "Сообщение отправлено", "メッセージを送信しました", "消息已发送"],
  ["Reply saved", "Ответ сохранён", "返信を保存しました", "已保存回复"],
  ["Session not found", "Сеанс не найден", "セッションが見つかりません", "未找到会话"],
  ["Too many chats started. Please wait a moment.", "Слишком много чатов. Подождите немного.", "開始したチャットが多すぎます。少しお待ちください。", "发起的聊天过多，请稍候。"],
  ["Too many messages. Please slow down.", "Слишком много сообщений. Помедленнее.", "メッセージが多すぎます。少し間を空けてください。", "消息过多，请放慢速度。"],
  ["Integration not connected", "Интеграция не подключена", "連携が接続されていません", "集成未连接"],
  ["Integration not found", "Интеграция не найдена", "連携が見つかりません", "未找到集成"],
  ["Webhook not found", "Вебхук не найден", "Webhookが見つかりません", "未找到 Webhook"],
  ["Webhook deleted successfully", "Вебхук удалён", "Webhookを削除しました", "已删除 Webhook"],
  ["This is a test webhook delivery", "Это тестовая отправка вебхука", "これはWebhookのテスト送信です", "这是一次测试 Webhook 推送"],
  ["Pixel not found", "Пиксель не найден", "ピクセルが見つかりません", "未找到像素"],
  ["Pixel deleted", "Пиксель удалён", "ピクセルを削除しました", "已删除像素"],
  ["Domain already exists", "Домен уже существует", "このドメインは既に存在します", "域名已存在"],
  ["Domain not found", "Домен не найден", "ドメインが見つかりません", "未找到域名"],
  ["Domain removed successfully", "Домен удалён", "ドメインを削除しました", "已移除域名"],
  ["No white label config found for this domain", "Для этого домена нет настроек White Label", "このドメインのホワイトラベル設定がありません", "此域名没有白标配置"],
  ["Category not found", "Категория не найдена", "カテゴリーが見つかりません", "未找到类别"],
  ["The category needs a name.", "Укажите название категории.", "カテゴリー名を入力してください。", "请输入类别名称。"],
  ["Service not found", "Услуга не найдена", "サービスが見つかりません", "未找到服务"],
  ["Body must be JSON.", "Тело запроса должно быть в формате JSON.", "本文は JSON 形式にしてください。", "请求正文必须是 JSON。"],
  ["Invalid JSON", "Неверный JSON", "JSONが正しくありません", "JSON 无效"],
  ["Auction not found or already closed", "Аукцион не найден или уже закрыт", "オークションが見つからないか既に終了しています", "拍卖不存在或已结束"],
  ["Bid received", "Ставка принята", "入札を受け付けました", "已收到出价"],
  ["No pending bid found for this buyer in this auction", "У этого покупателя нет ожидающей ставки в аукционе", "このオークションにこのバイヤーの保留中の入札はありません", "此拍卖中没有该买家的待处理出价"],
  ["Invite sent successfully", "Приглашение отправлено", "招待を送信しました", "邀请已发送"],
  ["Failed to send invite: {}", "Не удалось отправить приглашение: {0}", "招待を送信できませんでした：{0}", "邀请发送失败：{0}"],
  ["Notification rule not found", "Правило уведомлений не найдено", "通知ルールが見つかりません", "未找到通知规则"],
  ["Notification dispatched successfully", "Уведомление отправлено", "通知を送信しました", "通知已发送"],
  ["'{}' is not a valid channel. One of: {}", "«{0}» — неверный канал. Допустимо: {1}", "「{0}」は有効なチャネルではありません。使用可能：{1}", "“{0}”不是有效的渠道。可选：{1}"],
  ["'{}' is not a valid event. One of: {}", "«{0}» — неверное событие. Допустимо: {1}", "「{0}」は有効なイベントではありません。使用可能：{1}", "“{0}”不是有效的事件。可选：{1}"],
  ["CoinGecko returned an empty payload", "CoinGecko вернул пустой ответ", "CoinGeckoから空の応答が返されました", "CoinGecko 返回了空数据"],

  // ── AI Insights (analytics/ai_insights.py) ────────────────────────────
  ["Buyer {} has high no-answer rate", "У покупателя {0} много неотвеченных звонков", "バイヤー {0} の不応答率が高くなっています", "买家 {0} 的未接听率过高"],
  ["{}% of calls are not answered. Consider pausing this buyer.", "{0}% звонков не отвечены. Возможно, стоит поставить покупателя на паузу.", "通話の {0}% が応答されていません。このバイヤーの一時停止をご検討ください。", "{0}% 的呼叫未被接听。建议暂停该买家。"],
  ["Campaign {} has no active buyers", "У кампании {0} нет активных покупателей", "キャンペーン {0} に有効なバイヤーがいません", "广告系列 {0} 没有启用的买家"],
  ["Calls will fail — no buyers assigned to this campaign.", "Звонки не пройдут — к кампании не привязан ни один покупатель.", "通話は失敗します。このキャンペーンにバイヤーが割り当てられていません。", "呼叫将失败——此广告系列未分配买家。"],
  ["High spam rate detected today", "Сегодня высокий уровень спама", "本日スパム率が高くなっています", "今日检测到较高的垃圾呼叫率"],
  ["{}% of calls are being blocked as spam.", "{0}% звонков блокируются как спам.", "通話の {0}% がスパムとしてブロックされています。", "{0}% 的呼叫被作为垃圾呼叫拦截。"],
  ["Top performing campaign: {}", "Лучшая кампания: {0}", "最も成果の高いキャンペーン：{0}", "表现最佳的广告系列：{0}"],
  ["Generated ${} in the last 7 days.", "Принесла ${0} за последние 7 дней.", "過去7日間で ${0} を生み出しました。", "过去 7 天创造了 ${0}。"],
  ["Reduced Call Activity", "Снижение числа звонков", "通話数の減少", "通话量下降"],
  ["Call volume is {}% lower than yesterday.", "Звонков на {0}% меньше, чем вчера.", "通話数が昨日より {0}% 少なくなっています。", "通话量比昨天低 {0}%。"],
  ["Elevated Call Activity", "Рост числа звонков", "通話数の増加", "通话量上升"],
  ["Call volume is {}% higher than yesterday.", "Звонков на {0}% больше, чем вчера.", "通話数が昨日より {0}% 多くなっています。", "通话量比昨天高 {0}%。"],
  ["Revenue Decline", "Снижение дохода", "収益の減少", "收入下降"],
  ["Revenue is {}% lower than yesterday.", "Доход на {0}% ниже, чем вчера.", "収益が昨日より {0}% 低くなっています。", "收入比昨天低 {0}%。"],
  ["No Recent Call Activity", "Нет звонков в последнее время", "最近の通話なし", "近期无通话"],
  ["No calls have been received in the past hour during business hours.", "За последний час в рабочее время не было ни одного звонка.", "営業時間中の過去1時間、通話がありません。", "营业时间内过去一小时没有收到任何呼叫。"],
  ["No-answer rate {}% exceeded 70% threshold", "Доля неотвеченных {0}% превысила порог 70%", "不応答率 {0}% が基準の70%を超えました", "未接听率 {0}% 超过 70% 阈值"],
];

const COLUMN: Record<LocaleId, number> = { en: 0, ru: 1, ja: 2, zh: 3 };

let exact: Map<string, Row> | null = null;
let patterns: Array<{ re: RegExp; row: Row }> | null = null;

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function build() {
  exact = new Map();
  patterns = [];
  for (const row of ROWS) {
    const en = row[0];
    if (en.includes("{}")) {
      patterns.push({ re: new RegExp("^" + en.split("{}").map(escape).join("([\\s\\S]+?)") + "$"), row });
    } else {
      exact.set(en.toLowerCase(), row);
    }
  }
}

function lookup(text: string, locale: LocaleId): string | null {
  if (!exact || !patterns) build();
  const col = COLUMN[locale] ?? 0;
  const hit = exact!.get(text.toLowerCase());
  if (hit) return hit[col];
  for (const { re, row } of patterns!) {
    const m = re.exec(text);
    if (m) return row[col].replace(/\{(\d)\}/g, (_, n: string) => m[Number(n) + 1] ?? "");
  }
  return null;
}

/**
 * A message the server wrote, in the chosen language. English, and anything
 * not listed, come back unchanged. Also understands Pydantic's
 * "Value error, ..." and the portal's "field — message" for form errors.
 */
export function translateServerMessage(text: string | null | undefined, locale: LocaleId): string {
  const value = text ?? "";
  const raw = value.trim();
  if (!raw || locale === "en") return value;
  const direct = lookup(raw, locale);
  if (direct !== null) return direct;
  const valueError = /^Value error, ([\s\S]+)$/.exec(raw);
  if (valueError) {
    const inner = lookup(valueError[1].trim(), locale);
    if (inner !== null) return inner;
  }
  const dash = raw.lastIndexOf(" — ");
  if (dash > 0) {
    const inner = lookup(raw.slice(dash + 3).replace(/^Value error, /, "").trim(), locale);
    if (inner !== null) return `${raw.slice(0, dash)} — ${inner}`;
  }
  return value;
}

/** For the tests: how many server messages carry translations. */
export const SERVER_MESSAGE_COUNT = ROWS.length;
