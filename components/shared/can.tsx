"use client";

import * as React from "react";

import { usePermissions } from "@/lib/my-permissions";

/**
 * Show the children only when the signed-in employee's role holds the tick
 * (`area.action`, the same keys as the Roles screen). Always shown for admins,
 * partner logins and while permissions are unknown, exactly like `can()`.
 * A second tick can be required with `also`.
 */
export function Can({
  area,
  action,
  also,
  children,
}: {
  area: string;
  action: string;
  also?: [area: string, action: string];
  children: React.ReactNode;
}) {
  const { can } = usePermissions();
  if (!can(area, action)) return null;
  if (also && !can(also[0], also[1])) return null;
  return <>{children}</>;
}

/**
 * Keeps a block of settings visible but locked (every input and button inside
 * is disabled) when the role lacks the tick. For forms where hiding each
 * button one by one would miss fields. A `contents` fieldset adds no layout.
 */
export function Locked({
  area,
  action,
  children,
}: {
  area: string;
  action: string;
  children: React.ReactNode;
}) {
  const { can } = usePermissions();
  return (
    <fieldset disabled={!can(area, action)} className="contents">
      {children}
    </fieldset>
  );
}
