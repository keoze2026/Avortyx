"use client";

import dynamic from "next/dynamic";

// The 404's content as its own chunk, fetched only when a 404 shows. The root 404 ships with every
// page, and its texts need the whole app's dictionary, which the sign-in screen otherwise does without.
// (next/dynamic splits only from a client component, hence this file.)
export const NotFoundContent = dynamic(() => import("./not-found-content").then((m) => m.NotFoundContent));
