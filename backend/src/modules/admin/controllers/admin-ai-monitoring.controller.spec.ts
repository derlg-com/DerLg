import { NotFoundException } from '@nestjs/common';
import { AdminAIMonitoringController } from './admin-ai-monitoring.controller';
import { ListAiSessionsDto } from '../dto/list-ai-sessions.dto';

/**
 * Controller-level contract tests for the AI-session monitoring routes.
 *
 * Three things here are invisible to the service tests.
 *
 * First, the list handler must return the service result DIRECTLY so
 * `TransformInterceptor` wraps it as `{ success, data: { data, meta } }`. A
 * hand-built envelope with a sibling `meta` puts it outside `data`, and the admin
 * frontend's axios interceptor — which replaces the body with `body.data` —
 * discards pagination silently.
 *
 * Second, `onlyGuests` arrives as the string `'true'`, never a boolean, because
 * query params are always strings. The controller must forward the converted
 * `onlyGuestsBool`, not the raw value.
 *
 * Third, an expired Redis TTL is not an error. `getAISessionDetails` returning a
 * row with `expired: true` must still produce `success: true` — the earlier
 * behaviour returned `success: false` and hid the archived conversation from the
 * admin looking at it.
 */
describe('AdminAIMonitoringController', () => {
  let controller: AdminAIMonitoringController;
  let service: {
    listAISessions: jest.Mock;
    getAIAssistedBookings: jest.Mock;
    getAISessionDetails: jest.Mock;
    getAISessionTranscript: jest.Mock;
    getAIBookingSuccessRate: jest.Mock;
    getAIPerformanceMetrics: jest.Mock;
  };

  const PAGE = {
    data: [{ sessionId: 'sess-1' }],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  /** Builds a real DTO so `onlyGuestsBool` behaves as it does in production. */
  function query(fields: Partial<ListAiSessionsDto>): ListAiSessionsDto {
    return Object.assign(new ListAiSessionsDto(), fields);
  }

  beforeEach(() => {
    service = {
      listAISessions: jest.fn().mockResolvedValue(PAGE),
      getAIAssistedBookings: jest.fn().mockResolvedValue([{ id: 'bk-1' }]),
      getAISessionDetails: jest
        .fn()
        .mockResolvedValue({ sessionId: 'sess-1', expired: false }),
      getAISessionTranscript: jest
        .fn()
        .mockResolvedValue({ sessionId: 'sess-1', messages: [] }),
      getAIBookingSuccessRate: jest.fn().mockResolvedValue({ rate: 0.42 }),
      getAIPerformanceMetrics: jest.fn().mockResolvedValue({ p95Ms: 1200 }),
    };
    controller = new AdminAIMonitoringController(service as never);
  });

  describe('listAISessions', () => {
    it('should return the service result unwrapped so meta survives the interceptor', async () => {
      const result = await controller.listAISessions(query({}));

      expect(result).toEqual(PAGE);
      expect(result).not.toHaveProperty('success');
    });

    it('should convert the onlyGuests query string to a boolean', async () => {
      await controller.listAISessions(query({ onlyGuests: 'true' }));

      expect(service.listAISessions).toHaveBeenCalledWith(
        expect.objectContaining({ onlyGuests: true }),
      );
    });

    it('should treat a missing onlyGuests as false rather than undefined', async () => {
      await controller.listAISessions(query({}));

      expect(service.listAISessions).toHaveBeenCalledWith(
        expect.objectContaining({ onlyGuests: false }),
      );
    });

    it('should forward search, language and pagination', async () => {
      await controller.listAISessions(
        query({ search: 'angkor', language: 'ZH', page: 3, limit: 50 }),
      );

      expect(service.listAISessions).toHaveBeenCalledWith({
        search: 'angkor',
        language: 'ZH',
        onlyGuests: false,
        page: 3,
        limit: 50,
      });
    });
  });

  describe('getAISessionDetails', () => {
    it('should wrap a live session in the standard envelope', async () => {
      const result = await controller.getAISessionDetails('sess-1');

      expect(result).toEqual({
        success: true,
        data: { sessionId: 'sess-1', expired: false },
        message: 'ok',
        error: null,
      });
    });

    it('should report success for an expired session and label it in the message', async () => {
      service.getAISessionDetails.mockResolvedValue({
        sessionId: 'sess-1',
        expired: true,
        source: 'db',
      });

      const result = await controller.getAISessionDetails('sess-1');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Session archived (live state expired)');
    });

    it('should throw NotFound when the session exists nowhere', async () => {
      service.getAISessionDetails.mockResolvedValue(null);

      await expect(controller.getAISessionDetails('nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAISessionTranscript', () => {
    it('should return the archived transcript', async () => {
      const result = await controller.getAISessionTranscript('sess-1');

      expect(service.getAISessionTranscript).toHaveBeenCalledWith('sess-1');
      expect(result.data).toEqual({ sessionId: 'sess-1', messages: [] });
    });

    it('should throw NotFound naming the session when nothing was archived', async () => {
      service.getAISessionTranscript.mockResolvedValue(null);

      await expect(
        controller.getAISessionTranscript('sess-missing'),
      ).rejects.toThrow(
        new NotFoundException('Session sess-missing not found'),
      );
    });
  });

  describe('date-range routes', () => {
    it('should forward the snake_case date params as camelCase', async () => {
      await controller.getAIAssistedBookings('2026-01-01', '2026-01-31');

      expect(service.getAIAssistedBookings).toHaveBeenCalledWith({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });
    });

    it('should allow an open-ended range', async () => {
      await controller.getAIAssistedBookings();

      expect(service.getAIAssistedBookings).toHaveBeenCalledWith({
        startDate: undefined,
        endDate: undefined,
      });
    });

    it('should wrap the success-rate metric', async () => {
      const result = await controller.getAIBookingSuccessRate('2026-01-01');

      expect(service.getAIBookingSuccessRate).toHaveBeenCalledWith({
        startDate: '2026-01-01',
        endDate: undefined,
      });
      expect(result).toEqual({
        success: true,
        data: { rate: 0.42 },
        message: 'ok',
        error: null,
      });
    });

    it('should wrap the performance metric', async () => {
      const result = await controller.getAIPerformanceMetrics();

      expect(result.data).toEqual({ p95Ms: 1200 });
      expect(result.success).toBe(true);
    });
  });
});
