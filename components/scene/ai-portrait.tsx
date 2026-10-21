"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { buildPortrait, portraitSpacing, type PortraitData } from "./portrait-geometry";
import { frameStep, input, setMode, type AiMode } from "./scene-input";
import { PORTRAIT_LINES_FS, PORTRAIT_LINES_VS, PORTRAIT_POINTS_FS, PORTRAIT_POINTS_VS } from "./shaders";
import type { Placement } from "./use-ai-placement";

// Avortyx AI's portrait in points: placement, its cycle (whole, forms, grid, back) and sign-in reactions.
// shaders.ts moves the points; this drives the uniforms.

const CYCLE = { whole: 21.5, apart: 2.6, grid: 2.4, back: 3.4 };
// forms while whole (shaders.ts form(); 0 is her face)
const FORMS = { from: 3, each: 4.5, morph: 1.8, seq: [0, 1, 2, 3, 0] };
const FORMS_LAST = FORMS.from + (FORMS.seq.length - 2) * FORMS.each;
const APART = CYCLE.whole, GRID = APART + CYCLE.apart, BACK = GRID + CYCLE.grid, LENGTH = BACK + CYCLE.back;
const PATTERNS = 4; // the grid's patterns, in turn (shaders.ts gridOf())
const WAIT = 8; // the longest she holds as the grid for a sign-in's answer
const LEVEL = 0.75; // how bright she is overall: clear, yet under the page's words
const FOV = 40, DIST = 6; // the camera's (ai-scene.tsx)
const ease = (k: number) => k * k * (3 - 2 * k);
type Forms = { a: number; b: number; m: number };
const FACE: Forms = { a: 0, b: 0, m: 0 };

// module-level so a remount (switch to the lighter scene) carries on where it was; opens in the grid
const cycle = {
  at: BACK - 0.8,
  speed: 1.5,
  seenSubmit: -1,
  pattern: 0, // the grid's pattern this time round
  seenResult: -1,
  verifying: false,
  outcome: null as boolean | null, // the sign-in's answer, once the page has it
  waited: 0,
  flash: -99, // start of the last flash (right password) and jolt (wrong one), on her clock
  glitch: -99,
  said: { mode: "Ready" as AiMode, until: 0 },
  home: null as { from: number; at: number; dur: number } | null, // back to her face from a form, out of turn
};

function formsAt(c: number): Forms {
  if (c < FORMS.from || c >= APART) return FACE;
  const i = Math.min(FORMS.seq.length - 2, Math.floor((c - FORMS.from) / FORMS.each));
  return { a: FORMS.seq[i], b: FORMS.seq[i + 1], m: ease(Math.min(1, (c - FORMS.from - i * FORMS.each) / FORMS.morph)) };
}

function progressAt(c: number) {
  if (c < APART) return 0;
  if (c < GRID) return ease((c - APART) / CYCLE.apart);
  if (c < BACK) return 1;
  return 1 - ease((c - BACK) / CYCLE.back);
}

