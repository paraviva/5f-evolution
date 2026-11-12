// acoustic-3d.js — Acoustic instruments 3D explorer (procedural, no external models)
// Astro drop-in: loaded on demand via importmap (three @0.160 from unpkg).
// Two products (acoustic camera + sound level meter).
//
// v2 redesign (driven by client reference — a glossy "exploded hero" with
// motion-blur / liquid sound streaks):
//   • NO leader lines — labels are line-free floating pills (the old blue
//     connectors read as clutter).
//   • Real-time sound waves: additive ripple rings emanate from the mic array
//     and travel forward, expanding + fading — a "sonar" pulse.
//   • "Flowing" energy: a soft particle field drifts/orbits around the product.
//   • Living motion: slow world spin + gentle bob so it is never static.
//   • Explode is a VIDEO-LIKE sequence: a single toggle plays a staggered,
//     eased explosion (parts peel apart one after another) or reassembles.
// Materials upgraded to glossy chrome + red emissive accents.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const SITE_ACCENT = 0x5fd0ff; // cyan "sound" colour (echoes 5fgeo accent)
const RED_ACCENT = 0xff2d2d;  // warm driver glow (echoes reference)

// ---------------------------------------------------------------------------
// small maths helpers
// ---------------------------------------------------------------------------
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
function smoothstep(a, b, x) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// soft round sprite for particles
function makeSpriteTexture() {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.65)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// Materials — glossy chrome + dark housing + red emissive accents
// ---------------------------------------------------------------------------
function buildMaterials(reg) {
  return {
    chrome: reg(new THREE.MeshStandardMaterial({ color: 0xe2e8ef, roughness: 0.14, metalness: 1.0 })),
    dark: reg(new THREE.MeshStandardMaterial({ color: 0x1c2026, roughness: 0.42, metalness: 0.85 })),
    mid: reg(new THREE.MeshStandardMaterial({ color: 0x39414c, roughness: 0.32, metalness: 0.95 })),
    mic: reg(new THREE.MeshStandardMaterial({ color: 0xc2cad4, roughness: 0.22, metalness: 1.0 })),
    foam: reg(new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.92, metalness: 0.0, transparent: true, opacity: 0.72 })),
    screen: reg(new THREE.MeshStandardMaterial({ color: 0x05101c, roughness: 0.12, metalness: 0.2, emissive: RED_ACCENT, emissiveIntensity: 0.0 })),
    redGlow: reg(new THREE.MeshStandardMaterial({ color: 0x2a0a0a, roughness: 0.3, metalness: 0.6, emissive: RED_ACCENT, emissiveIntensity: 1.3 })),
    accent: reg(new THREE.MeshStandardMaterial({ color: 0x4ea1ff, roughness: 0.3, metalness: 0.7, emissive: 0x123a66, emissiveIntensity: 0.45 })),
  };
}

// ---------------------------------------------------------------------------
// Builder — { group, parts, inst, labels }
//   parts:  [{ mesh, home, explode, delay }]  (delay drives staggered explosion)
//   inst:   [{ mesh, homes, offsets, count }]
//   labels: [{ anchor, title, sub, node, w, h, it }]
// ---------------------------------------------------------------------------
function makeBuilder(reg, mat) {
  const group = new THREE.Group();
  const parts = [];
  const inst = [];
  const labels = [];
  let dCounter = 0;
  function add(mesh, home, explode, label, delayOverride) {
    mesh.position.copy(home);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh);
    const rec = { mesh, home: home.clone(), explode: explode.clone(), delay: delayOverride != null ? delayOverride : (dCounter++ * 0.085) };
    parts.push(rec);
    if (label) {
      const anchor = new THREE.Object3D();
      anchor.position.copy(label.offset || new THREE.Vector3());
      mesh.add(anchor);
      labels.push({ anchor, title: label.title, sub: label.sub, node: null, w: 0, h: 0, it: { x: 0, y: 0, tx: 0, ty: 0 } });
    }
    return rec;
  }
  return { group, parts, inst, labels, add };
}

