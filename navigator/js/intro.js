// Part of Moon-jigi Lunar Landing Site Navigator (NASA Space Apps 2026). Written with AI assistance (Anthropic Claude), directed and reviewed by the team.
// Opening shot, ~3.5 s: the Moon as we see it from Earth (near side, north up), then it tips forward so the
// south pole turns to face us with Earth's direction up, as on every map here, and we glide in.
// Plays once per tab session, only on the bare URL; any click or key skips it; off with reduced motion.
const KEY = 'mj-intro';

export function shouldPlay() {
  try { if (sessionStorage.getItem(KEY)) return false; } catch (e) { /* storage off: play */ }
  return !!window.__fresh && !matchMedia('(prefers-reduced-motion: reduce)').matches && typeof WebGLRenderingContext !== 'undefined';
}

export function play() {
  try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* ignore */ }
  const box = document.createElement('div');
  box.id = 'intro';
  document.body.appendChild(box);
  let done = false, raf = 0, renderer = null;
  const end = (why) => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    removeEventListener('keydown', end, true); box.removeEventListener('pointerdown', end);
    box.classList.add('out');
    setTimeout(() => { box.remove(); renderer?.dispose(); }, 600);
  };
  addEventListener('keydown', end, true); box.addEventListener('pointerdown', end);
  setTimeout(() => { if (!renderer) end(); }, 2500);   // texture or Three.js too slow: just show the app

  import('../map3d/vendor/three.module.js').then(THREE => {
    if (done) return;
    const tex = new THREE.TextureLoader().load('data/moon.jpg', () => { if (!done) start(); }, undefined, end);
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
      scene.add(new THREE.AmbientLight(0xffffff, 0.25));
      const sun = new THREE.DirectionalLight(0xffffff, 2.4); sun.position.set(-2, 0.5, 1.2); scene.add(sun);
      const fit = 1 / Math.tan(15 * Math.PI / 180);   // distance at which the whole disc just fills the height
      const A0 = fit * 1.5 - 1, A1 = 0.8;   // altitude above the surface, in Moon radii: zoom in geometrically
      const ease = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
      const t0 = performance.now() - (+window.__introAt || 0) * 1000, hold = window.__introAt != null;
      const frame = now => {
        const s = (now - t0) / 1000;
        tilt.rotation.x = -Math.PI / 2 * ease((s - 0.5) / 1.6);   // south pole comes to face us, the near side rises to the top
        const d = 1 + A0 * (A1 / A0) ** ease((s - 1.1) / 1.9);
        cam.position.set(0, 0, d); cam.lookAt(0, 0, 0);
        renderer.render(scene, cam);
        if (hold) return;
        if (s > 3.2) return end();
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      addEventListener('resize', () => { if (done) return; renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); });
    }
  }).catch(end);
}
