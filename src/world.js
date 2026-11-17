// World: neon city at dusk — road, lit buildings, street lights, skyline.
// Everything visible scrolls with the world speed and recycles ahead.
// (Lesson from the CLAY tree bug: a prop that never moves while the road
// streams past looks frozen — so every pool below advances at track speed.)
import * as THREE from 'three';

export const ROAD_HALF = 5.4; // cat clamps to ±ROAD_HALF

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createWorld(scene, seed = 1) {
  const rand = mulberry32(seed);

  // ---------- dusk sky dome (gradient shader, BackSide sphere) ----------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x1a0b2e) },   // deep purple
      mid: { value: new THREE.Color(0xd63384) },   // neon magenta band
      low: { value: new THREE.Color(0xff9a3c) },   // orange sunset horizon
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vPos;
      uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main() {
        float h = normalize(vPos).y;
        vec3 c = h > 0.14 ? mix(mid, top, smoothstep(0.14, 0.6, h))
                          : mix(low, mid, smoothstep(-0.06, 0.14, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(320, 24, 16), skyMat);
  scene.add(sky);

  // ---------- low sun disc + halo ----------
  const sunGroup = new THREE.Group();
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(13, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }),
  );
  sunGroup.add(sunDisc);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xff5c8a, transparent: true, opacity: 0.35, fog: false, depthWrite: false,
  });
  const halo = new THREE.Mesh(new THREE.CircleGeometry(24, 32), haloMat);
  halo.position.z = -1;
  sunGroup.add(halo);
  sunGroup.position.set(-22, 20, -260);
  sunGroup.lookAt(0, 8, 0);
  scene.add(sunGroup);

  // ---------- lighting ----------
  const sun = new THREE.DirectionalLight(0xff8c42, 2.0);
  sun.position.set(-28, 40, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -16; sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -30;
  sun.shadow.camera.near = 5; sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.002;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x8a5cff, 0x1a0b2e, 0.85));
  const fill = new THREE.DirectionalLight(0xff2e88, 0.55);
  fill.position.set(20, 14, 30);
  scene.add(fill);

  // ---------- city ground (dark, uniform — no features to freeze) ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 340),
    new THREE.MeshStandardMaterial({ color: 0x0d0a16, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, -130);
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- road: dark asphalt with a subtle procedural texture ----------
  function asphaltTexture() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#17141f'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.12)';
      g.fillRect(rand() * 256, rand() * 256, 1 + rand() * 2, 1 + rand() * 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const roadTex = asphaltTexture();
  roadTex.repeat.set(2, 40);
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(14.4, 340),
    new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.9 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, -130);
  road.receiveShadow = true;
  scene.add(road);

  // neon edge strips (uniform along their length, so no scroll features)
  for (const [x, color] of [[-7.2, 0x00f0ff], [7.2, 0xff2e88]]) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.06, 340),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.0 }),
    );
    strip.position.set(x, 0.03, -130);
    scene.add(strip);
  }

  // ---------- centre dashes (recycled pool — the visible road motion) ----------
  const dashGeo = new THREE.BoxGeometry(0.16, 0.03, 2.2);
  const dashMat = new THREE.MeshStandardMaterial({
    color: 0xffe9a8, emissive: 0xffc93c, emissiveIntensity: 0.9, roughness: 0.5,
  });
  const dashes = [];
  for (const x of [-2.4, 2.4]) {
    for (let i = 0; i < 22; i++) {
      const d = new THREE.Mesh(dashGeo, dashMat);
      d.position.set(x, 0.02, 10 - i * 7);
      scene.add(d);
      dashes.push(d);
    }
  }

  // ---------- buildings with lit windows ----------
  const LIT = ['#ffd27a', '#7ff3ff', '#ff7ad9', '#9dff6e', '#ffb36b'];
  function buildingTexture(facade) {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = facade; g.fillRect(0, 0, 128, 256);
    // faint facade variation
    for (let i = 0; i < 40; i++) {
      g.fillStyle = 'rgba(255,255,255,0.03)';
      g.fillRect(rand() * 128, rand() * 256, 4 + rand() * 10, 4 + rand() * 10);
    }
    // window grid: 6 cols x 14 rows, some lit
    for (let r = 0; r < 14; r++) {
      for (let col = 0; col < 6; col++) {
        const lit = rand() < 0.55;
        g.fillStyle = lit ? LIT[Math.floor(rand() * LIT.length)] : '#0a0812';
        g.fillRect(8 + col * 20, 10 + r * 17, 12, 9);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const buildingMats = [];
  for (const facade of ['#14101f', '#1d1530', '#191223', '#121a26']) {
    const tex = buildingTexture(facade);
    buildingMats.push(new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.9,
    }));
  }
  const roofColors = [0x00f0ff, 0xff2e88, 0xffc93c, 0x9dff6e];

  // neon signs (canvas text, glowing) — attached to some buildings
  const signMats = [];
  for (const [text, color] of [['TURBO', '#00f0ff'], ['NEON', '#ff2e88'], ['KUCING', '#ffc93c'], ['24H', '#9dff6e'], ['RAMEN', '#ff7ad9']]) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(10,6,18,0.9)'; g.fillRect(0, 0, 256, 64);
    g.font = 'bold 40px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 18;
    g.fillStyle = color;
    g.fillText(text, 128, 34);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    signMats.push(new THREE.MeshStandardMaterial({
      map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 1.6,
      transparent: true, side: THREE.DoubleSide,
    }));
  }

  const buildings = [];
  const BUILD_SPAN = 260;
  for (let i = 0; i < 30; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const w = 5 + rand() * 4;
    const h = 8 + rand() * 20;
    const d = 5 + rand() * 3;
    const grp = new THREE.Group();
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      buildingMats[Math.floor(rand() * buildingMats.length)],
    );
    box.position.y = h / 2;
    box.castShadow = false;
    grp.add(box);
    // rooftop neon strip
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.15, 0.18, d + 0.15),
      new THREE.MeshStandardMaterial({
        color: roofColors[Math.floor(rand() * roofColors.length)],
        emissive: roofColors[Math.floor(rand() * roofColors.length)],
        emissiveIntensity: 2.0,
      }),
    );
    roof.position.y = h + 0.05;
    grp.add(roof);
    // neon sign on the road-facing side, on ~40% of buildings
    if (rand() < 0.45) {
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 0.85),
        signMats[Math.floor(rand() * signMats.length)],
      );
      sign.position.set(-side * (w / 2 + 0.06), 3 + rand() * Math.max(1, h - 6), 0);
      sign.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      grp.add(sign);
    }
    const x = side * (9.5 + rand() * 11);
    const z = 12 - Math.floor(i / 2) * 18 - rand() * 6;
    grp.position.set(x, 0, z);
    scene.add(grp);
    buildings.push({ mesh: grp, baseX: x });
  }

  // ---------- street lights (recycled pool) ----------
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x23202e, roughness: 0.6, metalness: 0.5 });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff2c0, emissive: 0xffd27a, emissiveIntensity: 2.4,
  });
  const lights = [];
  const LIGHT_SPAN = 280;
  for (let i = 0; i < 14; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const grp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.2, 8), poleMat);
    pole.position.y = 2.6;
    grp.add(pole);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6), poleMat);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(-side * 0.65, 5.1, 0);
    grp.add(arm);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), lampMat);
    orb.position.set(-side * 1.3, 5.0, 0);
    grp.add(orb);
    const x = side * 7.9;
    grp.position.set(x, 0, 10 - i * 20);
    scene.add(grp);
    lights.push({ mesh: grp, baseX: x });
  }

  // ---------- distant skyline silhouette (far + fog, like CLAY's mountains) ----------
  const skylineMat = new THREE.MeshStandardMaterial({ color: 0x0e0718, roughness: 1 });
  for (let i = 0; i < 16; i++) {
    const w = 10 + rand() * 18;
    const h = 18 + rand() * 34;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 8), skylineMat);
    const side = rand() < 0.5 ? -1 : 1;
    b.position.set(side * (28 + rand() * 60), h / 2 - 2, -210 - rand() * 60);
    scene.add(b);
  }

  // ---------- coin / car factories ----------
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffc93c, roughness: 0.25, metalness: 0.85,
    emissive: 0x6b4a00, emissiveIntensity: 0.6,
  });
  function makeCoin() {
    const m = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.09, 10, 20), goldMat);
    m.add(ring);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.09, 20), goldMat);
    core.rotation.x = Math.PI / 2;
    m.add(core);
    return m;
  }

  const carColors = [0xe63b4e, 0x3b82f6, 0xf5c542, 0x9b5cf6, 0x2dd4bf, 0xe8e8f0];
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x101018, metalness: 0.8, roughness: 0.15 });
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.95 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff2b0, emissiveIntensity: 2.5 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2233, emissive: 0xff2233, emissiveIntensity: 2.0 });
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 12);
  function makeCar() {
    const color = carColors[Math.floor(rand() * carColors.length)];
    const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.45, roughness: 0.35 });
    const m = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 3.6), bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    m.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.8), glassMat);
    cabin.position.set(0, 1.05, 0.2);
    cabin.castShadow = true;
    m.add(cabin);
    // underglow — a soft neon disc so cars read at dusk
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(1.5, 16),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.04;
    glow.scale.set(0.8, 1.6, 1);
    m.add(glow);
    for (const [wx, wz] of [[-0.85, -1.2], [0.85, -1.2], [-0.85, 1.2], [0.85, 1.2]]) {
      const wheel = new THREE.Mesh(wheelGeo, tyreMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.32, wz);
      m.add(wheel);
    }
    for (const s of [-1, 1]) {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.06), headMat);
      head.position.set(s * 0.6, 0.55, -1.82);
      m.add(head);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.06), tailMat);
      tail.position.set(s * 0.6, 0.55, 1.82);
      m.add(tail);
    }
    return m;
  }

  return {
    rand,
    update(dt, speed, camZ) {
      const dz = speed * dt;
      // buildings scroll + recycle ahead (re-randomize height on recycle
      // so the skyline never repeats identically)
      for (const b of buildings) {
        b.mesh.position.z += dz;
        if (b.mesh.position.z > camZ + 16) {
          b.mesh.position.z -= BUILD_SPAN;
          const side = b.baseX < 0 ? -1 : 1;
          b.mesh.position.x = side * (9.5 + rand() * 11);
        }
      }
      for (const l of lights) {
        l.mesh.position.z += dz;
        if (l.mesh.position.z > camZ + 16) l.mesh.position.z -= LIGHT_SPAN;
      }
      for (const d of dashes) {
        d.position.z += dz;
        if (d.position.z > camZ + 14) d.position.z -= 154;
      }
      // sun halo pulse (subtle) + neon sign flicker
      haloMat.opacity = 0.32 + Math.sin(performance.now() * 0.0006) * 0.05;
      signMats.forEach((m, i) => {
        m.emissiveIntensity = 1.5 + Math.sin(performance.now() * 0.002 + i * 1.7) * 0.35;
      });
    },
    makeCoin, makeCar,
  };
}