function buildCamera(reg, mat) {
  const b = makeBuilder(reg, mat);
  const PANEL = 5;
  const N = 11, span = PANEL * 0.78, step = span / (N - 1);

  // front bezel
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(PANEL, PANEL, 0.22), mat.dark);
  b.add(bezel, new THREE.Vector3(0, 0, 0.42), new THREE.Vector3(0, 0, 2.6),
    { title: 'Front Bezel', sub: 'Acoustic-transparent grille' });

  // mic array (instanced MEMS capsules) — blooms forward + radially on explode
  const micGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.34, 12);
  micGeo.rotateX(Math.PI / 2);
  const micMesh = new THREE.InstancedMesh(micGeo, mat.mic, N * N);
  micMesh.castShadow = true;
  const homes = [], offsets = [];
  const m = new THREE.Matrix4();
  let idx = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = -span / 2 + i * step;
      const y = -span / 2 + j * step;
      m.makeTranslation(x, y, 0);
      micMesh.setMatrixAt(idx, m);
      homes.push(new THREE.Vector3(x, y, 0));
      offsets.push(new THREE.Vector3(x * 0.18, y * 0.18, 1.25));
      idx++;
    }
  }
  micMesh.instanceMatrix.needsUpdate = true;
  b.group.add(micMesh);
  b.inst.push({ mesh: micMesh, homes, offsets, count: idx });
  const arrAnchor = new THREE.Object3D(); arrAnchor.position.set(0, 0, 0); micMesh.add(arrAnchor);
  b.labels.push({ anchor: arrAnchor, title: 'Mic Array · 121× MEMS', sub: 'Beamforming sensors',
    node: null, w: 0, h: 0, it: { x: 0, y: 0, tx: 0, ty: 0 } });

  // PCB / DSP core
  const pcb = new THREE.Mesh(new THREE.BoxGeometry(PANEL * 0.8, PANEL * 0.8, 0.12), mat.mid);
  b.add(pcb, new THREE.Vector3(0, 0, 0.06), new THREE.Vector3(0, 0, 0.0),
    { title: 'PCB / DSP', sub: 'Signal processing board' });

  // central camera module + red emissive ring (the "driver glow")
  const capGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.5, 28); capGeo.rotateX(Math.PI / 2);
  const cap = new THREE.Mesh(capGeo, mat.chrome);
  b.add(cap, new THREE.Vector3(0, 0, 0.78), new THREE.Vector3(0, 0, 3.4),
    { title: 'Camera Module', sub: 'Optical reference' });
  const ringGeo = new THREE.TorusGeometry(0.62, 0.07, 16, 40);
  const ring = new THREE.Mesh(ringGeo, mat.redGlow);
  ring.position.set(0, 0, 0.82);
  b.add(ring, new THREE.Vector3(0, 0, 0.82), new THREE.Vector3(0, 0, 3.5), null, 0.05);

  // rear housing
  const back = new THREE.Mesh(new THREE.BoxGeometry(PANEL * 0.99, PANEL * 0.99, 0.5), mat.dark);
  b.add(back, new THREE.Vector3(0, 0, -0.5), new THREE.Vector3(0, 0, -2.8),
    { title: 'Rear Housing', sub: 'Sealed enclosure' });

  // rear display (pulses red)
  const screen = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.4, 0.06), mat.screen);
  b.add(screen, new THREE.Vector3(0, -1.3, -0.6), new THREE.Vector3(0, 0, -3.6),
    { title: 'Display', sub: 'Live acoustic map' });

  // handle
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 0.7), mat.dark);
  b.add(handle, new THREE.Vector3(0, -PANEL / 2 - 1.0, -0.1), new THREE.Vector3(0, -2.2, 0),
    { title: 'Handle', sub: 'Ergonomic grip' });

  b.pulseTargets = [screen, ring];
  return b;
}

