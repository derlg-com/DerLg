import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { RequestIdMiddleware } from './request-id.middleware';

import type { NextFunction, Request, Response } from 'express';

describe('RequestIdMiddleware', () => {
  const middleware = new RequestIdMiddleware();

  function run(incoming?: string) {
    const headers: Record<string, string | undefined> = {};
    if (incoming !== undefined) {
      headers['x-request-id'] = incoming;
    }
    const setHeader = jest.fn();
    const next = jest.fn();

    const req = {
      headers,
      header: (name: string) => headers[name.toLowerCase()],
    } as unknown as Request;

    middleware.use(req, { setHeader } as unknown as Response, next as unknown as NextFunction);

    return { headers, setHeader, next };
  }

  it('generates a uuid when the caller sends none', () => {
    const { headers, setHeader, next } = run();

    expect(headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(setHeader).toHaveBeenCalledWith('x-request-id', headers['x-request-id']);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('reuses a caller-supplied id so traces stitch together', () => {
    const { headers } = run('trace-abc');

    expect(headers['x-request-id']).toBe('trace-abc');
  });

  it('rejects an absurdly long id to avoid unbounded log keys', () => {
    const { headers } = run('x'.repeat(500));

    expect(headers['x-request-id']).not.toBe('x'.repeat(500));
    expect(headers['x-request-id']).toHaveLength(36);
  });
});

describe('PaginationQueryDto', () => {
  it('defaults to page 1 with 20 items and no skip', () => {
    const dto = new PaginationQueryDto();

    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.skip).toBe(0);
  });

  it('computes skip from page and limit', () => {
    const dto = new PaginationQueryDto();
    dto.page = 4;
    dto.limit = 25;

    expect(dto.skip).toBe(75);
  });
});
