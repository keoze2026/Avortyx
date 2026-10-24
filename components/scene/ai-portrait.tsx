"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { buildPortrait, portraitSpacing, type PortraitData } from "./portrait-geometry";
import { signalBackdrop } from "@/components/backdrop/backdrop-signal";
import { frameStep, input, setMode, type AiMode } from "./scene-input";
import { HUD_FS, HUD_VS, PORTRAIT_LINES_FS, PORTRAIT_LINES_VS, PORTRAIT_POINTS_FS, PORTRAIT_POINTS_VS } from "./shaders";
import type { Placement } from "./use-ai-placement";

// The AI's portrait in 3D points (two draw calls: her points and the constellation on her face),
// placed over the page where use-ai-placement.ts says, facing the card, swaying a little and
// turning towards the pointer. She is printed out of a galaxy of points as the page opens, her HUD
// rings draw on round her, and from then on she stays: breathing, blinking, her eyes on the pointer or
// the field being typed in. All else she does answers the visitor: she listens while a field has
// focus, nods when the email is valid, thinks while a sign-in is checked (her rings spin up), then
// smiles with a pulse of her rings (a right password) or jolts (a wrong one).

const PRINT = { cloud: 0.3, back: 2.6, speed: 1.3 }; // the opening: a moment as the galaxy, then printed (uProgress 1 -> 0)
const WAIT = 8; // the longest she thinks before giving up on a sign-in's answer
const FOV = 40, DIST = 6; // the camera's (ai-scene.tsx)
const ease = (k: number) => k * k * (3 - 2 * k);

// kept outside the component so a switch to the lighter scene (which remounts it) carries on where it was
const cycle = {
  at: 0, // through the opening print
  printed: false,
  seenSubmit: -1,
  seenResult: -1,
  verifying: false,
  waited: 0,
  // when, on her clock, her last flash and smile (a right password) and jolt (a wrong one) began
  flash: -99,
  glitch: -99,
  said: { mode: "Ready" as AiMode, until: 0 }, // what her tag says for a while after an answer
};

