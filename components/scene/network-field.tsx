"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { frameStep, input, pointScale } from "./scene-input";
import { LINK_FS, LINK_VS, NODE_FS, NODE_VS, RIBBON_FS, RIBBON_VS } from "./shaders";

// The background network on the left: drifting nodes, links with pulses, twisting ribbons (shaders.ts).
// Laid out in view units so it stays on the left at any window shape.

const DEPTH = 9; // camera to the layer (shaders.ts NET_Z)
const FOV = 40; // the camera's (ai-scene.tsx)
const ASPECT = 1.6; // aspect the links are chosen for

let seed = 1;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

function buildNetwork(count: number) {
  seed = 29;
  const nodes = Array.from({ length: count }, () => ({
    x: -1.12 + 1.45 * rnd() ** 1.25,
    y: rnd() * 2.3 - 1.15,
    z: (rnd() - 0.5) * 2,
    r: rnd(),
    size: rnd() < 0.14 ? 8 + rnd() * 4 : 3 + rnd() * 2.5,
  }));
  const pos: number[] = [], rand: number[] = [], size: number[] = [];
  for (const n of nodes) {
    pos.push(n.x, n.y, n.z);
    rand.push(n.r);
    size.push(n.size);
  }
  const points = new THREE.BufferGeometry();
  points.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  points.setAttribute("aRandom", new THREE.BufferAttribute(new Float32Array(rand), 1));
  points.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(size), 1));

  const lp: number[] = [], lr: number[] = [], end: number[] = [], ls: number[] = [], seen = new Set<number>();
  nodes.forEach((a, i) => {
    nodes
      .map((b, j) => [((a.x - b.x) * ASPECT) ** 2 + (a.y - b.y) ** 2, j])
      .filter(([d2, j]) => j !== i && d2 < 0.5 * 0.5)
      .sort((p, q) => p[0] - q[0])
      .slice(0, 3)
      .forEach(([, j]) => {
        const key = Math.min(i, j) * count + Math.max(i, j);
        if (seen.has(key)) return;
        seen.add(key);
        const b = nodes[j], s = rnd();
        lp.push(a.x, a.y, a.z, b.x, b.y, b.z);
        lr.push(a.r, b.r);
        end.push(0, 1);
        ls.push(s, s);
      });
  });
  const links = new THREE.BufferGeometry();
  links.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lp), 3));
  links.setAttribute("aRandom", new THREE.BufferAttribute(new Float32Array(lr), 1));
  links.setAttribute("aEnd", new THREE.BufferAttribute(new Float32Array(end), 1));
  links.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(ls), 1));
  return { points, links };
}

// position = (along 0..1, strand across 0..1, ribbon index)
function buildRibbons(strands: number, steps: number) {
  const pos = new Float32Array(3 * strands * steps * 2 * 3);
  let n = 0;
  for (let r = 0; r < 3; r++)
    for (let k = 0; k < strands; k++)
      for (let j = 0; j < steps; j++) {
        pos.set([j / steps, k / (strands - 1), r, (j + 1) / steps, k / (strands - 1), r], n);
        n += 6;
      }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return g;
}

export function NetworkField({ nodes, strands, steps, reduced }: { nodes: number; strands: number; steps: number; reduced: boolean }) {
  const { viewport, size } = useThree();
  const net = useMemo(() => buildNetwork(nodes), [nodes]);
  const ribbons = useMemo(() => buildRibbons(strands, steps), [strands, steps]);
  useEffect(() => () => (net.points.dispose(), net.links.dispose(), ribbons.dispose()), [net, ribbons]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uPixelRatio: { value: 1 },
      uView: { value: new THREE.Vector2(1, 1) },
      uLevel: { value: 1 },
      uShade: { value: new THREE.Vector4(-1, -1, -1, -1) },
    }),
    [],
  );
  const materials = useMemo(() => {
    const make = (vertexShader: string, fragmentShader: string) =>
      new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    return { nodes: make(NODE_VS, NODE_FS), links: make(LINK_VS, LINK_FS), ribbons: make(RIBBON_VS, RIBBON_FS) };
  }, [uniforms]);
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

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
    const dt = reduced ? 0 : frameStep(gl.info.render.frame, delta), u = uniforms;
    u.uTime.value += dt;
    u.uEnergy.value += ((input.focused ? 1 : 0) - u.uEnergy.value) * Math.min(1, dt * 2.5);
    u.uPixelRatio.value = pointScale(viewport.dpr, size.width, size.height);
    const half = Math.tan(((FOV / 2) * Math.PI) / 180) * DEPTH;
    u.uView.value.set((half * size.width) / size.height, half);
    // under 1024px it runs behind the form, so dimmer
    u.uLevel.value = size.width >= 1024 ? 1 : 0.4;
    // the intro's box in canvas pixels from the bottom left (gl_FragCoord), with a margin
    const r = words.current, d = viewport.dpr;
    if (r?.width) u.uShade.value.set((r.left - 24) * d, (size.height - r.bottom - 24) * d, (r.right + 24) * d, (size.height - r.top + 24) * d);
  });

  return (
    <>
      <lineSegments geometry={ribbons} material={materials.ribbons} frustumCulled={false} />
      <lineSegments geometry={net.links} material={materials.links} frustumCulled={false} />
      <points geometry={net.points} material={materials.nodes} frustumCulled={false} />
    </>
  );
}
