// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Opening shot, ~3 s: the Moon as we see it from Earth (near side, north up), then it tips forward so the
// south pole turns to face us with Earth's direction up, as on every map here, and we glide in.
// Start screen: it first stops on the near side under the title; a click, tap or key starts the tip and glide, and
// another one then skips to the map. Only on the bare URL (a link with a #hash goes straight in); off with reduced motion.
import { t } from './strings.js';

export function shouldPlay() {
  return !!window.__fresh && !matchMedia('(prefers-reduced-motion: reduce)').matches && typeof WebGLRenderingContext !== 'undefined';
}

// handover to the 3D map: 'none' | 'playing' | 'done' | 'skipped'; arrived resolves when the shot reaches its last frame
// (the top view straight down on the pole from ~1,400 km, Earth up), where the map takes over and keeps going down
export let phase = 'none';
let release = () => {}, arrive = () => {};
export const arrived = new Promise(r => { arrive = r; });
export const handOver = () => release();
const MAX_HOLD = 6000;   // the map not ready by then: fade out anyway

export function play() {
  phase = 'playing';
  const box = document.createElement('div');
  box.id = 'intro';
  box.innerHTML = `<div class="intro-title"><h1>Lunar Landing Site Navigator</h1><span class="intro-by">by Moon-jigi</span><p>${t('introSub')}</p><small>${t('introGo')}</small></div>`;
  document.body.appendChild(box);
  let done = false, raf = 0, renderer = null;
  const end = (why) => {
    if (done) return;
    done = true;
    phase = why && why.type ? 'skipped' : phase === 'playing' ? 'done' : phase;
    arrive();
    cancelAnimationFrame(raf);
    removeEventListener('keydown', press, true); box.removeEventListener('pointerdown', press);
    box.classList.add('out');
    setTimeout(() => { box.remove(); renderer?.dispose(); }, 600);
  };
  // stopped on the near side: the first press starts the shot (the title fades), any later one skips it
  let waiting = true, go = () => {};
  const press = e => {
    if (e.type === 'keydown' && (e.metaKey || e.ctrlKey || e.altKey || /^(Shift|Control|Alt|Meta|Tab|F\d+)$/.test(e.key))) return;
    if (waiting) { waiting = false; e.preventDefault(); e.stopPropagation(); box.classList.add('go'); go(); return; }
    end(e);
  };
  addEventListener('keydown', press, true); box.addEventListener('pointerdown', press);
  setTimeout(() => { if (!renderer) { phase = 'skipped'; end(); } }, 6000);   // texture or Three.js too slow: just show the app

  import('../map3d/vendor/three.module.js').then(THREE => {
    if (done) return;
    const tex = new THREE.TextureLoader().load('data/moon.jpg', () => { if (!done) start(); }, undefined, () => { phase = 'skipped'; end(); });
    function start() {
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(innerWidth, innerHeight);
      box.appendChild(renderer.domElement);
      tex.colorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.01, 100);
      const tilt = new THREE.Group(), moon = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshLambertMaterial({ map: tex }));
      moon.rotation.y = -Math.PI / 2;   // longitude 0 (the sub-Earth point) toward the camera, east to the right
      tilt.add(moon); scene.add(tilt);
      const WHITE = new THREE.Color(0xffffff), DIM = new THREE.Color(0x474b54).multiplyScalar(1.6);
      scene.add(new THREE.AmbientLight(0xffffff, 0.25));
      const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(-2, 0.5, 1.2); scene.add(sun);
      const fit = 1 / Math.tan(15 * Math.PI / 180);   // distance at which the whole disc just fills the height
      const A0 = fit * 1.5 - 1, A1 = 0.8;   // altitude above the surface, in Moon radii: zoom in geometrically
      const ease = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
      const PAUSE = 0.5;   // s: the near side, still, under the title, until the first press
      let t0 = performance.now() - (+window.__introAt || 0) * 1000;
      const hold = window.__introAt != null;
      let held = false;
      const frame = now => {
        let s = (now - t0) / 1000;
        if (waiting && !hold && s >= PAUSE) s = PAUSE;
        tilt.rotation.x = -Math.PI / 2 * ease((s - 0.5) / 1.6);   // south pole comes to face us, the near side rises to the top
        const d = 1 + A0 * (A1 / A0) ** ease((s - 1.1) / 1.9);
        cam.position.set(0, 0, d); cam.lookAt(0, 0, 0);
        moon.material.color.lerpColors(WHITE, DIM, ease((s - 1.8) / 1.4));   // dims to the map's darkened globe
        renderer.render(scene, cam);
        if (hold) return;
        if (waiting && s >= PAUSE) { go = () => { t0 = performance.now() - PAUSE * 1000; raf = requestAnimationFrame(frame); }; return; }
        if (s > 3.2) {   // hold the last frame until the map below is in the same place, then fade
          if (!held) { held = true; arrive(); release = () => end(); setTimeout(end, MAX_HOLD); }
          return;
        }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      addEventListener('resize', () => { if (done) return; renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); });
    }
  }).catch(() => { phase = 'skipped'; end(); });
}
