import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ContentStage from '@/components/vibe-booking/ContentStage';
import { useVibeBookingStore } from '@/stores/vibe-booking.store';
import type { ContentItem } from '@/stores/vibe-booking.store';

const seedItem = (type: ContentItem['type'], data: Record<string, unknown>): ContentItem => ({
  id: `id-${type}-${Math.random().toString(36).slice(2, 8)}`,
  type,
  data,
  status: 'rendered',
  metadata: undefined,
  actions: [],
});

beforeEach(() => {
  useVibeBookingStore.setState({ contentItems: [], isStreaming: false });
});

describe('ContentStage routing', () => {
  it('renders empty state when no items and not streaming', () => {
    render(<ContentStage onAction={() => {}} />);
    expect(screen.getByText(/Trip details, maps, and booking options/i)).toBeInTheDocument();
  });

  it('routes weather payload to WeatherRenderer', async () => {
    useVibeBookingStore.setState({
      contentItems: [
        seedItem('weather', { forecast: [{ date: '2026-05-10', high: 32, low: 24, icon: '☀' }] }),
      ],
    });
    render(<ContentStage onAction={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('5-Day Forecast')).toBeInTheDocument();
    });
  });

  it('routes budget_estimate to BudgetEstimateRenderer with formatted total', async () => {
    useVibeBookingStore.setState({
      contentItems: [
        seedItem('budget_estimate', { totalUsd: 250, breakdown: { hotel: 100, food: 150 } }),
      ],
    });
    render(<ContentStage onAction={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/\$250\.00/)).toBeInTheDocument();
    });
  });

  it('renders unknown content type fallback', async () => {
    useVibeBookingStore.setState({
      contentItems: [seedItem('totally_unknown_type' as ContentItem['type'], { foo: 'bar' })],
    });
    render(<ContentStage onAction={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/Unknown content type: totally_unknown_type/)).toBeInTheDocument();
    });
  });

  it('shows streaming indicator when isStreaming is true', () => {
    useVibeBookingStore.setState({ isStreaming: true, contentItems: [] });
    render(<ContentStage onAction={() => {}} />);
    expect(screen.getByText(/Thinking/)).toBeInTheDocument();
  });

  it('windows older items beyond 50 down to 30 most recent', async () => {
    const items: ContentItem[] = Array.from({ length: 60 }, (_, i) =>
      seedItem('weather', { forecast: [{ date: '2026-05-10', high: 30 + i, low: 20, icon: '☀' }] })
    );
    useVibeBookingStore.setState({ contentItems: items });
    render(<ContentStage onAction={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/Show 30 older items/)).toBeInTheDocument();
    });
  });
});