const progressAt = (c: number) => (c < PRINT.cloud ? 1 : 1 - ease(Math.min(1, (c - PRINT.cloud) / PRINT.back)));

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
      uGlint: { value: 0 },
      uSmile: { value: 0 },
      uShapeA: { value: 0 },
      uShapeB: { value: 0 },
      uMorph: { value: 0 },
      uFaceX: { value: 0 },
      uFaceY: { value: 0 },
    }),
    [],
  );
  useEffect(() => {
    uniforms.uEyes.value.copy(geo.eyes);
    // the midpoint between her eyes, so her face is centred where she's placed (none if her picture marks no eyes)
    uniforms.uFaceX.value = Math.abs(geo.eyes.x) < 50 ? (geo.eyes.x + geo.eyes.z) / 2 : 0;
    uniforms.uFaceY.value = geo.headY;
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
  const hud = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: HUD_VS,
      fragmentShader: HUD_FS,
      uniforms: { uTime: uniforms.uTime, uEnergy: uniforms.uEnergy, uShow: { value: 0 }, uBusy: { value: 0 }, uVoice: { value: 0 }, uReveal: { value: 0 }, uWin: { value: 0 }, uCall: { value: 0 }, uCallFrom: { value: 0.8 }, uDegraded: { value: 0 }, uThink: { value: 0 }, uFail: { value: 0 }, uDial: { value: 0 }, uDialing: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { mat, plane: new THREE.PlaneGeometry(3.4, 3.4) };
  }, [uniforms]);
  useEffect(() => () => (hud.mat.dispose(), hud.plane.dispose()), [hud]);
  // always round her in her place between the intro and the card (place.tag); only too small to read in the header's corner
  const showHud = place.tag || place.r >= 60;

  // a still frame for reduced motion, drawn again whenever she moves
  useEffect(() => invalidate(), [place, invalidate]);

  const state = useRef({ energy: 0, scale: 0, mouse: new THREE.Vector3(), blinkAt: 2.5, gaze: new THREE.Vector2(), seenRecog: -1, nodAt: -99, revealAt: 0, nextCall: 0, callAt: -99, callSent: true, thinkAt: 0, shut: 0, tilt: 0, dial: 0 });

  useFrame(({ gl }, delta) => {
    const g = group.current;
    if (!g) return;
    const s = state.current, dt = reduced ? 0 : frameStep(gl.info.render.frame, delta);
    const t = (uniforms.uTime.value += dt);

    // Sign in: she thinks (her rings spin up) until the answer
    if (input.submittedAt > 0 && input.submittedAt !== cycle.seenSubmit) {
      cycle.seenSubmit = input.submittedAt;
      cycle.verifying = true;
      cycle.waited = 0;
      s.thinkAt = t;
    }
    if (input.result.at > 0 && input.result.at !== cycle.seenResult) {
      cycle.seenResult = input.result.at;
      if (cycle.verifying) {
        cycle.verifying = false;
        if (input.result.ok) cycle.flash = t;
        else cycle.glitch = t;
        cycle.said = { mode: input.result.ok ? "Welcome" : "Try again", until: t + 3 };
      }
    }
    if (cycle.verifying && (cycle.waited += dt) > WAIT) cycle.verifying = false;
    // a valid email typed: she recognises you (a nod, a glint in her eyes)
    if (input.recognizedAt > 0 && input.recognizedAt !== s.seenRecog) {
      s.seenRecog = input.recognizedAt;
      if (!cycle.verifying && cycle.printed) {
        s.nodAt = t;
        cycle.said = { mode: "Recognized", until: t + 2.2 };
      }
    }
    if (!cycle.printed) {
      cycle.at += dt * PRINT.speed;
      if (cycle.at >= PRINT.cloud + PRINT.back) {
        cycle.printed = true;
        s.revealAt = t;
        s.nextCall = t + 3;
        signalBackdrop({ kind: "ai" });
      }
    }
    // the password: she looks away while it's typed, and shuts her eyes while it's shown
    const pw = document.getElementById("password") as HTMLInputElement | null;
    const pwFocused = !!pw && document.activeElement === pw, pwShown = !!pw && pw.type === "text" && pw.value.length > 0;
    s.shut += ((pwShown && cycle.printed ? 1 : 0) - s.shut) * Math.min(1, dt * 8);
    setMode(cycle.verifying ? "Verifying" : t < cycle.said.until ? cycle.said.mode : pwShown ? "Not looking" : input.focused ? "Listening" : "Ready");
    uniforms.uProgress.value = reduced ? 0 : progressAt(cycle.at);
    const hu = hud.mat.uniforms;
    hu.uShow.value = 1 - uniforms.uProgress.value;
    // her rings draw on clockwise from the top once she is printed
    hu.uReveal.value = reduced ? 1 : cycle.printed ? Math.min(1, (t - s.revealAt) / 1.4) : 0;
    // her rings spin up while a sign-in is checked, and a little in anticipation over the Sign in button
    hu.uBusy.value += ((cycle.verifying ? 1 : input.hover === "submit" ? 0.4 : 0) - hu.uBusy.value) * Math.min(1, dt * 3);
    s.dial += (input.dial - s.dial) * Math.min(1, dt * 12);
    hu.uDial.value = s.dial / 48;
    hu.uDialing.value = Math.min(1, input.dial - s.dial);
    hu.uVoice.value = input.ripple;
    // calls come in now and then: a light slides round her outer ring to the wire, which carries it to the card
    if (cycle.printed && s.nextCall && !cycle.verifying && !reduced && t > s.nextCall) {
      s.callAt = t;
      s.callSent = false;
      hu.uCallFrom.value = 0.62 + Math.random() * 0.33;
      s.nextCall = t + 6 + Math.random() * 5;
    }
    const cp = (t - s.callAt) / 1.3;
    hu.uCall.value = cp >= 0 && cp < 1 ? cp : 0;
    if (cp >= 1 && !s.callSent) {
      s.callSent = true;
      signalBackdrop({ kind: "call" });
    }
    hu.uDegraded.value += ((input.degraded ? 1 : 0) - hu.uDegraded.value) * Math.min(1, dt * 2);
    // thinking: her ring's segments light one by one; a wrong password sends them back
    hu.uThink.value = cycle.verifying ? Math.min(1, (t - s.thinkAt) / 1.6) : 0;
    const fl = (t - cycle.glitch) / 0.9;
    hu.uFail.value = fl >= 0 && fl < 1 ? fl : 0;
    // a right password: a ring of light closes in on her
    const w = (t - cycle.flash) / 1.1;
    hu.uWin.value = w >= 0 && w < 1 ? w : 0;
    const n = t - s.nodAt;
    uniforms.uGlint.value = n < 0 || n > 1.2 ? 0 : Math.sin((Math.PI * n) / 1.2);
    // and she smiles a while
    const sm = t - cycle.flash;
    uniforms.uSmile.value = sm < 0 || sm > 2.8 ? 0 : ease(Math.min(1, sm / 0.4, (2.8 - sm) / 0.6));
    s.energy += ((input.focused ? 1 : 0) - s.energy) * Math.min(1, dt * 3);
    uniforms.uEnergy.value = s.energy;
    input.ripple *= Math.exp(-dt * 2.5);
    uniforms.uRipple.value = input.ripple;
    // the flash rises as she is printed and fades once she is whole; the jolt, three quick jumps
    const f = t - cycle.flash, j = t - cycle.glitch;
    uniforms.uFlash.value = f < 0 ? 0 : Math.min(1, f / 0.6) * Math.exp(-Math.max(0, f - 1.2) * 1.6);
    uniforms.uGlitch.value = j < 0 || j > 0.75 ? 0 : (0.35 + 0.65 * Math.round((j * 4) % 1)) * (1 - j / 0.75);

    // her eyes: a blink every 3 to 6 seconds (now and then two), only while she is whole
    if (t > s.blinkAt + 0.2) s.blinkAt = t + 3 + Math.random() * 3 - (Math.random() < 0.15 ? 2.6 : 0);
    const b = (t - s.blinkAt) / 0.2;
    uniforms.uBlink.value = Math.max(b > 0 && b < 1 && cycle.printed && !reduced ? Math.sin(b * Math.PI) : 0, s.shut);

    // her place on screen, in the world at z = 0 (seen from the camera's distance)
    const perPx = (2 * Math.tan(((FOV / 2) * Math.PI) / 180) * DIST) / size.height;
    const wx = (place.x - size.width / 2) * perPx, wy = -(place.y - size.height / 2) * perPx, scale = place.r * perPx;
    const k = s.scale && !reduced ? Math.min(1, dt * 5) : 1;
    g.position.x += (wx - g.position.x) * k;
    g.position.y += (wy - g.position.y) * k;
    s.scale += (scale - s.scale) * k;
    g.scale.setScalar(s.scale);
    const nod = n >= 0 && n < 0.9 && !reduced ? 0.11 * Math.sin((Math.PI * n) / 0.9) : 0;
    // over "Forgot password?" she tilts her head, curious
    s.tilt += ((input.hover === "forgot" ? 1 : 0) - s.tilt) * Math.min(1, dt * 4);
    g.rotation.set(0.04 * Math.sin(t * 0.3) + input.mouse.y * 0.1 + nod, 0.2 * Math.sin(t * 0.21) + input.mouse.x * 0.25, 0.1 * s.tilt);

    // where she looks: at the field being typed in, else at the pointer, else drifting a little;
    // her eyes move quickly to it, as eyes do
    const look = input.focused ? input.field : input.mouse.px > -1e3 ? { x: input.mouse.px, y: input.mouse.py } : null;
    let gx = look ? (look.x - place.x) / Math.max(200, size.width * 0.35) : 0.3 * Math.sin(t * 0.17);
    let gy = look ? -(look.y - place.y) / Math.max(200, size.height * 0.4) : 0.2 * Math.sin(t * 0.11);
    // a password being typed: she politely looks away, up and off from the card
    if (pwFocused || pwShown) [gx, gy] = [-0.8, 0.6];
    s.gaze.set(Math.max(-1, Math.min(1, gx)), Math.max(-1, Math.min(1, gy)));
    uniforms.uGaze.value.lerp(s.gaze, Math.min(1, dt * 10));

    // points a little wider than the gaps between them (one unit of hers is the placement's radius), in
    // pixels; where that is under a pixel (she is small, in the header's corner) they're drawn at a
    // pixel and dimmed to match. Small (on phones and tablets) she is lit up to a quarter as much again,
    // or her few points would leave her faint
    const px = place.r * portraitSpacing(data.h, step) * 1.3 * viewport.dpr;
    uniforms.uSize.value = px;
    uniforms.uGain.value = Math.min(1, px * px) * (1 + 0.25 * Math.min(1, Math.max(0, (90 - place.r) / 40)));

    // the pointer, in her own space
    if (input.mouse.px > -1e3) {
      s.mouse.set((input.mouse.px - size.width / 2) * perPx, -(input.mouse.py - size.height / 2) * perPx, 0);
      g.worldToLocal(s.mouse);
      uniforms.uMouse.value.lerp(s.mouse, Math.min(1, dt * 8));
    } else uniforms.uMouse.value.set(99, 99, 99);
  });

  return (
    <group ref={group}>
      {showHud && <mesh geometry={hud.plane} material={hud.mat} position-z={0.35} frustumCulled={false} />}
      <lineSegments geometry={geo.lines} material={linesMat} frustumCulled={false} />
      <points geometry={geo.points} material={pointsMat} frustumCulled={false} />
    </group>
  );
}
