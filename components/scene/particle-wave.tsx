"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { frameStep, input, pointScale } from "./scene-input";
import { WAVE_FS, WAVE_VS } from "./shaders";

// The background: a field of points rolling to a horizon below the AI on layered sine waves (one
// draw call; the GPU moves them, shaders.ts), in the Avortyx blue. It rises
// a little while a sign-in field has focus, and is faint behind the intro's words (their box,
// measured as it changes), so they read clearly over it.

export function ParticleWave({ cols, rows, reduced }: { cols: number; rows: number; reduced: boolean }) {
  const { viewport, size } = useThree();
  const geometry = useMemo(() => {
    const pos = new Float32Array(cols * rows * 3);
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) pos.set([-20 + (40 * i) / (cols - 1), 0, -26 + (29 * j) / (rows - 1)], (j * cols + i) * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [cols, rows]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: WAVE_VS,
        fragmentShader: WAVE_FS,
        uniforms: { uTime: { value: 0 }, uEnergy: { value: 0 }, uPixelRatio: { value: 1 }, uShade: { value: new THREE.Vector4(-1, -1, -1, -1) } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material]);

  // the intro's words, in CSS pixels (none on the not-found page)
  const words = useRef<DOMRect | null>(null);
  useEffect(() => {
    const el = document.querySelector("[data-intro]");
    if (!el) return;
    const measure = () => (words.current = el.getBoundingClientRect());
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => (ro.disconnect(), window.removeEventListener("resize", measure));
  }, []);

  useFrame(({ gl }, delta) => {
    const dt = reduced ? 0 : frameStep(gl.info.render.frame, delta), u = material.uniforms;
    u.uTime.value += dt;
    u.uEnergy.value += ((input.focused ? 1 : 0) - u.uEnergy.value) * Math.min(1, dt * 2.5);
    u.uPixelRatio.value = pointScale(viewport.dpr, size.width, size.height);
    // in the canvas's pixels, from its bottom left (as the fragment shader sees them), a margin round
    const r = words.current, d = viewport.dpr;
    if (r?.width) u.uShade.value.set((r.left - 24) * d, (size.height - r.bottom - 24) * d, (r.right + 24) * d, (size.height - r.top + 24) * d);
  });

  return <points geometry={geometry} material={material} position={[0, -1.5, 0]} frustumCulled={false} />;
}
