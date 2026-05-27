/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * CameraGestureController.ts
 * Bridges webcam MediaPipe pose tracking data to player actions like shift lanes, jump, and crouch.
 */

import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

export interface CameraGestureCallback {
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onLaneChange?: (lane: -1 | 0 | 1) => void;
  onJump: () => void;
  onCrouch: () => void;
  onHeightStateChange?: (state: 'NORMAL' | 'JUMP' | 'CROUCH') => void;
  onStatusChange: (status: string) => void;
  onCalibrationProgress?: (progress: number, secondsLeft: number) => void;
  onCalibrationComplete?: (neutralX: number, neutralY: number) => void;
  onPoseUpdate?: (nose: { x: number; y: number } | null, shoulders: { left: { x: number; y: number }; right: { x: number; y: number } } | null) => void;
}

export class CameraGestureController {
  private videoElement: HTMLVideoElement | null = null;
  private landmarker: PoseLandmarker | null = null;
  private active = false;
  private callback: CameraGestureCallback;
  
  // Frame rate throttling parameters (Target ~30 FPS -> 33ms)
  private lastProcessTime = 0;
  private processIntervalMs = 33; 
  private animationFrameId: number | null = null;

  // Calibrated baseline parameters
  private neutralShoulderX = 0.5; // Average X position of shoulders
  private neutralNoseY = 0.55;     // Nose Y position (top-down, so larger is lower)
  
  // Calibration recording states
  private isCalibrating = false;
  private calibrationSamples: { noseY: number; shoulderX: number; shoulderY: number }[] = [];
  private calibrationDurationMs = 3000;
  private calibrationStartTime = 0;

  // Dynamic scale multiplier relative to distance to the camera
  private scaleRatio = 1.0;

  // Hysteretic tracking states to trigger edge actions once per movement zone
  private currentLeanState: 'CENTER' | 'LEFT' | 'RIGHT' = 'CENTER';
  private currentHeightState: 'NORMAL' | 'JUMP' | 'CROUCH' = 'NORMAL';

  // Separate cooldown timers to allow simultaneous lateral & vertical actions
  private lastLateralActionTime = 0;
  private lastVerticalActionTime = 0;
  private lateralCooldownMs = 150;  // Extremely quick and responsive lane changes
  private verticalCooldownMs = 300; // Controls jump spamming while staying agile (reduced for fast reflex transitions)

  constructor(callbacks: CameraGestureCallback) {
    this.callback = callbacks;
  }

