/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

export type GameStatus = 'READY' | 'PLAYING' | 'GAMEOVER' | 'PAUSED' | 'COUNTDOWN';

export type Lane = -1 | 0 | 1;

export type PlayerAction = 'RUN' | 'JUMP' | 'CROUCH' | 'CRASH';

export interface PlayerStats {
  score: number;
  coins: number;
  distance: number;
  highScore: number;
}

export type ObstacleType = 'BARRIER_LOW' | 'BARRIER_HIGH' | 'TRAIN_STATIC';

export interface Obstacle {
  id: string;
  type: ObstacleType;
  lane: Lane;
  z: number;
  width: number;
  height: number;
  depth: number;
  mesh?: any; // Three.JS Group/Mesh
  collided: boolean;
  getBoundingBox?: () => THREE.Box3;
}

export interface Coin {
  id: string;
  lane: Lane;
  z: number;
  y: number;
  mesh?: any; // Three.JS Mesh
  collected: boolean;
}

export interface Particle {
  mesh: any;
  velocity: { x: number; y: number; z: number };
  life: number;
  maxLife: number;
}

export interface Segment {
  id: string;
  z: number;
  mesh: any; // Three.JS Group
}
