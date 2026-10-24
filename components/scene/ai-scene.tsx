"use client";

import { useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { BACKDROP_EVENT, type BackdropSignal } from "@/components/backdrop/backdrop-signal";
import { AiPortrait } from "./ai-portrait";
import { AiStatus } from "./ai-status";
import { BokehField } from "./bokeh-field";
import { DepthField } from "./depth-field";
import { NetworkField } from "./network-field";
import { loadPortrait, usePortrait } from "./portrait-geometry";
import { input, listen } from "./scene-input";
import { useAiPlacement } from "./use-ai-placement";

// The 3D scene behind the sign-in screens: depth field, network, AI portrait and a parallax camera.
// The canvas is opaque black, blended onto the backdrop with mix-blend-mode: screen, so only its light shows.

if (typeof window !== "undefined") loadPortrait().catch(() => {});

// the screen's own sharpness (up to 2x), capped by a total pixel budget, so a huge (or zoomed-out) window stays cheap
function pickDpr(light: boolean) {
  const budget = light ? 2.5e6 : 5.5e6, area = window.innerWidth * window.innerHeight;
  return Math.max(0.2, Math.min(window.devicePixelRatio || 1, light ? 1.5 : 2, Math.sqrt(budget / area)));
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function CameraRig({ reduced }: { reduced: boolean }) {
  useFrame(({ camera }, delta) => {
    // exponential easing: frame-rate independent
    const k = reduced ? 1 : 1 - Math.exp(-Math.min(0.1, delta) * 1.4);
    camera.position.x += (input.mouse.x * 0.3 - camera.position.x) * k;
    camera.position.y += (0.15 - input.mouse.y * 0.18 - camera.position.y) * k;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

// compile shaders before the first frame (in parallel where supported) so drawing never blocks the page
function Prepare({ onReady }: { onReady: (ready: boolean) => void }) {
  const { gl, scene, camera, frameloop, invalidate } = useThree();
  useEffect(() => {
    let live = true;
    gl.compileAsync(scene, camera)
      .catch(() => {})
      .then(() => live && onReady(true));
    return () => void (live = false);
  }, [gl, scene, camera, onReady]);
  useEffect(() => {
    if (frameloop === "demand") invalidate();
  }, [frameloop, invalidate]);
  return null;
}

export function AiScene() {
  const place = useAiPlacement();
  const [env, setEnv] = useState<{ ok: boolean; light: boolean; reduced: boolean } | null>(null);
  const [hidden, setHidden] = useState(false);
  const [dpr, setDpr] = useState(1);
  const [prepared, setPrepared] = useState(false);
  const [printed, setPrinted] = useState(false);
  const portrait = usePortrait();

  useEffect(() => {
    const light = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768 || (navigator.hardwareConcurrency || 8) <= 2;
    setEnv({ ok: hasWebGL(), light, reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches });
    setDpr(pickDpr(light));
    const onResize = () => setDpr(pickDpr(light));
    const onVisibility = () => setHidden(document.hidden);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    const stop = listen();
    const onSignal = (e: Event) => (e as CustomEvent<BackdropSignal>).detail.kind === "ai" && setPrinted(true);
    window.addEventListener(BACKDROP_EVENT, onSignal);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(BACKDROP_EVENT, onSignal);
      stop();
    };
  }, []);

  if (!env?.ok) return null;
  const lite = env.light;
  return (
    <>
      {/* her place held by a faint ring until she is printed */}
      {place?.tag && (
        <div
          aria-hidden="true"
          className={`pointer-events-none fixed -z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-signal-400/20 transition-opacity duration-700 forced-colors:hidden ${printed ? "opacity-0" : "opacity-100"}`}
          style={{ left: place.x, top: place.y, width: place.r * 3.12, height: place.r * 3.12 }}
        >
          <div className="absolute inset-[-1px] animate-spin rounded-full [animation-duration:2.4s] [background:conic-gradient(transparent_70%,rgb(96_165_250/0.7))] [mask:radial-gradient(closest-side,transparent_calc(100%-2px),#000_calc(100%-1px))]" />
        </div>
      )}
      {/* inside her ring: a cone of light falling on her from its top, and a glow at its foot */}
      {prepared && place?.tag && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed -z-10 -translate-x-1/2 -translate-y-1/2 animate-[scene-in_2s_ease-out_both] overflow-hidden rounded-full forced-colors:hidden [mask-image:radial-gradient(closest-side,#000_88%,transparent)]"
          style={{ left: place.x, top: place.y, width: place.r * 3.12, height: place.r * 3.12 }}
        >
          <div className="absolute left-1/2 top-0 h-[78%] w-[72%] -translate-x-1/2 blur-2xl">
            <div className="h-full w-full [clip-path:polygon(40%_0,60%_0,100%_100%,0_100%)] [mask-image:linear-gradient(180deg,transparent,#000_25%,#000_60%,transparent)] bg-[linear-gradient(180deg,rgb(96_165_250/0.22),rgb(59_130_246/0.06))]" />
          </div>
          <div className="absolute left-1/2 top-[80%] h-[14%] w-[70%] -translate-x-1/2 rounded-[50%] blur-xl bg-[radial-gradient(closest-side,rgb(96_165_250/0.24),rgb(59_130_246/0.06)_60%,transparent)]" />
        </div>
      )}
      {prepared && place && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed -z-10 -translate-x-1/2 -translate-y-1/2 animate-[scene-in_1.2s_ease-out_both] rounded-full bg-[radial-gradient(closest-side,rgb(59_130_246/0.2),rgb(59_130_246/0.07)_55%,transparent)] forced-colors:hidden"
          style={{ left: place.x, top: place.y, width: place.r * 4, height: place.r * 4 }}
        />
      )}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 animate-[scene-in_0.6s_ease-out_both] mix-blend-screen forced-colors:hidden">
        <Canvas
          flat
          frameloop={hidden || !prepared ? "never" : env.reduced ? "demand" : "always"}
          dpr={dpr}
          camera={{ fov: 40, position: [0, 0.15, 6], near: 0.1, far: 60 }}
          gl={{ antialias: !lite, alpha: false, stencil: false, powerPreference: "high-performance" }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 1)}
        >
          <CameraRig reduced={env.reduced} />
          <DepthField count={lite ? 140 : 300} reduced={env.reduced} />
          <NetworkField nodes={lite ? 50 : 85} strands={lite ? 22 : 40} steps={lite ? 90 : 150} reduced={env.reduced} />
          {!lite && <BokehField count={10} reduced={env.reduced} />}
          {place && portrait && <AiPortrait data={portrait} place={place} step={lite ? 2 : 1} reduced={env.reduced} />}
          {place && portrait !== null && <Prepare onReady={setPrepared} />}
        </Canvas>
      </div>
      {/* below the galaxy she comes apart into, but kept on screen */}
      {place?.tag && <AiStatus x={place.x} y={Math.min(place.y + place.r * 1.85, window.innerHeight - 44)} />}
    </>
  );
}
