/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from "three";
import { Lane, PlayerAction } from "../types";

export class PlayerController {
  public mesh: THREE.Group;
  public position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  // Lane settings
  public static readonly LANE_WIDTH = 3.5;
  public currentLane: Lane = 0;
  public targetLane: Lane = 0;

  // Movement parameters
  public speed = 15.0; // Units per second forward
  private maxSpeed = 35.0;
  private speedGainedPerSec = 0.15;
  private baseHeight = 0.6; // Hover height

  // Jump / Physics parameters
  private yVelocity = 0;
  private gravity = -65.0; // Crisper, sharper gravity model
  private jumpForce = 21.0;
  public isGrounded = true;

  // Slide parameter
  public isSliding = false;
  private slideDuration = 0.7; // seconds
  private slideTimer = 0;

  // Powerups
  public isJetpackActive = false;
  private jetpackTimer = 0;
  private readonly jetpackDuration = 10.0;

  public isMagnetActive = false;
  private magnetTimer = 0;
  private readonly magnetDuration = 12.0;

  public isSuperSneakers = false;
  private sneakersTimer = 0;
  private readonly sneakersDuration = 12.0;

  // Visual sub-meshes for animation
  private bodyMesh!: THREE.Mesh;
  private boardMesh!: THREE.Mesh;
  private headMesh!: THREE.Mesh;

  // Visual sub-meshes for equipment
  private jetpackMesh!: THREE.Group;
  private magnetMesh!: THREE.Group;
  private sneakerLeftMesh!: THREE.Mesh;
  private sneakerRightMesh!: THREE.Mesh;

  // Limbs for animation
  private leftLegGrid!: THREE.Group;
  private rightLegGrid!: THREE.Group;
  private leftArmGrid!: THREE.Group;
  private rightArmGrid!: THREE.Group;

  // Cop meshes
  private copGroup!: THREE.Group;
  private copLegLeft!: THREE.Mesh;
  private copLegRight!: THREE.Mesh;
  private copArmLeft!: THREE.Group;
  private copArmRight!: THREE.Group;

  // Dog meshes
  private dogGroup!: THREE.Group;
  private dogLegs: THREE.Mesh[] = [];

  // Collision box measurements
  public width = 1.2;
  public height = 1.8;
  public depth = 1.2;

  // Track state
  public action: PlayerAction = "RUN";

  constructor() {
    this.mesh = new THREE.Group();
    this.buildStylizedCharacter();
    this.buildCopCharacter();
    this.position.set(0, this.baseHeight, 0);
    this.mesh.position.copy(this.position);
  }

