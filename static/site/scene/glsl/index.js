// The scene's one fragment shader, assembled in dependency order. quality sets the fbm octaves.
import { HEADER, NOISE, COMMON } from './common.js';
import { FLIGHT, SEAM_TEX } from './flight.js';
import { INK } from './ink.js';
import { GLACIER } from './glacier.js';
import { COSMOS } from './cosmos.js';
import { FOLIO } from './folio.js';
import { DARKROOM } from './darkroom.js';
import { HOUSE } from './house.js';
import { SEAMS } from './seams.js';
import { REACH_LOOK } from './reach.js';
import { TRANSIT } from './transit.js';
import { OPENS, MAIN } from './opens.js';

export const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export function fragment(quality = 5) {
  return [HEADER, `#define Q ${quality | 0}`, NOISE, COMMON, FLIGHT, INK, GLACIER, COSMOS, FOLIO, DARKROOM, HOUSE, SEAMS, REACH_LOOK, SEAM_TEX, TRANSIT, OPENS, MAIN].join('\n');
}
