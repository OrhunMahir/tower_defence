// The 3D scene drawn like the pictures of the interface: flat paint and a pen line.
// ?look=ink, paper, comic or water picks a look; without it the scene is drawn as it always was.
// A look does two things. Lit surfaces are painted in a few flat bands instead of a smooth shade
// (a small change to the standard material's shader). Then the finished picture goes through one
// more pass, which draws a line wherever something ends or folds, a little beside where it belongs.
import * as THREE from 'three';

const luma = (c) => c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
// How bright the sun makes a white surface that faces it. Whoever renders sets it before drawing,
// so that "full light" means the same under the noon sun, at dusk and in the small portraits.
export const SUN = { value: 1 };
export const sunLevel = (light) => (luma(light.color) * light.intensity) / Math.PI;

// bands: a surface with less than [0] of full light lies in shade, with more than [1] in full light
//        and in between at [2] of it; [3] is how much the light of the sky counts.
// line, crease, rim: the width of the outline, of the line along a fold and of the paper edge, in pixels.
// wobble: how unsteady the pen is. wonk: how far walls lean. dots: the size of the print dots in the shade.
// wash, grain, pool, frame: how pale the paint is, how rough the paper, how much the paint
// gathers at the lines, and whether the picture ends in bare paper at the edges of the screen.
export const LOOKS = {
  ink: { name: 'Ink and paint', bands: [0.2, 0.6, 0.55, 1.25], ink: 0x21160f, line: 1.5, crease: 1.0, creaseInk: 0.8, wobble: 1.2, wonk: 0.14, sat: 1.15, grain: 0.04 },
  paper: { name: 'Paper cut-out', bands: [0.24, 0.24, 0.5, 1.6], ink: 0x2a1d14, line: 1.2, crease: 0.9, creaseInk: 0.55, wobble: 0.9, rim: 3.0, rimInk: 0xf1e6c8, wonk: 0.1, sat: 0.95, wash: 0.08, grain: 0.1 },
  comic: { name: 'Comic', bands: [0.22, 0.22, 0.5, 1.75], ink: 0x08080a, line: 2.1, crease: 1.4, creaseInk: 1, wobble: 0.3, wonk: 0.06, sat: 1.3, dots: 5 },
  water: { name: 'Watercolour', bands: [0.15, 0.55, 0.6, 1.4], ink: 0x5a3f2c, line: 1.0, crease: 0.8, creaseInk: 0.5, wobble: 2.0, wonk: 0.16, sat: 0.9, wash: 0.2, grain: 0.14, pool: 0.35, frame: 1 },
};

