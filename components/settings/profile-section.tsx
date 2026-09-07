"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, KeyRound, Loader2, Mail, Send, Shield, Trash2, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { authService } from "@/lib/api/services/auth.service";
import { useAuthStore } from "@/lib/store/auth-store";
import { useIntegrationsStore } from "@/lib/store/integrations-store";

/** Largest avatar the multipart endpoint will accept. Aligns with the
 *  backend's 1.5 MB upload cap; bigger files get rejected client-side so
 *  the user sees a friendlier message than a 413. */
const MAX_AVATAR_BYTES = 1.5 * 1024 * 1024; // 1.5 MB

export function ProfileSection() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setAvatar = useAuthStore((s) => s.setAvatar);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const uploadAvatar = useAuthStore((s) => s.uploadAvatar);

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  // Reseed local form state when the user snapshot arrives or changes
  // (e.g. /me hydrates after first paint, or another tab updates profile).
  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone ?? "");
  }, [user]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const onSave = async () => {
    setSaving(true);
    try {
      // Email changes typically need a verification flow; the backend's
      // PATCH /me only accepts name + phone today. Send only what's safe
      // to round-trip and what actually differs from the saved snapshot.
      const patch: { name?: string; phone?: string } = {};
      const trimmedName = name.trim();
      const trimmedPhone = phone.trim();
      if (user && trimmedName !== user.name) patch.name = trimmedName;
      if (user && trimmedPhone !== (user.phone ?? "")) patch.phone = trimmedPhone;
      if (Object.keys(patch).length === 0) {
        toast.info("No changes to save");
        return;
      }
      await updateProfile(patch);
      toast.success(t("settings.profileSection.profileSaved"));
    } catch (e) {
      toast.error(friendlyErrorMessage(e, "Couldn't save profile"));
    } finally {
      setSaving(false);
    }
  };

  const onPickAvatar = () => fileInputRef.current?.click();

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Always reset so picking the same file twice still triggers change.
    if (e.target) e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(t("settings.profileSection.avatarMustBeImage"));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Avatar must be under 1.5 MB");
      return;
    }

    setAvatarBusy(true);
    try {
      // Multipart POST to /api/accounts/me/avatar — backend persists the
      // binary and returns the hosted URL, which the auth store writes
      // back into `user.avatarUrl` for us.
      await uploadAvatar(file);
      toast.success(t("settings.profileSection.avatarUpdated"));
    } catch (err) {
      toast.error(friendlyErrorMessage(err, "Couldn't upload avatar"));
    } finally {
      setAvatarBusy(false);
    }
  };

  const onRemoveAvatar = () => {
    setAvatar(null);
    toast.success(t("settings.profileSection.avatarRemoved"));
  };

  const onSendResetLink = async () => {
    if (!user?.email) return;
    try {
      await authService.requestPasswordReset(user.email);
      toast.success(t("settings.profileSection.resetEmailSent"));
    } catch (e) {
      toast.error(friendlyErrorMessage(e, "Couldn't send reset email"));
    }
  };

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <SectionShell
      eyebrow={t("settings.profileSection.eyebrow")}
      title={t("settings.profileSection.title")}
      description={t("settings.profileSection.description")}
    >
      {/* Avatar block */}
      <Card>
        <CardContent className="flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center">
          <div className="relative">
            {user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={`${name}'s avatar`}
                className="h-20 w-20 rounded-2xl object-cover shadow-lg"
              />
            ) : (
              <div
                className="flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-bold text-background shadow-lg"
                style={{ background: "linear-gradient(135deg, #818CF8, #5266E0, #3A4BC4)" }}
              >
                {initials}
              </div>
            )}
            <button
              type="button"
              className="absolute -bottom-1.5 -right-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-md transition-colors hover:text-accent"
              aria-label={t("settings.profileSection.avatar")}
              onClick={onPickAvatar}
            >
              <Camera className="h-3 w-3" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={onAvatarChange}
              className="hidden"
              aria-hidden="true"
            />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold">{t("settings.profileSection.avatar")}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("settings.profileSection.avatarHint")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onPickAvatar}
                disabled={avatarBusy}
              >
                {avatarBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
                {user?.avatarUrl
                  ? t("settings.profileSection.replace")
                  : t("settings.profileSection.upload")}
              </Button>
              {user?.avatarUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRemoveAvatar}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("settings.profileSection.remove")}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Identity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("settings.profileSection.identity")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="prof-name" label={t("settings.profileSection.fullName")} icon={User}>
              <Input id="prof-name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field id="prof-email" label={t("settings.profileSection.email")} icon={Mail}>
              {/* Email changes require a separate verification flow on the
                  backend; the PATCH /me endpoint only accepts name + phone
                  today. Render as read-only so the user isn't misled. */}
              <Input
                id="prof-email"
                type="email"
                value={email}
                readOnly
                className="bg-secondary/40"
              />
            </Field>
            <Field id="prof-phone" label={t("settings.profileSection.phone")} icon={Mail}>
              <Input id="prof-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field id="prof-role" label={t("settings.profileSection.role")} icon={Shield}>
              <Input id="prof-role" value={t("settings.profileSection.adminOwner")} readOnly className="bg-secondary/40" />
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => {
                if (!user) return;
                setName(user.name);
                setPhone(user.phone ?? "");
                toast.info(t("settings.profileSection.revertedChanges"));
              }}
            >
              {t("settings.profileSection.cancel")}
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                  {t("settings.profileSection.saveChanges")}
                </>
              ) : (
                t("settings.profileSection.saveChanges")
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Connections */}
      <ConnectionsCard />

      {/* Security */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("settings.profileSection.security")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Row
            icon={KeyRound}
            label={t("settings.profileSection.password")}
            description={t("settings.profileSection.passwordChanged")}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={onSendResetLink}
                disabled={!user?.email}
              >
                {t("settings.profileSection.sendResetLink")}
              </Button>
            }
          />
          {/* The 2FA toggle that used to live here was a local-only switch
              that didn't enforce anything. Real MFA enrollment now lives in
              Settings → Security with the QR / setup / disable flow wired
              to the backend's /api/accounts/mfa/* endpoints. We removed the
              toggle to avoid showing two different controls for the same
              state. */}
        </CardContent>
      </Card>
    </SectionShell>
  );
}

