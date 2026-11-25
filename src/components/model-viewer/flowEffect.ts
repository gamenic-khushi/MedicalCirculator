import * as THREE from 'three'

// The blood flow effect (Aki, UI Adjustment sheet 2026/11/25: 水流（青）, FFRを視覚反映):
// light-blue bands that run along the measured stretch of the vessel from ① to ②, the way
// the blood runs from the side nearer the heart. They are drawn on the part of the vessel
// that the measurement has painted (the green stretch), so they stay on the lesion; the
// stronger and faster the flow, the higher the FFR. They are only on the screen: the pictures
// that are saved (and the PDF) are taken without them (see ModelCanvas.capture).

// One set of values for every vessel material, so a single call changes them all.
export const flowUniforms = {
  flowTime: { value: 0 },
  flowStrength: { value: 0 },
  flowSpeed: { value: 0.6 },
  flowA: { value: new THREE.Vector3() },
  flowB: { value: new THREE.Vector3(0, 0, 1) },
  flowColor: { value: new THREE.Color('#38bdf8') },
}

/**
 * How the flow looks for an FFR (null: not calculated yet, shown as a healthy flow):
 * FFR 1 is full strength and speed, a low FFR is weaker and slower.
 */
export function flowParams(ffr: number | null): { strength: number; speed: number } {
  const f = ffr === null || !Number.isFinite(ffr) ? 1 : Math.min(Math.max(ffr, 0), 1)
  return { strength: 0.35 + 0.65 * f, speed: 0.3 + 0.7 * f }
}

// The vertex colour the measurement paints with is 0x39ff14 on white: the share of the
// way from white to it (0 to 1) is found from the red channel, 1 - 0x39 / 255.
const PAINT_RED_DROP = 1 - 0x39 / 255

const FRAGMENT_DECLARATIONS = `#include <common>
varying vec3 vFlowPos;
uniform float flowTime;
uniform float flowStrength;
uniform float flowSpeed;
uniform vec3 flowA;
uniform vec3 flowB;
uniform vec3 flowColor;`

// After the vertex colour is applied: the bands turn the painted vessel towards light blue.
const FRAGMENT_COLOUR = `#include <color_fragment>
  float flowAmount = 0.0;
#ifdef USE_COLOR
  if (flowStrength > 0.0) {
    // How much of the lesion paint is on this spot (0 on the plain vessel).
    float painted = clamp((1.0 - vColor.r) / ${PAINT_RED_DROP.toFixed(4)}, 0.0, 1.0);
    vec3 axis = flowB - flowA;
    float segment = max(length(axis), 0.0001);
    float along = dot(vFlowPos - flowA, axis / segment);
    float inside = step(-0.05 * segment, along) * step(along, 1.05 * segment);
    // Three bands along the stretch, moving from ① towards ②.
    float phase = along / (segment / 3.0) - flowTime * flowSpeed;
    float band = pow(0.5 + 0.5 * sin(phase * 6.2831853), 3.0);
    flowAmount = band * painted * inside * flowStrength;
    diffuseColor.rgb = mix(diffuseColor.rgb, flowColor, flowAmount * 0.85);
  }
#endif`

// And a soft glow on top, so the bands read as light moving through the vessel.
const FRAGMENT_GLOW = `#include <emissivemap_fragment>
  totalEmissiveRadiance += flowColor * flowAmount * 0.35;`

/** Added to a vessel material's shader (a stable function, so the program is made once). */
export function injectFlow(shader: {
  uniforms: Record<string, { value: unknown }>
  vertexShader: string
  fragmentShader: string
}) {
  Object.assign(shader.uniforms, flowUniforms)
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vFlowPos;')
    .replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n  vFlowPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    )
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', FRAGMENT_DECLARATIONS)
    .replace('#include <color_fragment>', FRAGMENT_COLOUR)
    .replace('#include <emissivemap_fragment>', FRAGMENT_GLOW)
}