function buildMeter(reg, mat) {
  const b = makeBuilder(reg, mat);

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.7, 4.2, 1.1), mat.dark);
  b.add(body, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0.0),
    { title: 'Main Body', sub: 'Ruggedised enclosure' });

  const capGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.7, 24);
  const cap = new THREE.Mesh(capGeo, mat.chrome);
  b.add(cap, new THREE.Vector3(0, 2.5, 0), new THREE.Vector3(0, 1.9, 0),
    { title: 'Mic Capsule', sub: 'Class 1 measurement mic' });

  const foamGeo = new THREE.CylinderGeometry(0.56, 0.56, 1.25, 24);
  const foam = new THREE.Mesh(foamGeo, mat.foam);
  b.add(foam, new THREE.Vector3(0, 3.0, 0), new THREE.Vector3(0, 2.9, 0),
    { title: 'Windscreen', sub: 'Wind / splash protection' });

  const screen = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.5, 0.06), mat.screen);
  b.add(screen, new THREE.Vector3(0, 0.5, 0.57), new THREE.Vector3(0, 0, 1.6),
    { title: 'Display', sub: 'SPL / spectrum readout' });

  const key = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.0, 0.06), mat.accent);
  b.add(key, new THREE.Vector3(0, -1.0, 0.57), new THREE.Vector3(0, 0, 1.4),
    { title: 'Keypad', sub: 'Menu / measurement keys' });

  const batGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.5, 20);
  const bat = new THREE.Mesh(batGeo, mat.mid);
  b.add(bat, new THREE.Vector3(0, -1.4, 0), new THREE.Vector3(0, -2.4, 0),
    { title: 'Battery', sub: 'Rechargeable pack' });

  const rear = new THREE.Mesh(new THREE.BoxGeometry(1.6, 4.1, 0.08), mat.chrome);
  b.add(rear, new THREE.Vector3(0, 0, -0.57), new THREE.Vector3(0, 0, -1.7),
    { title: 'Rear Case', sub: 'Battery / I/O cover' });

  b.pulseTargets = [screen];
  return b;
}

// ---------------------------------------------------------------------------
// Sound-wave ripples — additive rings that spawn at the array and travel +Z,
// expanding + fading (a continuous sonar pulse).
// ---------------------------------------------------------------------------
function createRipples(reg) {
  const group = new THREE.Group();
  const N = 10;
  const items = [];
  for (let i = 0; i < N; i++) {
    const geo = new THREE.RingGeometry(0.9, 1.0, 72);
    const mat = reg(new THREE.MeshBasicMaterial({
      color: SITE_ACCENT, transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false,
    }));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 0, 0.7);
    group.add(mesh);
    items.push({ mesh, mat, phase: i / N, speed: 0.16 + (i % 3) * 0.012 });
  }
  return { group, items };
}
function updateRipples(rip, dt, intensity) {
  for (const r of rip.items) {
    r.phase += dt * r.speed;
    if (r.phase >= 1) r.phase -= 1;
    const p = r.phase;
    const s = 0.45 + p * 6.0;
    r.mesh.scale.set(s, s, s);
    r.mesh.position.z = 0.7 + p * 4.2;
    const fade = Math.sin(Math.PI * p);
    r.mat.opacity = fade * 0.42 * intensity;
  }
}

