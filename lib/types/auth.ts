export type Role = "admin" | "buyer" | "publisher";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  avatarUrl?: string;
  organization: string;
  phone?: string;
  /** Backend `is_superuser` flag. Superusers (and any user with role === "admin")
   *  bypass the onboarding gates (KYC + balance) — they always have full access. */
  isSuperuser?: boolean;
  /** Backend `is_staff` — platform staff (Avortyx operators), as opposed
   *  to a customer org's admin. Gates platform-only screens such as the
   *  access-request queue. */
  isStaff?: boolean;
  /** Whether the user has TOTP-based MFA enrolled on the backend. Drives
   *  the Settings → Security 2FA card and the login challenge gating. */
  mfaEnabled?: boolean;
  /** Telegram link state for notifications. `chatId` is set once the user
   *  has pressed Start on the bot; `username` is what they typed / what the
   *  bot reported. Connected ⇔ `chatId` present. */
  telegram?: {
    chatId?: string;
    username?: string;
  };
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: number;
}
