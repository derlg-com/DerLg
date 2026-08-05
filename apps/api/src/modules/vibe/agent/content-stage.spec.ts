import {
  contentForOutcomes,
  digestForShownContent,
  labelForCall,
  stageForTool,
} from './content-stage';
import { ToolOutcome } from '../tools/tool-executor';

function outcome(partial: Partial<ToolOutcome> & { name: string }): ToolOutcome {
  return { callId: 'c1', success: true, durationMs: 5, data: {}, ...partial };
}

describe('content stage mapping', () => {
  describe('stageForTool', () => {
    it('maps every registered tool to a renderable stage', () => {
      expect(stageForTool('search_places')).toBe('places');
      expect(stageForTool('search_hotels')).toBe('hotels');
      expect(stageForTool('search_transport')).toBe('transport');
      expect(stageForTool('search_guides')).toBe('guides');
      expect(stageForTool('list_packages')).toBe('packages');
      expect(stageForTool('check_availability')).toBe('availability');
      expect(stageForTool('compose_itinerary')).toBe('itinerary');
      expect(stageForTool('create_booking_hold')).toBe('booking');
    });

    it('returns null for anything unmapped rather than guessing', () => {
      expect(stageForTool('something_new')).toBeNull();
    });
  });

  describe('labelForCall', () => {
    it('names the city in plain language', () => {
      expect(labelForCall('search_hotels', '{"city":"siem-reap"}')).toBe(
        'Checking hotels in Siem Reap…',
      );
      expect(labelForCall('search_places', '{"city":"phnom-penh"}')).toBe(
        'Looking for places to visit in Phnom Penh…',
      );
    });

    it('falls back gracefully when arguments are missing or broken', () => {
      expect(labelForCall('search_hotels', '')).toBe('Checking hotels…');
      expect(labelForCall('search_hotels', '{invalid')).toBe('Checking hotels…');
      expect(labelForCall('unknown_tool', '{}')).toBe('Working on it…');
    });

    it('mentions the language when hunting for a guide', () => {
      expect(labelForCall('search_guides', '{"language":"Mandarin"}')).toBe(
        'Finding a Mandarin-speaking guide…',
      );
    });
  });

  describe('contentForOutcomes', () => {
    it('returns nothing when no tool produced renderable data', () => {
      expect(contentForOutcomes([])).toBeNull();
      expect(contentForOutcomes([outcome({ name: 'unmapped_tool' })])).toBeNull();
    });

    it('ignores a failed tool', () => {
      expect(
        contentForOutcomes([
          outcome({ name: 'search_hotels', success: false, error: { code: 'X', message: 'y' } }),
        ]),
      ).toBeNull();
    });

    it('prefers the outcome furthest along the booking journey', () => {
      const result = contentForOutcomes([
        outcome({ name: 'check_availability', data: { available: true } }),
        outcome({ name: 'search_hotels', data: { items: [] } }),
      ]);

      expect(result).toMatchObject({ stage: 'availability' });
    });

    it('prefers a booking hold over everything else', () => {
      const result = contentForOutcomes([
        outcome({ name: 'compose_itinerary', data: { days: [] } }),
        outcome({ name: 'create_booking_hold', data: { reference: 'DLG-2026-0001' } }),
      ]);

      expect(result).toMatchObject({ stage: 'booking' });
    });
  });

  describe('digestForShownContent', () => {
    it('lists items with their refIds so they can be reused', () => {
      const digest = digestForShownContent('hotels', {
        items: [
          { refId: 'h1', name: 'Lotus Lodge', pricePerNightUsd: 28 },
          { refId: 'h2', name: 'Angkor Terrace Hotel', pricePerNightUsd: 54 },
        ],
      });

      expect(digest).toContain('Lotus Lodge (refId h1, $28)');
      expect(digest).toContain('Angkor Terrace Hotel (refId h2, $54)');
      expect(digest).toContain('Reuse these refIds');
    });

    it('reads the right price field per resource type', () => {
      expect(digestForShownContent('guides', { items: [{ refId: 'g1', name: 'Sokha', pricePerDayUsd: 45 }] })).toContain(
        'Sokha (refId g1, $45)',
      );
      expect(
        digestForShownContent('transport', {
          items: [{ refId: 't1', operator: 'Giant Ibis', pricePerSeatUsd: 15 }],
        }),
      ).toContain('Giant Ibis (refId t1, $15)');
      expect(
        digestForShownContent('places', { items: [{ refId: 'p1', name: 'Angkor Wat', entranceFeeUsd: 37 }] }),
      ).toContain('Angkor Wat (refId p1, $37)');
    });

    it('caps a long list so the prompt cannot balloon', () => {
      const digest = digestForShownContent('places', {
        items: Array.from({ length: 20 }, (_unused, index) => ({
          refId: `p${index}`,
          name: `Place ${index}`,
        })),
      });

      expect(digest).toContain('and 12 more');
      expect(digest).not.toContain('Place 9 ');
    });

    it('summarises an availability verdict rather than dumping it', () => {
      const digest = digestForShownContent('availability', { available: true, totalUsd: 102 });

      expect(digest).toBe('[Already shown: availability check — available: true, total $102]');
    });

    it('returns null when there is nothing worth recalling', () => {
      expect(digestForShownContent('hotels', { items: [] })).toBeNull();
      expect(digestForShownContent('hotels', null)).toBeNull();
      expect(digestForShownContent('text_summary', 'just prose')).toBeNull();
    });
  });
});
