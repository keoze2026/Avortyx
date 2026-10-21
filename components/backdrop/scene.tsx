"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// The 3D scene (components/scene/ai-scene.tsx: the particle wave and the AI's portrait), over
// the backdrop (backdrop.tsx). Its code (three.js and React Three Fiber) is split from the page's,
// fetched as soon as this script runs in the browser (alongside the page's own, not after it), and
// started as soon as the page has painted, so the sign-in form shows first; she then arrives
// being printed out of a galaxy of points.

const load = () => import("@/components/scene/ai-scene");
const AiScene = dynamic(() => load().then((m) => m.AiScene), { ssr: false });
if (typeof window !== "undefined") load();

export function Scene() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // start it as soon as the page has painted (two frames on), so the form is on screen first but
    // the scene doesn't wait for the browser to idle
    let id = requestAnimationFrame(() => (id = requestAnimationFrame(() => setReady(true))));
    return () => cancelAnimationFrame(id);
  }, []);

  return ready ? <AiScene /> : null;
}
