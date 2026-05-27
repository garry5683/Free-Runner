/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { Lane, Obstacle, Coin, ObstacleType, Segment } from '../types';
import { PlayerController } from './PlayerController';

export class WorldGenerator {
  private scene: THREE.Scene;

  // Track settings
  public static readonly SEGMENT_LENGTH = 60.0;
  public static readonly VISIBLE_SEGMENTS = 5;
  
  // Track structures
  public activeSegments: Segment[] = [];
  public activeObstacles: Obstacle[] = [];
  public activeCoins: Coin[] = [];

  // Spawning controls
  private segmentIdCounter = 0;
  private obstacleIdCounter = 0;
  private coinIdCounter = 0;

  // Reusable materials & geometries for super high-performance
  private trackMaterial: THREE.MeshStandardMaterial;
  private laneDividerMaterial: THREE.MeshBasicMaterial;
  private coinGeometry: THREE.CylinderGeometry;
  private coinMaterial: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Define reusable assets with cyberpunk themes (dark metallic runways and neon linings)
    this.trackMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f0f13,
      roughness: 0.5,
      metalness: 0.85,
    });

    this.laneDividerMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff88, // Neon mint green dividers
    });

    // Elegant spinning polygon coin
    this.coinGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.12, 8);
    this.coinMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700, // Golden yellow
      emissive: 0xffaa00,
      emissiveIntensity: 0.4,
      metalness: 0.95,
      roughness: 0.1,
    });
  }

  /**
   * Initializes the starting segment list.
   * First few segments are always empty so the player can get ready.
   */
  public init() {
    this.clearAll();

    // Spawn initial segments in advance
    for (let i = 0; i < WorldGenerator.VISIBLE_SEGMENTS; i++) {
      const zPos = i * WorldGenerator.SEGMENT_LENGTH;
      const spawnHazards = i > 1; // Start spawning hazards after segment 1
      this.spawnSegment(zPos, spawnHazards);
    }
  }

  /**
   * Recycles historical segments behind the player, creating upcoming segments in front.
   */
  public updateSegments(playerZ: number) {
    // If the oldest segment is completely behind the player, purge and append a new one
    if (this.activeSegments.length > 0) {
      const oldest = this.activeSegments[0];
      if (playerZ > oldest.z + WorldGenerator.SEGMENT_LENGTH) {
        // Remove old segment
        this.scene.remove(oldest.mesh);
        oldest.mesh.traverse((child: any) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((mat) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        this.activeSegments.shift();

        // Cleanup retired hazards and coins in that zone
        const cleanupThreshold = oldest.z + WorldGenerator.SEGMENT_LENGTH;
        this.activeObstacles = this.activeObstacles.filter((obs) => {
          if (obs.z <= cleanupThreshold) {
            if (obs.mesh) this.scene.remove(obs.mesh);
            return false;
          }
          return true;
        });

        this.activeCoins = this.activeCoins.filter((coin) => {
          if (coin.z <= cleanupThreshold) {
            if (coin.mesh) this.scene.remove(coin.mesh);
            return false;
          }
          return true;
        });

        // Spawn next segment far ahead
        const newest = this.activeSegments[this.activeSegments.length - 1];
        const nextZ = newest.z + WorldGenerator.SEGMENT_LENGTH;
        this.spawnSegment(nextZ, true);
      }
    }
  }

  /**
   * Spawns a physical track tile of 60 meters and adds environment props in left/right gutters.
   */
  private spawnSegment(zCenter: number, spawnHazards: boolean) {
    const group = new THREE.Group();
    group.position.z = zCenter;

    // 1. Core Runway Slab
    const roadWidth = PlayerController.LANE_WIDTH * 3 + 1.0;
    const roadGeom = new THREE.BoxGeometry(roadWidth, 0.4, WorldGenerator.SEGMENT_LENGTH);
    const roadMesh = new THREE.Mesh(roadGeom, this.trackMaterial);
    roadMesh.position.y = -0.2; // Keep surface at y=0
    roadMesh.receiveShadow = true;
    group.add(roadMesh);

    // 2. Neon Lane Dividers
    const lineGeom = new THREE.BoxGeometry(0.12, 0.05, WorldGenerator.SEGMENT_LENGTH);
    
    // Left divider (between left and center lane)
    const dividerLeft = new THREE.Mesh(lineGeom, this.laneDividerMaterial);
    dividerLeft.position.set(-PlayerController.LANE_WIDTH / 2, 0.01, 0);
    group.add(dividerLeft);

    // Right divider (between center and right lane)
    const dividerRight = new THREE.Mesh(lineGeom, this.laneDividerMaterial);
    dividerRight.position.set(PlayerController.LANE_WIDTH / 2, 0.01, 0);
    group.add(dividerRight);

    // Grid details on the road (horizontal neon slices for retro synthwave speed effect)
    const horizontalSlices = 4;
    const sliceGeom = new THREE.BoxGeometry(roadWidth, 0.05, 0.15);
    const sliceMat = new THREE.MeshBasicMaterial({ color: 0x0033cc }); // subtle cyan/grid color
    for (let i = 0; i < horizontalSlices; i++) {
      const sliceZ = -WorldGenerator.SEGMENT_LENGTH / 2 + (WorldGenerator.SEGMENT_LENGTH / horizontalSlices) * i;
      const sliceMesh = new THREE.Mesh(sliceGeom, sliceMat);
      sliceMesh.position.set(0, 0.005, sliceZ);
      group.add(sliceMesh);
    }

    // 3. Side Walls / Elevated Cyber rails
    const railHeight = 0.8;
    const sideRailGeom = new THREE.BoxGeometry(0.4, railHeight, WorldGenerator.SEGMENT_LENGTH);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x181822, metalness: 0.9, roughness: 0.4 });
    
    const leftSideRail = new THREE.Mesh(sideRailGeom, railMat);
    leftSideRail.position.set(-roadWidth / 2 - 0.2, railHeight / 2 - 0.2, 0);
    group.add(leftSideRail);

    const rightSideRail = leftSideRail.clone();
    rightSideRail.position.set(roadWidth / 2 + 0.2, railHeight / 2 - 0.2, 0);
    group.add(rightSideRail);

    // Glowing strips bounding the rails
    const stripGeom = new THREE.BoxGeometry(0.05, 0.15, WorldGenerator.SEGMENT_LENGTH);
    const magentaStripMat = new THREE.MeshBasicMaterial({ color: 0xff00ff }); // Retro synth Magenta

    const lStrip = new THREE.Mesh(stripGeom, magentaStripMat);
    lStrip.position.set(-roadWidth / 2 - 0.2, railHeight - 0.2, 0);
    group.add(lStrip);

    const rStrip = lStrip.clone();
    rStrip.position.set(roadWidth / 2 + 0.2, railHeight - 0.2, 0);
    group.add(rStrip);

    // 4. Background Skyscrapers/Vistas on Left & Right
    const buildingSparsity = 3;
    for (let k = 0; k < buildingSparsity; k++) {
      const buildZ = -WorldGenerator.SEGMENT_LENGTH / 2 + (WorldGenerator.SEGMENT_LENGTH / buildingSparsity) * k + (Math.random() - 0.5) * 5;
      
      // Random tall heights
      const buildHeight = 15 + Math.random() * 25;
      const buildWidth = 5 + Math.random() * 8;
      const bGeom = new THREE.BoxGeometry(buildWidth, buildHeight, buildWidth);
      
      // Cyber neon theme skyscraper: dark block with random glowing window textures
      const hue = Math.random() > 0.5 ? 0x0088ff : 0xaa00ff; // blue or dark purple
      const bMat = new THREE.MeshStandardMaterial({
        color: hue,
        metalness: 0.9,
        roughness: 0.8
      });
      
      const leftBuilding = new THREE.Mesh(bGeom, bMat);
      leftBuilding.position.set(-roadWidth / 2 - 6 - Math.random() * 5, buildHeight / 2 - 4, buildZ);
      group.add(leftBuilding);

      const rightBuilding = leftBuilding.clone();
      rightBuilding.position.set(roadWidth / 2 + 6 + Math.random() * 5, buildHeight / 2 - 4, buildZ);
      group.add(rightBuilding);

      // Light caps on skyscrapers
      const capGeom = new THREE.SphereGeometry(0.3, 8, 8);
      const capMat = new THREE.MeshBasicMaterial({ color: 0xff00cc });
      
      const leftCap = new THREE.Mesh(capGeom, capMat);
      leftCap.position.set(leftBuilding.position.x, buildHeight - 4, buildZ);
      group.add(leftCap);

      const rightCap = leftCap.clone();
      rightCap.position.set(rightBuilding.position.x, buildHeight - 4, buildZ);
      group.add(rightCap);
    }

    // Append to actual 3D scene
    this.scene.add(group);

    const segmentObj: Segment = {
      id: `seg_${this.segmentIdCounter++}`,
      z: zCenter,
      mesh: group
    };
    this.activeSegments.push(segmentObj);

    // 5. Procedural Hazard & Coin Generation using Level Patterns
    if (spawnHazards) {
      this.generateHazardsForSegment(zCenter);
    }
  }

  /**
   * Level Design Patterns: Ensures fairness and creates flow states.
   */
  private generateHazardsForSegment(zCenter: number) {
    const lanes: Lane[] = [-1, 0, 1];
    const segmentStart = zCenter - WorldGenerator.SEGMENT_LENGTH / 2;

    // We can spawn obstacles inside this segment. Let's arrange 2 obstacle clusters per 60m segment.
    // e.g., position 1 around 15m into segment, and position 2 around 45m.
    const clusterPositions = [18.0, 42.0];

    clusterPositions.forEach((clusterOffset) => {
      const spawnZ = segmentStart + clusterOffset;
      
      // Select a level design pattern
      // 0: One low barrier, one center coin, one high barrier (fully traversable)
      // 1: Big blockers blocking two lanes, leaving one single corridor
      // 2: Multi-jump coin trail
      // 3: High gate across center lane, side blockers
      const pattern = Math.floor(Math.random() * 4);

      // Shuffle lanes to randomize experiences
      const shuffledLanes = [...lanes].sort(() => Math.random() - 0.5);

      if (pattern === 0) {
        // Standard layout
        // Lane A: Low barrier (must jump)
        // Lane B: High barrier (must duck)
        // Lane C: Safe Corridor + Coins
        this.spawnObstacle('BARRIER_LOW', shuffledLanes[0], spawnZ);
        this.spawnObstacle('BARRIER_HIGH', shuffledLanes[1], spawnZ);
        
        // Coins in safe lane
        this.spawnCoinColumn(shuffledLanes[2], spawnZ - 5, 4, false);
      } else if (pattern === 1) {
        // Massive trains / blockades
        // Block 2 lanes entirely, leave 1 lane wide open, with height coins
        this.spawnObstacle('TRAIN_STATIC', shuffledLanes[0], spawnZ);
        this.spawnObstacle('TRAIN_STATIC', shuffledLanes[1], spawnZ);

        // Safe corridor
        // Add a nice straight chain of coins following a jumping curve
        this.spawnCoinColumn(shuffledLanes[2], spawnZ - 10, 6, true);
      } else if (pattern === 2) {
        // Mixed Coin trail and single low barrier
        this.spawnObstacle('BARRIER_LOW', shuffledLanes[0], spawnZ);
        
        // Spawn standard coins columns for the free lanes
        this.spawnCoinColumn(shuffledLanes[1], spawnZ - 8, 4, false);
        this.spawnCoinColumn(shuffledLanes[2], spawnZ - 8, 4, false);
      } else {
        // Gate blocking layout
        // Center has floating slide-bar, side lanes have one roadblocker
        this.spawnObstacle('BARRIER_HIGH', 0, spawnZ); // Center slide
        this.spawnObstacle('TRAIN_STATIC', shuffledLanes[0] === 0 ? shuffledLanes[1] : shuffledLanes[0], spawnZ);
        
        // Safe lane gets high coin trail
        const safeLane = (shuffledLanes[2] === 0) ? shuffledLanes[1] : shuffledLanes[2];
        this.spawnCoinColumn(safeLane, spawnZ - 5, 3, false);
      }
    });
  }

  /**
   * Spawns a physical coin column along Z, optionally shaped as an arc (parabolic curve for jumps).
   */
  private spawnCoinColumn(lane: Lane, startZ: number, count: number, arched = false) {
    const spacing = 2.4;
    for (let i = 0; i < count; i++) {
      const zPos = startZ + i * spacing;
      
      // Calculate parabolic Y height if arched
      let yPos = 0.55; // default hovering collector height
      if (arched) {
        // vertex formula
        const midIdx = (count - 1) / 2;
        const normalizedDiff = (i - midIdx);
        yPos = 3.6 - (normalizedDiff * normalizedDiff) * 0.45;
      }

      this.spawnCoin(lane, zPos, yPos);
    }
  }

  /**
   * Renders and stores a collectible gold coin.
   */
  private spawnCoin(lane: Lane, zPos: number, yPos: number) {
    const coinMesh = new THREE.Mesh(this.coinGeometry, this.coinMaterial);
    
    // Position
    coinMesh.rotation.x = Math.PI / 2;
    coinMesh.position.set(-lane * PlayerController.LANE_WIDTH, yPos, zPos);
    coinMesh.castShadow = true;
    
    this.scene.add(coinMesh);

    this.activeCoins.push({
      id: `coin_${this.coinIdCounter++}`,
      lane,
      z: zPos,
      y: yPos,
      mesh: coinMesh,
      collected: false
    });
  }

  /**
   * Instantiates the core obstacles based on geometry specs.
   */
  private spawnObstacle(type: ObstacleType, lane: Lane, zPos: number) {
    let width = 1.0;
    let height = 1.0;
    let depth = 1.0;

    let obsMesh: THREE.Group | THREE.Mesh;

    const xPos = -lane * PlayerController.LANE_WIDTH;

    // Retro Synth / Tech theme meshes
    if (type === 'BARRIER_LOW') {
      width = 2.8;
      height = 0.95;
      depth = 0.6;

      const group = new THREE.Group();

      // Horizontal bar
      const barGeom = new THREE.BoxGeometry(width, 0.2, depth);
      const labelMat = new THREE.MeshStandardMaterial({
        color: 0xffaa00, // Hazard Warning Yellow
        roughness: 0.1,
        metalness: 0.8
      });
      const bar = new THREE.Mesh(barGeom, labelMat);
      bar.position.y = height - 0.1;
      group.add(bar);

      // Warning stripes
      const stripeGeom = new THREE.BoxGeometry(width - 0.1, 0.02, depth + 0.02);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const stripe = new THREE.Mesh(stripeGeom, stripeMat);
      stripe.position.set(0, height - 0.09, 0);
      group.add(stripe);

      // Two side support legs
      const legGeom = new THREE.BoxGeometry(0.2, height, 0.2);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.5 });
      
      const leftLeg = new THREE.Mesh(legGeom, legMat);
      leftLeg.position.set(-width / 2 + 0.2, height / 2, 0);
      group.add(leftLeg);

      const rightLeg = leftLeg.clone();
      rightLeg.position.set(width / 2 - 0.2, height / 2, 0);
      group.add(rightLeg);

      group.position.set(xPos, 0, zPos);
      this.scene.add(group);
      obsMesh = group;

    } else if (type === 'BARRIER_HIGH') {
      width = 3.2;
      height = 1.4; // Hanging height
      depth = 0.5;

      const group = new THREE.Group();

      // Top floating electric laser bar - lowered visually to be duckable
      const topBarGeom = new THREE.BoxGeometry(width, 0.25, depth);
      const housingMat = new THREE.MeshStandardMaterial({ color: 0x2d3748, metalness: 0.8 });
      const topHousing = new THREE.Mesh(topBarGeom, housingMat);
      topHousing.position.y = 1.6;
      group.add(topHousing);

      // Glowing Cyan Laser tube under it - lowered to block standard upright height (1.8) while allowing slide pass-under (0.8)
      const laserTubeGeom = new THREE.CylinderGeometry(0.12, 0.12, width - 0.2, 8);
      const laserMat = new THREE.MeshBasicMaterial({ color: 0x00ffff }); // Electric Cyan laser
      const laser = new THREE.Mesh(laserTubeGeom, laserMat);
      laser.rotation.z = Math.PI / 2;
      laser.position.set(0, 1.35, 0);
      group.add(laser);

      // Laser emitters dangling from side pillars (located outside lane width bounds) - adjusted height
      const emitterGeom = new THREE.BoxGeometry(0.3, 0.4, 0.4);
      const emitterMat = new THREE.MeshStandardMaterial({ color: 0xfa3e3e, metalness: 0.9 });
      
      const leftEmitter = new THREE.Mesh(emitterGeom, emitterMat);
      leftEmitter.position.set(-width / 2 + 0.15, 1.475, 0);
      group.add(leftEmitter);

      const rightEmitter = leftEmitter.clone();
      rightEmitter.position.set(width / 2 - 0.15, 1.475, 0);
      group.add(rightEmitter);

      group.position.set(xPos, 0, zPos);
      this.scene.add(group);
      obsMesh = group;

      // Force high box profile
      // Set bounding measurements
      height = 2.4; // Box goes from 1.6 to 2.4 y
    } else {
      // TRAIN_STATIC (Solid large blocker)
      width = 3.2;
      height = 3.8;
      depth = 7.0;

      const group = new THREE.Group();

      // Base cyber container block
      const boxGeom = new THREE.BoxGeometry(width, height, depth);
      const boxMat = new THREE.MeshStandardMaterial({
        color: 0xff0044, // Cyber hot reddish magenta
        metalness: 0.88,
        roughness: 0.1
      });
      const mainBlock = new THREE.Mesh(boxGeom, boxMat);
      mainBlock.position.y = height / 2;
      mainBlock.castShadow = true;
      mainBlock.receiveShadow = true;
      group.add(mainBlock);

      // Giant neon hazard warning indicator on front (looking at player)
      const shieldGeom = new THREE.BoxGeometry(2.0, 1.2, 0.1);
      const shieldMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const warningSign = new THREE.Mesh(shieldGeom, shieldMat);
      warningSign.position.set(0, height / 2 + 0.5, -depth / 2 - 0.05); // Face oncoming player
      group.add(warningSign);

      // Tech details/grooves
      const grovGeom = new THREE.BoxGeometry(3.22, 0.1, depth - 1);
      const grovMat = new THREE.MeshStandardMaterial({ color: 0x07070a });
      const stripeLine = new THREE.Mesh(grovGeom, grovMat);
      stripeLine.position.y = 1.0;
      group.add(stripeLine);

      group.position.set(xPos, 0, zPos);
      this.scene.add(group);
      obsMesh = group;
    }

    // Shadow mapping enabled
    obsMesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.activeObstacles.push({
      id: `obs_${this.obstacleIdCounter++}`,
      type,
      lane,
      z: zPos,
      width,
      height,
      depth,
      mesh: obsMesh,
      collided: false,
      getBoundingBox() {
        const xPosMath = -lane * PlayerController.LANE_WIDTH;
        if (type === 'BARRIER_HIGH') {
          // A BARRIER_HIGH spans from y = 1.05 up to y = 2.4 to intercept standing/jumping players
          // while leaving clear clearance for crouch-sliding runners (height 0.8)
          return new THREE.Box3(
            new THREE.Vector3(xPosMath - width / 2, 1.05, zPos - depth / 2),
            new THREE.Vector3(xPosMath + width / 2, 2.4, zPos + depth / 2)
          );
        } else if (type === 'BARRIER_LOW') {
          // A BARRIER_LOW is a waist-high barrier that spans from ground (y=0) up to y = height
          return new THREE.Box3(
            new THREE.Vector3(xPosMath - width / 2, 0.0, zPos - depth / 2),
            new THREE.Vector3(xPosMath + width / 2, height, zPos + depth / 2)
          );
        } else {
          // TRAIN_STATIC spans from ground (y=0) up to y = height
          return new THREE.Box3(
            new THREE.Vector3(xPosMath - width / 2, 0.0, zPos - depth / 2),
            new THREE.Vector3(xPosMath + width / 2, height, zPos + depth / 2)
          );
        }
      }
    });
  }

  /**
   * Resets entire play-arena. Completely drains physical models.
   */
  public clearAll() {
    this.activeSegments.forEach((seg) => this.scene.remove(seg.mesh));
    this.activeObstacles.forEach((obs) => {
      if (obs.mesh) this.scene.remove(obs.mesh);
    });
    this.activeCoins.forEach((coin) => {
      if (coin.mesh) this.scene.remove(coin.mesh);
    });

    this.activeSegments = [];
    this.activeObstacles = [];
    this.activeCoins = [];

    this.segmentIdCounter = 0;
    this.obstacleIdCounter = 0;
    this.coinIdCounter = 0;
  }

  /**
   * Collects a coin: hides its mesh visually, marks true.
   */
  public collectCoin(coin: Coin) {
    coin.collected = true;
    if (coin.mesh) {
      this.scene.remove(coin.mesh);
      coin.mesh = undefined;
    }
  }

  /**
   * Continuous updates like spinning coins recursively.
   */
  public tick(deltaTime: number) {
    this.activeCoins.forEach((coin) => {
      if (coin.mesh) {
        // Spin coins nicely
        coin.mesh.rotation.z += deltaTime * 2.8;
        // Subtle levitation bobbing
        coin.mesh.position.y = coin.y + Math.sin(coin.mesh.position.z * 1.5) * 0.12;
      }
    });
  }
}
