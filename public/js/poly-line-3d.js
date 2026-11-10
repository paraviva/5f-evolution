// poly-line-3d.js — PET production line 3D explorer (procedural, no external models)
// Astro drop-in: loaded on demand via importmap (three @0.160 from unpkg).
// Follows the 18-item pit list from the source prompt.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// ---------------------------------------------------------------------------
// Stage definitions (business domain only — swap for a new product line)
// ---------------------------------------------------------------------------
const STAGES = [
  { id: 's1', name: 'PTA / EG Feeding & Slurry Prep', short: 'SLURRY PREP',
    x: -28, type: 'slurry', color: 0x6fa8dc,
    param: 'slurry ~65 wt% · ambient', sub: 'Dry PTA and liquid EG are metered and mixed into a homogeneous slurry feed.' },
  { id: 's2', name: 'Esterification Reactor', short: 'ESTERIFICATION',
    x: -20, type: 'tower', color: 0xd9a05b,
    param: '255 °C · 0.12 MPa(G)', sub: 'Water-forming ester bonds build the oligomer; esterification ratio exceeds 96%.' },
  { id: 's3', name: 'Pre-Polycondensation', short: 'PRE-POLYCOND',
    x: -12, type: 'kettle', color: 0xd9a05b,
    param: '275 °C · 15 kPa(a)', sub: 'Viscosity rises as short chains couple; vacuum begins driving off glycol.' },
  { id: 's4', name: 'Finish Polycondensation', short: 'FINISH POLYCOND',
    x: -4, type: 'horizontal', color: 0xd9a05b,
    param: '282 °C · <100 Pa', sub: 'The disc-ring reactor pushes intrinsic viscosity to fibre or bottle grade.' },
  { id: 's5', name: 'Melt Filtration & Boost Pump', short: 'FILTER + PUMP',
    x: 4, type: 'filterpump', color: 0xd9a05b,
    param: 'melt IV 0.60–0.64 dl/g', sub: 'Dual filters catch gel particles; the gear pump holds stable melt pressure.' },
  { id: 's6', name: 'Underwater Cutting & Dewatering', short: 'CUT + DEWATER',
    x: 12, type: 'pelletizer', color: 0x5aa9a3,
    param: 'chip 2.5×3 mm', sub: 'Melt strands are cut underwater into chips, then spun-dried and conveyed.' },
  { id: 's7', name: 'Chip Silos & Bagging', short: 'SILO + BAG',
    x: 20, type: 'silos', color: 0x9aa0a6,
    param: 'moisture <0.4%', sub: 'Chips are buffered in silos and automatically bagged for shipment.' },
  { id: 's8', name: 'Utility Island', short: 'UTILITIES',
    x: 28, type: 'utility', color: 0x8a8f98,
    param: 'HTM 320 °C · vac <100 Pa', sub: 'Heat-transfer oil, vacuum ejectors and cooling tower supply the line.' },
];

// Pipe media colours
const MEDIA = { melt: 0xd9a05b, eg: 0x6fa8dc, steam: 0xe8e8e8, water: 0x5aa9a3, vacuum: 0x9aa0a6 };

