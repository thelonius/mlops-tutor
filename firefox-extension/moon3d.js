/* moon3d.js — Three.js 3D-Луна. Порт newtab-svelte/src/Moon3D.svelte из
 * adaptive-astro-scheduler с двумя добавлениями:
 *   1. реальные текстуры поверхности (moon_color + moon_bump) вместо плоского
 *      цвета — даёт мор́я и кратеры на терминаторе;
 *   2. цвет «солнца» берётся из палитры часа (accent), ambient — из палитры
 *      дня, так фаза подсвечивается в цвете текущего планетарного часа.
 *
 * Терминатор тут — настоящее направленное освещение сферы (а не SVG-эллипс),
 * поэтому фаза физически корректна на любой иллюминации.
 */
import * as THREE from './vendor/three.module.min.js';

export function createMoon3D(container) {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(0, 0.15, 3);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // ACES тон-маппинг — мягкий ролл-офф ярких бликов, чтобы освещённый серп
  // светился, а не клиппился в белый. Exposure чуть выше 1.
  if (THREE.ACESFilmicToneMapping) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
  }
  container.appendChild(renderer.domElement);

  const loader = new THREE.TextureLoader();
  const colorMap = loader.load('textures/moon_color.jpg');
  const bumpMap = loader.load('textures/moon_bump.jpg');
  if ('colorSpace' in colorMap) colorMap.colorSpace = THREE.SRGBColorSpace;

  const geometry = new THREE.SphereGeometry(1, 96, 96);
  const material = new THREE.MeshStandardMaterial({
    map: colorMap,
    bumpMap: bumpMap,
    bumpScale: 1.4,
    roughness: 1.0,
    metalness: 0.0,
  });
  const moon = new THREE.Mesh(geometry, material);
  scene.add(moon);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.22);
  scene.add(ambientLight);

  // Направленный «солнечный» свет — основной источник, рисует терминатор.
  const sunLight = new THREE.DirectionalLight(0xffffff, 4.2);
  sunLight.target = moon;
  scene.add(sunLight);

  // Rim-свет сзади — чтобы тонкий серп не пропадал в темноте.
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.28);
  rimLight.position.set(0, 0, -5);
  scene.add(rimLight);

  let illumination = 0.5;
  let isWaxing = true;

  // Угол источника света по фазе (как в оригинале Moon3D.svelte):
  //   illum 0 → новолуние (свет сзади), 0.5 → четверть (сбоку), 1 → полнолуние.
  //   waxing — свет справа-налево, waning — слева-направо.
  function placeSun() {
    const angle = isWaxing
      ? Math.PI - illumination * Math.PI
      : -Math.PI + illumination * Math.PI;
    const d = 5;
    sunLight.position.set(Math.sin(angle) * d, 0, Math.cos(angle) * d);
  }
  placeSun();

  let raf = null;
  function frame() {
    raf = requestAnimationFrame(frame);
    moon.rotation.y += 0.0008; // лёгкая ротация
    renderer.render(scene, camera);
  }
  frame();

  function resize() {
    // Контейнер может быть 0×0 на момент создания (grid-ячейка до раскладки) —
    // тогда берём квадрат по меньшей стороне вьюпорта.
    const r = container.getBoundingClientRect();
    let s = Math.min(r.width, r.height);
    if (s < 10) s = Math.min(window.innerWidth, window.innerHeight) * 0.92;
    s = Math.max(1, Math.round(s));
    renderer.setSize(s, s, false);
    renderer.domElement.style.width = s + 'px';
    renderer.domElement.style.height = s + 'px';
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  window.addEventListener('resize', resize);

  return {
    /** @param {{illumination:number,isWaxing:boolean,sunColor?:string,ambientColor?:string,bodyTint?:string}} p */
    update(p) {
      illumination = p.illumination;
      isWaxing = p.isWaxing;
      placeSun();
      if (p.sunColor) sunLight.color.set(p.sunColor);
      if (p.ambientColor) {
        ambientLight.color.set(p.ambientColor);
        rimLight.color.set(p.ambientColor);
      }
      // Лёгкий оттенок поверхности от палитры (texture × tint).
      material.color.set(p.bodyTint || '#ffffff');
    },
    dispose() {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', resize);
      geometry.dispose();
      material.dispose();
      colorMap.dispose();
      bumpMap.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    },
  };
}
