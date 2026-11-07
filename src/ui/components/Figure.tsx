import React, { useEffect, useRef, useState } from 'react';
import type { Pose } from '../../engine/types';

/**
 * Original stick-figure demonstrations, drawn from joint positions. Not photos of anyone; the point
 * is the shape of the movement with the key cue arrow. Each pose lists: head, neck, hip, knee, foot
 * (one or two legs), elbow, hand (one or two arms), plus an optional prop (chair, wall, step, floor).
 * A pose with a second frame (`to`) animates between the two, back and forth, so the picture shows
 * the motion and not a snapshot. Holds stay still. Reduced-motion settings get the first frame.
 */
type P = [number, number];
interface Frame {
  head: P; neck: P; hip: P;
  legs: Array<{ knee: P; foot: P }>;
  arms: Array<{ elbow: P; hand: P }>;
}
interface Joints extends Frame {
  prop?: 'chair' | 'wall' | 'step' | 'floor' | 'dumbbell';
  arrow?: { from: P; to: P };
  caption?: string;
  /** Second frame of the movement. Same number of legs and arms as the first. */
  to?: Frame;
  /** Seconds for one way of the movement (default 0.9). */
  secs?: number;
}

const POSES: Record<Pose, Joints> = {
  press: { head: [50, 16], neck: [50, 26], hip: [50, 56], legs: [{ knee: [46, 74], foot: [44, 92] }, { knee: [56, 74], foot: [58, 92] }], arms: [{ elbow: [36, 30], hand: [40, 20] }, { elbow: [64, 30], hand: [60, 20] }], prop: 'floor', arrow: { from: [50, 18], to: [50, 4] }, caption: 'Press straight up, ribs down, glutes tight', to: { head: [50, 16], neck: [50, 26], hip: [50, 56], legs: [{ knee: [46, 74], foot: [44, 92] }, { knee: [56, 74], foot: [58, 92] }], arms: [{ elbow: [42, 12], hand: [44, 0] }, { elbow: [58, 12], hand: [56, 0] }] }, secs: 1.4 },
  chestpress: { head: [44, 16], neck: [46, 26], hip: [52, 56], legs: [{ knee: [48, 74], foot: [42, 92] }, { knee: [62, 72], foot: [70, 90] }], arms: [{ elbow: [36, 34], hand: [54, 32] }, { elbow: [40, 36], hand: [56, 34] }], prop: 'floor', arrow: { from: [60, 32], to: [80, 32] }, caption: 'Press out slow, pull back slower, never rest it on the chest', to: { head: [44, 16], neck: [46, 26], hip: [52, 56], legs: [{ knee: [48, 74], foot: [42, 92] }, { knee: [62, 72], foot: [70, 90] }], arms: [{ elbow: [60, 30], hand: [82, 30] }, { elbow: [62, 32], hand: [84, 32] }] }, secs: 1.4 },
  triceps: { head: [50, 16], neck: [50, 26], hip: [50, 56], legs: [{ knee: [46, 74], foot: [44, 92] }, { knee: [56, 74], foot: [58, 92] }], arms: [{ elbow: [40, 14], hand: [46, 26] }, { elbow: [60, 14], hand: [54, 26] }], prop: 'floor', arrow: { from: [50, 12], to: [50, 0] }, caption: 'Elbows still, straighten all the way', to: { head: [50, 16], neck: [50, 26], hip: [50, 56], legs: [{ knee: [46, 74], foot: [44, 92] }, { knee: [56, 74], foot: [58, 92] }], arms: [{ elbow: [40, 14], hand: [42, 0] }, { elbow: [60, 14], hand: [58, 0] }] }, secs: 1.2 },
  pullapart: { head: [50, 16], neck: [50, 26], hip: [50, 56], legs: [{ knee: [46, 74], foot: [44, 92] }, { knee: [56, 74], foot: [58, 92] }], arms: [{ elbow: [38, 30], hand: [30, 30] }, { elbow: [62, 30], hand: [70, 30] }], prop: 'floor', arrow: { from: [72, 30], to: [92, 30] }, caption: 'Straight arms, squeeze the shoulder blades', to: { head: [50, 16], neck: [50, 26], hip: [50, 56], legs: [{ knee: [46, 74], foot: [44, 92] }, { knee: [56, 74], foot: [58, 92] }], arms: [{ elbow: [26, 30], hand: [6, 30] }, { elbow: [74, 30], hand: [94, 30] }] }, secs: 1.3 },
  deadlift: { head: [26, 40], neck: [34, 44], hip: [58, 54], legs: [{ knee: [58, 72], foot: [56, 92] }, { knee: [54, 72], foot: [50, 92] }], arms: [{ elbow: [38, 58], hand: [40, 72] }], prop: 'dumbbell', arrow: { from: [58, 54], to: [46, 44] }, caption: 'Flat back, bar close, push the floor away', to: { head: [50, 12], neck: [50, 22], hip: [50, 52], legs: [{ knee: [52, 72], foot: [56, 92] }, { knee: [48, 72], foot: [50, 92] }], arms: [{ elbow: [52, 40], hand: [52, 56] }] }, secs: 1.5 },
  candle: { head: [50, 14], neck: [50, 24], hip: [50, 54], legs: [{ knee: [46, 72], foot: [44, 90] }, { knee: [56, 72], foot: [58, 90] }], arms: [{ elbow: [40, 30], hand: [42, 20] }, { elbow: [60, 30], hand: [58, 20] }], prop: 'dumbbell', arrow: { from: [50, 20], to: [50, 4] }, caption: 'Slow: breathe in, brace, lift, stretch, return, breathe out', to: { head: [50, 10], neck: [50, 20], hip: [50, 54], legs: [{ knee: [46, 72], foot: [44, 90] }, { knee: [56, 72], foot: [58, 90] }], arms: [{ elbow: [44, 8], hand: [46, -2] }, { elbow: [56, 8], hand: [54, -2] }] }, secs: 2.2 },
  overhead: { head: [50, 10], neck: [50, 20], hip: [50, 52], legs: [{ knee: [48, 72], foot: [48, 90] }, { knee: [54, 72], foot: [54, 90] }], arms: [{ elbow: [44, 8], hand: [46, -2] }, { elbow: [56, 8], hand: [54, -2] }], prop: 'dumbbell', caption: 'Reach up, fold slowly from the hips', to: { head: [20, 46], neck: [28, 50], hip: [56, 56], legs: [{ knee: [56, 72], foot: [56, 90] }, { knee: [54, 72], foot: [52, 90] }], arms: [{ elbow: [22, 66], hand: [20, 82] }, { elbow: [24, 66], hand: [22, 82] }] }, secs: 2.2 },
  sidebend: { head: [50, 12], neck: [50, 22], hip: [50, 54], legs: [{ knee: [46, 72], foot: [44, 90] }, { knee: [56, 72], foot: [58, 90] }], arms: [{ elbow: [44, 10], hand: [46, 0] }, { elbow: [56, 10], hand: [54, 0] }], prop: 'dumbbell', caption: 'Long to one side, hips still', to: { head: [32, 18], neck: [36, 26], hip: [50, 54], legs: [{ knee: [46, 72], foot: [44, 90] }, { knee: [56, 72], foot: [58, 90] }], arms: [{ elbow: [26, 14], hand: [22, 6] }, { elbow: [38, 14], hand: [34, 6] }] }, secs: 2 },
  twist: { head: [50, 14], neck: [50, 24], hip: [50, 54], legs: [{ knee: [44, 72], foot: [42, 90] }, { knee: [56, 72], foot: [58, 90] }], arms: [{ elbow: [40, 34], hand: [58, 32] }, { elbow: [60, 34], hand: [44, 36] }], prop: 'floor', caption: 'Turn slowly, hips quiet, eyes follow', to: { head: [50, 14], neck: [50, 24], hip: [50, 54], legs: [{ knee: [44, 72], foot: [42, 90] }, { knee: [56, 72], foot: [58, 90] }], arms: [{ elbow: [60, 34], hand: [42, 32] }, { elbow: [40, 34], hand: [56, 36] }] }, secs: 2 },
  squathold: { head: [50, 14], neck: [50, 24], hip: [50, 54], legs: [{ knee: [46, 72], foot: [44, 90] }, { knee: [56, 72], foot: [58, 90] }], arms: [{ elbow: [40, 30], hand: [42, 20] }, { elbow: [60, 30], hand: [58, 20] }], prop: 'dumbbell', caption: 'Slow all the way down, slow all the way up', to: { head: [50, 34], neck: [50, 44], hip: [44, 70], legs: [{ knee: [62, 78], foot: [58, 90] }, { knee: [56, 80], foot: [50, 92] }], arms: [{ elbow: [40, 48], hand: [42, 38] }, { elbow: [60, 48], hand: [58, 38] }] }, secs: 2.4 },
  lunge: { head: [50, 16], neck: [50, 26], hip: [50, 56], legs: [{ knee: [68, 66], foot: [68, 90] }, { knee: [40, 80], foot: [26, 90] }], arms: [{ elbow: [38, 40], hand: [32, 50] }], prop: 'floor', arrow: { from: [50, 56], to: [58, 60] }, caption: 'Tailbone under, squeeze the back glute', to: { head: [54, 16], neck: [54, 26], hip: [54, 56], legs: [{ knee: [70, 64], foot: [68, 90] }, { knee: [42, 80], foot: [26, 90] }], arms: [{ elbow: [44, 10], hand: [48, 0] }] }, secs: 1.6 },
  childpose: { head: [14, 70], neck: [22, 66], hip: [60, 62], legs: [{ knee: [74, 76], foot: [90, 80] }], arms: [{ elbow: [10, 78], hand: [2, 82] }], prop: 'floor', caption: 'Hips to heels, arms long, breathe into the back' },
  downdog: { head: [22, 64], neck: [30, 56], hip: [56, 30], legs: [{ knee: [66, 54], foot: [78, 84] }], arms: [{ elbow: [22, 68], hand: [14, 84] }], prop: 'floor', arrow: { from: [56, 30], to: [62, 20] }, caption: 'Push the floor away, hips to the ceiling', to: { head: [22, 64], neck: [30, 56], hip: [56, 30], legs: [{ knee: [68, 56], foot: [78, 80] }], arms: [{ elbow: [22, 68], hand: [14, 84] }] }, secs: 1.6 },
  cobra: { head: [16, 46], neck: [26, 54], hip: [56, 76], legs: [{ knee: [72, 78], foot: [92, 80] }], arms: [{ elbow: [34, 74], hand: [34, 86] }], prop: 'floor', arrow: { from: [20, 50], to: [20, 36] }, caption: 'Chest up, hips stay down, elbows soft' },
  squat: { head: [50, 22], neck: [50, 32], hip: [44, 58], legs: [{ knee: [62, 66], foot: [58, 90] }, { knee: [56, 68], foot: [50, 92] }], arms: [{ elbow: [62, 40], hand: [78, 40] }], prop: 'floor', arrow: { from: [44, 58], to: [38, 70] }, caption: 'Hips back and down, heels down' , to: { head: [50, 12], neck: [50, 22], hip: [50, 52], legs: [{ knee: [56, 72], foot: [58, 90] }, { knee: [46, 72], foot: [50, 92] }], arms: [{ elbow: [58, 36], hand: [66, 46] }] } },
  chairsquat: { head: [52, 22], neck: [52, 32], hip: [44, 58], legs: [{ knee: [62, 64], foot: [60, 90] }], arms: [{ elbow: [64, 40], hand: [78, 38] }], prop: 'chair', arrow: { from: [44, 58], to: [38, 66] }, caption: 'Tap the seat, do not sit' , to: { head: [52, 12], neck: [52, 22], hip: [52, 52], legs: [{ knee: [58, 72], foot: [60, 90] }], arms: [{ elbow: [62, 38], hand: [72, 48] }] } },
  splitsquat: { head: [50, 18], neck: [50, 28], hip: [50, 56], legs: [{ knee: [68, 66], foot: [68, 90] }, { knee: [40, 80], foot: [26, 90] }], arms: [{ elbow: [40, 40], hand: [30, 52] }], prop: 'floor', arrow: { from: [50, 56], to: [50, 70] }, caption: 'Straight down like an elevator' , to: { head: [50, 10], neck: [50, 20], hip: [50, 46], legs: [{ knee: [62, 66], foot: [68, 90] }, { knee: [38, 68], foot: [26, 90] }], arms: [{ elbow: [40, 34], hand: [32, 46] }] } },
  bridge: { head: [16, 78], neck: [26, 76], hip: [52, 60], legs: [{ knee: [68, 56], foot: [76, 88] }], arms: [{ elbow: [34, 84], hand: [44, 88] }], prop: 'floor', arrow: { from: [52, 60], to: [52, 46] }, caption: 'Push through the heels, squeeze' , to: { head: [16, 78], neck: [26, 76], hip: [52, 74], legs: [{ knee: [68, 60], foot: [76, 88] }], arms: [{ elbow: [34, 84], hand: [44, 88] }] } },
  calfraise: { head: [50, 14], neck: [50, 24], hip: [50, 54], legs: [{ knee: [50, 70], foot: [52, 84] }], arms: [{ elbow: [62, 36], hand: [78, 34] }], prop: 'wall', arrow: { from: [52, 90], to: [52, 78] }, caption: 'Up tall, down slow' , to: { head: [50, 20], neck: [50, 30], hip: [50, 60], legs: [{ knee: [50, 74], foot: [52, 90] }], arms: [{ elbow: [62, 42], hand: [78, 40] }] } },
  wallpush: { head: [40, 24], neck: [44, 33], hip: [52, 58], legs: [{ knee: [56, 74], foot: [60, 90] }], arms: [{ elbow: [62, 36], hand: [76, 40] }], prop: 'wall', caption: 'Straight line, chest to the wall' , to: { head: [34, 28], neck: [38, 36], hip: [50, 60], legs: [{ knee: [56, 75], foot: [60, 90] }], arms: [{ elbow: [56, 46], hand: [76, 40] }] } },
  inclinepush: { head: [28, 36], neck: [36, 42], hip: [60, 60], legs: [{ knee: [72, 72], foot: [86, 88] }], arms: [{ elbow: [42, 56], hand: [48, 66] }], prop: 'chair', caption: 'Hands on the seat, body straight' , to: { head: [20, 44], neck: [30, 48], hip: [58, 62], legs: [{ knee: [72, 73], foot: [86, 88] }], arms: [{ elbow: [36, 66], hand: [48, 66] }] } },
  pushup: { head: [14, 62], neck: [24, 66], hip: [52, 70], legs: [{ knee: [70, 73], foot: [88, 78] }], arms: [{ elbow: [30, 80], hand: [36, 90] }], prop: 'floor', caption: 'Plank the whole way' , to: { head: [14, 74], neck: [24, 76], hip: [52, 78], legs: [{ knee: [70, 79], foot: [88, 82] }], arms: [{ elbow: [22, 88], hand: [36, 90] }] } },
  row: { head: [28, 36], neck: [36, 42], hip: [62, 48], legs: [{ knee: [66, 66], foot: [66, 88] }, { knee: [78, 60], foot: [84, 72] }], arms: [{ elbow: [42, 60], hand: [38, 76] }, { elbow: [36, 48], hand: [34, 64] }], prop: 'dumbbell', arrow: { from: [38, 76], to: [40, 58] }, caption: 'Elbow to the back pocket' , to: { head: [28, 36], neck: [36, 42], hip: [62, 48], legs: [{ knee: [66, 66], foot: [66, 88] }, { knee: [78, 60], foot: [84, 72] }], arms: [{ elbow: [46, 44], hand: [40, 56] }, { elbow: [36, 48], hand: [34, 64] }] } },
  curl: { head: [50, 14], neck: [50, 24], hip: [50, 54], legs: [{ knee: [46, 72], foot: [44, 90] }, { knee: [56, 72], foot: [58, 90] }], arms: [{ elbow: [62, 42], hand: [64, 28] }], prop: 'dumbbell', arrow: { from: [66, 52], to: [66, 30] }, caption: 'Elbow stays by the side' , to: { head: [50, 14], neck: [50, 24], hip: [50, 54], legs: [{ knee: [46, 72], foot: [44, 90] }, { knee: [56, 72], foot: [58, 90] }], arms: [{ elbow: [62, 42], hand: [66, 58] }] } },
  scap: { head: [50, 14], neck: [50, 24], hip: [50, 54], legs: [{ knee: [50, 72], foot: [50, 90] }], arms: [{ elbow: [34, 26], hand: [34, 10] }, { elbow: [66, 26], hand: [66, 10] }], prop: 'wall', arrow: { from: [66, 14], to: [66, 4] }, caption: 'Slide up, keep contact' , to: { head: [50, 14], neck: [50, 24], hip: [50, 54], legs: [{ knee: [50, 72], foot: [50, 90] }], arms: [{ elbow: [34, 34], hand: [34, 22] }, { elbow: [66, 34], hand: [66, 22] }] } },
  deadbug: { head: [14, 70], neck: [24, 70], hip: [50, 70], legs: [{ knee: [60, 56], foot: [78, 56] }, { knee: [58, 54], foot: [60, 38] }], arms: [{ elbow: [30, 54], hand: [36, 40] }, { elbow: [20, 58], hand: [8, 52] }], prop: 'floor', caption: 'Low back flat on the floor' , to: { head: [14, 70], neck: [24, 70], hip: [50, 70], legs: [{ knee: [60, 56], foot: [60, 40] }, { knee: [58, 54], foot: [60, 38] }], arms: [{ elbow: [30, 54], hand: [36, 40] }, { elbow: [30, 54], hand: [36, 40] }] } },
  birddog: { head: [16, 46], neck: [26, 50], hip: [58, 50], legs: [{ knee: [62, 70], foot: [62, 88] }, { knee: [76, 48], foot: [92, 46] }], arms: [{ elbow: [30, 68], hand: [30, 88] }, { elbow: [14, 44], hand: [2, 42] }], prop: 'floor', caption: 'Reach long, back flat' , to: { head: [16, 46], neck: [26, 50], hip: [58, 50], legs: [{ knee: [62, 70], foot: [62, 88] }, { knee: [66, 66], foot: [66, 84] }], arms: [{ elbow: [30, 68], hand: [30, 88] }, { elbow: [26, 68], hand: [26, 86] }] } },
  sideplank: { head: [14, 52], neck: [24, 58], hip: [52, 66], legs: [{ knee: [70, 72], foot: [88, 78] }], arms: [{ elbow: [26, 88], hand: [20, 88] }, { elbow: [30, 48], hand: [34, 30] }], prop: 'floor', arrow: { from: [52, 76], to: [52, 60] }, caption: 'Hips up, long line' },
  plank: { head: [14, 60], neck: [24, 64], hip: [52, 68], legs: [{ knee: [70, 71], foot: [88, 76] }], arms: [{ elbow: [26, 86], hand: [34, 88] }], prop: 'floor', caption: 'Belly tight, glutes tight' },
  curlup: { head: [24, 62], neck: [32, 66], hip: [56, 74], legs: [{ knee: [66, 56], foot: [78, 82] }, { knee: [72, 74], foot: [92, 76] }], arms: [{ elbow: [44, 80], hand: [52, 86] }], prop: 'floor', caption: 'Small lift, no neck pull' , to: { head: [16, 70], neck: [26, 72], hip: [56, 74], legs: [{ knee: [66, 56], foot: [78, 82] }, { knee: [72, 74], foot: [92, 76] }], arms: [{ elbow: [40, 82], hand: [50, 86] }] } },
  rotation: { head: [50, 14], neck: [50, 24], hip: [50, 54], legs: [{ knee: [44, 72], foot: [42, 90] }, { knee: [56, 72], foot: [58, 90] }], arms: [{ elbow: [40, 34], hand: [60, 30] }, { elbow: [60, 34], hand: [42, 36] }], arrow: { from: [36, 30], to: [20, 36] }, caption: 'Turn the chest, hips still' , to: { head: [50, 14], neck: [50, 24], hip: [50, 54], legs: [{ knee: [44, 72], foot: [42, 90] }, { knee: [56, 72], foot: [58, 90] }], arms: [{ elbow: [60, 34], hand: [40, 30] }, { elbow: [40, 34], hand: [58, 36] }] } },
  antirotation: { head: [50, 16], neck: [50, 26], hip: [50, 56], legs: [{ knee: [66, 64], foot: [66, 88] }, { knee: [40, 80], foot: [26, 88] }], arms: [{ elbow: [62, 36], hand: [80, 34] }], prop: 'floor', caption: 'Press out, hold square' },
  balance: { head: [50, 12], neck: [50, 22], hip: [50, 52], legs: [{ knee: [50, 70], foot: [50, 90] }, { knee: [62, 58], foot: [60, 74] }], arms: [{ elbow: [38, 36], hand: [32, 44] }, { elbow: [62, 36], hand: [68, 44] }], caption: 'Eyes on one spot, tall' },
  ankle: { head: [48, 16], neck: [48, 26], hip: [48, 56], legs: [{ knee: [66, 66], foot: [64, 90] }, { knee: [40, 76], foot: [30, 90] }], arms: [{ elbow: [62, 40], hand: [78, 44] }], prop: 'wall', arrow: { from: [66, 66], to: [78, 66] }, caption: 'Knee to the wall, heel down' , to: { head: [54, 16], neck: [54, 26], hip: [54, 56], legs: [{ knee: [78, 64], foot: [64, 90] }, { knee: [44, 76], foot: [30, 90] }], arms: [{ elbow: [66, 40], hand: [78, 44] }] } },
  hip: { head: [50, 16], neck: [50, 26], hip: [50, 56], legs: [{ knee: [66, 64], foot: [66, 88] }, { knee: [40, 80], foot: [26, 88] }], arms: [{ elbow: [40, 40], hand: [36, 52] }], prop: 'floor', arrow: { from: [50, 56], to: [60, 56] }, caption: 'Squeeze the back glute, shift forward' },
  thoracic: { head: [20, 50], neck: [30, 52], hip: [56, 60], legs: [{ knee: [66, 44], foot: [84, 48] }], arms: [{ elbow: [34, 68], hand: [40, 86] }, { elbow: [36, 36], hand: [44, 18] }], prop: 'floor', arrow: { from: [44, 18], to: [60, 14] }, caption: 'Open like a book, knees together' , to: { head: [20, 50], neck: [30, 52], hip: [56, 60], legs: [{ knee: [66, 44], foot: [84, 48] }], arms: [{ elbow: [34, 68], hand: [40, 86] }, { elbow: [36, 36], hand: [44, 20] }] } },
  hamstring: { head: [18, 42], neck: [26, 48], hip: [50, 74], legs: [{ knee: [70, 74], foot: [92, 74] }, { knee: [60, 60], foot: [64, 74] }], arms: [{ elbow: [42, 62], hand: [60, 66] }], prop: 'floor', caption: 'Long back, mild stretch' },
  shoulder: { head: [50, 14], neck: [50, 24], hip: [50, 54], legs: [{ knee: [46, 72], foot: [44, 90] }, { knee: [56, 72], foot: [58, 90] }], arms: [{ elbow: [62, 10], hand: [56, 2] }, { elbow: [40, 44], hand: [48, 36] }], caption: 'Reach over and behind, gently' },
  breathe: { head: [14, 60], neck: [24, 62], hip: [52, 66], legs: [{ knee: [66, 52], foot: [80, 80] }], arms: [{ elbow: [34, 72], hand: [44, 60] }], prop: 'floor', caption: 'Belly rises on the breath in' , to: { head: [14, 60], neck: [24, 62], hip: [52, 66], legs: [{ knee: [66, 52], foot: [80, 80] }], arms: [{ elbow: [34, 70], hand: [44, 56] }] }, secs: 1.8 },
  catcow: { head: [16, 54], neck: [26, 54], hip: [58, 50], legs: [{ knee: [62, 70], foot: [62, 88] }], arms: [{ elbow: [30, 70], hand: [30, 88] }], prop: 'floor', arrow: { from: [42, 44], to: [42, 32] }, caption: 'Round up, then let the belly drop' , to: { head: [16, 60], neck: [26, 58], hip: [58, 54], legs: [{ knee: [62, 70], foot: [62, 88] }], arms: [{ elbow: [30, 70], hand: [30, 88] }] } },
  march: { head: [50, 12], neck: [50, 22], hip: [50, 52], legs: [{ knee: [50, 70], foot: [50, 90] }, { knee: [64, 52], foot: [62, 68] }], arms: [{ elbow: [38, 32], hand: [34, 20] }, { elbow: [60, 40], hand: [66, 50] }], caption: 'Knee up, opposite arm up' , to: { head: [50, 12], neck: [50, 22], hip: [50, 52], legs: [{ knee: [36, 52], foot: [38, 68] }, { knee: [50, 70], foot: [50, 90] }], arms: [{ elbow: [40, 40], hand: [34, 50] }, { elbow: [62, 32], hand: [66, 20] }] } },
  walk: { head: [50, 12], neck: [50, 22], hip: [50, 52], legs: [{ knee: [56, 70], foot: [60, 90] }, { knee: [44, 70], foot: [40, 90] }], arms: [{ elbow: [44, 38], hand: [42, 50] }, { elbow: [56, 38], hand: [58, 50] }], caption: 'Walk it out' , to: { head: [50, 12], neck: [50, 22], hip: [50, 52], legs: [{ knee: [44, 70], foot: [40, 90] }, { knee: [56, 70], foot: [60, 90] }], arms: [{ elbow: [56, 38], hand: [58, 50] }, { elbow: [44, 38], hand: [42, 50] }] } },
  latlunge: { head: [44, 24], neck: [46, 34], hip: [38, 62], legs: [{ knee: [30, 72], foot: [24, 90] }, { knee: [56, 74], foot: [80, 90] }], arms: [{ elbow: [56, 46], hand: [64, 54] }], prop: 'floor', arrow: { from: [38, 62], to: [26, 62] }, caption: 'Sit back over one foot, other leg straight' , to: { head: [50, 14], neck: [50, 24], hip: [50, 54], legs: [{ knee: [46, 72], foot: [44, 90] }, { knee: [56, 72], foot: [58, 90] }], arms: [{ elbow: [60, 40], hand: [62, 52] }] } },
  hinge: { head: [22, 42], neck: [30, 46], hip: [56, 56], legs: [{ knee: [58, 72], foot: [58, 90] }, { knee: [54, 72], foot: [52, 90] }], arms: [{ elbow: [34, 58], hand: [30, 70] }], prop: 'floor', arrow: { from: [56, 56], to: [70, 56] }, caption: 'Hips back, back flat, hands out front' , to: { head: [50, 12], neck: [50, 22], hip: [50, 52], legs: [{ knee: [52, 72], foot: [54, 90] }, { knee: [48, 72], foot: [48, 90] }], arms: [{ elbow: [56, 38], hand: [58, 50] }] } },
  ninety: { head: [50, 30], neck: [50, 40], hip: [50, 70], legs: [{ knee: [74, 72], foot: [74, 90] }, { knee: [28, 72], foot: [10, 76] }], arms: [{ elbow: [40, 54], hand: [34, 66] }, { elbow: [60, 54], hand: [66, 66] }], prop: 'floor', arrow: { from: [74, 72], to: [84, 60] }, caption: 'Sit tall, swing both knees to the other side' , to: { head: [50, 30], neck: [50, 40], hip: [50, 70], legs: [{ knee: [72, 72], foot: [90, 76] }, { knee: [26, 72], foot: [26, 90] }], arms: [{ elbow: [40, 54], hand: [34, 66] }, { elbow: [60, 54], hand: [66, 66] }] }, secs: 1.4 },
};