/* ---------- connections ---------- */

/** Id this integration is registered under in the backend catalog. */
const TELEGRAM_INTEGRATION_ID = "telegram";

/**
 * Telegram link-up, surfaced on the profile page.
 *
 * Wired to the same integrations endpoints the Integrations page uses, so the
 * state shown here is the real one rather than a local toggle. If the backend
 * catalog doesn't carry a `telegram` entry, the row says so instead of
 * rendering a Connect button that would 404 — a control that can't work
 * shouldn't look like one that can.
 */
function ConnectionsCard() {
  const { t } = useTranslation();
  const apps = useIntegrationsStore((s) => s.apps);
  const hydrated = useIntegrationsStore((s) => s.hydrated);
  const fetchApps = useIntegrationsStore((s) => s.fetch);
  const connect = useIntegrationsStore((s) => s.connect);
  const disconnect = useIntegrationsStore((s) => s.disconnect);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hydrated) void fetchApps();
  }, [hydrated, fetchApps]);

  const telegram = apps.find((a) => a.id === TELEGRAM_INTEGRATION_ID);
  const connected = Boolean(telegram?.connected);

  const onToggle = async () => {
    if (!telegram) return;
    setBusy(true);
    try {
      if (connected) {
        await disconnect(TELEGRAM_INTEGRATION_ID);
        toast.success(t("settings.profileSection.disconnect"));
      } else {
        await connect(TELEGRAM_INTEGRATION_ID);
        toast.success(t("settings.profileSection.connected"));
      }
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  let action: React.ReactNode;
  if (!hydrated) {
    action = (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  } else if (!telegram) {
    action = (
      <span className="text-[11px] text-muted-foreground">
        {t("settings.profileSection.telegramUnavailable")}
      </span>
    );
  } else {
    action = (
      <Button
        variant={connected ? "outline" : "default"}
        size="sm"
        onClick={onToggle}
        disabled={busy}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {connected
          ? t("settings.profileSection.disconnect")
          : t("settings.profileSection.connect")}
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {t("settings.profileSection.connections")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Row
          icon={Send}
          label={t("settings.profileSection.telegram")}
          description={
            connected
              ? t("settings.profileSection.telegramConnectedDesc")
              : t("settings.profileSection.telegramDesc")
          }
          action={action}
        />
      </CardContent>
    </Card>
  );
}

/* ---------- shared building blocks ---------- */

export function SectionShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <header>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {eyebrow}
        </span>
        <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
        <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">{description}</p>
      </header>
      {children}
    </div>
  );
}

function Field({
  id,
  label,
  icon: Icon,
  children,
}: {
  id: string;
  label: string;
  icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="inline-flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-muted-foreground" />
        {label}
      </Label>
      {children}
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  description,
  action,
}: {
  icon: typeof User;
  label: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-secondary/30 p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-accent/10 text-accent">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{description}</div>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
