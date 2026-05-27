/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Lane } from '../types';

export class InputManager {
  private startX = 0;
  private startY = 0;
  private minSwipeDistance = 30; // Minimum drag distance in pixels to trigger a swipe

  // Callbacks
  public onSwipeLeft: () => void = () => {};
  public onSwipeRight: () => void = () => {};
  public onSwipeUp: () => void = () => {};
  public onSwipeDown: () => void = () => {};

  private element: HTMLElement | null = null;
  private isEnabled = false;

  constructor() {
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  public init(element: HTMLElement) {
    this.element = element;
    this.enable();
  }

  public enable() {
    if (this.isEnabled || !this.element) return;
    this.isEnabled = true;

    // Add touch listeners to the container element
    this.element.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.element.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.element.addEventListener('touchend', this.handleTouchEnd, { passive: false });

    // Add keyboard listener to window for desktop support
    window.addEventListener('keydown', this.handleKeyDown);
  }

  public disable() {
    if (!this.isEnabled || !this.element) return;
    this.isEnabled = false;

    this.element.removeEventListener('touchstart', this.handleTouchStart);
    this.element.removeEventListener('touchmove', this.handleTouchMove);
    this.element.removeEventListener('touchend', this.handleTouchEnd);

    window.removeEventListener('keydown', this.handleKeyDown);
  }

  private handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      this.startX = e.touches[0].clientX;
      this.startY = e.touches[0].clientY;
    }
  }

  private handleTouchMove(e: TouchEvent) {
    // Prevent default scroll behaviors (like elastic scrolling or pull-to-refresh)
    if (e.cancelable) {
      e.preventDefault();
    }
  }

  private handleTouchEnd(e: TouchEvent) {
    if (e.changedTouches.length === 1) {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;

      const deltaX = endX - this.startX;
      const deltaY = endY - this.startY;

      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Check if the gesture exceeds our swipe threshold
      if (Math.max(absDeltaX, absDeltaY) > this.minSwipeDistance) {
        if (absDeltaX > absDeltaY) {
          // Horizontal swipe
          if (deltaX > 0) {
            this.onSwipeRight();
          } else {
            this.onSwipeLeft();
          }
        } else {
          // Vertical swipe
          if (deltaY > 0) {
            this.onSwipeDown();
          } else {
            this.onSwipeUp();
          }
        }
      }
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.onSwipeLeft();
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.onSwipeRight();
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
      case ' ': // Space for jump
        e.preventDefault();
        this.onSwipeUp();
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        this.onSwipeDown();
        break;
    }
  }

  public destroy() {
    this.disable();
    this.element = null;
  }
}
