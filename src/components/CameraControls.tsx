/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Loader2, RefreshCw, AlertCircle, Sparkles, Check, Move, Minimize2, Maximize2 } from 'lucide-react';
import { CameraGestureController } from './CameraGestureController';

interface CameraControlsProps {
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onLaneChange?: (lane: -1 | 0 | 1) => void;
  onJump: () => void;
  onCrouch: () => void;
  onHeightStateChange?: (state: 'NORMAL' | 'JUMP' | 'CROUCH') => void;
  onRestart: () => void;
  isGamePlaying: boolean;
}

type CornerType = 'TOP_RIGHT' | 'BOTTOM_RIGHT' | 'BOTTOM_LEFT' | 'TOP_LEFT';

export const CameraControls: React.FC<CameraControlsProps> = ({
  onMoveLeft,
  onMoveRight,
  onLaneChange,
  onJump,
  onCrouch,
  onHeightStateChange,
  onRestart,
  isGamePlaying,
}) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [statusText, setStatusText] = useState('Camera Off');
  const [statusType, setStatusType] = useState<'OFF' | 'LOADING' | 'READY' | 'CALIBRATING' | 'ACTIVE' | 'ERROR'>('OFF');
  
  // Placement/Layout Configs
  const [corner, setCorner] = useState<CornerType>('BOTTOM_RIGHT');
  const [isMinimized, setIsMinimized] = useState(false);

  // Calibration countdown displays
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [calibrationProgress, setCalibrationProgress] = useState(0);

  // Calibration baselines to render guides
  const [baselines, setBaselines] = useState<{ shoulderX: number; noseY: number } | null>(null);

  // Active track indicators to light up in PIP
  const [activeActions, setActiveActions] = useState<{
    left: boolean;
    right: boolean;
    jump: boolean;
    crouch: boolean;
  }>({ left: false, right: false, jump: false, crouch: false });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<CameraGestureController | null>(null);

  // Keep actions ref to prevent closure capture issues in callbacks
  const actionsRef = useRef({ onMoveLeft, onMoveRight, onLaneChange, onJump, onCrouch, onHeightStateChange, onRestart });
  useEffect(() => {
    actionsRef.current = { onMoveLeft, onMoveRight, onLaneChange, onJump, onCrouch, onHeightStateChange, onRestart };
  }, [onMoveLeft, onMoveRight, onLaneChange, onJump, onCrouch, onHeightStateChange, onRestart]);

  // Clean actions indicator timer resets
  const triggerVisualAction = (action: 'left' | 'right' | 'jump' | 'crouch') => {
    setActiveActions((prev) => ({ ...prev, [action]: true }));
    setTimeout(() => {
      setActiveActions((prev) => ({ ...prev, [action]: false }));
    }, 350);
  };

  // Turn camera controller ON / OFF
  const toggleCamera = async () => {
    if (isEnabled) {
      cleanup();
    } else {
      setIsEnabled(true);
      setStatusType('LOADING');
      setStatusText('Booting up Camera...');
    }
  };

  const cleanup = () => {
    if (controllerRef.current) {
      controllerRef.current.destroy();
      controllerRef.current = null;
    }
    setIsEnabled(false);
    setStatusType('OFF');
    setStatusText('Camera Off');
    setBaselines(null);
  };

  // Build and initialize controller instance on state change
  useEffect(() => {
    if (!isEnabled) return;

    const startController = async () => {
      if (!videoRef.current) return;

      const controller = new CameraGestureController({
        onMoveLeft: () => {
          actionsRef.current.onMoveLeft();
          triggerVisualAction('left');
        },
        onMoveRight: () => {
          actionsRef.current.onMoveRight();
          triggerVisualAction('right');
        },
        onLaneChange: (lane) => {
          if (actionsRef.current.onLaneChange) {
            actionsRef.current.onLaneChange(lane);
          }
          // Real-time HUD indicators matching exact direct lean postures
          setActiveActions((prev) => ({
            ...prev,
            left: lane === -1,
            right: lane === 1,
          }));
        },
        onHeightStateChange: (state) => {
          if (actionsRef.current.onHeightStateChange) {
            actionsRef.current.onHeightStateChange(state);
          }
           // Real-time HUD indicators
          setActiveActions((prev) => ({
            ...prev,
            jump: state === 'JUMP',
            crouch: state === 'CROUCH',
          }));
        },
        onJump: () => {
          actionsRef.current.onJump();
          triggerVisualAction('jump');
        },
        onCrouch: () => {
          actionsRef.current.onCrouch();
          triggerVisualAction('crouch');
        },
        onRestart: () => {
          actionsRef.current.onRestart();
        },
        onStatusChange: (status) => {
          setStatusText(status);
          if (status.includes('Ready') || status.includes('Camera Ready')) {
            setStatusType('READY');
          } else if (status.includes('Calibrating')) {
            setStatusType('CALIBRATING');
          } else if (status.includes('Active')) {
            setStatusType('ACTIVE');
          } else if (status.includes('Error') || status.includes('Denied')) {
            setStatusType('ERROR');
          } else if (status.includes('Loading')) {
            setStatusType('LOADING');
          }
        },
        onCalibrationProgress: (progress, seconds) => {
          setCalibrationProgress(progress);
          setSecondsLeft(seconds);
        },
        onCalibrationComplete: (neutralX, neutralY) => {
          setBaselines({ shoulderX: neutralX, noseY: neutralY });
          setStatusType('ACTIVE');
          setStatusText('Tracking Active');
        },
        onPoseUpdate: (nose, shoulders) => {
          drawPreview(nose, shoulders);
        }
      });

      controllerRef.current = controller;

      try {
        await controller.initialize(videoRef.current);
        // Auto-calibrate when loading is finished so the user gets straight to playing
        controller.startCalibration();
      } catch (err) {
        setStatusType('ERROR');
        setStatusText('Permission Denied / Cancelled');
      }
    };

    // Give a short frame delay to guarantee HTML elements have mounted
    const timer = setTimeout(() => {
      startController();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (controllerRef.current) {
        controllerRef.current.destroy();
        controllerRef.current = null;
      }
    };
  }, [isEnabled]);

  // Handle game playing/paused state shifts
  useEffect(() => {
    if (!controllerRef.current) return;
    if (isGamePlaying) {
      controllerRef.current.resume();
    } else {
      controllerRef.current.pause();
    }
  }, [isGamePlaying]);

  // Cleanups on component unmount
  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        controllerRef.current.destroy();
      }
    };
  }, []);

  const triggerCalibration = () => {
    if (controllerRef.current) {
      controllerRef.current.startCalibration();
    }
  };

  /**
   * Draw the mirrored video frame plus tracked landmarks with futuristic vector styles
   */
  const drawPreview = (
    nose: { x: number; y: number } | null,
    shoulders: { left: { x: number; y: number }; right: { x: number; y: number } } | null
  ) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.readyState < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // 1. Clear previous drawings
    ctx.clearRect(0, 0, w, h);

    // 2. Draw mirrored video feed frame background
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    // 3. Draw Cyber HUD/Coordinate Grids Overlays in PIP
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    // Crosshair grid center lines
    ctx.beginPath();
    ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
    ctx.stroke();

    // If calibrated baseline targets exist, draw thresholds overlay lines
    if (baselines) {
      const bX = w - (baselines.shoulderX * w); // Mirrored baseline X
      const bY = baselines.noseY * h;

      const scale = controllerRef.current ? controllerRef.current.getScaleRatio() : 1.0;
      const leanOffset = 0.08 * scale * w;
      const jumpOffset = 0.075 * scale * h;
      const crouchOffset = 0.075 * scale * h;

      // Draw Center Baseline Reference
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(bX, 0); ctx.lineTo(bX, h);
      ctx.stroke();

      // Draw horizontal shoulder lean boundaries
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.35)'; // Pink left limit
      ctx.beginPath();
      // Physical Mirror: leaning left places shoulderX further back (smaller X),
      // which corresponds to a physical lean left, so the mirrored line is bX - offset
      ctx.moveTo(bX - leanOffset, 0); ctx.lineTo(bX - leanOffset, h);
      ctx.moveTo(bX + leanOffset, 0); ctx.lineTo(bX + leanOffset, h);
      ctx.stroke();

      // Draw horizontal jump and crouch thresholds
      ctx.strokeStyle = 'rgba(34, 197, 94, 0.35)'; // Green height thresholds
      ctx.beginPath();
      ctx.moveTo(0, bY - jumpOffset); ctx.lineTo(w, bY - jumpOffset); // Jump limit
      ctx.moveTo(0, bY + crouchOffset); ctx.lineTo(w, bY + crouchOffset); // Crouch limit
      ctx.stroke();
      ctx.setLineDash([]); // clear dash
    }

    // 4. Draw tracked features if points are locked
    if (nose && shoulders) {
      // Mirrored pixel coordinate transforms
      const noseX = w - (nose.x * w);
      const noseY = nose.y * h;
      const leftS_X = w - (shoulders.left.x * w);
      const leftS_Y = shoulders.left.y * h;
      const rightS_X = w - (shoulders.right.x * w);
      const rightS_Y = shoulders.right.y * h;

      const armCenter_X = (leftS_X + rightS_X) / 2;
      const armCenter_Y = (leftS_Y + rightS_Y) / 2;

      // Draw shoulder connecting line
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(leftS_X, leftS_Y);
      ctx.lineTo(rightS_X, rightS_Y);
      ctx.stroke();

      // Draw nose connecting column
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.moveTo(noseX, noseY);
      ctx.lineTo(armCenter_X, armCenter_Y);
      ctx.stroke();

      // Draw Shoulder Joints dots (Cyan target circles)
      ctx.fillStyle = '#00ffff';
      ctx.beginPath();
      ctx.arc(leftS_X, leftS_Y, 6, 0, Math.PI * 2);
      ctx.arc(rightS_X, rightS_Y, 6, 0, Math.PI * 2);
      ctx.fill();

      // Draw Nose glowing node (Neon Pink sensor dot)
      ctx.fillStyle = '#ff00cc';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ff00cc';
      ctx.beginPath();
      ctx.arc(noseX, noseY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0; // reset shadow
    }
  };

  // Map corners to exact viewport fixed coordinates
  // Adjusted offsets to prevent blocking critical metric gauges or action swipers
  const CORNER_POSITIONS: Record<CornerType, string> = {
    TOP_RIGHT: 'fixed top-24 right-4 z-[40]',
    BOTTOM_RIGHT: 'fixed bottom-20 xs:bottom-24 sm:bottom-28 right-4 z-[40]',
    BOTTOM_LEFT: 'fixed bottom-20 xs:bottom-24 sm:bottom-28 left-4 z-[40]',
    TOP_LEFT: 'fixed top-24 left-4 z-[40]',
  };

  // 1. Minimized/Disabled State Handler: Keep overall top view super clean!
  if (!isEnabled) {
    return (
      <div className="flex justify-end pointer-events-auto" id="camera-controls-min-pill">
        <button
          onClick={toggleCamera}
          className="flex items-center gap-2 px-3 py-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 text-slate-300 hover:text-cyan-400 rounded-xl shadow-lg transition-all duration-300 text-xs font-bold uppercase tracking-wider cursor-pointer backdrop-blur-md group"
        >
          <Camera className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
          <span>V-Gesture On</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pointer-events-auto" id="camera-controls-interactive-hub">
      {/* 2. Compact Control Action bar */}
      <div className="z-10 bg-slate-900/95 border border-slate-800 rounded-xl p-3 shadow-xl flex items-center justify-between gap-3 max-w-sm w-76 sm:w-80 relative overflow-hidden backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg transition-colors ${
            statusType === 'ACTIVE'
              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/50'
              : statusType === 'CALIBRATING'
              ? 'bg-pink-950/40 text-pink-400 border border-pink-800/50 animate-pulse'
              : statusType === 'LOADING'
              ? 'bg-cyan-950/40 text-cyan-400 border border-cyan-800/50'
              : 'bg-slate-950/60 text-slate-500 border border-slate-800/80'
          }`}>
            <Camera className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Warp Vision Core</span>
            <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1 mt-0.5">
              {statusType === 'LOADING' && <Loader2 className="w-2.5 h-2.5 animate-spin text-cyan-400 mr-1" />}
              {statusText}
            </span>
          </div>
        </div>

        {/* Dynamic Controls depending on toggle states */}
        <div className="flex gap-1.5 items-center">
          {statusType === 'ACTIVE' && (
            <button
              onClick={triggerCalibration}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg text-[9px] uppercase font-bold tracking-wider transition cursor-pointer flex items-center gap-1"
              title="Re-calibrate Center Position"
            >
              <RefreshCw className="w-2.5 h-2.5" /> Calibrate
            </button>
          )}

          <button
            onClick={toggleCamera}
            className="px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-widest transition cursor-pointer border bg-red-950/40 hover:bg-red-950 border-red-800/40 text-red-100 hover:text-red-300"
          >
            OFF
          </button>
        </div>
      </div>

      {/* 3. Hidden standard webcam tracking target */}
      <video
        ref={videoRef}
        className="hidden"
        style={{ display: 'none' }}
        muted
        playsInline
      />

      {/* 4. FLOATING PIP VIEWPORTS (DRAGGED/DOCKED IN CORNERS, COMPLETELY RESPONSIVE) */}
      {isEnabled && !isMinimized && (
        <div className={`${CORNER_POSITIONS[corner]} bg-slate-950 border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl flex flex-col pointer-events-auto select-none backdrop-blur-md transition-all duration-300 ease-in-out w-30 xs:w-36 sm:w-44 md:w-52 aspect-[4/3]`}>
          {/* Main Visualizer Target Canvas */}
          <canvas
            ref={canvasRef}
            className="w-full h-full object-cover z-0"
            width={320}
            height={240}
          />

          {/* Micro Controller Overlays nested directly inside PIP */}
          <div className="absolute top-1.5 right-1.5 flex gap-1 z-20">
            {/* Cycle Corners */}
            {statusType === 'ACTIVE' && (
              <button
                onClick={() => {
                  const corners: CornerType[] = ['TOP_RIGHT', 'BOTTOM_RIGHT', 'BOTTOM_LEFT', 'TOP_LEFT'];
                  const cur = corners.indexOf(corner);
                  setCorner(corners[(cur + 1) % corners.length]);
                }}
                className="p-1 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded text-slate-300 hover:text-cyan-400 transition cursor-pointer"
                title="Shift to next workspace corner"
              >
                <Move className="w-2.5 h-2.5" />
              </button>
            )}

            {/* Minimize PIP */}
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded text-slate-300 hover:text-cyan-400 transition cursor-pointer"
              title="Minimize stream camera view"
            >
              <Minimize2 className="w-2.5 h-2.5" />
            </button>
          </div>

          {/* Active Calibration UI Blocking Card */}
          {statusType === 'CALIBRATING' && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-2 text-center z-10 select-none">
              <Sparkles className="w-4 h-4 sm:w-6 sm:h-6 text-pink-500 animate-pulse mb-1" />
              <h3 className="text-[9px] sm:text-[11px] font-black uppercase text-pink-400 tracking-wider">Calibrating</h3>
              <p className="hidden sm:block text-[8px] text-slate-400 max-w-[130px] mt-0.5 leading-snug">
                Stand center and straight!
              </p>
              
              {/* Responsive Countdown Number */}
              <div className="text-lg sm:text-2xl font-black text-white mt-1.5 font-mono border border-pink-500/20 w-8 h-8 sm:w-11 sm:h-11 flex items-center justify-center rounded-full bg-pink-950/30 shadow-lg shadow-pink-500/15">
                {secondsLeft}
              </div>

              {/* Progress Bar */}
              <div className="w-16 sm:w-24 h-1 bg-slate-800 rounded-full mt-2 overflow-hidden border border-slate-700/30">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-pink-500 transition-all duration-75"
                  style={{ width: `${calibrationProgress * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* User Camera Permissions Error Backdrop */}
          {statusType === 'ERROR' && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-2 text-center z-10">
              <AlertCircle className="w-5 h-5 sm:w-7 sm:h-7 text-red-500 mb-1" />
              <h3 className="text-[9px] sm:text-[11px] font-bold uppercase text-red-500 tracking-wider">Webcam Error</h3>
              <p className="hidden sm:block text-[8px] text-slate-400 max-w-[140px] mt-0.5 leading-snug animate-pulse">
                Camera access denied by system privacy filters.
              </p>
              <div className="mt-2 text-[8px] text-pink-400 font-semibold px-1 py-0.5 bg-slate-900 border border-slate-800 rounded">
                ALLOW MEDIA
              </div>
            </div>
          )}

          {/* Active Visual HUD Action Toggles */}
          {statusType === 'ACTIVE' && (
            <div className="absolute bottom-1 sm:bottom-2 inset-x-1 sm:inset-x-2 flex justify-between gap-0.5 sm:gap-1 z-10 pointer-events-none select-none">
              <div className={`px-1 py-0.5 rounded text-[7px] sm:text-[8px] font-black uppercase tracking-wider border transition-all ${
                activeActions.left 
                  ? 'bg-pink-600 text-white border-pink-400 shadow-md shadow-pink-500/40 animate-bounce' 
                  : 'bg-slate-950/65 border-slate-800/80 text-slate-500'
              }`}>
                LEFT
              </div>
              <div className={`px-1 py-0.5 rounded text-[7px] sm:text-[8px] font-black uppercase tracking-wider border transition-all ${
                activeActions.jump 
                  ? 'bg-pink-600 text-white border-pink-400 shadow-md shadow-pink-500/40 -translate-y-0.5' 
                  : 'bg-slate-950/65 border-slate-800/80 text-slate-500'
              }`}>
                JUMP
              </div>
              <div className={`px-1 py-0.5 rounded text-[7px] sm:text-[8px] font-black uppercase tracking-wider border transition-all ${
                activeActions.crouch 
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-500/40 translate-y-0.5' 
                  : 'bg-slate-950/65 border-slate-800/80 text-slate-500'
              }`}>
                SLIDE
              </div>
              <div className={`px-1 py-0.5 rounded text-[7px] sm:text-[8px] font-black uppercase tracking-wider border transition-all ${
                activeActions.right 
                  ? 'bg-pink-600 text-white border-pink-400 shadow-md shadow-pink-500/40 animate-bounce' 
                  : 'bg-slate-950/65 border-slate-800/80 text-slate-500'
              }`}>
                RIGHT
              </div>
            </div>
          )}

          {/* Tiny live streaming badge */}
          {statusType === 'ACTIVE' && (
            <div className="absolute top-1.5 left-1.5 z-10 bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 rounded flex items-center gap-1 px-1 sm:px-1.5 py-0.5 text-[7px] sm:text-[8px] font-mono tracking-wider uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              LIVE
            </div>
          )}
        </div>
      )}

      {/* 5. Minimal tracking indicator when PIP window is minimized */}
      {isEnabled && isMinimized && (
        <div className={`${CORNER_POSITIONS[corner]} flex items-center justify-center pointer-events-auto select-none`}>
          <button
            onClick={() => setIsMinimized(false)}
            className="w-10 h-10 bg-slate-900 border border-emerald-500/50 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition duration-200 group relative"
            title="Restore camera preview"
          >
            {/* Pulsing indicator of active tracking */}
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Camera className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      )}
    </div>
  );
};