  /**
   * Procedural design for a gorgeous cyberpunk hoverboard runner.
   * Leverages geometric shapes, emissions, and distinct layers.
   */
  private buildStylizedCharacter() {
    // 1. Skateboard Base
    const boardGeom = new THREE.BoxGeometry(0.8, 0.1, 2.0);
    const boardMat = new THREE.MeshStandardMaterial({
      color: 0xcc4444, // Red board
      roughness: 0.8,
      metalness: 0.1,
    });
    this.boardMesh = new THREE.Mesh(boardGeom, boardMat);
    this.boardMesh.position.y = -0.5;
    this.boardMesh.visible = false; // Hide board to behave like SS runner
    this.mesh.add(this.boardMesh);

    // Board Stripe
    const stripeGeom = new THREE.BoxGeometry(0.2, 0.11, 2.0);
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.8,
    });
    const boardStripe = new THREE.Mesh(stripeGeom, stripeMat);
    this.boardMesh.add(boardStripe);

    // Wheels
    const wheelGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.8, 12);
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.9,
    });

    const frontWheel = new THREE.Mesh(wheelGeom, wheelMat);
    frontWheel.rotation.z = Math.PI / 2;
    frontWheel.position.set(0, -0.1, 0.7);
    this.boardMesh.add(frontWheel);

    const backWheel = frontWheel.clone();
    backWheel.position.set(0, -0.1, -0.7);
    this.boardMesh.add(backWheel);

    // 2. Character Torso (White T-Shirt, Blue Vest)
    const bodyGeom = new THREE.BoxGeometry(0.7, 0.8, 0.5);
    const teeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, // White tee
      roughness: 0.9,
    });
    this.bodyMesh = new THREE.Mesh(bodyGeom, teeMat);
    this.bodyMesh.position.y = 0.3; // Raised so feet touch board
    this.mesh.add(this.bodyMesh);

    // Blue Vest open at front
    const vestGeom = new THREE.BoxGeometry(0.75, 0.82, 0.55);
    const vestMat = new THREE.MeshStandardMaterial({
      color: 0x4a6eb0,
      roughness: 0.9,
    });
    const vest = new THREE.Mesh(vestGeom, vestMat);
    this.bodyMesh.add(vest);
    // Vest opening (cutout illusion)
    const openingGeom = new THREE.BoxGeometry(0.3, 0.83, 0.56);
    const opening = new THREE.Mesh(openingGeom, teeMat);
    opening.position.set(0, 0, 0.05); // slightly forward to hide vest center
    this.bodyMesh.add(opening);

    // Jeans (Legs)
    const legGeom = new THREE.BoxGeometry(0.35, 0.8, 0.5);
    const legsMat = new THREE.MeshStandardMaterial({
      color: 0x3b5998,
      roughness: 0.9,
    });

    this.leftLegGrid = new THREE.Group();
    // Pivot at hip
    this.leftLegGrid.position.set(-0.18, -0.4, 0);
    const leftLegMesh = new THREE.Mesh(legGeom, legsMat);
    leftLegMesh.position.y = -0.4;
    this.leftLegGrid.add(leftLegMesh);

    this.rightLegGrid = new THREE.Group();
    this.rightLegGrid.position.set(0.18, -0.4, 0);
    const rightLegMesh = new THREE.Mesh(legGeom, legsMat);
    rightLegMesh.position.y = -0.4;
    this.rightLegGrid.add(rightLegMesh);

    this.bodyMesh.add(this.leftLegGrid);
    this.bodyMesh.add(this.rightLegGrid);

    // Shoes (standard)
    const shoeGeom = new THREE.BoxGeometry(0.32, 0.2, 0.5);
    const shoeMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.8,
    });

    const leftShoe = new THREE.Mesh(shoeGeom, shoeMat);
    leftShoe.position.set(0, -0.9, 0.1);
    this.leftLegGrid.add(leftShoe);

    const rightShoe = new THREE.Mesh(shoeGeom, shoeMat);
    rightShoe.position.set(0, -0.9, 0.1);
    this.rightLegGrid.add(rightShoe);

    // Super Sneakers
    const sneakerGeom = new THREE.BoxGeometry(0.4, 0.35, 0.6);
    const sneakerMat = new THREE.MeshStandardMaterial({
      color: 0xff00ff,
      metalness: 0.5,
      roughness: 0.2,
    });
    this.sneakerLeftMesh = new THREE.Mesh(sneakerGeom, sneakerMat);
    this.sneakerLeftMesh.position.set(0, -0.9, 0.1);
    this.sneakerLeftMesh.visible = false;
    this.leftLegGrid.add(this.sneakerLeftMesh);

    this.sneakerRightMesh = new THREE.Mesh(sneakerGeom, sneakerMat);
    this.sneakerRightMesh.position.set(0, -0.9, 0.1);
    this.sneakerRightMesh.visible = false;
    this.rightLegGrid.add(this.sneakerRightMesh);

    // Backpack
    const packGeom = new THREE.BoxGeometry(0.6, 0.8, 0.3);
    const packMat = new THREE.MeshStandardMaterial({
      color: 0x228b22,
      roughness: 0.9,
    });
    const backpack = new THREE.Mesh(packGeom, packMat);
    backpack.position.set(0, 0, -0.3);
    this.bodyMesh.add(backpack);

    const pocketGeom = new THREE.BoxGeometry(0.4, 0.3, 0.1);
    const pocketMat = new THREE.MeshStandardMaterial({
      color: 0xf1c40f,
      roughness: 0.8,
    });
    const pocket = new THREE.Mesh(pocketGeom, pocketMat);
    pocket.position.set(0, -0.15, -0.16); // back of backpack
    backpack.add(pocket);

    // Jetpack Backpack (Replaces standard when active)
    this.jetpackMesh = new THREE.Group();
    const jpBodyGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 12);
    const jpBodyMat = new THREE.MeshStandardMaterial({
      color: 0xaa0033,
      metalness: 0.8,
      roughness: 0.2,
    });
    const leftTank = new THREE.Mesh(jpBodyGeom, jpBodyMat);
    leftTank.position.set(-0.35, 0, -0.4);
    const rightTank = new THREE.Mesh(jpBodyGeom, jpBodyMat);
    rightTank.position.set(0.35, 0, -0.4);
    this.jetpackMesh.add(leftTank, rightTank);
    this.jetpackMesh.visible = false;
    this.bodyMesh.add(this.jetpackMesh);

    // Magnet held by player
    this.magnetMesh = new THREE.Group();
    const magGeom = new THREE.TorusGeometry(0.4, 0.1, 8, 16, Math.PI);
    const magMat = new THREE.MeshStandardMaterial({
      color: 0xdd2222,
      metalness: 0.5,
    });
    const magU = new THREE.Mesh(magGeom, magMat);
    magU.rotation.z = Math.PI / 2;
    magU.position.set(0, 0, 0);
    const magTipGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.2);
    const magTipMat = new THREE.MeshStandardMaterial({
      color: 0xaaaaaa,
      metalness: 0.9,
      roughness: 0.2,
    });
    const tip1 = new THREE.Mesh(magTipGeom, magTipMat);
    tip1.position.set(0, -0.4, -0.1);
    tip1.rotation.x = Math.PI / 2;
    const tip2 = new THREE.Mesh(magTipGeom, magTipMat);
    tip2.position.set(0, 0.4, -0.1);
    tip2.rotation.x = Math.PI / 2;
    this.magnetMesh.add(magU, tip1, tip2);
    this.magnetMesh.position.set(0, 0, 0.5); // held in front
    this.magnetMesh.rotation.y = Math.PI / 2; // face forward
    this.magnetMesh.visible = false;
    this.bodyMesh.add(this.magnetMesh);

    // Arms (White sleeves)

    const sleeveGeom = new THREE.BoxGeometry(0.25, 0.4, 0.25);
    const armGeom = new THREE.BoxGeometry(0.2, 0.4, 0.2);
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xfadcba,
      roughness: 0.6,
    });

    this.leftArmGrid = new THREE.Group();
    // Pivot points for arms at shoulders
    this.leftArmGrid.position.set(-0.45, 0.3, 0);
    const leftSleeve = new THREE.Mesh(sleeveGeom, teeMat);
    leftSleeve.position.y = -0.1;
    this.leftArmGrid.add(leftSleeve);
    const leftArm = new THREE.Mesh(armGeom, skinMat);
    leftArm.position.y = -0.5;
    this.leftArmGrid.add(leftArm);
    this.bodyMesh.add(this.leftArmGrid);

    this.rightArmGrid = new THREE.Group();
    this.rightArmGrid.position.set(0.45, 0.3, 0);
    const rightSleeve = new THREE.Mesh(sleeveGeom, teeMat);
    rightSleeve.position.y = -0.1;
    this.rightArmGrid.add(rightSleeve);
    const rightArm = new THREE.Mesh(armGeom, skinMat);
    rightArm.position.y = -0.5;
    this.rightArmGrid.add(rightArm);
    this.bodyMesh.add(this.rightArmGrid);

    // 3. Head & Cap
    const headGeom = new THREE.BoxGeometry(0.55, 0.55, 0.55);
    this.headMesh = new THREE.Mesh(headGeom, skinMat);
    this.headMesh.position.set(0, 0.85, 0); // Positioned above body
    this.mesh.add(this.headMesh);

    // Hair
    const hairGeom = new THREE.BoxGeometry(0.57, 0.15, 0.57);
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x4a2e15 }); // Brown hair
    const hair = new THREE.Mesh(hairGeom, hairMat);
    hair.position.set(0, 0.28, 0);
    this.headMesh.add(hair);

    // Cap (Backwards)
    const capGeom = new THREE.BoxGeometry(0.55, 0.2, 0.55);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xdd2222 }); // Red cap
    const cap = new THREE.Mesh(capGeom, capMat);
    cap.position.set(0, 0.35, 0);

    const brimGeom = new THREE.BoxGeometry(0.51, 0.05, 0.3);
    const brim = new THREE.Mesh(brimGeom, capMat);
    brim.position.set(0, -0.05, -0.35); // Pointing backwards
    cap.add(brim);

    this.headMesh.add(cap);

    // Headphones
    const earcupGeom = new THREE.CylinderGeometry(0.18, 0.18, 0.1, 16);
    const earMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.6,
    });

    const leftEar = new THREE.Mesh(earcupGeom, earMat);
    leftEar.rotation.z = Math.PI / 2;
    leftEar.position.set(-0.3, 0.0, 0.0);
    this.headMesh.add(leftEar);

    const rightEar = leftEar.clone();
    rightEar.position.set(0.3, 0.0, 0.0);
    this.headMesh.add(rightEar);

    const bandGeom = new THREE.TorusGeometry(0.3, 0.03, 8, 24, Math.PI);
    const band = new THREE.Mesh(bandGeom, earMat);
    band.position.set(0, 0, 0);
    this.headMesh.add(band);

    // Sunglasses
    const glassGeom = new THREE.BoxGeometry(0.45, 0.12, 0.05);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x050505,
      roughness: 0.1,
      metalness: 0.9,
    });
    const shades = new THREE.Mesh(glassGeom, glassMat);
    // Move front slightly
    shades.position.set(0, 0.0, 0.28);
    this.headMesh.add(shades);

    // Cast & Receive shadows
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  private buildCopCharacter() {
    this.copGroup = new THREE.Group();
    // The Cop runs behind the player (e.g. z = -3.5, y = ground)
    this.copGroup.position.set(0, -0.7, -3.5);

    const uniformColor = 0x112255;
    // Cop Torso (Dark Blue uniform)
    const torsoGeom = new THREE.BoxGeometry(1.0, 1.2, 0.7);
    const torsoMat = new THREE.MeshStandardMaterial({
      color: uniformColor,
      roughness: 0.8,
    });
    const torso = new THREE.Mesh(torsoGeom, torsoMat);
    torso.position.y = 1.0;
    this.copGroup.add(torso);

    // Black belt
    const beltGeom = new THREE.BoxGeometry(1.05, 0.2, 0.75);
    const beltMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.9,
    });
    const belt = new THREE.Mesh(beltGeom, beltMat);
    belt.position.y = -0.5;
    torso.add(belt);

    // Gold buckle
    const buckleGeom = new THREE.BoxGeometry(0.3, 0.25, 0.1);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.8,
      roughness: 0.2,
    });
    const buckle = new THREE.Mesh(buckleGeom, goldMat);
    buckle.position.set(0, 0, 0.38);
    belt.add(buckle);

    // Gold badge
    const badgeGeom = new THREE.BoxGeometry(0.15, 0.2, 0.1);
    const badge = new THREE.Mesh(badgeGeom, goldMat);
    badge.position.set(-0.25, 0.3, 0.36);
    torso.add(badge);

    // Cop Legs (Dark Blue)
    const legGeom = new THREE.BoxGeometry(0.4, 0.8, 0.4);

    this.copLegLeft = new THREE.Mesh(legGeom, torsoMat);
    this.copLegLeft.position.set(-0.25, 0.1, 0);
    this.copGroup.add(this.copLegLeft);

    this.copLegRight = new THREE.Mesh(legGeom, torsoMat);
    this.copLegRight.position.set(0.25, 0.1, 0);
    this.copGroup.add(this.copLegRight);

    // Shoes
    const shoeGeom = new THREE.BoxGeometry(0.42, 0.2, 0.55);
    const shoeMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.8,
    });
    const leftShoe = new THREE.Mesh(shoeGeom, shoeMat);
    leftShoe.position.set(0, -0.5, 0.1);
    this.copLegLeft.add(leftShoe);

    const rightShoe = leftShoe.clone();
    this.copLegRight.add(rightShoe);

    // Cop Head & Hat
    const headGeom = new THREE.BoxGeometry(0.65, 0.65, 0.65);
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xfadcba,
      roughness: 0.6,
    });
    const head = new THREE.Mesh(headGeom, skinMat);
    head.position.y = 1.8;

    // Mustache
    const stacheGeom = new THREE.BoxGeometry(0.5, 0.15, 0.1);
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x221100,
      roughness: 0.9,
    });
    const mustache = new THREE.Mesh(stacheGeom, hairMat);
    mustache.position.set(0, -0.1, 0.33);
    head.add(mustache);

    const hatGeom = new THREE.BoxGeometry(0.7, 0.3, 0.7);
    const hat = new THREE.Mesh(hatGeom, torsoMat);
    hat.position.y = 0.45;

    const brimGeom = new THREE.BoxGeometry(0.75, 0.05, 0.5);
    const brimMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const brim = new THREE.Mesh(brimGeom, brimMat);
    brim.position.set(0, -0.1, 0.4); // front
    hat.add(brim);

    // Hat badge
    const hatBadge = new THREE.Mesh(badgeGeom, goldMat);
    hatBadge.position.set(0, 0.1, 0.36);
    hat.add(hatBadge);

    head.add(hat);
    this.copGroup.add(head);

    // Cop Arms
    const armGeom = new THREE.BoxGeometry(0.3, 0.9, 0.3);

    this.copArmLeft = new THREE.Group();
    this.copArmLeft.position.set(-0.65, 0.4, 0);
    const leftArmMesh = new THREE.Mesh(armGeom, torsoMat);
    leftArmMesh.position.y = -0.45;
    this.copArmLeft.add(leftArmMesh);
    torso.add(this.copArmLeft);

    this.copArmRight = new THREE.Group();
    this.copArmRight.position.set(0.65, 0.4, 0);
    const rightArmMesh = new THREE.Mesh(armGeom, torsoMat);
    rightArmMesh.position.y = -0.45;
    this.copArmRight.add(rightArmMesh);
    torso.add(this.copArmRight);

    // Build dog (Pitbull/Bulldog style)
    this.dogGroup = new THREE.Group();
    this.dogGroup.position.set(-0.7, -0.6, -3.2); // Offset to the left of the cop

    const dogColor = new THREE.MeshStandardMaterial({
      color: 0x8b5a2b,
      roughness: 0.9,
    });
    const dogBellyColor = new THREE.MeshStandardMaterial({
      color: 0xd2b48c,
      roughness: 0.9,
    });

    // Dog body
    const bodyGeomD = new THREE.BoxGeometry(0.4, 0.4, 0.7);
    const dogBody = new THREE.Mesh(bodyGeomD, dogColor);
    dogBody.position.y = 0.5;
    this.dogGroup.add(dogBody);

    // Belly patch
    const bellyGeom = new THREE.BoxGeometry(0.41, 0.2, 0.5);
    const belly = new THREE.Mesh(bellyGeom, dogBellyColor);
    belly.position.y = -0.15;
    dogBody.add(belly);

    // Dog head
    const headGeomD = new THREE.BoxGeometry(0.35, 0.35, 0.4);
    const dogHead = new THREE.Mesh(headGeomD, dogColor);
    dogHead.position.set(0, 0.7, 0.4);
    this.dogGroup.add(dogHead);

    // Dog snout
    const snoutGeom = new THREE.BoxGeometry(0.25, 0.2, 0.25);
    const dogSnout = new THREE.Mesh(snoutGeom, dogBellyColor);
    dogSnout.position.set(0, -0.05, 0.25);
    dogHead.add(dogSnout);

    // Dog nose
    const noseGeom = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const dogNose = new THREE.Mesh(
      noseGeom,
      new THREE.MeshStandardMaterial({ color: 0x111111 }),
    );
    dogNose.position.set(0, 0.05, 0.15);
    dogSnout.add(dogNose);

    // Dog Ears
    const earGeom = new THREE.BoxGeometry(0.1, 0.2, 0.1);
    const leftEar = new THREE.Mesh(earGeom, dogColor);
    leftEar.position.set(-0.15, 0.2, -0.1);
    leftEar.rotation.z = Math.PI / 8;
    dogHead.add(leftEar);
    const rightEar = leftEar.clone();
    rightEar.position.set(0.15, 0.2, -0.1);
    rightEar.rotation.z = -Math.PI / 8;
    dogHead.add(rightEar);

    // Dog legs
    const dLegGeom = new THREE.BoxGeometry(0.15, 0.35, 0.15);
    const legPositions = [
      { x: -0.12, z: 0.2 }, // Front left
      { x: 0.12, z: 0.2 }, // Front right
      { x: -0.12, z: -0.2 }, // Back left
      { x: 0.12, z: -0.2 }, // Back right
    ];

    this.dogLegs = [];
    legPositions.forEach((pos) => {
      const g = new THREE.Group();
      g.position.set(pos.x, 0.35, pos.z);
      const leg = new THREE.Mesh(dLegGeom, dogColor);
      leg.position.y = -0.15;
      g.add(leg);
      this.dogLegs.push(g);
      this.dogGroup.add(g);
    });

    this.dogGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.mesh.add(this.dogGroup);

    // Cast & Receive shadows
    this.copGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.mesh.add(this.copGroup);
  }

  /**
   * Action interfaces bound to touch/swipe inputs.
   */
  public laneLeft() {
    if (this.action === "CRASH") return;
    if (this.targetLane === 0) {
      this.targetLane = -1;
    } else if (this.targetLane === 1) {
      this.targetLane = 0;
    }
  }

  public laneRight() {
    if (this.action === "CRASH") return;
    if (this.targetLane === 0) {
      this.targetLane = 1;
    } else if (this.targetLane === -1) {
      this.targetLane = 0;
    }
  }

  public setTargetLaneDirect(lane: Lane) {
    if (this.action === "CRASH") return;
    this.targetLane = lane;
  }

  public setDuckingStatus(isDucking: boolean) {
    if (this.action === "CRASH") return;
    // Don't re-enter sliding/ducking state if we are in the middle of a jump
    if (this.action === "JUMP" && isDucking) return;

    this.isPersistentDucking = isDucking;
    if (isDucking) {
      if (this.action !== "CROUCH") {
        this.action = "CROUCH";
      }
      this.isSliding = true;
    } else {
      if (this.action === "CROUCH") {
        this.cancelSlide();
      }
    }
  }

  public jump() {
    if (this.action === "CRASH") return;
    if (this.isGrounded) {
      const power = this.isSuperSneakers
        ? this.jumpForce * 1.5
        : this.jumpForce;
      this.yVelocity = power;
      this.isGrounded = false;
      this.action = "JUMP";

      // Stop sliding if we jump mid-slide
      this.cancelSlide();
    }
  }

  public slide() {
    if (this.action === "CRASH") return;
    this.isPersistentDucking = false;
    this.isSliding = true;
    this.slideTimer = this.slideDuration;
    this.action = "CROUCH";

    // If airborne, immediately smash down to the ground (extremely popular pro mechanics in runners)
    if (!this.isGrounded) {
      this.yVelocity = -22.0; // fast-fall
    }
  }

  private cancelSlide() {
    this.isSliding = false;
    this.isPersistentDucking = false;
    this.slideTimer = 0;
    if (this.action === "CROUCH") {
      this.action = "RUN";
    }
  }

  public triggerCrash() {
    this.action = "CRASH";
  }

  public reset(startZ: number = 0) {
    this.currentLane = 0;
    this.targetLane = 0;
    this.speed = 15.0;
    this.position.set(0, this.baseHeight, startZ);
    this.mesh.position.copy(this.position);
    this.yVelocity = 0;
    this.isGrounded = true;
    this.isSliding = false;
    this.slideTimer = 0;
    this.mesh.rotation.set(0, 0, 0);
    this.boardMesh.rotation.set(0, 0, 0);
    this.bodyMesh.rotation.set(0, 0, 0);
    this.headMesh.rotation.set(0, 0, 0);
    this.mesh.scale.set(1, 1, 1);
    this.action = "RUN";
  }

  /**
   * Kinematic updates inside the render ticks.
   */
  public update(deltaTime: number) {
    if (this.action === "CRASH") {
      // Deccelerate quickly to a halt, spin slightly on crash
      this.speed = Math.max(0, this.speed - deltaTime * 40.0);
      this.position.z += this.speed * deltaTime;

      this.mesh.rotation.z += deltaTime * 5.0;
      this.mesh.rotation.x += deltaTime * 2.0;
      this.mesh.position.copy(this.position);
      return;
    }

    // Update equipment visibility
    if (this.jetpackMesh) this.jetpackMesh.visible = this.isJetpackActive;
    if (this.magnetMesh) this.magnetMesh.visible = this.isMagnetActive;
    if (this.sneakerLeftMesh)
      this.sneakerLeftMesh.visible = this.isSuperSneakers;
    if (this.sneakerRightMesh)
      this.sneakerRightMesh.visible = this.isSuperSneakers;

    // Powerup Timers
    if (this.isJetpackActive) {
      this.jetpackTimer -= deltaTime;
      this.baseHeight = 10.0; // Fly high!
      if (this.jetpackTimer <= 0) {
        this.isJetpackActive = false;
        this.baseHeight = 0.6;
      }
    }

    if (this.isMagnetActive) {
      this.magnetTimer -= deltaTime;
      if (this.magnetTimer <= 0) this.isMagnetActive = false;
    }

    if (this.isSuperSneakers) {
      this.sneakersTimer -= deltaTime;
      if (this.sneakersTimer <= 0) this.isSuperSneakers = false;
    }

    // 1. Advance Game Runner Speed
    this.speed = Math.min(
      this.maxSpeed,
      this.speed + this.speedGainedPerSec * deltaTime,
    );
    this.position.z += this.speed * deltaTime;

    // 2. Smooth Lane (X-Axis) Transition
    const targetX = -this.targetLane * PlayerController.LANE_WIDTH;
    const lerpFactor = 15.0 * deltaTime; // Quick robust snap
    this.position.x += (targetX - this.position.x) * Math.min(1.0, lerpFactor);

    // If extremely close, lock currentLane to target
    if (Math.abs(this.position.x - targetX) < 0.05) {
      this.currentLane = this.targetLane;
    }

    // 3. Jump Dynamics (Gravity and Flight)
    if (this.isGrounded) {
      if (this.position.y < this.baseHeight) {
        // If baseHeight is higher (jetpack), elevate smoothly
        this.position.y += (this.baseHeight - this.position.y) * 10 * deltaTime;
      } else if (this.position.y > this.baseHeight + 0.1) {
        // If we are grounded but way above baseHeight, we should be falling
        this.isGrounded = false;
      } else {
        this.position.y = this.baseHeight;
      }
    }

    if (!this.isGrounded) {
      this.yVelocity +=
        this.gravity *
        Math.max(1.0, this.isSuperSneakers ? 1.5 : 1.0) *
        deltaTime; // Fall faster if super sneakers
      this.position.y += this.yVelocity * deltaTime;

      // Ground limit check
      if (this.position.y <= this.baseHeight) {
        this.position.y = this.baseHeight;
        this.yVelocity = 0;
        this.isGrounded = true;
        if (this.action === "JUMP") {
          this.action = this.isSliding ? "CROUCH" : "RUN";
        }
      }
    }

    // 4. Slide Countdown
    if (this.isSliding && !this.isPersistentDucking) {
      this.slideTimer -= deltaTime;
      if (this.slideTimer <= 0) {
        this.cancelSlide();
      }
    }

    // Copy virtual position to ThreeJS mesh
    this.mesh.position.copy(this.position);

    // 5. Aesthetic Visual Polish / Micro-Animations
    this.animatePlayerVisuals(deltaTime);
  }

  /**
   * Applies juice to the character based on current states.
   */
  private animatePlayerVisuals(deltaTime: number) {
    // A. Sub-tilt on changing lanes
    const targetX = -this.targetLane * PlayerController.LANE_WIDTH;
    const laneDelta = targetX - this.position.x;
    const maxTilt = Math.PI / 10;

    // Tilt whole body into the direction of lane transit
    this.mesh.rotation.z +=
      (-laneDelta * 0.3 - this.mesh.rotation.z) * 12 * deltaTime;
    // Yaw board slightly for turning
    this.boardMesh.rotation.y +=
      (-laneDelta * 0.2 - this.boardMesh.rotation.y) * 12 * deltaTime;

    // B. Floating oscillation (hoverboard bobbing) when running or crouching
    if (this.isGrounded && !this.isSliding) {
      const bobbing = Math.sin(this.position.z * 1.5) * 0.06;
      this.mesh.position.y = this.baseHeight + bobbing;
    }

    // C. Flip animation when jumping
    if (!this.isGrounded && this.action === "JUMP") {
      // Rotate 360 over the course of jump height peak
      // Speed up or follow the jump arc
      this.boardMesh.rotation.x += deltaTime * Math.PI * 2.5;
    } else {
      // Normal flat boarding
      this.boardMesh.rotation.x +=
        (0 - this.boardMesh.rotation.x) * 15 * deltaTime;
    }

    // D. Ducking (Sliding) squash effect
    if (this.isSliding) {
      // Flatten avatar Group height scale, push lower torso down
      this.mesh.scale.y += (0.45 - this.mesh.scale.y) * 20 * deltaTime;
      this.mesh.scale.x += (1.15 - this.mesh.scale.x) * 20 * deltaTime;
      this.mesh.scale.z += (1.1 - this.mesh.scale.z) * 20 * deltaTime;

      // Keep collision parameters properly flat
      this.height = 0.8;
    } else {
      // Return smoothly to full vertical
      this.mesh.scale.y += (1.0 - this.mesh.scale.y) * 15 * deltaTime;
      this.mesh.scale.x += (1.0 - this.mesh.scale.x) * 15 * deltaTime;
      this.mesh.scale.z += (1.0 - this.mesh.scale.z) * 15 * deltaTime;

      this.height = 1.8;
    }

    // Running animation
    if (this.isJetpackActive) {
      // Flying pose
      this.leftLegGrid.rotation.x = -0.5;
      this.rightLegGrid.rotation.x = -0.5;
      this.leftArmGrid.rotation.x = 0;
      this.rightArmGrid.rotation.x = 0;
    } else if (this.isGrounded && !this.isSliding && this.action !== "CRASH") {
      const runSwing = Math.sin(this.position.z * 1.8) * 0.9;
      this.leftLegGrid.rotation.x = runSwing;
      this.rightLegGrid.rotation.x = -runSwing;
      this.leftArmGrid.rotation.x = -runSwing;
      this.rightArmGrid.rotation.x = runSwing;

      // Add a slight running hop
      this.mesh.position.y =
        this.baseHeight + Math.abs(Math.sin(this.position.z * 1.8)) * 0.15;
    } else if (this.isSliding) {
      this.leftLegGrid.rotation.x = 0;
      this.rightLegGrid.rotation.x = 0;
      this.leftArmGrid.rotation.x = -Math.PI / 2; // Arms forward during slide
      this.rightArmGrid.rotation.x = -Math.PI / 2;
    } else if (!this.isGrounded) {
      // Jumping pose dynamically changes based on vertical velocity
      const yVelNormalized = Math.max(-1, Math.min(1, this.yVelocity / 15.0)); // 1.0 at peak
      this.leftLegGrid.rotation.x = -0.3 - yVelNormalized * 0.2;
      this.rightLegGrid.rotation.x = 0.3 + yVelNormalized * 0.2;
      // Arms swing up, then down as we fall
      this.leftArmGrid.rotation.x = -2.5 - yVelNormalized * 0.5;
      this.rightArmGrid.rotation.x = -2.5 - yVelNormalized * 0.5;
    } else {
      this.leftLegGrid.rotation.x = 0;
      this.rightLegGrid.rotation.x = 0;
      this.leftArmGrid.rotation.x = 0;
      this.rightArmGrid.rotation.x = 0;
    }

    // Cop running animation
    if (this.copGroup) {
      if (this.action === "CRASH") {
        // Cop catches up!
        this.copGroup.position.z +=
          (1.0 - this.copGroup.position.z) * 5 * deltaTime;
        this.copGroup.position.x +=
          (-this.mesh.position.x - this.copGroup.position.x) * 5 * deltaTime;
        this.dogGroup.position.z +=
          (1.3 - this.dogGroup.position.z) * 5 * deltaTime;
        this.dogGroup.position.x +=
          (-this.mesh.position.x - 0.7 - this.dogGroup.position.x) *
          5 *
          deltaTime;

        this.copLegLeft.rotation.x = 0;
        this.copLegRight.rotation.x = 0;
        this.copArmLeft.rotation.x = 0;
        this.copArmRight.rotation.x = 0;
        this.dogLegs.forEach((leg) => (leg.rotation.x = 0));
      } else {
        // Cop stays behind
        this.copGroup.position.z +=
          (-3.5 - this.copGroup.position.z) * 5 * deltaTime;
        this.dogGroup.position.z +=
          (-3.2 - this.dogGroup.position.z) * 5 * deltaTime;
        // Legs & Arms shuffle
        const copRunSwing = Math.sin(this.position.z * 2.0) * 0.8;
        this.copLegLeft.rotation.x = copRunSwing;
        this.copLegRight.rotation.x = -copRunSwing;
        this.copArmLeft.rotation.x = -copRunSwing;
        this.copArmRight.rotation.x = copRunSwing;

        // Dog runs (faster frequency)
        const dogRunSwing = Math.sin(this.position.z * 3.5) * 1.0;
        this.dogLegs[0].rotation.x = dogRunSwing;
        this.dogLegs[1].rotation.x = -dogRunSwing;
        this.dogLegs[2].rotation.x = -dogRunSwing;
        this.dogLegs[3].rotation.x = dogRunSwing;

        // Cop tilts & tracks player
        this.copGroup.position.x +=
          (-this.mesh.position.x * 0.2 - this.copGroup.position.x) *
          5 *
          deltaTime;
        this.dogGroup.position.x +=
          (-this.mesh.position.x * 0.2 - 0.7 - this.dogGroup.position.x) *
          5 *
          deltaTime;
      }
    }
  }

  /**
   * Retrieves player's AABB bounding box in 3D coordinates.
   */
  public getBoundingBox(): THREE.Box3 {
    // Slide collision shifts y center lower
    const currentY = this.isSliding
      ? this.position.y - 0.2
      : this.position.y + 0.3;

    return new THREE.Box3(
      new THREE.Vector3(
        this.position.x - this.width / 2,
        currentY - this.height / 2,
        this.position.z - this.depth / 2,
      ),
      new THREE.Vector3(
        this.position.x + this.width / 2,
        currentY + this.height / 2,
        this.position.z + this.depth / 2,
      ),
    );
  }

  public activateJetpack() {
    this.isJetpackActive = true;
    this.jetpackTimer = this.jetpackDuration;
    // Boost base height immediately so we start flying
    // Gravity should not drag us down since update handles baseHeight = 10.0
  }

  public activateMagnet() {
    this.isMagnetActive = true;
    this.magnetTimer = this.magnetDuration;
  }

  public activateSneakers() {
    this.isSuperSneakers = true;
    this.sneakersTimer = this.sneakersDuration;
  }
}
