/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GameStatus, PlayerStats } from '../types';
import { Trophy, Coins, Compass, Activity, Zap, Play, RotateCcw, Pause, Sparkles, HelpCircle, ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from 'lucide-react';

interface GameUIProps {
  status: GameStatus;
  stats: PlayerStats;
  currentSpeed: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onTriggerLeft: () => void;
  onTriggerRight: () => void;
  onTriggerJump: () => void;
  onTriggerSlide: () => void;
  countdownVal?: number | null;
}

export const GameUI: React.FC<GameUIProps> = ({
  status,
  stats,
  currentSpeed,
  onStart,
  onPause,
  onResume,
  onRestart,
  onTriggerLeft,
  onTriggerRight,
  onTriggerJump,
  onTriggerSlide,
  countdownVal,
}) => {
  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-between pointer-events-none font-sans text-white select-none">
      
      {/* 1. HUD HEADER: Always visible when playing, paused, or counting down */}
      {(status === 'PLAYING' || status === 'PAUSED' || status === 'COUNTDOWN') && (
        <div className="w-full p-4 md:p-6 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
          {/* Stats Bar */}
          <div className="flex flex-col gap-1.5 md:flex-row md:gap-6">
            {/* Score */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-lg shadow-lg">
              <Trophy className="w-4 right-4 text-pink-500 animate-pulse" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Score</span>
                <span className="font-mono text-base md:text-lg font-bold text-pink-400">
                  {Math.floor(stats.score).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Coins */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-lg shadow-lg">
              <Coins className="w-4 h-4 text-yellow-400 animate-bounce" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Nano-Credits</span>
                <span className="font-mono text-base md:text-lg font-bold text-yellow-400">
                  {stats.coins}
                </span>
              </div>
            </div>

            {/* Distance */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-lg shadow-lg">
              <Compass className="w-4 h-4 text-emerald-400" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Distance</span>
                <span className="font-mono text-base md:text-lg font-bold text-emerald-400">
                  {Math.floor(stats.distance)}m
                </span>
              </div>
            </div>
          </div>

          {/* Speed Indicator & Pause Trigger */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 bg-slate-900/80 border border-slate-805 rounded-md text-xs font-mono">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">SPEED:</span>
              <span className="text-cyan-400 font-bold">{Math.round(currentSpeed * 3.6)} KP/H</span>
            </div>

            {status === 'PLAYING' ? (
              <button
                onClick={onPause}
                style={{ contentVisibility: 'auto' }}
                className="p-3 bg-pink-600 hover:bg-pink-500 text-white rounded-lg border border-pink-400/30 transition shadow-lg shadow-pink-600/25 pointer-events-auto cursor-pointer"
                aria-label="Pause game"
              >
                <Pause className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onResume}
                style={{ contentVisibility: 'auto' }}
                className="p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg border border-emerald-400/30 transition shadow-lg shadow-emerald-600/25 pointer-events-auto cursor-pointer"
                aria-label="Resume game"
              >
                <Play className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. CENTRAL STATE MODALS */}

      {/* A. START SCREEN / READY STATE */}
      {status === 'READY' && (
        <div className="absolute inset-0 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md pointer-events-auto">
          <div className="w-full max-w-md p-6 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
            {/* Top decorative cyan glowing line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-pink-500 to-purple-600"></div>

            <div className="flex items-center gap-2 px-3 py-1 bg-cyan-950/80 text-cyan-400 rounded-full text-[10px] font-bold tracking-widest uppercase border border-cyan-800/50 mb-4 animate-pulse">
              <Sparkles className="w-3 h-3" /> System Initialized
            </div>

            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-pink-400 to-purple-400 bg-clip-text text-transparent font-sans">
              CYBER RUNNER 3D
            </h1>
            <p className="text-xs text-slate-400 mt-2 max-w-sm">
              Endless WebGL 3D rail navigation. Dodge electric lasers, jump hazards, and secure nano-credits.
            </p>

            {/* High Score Badge */}
            {stats.highScore > 0 && (
              <div className="w-full mt-4 p-2 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-center justify-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-slate-400 font-medium">All-Time High Record:</span>
                <span className="font-mono text-sm font-bold text-yellow-400">{Math.floor(stats.highScore)}</span>
              </div>
            )}

            {/* Controls panel */}
            <div className="w-full mt-5 p-3.5 bg-slate-950/80 rounded-xl text-left border border-slate-800/50">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5 mb-2.5">
                <HelpCircle className="w-4 h-4 text-cyan-400" /> Controls Guide
              </span>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500 font-semibold uppercase text-[9px]">Lanes Steer</span>
                  <span className="text-cyan-400 font-medium">Swipe Left / Right</span>
                  <span className="text-[10px] text-slate-500">or Arrow Left / Right</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-500 font-semibold uppercase text-[9px]">Jump Hurdles</span>
                  <span className="text-pink-400 font-medium font-semibold">Swipe Up</span>
                  <span className="text-[10px] text-slate-500">or Arrow Up / Spacebar</span>
                </div>
                <div className="flex flex-col gap-1 border-t border-slate-800/50 pt-2 col-span-2">
                  <span className="text-slate-500 font-semibold uppercase text-[9px]">Slide & Smash Down</span>
                  <span className="text-emerald-400 font-medium">Swipe Down</span>
                  <span className="text-[10px] text-slate-500">or Arrow Down</span>
                </div>
              </div>
            </div>

            {/* Action button */}
            <button
              onClick={onStart}
              className="w-full mt-6 py-4 bg-gradient-to-r from-cyan-500 via-pink-500 to-purple-600 rounded-xl font-bold uppercase tracking-wider text-sm transition transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-lg shadow-pink-500/25 border border-white/10"
            >
              BOOT PROTOCOL (START GAME)
            </button>
          </div>
        </div>
      )}

      {/* B. PAUSED STATE SCREEN */}
      {status === 'PAUSED' && (
        <div className="absolute inset-0 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm pointer-events-auto">
          <div className="w-full max-w-sm p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col items-center text-center">
            <div className="p-3 bg-pink-950/50 border border-pink-800/30 text-pink-400 rounded-full mb-3">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>

            <h2 className="text-2xl font-black uppercase text-pink-400 tracking-wide font-sans">
              ENGINE SUSPENDED
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Current progress is cached under the cockpit console.
            </p>

            <div className="grid grid-cols-2 gap-3 w-full mt-6">
              <button
                onClick={onResume}
                style={{ contentVisibility: 'auto' }}
                className="py-3 bg-slate-800 hover:bg-slate-700 font-bold uppercase text-xs tracking-wider rounded-xl transition border border-slate-700 cursor-pointer"
              >
                RESUME
              </button>
              <button
                onClick={onRestart}
                style={{ contentVisibility: 'auto' }}
                className="py-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 font-bold uppercase text-xs tracking-wider rounded-xl shadow-md transition cursor-pointer border border-white/5"
              >
                REBOOT RUN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* C. GAME OVER SCREEN */}
      {status === 'GAMEOVER' && (
        <div className="absolute inset-0 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md pointer-events-auto">
          <div className="w-full max-w-md p-6 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-red-600"></div>

            <div className="p-3.5 bg-red-950/50 border border-red-800/40 text-red-500 rounded-full mb-3.5">
              <Zap className="w-7 h-7" />
            </div>

            <h2 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent uppercase tracking-wider">
              RUNNER CRASHED
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Hull integrity compromised. Terminal displacement reports compiled below:
            </p>

            {/* Scoreboard block */}
            <div className="w-full mt-5 grid grid-cols-2 gap-2 bg-slate-950/80 p-4 rounded-xl border border-slate-800/60">
              <div className="flex flex-col items-center justify-center p-2 border-r border-slate-800/40">
                <span className="text-[10px] uppercase text-slate-500 tracking-wider">Total Score</span>
                <span className="font-mono text-xl font-extrabold text-pink-400 mt-1">
                  {Math.floor(stats.score).toLocaleString()}
                </span>
                {stats.score >= stats.highScore && stats.score > 0 && (
                  <span className="text-[9px] uppercase tracking-wider text-yellow-400 font-bold mt-1 bg-yellow-950/40 px-2 py-0.5 rounded border border-yellow-800/30">
                    🏆 New Record
                  </span>
                )}
              </div>

              <div className="flex flex-col items-center justify-center p-2">
                <span className="text-[10px] uppercase text-slate-500 tracking-wider">Nano Credits</span>
                <span className="font-mono text-xl font-extrabold text-yellow-400 mt-1 flex items-center gap-1.5">
                  <Coins className="w-4 h-4" /> {stats.coins}
                </span>
              </div>

              <div className="col-span-2 border-t border-slate-800/40 pt-3 mt-1 flex justify-between items-center px-2 text-xs">
                <span className="text-slate-500 uppercase tracking-widest text-[9px] font-bold">Displacement Length:</span>
                <span className="font-mono text-slate-300 font-bold">{Math.floor(stats.distance)} meters</span>
              </div>
            </div>

            {/* Controls tips */}
            <div className="w-full text-center mt-4">
              <p className="text-[11px] text-slate-500">
                Tip: Swipe Down in mid-air to slam back to lanes and duck high lasers instantly.
              </p>
            </div>

            {/* Reboot button */}
            <button
              onClick={onRestart}
              style={{ contentVisibility: 'auto' }}
              className="w-full mt-5 py-3.5 bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 text-white rounded-xl font-extrabold uppercase tracking-wide text-xs md:text-sm shadow-lg shadow-red-600/25 transition cursor-pointer"
            >
              REBOOT DISPLACEMENT ENGINE (RETRY)
            </button>
          </div>
        </div>
      )}

      {/* 3. VIRTUAL CONTROLLER FOR MOBILE SCREEN INTERACTION */}
      {/* Acts both as an interactive utility AND clear touch indicators for players */}
      {(status === 'PLAYING' || status === 'COUNTDOWN') && (
        <div className="w-full p-4 flex justify-between items-end bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
          {/* Virtual Steering Panel: Left and Right buttons */}
          <div className="flex gap-2.5 pointer-events-auto">
            <button
              onClick={onTriggerLeft}
              style={{ contentVisibility: 'auto' }}
              className="w-12 h-12 md:w-14 md:h-14 bg-slate-900/90 hover:bg-slate-800 active:bg-cyan-950 border border-slate-800 active:border-cyan-500 rounded-full flex items-center justify-center transition shadow-xl pointer-events-auto cursor-pointer"
              aria-label="Steer left"
            >
              <ArrowLeft className="w-5 h-5 text-cyan-400" />
            </button>
            <button
              onClick={onTriggerRight}
              style={{ contentVisibility: 'auto' }}
              className="w-12 h-12 md:w-14 md:h-14 bg-slate-900/90 hover:bg-slate-800 active:bg-cyan-950 border border-slate-800 active:border-cyan-500 rounded-full flex items-center justify-center transition shadow-xl pointer-events-auto cursor-pointer"
              aria-label="Steer right"
            >
              <ArrowRight className="w-5 h-5 text-cyan-400" />
            </button>
          </div>

          {/* Touch-Friendly Swipe Prompts (Visual Indicator overlay in bottom middle) */}
          <div className="hidden md:flex flex-col items-center gap-1 opacity-40 px-3 py-1 bg-slate-950/30 rounded-md">
            <span className="text-[9px] uppercase tracking-widest text-slate-500">Swipe Grid Active</span>
            <span className="text-[10px] text-slate-400">TOUCH OR KEYBOARD DRIVEN</span>
          </div>

          {/* Jump & Slide Action Panel: Up and Down buttons */}
          <div className="flex gap-2.5 pointer-events-auto">
            <button
              onClick={onTriggerJump}
              style={{ contentVisibility: 'auto' }}
              className="w-12 h-12 md:w-14 md:h-14 bg-slate-900/90 hover:bg-slate-800 active:bg-pink-950 border border-slate-800 active:border-pink-500 rounded-full flex items-center justify-center transition shadow-xl pointer-events-auto cursor-pointer"
              aria-label="Jump over barrier"
            >
              <ArrowUp className="w-5 h-5 text-pink-400" />
            </button>
            <button
              onClick={onTriggerSlide}
              style={{ contentVisibility: 'auto' }}
              className="w-12 h-12 md:w-14 md:h-14 bg-slate-900/90 hover:bg-slate-800 active:bg-emerald-950 border border-slate-800 active:border-emerald-500 rounded-full flex items-center justify-center transition shadow-xl pointer-events-auto cursor-pointer"
              aria-label="Slide or smash down"
            >
              <ArrowDown className="w-5 h-5 text-emerald-400" />
            </button>
          </div>
        </div>
      )}

      {/* 4. COUNTDOWN OVERLAY CONTAINER */}
      {status === 'COUNTDOWN' && countdownVal !== undefined && countdownVal !== null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm pointer-events-none animate-fade-in" id="countdown-hud-screen">
          <div className="flex flex-col items-center justify-center bg-slate-900/90 border border-slate-800 px-8 py-10 rounded-2xl backdrop-blur-md shadow-2xl relative overflow-hidden max-w-sm w-full text-center select-none pointer-events-auto" id="countdown-card">
            
            {/* Top decorative hazard lines */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 via-cyan-400 to-purple-500"></div>
            
            <p className="text-cyan-400 font-bold uppercase text-[9px] tracking-widest animate-pulse mb-1">
              Initializing Pilot Neuro-Link...
            </p>
            <h3 className="text-slate-300 text-[10px] font-semibold tracking-wider uppercase mb-8 font-sans">
              STAND READY IN CONSOLE HARNESS
            </h3>

            {/* Pulsing countdown number */}
            <div className="relative w-32 h-32 flex items-center justify-center rounded-full bg-slate-950 border-2 border-dashed border-cyan-500/20 shadow-[0_0_25px_rgba(6,182,212,0.1)]" id="countdown-inner-ring">
              {/* Spinning tech progress decorative indicator */}
              <div className="absolute inset-2 rounded-full border border-pink-500/10 animate-[spin_5s_linear_infinite]"></div>
              
              {/* Pulsing visual glow card */}
              <span className="font-mono text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-tr from-cyan-400 via-pink-400 to-purple-400 drop-shadow-[0_0_15px_rgba(236,72,153,0.3)] animate-ping absolute leading-none select-none">
                {countdownVal}
              </span>
              <span className="font-mono text-7xl font-extrabold text-white leading-none z-10 select-none">
                {countdownVal}
              </span>
            </div>

            {/* Dynamic coaching advice texts */}
            <div className="mt-8 min-h-[40px] flex items-center justify-center" id="countdown-coaching-tips">
              {countdownVal === 5 && (
                <p className="text-[11px] text-slate-400 animate-pulse font-medium">Core motor sync active</p>
              )}
              {countdownVal === 4 && (
                <p className="text-[11px] text-slate-400 animate-pulse font-medium">Verify body tracking camera in preview</p>
              )}
              {countdownVal === 3 && (
                <p className="text-[11px] text-cyan-400 animate-pulse font-semibold">Lean side-to-side to test board tilt</p>
              )}
              {countdownVal === 2 && (
                <p className="text-[11px] text-cyan-400 animate-pulse font-semibold animate-bounce">Lean Left / Right to shift lanes</p>
              )}
              {countdownVal === 1 && (
                <p className="text-[11px] text-pink-400 font-bold animate-pulse uppercase tracking-wider">Ready for jump / slide thrusts</p>
              )}
              {countdownVal === 0 && (
                <p className="text-[11px] text-emerald-400 font-black animate-ping uppercase tracking-widest">START RUNNER!</p>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
