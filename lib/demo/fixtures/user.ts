/**
 * Demo user, workspace, and tokens — the very first things the auth-store
 * sees after login.
 */

import { DEMO_LOGIN_EMAIL } from "../flag";

/** Frontend-shape User (camelCase). The auth-store consumes this directly
 *  after a successful demo login. */
export const DEMO_USER = {
  id: "u_demo_admin",
  email: DEMO_LOGIN_EMAIL,
  firstName: "Alex",
  lastName: "Morgan",
  role: "admin" as const,
  phoneNumber: "+1 (555) 014-9088",
  mfaEnabled: false,
  isEmailVerified: true,
  isSuperuser: false,
  organizationId: "org_demo",
  organizationName: "Avortyx Demo Workspace",
  avatarUrl: undefined,
};

/** Wire-shape (snake_case) — what the demo router returns from /me etc. */
export interface DemoUserWire {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  phone_number: string;
  mfa_enabled: boolean;
  is_email_verified: boolean;
  is_superuser: boolean;
  organization_id: string;
  organization_name: string;
  avatar_url: string | undefined;
  /** Telegram link, written by the demo's simulated bot (see http-router). */
  telegram_chat_id?: string | null;
  telegram_username?: string | null;
}

export const DEMO_USER_WIRE: DemoUserWire = {
  id: DEMO_USER.id,
  email: DEMO_USER.email,
  first_name: DEMO_USER.firstName,
  last_name: DEMO_USER.lastName,
  role: DEMO_USER.role,
  phone_number: DEMO_USER.phoneNumber,
  mfa_enabled: DEMO_USER.mfaEnabled,
  is_email_verified: DEMO_USER.isEmailVerified,
  is_superuser: DEMO_USER.isSuperuser,
  organization_id: DEMO_USER.organizationId,
  organization_name: DEMO_USER.organizationName,
  avatar_url: DEMO_USER.avatarUrl,
};
