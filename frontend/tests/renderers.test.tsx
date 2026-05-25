import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BudgetEstimateRenderer from '@/components/vibe-booking/renderers/BudgetEstimateRenderer';
import PaymentStatusRenderer from '@/components/vibe-booking/renderers/PaymentStatusRenderer';
import WeatherRenderer from '@/components/vibe-booking/renderers/WeatherRenderer';
import TransportOptionsRenderer from '@/components/vibe-booking/renderers/TransportOptionsRenderer';
import ComparisonRenderer from '@/components/vibe-booking/renderers/ComparisonRenderer';
import { useLanguageStore } from '@/lib/i18n';
import type { ContentItem } from '@/stores/vibe-booking.store';

const mkItem = <T,>(type: string, data: T): ContentItem => ({
  id: `item-${type}`,
  type: type as ContentItem['type'],
  data: data as Record<string, unknown>,
  status: 'rendered',
  metadata: undefined,
  actions: [],
});

describe('BudgetEstimateRenderer', () => {
  it('renders USD currency in en locale', () => {
    useLanguageStore.setState({ locale: 'en' });
    const item = mkItem('budget_estimate', { totalUsd: 250, breakdown: { hotel: 150, food: 100 } });
    render(<BudgetEstimateRenderer item={item} onAction={() => {}} />);
    expect(screen.getByText('$250.00')).toBeInTheDocument();
    expect(screen.getByText('$150.00')).toBeInTheDocument();
  });

  it('renders KHR currency when locale is km', () => {
    useLanguageStore.setState({ locale: 'km' });
    const item = mkItem('budget_estimate', { totalUsd: 100, breakdown: { hotel: 100 } });
    render(<BudgetEstimateRenderer item={item} onAction={() => {}} />);
    const matches = screen.getAllByText(/៛/);
    expect(matches.length).toBeGreaterThan(0);
  });
});

describe('PaymentStatusRenderer', () => {
  it('renders SUCCEEDED with check icon and label', () => {
    useLanguageStore.setState({ locale: 'en' });
    const item = mkItem('payment_status', { status: 'SUCCEEDED', paymentIntentId: 'pi_1', amountUsd: 50 });
    render(<PaymentStatusRenderer item={item} onAction={() => {}} />);
    expect(screen.getByText('Succeeded')).toBeInTheDocument();
    expect(screen.getByText('$50.00')).toBeInTheDocument();
  });

  it('shows retry button when FAILED and triggers onAction', () => {
    useLanguageStore.setState({ locale: 'en' });
    const onAction = vi.fn();
    const item = mkItem('payment_status', { status: 'FAILED', paymentIntentId: 'pi_2', amountUsd: 75 });
    render(<PaymentStatusRenderer item={item} onAction={onAction} />);
    const retryBtn = screen.getByRole('button', { name: /Retry Payment/i });
    fireEvent.click(retryBtn);
    expect(onAction).toHaveBeenCalledWith('retry_payment', 'pi_2', { paymentIntentId: 'pi_2' });
  });
});

describe('WeatherRenderer', () => {
  it('renders 5-day forecast with weekday labels', () => {
    useLanguageStore.setState({ locale: 'en' });
    const item = mkItem('weather', {
      forecast: [
        { date: '2026-05-10', icon: '☀', high: 32, low: 24 },
        { date: '2026-05-11', icon: '🌧', high: 30, low: 23 },
      ],
    });
    render(<WeatherRenderer item={item} onAction={() => {}} />);
    expect(screen.getByText('5-Day Forecast')).toBeInTheDocument();
    expect(screen.getByText(/32° \/ 24°/)).toBeInTheDocument();
  });
});

describe('TransportOptionsRenderer', () => {
  it('renders option price formatted by locale', () => {
    useLanguageStore.setState({ locale: 'en' });
    const item = mkItem('transport_options', {
      options: [{ id: 't1', type: 'bus', priceUsd: 15, duration: '6h', departure: '08:00' }],
    });
    render(<TransportOptionsRenderer item={item} onAction={() => {}} />);
    expect(screen.getByText('$15.00')).toBeInTheDocument();
    expect(screen.getByText('bus')).toBeInTheDocument();
  });

  it('emits select_transport on click', () => {
    useLanguageStore.setState({ locale: 'en' });
    const onAction = vi.fn();
    const item = mkItem('transport_options', {
      options: [{ id: 't1', type: 'bus', priceUsd: 15, duration: '6h' }],
    });
    render(<TransportOptionsRenderer item={item} onAction={onAction} />);
    fireEvent.click(screen.getByText('Select'));
    expect(onAction).toHaveBeenCalledWith('select_transport', 't1', { optionId: 't1' });
  });
});

describe('ComparisonRenderer', () => {
  it('renders compare grid with formatted prices', () => {
    useLanguageStore.setState({ locale: 'en' });
    const item = mkItem('comparison', {
      items: [
        { id: 'a', name: 'Trip A', priceUsd: 100, durationDays: 3, rating: 4.5 },
        { id: 'b', name: 'Trip B', priceUsd: 200, durationDays: 5 },
      ],
    });
    render(<ComparisonRenderer item={item} onAction={() => {}} />);
    expect(screen.getByText('Trip A')).toBeInTheDocument();
    expect(screen.getByText('Trip B')).toBeInTheDocument();
    expect(screen.getByText(/\$100\.00/)).toBeInTheDocument();
  });
});
