/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from "three";
import {
  Lane,
  Obstacle,
  Coin,
  ObstacleType,
  Segment,
  Powerup,
  PowerupType,
} from "../types";
import { PlayerController } from "./PlayerController";

export class WorldGenerator {
  private scene: THREE.Scene;

  // Track settings
  public static readonly SEGMENT_LENGTH = 60.0;
  public static readonly VISIBLE_SEGMENTS = 5;

  // Track structures
  public activeSegments: Segment[] = [];
  public activeObstacles: Obstacle[] = [];
  public activeCoins: Coin[] = [];
  public activePowerups: Powerup[] = [];

  // Spawning controls
  private segmentIdCounter = 0;
  private obstacleIdCounter = 0;
  private coinIdCounter = 0;
  private powerupIdCounter = 0;

  // Reusable materials & geometries for super high-performance
  private trackMaterial: THREE.MeshStandardMaterial;
  private laneDividerMaterial: THREE.MeshBasicMaterial;
  private coinGeometry: THREE.CylinderGeometry;
  private coinMaterial: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Define reusable assets with Subway Surfers style themes (bright colors, gravel, tracks, brick)
    this.trackMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b7355, // Gravel brown
      roughness: 0.9,
      metalness: 0.1,
    });

    this.laneDividerMaterial = new THREE.MeshBasicMaterial({
      color: 0x888888, // Steel rails
    });

    // Elegant spinning coin
    this.coinGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 24);
    this.coinMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700, // Yellowish Gold
      metalness: 0.9,
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

        this.activePowerups = this.activePowerups.filter((pow) => {
          if (pow.z <= cleanupThreshold) {
            if (pow.mesh) this.scene.remove(pow.mesh);
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

    // 1. Core Runway Slab (Gravel)
    const roadWidth = PlayerController.LANE_WIDTH * 3 + 1.0;
    const roadGeom = new THREE.BoxGeometry(
      roadWidth,
      0.4,
      WorldGenerator.SEGMENT_LENGTH,
    );
    const roadMesh = new THREE.Mesh(roadGeom, this.trackMaterial);
    roadMesh.position.y = -0.2; // Keep surface at y=0
    roadMesh.receiveShadow = true;
    group.add(roadMesh);

    // 2. Train Tracks (Rails & Ties for each lane)
    const tieGeom = new THREE.BoxGeometry(
      PlayerController.LANE_WIDTH - 0.2,
      0.05,
      0.4,
    );
    const tieMat = new THREE.MeshStandardMaterial({
      color: 0x4a3c31,
      roughness: 1.0,
    }); // Wood ties
    const railGeom = new THREE.BoxGeometry(
      0.12,
      0.1,
      WorldGenerator.SEGMENT_LENGTH,
    );
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xb0b0b0,
      metalness: 0.8,
      roughness: 0.3,
    }); // Steel rails

    for (let lane of [-1, 0, 1]) {
      const laneCenterId = lane * PlayerController.LANE_WIDTH;
      // Add left and right rail for the lane
      const leftRail = new THREE.Mesh(railGeom, railMat);
      leftRail.position.set(laneCenterId - 0.7, 0.05, 0);
      group.add(leftRail);

      const rightRail = new THREE.Mesh(railGeom, railMat);
      rightRail.position.set(laneCenterId + 0.7, 0.05, 0);
      group.add(rightRail);

      // Add wooden ties
      const numTies = Math.floor(WorldGenerator.SEGMENT_LENGTH / 1.5);
      for (let i = 0; i < numTies; i++) {
        const tieZ = -WorldGenerator.SEGMENT_LENGTH / 2 + (i + 0.5) * 1.5;
        const tieMesh = new THREE.Mesh(tieGeom, tieMat);
        tieMesh.position.set(laneCenterId, 0.025, tieZ);
        group.add(tieMesh);
      }
    }

    // 3. Side Walls (Cityscape Buildings)
    const buildingColors = [0x5566aa, 0x7788dd, 0xaaaaaa, 0x996655, 0x8899aa];

    // Create random buildings alongside track
    const buildBuildings = (xPos: number) => {
      const numBuildings = Math.floor(WorldGenerator.SEGMENT_LENGTH / 8.0);
      for (let i = 0; i < numBuildings; i++) {
        const bWidth = 5 + Math.random() * 4;
        const bHeight = 10 + Math.random() * 20;
        const bDepth = 6 + Math.random() * 3;

        const bGroup = new THREE.Group();

        const bGeom = new THREE.BoxGeometry(bWidth, bHeight, bDepth);
        const col =
          buildingColors[Math.floor(Math.random() * buildingColors.length)];
        const bMat = new THREE.MeshStandardMaterial({
          color: col,
          roughness: 0.9,
          metalness: 0.1,
        });
        const building = new THREE.Mesh(bGeom, bMat);
        building.position.set(0, bHeight / 2 - 0.5, 0);
        building.castShadow = true;
        building.receiveShadow = true;
        bGroup.add(building);

        // Roof trim
        const roofGeom = new THREE.BoxGeometry(bWidth + 0.4, 0.5, bDepth + 0.4);
        const roofMat = new THREE.MeshStandardMaterial({
          color: 0x222222,
          roughness: 0.8,
        });
        const roof = new THREE.Mesh(roofGeom, roofMat);
        roof.position.set(0, bHeight - 0.25, 0);
        bGroup.add(roof);

        // Add random glowing windows on the front face
        const windowGeom = new THREE.PlaneGeometry(0.8, 1.2);
        const windowMat = new THREE.MeshStandardMaterial({
          color: 0xffffcc,
          emissive: 0xddaa00,
          emissiveIntensity: 0.8,
        });
        const numFloors = Math.floor(bHeight / 3);
        for (let floor = 1; floor < numFloors; floor++) {
          if (Math.random() > 0.5) {
            // 50% chance for a lit window on this floor
            const win = new THREE.Mesh(windowGeom, windowMat);
            const zOffset = (Math.random() - 0.5) * (bDepth - 2);
            win.position.set(bWidth / 2 + 0.05, floor * 3, zOffset);
            win.rotation.y = Math.PI / 2;
            bGroup.add(win);
          }
        }

        const bZ =
          -WorldGenerator.SEGMENT_LENGTH / 2 +
          (WorldGenerator.SEGMENT_LENGTH / numBuildings) * i +
          (Math.random() - 0.5) * 2;
        bGroup.position.set(xPos, 0, bZ);
        if (xPos > 0) bGroup.rotation.y = Math.PI; // Face inwards (now right side will also have windows facing track because we rotate the whole group by PI)

        group.add(bGroup);
      }
    };

    buildBuildings(-roadWidth / 2 - 4);
    buildBuildings(roadWidth / 2 + 4);

    // Occasional Streetlights / Props
    const lightPoleGeom = new THREE.CylinderGeometry(0.1, 0.1, 4.0, 4);
    const lightPoleMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.8,
    });
    for (let i = 0; i < 3; i++) {
      const poleZ = -WorldGenerator.SEGMENT_LENGTH / 2 + i * 20;
      const leftPole = new THREE.Mesh(lightPoleGeom, lightPoleMat);
      leftPole.position.set(-roadWidth / 2 - 0.5, 2.0, poleZ);
      group.add(leftPole);

      const rightPole = leftPole.clone();
      rightPole.position.set(roadWidth / 2 + 0.5, 2.0, poleZ);
      group.add(rightPole);
    }

    // Greenery bushes on the sides
    const bushGeom = new THREE.SphereGeometry(1.2, 7, 7);
    const bushMat = new THREE.MeshStandardMaterial({
      color: 0x2e8b57,
      roughness: 1.0,
    }); // Sea-green
    const numBushes = 5;
    for (let i = 0; i < numBushes; i++) {
      const bushZ =
        -WorldGenerator.SEGMENT_LENGTH / 2 +
        (WorldGenerator.SEGMENT_LENGTH / numBushes) * i +
        Math.random() * 5;
      const leftBush = new THREE.Mesh(bushGeom, bushMat);
      leftBush.position.set(-roadWidth / 2 - 1.0, 0.5, bushZ);
      group.add(leftBush);

      const rightBush = new THREE.Mesh(bushGeom, bushMat);
      rightBush.position.set(
        roadWidth / 2 + 1.0,
        0.5,
        bushZ + Math.random() * 2,
      );
      group.add(rightBush);
    }

    // Append to actual 3D scene
    this.scene.add(group);

    const segmentObj: Segment = {
      id: `seg_${this.segmentIdCounter++}`,
      z: zCenter,
      mesh: group,
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
      const pattern = Math.floor(Math.random() * 5);

      // Shuffle lanes to randomize experiences
      const shuffledLanes = [...lanes].sort(() => Math.random() - 0.5);

      if (pattern === 0) {
        // Standard layout
        // Lane A: Low barrier (must jump)
        // Lane B: High barrier (must duck)
        // Lane C: Safe Corridor + Coins
        this.spawnObstacle("BARRIER_LOW", shuffledLanes[0], spawnZ);
        this.spawnObstacle("BARRIER_HIGH", shuffledLanes[1], spawnZ);

        // Coins in safe lane
        this.spawnCoinColumn(shuffledLanes[2], spawnZ - 5, 4, false);
      } else if (pattern === 1) {
        // Massive trains / blockades
        // Block 2 lanes entirely, leave 1 lane wide open, with height coins
        this.spawnObstacle("TRAIN_STATIC", shuffledLanes[0], spawnZ);
        this.spawnObstacle("TRAIN_STATIC", shuffledLanes[1], spawnZ);

        // Put coins on top of the trains!
        this.spawnCoinColumn(shuffledLanes[0], spawnZ - 2.5, 3, false, 3.8);

        // Safe corridor
        // Add a nice straight chain of coins following a jumping curve
        this.spawnCoinColumn(shuffledLanes[2], spawnZ - 10, 6, true);
      } else if (pattern === 2) {
        // Ramps and Trains!
        // A static train
        this.spawnObstacle("TRAIN_STATIC", shuffledLanes[0], spawnZ);
        // A ramp leading to the train in the same lane (depth of train is 9, ramp 6)
        // Train is at spawnZ, Ramp is slightly *before* it. Train is 9m depth (+/-4.5m)
        // If Ramp is at spawnZ - 7.5, its back ending is at spawnZ-7.5+3 = spawnZ-4.5
        this.spawnObstacle("RAMP", shuffledLanes[0], spawnZ - 7.5);

        // Coins going up the ramp and over train
        this.spawnCoinColumn(shuffledLanes[0], spawnZ - 7.5, 6, true, 3.8); // High coins

        // Spawn standard coins columns for the free lanes
        this.spawnCoinColumn(shuffledLanes[1], spawnZ - 8, 4, false);
        this.spawnCoinColumn(shuffledLanes[2], spawnZ - 8, 4, false);
      } else if (pattern === 3) {
        // Gate blocking layout
        // Center has floating slide-bar, side lanes have one roadblocker
        this.spawnObstacle("BARRIER_HIGH", 0, spawnZ); // Center slide
        this.spawnObstacle(
          "TRAIN_STATIC",
          shuffledLanes[0] === 0 ? shuffledLanes[1] : shuffledLanes[0],
          spawnZ,
        );

        // Safe lane gets high coin trail
        const safeLane =
          shuffledLanes[2] === 0 ? shuffledLanes[1] : shuffledLanes[2];
        this.spawnCoinColumn(safeLane, spawnZ - 5, 3, false);
      } else {
        // Moving trains!
        // One lane has a moving train coming towards the player, spawned closer to avoid passing through other clusters
        this.spawnObstacle("TRAIN_MOVING", shuffledLanes[0], spawnZ + 25);

        // Another lane might have a static barrier
        this.spawnObstacle("BARRIER_LOW", shuffledLanes[1], spawnZ);

        // Coins in the safe lane
        this.spawnCoinColumn(shuffledLanes[2], spawnZ - 5, 5, false);
      }

      // Randomly spawn a powerup instead of a regular segment feature sometimes
      if (Math.random() < 0.35) {
        const types: PowerupType[] = ["JETPACK", "MAGNET", "SUPER_SNEAKERS"];
        const type = types[Math.floor(Math.random() * types.length)];
        this.spawnPowerup(
          type,
          lanes[Math.floor(Math.random() * lanes.length)],
          spawnZ - 12,
        );
      }
    });
  }

  /**
   * Spawns a physical coin column along Z, optionally shaped as an arc (parabolic curve for jumps).
   */
  private spawnCoinColumn(
    lane: Lane,
    startZ: number,
    count: number,
    arched = false,
    baseHeight = 0.55,
  ) {
    const spacing = 2.4;
    for (let i = 0; i < count; i++) {
      const zPos = startZ + i * spacing;

      // Calculate parabolic Y height if arched
      let yPos = baseHeight; // default hovering collector height
      if (arched) {
        // vertex formula
        const midIdx = (count - 1) / 2;
        const normalizedDiff = i - midIdx;
        yPos = Math.max(
          baseHeight,
          3.6 - normalizedDiff * normalizedDiff * 0.45,
        );
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
      collected: false,
    });
  }

  private spawnPowerup(
    type: PowerupType,
    lane: Lane,
    zPos: number,
    yPos: number = 1.0,
  ) {
    const group = new THREE.Group();

    if (type === "JETPACK") {
      const bodyGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 12);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xaa0033,
        metalness: 0.8,
        roughness: 0.2,
      });
      const leftTank = new THREE.Mesh(bodyGeom, bodyMat);
      leftTank.position.set(-0.35, 0, 0);
      const rightTank = new THREE.Mesh(bodyGeom, bodyMat);
      rightTank.position.set(0.35, 0, 0);
      group.add(leftTank, rightTank);
    } else if (type === "MAGNET") {
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
      group.add(magU, tip1, tip2);
    } else if (type === "SUPER_SNEAKERS") {
      const sneakerGeom = new THREE.BoxGeometry(0.3, 0.2, 0.5);
      const sneakerMat = new THREE.MeshStandardMaterial({
        color: 0xff00ff,
        metalness: 0.5,
        roughness: 0.2,
      });
      const soleGeom = new THREE.BoxGeometry(0.32, 0.05, 0.52);
      const soleMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

      const sLeft = new THREE.Mesh(sneakerGeom, sneakerMat);
      sLeft.position.set(-0.2, 0.1, 0);
      const sLeftSole = new THREE.Mesh(soleGeom, soleMat);
      sLeftSole.position.set(0, -0.1, 0);
      sLeft.add(sLeftSole);

      const sRight = new THREE.Mesh(sneakerGeom, sneakerMat);
      sRight.position.set(0.2, 0.1, 0);
      const sRightSole = new THREE.Mesh(soleGeom, soleMat);
      sRightSole.position.set(0, -0.1, 0);
      sRight.add(sRightSole);

      const wingGeom = new THREE.ConeGeometry(0.05, 0.3, 4);
      const wingMat = new THREE.MeshStandardMaterial({ color: 0xffddaa });
      const w1 = new THREE.Mesh(wingGeom, wingMat);
      w1.position.set(-0.2, 0.1, 0);
      w1.rotation.z = Math.PI / 4;
      sLeft.add(w1);

      const w2 = new THREE.Mesh(wingGeom, wingMat);
      w2.position.set(0.2, 0.1, 0);
      w2.rotation.z = -Math.PI / 4;
      sRight.add(w2);

      group.add(sLeft, sRight);
    }

    group.position.set(-lane * PlayerController.LANE_WIDTH, yPos, zPos);
    group.scale.set(1.2, 1.2, 1.2);

    // Float animation requires saving y base

    this.scene.add(group);

    this.activePowerups.push({
      id: `powerup_${this.powerupIdCounter++}`,
      type,
      lane,
      z: zPos,
      y: yPos,
      mesh: group,
      collected: false,
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

    // Realistic themes
    if (type === "BARRIER_LOW") {
      width = 2.8;
      height = 0.95;
      depth = 0.6;

      const group = new THREE.Group();

      // Horizontal wood bar painted red/white
      const barGeom = new THREE.BoxGeometry(width, 0.3, depth - 0.2);
      const labelMat = new THREE.MeshStandardMaterial({
        color: 0xdd2222, // Red
        roughness: 0.8,
      });
      const bar = new THREE.Mesh(barGeom, labelMat);
      bar.position.y = height - 0.15;
      group.add(bar);

      // Warning stripes (white)
      const stripeGeom = new THREE.BoxGeometry(0.4, 0.31, depth - 0.19);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); // White stripes
      for (let i = -1; i <= 1; i += 0.5) {
        if (Math.abs(i) === 0.5) continue;
        const stripe = new THREE.Mesh(stripeGeom, stripeMat);
        stripe.position.set(i, height - 0.15, 0);
        group.add(stripe);
      }

      // Two wooden legs
      const legGeom = new THREE.BoxGeometry(0.2, height, 0.2);
      const legMat = new THREE.MeshStandardMaterial({
        color: 0x8b5a2b,
        roughness: 0.9,
      }); // Wood

      const leftLeg = new THREE.Mesh(legGeom, legMat);
      leftLeg.position.set(-width / 2 + 0.3, height / 2, 0);
      group.add(leftLeg);

      const rightLeg = leftLeg.clone();
      rightLeg.position.set(width / 2 - 0.3, height / 2, 0);
      group.add(rightLeg);

      group.position.set(xPos, 0, zPos);
      this.scene.add(group);
      obsMesh = group;
    } else if (type === "BARRIER_HIGH") {
      width = 3.3;
      height = 1.4; // Hanging height
      depth = 0.5;

      const group = new THREE.Group();

      // Top solid bar (like a pedestrian overpass sign or tall gate)
      const topBarGeom = new THREE.BoxGeometry(width, 0.4, depth);
      const housingMat = new THREE.MeshStandardMaterial({
        color: 0x333333,
        metalness: 0.2,
        roughness: 0.8,
      });
      const topHousing = new THREE.Mesh(topBarGeom, housingMat);
      topHousing.position.y = 1.6;
      group.add(topHousing);

      // Hazard strip on it
      const hazardGeom = new THREE.BoxGeometry(width - 0.2, 0.2, depth + 0.05);
      const hazardMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 }); // Yellow
      const hazard = new THREE.Mesh(hazardGeom, hazardMat);
      hazard.position.y = 1.6;

      // Chevrons/stripes on hazard
      const stripeGeom = new THREE.BoxGeometry(0.2, 0.22, depth + 0.06);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0x222222 }); // Black stripes
      for (let i = -1.2; i <= 1.2; i += 0.6) {
        const stripe = new THREE.Mesh(stripeGeom, stripeMat);
        stripe.position.set(i, 0, 0);
        stripe.rotation.z = Math.PI / 8;
        hazard.add(stripe);
      }
      group.add(hazard);

      // Warning lights on top
      const lightGeom = new THREE.CylinderGeometry(0.15, 0.15, 0.15, 8);
      const lightMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });

      const leftLight = new THREE.Mesh(lightGeom, lightMat);
      leftLight.position.set(-1.0, 1.85, 0);
      group.add(leftLight);

      const rightLight = leftLight.clone();
      rightLight.position.set(1.0, 1.85, 0);
      group.add(rightLight);

      // Side pillars going down to ground
      const pillarGeom = new THREE.BoxGeometry(0.3, 1.8, 0.3);
      const pillarMat = new THREE.MeshStandardMaterial({
        color: 0x555555,
        roughness: 0.7,
      });

      const leftPillar = new THREE.Mesh(pillarGeom, pillarMat);
      leftPillar.position.set(-width / 2 + 0.15, 0.9, 0);
      group.add(leftPillar);

      const rightPillar = leftPillar.clone();
      rightPillar.position.set(width / 2 - 0.15, 0.9, 0);
      group.add(rightPillar);

      group.position.set(xPos, 0, zPos);
      this.scene.add(group);
      obsMesh = group;

      // Set bounding measurements
      height = 2.4; // Box goes from 1.6 to 2.4 y
    } else if (type === "TRAIN_STATIC" || type === "TRAIN_MOVING") {
      // TRAIN_STATIC / TRAIN_MOVING (Actual Train Car)
      width = 3.3;
      height = 3.6;
      depth = 9.0;

      const group = new THREE.Group();

      // Pick random train colors: brightly colored cars like the game
      const colors = [0x55aa55, 0x3366cc, 0xe84a4a, 0xf0c030];
      const tColor = colors[Math.floor(Math.random() * colors.length)];

      const trainMat = new THREE.MeshStandardMaterial({
        color: tColor,
        metalness: 0.1,
        roughness: 0.9,
      });

      // Main Body
      const bodyGeom = new THREE.BoxGeometry(width, height - 0.4, depth);
      const mainBody = new THREE.Mesh(bodyGeom, trainMat);
      mainBody.position.y = height / 2;
      mainBody.castShadow = true;
      mainBody.receiveShadow = true;
      group.add(mainBody);

      // Curved Roof
      const roofGeom = new THREE.CylinderGeometry(
        width / 2,
        width / 2,
        depth,
        16,
        1,
        false,
        0,
        Math.PI,
      );
      const roofMat = new THREE.MeshStandardMaterial({
        color: 0xcccccc,
        metalness: 0.3,
        roughness: 0.5,
      });
      const roof = new THREE.Mesh(roofGeom, roofMat);
      roof.rotation.z = Math.PI / 2;
      roof.rotation.y = Math.PI / 2;
      roof.position.y = height - 0.2;
      group.add(roof);

      // Bottom Chassis (Dark)
      const chassisGeom = new THREE.BoxGeometry(width - 0.2, 0.4, depth - 0.2);
      const chassisMat = new THREE.MeshStandardMaterial({
        color: 0x222222,
        roughness: 0.9,
      });
      const chassis = new THREE.Mesh(chassisGeom, chassisMat);
      chassis.position.y = 0.2;
      group.add(chassis);

      // Stripe detail
      const stripeGeom = new THREE.BoxGeometry(width + 0.05, 0.3, depth + 0.02);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const stripeLine = new THREE.Mesh(stripeGeom, stripeMat);
      stripeLine.position.y = height / 2 - 0.4;
      group.add(stripeLine);

      // Dark glass material
      const windowMat = new THREE.MeshBasicMaterial({ color: 0x111122 });

      // Side Windows
      const windowGeom = new THREE.BoxGeometry(width + 0.1, 0.7, 1.2);
      for (let w = -3; w <= 3; w += 2.0) {
        const win = new THREE.Mesh(windowGeom, windowMat);
        win.position.set(0, height / 2 + 0.4, w);
        group.add(win);
      }

      // Front Windshield
      const windshieldGeom = new THREE.PlaneGeometry(width - 0.6, 1.2);
      const windshield = new THREE.Mesh(windshieldGeom, windowMat);
      windshield.position.set(0, height / 2 + 0.4, -depth / 2 - 0.01);
      windshield.rotation.y = Math.PI; // Face oncoming player
      group.add(windshield);

      // Headlights
      const lightGeom = new THREE.CircleGeometry(0.2, 16);
      const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

      const leftLight = new THREE.Mesh(lightGeom, lightMat);
      leftLight.position.set(-0.9, height / 2 - 0.2, -depth / 2 - 0.02);
      leftLight.rotation.y = Math.PI;
      group.add(leftLight);

      const rightLight = leftLight.clone();
      rightLight.position.set(0.9, height / 2 - 0.2, -depth / 2 - 0.02);
      group.add(rightLight);

      // Train Bumper/Grill
      const bumperGeom = new THREE.BoxGeometry(width - 0.4, 0.3, 0.2);
      const bumperMat = new THREE.MeshStandardMaterial({
        color: 0x444444,
        metalness: 0.5,
      });
      const bumper = new THREE.Mesh(bumperGeom, bumperMat);
      bumper.position.set(0, 0.5, -depth / 2 - 0.05);
      group.add(bumper);

      // If it's a moving train, we add a back bumper too
      if (type === "TRAIN_MOVING") {
        const backBumper = bumper.clone();
        backBumper.position.set(0, 0.5, depth / 2 + 0.05);
        group.add(backBumper);
      }

      group.position.set(xPos, 0, zPos);
      this.scene.add(group);
      obsMesh = group;
    } else if (type === "RAMP") {
      width = 3.2;
      height = 3.6; // Leads up to train height
      depth = 6.0;

      const group = new THREE.Group();

      const rampGeom = new THREE.BoxGeometry(width, 0.4, depth);
      const rampMat = new THREE.MeshStandardMaterial({
        color: 0xaa5533,
        roughness: 0.9,
        metalness: 0.2,
      });

      const ramp = new THREE.Mesh(rampGeom, rampMat);
      // Angle the ramp up from y=0 to y=3.6 over depth=6
      ramp.position.set(0, 1.8, 0); // midpoint
      ramp.rotation.x = -Math.atan2(height, depth);
      ramp.castShadow = true;
      group.add(ramp);

      // Support pillars
      const pGeom = new THREE.BoxGeometry(width - 0.2, 1.8, 0.5);
      const pillar = new THREE.Mesh(pGeom, rampMat);
      pillar.position.set(0, 0.9, -depth / 2 + 0.5);
      group.add(pillar);

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
        const xPosMath = -this.lane * PlayerController.LANE_WIDTH;
        if (this.type === "BARRIER_HIGH") {
          // A BARRIER_HIGH spans from y = 1.05 up to y = 2.4 to intercept standing/jumping players
          // while leaving clear clearance for crouch-sliding runners (height 0.8)
          return new THREE.Box3(
            new THREE.Vector3(
              xPosMath - this.width / 2,
              1.05,
              this.z - this.depth / 2,
            ),
            new THREE.Vector3(
              xPosMath + this.width / 2,
              2.4,
              this.z + this.depth / 2,
            ),
          );
        } else if (this.type === "BARRIER_LOW") {
          // A BARRIER_LOW is a waist-high barrier that spans from ground (y=0) up to y = height
          return new THREE.Box3(
            new THREE.Vector3(
              xPosMath - this.width / 2,
              0.0,
              this.z - this.depth / 2,
            ),
            new THREE.Vector3(
              xPosMath + this.width / 2,
              this.height,
              this.z + this.depth / 2,
            ),
          );
        } else if (this.type === "RAMP") {
          // Ramps have no crash bounding box on the body, so player can run right up them.
          // They are safe, only targetBaseHeight logic handles them.
          return new THREE.Box3(
            new THREE.Vector3(xPosMath, -10, this.z),
            new THREE.Vector3(xPosMath, -10, this.z),
          );
        } else {
          // TRAIN_STATIC / TRAIN_MOVING spans from ground (y=0) up to y = height
          return new THREE.Box3(
            new THREE.Vector3(
              xPosMath - this.width / 2,
              0.0,
              this.z - this.depth / 2,
            ),
            new THREE.Vector3(
              xPosMath + this.width / 2,
              this.height,
              this.z + this.depth / 2,
            ),
          );
        }
      },
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

    this.activePowerups.forEach((pow) => {
      if (pow.mesh) this.scene.remove(pow.mesh);
    });

    this.activeSegments = [];
    this.activeObstacles = [];
    this.activeCoins = [];
    this.activePowerups = [];

    this.segmentIdCounter = 0;
    this.obstacleIdCounter = 0;
    this.coinIdCounter = 0;
    this.powerupIdCounter = 0;
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

  public collectPowerup(pow: Powerup) {
    pow.collected = true;
    if (pow.mesh) {
      this.scene.remove(pow.mesh);
      pow.mesh = undefined as any;
    }
  }

  /**
   * Continuous updates like spinning coins recursively.
   */
  public tick(
    deltaTime: number,
    playerPosition?: THREE.Vector3,
    magnetActive: boolean = false,
  ) {
    this.activeCoins.forEach((coin) => {
      if (coin.mesh) {
        // Spin coins nicely
        coin.mesh.rotation.z += deltaTime * 2.8;
        // Subtle levitation bobbing
        coin.mesh.position.y =
          coin.y + Math.sin(coin.mesh.position.z * 1.5) * 0.12;

        if (magnetActive && playerPosition) {
          const dist = playerPosition.distanceTo(coin.mesh.position);
          if (dist < 15.0) {
            const dir = playerPosition
              .clone()
              .sub(coin.mesh.position)
              .normalize();
            coin.mesh.position.add(dir.multiplyScalar(deltaTime * 40.0));
            // Update underlying pos for collision logic
            coin.lane = 0; // It's no longer purely in a lane, but collision uses actual position anyway
            // Wait, AABB needs position. AABB is computed on actual mesh box
          }
        }
      }
    });

    this.activePowerups.forEach((pow) => {
      if (pow.mesh && !pow.collected) {
        pow.mesh.rotation.y += deltaTime * 2.0;
        pow.mesh.position.y =
          pow.y + Math.sin(pow.mesh.position.z * 2.0) * 0.15;
      }
    });

    this.activeObstacles.forEach((obs) => {
      if (obs.type === "TRAIN_MOVING" && obs.mesh) {
        // Trains move towards the player (negative Z direction)
        const trainSpeed = 25.0;
        const newZ = obs.z - trainSpeed * deltaTime;

        // Prevent passing through other obstacles in the same lane
        const hit = this.activeObstacles.some(
          (other) =>
            other !== obs &&
            other.lane === obs.lane &&
            Math.abs(other.z - newZ) <
              obs.depth! / 2 + other.depth! / 2 + 0.5 &&
            other.z < obs.z, // only check obstacles that the train is moving towards
        );

        if (hit) {
          // Become static if it hits something
          obs.type = "TRAIN_STATIC";
        } else {
          obs.z = newZ;
          obs.mesh.position.z = obs.z;
        }
      }
    });
  }
}