// Material presets
const MAT_PRESETS = {
  'SS316L': { color: 0xc9d2dc, roughness: 0.32, metalness: 0.92 },
  'SS304':  { color: 0xd8c9b0, roughness: 0.42, metalness: 0.86 },
  'CARBON': { color: 0x4a4f57, roughness: 0.62, metalness: 0.55 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function vesselProfile(r, h) {
  // Lathe profile (radius, height) for a vertical vessel with elliptical heads.
  // pit 1: phiStart=PI, phiLength=2PI avoids the spiral seam facing camera.
  const p = [];
  p.push(new THREE.Vector2(0.0, 0.0));
  p.push(new THREE.Vector2(r * 0.45, h * 0.04));
  p.push(new THREE.Vector2(r * 0.82, h * 0.11));
  p.push(new THREE.Vector2(r, h * 0.18));
  p.push(new THREE.Vector2(r, h * 0.80));
  p.push(new THREE.Vector2(r * 0.92, h * 0.88));
  p.push(new THREE.Vector2(r * 0.55, h * 0.95));
  p.push(new THREE.Vector2(0.0, h));
  return p;
}

function makeLathe(r, h, mat) {
  const geo = new THREE.LatheGeometry(vesselProfile(r, h), 48, Math.PI, Math.PI * 2);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

// ---------------------------------------------------------------------------
// mountPolyLine3D — main entry. Returns the public API.
// ---------------------------------------------------------------------------
export function mountPolyLine3D(el, opts = {}) {
  const canvas = el.querySelector('[data-pl-canvas]');
  const labelLayer = el.querySelector('[data-pl-labels]');
  const leadLayer = el.querySelector('[data-pl-leads]');
  const hudEl = el.querySelector('[data-pl-hud]');
  const subEl = el.querySelector('[data-pl-subtitle]') || (() => {
    const d = document.createElement('div'); d.setAttribute('data-pl-subtitle', ''); return d;
  })();

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 640px)').matches;

  // --- renderer ---
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); // pit: DPR capped at 1.5
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // pit: PCF, not PCFSoft
  renderer.localClippingEnabled = true;
  const baseDPR = renderer.getPixelRatio();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1116);

  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.5, 1000);
  const DEFAULT_CAM = new THREE.Vector3(28, 18, 34);
  const DEFAULT_TARGET = new THREE.Vector3(0, 6, 0);
  camera.position.copy(DEFAULT_CAM);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(DEFAULT_TARGET);
  controls.minDistance = 12;
  controls.maxDistance = 90;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.update();

  // --- environment (PMREM + RoomEnvironment, run once) ---
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // --- lights (no PointLight — pit 8) ---
  const dir = new THREE.DirectionalLight(0xffffff, 2.1);
  dir.position.set(22, 34, 18);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024); // pit: 1024²
  dir.shadow.camera.near = 1;
  dir.shadow.camera.far = 120;
  dir.shadow.camera.left = -50; dir.shadow.camera.right = 50;
  dir.shadow.camera.top = 50; dir.shadow.camera.bottom = -50;
  dir.shadow.normalBias = 0.02; // pit 2
  dir.shadow.bias = -0.0002;
  scene.add(dir);
  const fill1 = new THREE.DirectionalLight(0xbcd2ff, 0.5); fill1.position.set(-30, 18, -10); scene.add(fill1);
  const fill2 = new THREE.DirectionalLight(0xffffff, 0.35); fill2.position.set(0, 8, -30); scene.add(fill2);
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));

  // --- shared registries ---
  const metalMeshes = [];   // for material toggle
  const insMeshes = [];     // for insulation toggle
  const allMaterials = [];  // for clipping planes
  const stageGroups = [];   // for focus / capacity / explode
  const stageById = {};
  const steelData = [];     // instanced steel (pipe rack)
  const flowSystem = { curves: [], instanced: null, count: 0, t: 0 };

  function regMat(m) { allMaterials.push(m); return m; }
  function newMetalMat(preset) {
    const p = MAT_PRESETS[preset] || MAT_PRESETS.SS316L;
    const m = new THREE.MeshStandardMaterial({ color: p.color, roughness: p.roughness, metalness: p.metalness });
    regMat(m); return m;
  }

  // --- per-stage builders ------------------------------------------------
  function buildVertical(group, r, h, preset) {
    const mat = newMetalMat(preset);
    const mesh = makeLathe(r, h, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh); metalMeshes.push(mesh);
    // insulation shell (slightly larger, light rough)
    const insMat = regMat(new THREE.MeshStandardMaterial({ color: 0xb9bec6, roughness: 0.95, metalness: 0.0 }));
    const ins = makeLathe(r + 0.06, h, insMat);
    ins.castShadow = false; ins.visible = true;
    group.add(ins); insMeshes.push(ins);
    return mesh;
  }

  function buildStage(def) {
    const g = new THREE.Group();
    g.position.set(def.x, 0, 0);
    g.userData.stageId = def.id;
    g.userData.baseX = def.x;
    let anchor = new THREE.Vector3(def.x, 7, 0);

    if (def.type === 'slurry') {
      const m1 = buildVertical(g, 1.1, 6, 'SS304'); m1.position.set(-1.2, 0, 0);
      const m2 = buildVertical(g, 1.1, 6, 'SS304'); m2.position.set(1.2, 0, 0);
      const tank = buildVertical(g, 1.8, 5, 'SS304'); tank.position.set(0, 0, 2.4);
      anchor.set(def.x, 8.5, 0);
    } else if (def.type === 'tower') {
      const m = buildVertical(g, 1.8, 11, 'SS316L');
      // 5 internal trays (visible when sectioned)
      const trayMat = regMat(new THREE.MeshStandardMaterial({ color: 0x8a9098, roughness: 0.6, metalness: 0.7 }));
      for (let i = 0; i < 5; i++) {
        const tray = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.12, 32, 1, false, 0, Math.PI * 2), trayMat);
        tray.position.y = 2 + i * 1.7; g.add(tray);
      }
      anchor.set(def.x, 12, 0);
    } else if (def.type === 'kettle') {
      const m = buildVertical(g, 2.0, 9, 'SS316L');
      anchor.set(def.x, 10, 0);
    } else if (def.type === 'horizontal') {
      // horizontal disc-ring reactor
      const r = 1.7, len = 7;
      const bodyMat = newMetalMat('SS316L');
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 40), bodyMat);
      body.rotation.z = Math.PI / 2; body.castShadow = true; body.receiveShadow = true;
      g.add(body); metalMeshes.push(body);
      const capMat = bodyMat;
      for (const sx of [-1, 1]) {
        const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
        cap.rotation.z = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
        cap.position.x = sx * len / 2; g.add(cap);
      }
      // internal discs
      const discMat = regMat(new THREE.MeshStandardMaterial({ color: 0x9097a0, roughness: 0.55, metalness: 0.75 }));
      for (let i = 0; i < 8; i++) {
        const d = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.92, 0.1, 32), discMat);
        d.rotation.z = Math.PI / 2; d.position.x = -len / 2 + 0.6 + i * (len - 1.2) / 7; g.add(d);
      }
      // insulation over body
      const insMat = regMat(new THREE.MeshStandardMaterial({ color: 0xb9bec6, roughness: 0.95, metalness: 0.0 }));
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.06, r + 0.06, len, 40), insMat);
      ins.rotation.z = Math.PI / 2; ins.visible = true; g.add(ins); insMeshes.push(ins);
      anchor.set(def.x, r + 0.4, 0);
    } else if (def.type === 'filterpump') {
      const f1 = buildVertical(g, 0.7, 3, 'SS316L'); f1.position.set(-0.8, 0, 0);
      const f2 = buildVertical(g, 0.7, 3, 'SS316L'); f2.position.set(0.8, 0, 0);
      const pump = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.2), newMetalMat('SS316L'));
      pump.position.set(0, 1.0, 2); pump.castShadow = true; g.add(pump); metalMeshes.push(pump);
      anchor.set(def.x, 4.5, 0);
    } else if (def.type === 'pelletizer') {
      const head = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), newMetalMat('SS316L'));
      head.position.set(-1, 2, 0); head.castShadow = true; g.add(head); metalMeshes.push(head);
      const tankMat = regMat(new THREE.MeshStandardMaterial({ color: 0x5aa9a3, roughness: 0.4, metalness: 0.2, transparent: true, opacity: 0.85 }));
      const tank = new THREE.Mesh(new THREE.BoxGeometry(4, 2.4, 2.4), tankMat);
      tank.position.set(2.4, 1.2, 0); g.add(tank);
      const spin = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.4, 24), newMetalMat('SS316L'));
      spin.rotation.x = Math.PI / 2; spin.position.set(-1, 2, 0); g.add(spin); metalMeshes.push(spin);
      anchor.set(def.x + 1, 4, 0);
    } else if (def.type === 'silos') {
      const s1 = buildVertical(g, 1.6, 9, 'CARBON'); s1.position.set(-1.6, 0, 0);
      const s2 = buildVertical(g, 1.6, 9, 'CARBON'); s2.position.set(1.6, 0, 0);
      // flakes (instanced) inside silo 1
      const flakeMat = regMat(new THREE.MeshStandardMaterial({ color: 0xe9e2c8, roughness: 0.8, metalness: 0.0 }));
      const N = 280;
      const flakes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 0.18, 6), flakeMat, N);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < N; i++) {
        const a = Math.random() * Math.PI * 2, rr = Math.random() * 1.2;
        m4.makeTranslation(-1.6 + Math.cos(a) * rr, 0.4 + Math.random() * 7.5, Math.sin(a) * rr);
        flakes.setMatrixAt(i, m4);
      }
      flakes.instanceMatrix.needsUpdate = true; g.add(flakes);
      anchor.set(def.x, 10.5, 0);
    } else if (def.type === 'utility') {
      const furnace = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 3), newMetalMat('CARBON'));
      furnace.position.set(-1.5, 2, 0); furnace.castShadow = true; g.add(furnace); metalMeshes.push(furnace);
      const vacMat = newMetalMat('SS304');
      for (let i = 0; i < 3; i++) {
        const v = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 4, 20), vacMat);
        v.position.set(1.2 + i * 0.9, 2, 0); v.castShadow = true; g.add(v); metalMeshes.push(v);
      }
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 7, 24), newMetalMat('CARBON'));
      tower.position.set(4.5, 3.5, 0); tower.castShadow = true; g.add(tower); metalMeshes.push(tower);
      anchor.set(def.x, 8, 0);
    }

    g.userData.anchor = anchor;
    scene.add(g);
    stageGroups.push(g);
    stageById[def.id] = { def, group: g, baseAnchors: anchor.clone() };
    return g;
  }

  STAGES.forEach(buildStage);

  // --- pipe rack (instanced) on +Z side ---
  (function buildPipeRack() {
    const cols = [], beams = [];
    const z = 6, yTop = 9, yMid = 5;
    const xs = [];
    for (let x = -30; x <= 30; x += 6) xs.push(x);
    const colMat = regMat(new THREE.MeshStandardMaterial({ color: 0x3c424b, roughness: 0.7, metalness: 0.6 }));
    const colGeo = new THREE.BoxGeometry(0.4, yTop, 0.4);
    const colMesh = new THREE.InstancedMesh(colGeo, colMat, xs.length * 2);
    const m = new THREE.Matrix4();
    let ci = 0;
    for (const x of xs) {
      for (const zz of [z - 1, z + 1]) { m.makeTranslation(x, yTop / 2, zz); colMesh.setMatrixAt(ci++, m); }
    }
    colMesh.instanceMatrix.needsUpdate = true; colMesh.castShadow = true; scene.add(colMesh);
    const beamGeo = new THREE.BoxGeometry(60, 0.3, 0.3);
    const beamMesh = new THREE.InstancedMesh(beamGeo, colMat, 2);
    m.makeTranslation(0, yTop, z); beamMesh.setMatrixAt(0, m);
    m.makeTranslation(0, yMid, z); beamMesh.setMatrixAt(1, m);
    beamMesh.instanceMatrix.needsUpdate = true; scene.add(beamMesh);
  })();

  // --- process pipes + flow particles (main melt line 1->8) ---
  (function buildPipes() {
    const pts = STAGES.map(s => new THREE.Vector3(s.x, stageById[s.id].baseAnchors.y * 0.55 + 1.5, 2.2));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
    const tubeMat = regMat(new THREE.MeshStandardMaterial({ color: MEDIA.melt, roughness: 0.45, metalness: 0.7 }));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.18, 12, false), tubeMat);
    tube.castShadow = true; scene.add(tube);
    // secondary utility pipes (static)
    const steamCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-28, 2, 6), new THREE.Vector3(0, 3, 6), new THREE.Vector3(28, 2, 6)]);
    const steam = new THREE.Mesh(new THREE.TubeGeometry(steamCurve, 80, 0.12, 10, false),
      regMat(new THREE.MeshStandardMaterial({ color: MEDIA.steam, roughness: 0.5, metalness: 0.3 })));
    scene.add(steam);

    const N = 64;
    const partMat = regMat(new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0x6b3b10, roughness: 0.4, metalness: 0.1 }));
    const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 8), partMat, N);
    inst.frustumCulled = false; scene.add(inst);
    flowSystem.curves.push(curve); flowSystem.instanced = inst; flowSystem.count = N;
  })();

  // --- labels (DOM) + lead lines (SVG) -----------------------------------
  const labels = []; // {def, node, line, h, w, it:{x,y,tx,ty}}
  STAGES.forEach(s => {
    const node = document.createElement('div');
    node.className = 'pl-label';
    node.innerHTML = `<b>${s.short}</b><small>${s.param}</small>`;
    node.dataset.stage = s.id;
    labelLayer.appendChild(node);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'pl-lead');
    leadLayer.appendChild(line);
    labels.push({ def: s, node, line, h: 0, w: 0, it: { x: 0, y: 0, tx: 0, ty: 0 } });
  });
  // measure once after insert (next frame)
  requestAnimationFrame(() => {
    for (const l of labels) { l.w = l.node.offsetWidth; l.h = l.node.offsetHeight; }
  });

  const state = {
    explode: 0, focus: null, flow: !reduceMotion, flowSpeed: 1.0,
    section: false, capacity: 300, insulation: true, material: 'SS316L',
    labelsOn: !isMobile, tour: false,
  };

  // clipping planes (quarter cut — pit 9)
  const clipPlanes = [
    new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.0),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.0),
  ];

  // --- interaction state for camera tween ---
  let camGoal = null; // {pos, target}
  controls.addEventListener('start', () => { camGoal = null; });

  function applyAll() {
    // material preset
    const p = MAT_PRESETS[state.material] || MAT_PRESETS.SS316L;
    for (const mesh of metalMeshes) {
      if (!mesh.material || !mesh.material.isMeshStandardMaterial) continue;
      mesh.material.color.setHex(p.color);
      mesh.material.roughness = p.roughness;
      mesh.material.metalness = p.metalness;
    }
    // insulation
    for (const ins of insMeshes) ins.visible = state.insulation;
    // clipping
    const planes = state.section ? clipPlanes : null;
    for (const m of allMaterials) { m.clippingPlanes = planes; m.clipShadows = true; m.needsUpdate = true; }
    // capacity scale (inner equipment uniform by (tpd/300)^(1/3))
    const f = Math.cbrt(state.capacity / 300);
    for (const g of stageGroups) {
      // skip scaling the group itself (keeps spacing); scale inner meshes
      g.scale.set(f, f, f);
    }
    // explode: spread along X around centre
    for (const g of stageGroups) {
      const bx = g.userData.baseX;
      g.position.x = bx * (1 + 0.55 * state.explode);
    }
    // labels visibility
    labelLayer.style.display = state.labelsOn ? '' : 'none';
    leadLayer.style.display = state.labelsOn && !isMobile ? '' : 'none';
  }
  applyAll();

  // --- focus / dim ---
  function setFocus(id) {
    state.focus = id;
    for (const g of stageGroups) {
      const on = !id || g.userData.stageId === id;
      g.traverse(o => {
        if (o.isMesh && o.material && o.material.isMeshStandardMaterial) {
          o.material.transparent = !on;
          o.material.opacity = on ? 1.0 : 0.35;
        }
      });
    }
    if (id && stageById[id]) {
      const g = stageById[id].group;
      const tgt = new THREE.Vector3(g.position.x, 4, 0);
      const pos = new THREE.Vector3(g.position.x + 10, 9, 16);
      camGoal = { pos, target: tgt };
    } else {
      camGoal = { pos: DEFAULT_CAM.clone(), target: DEFAULT_TARGET.clone() };
    }
  }

  // --- tour ---
  let tourIdx = -1, tourTimer = 0;
  function startTour() {
    if (reduceMotion) return;
    state.tour = true; tourIdx = 0; tourTimer = 0;
    stepTour();
  }
  function stepTour() {
    const s = STAGES[tourIdx % STAGES.length];
    setFocus(s.id);
    subEl.textContent = `${s.short} — ${s.sub}`;
    subEl.style.opacity = '1';
  }
  function stopTour() { state.tour = false; subEl.style.opacity = '0'; setFocus(null); }

  // --- per-frame label layout & follow ---
  function layoutLabels(W, H) {
    const exploded = state.explode > 0.05;
    labels.forEach((l, i) => {
      let lx, ly;
      if (exploded) {
        // two columns, dynamic vertical accumulation
        const col = i < Math.ceil(labels.length / 2) ? 0 : 1;
        const idx = i < Math.ceil(labels.length / 2) ? i : i - Math.ceil(labels.length / 2);
        lx = col === 0 ? W * 0.12 : W * 0.62;
        ly = 40 + idx * 56; // approx; refined by measured height below
      } else {
        // ellipse ring around centre
        const ang = -Math.PI / 2 + i * (Math.PI * 2 / labels.length);
        const rx = W * 0.40, ry = H * 0.40;
        lx = W / 2 + Math.cos(ang) * rx - (l.w || 60) / 2;
        ly = H / 2 + Math.sin(ang) * ry - (l.h || 24) / 2;
        lx = Math.max(8, Math.min(W - (l.w || 60) - 8, lx)); // pit 15: clamp by half height
        ly = Math.max(8, Math.min(H - (l.h || 24) - 8, ly));
      }
      l.it.tx = lx; l.it.ty = ly;
    });
  }

  function updateLabels(W, H, dt) {
    if (!state.labelsOn) return;
    const k = 1 - Math.exp(-dt * 18); // pit 11: per-frame smoothing, no throttle
    for (const l of labels) {
      l.it.x += (l.it.tx - l.it.x) * k;
      l.it.y += (l.it.ty - l.it.y) * k;
      l.node.style.translate = `${l.it.x}px ${l.it.y}px`; // pit 13: use translate not margin
      // project anchor
      const g = stageById[l.def.id].group;
      const wp = new THREE.Vector3();
      // anchor scales with capacity factor and sits at the stage group origin
      wp.copy(g.userData.anchor).multiply(new THREE.Vector3(g.scale.x, g.scale.y, g.scale.z)).add(g.position);
      wp.project(camera);
      if (wp.z > 1) { l.line.style.opacity = '0'; continue; }
      const sx = (wp.x * 0.5 + 0.5) * W;
      const sy = (-wp.y * 0.5 + 0.5) * H;
      const cx = l.it.x + (l.w || 60) / 2, cy = l.it.y + (l.h || 24) / 2;
      let dx = sx - cx, dy = sy - cy; const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      // indent by projected half-size, min 12px, clamp so line never reverses (t in [0,1])
      let indent = Math.max(12, (l.w || 60) / 2 * Math.abs(ux) + (l.h || 24) / 2 * Math.abs(uy));
      if (indent > len - 12) indent = Math.max(0, len - 12); // pit 6: t clamped
      const ex = cx + ux * indent, ey = cy + uy * indent;
      l.line.setAttribute('x1', ex.toFixed(1)); l.line.setAttribute('y1', ey.toFixed(1));
      l.line.setAttribute('x2', sx.toFixed(1)); l.line.setAttribute('y2', sy.toFixed(1));
      l.line.style.opacity = state.labelsOn && !isMobile ? '0.8' : '0';
    }
  }

  // --- flow update ---
  function updateFlow(dt) {
    if (!state.flow || !flowSystem.instanced) return;
    flowSystem.t = (flowSystem.t + dt * 0.06 * state.flowSpeed) % 1;
    const m = new THREE.Matrix4();
    const curve = flowSystem.curves[0];
    const N = flowSystem.count;
    for (let i = 0; i < N; i++) {
      const t = (flowSystem.t + i / N) % 1;
      const p = curve.getPointAt(t);
      m.makeTranslation(p.x, p.y, p.z);
      flowSystem.instanced.setMatrixAt(i, m);
    }
    flowSystem.instanced.instanceMatrix.needsUpdate = true;
    // stage light-up pulse in sequence
    if (!reduceMotion) {
      const phase = flowSystem.t * STAGES.length;
      for (let i = 0; i < STAGES.length; i++) {
        const d = Math.abs(((phase - i + STAGES.length) % STAGES.length));
        const glow = Math.max(0, 1 - d) * 0.25;
        stageGroups[i].traverse(o => {
          if (o.isMesh && o.material && o.material.isMeshStandardMaterial && o.material.emissive) {
            o.material.emissive.setRGB(glow * 0.9, glow * 0.6, glow * 0.2);
          }
        });
      }
    }
  }

  // --- render loop with perf budget --------------------------------------
  let raf = null, running = false, last = performance.now();
  let frames = 0, fpsAccum = 0, fps = 60, idleSince = performance.now();
  let quality = 'Auto', skipped = 0;
  let io = null;

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

    // fps tracking
    frames++; fpsAccum += dt;
    if (fpsAccum >= 0.5) { fps = frames / fpsAccum; frames = 0; fpsAccum = 0; }

    // idle downscale to 30fps after 4s no interaction
    const idle = (now - idleSince) > 4000;
    if (idle && fps > 1) { skipped++; if (skipped % 2 === 0) { /* skip this frame's heavy work */ } else { renderFrame(dt, now); } }
    else { renderFrame(dt, now); }

    // tour stepping
    if (state.tour) {
      tourTimer += dt;
      if (tourTimer > 4) { tourTimer = 0; tourIdx++; if (tourIdx >= STAGES.length) { stopTour(); } else { stepTour(); } }
    }
  }

  function renderFrame(dt, now) {
    // camera tween
    if (camGoal) {
      camera.position.lerp(camGoal.pos, 1 - Math.exp(-dt * 3));
      controls.target.lerp(camGoal.target, 1 - Math.exp(-dt * 3));
      if (camera.position.distanceTo(camGoal.pos) < 0.4) camGoal = null;
    }
    controls.update();
    updateFlow(dt);
    const W = renderer.domElement.clientWidth, H = renderer.domElement.clientHeight;
    layoutLabels(W, H);
    updateLabels(W, H, dt);
    renderer.render(scene, camera);
  }

  // --- startup self-check (first 30 frames) ---
  let bootFrames = 0, bootFpsSum = 0;
  function bootCheck() {
    if (bootFrames < 30) {
      bootFrames++; bootFpsSum += fps;
      if (bootFrames === 30) {
        const avg = bootFpsSum / 30;
        if (avg < 45) {
          renderer.setPixelRatio(1.0); // DPR 1.0
          renderer.shadowMap.enabled = false; // shadows off
          quality = 'Low';
        } else { quality = 'High'; }
        if (hudEl) hudEl.textContent = `Quality: ${quality} · ${fps.toFixed(0)} fps`;
      }
    } else if (hudEl) {
      hudEl.textContent = `Quality: ${quality} · ${fps.toFixed(0)} fps`;
    }
  }
  // hook bootCheck into tick via wrapping renderFrame
  const _renderFrame = renderFrame;
  renderFrame = function (dt, now) { _renderFrame(dt, now); bootCheck(); };

  function start() {
    if (running) return;
    running = true; last = performance.now(); idleSince = last;
    raf = requestAnimationFrame(tick);
  }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

  // IntersectionObserver: pause when out of view (pit: raf stop)
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver((entries) => {
      for (const e of entries) { if (e.isIntersecting) start(); else stop(); }
    }, { threshold: 0.05 });
    io.observe(el);
  }
  // visibility change
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });

  controls.addEventListener('change', () => { idleSince = performance.now(); });
  window.addEventListener('resize', () => { resize(); requestAnimationFrame(() => { for (const l of labels) { l.w = l.node.offsetWidth; l.h = l.node.offsetHeight; } }); });

  resize();
  start();

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------
  return {
    setExplode: (v) => { state.explode = Math.max(0, Math.min(1, v)); applyAll(); },
    setFocus: (id) => setFocus(id),
    setFlow: (on, speed) => { state.flow = !!on; if (speed != null) state.flowSpeed = speed; },
    setSection: (on) => { state.section = !!on; applyAll(); },
    setCapacity: (tpd) => { state.capacity = Math.max(50, Math.min(1200, tpd)); applyAll(); },
    setInsulation: (on) => { state.insulation = !!on; applyAll(); },
    setMaterial: (m) => { state.material = m; applyAll(); },
    setLabels: (on) => { state.labelsOn = !!on; applyAll(); },
    startTour, stopTour,
    reset: () => {
      state.explode = 0; state.focus = null; state.section = false; state.capacity = 300;
      state.insulation = true; state.material = 'SS316L';
      applyAll(); setFocus(null); subEl.style.opacity = '0';
    },
    getState: () => ({ ...state }),
    dispose: () => {
      stop();
      if (io) io.disconnect();
      controls.dispose();
      renderer.dispose();
      pmrem.dispose();
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    },
  };
}
