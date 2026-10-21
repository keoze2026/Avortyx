"use client";

import { useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AiPortrait } from "./ai-portrait";
import { AiStatus } from "./ai-status";
import { DepthField } from "./depth-field";
import { ParticleWave } from "./particle-wave";
import { loadPortrait, usePortrait } from "./portrait-geometry";
import { input, listen } from "./scene-input";
import { useAiPlacement } from "./use-ai-placement";

// The 3D scene behind the sign-in screens (React Three Fiber), separate from the form: one canvas,
// fixed behind the page, which takes no pointer events (the page's fields stay usable; the scene
// reads the pointer from the window). In it, kept quiet so she and the page's words lead: faint
// points floating at many depths (depth-field.tsx), the particle wave (particle-wave.tsx), faint
// behind the intro's words, the AI's portrait in 3D points (ai-portrait.tsx), and a camera
// drifting a little with the pointer (parallax). Its
// aura (a soft CSS glow behind her) and her status tag (ai-status.tsx) are plain HTML.
// The canvas is opaque black, blended onto the page's backdrop with mix-blend-mode: screen, so only
// its light shows.
// Performance: four draw calls (depth field, wave, portrait points and lines), no
// post-processing; the points move on the GPU; the shaders are compiled in the background before
// the first frame (Prepare), so the page never waits on the GPU; at most 1.25x the screen's pixels
// and 2.6 million in all (so zoomed far out it stays light); lighter on phones, touch and low-power
// devices (fewer points, 1x pixels), decided once as the page opens so nothing switches
// mid-animation; paused while the tab is hidden; one still frame, drawn on demand, for reduced
// motion. Not shown in High Contrast or without WebGL. Started as soon as the page has painted
// (backdrop/scene.tsx), once her picture (public/ai-portrait.png, fetched as this code loads) is in;
// without it the scene starts without her.

if (typeof window !== "undefined") loadPortrait().catch(() => {});

// the canvas's pixel density: the screen's own (below 1 when zoomed out), at most 1.25 (1 on lighter
// devices), and never more than a budget of pixels in all, so a huge window (zoomed far out, or a big
// screen) is drawn at about a laptop's resolution and scaled up, instead of tens of millions of pixels
function pickDpr(light: boolean) {
  const budget = light ? 1.2e6 : 2.6e6, area = window.innerWidth * window.innerHeight;
  return Math.max(0.2, Math.min(window.devicePixelRatio || 1, light ? 1 : 1.25, Math.sqrt(budget / area)));
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

// the camera drifts a little with the pointer, always looking at the middle
function CameraRig({ reduced }: { reduced: boolean }) {
  useFrame(({ camera }, delta) => {
    // eased exponentially, so it glides the same at any frame rate
    const k = reduced ? 1 : 1 - Math.exp(-Math.min(0.1, delta) * 1.4);
    camera.position.x += (input.mouse.x * 0.3 - camera.position.x) * k;
    camera.position.y += (0.15 - input.mouse.y * 0.18 - camera.position.y) * k;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

// compiles the scene's shaders before its first frame, in the background where the browser can
// (KHR_parallel_shader_compile: Chrome compiles them side by side, off the page's thread), then
// lets the scene start; drawing first would compile them one by one, holding up the page
function Prepare({ onReady }: { onReady: (ready: boolean) => void }) {
  const { gl, scene, camera, frameloop, invalidate } = useThree();
  useEffect(() => {
    let live = true;
    gl.compileAsync(scene, camera)
      .catch(() => {})
      .then(() => live && onReady(true));
    return () => void (live = false);
  }, [gl, scene, camera, onReady]);
  // reduced motion draws on demand: its one still frame, once the scene may draw
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
  const portrait = usePortrait();

  useEffect(() => {
    const light = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768 || (navigator.hardwareConcurrency || 8) <= 4;
    setEnv({ ok: hasWebGL(), light, reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches });
    setDpr(pickDpr(light));
    const onResize = () => setDpr(pickDpr(light));
    const onVisibility = () => setHidden(document.hidden);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    const stop = listen();
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, []);

  if (!env?.ok) return null;
  const lite = env.light;
  return (
    <>
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
          gl={{ antialias: false, alpha: false, stencil: false, powerPreference: "high-performance" }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 1)}
        >
          <CameraRig reduced={env.reduced} />
          <DepthField count={lite ? 140 : 300} reduced={env.reduced} />
          <ParticleWave cols={lite ? 80 : 130} rows={lite ? 36 : 60} reduced={env.reduced} />
          {place && portrait && <AiPortrait data={portrait} place={place} step={lite ? 2 : 1} reduced={env.reduced} />}
          {place && portrait !== null && <Prepare onReady={setPrepared} />}
        </Canvas>
      </div>
      {/* her status clear of everything she becomes (the galaxy she comes apart into reaches about 1.75
          radii below her), but kept on screen */}
      {place?.tag && <AiStatus x={place.x} y={Math.min(place.y + place.r * 1.85, window.innerHeight - 44)} />}
    </>
  );
}
