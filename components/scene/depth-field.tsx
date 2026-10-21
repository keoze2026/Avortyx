"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { frameStep, pointScale } from "./scene-input";
import { FIELD_FS, FIELD_VS } from "./shaders";

// Faint points drifting upward at many depths behind the scene, for parallax.

export function DepthField({ count, reduced }: { count: number; reduced: boolean }) {
  const { viewport, size } = useThree();
  const geometry = useMemo(() => {
    let seed = 13;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pos = new Float32Array(count * 3), rand = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos.set([(rnd() * 2 - 1) * 22, rnd() * 16 - 7, -4 - rnd() * 26], i * 3);
      rand[i] = rnd();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aRandom", new THREE.BufferAttribute(rand, 1));
    return g;
  }, [count]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: FIELD_VS,
        fragmentShader: FIELD_FS,
        uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );
  useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material]);

  useFrame(({ gl }, delta) => {
    material.uniforms.uTime.value += reduced ? 0 : frameStep(gl.info.render.frame, delta);
    material.uniforms.uPixelRatio.value = pointScale(viewport.dpr, size.width, size.height);
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
