"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Loads the 3D scene (ai-scene.tsx) as a separate chunk, fetched at once but started after first
// paint, so the form shows first.

const load = () => import("@/components/scene/ai-scene");
const AiScene = dynamic(() => load().then((m) => m.AiScene), { ssr: false });
if (typeof window !== "undefined") load();

export function Scene() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // two frames on: after first paint, without waiting for idle
    let id = requestAnimationFrame(() => (id = requestAnimationFrame(() => setReady(true))));
    return () => cancelAnimationFrame(id);
  }, []);

  return ready ? <AiScene /> : null;
}
