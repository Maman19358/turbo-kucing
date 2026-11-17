// TURBO KUCING — original low-poly cat on a hoverboard.
// Built entirely from three.js primitives. No downloaded model, no
// third-party character — an original design for this game.
import * as THREE from 'three';

export function createCat() {
  const group = new THREE.Group();
  const cat = new THREE.Group(); // the cat itself (crouches on boost)
  group.add(cat);

  const orange = new THREE.MeshStandardMaterial({ color: 0xf5a142, roughness: 0.85, flatShading: true });
  const orangeDark = new THREE.MeshStandardMaterial({ color: 0xd97f26, roughness: 0.9, flatShading: true });
  const white = new THREE.MeshStandardMaterial({ color: 0xfff6e8, roughness: 0.9, flatShading: true });
  const pink = new THREE.MeshStandardMaterial({ color: 0xff9db1, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1420, roughness: 0.4 });

  // ---- body: rounded, sitting/standing on the board, facing -z ----
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 12), orange);
  body.scale.set(0.85, 0.95, 1.15);
  body.position.set(0, 0.78, 0.08);
  body.castShadow = true;
  cat.add(body);

  // white belly patch
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), white);
  belly.scale.set(0.75, 0.9, 0.9);
  belly.position.set(0, 0.72, -0.18);
  cat.add(belly);

  // dark stripes across the back (thin flattened boxes, hugging the curve)
  for (let i = 0; i < 3; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.1), orangeDark);
    stripe.position.set(0, 1.06 - i * 0.02, 0.28 - i * 0.22);
    stripe.rotation.x = -0.35 + i * 0.18;
    cat.add(stripe);
  }

  // ---- head ----
  const head = new THREE.Group();
  head.position.set(0, 1.18, -0.34);
  cat.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 14), orange);
  skull.scale.set(1, 0.92, 0.95);
  skull.castShadow = true;
  head.add(skull);
  // white muzzle
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), white);
  muzzle.scale.set(1.15, 0.75, 0.8);
  muzzle.position.set(0, -0.1, -0.28);
  head.add(muzzle);
  // pink nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), pink);
  nose.position.set(0, -0.06, -0.42);
  head.add(nose);
  // eyes (dark, with a tiny white glint)
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), dark);
    eye.position.set(s * 0.15, 0.06, -0.3);
    head.add(eye);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glint.position.set(s * 0.15 + 0.02, 0.09, -0.35);
    head.add(glint);
  }
  // pointed ears + pink inner ears
  const ears = [];
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 4), orange);
    outer.castShadow = true;
    ear.add(outer);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 4), pink);
    inner.position.set(0, -0.02, -0.05);
    ear.add(inner);
    ear.position.set(s * 0.22, 0.36, 0.02);
    ear.rotation.z = -s * 0.18;
    ear.rotation.y = s * 0.25;
    head.add(ear);
    ears.push(ear);
  }

  // ---- paws: front pair planted on the board, hind pair tucked ----
  const pawGeo = new THREE.SphereGeometry(0.11, 10, 8);
  const frontPaws = [];
  for (const s of [-1, 1]) {
    const paw = new THREE.Mesh(pawGeo, white);
    paw.scale.set(0.9, 0.7, 1.3);
    paw.position.set(s * 0.2, 0.42, -0.28);
    paw.castShadow = true;
    cat.add(paw);
    frontPaws.push(paw);
  }
  for (const s of [-1, 1]) {
    const paw = new THREE.Mesh(pawGeo, orange);
    paw.scale.set(1, 0.7, 1.2);
    paw.position.set(s * 0.24, 0.42, 0.3);
    cat.add(paw);
  }

  // ---- tail: a chain of spheres curving up behind, sways in animate() ----
  const tail = new THREE.Group();
  tail.position.set(0, 0.85, 0.48);
  cat.add(tail);
  const tailSegs = [];
  let tz = 0, ty = 0;
  for (let i = 0; i < 5; i++) {
    const r = 0.11 - i * 0.014;
    const seg = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), i === 4 ? white : orange);
    seg.position.set(0, ty, tz);
    tail.add(seg);
    tailSegs.push(seg);
    ty += 0.13;
    tz += 0.1;
  }

  // ---- hoverboard ----
  const board = new THREE.Group();
  board.position.y = 0.3;
  group.add(board);
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.4, metalness: 0.6 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.1, 1.5), deckMat);
  deck.castShadow = true;
  board.add(deck);
  // neon edge strip (cyan, glowing)
  const stripMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff, emissive: 0x00f0ff, emissiveIntensity: 2.2, roughness: 0.3,
  });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.045, 1.52), stripMat);
  strip.position.y = -0.02;
  board.add(strip);
  // pink nose stripe on the deck
  const noseStripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.18),
    new THREE.MeshStandardMaterial({ color: 0xff2e88, emissive: 0xff2e88, emissiveIntensity: 1.6 }));
  noseStripe.position.set(0, 0.06, -0.6);
  board.add(noseStripe);
  // glow disc under the board (additive, fakes the hover light)
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20), glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -0.24;
  glow.scale.set(1, 1.6, 1);
  board.add(glow);
  // cyan point light riding with the board — the only dynamic light
  const boardLight = new THREE.PointLight(0x00e5ff, 6, 7, 1.8);
  boardLight.position.set(0, 0.1, 0);
  board.add(boardLight);

  let crouch = 0; // 0 = normal, 1 = fully crouched (boost)

  return {
    group,
    ready: true, // primitives — nothing to load
    animate(t, opts = {}) {
      const {
        steer = 0,        // -1..1, lateral steering (positive = turning right)
        speedNorm = 0,    // 0..1
        boosting = false,
        running = true,
      } = opts;
      // tail sway: slow side-to-side wag, faster with speed
      tail.rotation.y = Math.sin(t * (2.2 + speedNorm * 3)) * 0.45;
      tail.rotation.x = -0.15 + Math.sin(t * 1.7) * 0.08;
      // ears: tiny wobble so the cat feels alive
      ears[0].rotation.z = -0.18 + Math.sin(t * 5.1) * 0.04;
      ears[1].rotation.z = 0.18 + Math.sin(t * 4.7 + 1) * 0.04;
      // head looks slightly into the turn
      head.rotation.y = -steer * 0.25;
      // lean into the turn (roll) + board tilt
      group.rotation.z = -steer * 0.28;
      board.rotation.z = -steer * 0.12;
      // hoverboard bob, quicker with speed
      const bob = running ? Math.sin(t * (6 + speedNorm * 5)) * 0.045 : Math.sin(t * 2) * 0.02;
      board.position.y = 0.3 + bob;
      cat.position.y = bob * 0.6;
      // boost crouch: ease toward target, cat squashes down, board pitches forward
      const target = boosting ? 1 : 0;
      crouch += (target - crouch) * Math.min(1, 0.016 * 10);
      cat.scale.y = 1 - crouch * 0.12;
      cat.position.z = crouch * 0.08;
      board.rotation.x = crouch * 0.1;
      stripMat.emissiveIntensity = 2.2 + crouch * 2.5 + speedNorm * 0.8;
      glowMat.opacity = 0.35 + crouch * 0.3;
      boardLight.intensity = 6 + crouch * 8;
    },
  };
}