function Prop({ kind }: { kind?: Joints['prop'] }) {
  switch (kind) {
    case 'chair': return <g stroke="currentColor" strokeWidth="2" opacity=".45" fill="none"><rect x="60" y="60" width="26" height="4" rx="1" /><path d="M64 64v26M82 64v26M82 60V40" /></g>;
    case 'wall': return <g stroke="currentColor" strokeWidth="2" opacity=".45" fill="none"><path d="M86 4v88" /></g>;
    case 'step': return <g stroke="currentColor" strokeWidth="2" opacity=".45" fill="none"><rect x="56" y="70" width="34" height="20" rx="2" /></g>;
    case 'dumbbell': return <g fill="currentColor" opacity=".55"><rect x="30" y="74" width="12" height="5" rx="2" /><rect x="58" y="24" width="12" height="5" rx="2" /></g>;
    case 'floor': return <g stroke="currentColor" strokeWidth="2" opacity=".35"><path d="M2 92h96" /></g>;
    default: return null;
  }
}

function lerp(a: P, b: P, t: number): P { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
function blend(a: Frame, b: Frame, t: number): Frame {
  return {
    head: lerp(a.head, b.head, t), neck: lerp(a.neck, b.neck, t), hip: lerp(a.hip, b.hip, t),
    legs: a.legs.map((l, i) => ({ knee: lerp(l.knee, (b.legs[i] ?? l).knee, t), foot: lerp(l.foot, (b.legs[i] ?? l).foot, t) })),
    arms: a.arms.map((x, i) => ({ elbow: lerp(x.elbow, (b.arms[i] ?? x).elbow, t), hand: lerp(x.hand, (b.arms[i] ?? x).hand, t) }))
  };
}
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Back-and-forth animation between two frames, with a short pause at each end. */
function useMotion(j: Joints): number {
  const [t, setT] = useState(0);
  const raf = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!j.to) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const half = (j.secs ?? 0.9) * 1000;
    const pause = 350;
    const period = 2 * (half + pause);
    const start = performance.now();
    const tick = (now: number) => {
      const x = (now - start) % period;
      let v: number;
      if (x < half) v = ease(x / half);
      else if (x < half + pause) v = 1;
      else if (x < 2 * half + pause) v = 1 - ease((x - half - pause) / half);
      else v = 0;
      setT(v);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [j]);
  return t;
}