  /**
   * Initialize the MediaPipe SDK and start webcam stream.
   */
  public async initialize(video: HTMLVideoElement): Promise<void> {
    this.videoElement = video;
    this.callback.onStatusChange('Loading Pose Engine...');

    try {
      // 1. Load Fileset Resolver
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
      );

      // 2. Load Pose Landmarker
      this.landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      });

      this.callback.onStatusChange('Pose Engine Ready. Accessing Camera...');
      
      // 3. Setup Webcam
      await this.startCamera();
      
      this.active = true;
      this.callback.onStatusChange('Active');
      
      // 4. Start the detection loop
      this.lastProcessTime = performance.now();
      this.loop();
    } catch (error: any) {
      console.error('Failed to initialize CameraGestureController:', error);
      this.callback.onStatusChange(`Camera Error: ${error.message || 'Access Denied'}`);
      throw error;
    }
  }

  /**
   * Request webcam access and assign stream to video element
   */
  private async startCamera(): Promise<void> {
    if (!this.videoElement) return;

    const constraints = {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user', // mirror mode camera
      },
      audio: false
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.videoElement.srcObject = stream;
    this.videoElement.setAttribute('playsinline', 'true');
    
    // Wait for video load metadata to establish raw sizes
    await new Promise<void>((resolve) => {
      if (!this.videoElement) return resolve();
      this.videoElement.onloadedmetadata = () => {
        this.videoElement?.play();
        resolve();
      };
    });
  }

  /**
   * Pause tracking updates without destroying MediaPipe task
   */
  public pause(): void {
    this.active = false;
  }

  /**
   * Resume tracking updates
   */
  public resume(): void {
    if (this.landmarker && this.videoElement) {
      this.active = true;
    }
  }

  /**
   * Trigger the 3-second neutral position calibrator
   */
  public startCalibration(): void {
    if (!this.active) return;
    this.isCalibrating = true;
    this.calibrationSamples = [];
    this.calibrationStartTime = performance.now();
    this.callback.onStatusChange('Calibrating... Stand straight in center!');
  }

  /**
   * Processing tick loops triggered at requestAnimationFrame but throttled to target FPS
   */
  private loop(): void {
    this.animationFrameId = requestAnimationFrame(() => this.loop());

    if (!this.active || !this.landmarker || !this.videoElement) return;

    const now = performance.now();
    const elapsed = now - this.lastProcessTime;

    // Check frame throttle
    if (elapsed >= this.processIntervalMs) {
      this.lastProcessTime = now - (elapsed % this.processIntervalMs);
      this.processFrame(now);
    }
  }

  /**
   * Query single frames from the canvas/video stream coordinates
   */
  private processFrame(now: number): void {
    if (!this.videoElement || !this.landmarker || this.videoElement.readyState < 2) return;

    // Run Landmarker query on active frame
    const results = this.landmarker.detectForVideo(this.videoElement, now);

    if (results.landmarks && results.landmarks.length > 0) {
      const pose = results.landmarks[0]; // Single tracked player pose

      // Landmark coordinates references
      const nose = pose[0];
      const leftShoulder = pose[11];
      const rightShoulder = pose[12];

      if (nose && leftShoulder && rightShoulder) {
        // Average X of shoulders for side-to-side leaning baseline
        const shoulderX = (leftShoulder.x + rightShoulder.x) / 2;
        const noseY = nose.y;

        // Broadcast raw points for visual overlay debugging
        if (this.callback.onPoseUpdate) {
          this.callback.onPoseUpdate(
            { x: nose.x, y: nose.y },
            {
              left: { x: leftShoulder.x, y: leftShoulder.y },
              right: { x: rightShoulder.x, y: rightShoulder.y }
            }
          );
        }

        // Handle active calibration gathering stream
        if (this.isCalibrating) {
          const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
          this.handleCalibrationTick(now, shoulderX, noseY, shoulderY);
          return;
        }

        // Process gesture triggers if not calibrating
        this.evaluateGestures(now, shoulderX, noseY);
      } else {
        // Broadcast lack of landmarks
        if (this.callback.onPoseUpdate) {
          this.callback.onPoseUpdate(null, null);
        }
      }
    } else {
      // Broadcast lack of body detection
      if (this.callback.onPoseUpdate) {
        this.callback.onPoseUpdate(null, null);
      }
    }
  }

  /**
   * Run calibration phase ticker to sample the user's neutral pose.
   */
  private handleCalibrationTick(now: number, shoulderX: number, noseY: number, shoulderY: number): void {
    const elapsed = now - this.calibrationStartTime;
    const progress = Math.min(1.0, elapsed / this.calibrationDurationMs);
    const secondsLeft = Math.ceil((this.calibrationDurationMs - elapsed) / 1000);

    // Save points
    this.calibrationSamples.push({ noseY, shoulderX, shoulderY });

    if (this.callback.onCalibrationProgress) {
      this.callback.onCalibrationProgress(progress, secondsLeft);
    }

    // Complete calibration phase
    if (elapsed >= this.calibrationDurationMs) {
      this.isCalibrating = false;

      // Extract median/average constants
      const sumNoseY = this.calibrationSamples.reduce((acc, sample) => acc + sample.noseY, 0);
      const sumShoulderX = this.calibrationSamples.reduce((acc, sample) => acc + sample.shoulderX, 0);
      const sumShoulderY = this.calibrationSamples.reduce((acc, sample) => acc + sample.shoulderY, 0);
      
      this.neutralNoseY = sumNoseY / this.calibrationSamples.length;
      this.neutralShoulderX = sumShoulderX / this.calibrationSamples.length;
      const neutralShoulderY = sumShoulderY / this.calibrationSamples.length;

      // Compute physical distance scale ratio relative to standard calibration reference
      const avgNoseToShoulder = Math.abs(this.neutralNoseY - neutralShoulderY);
      const referenceNoseToShoulder = 0.18;
      this.scaleRatio = avgNoseToShoulder / referenceNoseToShoulder;
      this.scaleRatio = Math.max(0.5, Math.min(1.8, this.scaleRatio));

      console.log('Camera Gesture Controller Calibrated:', {
        neutralNoseY: this.neutralNoseY,
        neutralShoulderX: this.neutralShoulderX,
        neutralShoulderY: neutralShoulderY,
        scaleRatio: this.scaleRatio
      });

      this.callback.onStatusChange('Tracking Active');
      if (this.callback.onCalibrationComplete) {
        this.callback.onCalibrationComplete(this.neutralShoulderX, this.neutralNoseY);
      }
    }
  }

  /**
   * Public getter for threshold scale ratios
   */
  public getScaleRatio(): number {
    return this.scaleRatio;
  }

  /**
   * Evaluate positions relative to calibrated center points to map controls.
   * Leverages mirror mapping: X > threshold triggers moveLeft, X < threshold triggers moveRight.
   */
  private evaluateGestures(now: number, shoulderX: number, noseY: number): void {
    // A. Side Leaning Logic with Dynamic Noise Hysteresis
    // The "Mirror" effect: Moving right in camera frame = higher X coordinate value (user leaning physical Left).
    const deltaX = shoulderX - this.neutralShoulderX;
    const currentLeanThreshold = 0.08 * this.scaleRatio;
    const returnLeanThreshold = 0.05 * this.scaleRatio; // Buffer zone to prevent jitter
    
    let targetLean: 'CENTER' | 'LEFT' | 'RIGHT' = this.currentLeanState;
    if (this.currentLeanState === 'CENTER') {
      if (deltaX > currentLeanThreshold) {
        targetLean = 'LEFT';
      } else if (deltaX < -currentLeanThreshold) {
        targetLean = 'RIGHT';
      }
    } else if (this.currentLeanState === 'LEFT') {
      if (deltaX < returnLeanThreshold) {
        targetLean = 'CENTER';
      }
    } else if (this.currentLeanState === 'RIGHT') {
      if (deltaX > -returnLeanThreshold) {
        targetLean = 'CENTER';
      }
    }

    // Lane alignment state change trigger
    // Always report lane state if not CENTER, to maintain persistent steering while leant
    if (targetLean !== 'CENTER' || targetLean !== this.currentLeanState) {
      let mappedLane: -1 | 0 | 1 = 0;
      if (targetLean === 'LEFT') mappedLane = -1;
      else if (targetLean === 'RIGHT') mappedLane = 1;

      if (this.callback.onLaneChange) {
        // Direct, robust, 100% matched lane transitions
        this.callback.onLaneChange(mappedLane);
      }
      this.currentLeanState = targetLean;
    }

    // B. Height Movement Logic with Action Hysteresis
    // Nose Y coordinate goes DOWN when jumping (closer to 0.0), UP when crouching (closer to 1.0).
    const deltaY = noseY - this.neutralNoseY;
    const currentJumpThreshold = 0.07 * this.scaleRatio;   // Lowered slightly to make jump trigger easier
    const currentCrouchThreshold = 0.07 * this.scaleRatio; // Lowered slightly to make slide trigger easier
    const returnHeightThreshold = 0.035 * this.scaleRatio;

    let targetHeight: 'NORMAL' | 'JUMP' | 'CROUCH' = this.currentHeightState;
    if (this.currentHeightState === 'NORMAL') {
      if (deltaY < -currentJumpThreshold) {
        targetHeight = 'JUMP';
      } else if (deltaY > currentCrouchThreshold) {
        targetHeight = 'CROUCH';
      }
    } else if (this.currentHeightState === 'JUMP') {
      if (deltaY > -returnHeightThreshold) {
        targetHeight = 'NORMAL';
      }
    } else if (this.currentHeightState === 'CROUCH') {
      if (deltaY < returnHeightThreshold) {
        targetHeight = 'NORMAL';
      }
    }

    // Edge trigger vertical actions
    // Proactivate persistent posture reporting: always notify on non-NORMAL states
    if (targetHeight === 'CROUCH' || targetHeight === 'JUMP' || targetHeight !== this.currentHeightState) {
      if (this.callback.onHeightStateChange) {
        this.callback.onHeightStateChange(targetHeight);
      }
      
      if (targetHeight === 'NORMAL' || targetHeight !== this.currentHeightState) {
        if (targetHeight === 'NORMAL') {
          // Instant return release to state NORMAL (allowing active corrections rapidly)
          this.currentHeightState = targetHeight;
        } else if (now - this.lastVerticalActionTime > this.verticalCooldownMs && targetHeight !== this.currentHeightState) {
          if (targetHeight === 'JUMP') {
            this.callback.onJump();
            this.lastVerticalActionTime = now;
            this.currentHeightState = targetHeight;
          } else if (targetHeight === 'CROUCH') {
            this.callback.onCrouch();
            this.lastVerticalActionTime = now;
            this.currentHeightState = targetHeight;
          }
        }
      }
      // Regardless of cooldown, if moving toward a new state or just holding a state,
      // we update the tracking state for the persistence mechanics.
      this.currentHeightState = targetHeight;
    }
  }

  /**
   * Safely terminate video feed stream trackers
   */
  public destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    this.active = false;

    if (this.videoElement && this.videoElement.srcObject) {
      const stream = this.videoElement.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      this.videoElement.srcObject = null;
    }

    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
    }
  }
}
