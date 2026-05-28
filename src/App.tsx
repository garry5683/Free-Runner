/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GameStatus, PlayerStats } from './types';
import { InputManager } from './components/InputManager';
import { PlayerController } from './components/PlayerController';
import { CameraFollow } from './components/CameraFollow';
import { AABBCollision } from './components/AABBCollision';
import { WorldGenerator } from './components/WorldGenerator';
import { ParticleSystem } from './components/ParticleSystem';
import { GameUI } from './components/GameUI';
import { CameraControls } from './components/CameraControls';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Game UI States
  const [status, setStatusState] = useState<GameStatus>('READY');
  const [currentSpeed, setCurrentSpeed] = useState(15.0);
  const [countdownVal, setCountdownVal] = useState<number | null>(null);

  // Use a mutable ref to hold exact status inside high-frequency 60FPS tick closures
  const statusRefVal = useRef<GameStatus>('READY');
  const setStatus = (newStatus: GameStatus) => {
    statusRefVal.current = newStatus;
    setStatusState(newStatus);
  };

  // Core high-score persistence
  const [stats, setStats] = useState<PlayerStats>({
    score: 0,
    coins: 0,
    distance: 0,
    highScore: parseInt(localStorage.getItem('cyber_runner_highscore') || '0', 10),
  });

  // Keep actual stats in a mutable ref for low-overhead access inside 60FPS loop
  const statsRef = useRef<PlayerStats>({
    score: 0,
    coins: 0,
    distance: 0,
    highScore: parseInt(localStorage.getItem('cyber_runner_highscore') || '0', 10),
  });

  // References to active engine modules
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const clockRef = useRef<THREE.Clock | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Game entities refs
  const playerRef = useRef<PlayerController | null>(null);
  const cameraFollowRef = useRef<CameraFollow | null>(null);
  const worldRef = useRef<WorldGenerator | null>(null);
  const particlesRef = useRef<ParticleSystem | null>(null);
  const inputRef = useRef<InputManager | null>(null);

  // Lighting following the player
  const cursorLightRef = useRef<THREE.PointLight | null>(null);

  // State synchronization ticker (to avoid bogging down React with text updates)
  const syncTickerRef = useRef(0);

  // 5-to-0 Countdown Effect
  useEffect(() => {
    if (status !== 'COUNTDOWN' || countdownVal === null) return;

    if (countdownVal > 0) {
      const timer = setTimeout(() => {
        setCountdownVal(countdownVal - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Countdown complete! Resume core displacement clock
      if (clockRef.current) {
        clockRef.current.start();
        setStatus('PLAYING');
        setCountdownVal(null);
      }
    }
  }, [status, countdownVal]);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene & Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06060c); // Dark space canvas
    scene.fog = new THREE.FogExp2(0x06060c, 0.015); // Cyber atmospheric fog
    sceneRef.current = scene;

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);

    // 3. Renderer initialization
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // mobile friendly throttling
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Beautiful anti-aliased shadows
    
    // Clear wrapper first
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const clock = new THREE.Clock(false);
    clockRef.current = clock;

    // 4. Lighting Rig
    const ambientLight = new THREE.AmbientLight(0x18182d, 1.2);
    scene.add(ambientLight);

    // Primary Spotlight (Sunburst) driving shadows from overhead front-right
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
    dirLight.position.set(10, 20, 15);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 45;
    const shadowSize = 15;
    dirLight.shadow.camera.left = -shadowSize;
    dirLight.shadow.camera.right = shadowSize;
    dirLight.shadow.camera.top = shadowSize;
    dirLight.shadow.camera.bottom = -shadowSize;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // Cyan Neon floor wash light that rides slightly ahead of player (creates gorgeous oncoming hazard shines)
    const cursorLight = new THREE.PointLight(0x00ffff, 3.5, 25.0, 1.5);
    cursorLight.position.set(0, 4, 10);
    scene.add(cursorLight);
    cursorLightRef.current = cursorLight;

    // 5. Instantiation of Game Systems
    const player = new PlayerController();
    scene.add(player.mesh);
    playerRef.current = player;

    const cameraFollow = new CameraFollow(camera);
    cameraFollow.reset(player.position);
    cameraFollowRef.current = cameraFollow;

    const world = new WorldGenerator(scene);
    world.init();
    worldRef.current = world;

    const particles = new ParticleSystem(scene);
    particlesRef.current = particles;

    // 6. Input Manager Initializations
    const input = new InputManager();
    input.init(containerRef.current);
    
    input.onSwipeLeft = () => player.laneLeft();
    input.onSwipeRight = () => player.laneRight();
    input.onSwipeUp = () => player.jump();
    input.onSwipeDown = () => player.slide();

    inputRef.current = input;

    // 7. Device Resize Observer
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;

      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      rendererRef.current.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(containerRef.current);

    // Initial positioning
    cameraFollow.reset(player.position);

    // 8. Core Game Tick & Frame Animation Loop
    const gameLoop = () => {
      animationFrameId.current = requestAnimationFrame(gameLoop);

      const deltaTime = Math.min(0.06, clock.getDelta()); // Cap delta to prevent huge jumps on lag spikes

      const activeStatus = statsRef.current.score < 0 ? 'READY' : (player.action === 'CRASH' ? 'GAMEOVER' : (clock.running ? 'PLAYING' : 'PAUSED'));

      // Run particles every frame for seamless presentation regardless of physics activity
      if (particlesRef.current) {
        particlesRef.current.update(deltaTime);
      }

      const isCountdown = statusRefVal.current === 'COUNTDOWN';

      // If active running gameplay OR during countdown alignment
      if ((clock.running || isCountdown) && playerRef.current && worldRef.current && cameraFollowRef.current) {
        const activePlayer = playerRef.current;
        const activeWorld = worldRef.current;
        const activeCamera = cameraFollowRef.current;

        if (isCountdown) {
          // Freeze advance motion but allow responsive lane-shifting and tilt dynamics
          const originalSpeed = activePlayer.speed;
          activePlayer.speed = 0;
          activePlayer.update(deltaTime);
          activePlayer.speed = originalSpeed;

          // Align camera and refresh core trackers
          activeCamera.update(activePlayer.position, deltaTime);
          activeWorld.tick(deltaTime);
        } else {
          // A. Refresh Player Coordinates & Actions
          activePlayer.update(deltaTime);
          setCurrentSpeed(activePlayer.speed);

          // B. Exhaust sparks trail
          if (activePlayer.action !== 'CRASH' && particlesRef.current) {
            particlesRef.current.spawnExhaustTrail(activePlayer.position, activePlayer.speed);
          }

          // C. Clean/Build track segments ahead
          activeWorld.updateSegments(activePlayer.position.z);
          activeWorld.tick(deltaTime);

          // D. Follow player position smoothly
          activeCamera.update(activePlayer.position, deltaTime);
        }

        // E. Ride lights along player trail for neon highlighting
        if (dirLight) {
          dirLight.position.set(activePlayer.position.x + 10, 20, activePlayer.position.z + 15);
          dirLight.target = activePlayer.mesh;
        }
        if (cursorLightRef.current) {
          cursorLightRef.current.position.set(activePlayer.position.x, 3.2, activePlayer.position.z + 8);
        }

        // F. COIN COLLECTOR CHECK (Surgical AABB math)
        const playerBox = activePlayer.getBoundingBox();

        for (let i = 0; i < activeWorld.activeCoins.length; i++) {
          const coin = activeWorld.activeCoins[i];
          if (!coin.collected && coin.mesh) {
            // Check approximate quick proximity before doing rich intersection logic to save overhead
            if (Math.abs(coin.z - activePlayer.position.z) < 2.5 && coin.lane === activePlayer.currentLane) {
              const coinBox = new THREE.Box3().setFromObject(coin.mesh);
              // Check collision overlap
              if (AABBCollision.checkIntersectionWithTolerance(playerBox, coinBox, 0.15, 0.15, 0.15)) {
                activeWorld.collectCoin(coin);
                
                // Spawn golden sparkle rings
                if (particlesRef.current) {
                  particlesRef.current.spawnCoinBurst(new THREE.Vector3(-coin.lane * PlayerController.LANE_WIDTH, coin.y, coin.z));
                }

                // Increment Stats
                statsRef.current.coins += 1;
              }
            }
          }
        }

        // G. OBSTACLE COLLISION DETECTOR (AABB with margins)
        for (let j = 0; j < activeWorld.activeObstacles.length; j++) {
          const obstacle = activeWorld.activeObstacles[j];
          if (!obstacle.collided && obstacle.mesh) {
            const zDistance = Math.abs(obstacle.z - activePlayer.position.z);
            // Obstacles can be deep (e.g. static trains can span 7m along Z). Verify z distance threshold
            const depthCheckLimit = (obstacle.type === 'TRAIN_STATIC') ? 5.0 : 2.5;

            if (zDistance < depthCheckLimit && (obstacle.lane === activePlayer.currentLane || obstacle.lane === activePlayer.targetLane)) {
              const obstacleBox = obstacle.getBoundingBox ? obstacle.getBoundingBox() : new THREE.Box3().setFromObject(obstacle.mesh);
              
              // Forgiving margin triggers: allows jump and slide clearances
              if (AABBCollision.checkIntersectionWithTolerance(playerBox, obstacleBox, 0.25, 0.1, 0.22)) {
                obstacle.collided = true;
                activePlayer.triggerCrash();

                // Explode magenta fragments
                if (particlesRef.current) {
                  particlesRef.current.spawnCrashBurst(activePlayer.position);
                }

                // Push final stats update
                clock.stop();
                handleGameOver();
              }
            }
          }
        }

        // H. STAT DISPLACEMENT SCORE ACCUMULATION
        if (activePlayer.action !== 'CRASH') {
          statsRef.current.distance = activePlayer.position.z;
          statsRef.current.score = statsRef.current.distance + (statsRef.current.coins * 105);

          // Update High Score if needed
          if (statsRef.current.score > statsRef.current.highScore) {
            statsRef.current.highScore = statsRef.current.score;
            localStorage.setItem('cyber_runner_highscore', Math.floor(statsRef.current.highScore).toString());
          }
        }

        // I. LOWER REACT TICK REPAINTS FOR SOLID 60FPS: Throttle sync to React state (every 6 frames)
        syncTickerRef.current++;
        if (syncTickerRef.current >= 6) {
          syncTickerRef.current = 0;
          setStats({ ...statsRef.current });
        }
      }

      renderer.render(scene, camera);
    };

    // Begin looping
    gameLoop();

    // Cleanups
    return () => {
      resizeObserver.disconnect();
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      if (inputRef.current) {
        inputRef.current.destroy();
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      // Recursively dispose geometry and materials of any remainders
      if (sceneRef.current) {
        sceneRef.current.traverse((object: any) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            if (Array.isArray(object.material)) {
              object.material.forEach((material) => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        });
      }
    };
  }, []);

  // GAME CONTROLLER PIPELINES

  const handleStart = () => {
    // Reset configurations
    statsRef.current.score = 0;
    statsRef.current.coins = 0;
    statsRef.current.distance = 0;
    setStats({ ...statsRef.current });

    if (playerRef.current && cameraFollowRef.current && worldRef.current && particlesRef.current && clockRef.current) {
      playerRef.current.reset(0);
      cameraFollowRef.current.reset(playerRef.current.position);
      worldRef.current.init();
      particlesRef.current.clearAll();
      
      // Stand-by clock until countdown is complete
      clockRef.current.stop();
      setStatus('COUNTDOWN');
      setCountdownVal(5); // Start 5 seconds countdown
    }
  };

  const handlePause = () => {
    if (clockRef.current) {
      clockRef.current.stop();
      setStatus('PAUSED');
    }
  };

  const handleResume = () => {
    if (clockRef.current) {
      clockRef.current.start();
      setStatus('PLAYING');
    }
  };

  const handleRestart = () => {
    handleStart();
  };

  const handleGameOver = () => {
    setStatus('GAMEOVER');
    // Ensure final state sync to React is complete immediately
    setStats({ ...statsRef.current });
  };

  // Virtual buttons forwarding actions to player Controller
  const executeLeftStr = () => {
    if (playerRef.current && (status === 'PLAYING' || status === 'COUNTDOWN')) {
      playerRef.current.laneLeft();
    }
  };

  const executeRightStr = () => {
    if (playerRef.current && (status === 'PLAYING' || status === 'COUNTDOWN')) {
      playerRef.current.laneRight();
    }
  };

  const executeJumpStr = () => {
    if (playerRef.current && (status === 'PLAYING' || status === 'COUNTDOWN')) {
      playerRef.current.jump();
    }
  };

  const executeSlideStr = () => {
    if (playerRef.current && (status === 'PLAYING' || status === 'COUNTDOWN')) {
      playerRef.current.slide();
    }
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans" id="canvas-main-viewport">
      {/* 3D WebGL Canvas Rendering Target */}
      <div ref={containerRef} className="w-full h-full absolute inset-0 z-0 select-none outline-none" id="world-graphics-renderer" />

      {/* Cyberpunk UI Overlay Controls and Counters */}
      <GameUI
        status={status}
        stats={stats}
        currentSpeed={currentSpeed}
        onStart={handleStart}
        onPause={handlePause}
        onResume={handleResume}
        onRestart={handleRestart}
        onTriggerLeft={executeLeftStr}
        onTriggerRight={executeRightStr}
        onTriggerJump={executeJumpStr}
        onTriggerSlide={executeSlideStr}
        countdownVal={countdownVal}
      />

      {/* Cyberpunk Camera Control Overlay HUD */}
      <div className="absolute top-20 md:top-24 right-4 z-30 select-none pointer-events-none" id="camera-hud-container">
        <CameraControls
          onMoveLeft={executeLeftStr}
          onMoveRight={executeRightStr}
          onLaneChange={(lane) => {
            if (playerRef.current && (status === 'PLAYING' || status === 'COUNTDOWN')) {
              playerRef.current.setTargetLaneDirect(lane);
            }
          }}
          onHeightStateChange={(state) => {
            if (playerRef.current && (status === 'PLAYING' || status === 'COUNTDOWN')) {
               playerRef.current.setDuckingStatus(state === 'CROUCH');
            }
          }}
          onJump={executeJumpStr}
          onCrouch={executeSlideStr}
          onRestart={handleRestart}
          isGamePlaying={status === 'PLAYING'}
        />
      </div>
    </main>
  );
}
