/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { Lane, PlayerAction } from '../types';

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
  private gravity = -42.0;
  private jumpForce = 15.0;
  public isGrounded = true;
  
  // Slide parameter
  public isSliding = false;
  private isPersistentDucking = false;
  private slideDuration = 0.7; // seconds
  private slideTimer = 0;
  
  // Visual sub-meshes for animation
  private bodyMesh!: THREE.Mesh;
  private boardMesh!: THREE.Mesh;
  private headMesh!: THREE.Mesh;
  private jetparticles: THREE.Points[] = [];

  // Collision box measurements
  public width = 1.2;
  public height = 1.8;
  public depth = 1.2;

  // Track state
  public action: PlayerAction = 'RUN';

  constructor() {
    this.mesh = new THREE.Group();
    this.buildStylizedCharacter();
    this.position.set(0, this.baseHeight, 0);
    this.mesh.position.copy(this.position);
  }

  /**
   * Procedural design for a gorgeous cyberpunk hoverboard runner.
   * Leverages geometric shapes, emissions, and distinct layers.
   */
  private buildStylizedCharacter() {
    // 1. Futuristic Hoverboard Base
    const boardGeom = new THREE.BoxGeometry(1.4, 0.15, 2.0);
    const boardMat = new THREE.MeshStandardMaterial({
      color: 0x111115,
      roughness: 0.2,
      metalness: 0.9,
    });
    this.boardMesh = new THREE.Mesh(boardGeom, boardMat);
    this.boardMesh.position.y = -0.5;
    this.mesh.add(this.boardMesh);

    // Board glowing rails (Neon cyan)
    const railGeom = new THREE.BoxGeometry(0.1, 0.1, 2.1);
    const railMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    
    const leftRail = new THREE.Mesh(railGeom, railMat);
    leftRail.position.set(-0.7, 0, 0);
    this.boardMesh.add(leftRail);

    const rightRail = leftRail.clone();
    rightRail.position.set(0.7, 0, 0);
    this.boardMesh.add(rightRail);

    // Board thruster/jet glow (Orange/cyan fire nozzle)
    const thrusterGeom = new THREE.CylinderGeometry(0.15, 0.2, 0.4, 8);
    const thrusterMat = new THREE.MeshStandardMaterial({ color: 0x444455, metalness: 0.8 });
    const thruster = new THREE.Mesh(thrusterGeom, thrusterMat);
    thruster.rotation.x = Math.PI / 2;
    thruster.position.set(0, -0.05, -1.0);
    this.boardMesh.add(thruster);

    const mainFlameGeom = new THREE.ConeGeometry(0.2, 0.6, 8);
    const mainFlameMat = new THREE.MeshBasicMaterial({ color: 0xff00cc }); // Cyberpunk Magenta exhaust
    const mainFlame = new THREE.Mesh(mainFlameGeom, mainFlameMat);
    mainFlame.rotation.x = -Math.PI / 2;
    mainFlame.position.set(0, -0.05, -1.4);
    this.boardMesh.add(mainFlame);

    // 2. Character Torso / Body (Cybernetic Suit)
    const bodyGeom = new THREE.BoxGeometry(0.9, 0.9, 0.6);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x222530,
      roughness: 0.1,
      metalness: 0.8,
    });
    this.bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
    this.bodyMesh.position.y = 0.1;
    this.mesh.add(this.bodyMesh);

    // Core Power Core (Glowing Magenta sphere on chest)
    const coreGeom = new THREE.SphereGeometry(0.2, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xff00cc });
    const chestCore = new THREE.Mesh(coreGeom, coreMat);
    chestCore.position.set(0, 0.1, 0.31);
    this.bodyMesh.add(chestCore);

    // Metallic shoulder pauldrons
    const shoulderGeom = new THREE.BoxGeometry(0.3, 0.4, 0.4);
    const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.9 });
    
    const leftShoulder = new THREE.Mesh(shoulderGeom, shoulderMat);
    leftShoulder.position.set(-0.6, 0.25, 0);
    this.bodyMesh.add(leftShoulder);

    const rightShoulder = leftShoulder.clone();
    rightShoulder.position.set(0.6, 0.25, 0);
    this.bodyMesh.add(rightShoulder);

    // 3. Cyber Head / Visor
    const headGeom = new THREE.BoxGeometry(0.6, 0.6, 0.5);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x181a23,
      roughness: 0.1,
      metalness: 0.7
    });
    this.headMesh = new THREE.Mesh(headGeom, headMat);
    this.headMesh.position.set(0, 0.95, 0);
    this.mesh.add(this.headMesh);

    // Glowing Neon Cyan Visor
    const visorGeom = new THREE.BoxGeometry(0.7, 0.18, 0.1);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const visor = new THREE.Mesh(visorGeom, visorMat);
    visor.position.set(0, 0.05, 0.251);
    this.headMesh.add(visor);

    // Antennas / Tech horns
    const hornGeom = new THREE.CylinderGeometry(0.04, 0.02, 0.3, 4);
    const hornMat = new THREE.MeshStandardMaterial({ color: 0x00ffff });
    const leftHorn = new THREE.Mesh(hornGeom, hornMat);
    leftHorn.rotation.z = -Math.PI / 6;
    leftHorn.position.set(-0.3, 0.35, 0);
    this.headMesh.add(leftHorn);

    const rightHorn = leftHorn.clone();
    rightHorn.rotation.z = Math.PI / 6;
    rightHorn.position.set(0.3, 0.35, 0);
    this.headMesh.add(rightHorn);

    // Cast & Receive shadows
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  /**
   * Action interfaces bound to touch/swipe inputs.
   */
  public laneLeft() {
    if (this.action === 'CRASH') return;
    if (this.targetLane === 0) {
      this.targetLane = -1;
    } else if (this.targetLane === 1) {
      this.targetLane = 0;
    }
  }

  public laneRight() {
    if (this.action === 'CRASH') return;
    if (this.targetLane === 0) {
      this.targetLane = 1;
    } else if (this.targetLane === -1) {
      this.targetLane = 0;
    }
  }

  public setTargetLaneDirect(lane: Lane) {
    if (this.action === 'CRASH') return;
    this.targetLane = lane;
  }

  public setDuckingStatus(isDucking: boolean) {
    if (this.action === 'CRASH') return;
    // Don't re-enter sliding/ducking state if we are in the middle of a jump
    if (this.action === 'JUMP' && isDucking) return;                

    this.isPersistentDucking = isDucking;
    if (isDucking) {
      if (this.action !== 'CROUCH') {
        this.action = 'CROUCH';
      }
      this.isSliding = true;
    } else {
      if (this.action === 'CROUCH') {
        this.cancelSlide();
      }
    }
  }

  public jump() {
    if (this.action === 'CRASH') return;
    if (this.isGrounded) {
      this.yVelocity = this.jumpForce;
      this.isGrounded = false;
      this.action = 'JUMP';
      
      // Stop sliding if we jump mid-slide
      this.cancelSlide();
    }
  }

  public slide() {
    if (this.action === 'CRASH') return;
    this.isPersistentDucking = false;
    this.isSliding = true;
    this.slideTimer = this.slideDuration;
    this.action = 'CROUCH';

    // If airborne, immediately smash down to the ground (extremely popular pro mechanics in runners)
    if (!this.isGrounded) {
      this.yVelocity = -22.0; // fast-fall
    }
  }

  private cancelSlide() {
    this.isSliding = false;
    this.isPersistentDucking = false;
    this.slideTimer = 0;
    if (this.action === 'CROUCH') {
      this.action = 'RUN';
    }
  }

  public triggerCrash() {
    this.action = 'CRASH';
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
    this.action = 'RUN';
  }

  /**
   * Kinematic updates inside the render ticks.
   */
  public update(deltaTime: number) {
    if (this.action === 'CRASH') {
      // Deccelerate quickly to a halt, spin slightly on crash
      this.speed = Math.max(0, this.speed - deltaTime * 40.0);
      this.position.z += this.speed * deltaTime;
      
      this.mesh.rotation.z += deltaTime * 5.0;
      this.mesh.rotation.x += deltaTime * 2.0;
      this.mesh.position.copy(this.position);
      return;
    }

    // 1. Advance Game Runner Speed
    this.speed = Math.min(this.maxSpeed, this.speed + this.speedGainedPerSec * deltaTime);
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
    if (!this.isGrounded) {
      this.yVelocity += this.gravity * deltaTime;
      this.position.y += this.yVelocity * deltaTime;

      // Ground limit check
      if (this.position.y <= this.baseHeight) {
        this.position.y = this.baseHeight;
        this.yVelocity = 0;
        this.isGrounded = true;
        if (this.action === 'JUMP') {
          this.action = this.isSliding ? 'CROUCH' : 'RUN';
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
    this.mesh.rotation.z += (-laneDelta * 0.3 - this.mesh.rotation.z) * 12 * deltaTime;
    // Yaw board slightly for turning
    this.boardMesh.rotation.y += (-laneDelta * 0.2 - this.boardMesh.rotation.y) * 12 * deltaTime;

    // B. Floating oscillation (hoverboard bobbing) when running or crouching
    if (this.isGrounded && !this.isSliding) {
      const bobbing = Math.sin(this.position.z * 1.5) * 0.06;
      this.mesh.position.y = this.baseHeight + bobbing;
    }

    // C. Flip animation when jumping
    if (!this.isGrounded && this.action === 'JUMP') {
      // Rotate 360 over the course of jump height peak
      // Speed up or follow the jump arc
      this.boardMesh.rotation.x += deltaTime * Math.PI * 2.5; 
    } else {
      // Normal flat boarding
      this.boardMesh.rotation.x += (0 - this.boardMesh.rotation.x) * 15 * deltaTime;
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

    // Dynamic flame flicker at the back
    const flameVal = 1.0 + Math.sin(this.position.z * 10) * 0.15;
    const thrusterFlame = this.boardMesh.children[3]; // The mainFlame Mesh compiled above
    if (thrusterFlame) {
      thrusterFlame.scale.set(flameVal, flameVal, flameVal);
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
      new THREE.Vector3(this.position.x - this.width / 2, currentY - this.height / 2, this.position.z - this.depth / 2),
      new THREE.Vector3(this.position.x + this.width / 2, currentY + this.height / 2, this.position.z + this.depth / 2)
    );
  }
}
