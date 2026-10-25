import type { Router } from 'express';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { openApiSpec } from '../../src/openapi/spec.js';
import { authRouter } from '../../src/modules/auth/auth.routes.js';
import { curriculumRouter } from '../../src/modules/curriculum/curriculum.routes.js';
import { healthRouter } from '../../src/modules/health/health.routes.js';
import { HealthService } from '../../src/modules/health/health.service.js';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/**
 * The OpenAPI document is the public route list. This compares it to the
 * routers the process actually mounts, so a new route cannot ship undocumented
 * and a removed route cannot stay in the document.
 */
describe('OpenAPI routes', () => {
  it('lists the same methods and paths the routers register', () => {
    const fromCode = registeredOperations();
    const fromSpec = specOperations();
    expect(fromSpec.filter((item) => !fromCode.includes(item))).toEqual([]);
    expect(fromCode.filter((item) => !fromSpec.includes(item))).toEqual([]);
  });
});

function registeredOperations(): string[] {
  const health = healthRouter(
    new HealthService({ query: () => Promise.resolve([{ ok: 1 }]) }, pino({ level: 'silent' })),
  );
  const auth = authRouter({} as never, {} as never, {} as never);
  const curriculum = curriculumRouter(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    5 * 1024 * 1024,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const operations = [
    ...walk(health, '/api/v1/health'),
    ...walk(auth, '/api/v1/auth'),
    ...walk(curriculum, '/api/v1'),
  ];
  return [...new Set(operations)].sort();
}

function specOperations(): string[] {
  const paths = openApiSpec.paths as Record<string, Record<string, unknown>>;
  const operations: string[] = [];
  for (const [path, item] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      if (item[method] !== undefined) operations.push(`${method.toUpperCase()} ${path}`);
    }
  }
  return operations.sort();
}

function walk(router: Router, prefix: string): string[] {
  const found: string[] = [];
  const stack = (router as unknown as { stack: Layer[] }).stack;
  for (const layer of stack) {
    if (layer.route) {
      const path = toOpenApiPath(joinPath(prefix, layer.route.path));
      for (const method of HTTP_METHODS) {
        if (layer.route.methods[method]) found.push(`${method.toUpperCase()} ${path}`);
      }
      continue;
    }
    const nested = layer.handle as { stack?: Layer[] } | undefined;
    if (nested && Array.isArray(nested.stack)) {
      found.push(...walk(nested as unknown as Router, joinPath(prefix, mountPath(layer))));
    }
  }
  return found;
}

function joinPath(prefix: string, path: string): string {
  if (path === '' || path === '/') return prefix || '/';
  const left = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  const right = path.startsWith('/') ? path : `/${path}`;
  return `${left}${right}`;
}

function mountPath(layer: Layer): string {
  if (typeof layer.path === 'string') return layer.path;
  const source = layer.regexp.source
    .replace('\\/?', '')
    .replace('(?=\\/|$)', '')
    .replace(/\\\//g, '/')
    .replace(/^\^/, '')
    .replace(/\$$/, '');
  return source.startsWith('/') ? source : '';
}

function toOpenApiPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

interface Layer {
  path?: string;
  regexp: RegExp;
  handle: unknown;
  route?: { path: string; methods: Record<string, boolean> };
}
