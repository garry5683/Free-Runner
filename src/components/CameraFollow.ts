/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

export class CameraFollow {
  private camera: THREE.Camera;
  
  // Positional offset behind and above the player
  public offset = new THREE.Vector3(0, 4.3, -8.2);
  
  // Position the camera looks at, relative to the player
  public lookAtOffset = new THREE.Vector3(0, 1.2, 2.5);

  // Dampening factors for smooth lerping (lag)
  public lerpSpeedX = 6.0;
  public lerpSpeedY = 4.0;
  public lerpSpeedZ = 20.0; // Keep Z very high so the player doesn't fall off screen

  constructor(camera: THREE.Camera) {
    this.camera = camera;
  }

  /**
   * Resets camera immediately to the target positions (no lag) at startup/retry.
   */
  public reset(playerPosition: THREE.Vector3) {
    const idealPos = playerPosition.clone().add(this.offset);
    this.camera.position.copy(idealPos);
    
    const lookTarget = playerPosition.clone().add(this.lookAtOffset);
    this.camera.lookAt(lookTarget);
  }

  /**
   * Updates camera position using custom smooth lerps along each axis.
   */
  public update(playerPosition: THREE.Vector3, deltaTime: number) {
    // 1. Calculate ideal position
    const targetX = playerPosition.x + this.offset.x;
    // Dampen camera Y response during high jumps, to avoid motion sickness
    const targetY = playerPosition.y + this.offset.y;
    const targetZ = playerPosition.z + this.offset.z;

    // 2. Perform independent lerps per axis for beautiful secondary motion
    const currentPos = this.camera.position;
    
    const newX = THREE.MathUtils.lerp(currentPos.x, targetX, Math.min(1.0, this.lerpSpeedX * deltaTime));
    const newY = THREE.MathUtils.lerp(currentPos.y, targetY, Math.min(1.0, this.lerpSpeedY * deltaTime));
    // Z track must be extremely responsive to maintain steady proximity
    const newZ = THREE.MathUtils.lerp(currentPos.z, targetZ, Math.min(1.0, this.lerpSpeedZ * deltaTime));

    this.camera.position.set(newX, newY, newZ);

    // 3. Keep looking at the target player area with a slightly delayed lookat look
    const targetLook = playerPosition.clone().add(this.lookAtOffset);
    this.camera.lookAt(targetLook);
  }
}
