/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

export interface Collidable {
  getBoundingBox(): THREE.Box3;
  collided: boolean;
}

export class AABBCollision {
  /**
   * Evaluates if two collidables intersect in 3D.
   * This is extremely fast, requiring only simple comparison bounds.
   */
  public static checkIntersection(boxA: THREE.Box3, boxB: THREE.Box3): boolean {
    return boxA.intersectsBox(boxB);
  }

  /**
   * Custom fine-tuned calculation to check collision with tolerances.
   * Helps avoid annoying marginal edges where players feel they got cheated.
   */
  public static checkIntersectionWithTolerance(
    boxA: THREE.Box3,
    boxB: THREE.Box3,
    toleranceX = 0.1,
    toleranceY = 0.1,
    toleranceZ = 0.1
  ): boolean {
    // Shrink the dimensions slightly to have a "forgiving" margin of play
    const minA = boxA.min.clone().add(new THREE.Vector3(toleranceX, toleranceY, toleranceZ));
    const maxA = boxA.max.clone().sub(new THREE.Vector3(toleranceX, toleranceY, toleranceZ));
    
    const minB = boxB.min.clone().add(new THREE.Vector3(toleranceX, toleranceY, toleranceZ));
    const maxB = boxB.max.clone().sub(new THREE.Vector3(toleranceX, toleranceY, toleranceZ));

    const adjustedA = new THREE.Box3(minA, maxA);
    const adjustedB = new THREE.Box3(minB, maxB);

    return adjustedA.intersectsBox(adjustedB);
  }
}
