// The scene's one fragment shader, assembled in dependency order. quality sets the fbm octaves.
import { HEADER, COMMON } from './common.js';
import { INK } from './ink.js';
import { GLACIER } from './glacier.js';
import { SIGNAL } from './signal.js';
import { FOLIO } from './folio.js';
import { CHROME } from './chrome.js';
import { HOUSE } from './house.js';
import { HANDOFFS } from './handoffs.js';
import { OPENS, MAIN } from './opens.js';

export const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export function fragment(quality = 5) {
  return [HEADER, `#define Q ${quality | 0}`, COMMON, INK, GLACIER, SIGNAL, FOLIO, CHROME, HOUSE, HANDOFFS, OPENS, MAIN].join('\n');
}