// Nothing a hand builds is quite straight: walls lean and bulge a little with their height.
// The shift depends on where a point sits in its own model, so nothing wobbles as it moves.
const f = (n) => n.toFixed(3);
const lean = (shader, by) => {
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
	transformed.xz += ${f(by)} * vec2( sin( position.y * 1.7 + position.z * 1.1 ), cos( position.y * 1.3 + position.x * 1.6 ) );`);
};

// Flat bands of light: every standard material is compiled with this change, except the ones
// that ask to stay smooth (userData.smooth). The open ground does: it all faces the same way, so
// with bands the whole land would flip from light to shade at once when the sun sinks.
function paintInBands([shade, full, between, sky], wonk) {
  THREE.MeshStandardMaterial.prototype.customProgramCacheKey = function () { return this.userData.smooth ? 'smooth' : 'bands'; };
  THREE.MeshStandardMaterial.prototype.onBeforeCompile = function (shader) {
    if (this.userData.smooth) return;
    shader.uniforms.uSun = SUN;
    if (wonk) lean(shader, wonk);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSun;')
      .replace('vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;', `
	float bandLight = dot( reflectedLight.directDiffuse, vec3( 0.299, 0.587, 0.114 ) ) / max( 1e-4, dot( material.diffuseContribution, vec3( 0.299, 0.587, 0.114 ) ) * uSun );
	float band = bandLight > ${f(full)} ? 1.0 : bandLight > ${f(shade)} ? ${f(between)} : 0.0;
	vec3 totalDiffuse = reflectedLight.indirectDiffuse * ${f(sky)} + ( bandLight > 1e-3 ? reflectedLight.directDiffuse / bandLight : vec3( 0.0 ) ) * band;`);
  };
}

const PEN = /* glsl */`
uniform sampler2D tColor, tNormal, tDepth;
uniform vec2 uRes;
uniform float uNear, uFar, uFog, uLine, uCrease, uCreaseInk, uWobble, uRim, uSat, uWash, uGrain, uPool, uFrame, uDots;
uniform vec3 uInk, uRimInk, uPaper;
varying vec2 vUv;
#include <packing>

float away( vec2 uv ) { return - perspectiveDepthToViewZ( texture2D( tDepth, uv ).x, uNear, uFar ); }
vec3 facing( vec2 uv ) { return texture2D( tNormal, uv ).xyz * 2.0 - 1.0; }
float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float noise( vec2 p ) {
	vec2 i = floor( p ), f = fract( p );
	f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( hash( i ), hash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( hash( i + vec2( 0.0, 1.0 ) ), hash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}

void main() {
	vec2 px = 1.0 / uRes, at = vUv * uRes;
	// The pen is not steady: the lines are looked up a little beside where they belong,
	// so they wander, and the paint does not sit exactly inside them.
	vec2 uv = vUv + ( vec2( noise( at / 21.0 ), noise( at / 21.0 + 37.0 ) ) - 0.5 ) * 2.0 * uWobble * px;
	float d = away( uv );
	vec3 n = facing( uv );
	// An outline where the depth jumps (1/depth is straight along any flat surface, so a floor
	// seen at a low angle draws no line), a thinner line where a surface folds.
	float jump = 0.0, fold = 0.0, edge = 0.0, nearer = 0.0, front = d;
	for ( int i = 0; i < 8; i ++ ) {
		float a = float( i ) * 0.7853982;
		vec2 o = vec2( cos( a ), sin( a ) );
		if ( i < 4 ) {
			vec2 q = vec2( cos( a * 2.0 ), sin( a * 2.0 ) );
			float dq = away( uv + q * uLine * px );
			jump += ( d - dq ) / dq;
			fold = max( fold, 1.0 - dot( n, facing( uv + q * uCrease * px ) ) );
		}
		float r = max( uRim, uLine * 3.0 ), di = away( uv + o * r * px );
		nearer = max( nearer, ( d - di ) / di );
		edge = max( edge, abs( d - di ) / min( d, di ) );
		front = min( front, di );
	}
	float clear = exp( - uFog * uFog * d * d ), clearFront = exp( - uFog * uFog * front * front );
	float outline = smoothstep( 0.004, 0.011, abs( jump ) );
	// Folds are drawn in full close by and fade as the camera pulls back, or small things turn black.
	float crease = smoothstep( 0.45, 0.8, fold ) * uCreaseInk * smoothstep( 150.0, 45.0, d );

	vec3 c = texture2D( tColor, vUv ).rgb;
	#if defined( TONE_MAPPING )
		c = toneMapping( c );
	#endif
	float grey = dot( c, vec3( 0.299, 0.587, 0.114 ) );
	c = mix( vec3( grey ), c, uSat );
	// Print dots in the shade.
	if ( uDots > 0.0 ) {
		vec2 cell = mat2( 0.7071, - 0.7071, 0.7071, 0.7071 ) * at / uDots;
		float size = sqrt( clamp( 1.0 - grey * 3.2, 0.0, 1.0 ) ) * 0.62;
		c *= 1.0 - 0.38 * smoothstep( size, size - 0.12, length( fract( cell ) - 0.5 ) );
	}
	// Thin paint on rough paper; it gathers along the lines.
	float tooth = noise( at / 2.5 ) * 0.5 + noise( at / 7.0 ) * 0.3 + noise( at / 31.0 ) * 0.2;
	c = mix( c, uPaper, uWash );
	c *= 1.0 + uGrain * ( tooth - 0.5 ) * 2.0;
	c *= 1.0 - uPool * smoothstep( 0.002, 0.02, edge ) * clear;
	// The paper edge of a cut-out: outside a shape only, where something nearer begins.
	if ( uRim > 0.0 ) c = mix( c, uRimInk, smoothstep( 0.012, 0.03, nearer ) * clearFront );
	c = mix( c, uInk, max( outline, crease ) * clear );
	// The picture ends in bare paper.
	if ( uFrame > 0.0 ) {
		vec2 m = abs( vUv - 0.5 ) * 2.0;
		float rim = max( m.x, m.y ) + ( noise( at / 60.0 ) - 0.5 ) * 0.09 + ( noise( at / 9.0 ) - 0.5 ) * 0.02;
		c = mix( c, uPaper * ( 0.97 + 0.06 * tooth ), smoothstep( 0.9, 0.99, rim ) * uFrame );
	}
	gl_FragColor = vec4( c, 1.0 );
	#include <colorspace_fragment>
}`;

// Sets a look up, or returns null when there is none to set up.
export function makeLook(key, renderer, scene, camera, sun) {
  const look = LOOKS[key];
  if (!look) return null;
  paintInBands(look.bands, look.wonk);
  const size = new THREE.Vector2();
  const picture = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  // What faces where, and how far away it is: the pen reads its lines from these.
  const shapes = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: new THREE.DepthTexture(1, 1) });
  const facing = new THREE.MeshNormalMaterial();
  if (look.wonk) facing.onBeforeCompile = (shader) => lean(shader, look.wonk);   // the pen follows the leaning walls
  const col = (hex) => new THREE.Color(hex ?? 0xffffff);
  const pen = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: {
      tColor: { value: picture.texture }, tNormal: { value: shapes.texture }, tDepth: { value: shapes.depthTexture },
      uRes: { value: size }, uNear: { value: camera.near }, uFar: { value: camera.far }, uFog: { value: 0 },
      uLine: { value: 1 }, uCrease: { value: 1 }, uRim: { value: 0 }, uDots: { value: 0 },
      uCreaseInk: { value: look.creaseInk ?? 1 }, uWobble: { value: 0 }, uSat: { value: look.sat ?? 1 }, uWash: { value: look.wash ?? 0 },
      uGrain: { value: look.grain ?? 0 }, uPool: { value: look.pool ?? 0 }, uFrame: { value: look.frame ?? 0 },
      uInk: { value: col(look.ink) }, uRimInk: { value: col(look.rimInk) }, uPaper: { value: col(0xf1e6c8) },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }',
    fragmentShader: PEN,
  });
  const sheet = new THREE.Mesh(new THREE.BufferGeometry(), pen);
  sheet.geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  sheet.geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  sheet.frustumCulled = false;
  const hidden = [], blank = new THREE.Color(0x8080ff), was = new THREE.Color();

  function resize() {
    renderer.getDrawingBufferSize(size);
    picture.setSize(size.x, size.y); shapes.setSize(size.x, size.y);
    const k = renderer.getPixelRatio();
    for (const [u, v] of [['uLine', look.line], ['uCrease', look.crease], ['uRim', look.rim ?? 0], ['uWobble', look.wobble ?? 0], ['uDots', look.dots ?? 0]]) pen.uniforms[u].value = v * k;
  }
  resize();

  function render() {
    SUN.value = sunLevel(sun);
    pen.uniforms.uFog.value = scene.fog ? scene.fog.density : 0;
    renderer.setRenderTarget(picture);
    renderer.render(scene, camera);
    // Smoke, glows, bars, rain and the blades of grass have no outline: they sit this pass out.
    scene.traverse((o) => {
      const m = o.material;
      if (o.visible && (o.isPoints || o.isLine || o.isSprite || o.userData.noInk || (m && !Array.isArray(m) && (m.transparent || !m.depthTest)))) { o.visible = false; hidden.push(o); }
    });
    const sky = scene.background, shadows = renderer.shadowMap.autoUpdate;
    renderer.getClearColor(was);
    const alpha = renderer.getClearAlpha();
    scene.background = null; scene.overrideMaterial = facing; renderer.shadowMap.autoUpdate = false;
    renderer.setClearColor(blank, 1);
    renderer.setRenderTarget(shapes);
    renderer.render(scene, camera);
    scene.background = sky; scene.overrideMaterial = null; renderer.shadowMap.autoUpdate = shadows;
    renderer.setClearColor(was, alpha);
    for (const o of hidden) o.visible = true;
    hidden.length = 0;
    renderer.setRenderTarget(null);
    renderer.render(sheet, camera);
  }
  return { key, name: look.name, render, resize };
}