export function AiPortrait({ data, place, step, reduced }: { data: PortraitData; place: Placement; step: number; reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { size, viewport, invalidate } = useThree();
  const geo = useMemo(() => buildPortrait(data, step), [data, step]);
  useEffect(() => () => (geo.points.dispose(), geo.lines.dispose()), [geo]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uBack: { value: 1 },
      uRipple: { value: 0 },
      uEnergy: { value: 0 },
      uSize: { value: 2 },
      uGain: { value: 1 },
      uMouse: { value: new THREE.Vector3(99, 99, 99) },
      uEyes: { value: new THREE.Vector4(99, 99, 99, 99) },
      uGaze: { value: new THREE.Vector2() },
      uBlink: { value: 0 },
      uFocus: { value: 0.4 }, // her face's depth, in her units (portrait-geometry.ts)
      uGlitch: { value: 0 },
      uFlash: { value: 0 },
      uShapeA: { value: 0 },
      uShapeB: { value: 0 },
      uMorph: { value: 0 },
      uFace: { value: new THREE.Vector2() },
      uPattern: { value: 0 }, // the grid's pattern (shaders.ts gridOf())
    }),
    [],
  );
  useEffect(() => {
    uniforms.uEyes.value.copy(geo.eyes);
    uniforms.uFace.value.copy(geo.centre);
  }, [uniforms, geo]);
  const pointsMat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: PORTRAIT_POINTS_VS, fragmentShader: PORTRAIT_POINTS_FS, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    [uniforms],
  );
  const linesMat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: PORTRAIT_LINES_VS, fragmentShader: PORTRAIT_LINES_FS, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    [uniforms],
  );
  useEffect(() => () => (pointsMat.dispose(), linesMat.dispose()), [pointsMat, linesMat]);

  // reduced motion: redraw the still frame when she moves
  useEffect(() => invalidate(), [place, invalidate]);

  const state = useRef({ energy: 0, scale: 0, mouse: new THREE.Vector3(), blinkAt: 2.5, gaze: new THREE.Vector2() });

  useFrame(({ gl }, delta) => {
    const g = group.current;
    if (!g) return;
    const s = state.current, dt = reduced ? 0 : frameStep(gl.info.render.frame, delta);
    const t = (uniforms.uTime.value += dt);

    const now = formsAt(cycle.at), held = now.m >= 1 ? now.b : now.m <= 0 ? now.a : -1;
    const goHome = (dur: number) => {
      const from = held >= 0 ? held : now.m < 0.5 ? now.a : now.b;
      if (from) cycle.home = { from, at: t, dur };
      cycle.at = Math.max(cycle.at, FORMS_LAST + FORMS.morph);
    };

    if (input.submittedAt > 0 && input.submittedAt !== cycle.seenSubmit) {
      cycle.seenSubmit = input.submittedAt;
      if (cycle.at < APART) {
        if (cycle.at > FORMS.from) goHome(0.9);
        cycle.at = APART;
        cycle.speed = 1.4;
      } else if (cycle.at >= BACK) {
        // coming back from the grid: reverse into it from the same point
        cycle.at = APART + CYCLE.apart * (1 - (cycle.at - BACK) / CYCLE.back);
        cycle.speed = 1.4;
      }
      cycle.verifying = true;
      cycle.outcome = null;
      cycle.waited = 0;
    }
    if (input.result.at > 0 && input.result.at !== cycle.seenResult) {
      cycle.seenResult = input.result.at;
      if (cycle.verifying) cycle.outcome = input.result.ok;
    }
    if (cycle.verifying && cycle.outcome !== null && cycle.at >= GRID && cycle.at < BACK) cycle.speed = 3;
    const listen = input.focused && !cycle.verifying && cycle.at < APART;
    if (listen && held > 0) goHome(1.6);
    const holdWhole = listen && held >= 0;
    const holdGrid = cycle.verifying && cycle.outcome === null && cycle.at >= BACK - 0.05 && (cycle.waited += dt) < WAIT;
    if (!holdWhole && !holdGrid) {
      const was = cycle.at;
      cycle.at += dt * cycle.speed;
      if (was < BACK && cycle.at >= BACK && cycle.verifying) {
        cycle.speed = cycle.outcome === false ? 1.8 : 1.3;
        if (cycle.outcome) cycle.flash = t;
      }
    }
    if (cycle.at >= LENGTH) {
      cycle.at -= LENGTH;
      cycle.pattern = (cycle.pattern + 1) % PATTERNS;
      cycle.speed = 1;
      if (cycle.verifying && cycle.outcome !== null) {
        if (!cycle.outcome) cycle.glitch = t;
        cycle.said = { mode: cycle.outcome ? "Welcome" : "Try again", until: t + 3 };
      }
      cycle.verifying = false;
      cycle.outcome = null;
    }
    setMode(cycle.verifying ? "Verifying" : t < cycle.said.until ? cycle.said.mode : input.focused ? "Listening" : "Ready");
    uniforms.uProgress.value = reduced ? 0 : progressAt(cycle.at);
    uniforms.uPattern.value = cycle.pattern;
    const home = cycle.home, h = home ? (t - home.at) / home.dur : 1;
    if (home && h >= 1) cycle.home = null;
    const forms = reduced ? FACE : home && h < 1 ? { a: home.from, b: 0, m: ease(h) } : formsAt(cycle.at);
    uniforms.uShapeA.value = forms.a;
    uniforms.uShapeB.value = forms.b;
    uniforms.uMorph.value = forms.m;
    // switched only while she is fully in the grid or whole, where the change can't be seen
    uniforms.uBack.value = cycle.at >= BACK ? 1 : 0;
    s.energy += ((input.focused ? 1 : 0) - s.energy) * Math.min(1, dt * 3);
    uniforms.uEnergy.value = s.energy;
    input.ripple *= Math.exp(-dt * 2.5);
    uniforms.uRipple.value = input.ripple;
    const f = t - cycle.flash, j = t - cycle.glitch;
    uniforms.uFlash.value = f < 0 ? 0 : Math.min(1, f / 0.6) * Math.exp(-Math.max(0, f - 1.2) * 1.6);
    uniforms.uGlitch.value = j < 0 || j > 0.75 ? 0 : (0.35 + 0.65 * Math.round((j * 4) % 1)) * (1 - j / 0.75);

    if (t > s.blinkAt + 0.2) s.blinkAt = t + 3 + Math.random() * 3 - (Math.random() < 0.15 ? 2.6 : 0);
    const b = (t - s.blinkAt) / 0.2;
    uniforms.uBlink.value = b > 0 && b < 1 && cycle.at < APART && !reduced ? Math.sin(b * Math.PI) : 0;

    const perPx = (2 * Math.tan(((FOV / 2) * Math.PI) / 180) * DIST) / size.height;
    const wx = (place.x - size.width / 2) * perPx, wy = -(place.y - size.height / 2) * perPx, scale = place.r * perPx;
    const k = s.scale && !reduced ? Math.min(1, dt * 5) : 1;
    g.position.x += (wx - g.position.x) * k;
    g.position.y += (wy - g.position.y) * k;
    s.scale += (scale - s.scale) * k;
    g.scale.setScalar(s.scale);
    g.rotation.set(0.04 * Math.sin(t * 0.3) + input.mouse.y * 0.1, 0.2 * Math.sin(t * 0.21) + input.mouse.x * 0.25, 0);

    const look = input.focused ? input.field : input.mouse.px > -1e3 ? { x: input.mouse.px, y: input.mouse.py } : null;
    const gx = look ? (look.x - place.x) / Math.max(200, size.width * 0.35) : 0.3 * Math.sin(t * 0.17);
    const gy = look ? -(look.y - place.y) / Math.max(200, size.height * 0.4) : 0.2 * Math.sin(t * 0.11);
    s.gaze.set(Math.max(-1, Math.min(1, gx)), Math.max(-1, Math.min(1, gy)));
    uniforms.uGaze.value.lerp(s.gaze, Math.min(1, dt * 10));

    // sub-pixel points are drawn at a pixel and dimmed to match; small placements get a little extra light
    const px = place.r * portraitSpacing(data.h, step) * 1.5 * viewport.dpr;
    uniforms.uSize.value = px;
    uniforms.uGain.value = LEVEL * Math.min(1, px * px) * (1 + 0.25 * Math.min(1, Math.max(0, (90 - place.r) / 40)));

    if (input.mouse.px > -1e3) {
      s.mouse.set((input.mouse.px - size.width / 2) * perPx, -(input.mouse.py - size.height / 2) * perPx, 0);
      g.worldToLocal(s.mouse);
      uniforms.uMouse.value.lerp(s.mouse, Math.min(1, dt * 8));
    } else uniforms.uMouse.value.set(99, 99, 99);
  });

  return (
    <group ref={group}>
      <lineSegments geometry={geo.lines} material={linesMat} frustumCulled={false} />
      <points geometry={geo.points} material={pointsMat} frustumCulled={false} />
    </group>
  );
}
