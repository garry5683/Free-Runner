/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { Particle } from '../types';

export class ParticleSystem {
  private scene: THREE.Scene;
  private activeParticles: Particle[] = [];

  // Common geometries and materials
  private sparkGeometry: THREE.BoxGeometry;
  private coinMaterial: THREE.MeshBasicMaterial;
  private crashMaterial: THREE.MeshBasicMaterial;
  private jetMaterial: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Small boxes render extremely quickly compared to spheres
    this.sparkGeometry = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    this.coinMaterial = new THREE.MeshBasicMaterial({ color: 0xffea00 });
    this.crashMaterial = new THREE.MeshBasicMaterial({ color: 0xff0055 });
    this.jetMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 });
  }

  /**
   * Spawns a ring of 3D sparkling gold particles at the collected coordinates.
   */
  public spawnCoinBurst(position: THREE.Vector3) {
    const particleCount = 6;
    for (let i = 0; i < particleCount; i++) {
      const mesh = new THREE.Mesh(this.sparkGeometry, this.coinMaterial);
      mesh.position.copy(position);
      this.scene.add(mesh);

      // Distribute speed in a sphere shell
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 4.0 + Math.random() * 3.0;
      
      this.activeParticles.push({
        mesh,
        velocity: {
          x: Math.cos(angle) * speed * 0.5,
          y: (Math.random() * 0.4 + 0.6) * speed,
          z: Math.sin(angle) * speed * 0.5,
        },
        life: 0,
        maxLife: 0.5 + Math.random() * 0.3, // seconds
      });
    }
  }

  /**
   * Spawns a giant explosion of hot magenta debris at crash coordinates.
   */
  public spawnCrashBurst(position: THREE.Vector3) {
    const particleCount = 24;
    const boomGeom = new THREE.BoxGeometry(0.3, 0.3, 0.3);

    for (let i = 0; i < particleCount; i++) {
      const mesh = new THREE.Mesh(boomGeom, this.crashMaterial);
      mesh.position.copy(position).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5
      ));
      this.scene.add(mesh);

      this.activeParticles.push({
        mesh,
        velocity: {
          x: (Math.random() - 0.5) * 12.0,
          y: (Math.random() * 1.0 + 0.5) * 10.0,
          z: (Math.random() - 0.5) * 12.0,
        },
        life: 0,
        maxLife: 1.2 + Math.random() * 0.6,
      });
    }
  }

  /**
   * Emits trailing exhaust sparks behind hoverboard engines.
   */
  public spawnExhaustTrail(position: THREE.Vector3, playerSpeed: number) {
    // Left thruster
    const leftJet = position.clone().add(new THREE.Vector3(-0.4, -0.5, -0.9));
    const rightJet = position.clone().add(new THREE.Vector3(0.4, -0.5, -0.9));

    const jets = [leftJet, rightJet];

    jets.forEach((pos) => {
      // Small sparks
      const mesh = new THREE.Mesh(this.sparkGeometry, this.jetMaterial);
      mesh.position.copy(pos);
      this.scene.add(mesh);

      this.activeParticles.push({
        mesh,
        velocity: {
          x: (Math.random() - 0.5) * 0.5,
          y: (Math.random() - 0.3) * 0.3,
          z: -playerSpeed * 0.6 - (Math.random() * 4.0), // Shoot backwards relative to player
        },
        life: 0,
        maxLife: 0.15 + Math.random() * 0.15,
      });
    });
  }

  /**
   * Multi-tick position updates with gravity and drag decays.
   */
  public update(deltaTime: number) {
    const gravity = -18.0;

    this.activeParticles = this.activeParticles.filter((p) => {
      p.life += deltaTime;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        // Skip materials disposal because we reuse shared materials
        return false;
      }

      // Kinematics
      p.velocity.y += gravity * deltaTime;
      p.mesh.position.x += p.velocity.x * deltaTime;
      p.mesh.position.y += p.velocity.y * deltaTime;
      p.mesh.position.z += p.velocity.z * deltaTime;

      // Shrink size on death
      const ratio = 1.0 - (p.life / p.maxLife);
      p.mesh.scale.set(ratio, ratio, ratio);

      // Rotate for variety
      p.mesh.rotation.x += deltaTime * 5.0;
      p.mesh.rotation.y += deltaTime * 3.0;

      return true;
    });
  }

  /**
   * Wipes any leftover sparks.
   */
  public clearAll() {
    this.activeParticles.forEach((p) => {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
    });
    this.activeParticles = [];
  }
}
