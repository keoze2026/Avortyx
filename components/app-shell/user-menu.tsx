"use client";

import { useRouter } from "next/navigation";
import { CreditCard, LogOut, RotateCcw, Settings, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import { useAuthStore } from "@/lib/store/auth-store";
import { isDemoMode } from "@/lib/demo/flag";
import { resetDemoStorage } from "@/lib/demo/persist";
import { LocalName } from "@/lib/i18n/local-name";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserMenu() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  if (!user) return null;

  const onLogout = () => {
    logout();
    toast.success(t("userMenu.signedOut"));
    router.push(ROUTES.login);
  };

  const onResetDemo = () => {
    resetDemoStorage();
    toast.success(t("x5.userMenu.demoReset"));
    // Hard reload so every Zustand store rehydrates from fresh fixtures
    // and the auth store falls back to logged-out.
    setTimeout(() => {
      if (typeof window !== "undefined") window.location.assign(ROUTES.login);
    }, 350);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={t("x5.userMenu.accountMenu").replace("{name}", user.name)}
        >
          <Avatar className="h-8 w-8 border border-border">
            {user.avatarUrl && (
              <AvatarImage src={user.avatarUrl} alt={user.name} />
            )}
            <AvatarFallback className="bg-accent/15 text-accent text-xs">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-sm font-semibold"><LocalName name={user.name} /></span>
            <span className="text-[10px] font-mono text-muted-foreground">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push(ROUTES.settings)}>
          <UserIcon className="h-4 w-4" /> {t("userMenu.profile")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push(ROUTES.billing)}>
          <CreditCard className="h-4 w-4" /> {t("userMenu.billing")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push(ROUTES.settings)}>
          <Settings className="h-4 w-4" /> {t("userMenu.settings")}
        </DropdownMenuItem>
        {isDemoMode() && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onResetDemo}>
              <RotateCcw className="h-4 w-4" /> {t("x5.userMenu.resetDemo")}
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout} className="text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" /> {t("userMenu.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
