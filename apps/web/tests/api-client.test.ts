import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  __resetRefreshState,
  api,
  apiRequestPage,
  configureAuthBridge,
  refreshSession,
} from '@/lib/api-client';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

function success<T>(data: T, extra: Record<string, unknown> = {}) {
  return { success: true, data, message: 'OK', ...extra };
}

function failure(code: string, message: string, details?: Record<string, unknown>) {
  return { success: false, data: null, message, error: { code, details } };
}

describe('api-client', () => {
  let token: string | null;

  beforeEach(() => {
    __resetRefreshState();
    token = 'access-1';
    configureAuthBridge(
      () => token,
      (next) => {
        token = next;
      },
    );
  });

  it('unwraps the success envelope and sends the bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, success({ id: 'p1' })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get<{ id: string }>('/packages/p1')).resolves.toEqual({ id: 'p1' });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/packages/p1');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer access-1');
    // The refresh cookie must ride along on every call.
    expect(init.credentials).toBe('include');
  });

  it('serialises a JSON body and sets Content-Type only when there is one', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, success(null)));
    vi.stubGlobal('fetch', fetchMock);

    await api.post('/auth/login', { email: 'a@b.com', password: 'x' });
    const [, postInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(postInit.body).toBe(JSON.stringify({ email: 'a@b.com', password: 'x' }));
    expect((postInit.headers as Record<string, string>)['Content-Type']).toBe('application/json');

    await api.get('/packages');
    const [, getInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(getInit.body).toBeUndefined();
    expect((getInit.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('throws a typed ApiError carrying code, status and field details', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(400, failure('BAD_REQUEST', 'Request validation failed.', {
            fields: ['email must be an email'],
          })),
        ),
    );

    const error = await api.post('/auth/register', {}).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error as ApiError).toMatchObject({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'Request validation failed.',
    });
    expect((error as ApiError).fieldErrors).toEqual(['email must be an email']);
  });

  it('surfaces a network failure as ApiError instead of a raw TypeError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const error = await api.get('/packages').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('NETWORK_ERROR');
    expect((error as ApiError).status).toBe(0);
  });

  it('refreshes once on 401 and replays the original request', async () => {
    const fetchMock = vi
      .fn()
      // 1. original request rejected
      .mockResolvedValueOnce(jsonResponse(401, failure('UNAUTHORIZED', 'Expired')))
      // 2. refresh succeeds
      .mockResolvedValueOnce(jsonResponse(200, success({ accessToken: 'access-2' })))
      // 3. replay succeeds
      .mockResolvedValueOnce(jsonResponse(200, success({ id: 'me' })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get<{ id: string }>('/users/me')).resolves.toEqual({ id: 'me' });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toContain('/auth/refresh');
    const replayInit = fetchMock.mock.calls[2][1] as RequestInit;
    expect((replayInit.headers as Record<string, string>).Authorization).toBe('Bearer access-2');
    expect(token).toBe('access-2');
  });

  it('gives up after one refresh so a dead session cannot loop', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, failure('UNAUTHORIZED', 'Expired')))
      .mockResolvedValueOnce(jsonResponse(401, failure('AUTH_REFRESH_INVALID', 'Gone')));
    vi.stubGlobal('fetch', fetchMock);

    const error = await api.get('/users/me').catch((caught: unknown) => caught);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((error as ApiError).status).toBe(401);
    expect(token).toBeNull();
  });

  it('single-flights concurrent refreshes into one network call', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, success({ accessToken: 'access-shared' })));
    vi.stubGlobal('fetch', fetchMock);

    const results = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results).toEqual(['access-shared', 'access-shared', 'access-shared']);
  });

  it('returns items plus pagination meta for a paged request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          200,
          success([{ id: 'a' }, { id: 'b' }], {
            meta: { page: 2, limit: 20, total: 41, totalPages: 3 },
          }),
        ),
      ),
    );

    await expect(apiRequestPage<{ id: string }>('/packages?page=2')).resolves.toEqual({
      items: [{ id: 'a' }, { id: 'b' }],
      meta: { page: 2, limit: 20, total: 41, totalPages: 3 },
    });
  });

  it('omits the Authorization header when there is no token', async () => {
    token = null;
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, success(null)));
    vi.stubGlobal('fetch', fetchMock);

    await api.get('/packages');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});
