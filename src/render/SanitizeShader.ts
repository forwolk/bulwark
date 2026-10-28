/**
 * Copy pass that also scrubs the HDR image before bloom: NaNs become black and colours are
 * capped. One bad pixel from any effect would otherwise be blurred by the bloom mips into a
 * flashing black or white block.
 */
export const SanitizeShader = {
  name: 'SanitizeShader',
  uniforms: {
    tDiffuse: { value: null },
    uMax: { value: 64 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uMax;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // Two NaN tests: isnan() may be folded away by fast-math compilers, x != x catches the rest.
      if (any(isnan(c.rgb)) || c.r != c.r || c.g != c.g || c.b != c.b) c.rgb = vec3(0.0);
      gl_FragColor = vec4(clamp(c.rgb, 0.0, uMax), 1.0);
    }
  `,
};
