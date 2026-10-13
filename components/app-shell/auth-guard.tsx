"use client";

/**
 * Client-side auth gate for the (app) route group.
 * Waits for the persisted store to hydrate, then redirects unauthenticated
 * visitors to /login (with `?from=` so we can return them after sign-in).
 *
 * NOTE: this is a UX guard, not a security boundary — when a real backend
 * is wired up, enforce auth in middleware / on the server too.
 */

import { useRouter, usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/brand/logo";
import { TOKEN_STORAGE_KEY, TOKENS_CLEARED_EVENT } from "@/lib/api/tokens";
import { ROUTES } from "@/lib/constants";
import { useAuthStore } from "@/lib/store/auth-store";

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthed = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  // Validate the persisted JWT against /api/accounts/me once the persisted
  // store has rehydrated. If the token is rejected, `bootstrap` clears it
  // and `isAuthed` flips to false, which then triggers the redirect below.
  useEffect(() => {
    if (!hydrated) return;
    void bootstrap();
    // Intentionally only fires once after rehydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Signed out by the server while the page is open (e.g. the account was
  // removed from a publisher / buyer / the workspace): the next request gets
  // 401, the tokens are thrown away, and this flips the app to signed-out at
  // once - the redirect below then goes to the login page. Also follows a
  // sign-out in another tab of the same browser.
  useEffect(() => {
    const signOutHere = () => {
      if (!useAuthStore.getState().isAuthenticated) return; // a normal logout already did it
      useAuthStore.setState({ user: null, isAuthenticated: false });
      toast.error("You have been signed out. Your access may have been removed.", { id: "signed-out" });
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_STORAGE_KEY && e.newValue === null) signOutHere();
    };
    window.addEventListener(TOKENS_CLEARED_EVENT, signOutHere);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(TOKENS_CLEARED_EVENT, signOutHere);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthed) {
      const params = new URLSearchParams();
      if (pathname) params.set("from", pathname);
      router.replace(`${ROUTES.login}?${params.toString()}`);
    }
  }, [hydrated, isAuthed, pathname, router]);

  if (!hydrated || !isAuthed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Logo animated className="h-10 w-10" uid="guard" />
          <p className="text-xs font-mono uppercase tracking-wider">Loading workspace…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}