// ---------------------------------------------------------------------------
// Flowing energy field — soft particles drifting + orbiting the product.
// ---------------------------------------------------------------------------
function createFlow(reg, sprite) {
  const N = 620;
  const pos = new Float32Array(N * 3);
  const data = [];
  for (let i = 0; i < N; i++) {
    const r = 2.7 + Math.random() * 2.6;
    const h = -3.4 + Math.random() * 6.8;
    const theta = Math.random() * Math.PI * 2;
    const spd = (0.18 + Math.random() * 0.5) * (Math.random() < 0.5 ? 1 : -1);
    const vy = 0.12 + Math.random() * 0.32;
    const phase = Math.random() * Math.PI * 2;
    data.push({ r, h, theta, spd, vy, phase });
    pos[i * 3] = r * Math.cos(theta);
    pos[i * 3 + 1] = h;
    pos[i * 3 + 2] = r * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = reg(new THREE.PointsMaterial({
    color: SITE_ACCENT, size: 0.085, map: sprite, transparent: true,
    opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false,
    sizeAttenuation: true,
  }));
  const points = new THREE.Points(geo, mat);
  return { points, geo, data };
}
function updateFlow(flow, dt) {
  const arr = flow.geo.attributes.position.array;
  for (let i = 0; i < flow.data.length; i++) {
    const d = flow.data[i];
    d.theta += d.spd * dt;
    d.h += d.vy * dt;
    if (d.h > 3.4) d.h = -3.4;
    const wob = 0.3 * Math.sin(d.theta * 3 + d.phase);
    arr[i * 3] = (d.r + wob) * Math.cos(d.theta);
    arr[i * 3 + 1] = d.h;
    arr[i * 3 + 2] = (d.r + wob) * Math.sin(d.theta);
  }
  flow.geo.attributes.position.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// mountAcoustic3D — main entry. Returns the public API.
// ---------------------------------------------------------------------------
export function mountAcoustic3D(el, opts = {}) {
  const canvas = el.querySelector('[data-ac-canvas]');
  const labelLayer = el.querySelector('[data-ac-labels]');
  const hudEl = el.querySelector('[data-ac-hud]');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 640px)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0e13);

  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 100);
  const DEFAULT_CAM = new THREE.Vector3(7, 4.2, 11);
  const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);
  camera.position.copy(DEFAULT_CAM);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(DEFAULT_TARGET);
  controls.minDistance = 4;
  controls.maxDistance = 28;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.update();

  // world group: product + effects share rotation/bob (keeps ripples aligned)
  const world = new THREE.Group();
  scene.add(world);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const dir = new THREE.DirectionalLight(0xffffff, 2.2);
  dir.position.set(8, 12, 9);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 1; dir.shadow.camera.far = 40;
  dir.shadow.camera.left = -12; dir.shadow.camera.right = 12;
  dir.shadow.camera.top = 12; dir.shadow.camera.bottom = -12;
  dir.shadow.normalBias = 0.02; dir.shadow.bias = -0.0002;
  scene.add(dir);
  const fill1 = new THREE.DirectionalLight(0xbcd2ff, 0.55); fill1.position.set(-10, 6, -6); scene.add(fill1);
  const fill2 = new THREE.DirectionalLight(0xffffff, 0.35); fill2.position.set(0, 4, -10); scene.add(fill2);
  scene.add(new THREE.AmbientLight(0xffffff, 0.22));

  // products
  const allMaterials = [];
  const reg = (m) => { allMaterials.push(m); return m; };
  const mat = buildMaterials(reg);
  const sprite = makeSpriteTexture();
  const products = { camera: buildCamera(reg, mat), meter: buildMeter(reg, mat) };
  Object.values(products).forEach((p) => world.add(p.group));

  const rip = createRipples(reg); world.add(rip.group);
  const flow = createFlow(reg, sprite); world.add(flow.points);

  // label DOM nodes (line-free pills)
  Object.values(products).forEach((p) => {
    p.labels.forEach((l) => {
      const node = document.createElement('div');
      node.className = 'ac-label';
      node.innerHTML = `<b>${l.title}</b><small>${l.sub}</small>`;
      labelLayer.appendChild(node);
      l.node = node;
    });
  });

  const state = { explode: 0, exploded: false, autoRotate: true, labelsOn: !isMobile, product: 'camera' };

  // explode animation (video-like, staggered, eased)
  const EXPLODE_DUR = 1.9;
  let expFrom = 0, expTo = 0, expP = 1, expRunning = false;

  let active = products[state.product];
  let activeParts = active.parts;
  let activeInst = active.inst;
  let activeLabels = active.labels;

  const SPAN = 0.55;
  function partLocal(g, delay) { return smoothstep(0, 1, clamp01((g - delay) / SPAN)); }

  function applyExplode(g) {
    for (const p of activeParts) {
      const a = partLocal(g, p.delay);
      p.mesh.position.set(
        p.home.x + p.explode.x * a,
        p.home.y + p.explode.y * a,
        p.home.z + p.explode.z * a,
      );
    }
    for (const ip of activeInst) {
      const mtx = new THREE.Matrix4();
      for (let i = 0; i < ip.count; i++) {
        const h = ip.homes[i], o = ip.offsets[i];
        const a = partLocal(g, 0);
        mtx.makeTranslation(h.x + o.x * a, h.y + o.y * a, h.z + o.z * a);
        ip.mesh.setMatrixAt(i, mtx);
      }
      ip.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  function applyVisibility() {
    Object.entries(products).forEach(([key, p]) => {
      const on = key === state.product;
      p.group.visible = on;
      p.labels.forEach((l) => { l.node.style.display = (on && state.labelsOn && !isMobile) ? '' : 'none'; });
    });
  }

  function setProduct(name) {
    if (!products[name]) return;
    state.product = name;
    active = products[name];
    activeParts = active.parts; activeInst = active.inst; activeLabels = active.labels;
    applyExplode(state.explode);
    applyVisibility();
    camGoal = { pos: DEFAULT_CAM.clone(), target: DEFAULT_TARGET.clone() };
  }

  function toggleExplode() {
    if (reduceMotion) { // still allow but snap
      state.exploded = !state.exploded; state.explode = state.exploded ? 1 : 0;
      expFrom = state.explode; expTo = state.explode; expP = 1; expRunning = false;
      applyExplode(state.explode); return state.exploded;
    }
    expFrom = state.explode;
    state.exploded = !state.exploded;
    expTo = state.exploded ? 1 : 0;
    expP = 0; expRunning = true;
    return state.exploded;
  }

  applyExplode(0);
  applyVisibility();

  let camGoal = null;
  controls.addEventListener('start', () => { camGoal = null; });

  // ---- per-frame label follow (no lines) ----
  function updateLabels(W, H, dt) {
    if (!state.labelsOn) return;
    const k = 1 - Math.exp(-dt * 18);
    const tmp = new THREE.Vector3();
    const labelAlpha = smoothstep(0.35, 0.75, state.explode);
    for (const l of activeLabels) {
      l.node.style.opacity = state.labelsOn && !isMobile ? labelAlpha.toFixed(3) : '0';
      if (labelAlpha < 0.02) continue;
      l.anchor.getWorldPosition(tmp);
      tmp.project(camera);
      if (tmp.z > 1) { l.node.style.opacity = '0'; continue; }
      const sx = (tmp.x * 0.5 + 0.5) * W;
      const sy = (-tmp.y * 0.5 + 0.5) * H;
      const tx = Math.max(8, Math.min(W - (l.w || 110) - 8, sx + 14));
      const ty = Math.max(8, Math.min(H - (l.h || 30) - 8, sy - (l.h || 30) - 10));
      l.it.tx = tx; l.it.ty = ty;
    }
    // smooth translate
    for (const l of activeLabels) {
      l.it.x += (l.it.tx - l.it.x) * k;
      l.it.y += (l.it.ty - l.it.y) * k;
      l.node.style.translate = `${l.it.x}px ${l.it.y}px`;
    }
  }

  function measureLabels() {
    Object.values(products).forEach((p) => p.labels.forEach((l) => { l.w = l.node.offsetWidth; l.h = l.node.offsetHeight; }));
  }

  // ---- render loop ----
  let raf = null, running = false, last = performance.now();
  let frames = 0, fpsAccum = 0, fps = 60, bootFrames = 0, bootFpsSum = 0, quality = 'Auto';

  function resize() {
    const w = el.clientWidth || canvas.clientWidth || 960;
    const h = Math.min(620, Math.round(w * 9 / 16));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    canvas.style.height = h + 'px';
  }

  function tick(now) {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    frames++; fpsAccum += dt;
    if (fpsAccum >= 0.5) { fps = frames / fpsAccum; frames = 0; fpsAccum = 0; }
    renderFrame(dt);
  }

  function renderFrame(dt) {
    const t = performance.now() / 1000;

    // explode tween
    if (expRunning) {
      expP += dt / EXPLODE_DUR;
      if (expP >= 1) { expP = 1; expRunning = false; }
      state.explode = expFrom + (expTo - expFrom) * easeInOutCubic(expP);
      applyExplode(state.explode);
    }

    // living motion: world spin + gentle bob (always, for "dynamic" feel)
    if (state.autoRotate && !reduceMotion) world.rotation.y += dt * 0.18;
    world.position.y = Math.sin(t * 0.6) * 0.12;

    // pulse emissive accents (the "driver glow")
    const pulse = 0.55 + 0.45 * Math.sin(t * 2.0);
    active.pulseTargets.forEach((m) => {
      if (m.material && 'emissiveIntensity' in m.material) m.material.emissiveIntensity = (m.material === mat.screen ? 0.5 : 1.0) * pulse;
    });

    // sound waves + flow
    const waveIntensity = 0.35 + 0.65 * (0.4 + 0.6 * Math.sin(t * 0.8)); // breathing
    updateRipples(rip, dt, waveIntensity);
    updateFlow(flow, dt * (state.exploded ? 1.3 : 1.0));

    // camera tween
    if (camGoal) {
      camera.position.lerp(camGoal.pos, 1 - Math.exp(-dt * 3));
      controls.target.lerp(camGoal.target, 1 - Math.exp(-dt * 3));
      if (camera.position.distanceTo(camGoal.pos) < 0.4) camGoal = null;
    }
    controls.update();

    const W = renderer.domElement.clientWidth, H = renderer.domElement.clientHeight;
    updateLabels(W, H, dt);
    renderer.render(scene, camera);

    if (bootFrames < 30) {
      bootFrames++; bootFpsSum += fps;
      if (bootFrames === 30) {
        const avg = bootFpsSum / 30;
        if (avg < 45) { renderer.setPixelRatio(1.0); renderer.shadowMap.enabled = false; quality = 'Low'; }
        else quality = 'High';
      }
    }
    if (hudEl) hudEl.textContent = `Quality: ${quality} · ${fps.toFixed(0)} fps`;
  }

  function start() {
    if (running) return;
    running = true; last = performance.now();
    raf = requestAnimationFrame(tick);
  }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) { if (e.isIntersecting) start(); else stop(); }
    }, { threshold: 0.05 });
    io.observe(el);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
  window.addEventListener('resize', () => {
    resize();
    requestAnimationFrame(measureLabels);
  });

  requestAnimationFrame(measureLabels);
  resize();
  start();

  return {
    toggleExplode,
    setAutoRotate: (on) => { state.autoRotate = !!on; },
    setLabels: (on) => { state.labelsOn = !!on; applyVisibility(); },
    setProduct: (name) => setProduct(name),
    reset: () => {
      state.explode = 0; state.exploded = false; expP = 1; expRunning = false;
      applyExplode(0);
      camGoal = { pos: DEFAULT_CAM.clone(), target: DEFAULT_TARGET.clone() };
    },
    getState: () => ({ ...state, fps }),
    dispose: () => {
      stop();
      controls.dispose();
      renderer.dispose();
      pmrem.dispose();
      sprite.dispose();
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    },
  };
}
