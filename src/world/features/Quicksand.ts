import * as THREE from 'three';

const vertexShader = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec2 vLocal;
  void main() {
    vLocal = position.xz;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform vec3 uLight;
  uniform vec3 uDark;
  varying vec2 vLocal;
  void main() {
    float r = length(vLocal);
    float a = atan(vLocal.y, vLocal.x);
    // Slow inward spiral, posterised into a few bands to match the flat art style.
    float swirl = sin(r * 13.0 + a * 2.0 + uTime * 1.4);
    float band = floor((swirl * 0.5 + 0.5) * 3.0) / 3.0;
    vec3 color = mix(uDark, uLight, band * 0.55 + r * 0.45);
    float alpha = 1.0 - smoothstep(0.82, 1.0, r);
    gl_FragColor = vec4(color, alpha);
    #include <fog_fragment>
  }
`;

/** A pit of slowly churning sand. Purely visual; the biome marks it as a hazard. */
export class Quicksand {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor(x: number, y: number, z: number, radius: number, light: number, dark: number) {
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uTime: { value: 0 }, uLight: { value: new THREE.Color(light) }, uDark: { value: new THREE.Color(dark) } },
      ]),
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    const geo = new THREE.CircleGeometry(1, 40);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.set(x, y, z);
    this.mesh.scale.setScalar(radius);
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time;
  }
}