export function Figure({ pose, caption = true }: { pose: Pose; caption?: boolean }) {
  const j = POSES[pose] ?? POSES.march;
  const t = useMotion(j);
  const f: Frame = j.to ? blend(j, j.to, t) : j;
  const pt = (p: P) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  return (
    <div className="figure" aria-label={`Illustration: ${j.caption ?? pose}`} role="img">
      <svg viewBox="0 0 100 96" xmlns="http://www.w3.org/2000/svg" style={{ color: 'var(--ink)' }}>
        <Prop kind={j.prop} />
        <g stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d={`M${pt(f.neck)} L${pt(f.hip)}`} />
          {f.legs.map((l, i) => <path key={'l' + i} d={`M${pt(f.hip)} L${pt(l.knee)} L${pt(l.foot)}`} />)}
          {f.arms.map((a, i) => <path key={'a' + i} d={`M${pt(f.neck)} L${pt(a.elbow)} L${pt(a.hand)}`} />)}
        </g>
        <circle cx={f.head[0]} cy={f.head[1]} r="6" fill="currentColor" />
        {j.arrow && (
          <g stroke="var(--accent-2)" strokeWidth="2.5" fill="var(--accent-2)" strokeLinecap="round">
            <path d={`M${pt(j.arrow.from)} L${pt(j.arrow.to)}`} />
            <circle cx={j.arrow.to[0]} cy={j.arrow.to[1]} r="2.6" stroke="none" />
          </g>
        )}
      </svg>
      {caption && j.caption && <div className="small muted center" style={{ marginTop: -4 }}>{j.caption}{j.to ? '' : ' (hold)'}</div>}
    </div>
  );
}
