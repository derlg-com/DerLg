# DerLg.com Frontend - Complete Combined Specification

> **Generated from**: Requirements Document + Design Document + Implementation Plan  
> **Purpose**: Single source of truth for all frontend development tasks  
> **Format**: Task-oriented with embedded requirements and design patterns

> **Status Legend**: `[x]` complete, `[~]` partial / scaffolded, `[ ]` not started

---

## Global Architecture

### Technology Stack (From Design §Technology Stack)
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS with custom design system
- **State Management**: Zustand (client state), React Query (server state)
- **Forms**: React Hook Form + Zod validation
- **API Client**: Axios with interceptors
- **WebSocket**: Native WebSocket API with reconnection logic
- **Maps**: Leaflet.js with OpenStreetMap tiles
- **i18n**: next-intl
- **Testing**: Vitest, React Testing Library, Playwright
- **PWA**: next-pwa plugin with Workbox
- **Monitoring**: Sentry for error tracking
- **Analytics**: Google Analytics 4

### App Router Structure (From Design §Next.js App Router Structure)
```
app/
├── (auth)/
│   ├── login/page.tsx
│   ├── register/page.tsx
│   └── layout.tsx (auth layout without main nav)
├── (main)/
│   ├── page.tsx (Home)
│   ├── explore/page.tsx
│   ├── booking/page.tsx
│   ├── booking/[id]/page.tsx
│   ├── booking/payment/page.tsx
│   ├── my-trip/page.tsx
│   ├── my-trip/[bookingId]/page.tsx
│   ├── profile/page.tsx
│   ├── trips/[id]/page.tsx
│   ├── hotels/page.tsx
│   ├── hotels/[id]/page.tsx
│   ├── transportation/page.tsx
│   ├── guides/page.tsx
│   ├── guides/[id]/page.tsx
│   ├── festivals/page.tsx
│   ├── contact/page.tsx
│   └── layout.tsx (main layout with nav)
├── (admin)/
│   ├── dashboard/page.tsx
│   ├── bookings/page.tsx
│   ├── support/page.tsx
│   ├── reviews/page.tsx
│   ├── emergency/page.tsx
│   └── layout.tsx
├── api/auth/refresh/route.ts
├── api/health/route.ts
├── layout.tsx (root layout)
├── error.tsx
├── not-found.tsx
└── globals.css
```

### Component Architecture (From Design §Component Architecture)
1. **Server Components (Default)**: Page layouts, static content, initial data fetching
2. **Client Components ("use client")**: Interactive UI, state management, WebSocket, browser APIs
3. **Hierarchy**: Page (Server) → Layout (Server) → Navigation (Client) → Content (Server/Client)

---

## Task 1: Project Setup and Foundation

**Status**: [x]  
**Requirements**: 1.1, 1.6, 1.7, 1.8, 26.1, 26.2, 26.3, 26.4, 26.5, 46.2, 27.1, 27.2, 27.8, 1.3, 16.8

### 1.1 From Requirements
- **Req 1.1**: Use Next.js 14 with App Router architecture
- **Req 1.6**: Configure TypeScript with strict mode enabled
- **Req 1.7**: Use Tailwind CSS for styling with custom design system
- **Req 1.8**: Implement responsive layouts for mobile (320px+), tablet (768px+), desktop (1024px+)
- **Req 26.1**: Use environment variables for configuration
- **Req 26.2**: Provide separate configurations for development, staging, production
- **Req 26.3**: Use ESLint with TypeScript rules
- **Req 26.4**: Use Prettier for code formatting
- **Req 26.5**: Implement pre-commit hooks with Husky and lint-staged
- **Req 46.2**: Provide .env.example file with all required variables documented
- **Req 27.1**: Define design system with color palette, typography, spacing, breakpoints
- **Req 27.2**: Use Tailwind CSS with custom theme configuration
- **Req 27.8**: Use CSS variables for dynamic theming
- **Req 1.3**: Implement root layout with shared navigation and metadata
- **Req 16.8**: Implement error boundaries to catch React errors gracefully

### 1.2 From Design
- **Pattern**: App Router with route groups `(auth)`, `(main)`, `(admin)`
- **Pattern**: Server Components by default, Client Components only when interactivity required
- **Files**: `app/layout.tsx`, `app/error.tsx`, `app/not-found.tsx`, `app/globals.css`
- **Files**: `tailwind.config.ts`, `tsconfig.json`, `next.config.js`, `.env.example`

### 1.3 Implementation
```bash
# Commands
npx create-next-app@14 derlg-frontend --typescript --tailwind --app --no-src-dir
cd derlg-frontend
npm install zustand @tanstack/react-query axios react-hook-form zod next-intl leaflet react-leaflet @stripe/stripe-js @stripe/react-stripe-js next-pwa @sentry/nextjs
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event playwright fast-check husky lint-staged
```

**Key Files to Create:**
- `next.config.js` — with PWA config, i18n domains, image domains
- `tailwind.config.ts` — custom theme extending colors, fonts, spacing
- `tsconfig.json` — strict mode, path aliases
- `app/layout.tsx` — root layout with metadata, providers, error boundary
- `app/error.tsx` — error boundary with fallback UI
- `app/not-found.tsx` — 404 page
- `app/globals.css` — Tailwind directives, CSS variables for theming
- `.env.example` — all required environment variables
- `.eslintrc.js` — TypeScript rules, React hooks rules
- `.prettierrc` — consistent formatting config
- `.husky/pre-commit` — lint-staged hook

---

## Task 2: Core UI Component Library

**Status**: [x]  
**Requirements**: 27.3, 47.1, 47.2, 47.3, 47.4, 47.5, 47.6, 47.7, 47.8, 47.9, 47.10, 18.5, 16.7, 31.1, 31.2, 31.5, 30.4, 1.8, 25.2

### 2.1 From Requirements
- **Req 27.3**: Implement reusable UI components (Button, Input, Card, Modal, Drawer)
- **Req 47.1**: Button component with variants (primary, secondary, outline, ghost)
- **Req 47.2**: Input component with validation states and icons
- **Req 47.3**: Card component for content blocks
- **Req 47.4**: Modal component with customizable content and actions
- **Req 47.5**: Drawer component for side panels
- **Req 47.6**: Toast component for notifications
- **Req 47.7**: Tabs component for tabbed interfaces
- **Req 47.8**: Dropdown component for select inputs
- **Req 47.9**: Badge component for status indicators
- **Req 47.10**: Avatar component for user profiles
- **Req 18.5**: Use ARIA labels and roles where semantic HTML is insufficient
- **Req 16.7**: Display toast notifications for successful actions and global errors
- **Req 31.1**: Display skeleton loaders for content being fetched
- **Req 31.2**: Use skeleton loaders matching shape of actual content
- **Req 31.5**: Display progress bars for file uploads and long-running operations
- **Req 30.4**: Implement date picker component for booking date selection
- **Req 1.8**: Responsive layouts for mobile, tablet, desktop
- **Req 25.2**: Use React Testing Library for component testing

### 2.2 From Design
- **Pattern**: Layered component architecture — Base UI → Composite → Page-specific
- **Pattern**: Accessibility first — focus trap, ESC to close, ARIA labels, keyboard navigation
- **Pattern**: Composition over inheritance — compound component patterns
- **Files**: 
  - `components/ui/Button.tsx` — variants via cva (class-variance-authority)
  - `components/ui/Input.tsx` — with validation states, icons, error messages
  - `components/ui/Card.tsx` — flexible content container
  - `components/ui/Modal.tsx` — portal-based, focus trap, backdrop blur
  - `components/ui/Drawer.tsx` — side panel, used for AI chat
  - `components/ui/Toast.tsx` — notification system with auto-dismiss
  - `components/ui/Skeleton.tsx` — shimmer animation, shape-matching
  - `components/ui/Tabs.tsx` — accessible tab interface
  - `components/ui/DatePicker.tsx` — calendar component for bookings
  - `components/ui/Badge.tsx` — status indicators with color coding
  - `components/ui/Avatar.tsx` — user profile images with fallbacks

---

## Task 3: State Management Setup

**Status**: [x]  
**Requirements**: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 48.2, 48.3, 48.4

### 3.1 From Requirements
- **Req 14.1**: Use Zustand for client-side application state
- **Req 14.2**: Use React Query for server state management
- **Req 14.3**: Manage authentication state (Auth_Token, Refresh_Token, user profile)
- **Req 14.4**: Manage UI state (modal visibility, drawer state, loading indicators)
- **Req 14.5**: Manage chat state (message history, WebSocket status)
- **Req 14.6**: Cache API responses with configurable stale times
- **Req 14.7**: Implement optimistic updates for mutations
- **Req 14.8**: Automatically refetch data when window regains focus
- **Req 14.9**: Implement retry logic with exponential backoff for failed requests
- **Req 48.2**: Persist user preferences (language, theme, currency) in local storage
- **Req 48.3**: Persist chat history in local storage with size limits
- **Req 48.4**: Persist favorites in local storage for unauthenticated users

### 3.2 From Design
- **Pattern**: Zustand store with persistence middleware
- **Pattern**: React Query QueryClient with global configuration
- **Interface**: `AppState` — user, isAuthenticated, isChatOpen, language, theme, currency
- **Files**: `stores/app-store.ts`, `providers/query-provider.tsx`

### 3.3 Implementation
```typescript
// stores/app-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  isChatOpen: boolean;
  isDrawerOpen: boolean;
  activeModal: string | null;
  language: 'en' | 'kh' | 'zh';
  theme: 'light' | 'dark';
  currency: string;
  setUser: (user: User | null) => void;
  openChat: () => void;
  closeChat: () => void;
  setLanguage: (lang: 'en' | 'kh' | 'zh') => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setCurrency: (currency: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isChatOpen: false,
      isDrawerOpen: false,
      activeModal: null,
      language: 'en',
      theme: 'light',
      currency: 'USD',
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      openChat: () => set({ isChatOpen: true }),
      closeChat: () => set({ isChatOpen: false }),
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: 'derlg-storage',
      partialize: (state) => ({ 
        language: state.language, 
        theme: state.theme, 
        currency: state.currency 
      }),
    }
  )
);
```

---

## Task 4: API Client and Authentication

**Status**: [x]  
**Requirements**: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 24.2, 48.1, 25.5

### 4.1 From Requirements
- **Req 15.1**: Implement API client using Axios with TypeScript types
- **Req 15.2**: Include Auth_Token in Authorization header for authenticated requests
- **Req 15.3**: Implement request interceptors for common headers and auth
- **Req 15.4**: Implement response interceptors for errors and token refresh
- **Req 15.5**: On 401, attempt to refresh Auth_Token using Refresh_Token
- **Req 15.6**: When token refresh fails, clear auth state and redirect to login
- **Req 15.7**: Implement timeout configuration with default 30-second timeout
- **Req 15.8**: Parse and transform API responses into TypeScript interfaces
- **Req 15.9**: Implement retry logic for network errors with exponential backoff
- **Req 2.1**: Store Auth_Token and Refresh_Token on login/registration
- **Req 2.2**: Store tokens in httpOnly cookies
- **Req 2.3**: Auto-refresh expired Auth_Token
- **Req 2.4**: Redirect to login when Refresh_Token invalid
- **Req 2.5**: Include Auth_Token in Authorization header
- **Req 2.6**: Clear tokens on logout and redirect to home
- **Req 2.7**: Protect authenticated routes
- **Req 2.8**: Redirect unauthenticated users to login with return URL
- **Req 2.9**: Redirect unauthenticated users to login with return URL
- **Req 24.2**: Store tokens in httpOnly cookies to prevent XSS
- **Req 48.1**: Persist authentication tokens in httpOnly cookies
- **Req 25.5**: Test authentication flows

### 4.2 From Design
- **Pattern**: Singleton APIClient class with Axios interceptors
- **Pattern**: Token refresh queue — prevent multiple simultaneous refresh requests
- **Pattern**: Request/Response interceptors for auth, language, error handling
- **Files**: `lib/api-client.ts`, `hooks/useAuth.ts`, `types/index.ts`
- **Interface**: `APIClient` — get, post, put, patch, delete with automatic auth

### 4.3 Implementation
```typescript
// lib/api-client.ts
import axios, { AxiosInstance, AxiosError } from 'axios';

class APIClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string) => void> = [];

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL,
      timeout: 30000,
      withCredentials: true, // Send httpOnly cookies
    });
    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.client.interceptors.request.use(
      (config) => {
        config.headers['Accept-Language'] = localStorage.getItem('language') || 'en';
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            return new Promise((resolve) => {
              this.refreshSubscribers.push(() => {
                resolve(this.client(originalRequest));
              });
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            await this.refreshToken();
            this.isRefreshing = false;
            this.refreshSubscribers.forEach((cb) => cb('refreshed'));
            this.refreshSubscribers = [];
            return this.client(originalRequest);
          } catch (refreshError) {
            this.isRefreshing = false;
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(this.handleError(error));
      }
    );
  }

  private async refreshToken() {
    const response = await this.client.post('/auth/refresh');
    return response.data;
  }

  private handleError(error: AxiosError): Error {
    if (error.response) {
      const message = (error.response.data as any)?.message || 'An error occurred';
      return new Error(message);
    } else if (error.request) {
      return new Error('Network error. Please check your connection.');
    }
    return new Error(error.message);
  }

  get<T>(url: string, config?: any) { return this.client.get<T>(url, config); }
  post<T>(url: string, data?: any, config?: any) { return this.client.post<T>(url, data, config); }
  put<T>(url: string, data?: any, config?: any) { return this.client.put<T>(url, data, config); }
  patch<T>(url: string, data?: any, config?: any) { return this.client.patch<T>(url, data, config); }
  delete<T>(url: string, config?: any) { return this.client.delete<T>(url, config); }
}

export const api = new APIClient();
```

---

## Task 5: Authentication Pages

**Status**: [x]  
**Requirements**: 2.1, 2.2, 16.1, 16.2, 16.3, 1.3, 25.5

### 5.1 From Requirements
- **Req 2.1**: Call Backend_API registration endpoint, store tokens
- **Req 2.2**: Call Backend_API login endpoint, store tokens
- **Req 16.1**: Use React Hook Form for form state management
- **Req 16.2**: Use Zod for schema validation
- **Req 16.3**: Validate form inputs on blur and on submit
- **Req 1.3**: Auth layout without main navigation
- **Req 25.5**: Test authentication flows

### 5.2 From Design
- **Pattern**: Route group `(auth)` with isolated layout
- **Pattern**: Form validation with Zod schema + React Hook Form
- **Files**: `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx`
- **Interface**: `LoginCredentials` — email, password; `RegisterData` — email, password, name, phone

---

## Task 6: Main Layout and Navigation

**Status**: [x]  
**Requirements**: 1.3, 1.8, 3.4, 3.7, 2.8, 2.9, 3.4, 3.7, 4.6, 7.5, 20.4, 36.8, 41.3

### 6.1 From Requirements
- **Req 1.3**: Root layout with shared navigation and metadata
- **Req 1.8**: Responsive layouts (mobile bottom nav, desktop top nav)
- **Req 3.4**: Navigate to trip detail page on click
- **Req 3.7**: Navigate to Explore with pre-filtered category
- **Req 2.8**: Protect authenticated routes
- **Req 2.9**: Redirect unauthenticated to login with return URL
- **Req 4.6**: Display detail modal on place/festival click
- **Req 7.5**: Navigate to booking detail page on click
- **Req 20.4**: Navigate to detail page on search result click
- **Req 36.8**: "Book Now" button navigates to booking flow
- **Req 41.3**: Navigate to festival details on click

### 6.2 From Design
- **Pattern**: Bottom navigation (mobile) / Top navigation (desktop)
- **Pattern**: Navigation items: Home, Explore, Booking, My Trip, Profile
- **Pattern**: Language selector and AI button in navigation
- **Files**: `app/(main)/layout.tsx`, `components/Navigation.tsx`
- **Interface**: `NavigationProps` — user: User | null

---

## Task 7: Home Screen

**Status**: [x]  
**Requirements**: 3.1, 3.2, 3.3, 3.6, 3.8, 3.9, 3.4, 3.7, 25.6

### 7.1 From Requirements
- **Req 3.1**: Hero section with search bar and AI quick-start button
- **Req 3.2**: Fetch and display featured trips with images, titles, prices, durations
- **Req 3.3**: Fetch and display upcoming festivals with dates, locations, descriptions
- **Req 3.6**: Categories section with icons (Temples, Nature, Culture, Adventure, Food)
- **Req 3.8**: Infinite scroll or pagination for featured trips
- **Req 3.9**: Loading skeletons while fetching data
- **Req 3.4**: Navigate to trip detail on click
- **Req 3.7**: Navigate to Explore with pre-filtered category
- **Req 25.6**: Test booking flows

### 7.2 From Design
- **Pattern**: Server Component for initial data fetch + Client Component for interactivity
- **Pattern**: React Query for infinite scroll with `useInfiniteQuery`
- **Files**: `app/(main)/page.tsx`, `components/home/HeroSection.tsx`, `components/home/FeaturedTrips.tsx`, `components/home/FestivalsSection.tsx`, `components/home/CategoriesSection.tsx`

---

## Task 8: Explore Screen

**Status**: [~]  
**Requirements**: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 9, 20.1, 20.2, 20.3, 20.5, 17.7

### 8.1 From Requirements
- **Req 4.1**: Tabs for Places, Festivals, and Maps
- **Req 4.2**: Fetch places with filtering by category, region, price range
- **Req 4.3**: Fetch festivals with filtering by date and location
- **Req 4.4**: Interactive map using Leaflet.js with markers
- **Req 4.5**: Search with debounced input (300ms)
- **Req 4.6**: Detail modal on click
- **Req 4.7**: Filter chips with real-time updates
- **Req 4.8**: Persist filters in URL query parameters
- **Req 4.9**: Infinite scroll for lists
- **Req 9**: Search debouncing (Property 9)
- **Req 20.1**: Search bar in navigation header
- **Req 20.2**: Debounce input and call API
- **Req 20.3**: Group results by type
- **Req 20.5**: Highlight matching text
- **Req 17.7**: Debounce search inputs with 300ms delay

### 8.2 From Design
- **Pattern**: Tab-based interface with URL-synced filters
- **Pattern**: Debounced search with `useDebounce` hook
- **Pattern**: Map integration with Leaflet.js
- **Files**: `app/(main)/explore/page.tsx`, `components/explore/PlacesTab.tsx`, `components/explore/FestivalsTab.tsx`, `components/explore/MapTab.tsx`, `components/explore/FilterChips.tsx`, `components/explore/SearchBar.tsx`

---

## Task 9: Maps Integration

**Status**: [~]  
**Requirements**: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 4.4, 12.3, 12.5

### 9.1 From Requirements
- **Req 11.1**: Use Leaflet.js with OpenStreetMap tiles
- **Req 11.2**: Service Worker caches map tiles for offline
- **Req 11.3**: Cache visible tiles when viewed
- **Req 11.4**: Serve cached tiles when offline
- **Req 11.5**: Download button to pre-cache regions
- **Req 11.6**: Cache tiles within zoom levels and boundaries
- **Req 11.7**: Display storage usage, allow clearing
- **Req 11.8**: Display markers for saved places and bookings
- **Req 11.9**: Offline banner when offline
- **Req 4.4**: Interactive map with markers for places and festivals
- **Req 12.3**: Cache static assets for offline
- **Req 12.5**: Display cached pages when offline

### 9.2 From Design
- **Pattern**: Leaflet.js with react-leaflet wrapper
- **Pattern**: Service Worker with Workbox for tile caching
- **Pattern**: Offline-first with cache fallback
- **Files**: `components/Map.tsx`, `components/maps/OfflineMapControls.tsx`
- **Interface**: `MapProps` — center, zoom, markers, onMarkerClick


---

## Task 10: Trip Detail Page

**Status**: [~]  
**Requirements**: 36.1, 36.2, 36.3, 36.4, 36.5, 36.6, 36.7, 36.8, 36.9, 36.10, 21.1, 21.6, 21.7, 21.8, 25.6

### 10.1 From Requirements
- **Req 36.1**: Display trip details (title, description, duration, price, images)
- **Req 36.2**: Detailed itinerary with day-by-day activities
- **Req 36.3**: Included/excluded items
- **Req 36.4**: Meeting point and pickup info
- **Req 36.5**: Cancellation policy and refund terms
- **Req 36.6**: Reviews and ratings
- **Req 36.7**: Available dates with calendar picker
- **Req 36.8**: "Book Now" button
- **Req 36.9**: Similar/recommended trips
- **Req 36.10**: Photo gallery with lightbox
- **Req 21.1**: Display average ratings and review counts
- **Req 21.6**: Sort reviews (most recent, highest rated)
- **Req 21.7**: Filter reviews by rating
- **Req 21.8**: Verified booking badges
- **Req 25.6**: Test booking flows

### 10.2 From Design
- **Pattern**: Server Component for trip data + Client Components for interactivity
- **Pattern**: Photo gallery with lightbox modal
- **Pattern**: Reviews with pagination and filtering
- **Files**: `app/(main)/trips/[id]/page.tsx`, `components/trips/TripItinerary.tsx`, `components/trips/PhotoGallery.tsx`, `components/trips/ReviewsSection.tsx`

---

## Task 11: Booking Flow

**Status**: [~]  
**Requirements**: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 16.1, 16.2, 16.3, 34.3, 35.7, 35.9, 31.4, 25.6

### 11.1 From Requirements
- **Req 5.1**: Booking form with date selection, guest count, special requests
- **Req 5.2**: Validate dates available via API
- **Req 5.3**: Create booking via API, receive confirmation
- **Req 5.4**: Display booking summary with total price, breakdown, discounts
- **Req 5.5**: Display student discount, require verification
- **Req 5.6**: Calculate and display loyalty points earned
- **Req 5.7**: Navigate to payment with booking ID
- **Req 5.8**: Disable submit button after first submission (double-booking prevention)
- **Req 5.9**: Display API error messages
- **Req 16.1**: React Hook Form for form state
- **Req 16.2**: Zod for schema validation
- **Req 16.3**: Validate on blur and submit
- **Req 34.3**: Display points earned from booking
- **Req 35.7**: Display discounted prices for verified students
- **Req 35.9**: Display discount amount and savings
- **Req 31.4**: Disable buttons while actions in progress
- **Req 25.6**: Test booking flows

### 11.2 From Design
- **Pattern**: Multi-step booking flow — Form → Summary → Payment
- **Pattern**: Optimistic UI with React Query mutations
- **Pattern**: Form validation with Zod schema
- **Files**: `components/BookingForm.tsx`, `app/(main)/booking/page.tsx`, `app/(main)/booking/[id]/page.tsx`
- **Interface**: `BookingFormData` — startDate, guestCount, specialRequests, applyLoyaltyPoints, studentDiscount

### 11.3 Implementation
```typescript
// components/BookingForm.tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui/Button';

const bookingSchema = z.object({
  startDate: z.date().min(new Date(), 'Date must be in the future'),
  guestCount: z.number().min(1).max(20),
  specialRequests: z.string().max(500).optional(),
  applyLoyaltyPoints: z.boolean(),
  studentDiscount: z.boolean(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

interface BookingFormProps {
  tripId: string;
  onSuccess: (bookingId: string) => void;
}

export function BookingForm({ tripId, onSuccess }: BookingFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
  });

  const createBooking = useMutation({
    mutationFn: (data: BookingFormData) => api.post('/bookings', { ...data, tripId }),
    onSuccess: (response) => onSuccess(response.data.id),
  });

  const onSubmit = (data: BookingFormData) => {
    createBooking.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input type="date" {...register('startDate')} />
      <input type="number" {...register('guestCount', { valueAsNumber: true })} />
      <textarea {...register('specialRequests')} />
      <label><input type="checkbox" {...register('applyLoyaltyPoints')} /> Use loyalty points</label>
      <label><input type="checkbox" {...register('studentDiscount')} /> Apply student discount</label>
      <Button type="submit" loading={createBooking.isPending} disabled={createBooking.isPending}>
        Book Now
      </Button>
    </form>
  );
}
```

---

## Task 12: Payment Integration

**Status**: [~]  
**Requirements**: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 32.8, 25.6

### 12.1 From Requirements
- **Req 6.1**: Fetch payment options from Backend_API
- **Req 6.2**: Stripe card payment form using Stripe Elements
- **Req 6.3**: QR code payment display
- **Req 6.4**: Call payment endpoint, handle confirmation
- **Req 6.5**: Success message and navigate to confirmation
- **Req 6.6**: Display error from Stripe or Backend_API
- **Req 6.7**: 3D Secure authentication flow
- **Req 6.8**: Real-time status updates for QR payments
- **Req 6.9**: Store receipt, allow PDF download
- **Req 32.8**: Allow retry with same or different payment method
- **Req 25.6**: Test booking flows

### 12.2 From Design
- **Pattern**: Stripe Elements wrapper with custom styling
- **Pattern**: QR code polling for status updates
- **Pattern**: Payment method selector (card/QR)
- **Files**: `components/PaymentForm.tsx`, `app/(main)/booking/payment/page.tsx`
- **Interface**: `PaymentFormProps` — bookingId, amount, onSuccess

---

## Task 13: Booking Confirmation

**Status**: [~]  
**Requirements**: 39.1, 39.2, 39.3, 39.4, 39.5, 39.6, 39.7, 39.8, 39.9, 7.9

### 13.1 From Requirements
- **Req 39.1**: Confirmation page with booking details
- **Req 39.2**: Booking reference number and QR code
- **Req 39.3**: Send confirmation email via Backend_API
- **Req 39.4**: Download confirmation as PDF
- **Req 39.5**: Payment receipt with itemized costs
- **Req 39.6**: Download receipt as PDF
- **Req 39.7**: Contact information for support
- **Req 39.8**: Add to calendar (iCal format)
- **Req 39.9**: Next steps and preparation instructions
- **Req 7.9**: Display QR code for check-in

### 13.2 From Design
- **Pattern**: Confirmation page with multiple action buttons
- **Pattern**: PDF generation via jsPDF or API endpoint
- **Pattern**: Calendar export with ics library
- **Files**: `app/(main)/booking/confirmation/page.tsx`, `components/booking/ConfirmationActions.tsx`

---

## Task 14: My Trip Screen

**Status**: [~]  
**Requirements**: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 10.1, 36.1-36.7, 37.1, 37.3, 37.4, 38.1, 38.3, 39.2, 40.1-40.6, 40.9

### 14.1 From Requirements
- **Req 7.1**: Tabs for Upcoming and Past bookings
- **Req 7.2**: Upcoming tab — status "confirmed" or "pending"
- **Req 7.3**: Past tab — status "completed" or "cancelled"
- **Req 7.4**: Display trip name, dates, location, status, total price
- **Req 7.5**: Navigate to booking detail on click
- **Req 7.6**: Emergency Alert button for bookings within 24 hours
- **Req 7.7**: Cancel bookings via API
- **Req 7.8**: Display cancellation policy and refund amount
- **Req 7.9**: QR code for check-in
- **Req 10.1**: Emergency Alert button for active bookings within 24 hours
- **Req 36.1-36.7**: Trip detail display completeness
- **Req 37.1, 37.3, 37.4**: Hotel and transportation details
- **Req 38.1, 38.3**: Guide details
- **Req 39.2**: QR code display
- **Req 40.1**: "Cancel Booking" button
- **Req 40.2**: Display cancellation policy and refund
- **Req 40.3**: Require confirmation with reason
- **Req 40.4**: Call cancellation API
- **Req 40.5**: Display cancellation confirmation
- **Req 40.6**: Update status to "cancelled"
- **Req 40.9**: Prevent cancellation within no-cancellation period

### 14.2 From Design
- **Pattern**: Tab-based booking list with status filtering
- **Pattern**: Booking detail page with emergency alert integration
- **Pattern**: Cancellation flow with confirmation dialog
- **Files**: `app/(main)/my-trip/page.tsx`, `app/(main)/my-trip/[bookingId]/page.tsx`, `components/booking/BookingCard.tsx`, `components/booking/BookingDetail.tsx`

---

## Task 15: Emergency Alert System

**Status**: [~]  
**Requirements**: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 7.6

### 15.1 From Requirements
- **Req 10.1**: Display Emergency_Alert button for bookings within 24 hours
- **Req 10.2**: Request GPS permission on click
- **Req 10.3**: Capture latitude and longitude when granted
- **Req 10.4**: Send alert with GPS coordinates and booking ID to API
- **Req 10.5**: Display confirmation with emergency contact numbers
- **Req 10.6**: Allow manual location entry when permission denied
- **Req 10.7**: Display location on map before sending
- **Req 10.8**: Cancel button with 5-second countdown
- **Req 7.6**: Emergency Alert button for bookings within 24 hours

### 15.2 From Design
- **Pattern**: useEmergencyAlert hook with geolocation API
- **Pattern**: Countdown timer with cancellation option
- **Pattern**: Map preview before sending
- **Files**: `hooks/useEmergencyAlert.ts`, `components/emergency/EmergencyAlertButton.tsx`, `components/emergency/EmergencyModal.tsx`
- **Interface**: `UseEmergencyAlertReturn` — sendAlert, isLoading, error

### 15.3 Implementation
```typescript
// hooks/useEmergencyAlert.ts
'use client';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

interface UseEmergencyAlertReturn {
  sendAlert: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

export function useEmergencyAlert(bookingId: string): UseEmergencyAlertReturn {
  const getLocation = () => {
    return new Promise<GeolocationCoordinates>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position.coords),
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const sendAlertMutation = useMutation({
    mutationFn: async () => {
      const coords = await getLocation();
      return api.post('/emergency-alerts', {
        bookingId,
        latitude: coords.latitude,
        longitude: coords.longitude,
        timestamp: new Date().toISOString(),
      });
    },
  });

  return {
    sendAlert: sendAlertMutation.mutateAsync,
    isLoading: sendAlertMutation.isPending,
    error: sendAlertMutation.error,
  };
}
```

---

## Task 16: Profile Screen

**Status**: [~]  
**Requirements**: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 29.1-29.5, 29.7, 34.1, 34.2, 34.4, 34.5, 34.6, 34.8, 35.1-35.6, 27.6, 27.7, 44.2, 50.8

### 16.1 From Requirements
- **Req 8.1**: Display profile info (name, email, phone, picture)
- **Req 8.2**: Edit profile and save via API
- **Req 8.3**: Display loyalty points balance and history
- **Req 8.4**: Student discount status and document upload
- **Req 8.5**: Change password
- **Req 8.6**: Language selection (EN, KH, ZH) with immediate UI update
- **Req 8.7**: Notification preferences toggles
- **Req 8.8**: Delete account with confirmation
- **Req 8.9**: Compress image before upload
- **Req 29.1**: Image upload via file input or drag-and-drop
- **Req 29.2**: Validate file types (JPEG, PNG, WebP) and size (max 5MB)
- **Req 29.3**: Compress images client-side
- **Req 29.4**: Display image preview
- **Req 29.5**: Show upload progress
- **Req 29.7**: Crop profile pictures to 400x400px
- **Req 34.1**: Display loyalty points balance prominently
- **Req 34.2**: Points earned per booking
- **Req 34.4**: Fetch points history with pagination
- **Req 34.5**: Points expiration dates
- **Req 34.6**: Points redemption options
- **Req 34.8**: Progress bar for next tier
- **Req 35.1**: Student discount section
- **Req 35.2**: Upload student ID/documents
- **Req 35.3**: Validate file types (PDF, JPEG, PNG) and size (max 10MB)
- **Req 35.4**: Send to Backend_API for review
- **Req 35.5**: Display verification status
- **Req 35.6**: Display badge when approved
- **Req 27.6**: Dark mode support
- **Req 27.7**: Persist theme preference
- **Req 44.2**: Currency selector
- **Req 50.8**: Account deletion

### 16.2 From Design
- **Pattern**: Tabbed profile sections — Info, Points, Student, Settings
- **Pattern**: Image upload with compression and cropping
- **Pattern**: Form validation for all editable fields
- **Files**: `app/(main)/profile/page.tsx`, `components/profile/ProfileForm.tsx`, `components/profile/LoyaltyPoints.tsx`, `components/profile/StudentVerification.tsx`, `components/profile/Preferences.tsx`

---

## Task 17: AI Chat Interface

**Status**: [~]  
**Requirements**: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 9.12, 28.1-28.9, 48.3, 25.7

### 17.1 From Requirements
- **Req 9.1**: Establish WebSocket connection when chat opened
- **Req 9.2**: Full-screen chat interface with history and input
- **Req 9.3**: Transmit message via WebSocket, display in chat
- **Req 9.4**: Receive AI response via WebSocket, display in chat
- **Req 9.5**: Render structured types (text, trip_card, hotel_card, action_buttons)
- **Req 9.6**: Interactive trip card with booking button
- **Req 9.7**: Navigate to booking flow with pre-filled info
- **Req 9.8**: Typing indicators
- **Req 9.9**: Persist chat history in local storage
- **Req 9.10**: Auto-reconnect with exponential backoff
- **Req 9.11**: Connection status indicators
- **Req 9.12**: Close chat and return to previous screen
- **Req 28.1**: Establish WebSocket to AI_Agent
- **Req 28.2**: Retry logic with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- **Req 28.3**: Auto-reconnect on unexpected close
- **Req 28.4**: Heartbeat/ping messages
- **Req 28.5**: Reconnect on heartbeat failure
- **Req 28.6**: Queue messages while disconnected
- **Req 28.7**: Display connection status
- **Req 28.8**: Close connection on chat close/navigation
- **Req 28.9**: Graceful error handling
- **Req 48.3**: Persist chat history in local storage
- **Req 25.7**: Test AI chat WebSocket

### 17.2 From Design
- **Pattern**: useWebSocket hook with reconnection logic
- **Pattern**: Full-screen drawer for chat interface
- **Pattern**: Structured message rendering system
- **Files**: `hooks/useWebSocket.ts`, `components/AIChat.tsx`, `components/chat/MessageList.tsx`, `components/chat/ChatInput.tsx`, `components/chat/TypingIndicator.tsx`
- **Interface**: `Message` — id, role, content, type, metadata, timestamp
- **Interface**: `UseWebSocketReturn` — send, close, status, reconnectAttempts

### 17.3 Implementation
```typescript
// hooks/useWebSocket.ts
'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

interface UseWebSocketOptions {
  url: string;
  onMessage: (data: any) => void;
  onError?: (error: Event) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

interface UseWebSocketReturn {
  send: (data: any) => void;
  close: () => void;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  reconnectAttempts: number;
}

export function useWebSocket({
  url, onMessage, onError, reconnect = true, reconnectInterval = 1000, maxReconnectAttempts = 5,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [status, setStatus] = useState<UseWebSocketReturn['status']>('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const messageQueueRef = useRef<any[]>([]);

  const connect = useCallback(() => {
    setStatus('connecting');
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setStatus('connected');
      setReconnectAttempts(0);
      while (messageQueueRef.current.length > 0) {
        const msg = messageQueueRef.current.shift();
        ws.send(JSON.stringify(msg));
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };

    ws.onerror = (error) => {
      setStatus('error');
      onError?.(error);
    };

    ws.onclose = () => {
      setStatus('disconnected');
      if (reconnect && reconnectAttempts < maxReconnectAttempts) {
        const delay = Math.min(reconnectInterval * Math.pow(2, reconnectAttempts), 30000);
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempts((prev) => prev + 1);
          connect();
        }, delay);
      }
    };

    wsRef.current = ws;
  }, [url, reconnect, reconnectInterval, maxReconnectAttempts, reconnectAttempts, onMessage, onError]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      messageQueueRef.current.push(data);
    }
  }, []);

  const close = useCallback(() => {
    wsRef.current?.close();
  }, []);

  return { send, close, status, reconnectAttempts };
}
```

---

## Task 18: Internationalization (i18n)

**Status**: [~]  
**Requirements**: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 30.2, 30.3, 44.5

### 18.1 From Requirements
- **Req 13.1**: Support EN, KH, ZH languages
- **Req 13.2**: Use next-intl for i18n
- **Req 13.3**: Detect browser language as default
- **Req 13.4**: Update all UI text immediately on language change
- **Req 13.5**: Persist selected language in local storage
- **Req 13.6**: Translate all static UI text
- **Req 13.7**: Fetch translated content from Backend_API
- **Req 13.8**: Format dates, times, currencies per locale
- **Req 13.9**: Support RTL layout for future languages
- **Req 30.2**: Display dates in local timezone per locale
- **Req 30.3**: Format dates according to selected locale
- **Req 44.5**: Format currency according to locale

### 18.2 From Design
- **Pattern**: next-intl with middleware for locale detection
- **Pattern**: Translation files in `messages/{locale}.json`
- **Pattern**: Locale-aware formatting with Intl APIs
- **Files**: `i18n.ts`, `middleware.ts`, `messages/en.json`, `messages/kh.json`, `messages/zh.json`

---

## Task 19: Progressive Web App (PWA)

**Status**: [~]  
**Requirements**: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 48.6, 30

### 19.1 From Requirements
- **Req 12.1**: Web app manifest with app name, icons, theme colors, display mode
- **Req 12.2**: Service Worker for offline functionality and caching
- **Req 12.3**: Cache static assets (CSS, JS, images) for offline
- **Req 12.4**: Cache-first for static assets, network-first for API requests
- **Req 12.5**: Display cached pages when offline
- **Req 12.6**: Display install prompt when criteria met
- **Req 12.7**: Installable on iOS, Android, desktop
- **Req 12.8**: Custom offline page when no cached content
- **Req 12.9**: Sync pending actions when connection restored
- **Req 48.6**: Background sync for offline actions
- **Req 30**: PWA Installation (Property 30)

### 19.2 From Design
- **Pattern**: next-pwa plugin with Workbox configuration
- **Pattern**: Service Worker with custom caching strategies
- **Pattern**: IndexedDB for offline mutation queue
- **Files**: `public/manifest.json`, `next.config.js` (PWA config), `components/OfflineBanner.tsx`


---

## Task 20: Reviews and Ratings

**Status**: [~]  
**Requirements**: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8, 21.9, 50, 51

### 20.1 From Requirements
- **Req 21.1**: Display average ratings and review counts
- **Req 21.2**: Fetch and display reviews with pagination
- **Req 21.3**: Submit review with rating (1-5 stars) and text
- **Req 21.4**: Validate review text (10-1000 characters)
- **Req 21.5**: Upload photos with reviews (max 5)
- **Req 21.6**: Sort reviews (most recent, highest rated)
- **Req 21.7**: Filter reviews by rating
- **Req 21.8**: Verified booking badges
- **Req 21.9**: Edit or delete own reviews
- **Req 50**: Review Submission Validation (Property 50)
- **Req 51**: Review Display and Filtering (Property 51)

### 20.2 From Design
- **Pattern**: Review list with pagination and sorting
- **Pattern**: Star rating component with half-star support
- **Pattern**: Photo gallery for review images
- **Files**: `components/reviews/ReviewList.tsx`, `components/reviews/ReviewForm.tsx`, `components/reviews/StarRating.tsx`

---

## Task 21: Favorites and Wishlists

**Status**: [~]  
**Requirements**: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7, 22.8, 22.9, 52

### 21.1 From Requirements
- **Req 22.1**: Heart icon on trip and place cards
- **Req 22.2**: Toggle favorite status via Backend_API
- **Req 22.3**: Favorites section in Profile screen
- **Req 22.4**: Fetch and display favorited items
- **Req 22.5**: Remove items from favorites
- **Req 22.6**: Sync favorites across devices
- **Req 22.7**: Display count in navigation
- **Req 22.8**: Store favorites in local storage for unauthenticated users
- **Req 22.9**: Sync local favorites with Backend_API on login
- **Req 52**: Favorites Synchronization (Property 52)

### 21.2 From Design
- **Pattern**: Optimistic UI for favorite toggle
- **Pattern**: Local storage fallback for unauthenticated users
- **Pattern**: Sync on login mutation
- **Files**: `hooks/useFavorites.ts`, `components/favorites/FavoriteButton.tsx`, `components/favorites/FavoritesList.tsx`

---

## Task 22: Search Functionality

**Status**: [~]  
**Requirements**: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7, 20.8, 20.9, 48, 49, 17.7

### 22.1 From Requirements
- **Req 20.1**: Search bar in navigation header
- **Req 20.2**: Debounce input and call API (300ms)
- **Req 20.3**: Group results by type (trips, places, festivals, hotels)
- **Req 20.4**: Navigate to detail page on click
- **Req 20.5**: Highlight matching text
- **Req 20.6**: Display recent searches
- **Req 20.7**: Autocomplete suggestions
- **Req 20.8**: "No results" message with suggestions
- **Req 20.9**: Persist search history in local storage
- **Req 48**: Search History Persistence (Property 48)
- **Req 49**: Empty Search Handling (Property 49)
- **Req 17.7**: Debounce search inputs with 300ms delay

### 22.2 From Design
- **Pattern**: useDebounce hook for 300ms delay
- **Pattern**: Grouped search results with type headers
- **Pattern**: Highlight matching text with `<mark>` tags
- **Files**: `hooks/useSearch.ts`, `components/search/SearchBar.tsx`, `components/search/SearchResults.tsx`, `components/search/SearchHistory.tsx`

---

## Task 23: Hotel and Transportation Booking

**Status**: [~]  
**Requirements**: 37.1, 37.2, 37.3, 37.4, 37.5, 37.6, 37.7, 37.8, 37.9

### 23.1 From Requirements
- **Req 37.1**: Hotel listings with images, prices, ratings, amenities
- **Req 37.2**: Filter hotels by price range, rating, amenities
- **Req 37.3**: Hotel details (room types, check-in/check-out, policies)
- **Req 37.4**: Transportation options (bus, van, private car)
- **Req 37.5**: Select departure and arrival locations
- **Req 37.6**: Display available seats/capacity
- **Req 37.7**: Hotel booking flow with date and room selection
- **Req 37.8**: Transportation booking flow with date and time
- **Req 37.9**: Combined pricing for hotel + transportation

### 23.2 From Design
- **Pattern**: Listing pages with filtering sidebar
- **Pattern**: Detail pages with booking CTA
- **Pattern**: Combined booking cart
- **Files**: `app/(main)/hotels/page.tsx`, `app/(main)/hotels/[id]/page.tsx`, `app/(main)/transportation/page.tsx`, `components/hotels/HotelCard.tsx`, `components/hotels/RoomSelector.tsx`

---

## Task 24: Guide Booking

**Status**: [~]  
**Requirements**: 38.1, 38.2, 38.3, 38.4, 38.5, 38.6, 38.7, 38.8, 38.9

### 24.1 From Requirements
- **Req 38.1**: Guide profiles with photos, languages, specialties, ratings
- **Req 38.2**: Filter guides by language, specialty, availability
- **Req 38.3**: Guide details (experience, certifications, reviews)
- **Req 38.4**: Guide availability calendar
- **Req 38.5**: Select tour duration (half-day, full-day, multi-day)
- **Req 38.6**: Pricing based on duration and group size
- **Req 38.7**: Send messages to guides before booking
- **Req 38.8**: Booking flow with date, time, group size
- **Req 38.9**: Display guide contact after booking confirmation

### 24.2 From Design
- **Pattern**: Guide cards with language and specialty tags
- **Pattern**: Availability calendar with booking slots
- **Pattern**: Messaging interface before booking
- **Files**: `app/(main)/guides/page.tsx`, `app/(main)/guides/[id]/page.tsx`, `components/guides/GuideCard.tsx`, `components/guides/AvailabilityCalendar.tsx`, `components/guides/GuideMessaging.tsx`

---

## Task 25: Festival Features

**Status**: [~]  
**Requirements**: 41.1, 41.2, 41.3, 41.4, 41.5, 41.6, 41.7, 41.8, 41.9, 73

### 25.1 From Requirements
- **Req 41.1**: Festival calendar view (monthly and list)
- **Req 41.2**: Festival markers with color coding by type
- **Req 41.3**: Festival details (date, location, description, activities)
- **Req 41.4**: Related trips and accommodations
- **Req 41.5**: Filter festivals by type (religious, cultural, music, food)
- **Req 41.6**: Add festivals to favorites
- **Req 41.7**: Countdown timers for upcoming festivals
- **Req 41.8**: Reminders for favorited festivals
- **Req 41.9**: Festival photos and videos gallery
- **Req 73**: Festival Display and Interaction (Property 73)

### 25.2 From Design
- **Pattern**: Calendar view with color-coded events
- **Pattern**: Countdown component with live updates
- **Pattern**: Gallery with lightbox for photos/videos
- **Files**: `app/(main)/festivals/page.tsx`, `components/festivals/FestivalCalendar.tsx`, `components/festivals/FestivalCountdown.tsx`, `components/festivals/FestivalGallery.tsx`

---

## Task 26: Notifications

**Status**: [~]  
**Requirements**: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 45, 46, 23.6

### 26.1 From Requirements
- **Req 19.1**: Request push notification permission
- **Req 19.2**: Register Service Worker for push notifications
- **Req 19.3**: Send push token to Backend_API
- **Req 19.4**: Display notifications with title, body, icon
- **Req 19.5**: Navigate to relevant page on click
- **Req 19.6**: In-app notifications for real-time updates
- **Req 19.7**: Notification center showing recent notifications
- **Req 19.8**: Mark notifications as read
- **Req 19.9**: Respect user notification preferences
- **Req 45**: Push Notification Flow (Property 45)
- **Req 46**: Notification Preferences (Property 46)
- **Req 23.6**: Respect user privacy preferences

### 26.2 From Design
- **Pattern**: Service Worker push event handling
- **Pattern**: Notification bell with unread count badge
- **Pattern**: Notification center drawer
- **Files**: `components/notifications/NotificationBell.tsx`, `components/notifications/NotificationCenter.tsx`, `hooks/useNotifications.ts`

---

## Task 27: Social Sharing

**Status**: [ ]  
**Requirements**: 33.1, 33.2, 33.3, 33.4, 33.5, 33.6, 33.7, 33.8, 33.9, 67

### 27.1 From Requirements
- **Req 33.1**: Share buttons on trip and place detail pages
- **Req 33.2**: Web Share API for native sharing
- **Req 33.3**: Fallback options (copy link, email, WhatsApp, Facebook)
- **Req 33.4**: Generate shareable URL with Open Graph metadata
- **Req 33.5**: Open Graph meta tags for rich previews
- **Req 33.6**: Success message when link copied
- **Req 33.7**: Track share events in analytics
- **Req 33.8**: Share booking confirmations
- **Req 33.9**: Generate QR codes for offline sharing
- **Req 67**: Social Sharing (Property 67)

### 27.2 From Design
- **Pattern**: Web Share API with fallback menu
- **Pattern**: QR code generation for offline sharing
- **Pattern**: Open Graph metadata in page headers
- **Files**: `components/sharing/ShareButton.tsx`, `components/sharing/ShareMenu.tsx`, `components/sharing/QRCodeShare.tsx`

---

## Task 28: Currency Conversion

**Status**: [~]  
**Requirements**: 44.1, 44.2, 44.3, 44.4, 44.5, 44.6, 44.7, 44.8, 44.9, 77

### 28.1 From Requirements
- **Req 44.1**: Display prices in USD as default
- **Req 44.2**: Allow currency selection from list
- **Req 44.3**: Fetch exchange rates from Backend_API
- **Req 44.4**: Convert and display all prices
- **Req 44.5**: Format currency according to locale
- **Req 44.6**: Persist currency preference in local storage
- **Req 44.7**: Display currency disclaimer
- **Req 44.8**: Update exchange rates daily
- **Req 44.9**: Display original and converted currency
- **Req 77**: Currency Conversion (Property 77)

### 28.2 From Design
- **Pattern**: Currency context with exchange rate cache
- **Pattern**: Price display component with original/converted
- **Pattern**: Daily rate refresh via React Query
- **Files**: `hooks/useCurrency.ts`, `components/currency/CurrencySelector.tsx`, `components/currency/PriceDisplay.tsx`

---

## Task 29: Contact and Support

**Status**: [~]  
**Requirements**: 42.1, 42.2, 42.3, 42.4, 42.5, 42.6, 42.7, 42.8, 42.9, 74

### 29.1 From Requirements
- **Req 42.1**: "Contact Us" link in navigation footer
- **Req 42.2**: Contact form (name, email, subject, message)
- **Req 42.3**: Validate form fields
- **Req 42.4**: Send message to Backend_API, display success
- **Req 42.5**: Support email and phone number
- **Req 42.6**: FAQ section
- **Req 42.7**: Live chat widget
- **Req 42.8**: Business hours
- **Req 42.9**: File attachments (max 5MB)
- **Req 74**: Contact Form Submission (Property 74)

### 29.2 From Design
- **Pattern**: Contact form with file upload
- **Pattern**: FAQ accordion component
- **Pattern**: Live chat widget integration
- **Files**: `app/(main)/contact/page.tsx`, `components/contact/ContactForm.tsx`, `components/contact/FAQSection.tsx`, `components/contact/LiveChatWidget.tsx`

---

## Task 30: SEO Optimization

**Status**: [~]  
**Requirements**: 43.1, 43.2, 43.3, 43.4, 43.5, 43.6, 43.7, 43.8, 43.9, 75, 76

### 30.1 From Requirements
- **Req 43.1**: Dynamic meta tags (title, description, keywords)
- **Req 43.2**: Structured data (JSON-LD) for trips, hotels, reviews
- **Req 43.3**: Canonical URLs
- **Req 43.4**: sitemap.xml with all public pages
- **Req 43.5**: robots.txt with crawling instructions
- **Req 43.6**: Open Graph tags for social sharing
- **Req 43.7**: Twitter Card tags
- **Req 43.8**: Proper heading hierarchy (h1, h2, h3)
- **Req 43.9**: Server-side rendering for critical pages
- **Req 75**: SEO Metadata Completeness (Property 75)
- **Req 76**: SEO Heading Hierarchy (Property 76)

### 30.2 From Design
- **Pattern**: Next.js Metadata API for dynamic meta tags
- **Pattern**: JSON-LD structured data components
- **Pattern**: Automatic sitemap generation
- **Files**: `app/sitemap.ts`, `app/robots.ts`, `components/seo/StructuredData.tsx`, `components/seo/SEOMetadata.tsx`


---

## Task 31: Admin Dashboard

**Status**: [~]  
**Requirements**: 45.1, 45.2, 45.3, 45.4, 45.5, 45.6, 45.7, 45.8, 45.9, 78

### 31.1 From Requirements
- **Req 45.1**: Display "Admin" link for admin users
- **Req 45.2**: Protect admin routes by role
- **Req 45.3**: Admin dashboard with key metrics
- **Req 45.4**: View and manage all bookings
- **Req 45.5**: View and respond to support messages
- **Req 45.6**: Moderate reviews
- **Req 45.7**: Manage emergency alerts
- **Req 45.8**: Analytics charts for trends and revenue
- **Req 45.9**: Redirect non-admin users to home
- **Req 78**: Admin Access Control (Property 78)

### 31.2 From Design
- **Pattern**: Route group `(admin)` with role-based access control
- **Pattern**: Dashboard with metric cards and charts
- **Pattern**: Data tables with sorting and filtering
- **Files**: `app/(admin)/layout.tsx`, `app/(admin)/dashboard/page.tsx`, `app/(admin)/bookings/page.tsx`, `components/admin/AdminNav.tsx`, `components/admin/MetricCard.tsx`, `components/admin/DataTable.tsx`

---

## Task 32: Legal and Compliance

**Status**: [~]  
**Requirements**: 50.1, 50.2, 50.3, 50.4, 50.5, 50.6, 50.7, 50.8, 50.9, 84, 23.7

### 32.1 From Requirements
- **Req 50.1**: Terms of Service page
- **Req 50.2**: Privacy Policy page
- **Req 50.3**: Cookie Policy page
- **Req 50.4**: Cookie consent banner with accept/reject
- **Req 50.5**: Respect preferences, disable non-essential cookies when rejected
- **Req 50.6**: GDPR data request form
- **Req 50.7**: Download personal data
- **Req 50.8**: Request account deletion
- **Req 50.9**: Age verification for users under 18
- **Req 84**: Cookie Consent Compliance (Property 84)
- **Req 23.7**: Cookie consent banner for analytics

### 32.2 From Design
- **Pattern**: Cookie consent with granular control
- **Pattern**: GDPR data export functionality
- **Pattern**: Age verification modal
- **Files**: `app/(main)/terms/page.tsx`, `app/(main)/privacy/page.tsx`, `app/(main)/cookies/page.tsx`, `components/legal/CookieConsent.tsx`, `components/legal/GDPRForm.tsx`, `components/legal/AgeVerification.tsx`

---

## Task 33: Performance Optimization

**Status**: [~]  
**Requirements**: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 41, 42, 26.8

### 33.1 From Requirements
- **Req 17.1**: Code splitting with dynamic imports
- **Req 17.2**: Next.js Image component for optimization
- **Req 17.3**: Lazy loading for below-fold images
- **Req 17.4**: Prefetch critical resources on hover
- **Req 17.5**: Lighthouse performance score above 90
- **Req 17.6**: Skeleton loaders for async content
- **Req 17.7**: Debounce search inputs (300ms)
- **Req 17.8**: Virtual scrolling for long lists
- **Req 17.9**: Tree-shaking unused code
- **Req 41**: Lazy Loading (Property 41)
- **Req 42**: Resource Prefetching (Property 42)
- **Req 26.8**: Bundle analysis to monitor size

### 33.2 From Design
- **Pattern**: Dynamic imports with `next/dynamic`
- **Pattern**: Intersection Observer for lazy loading
- **Pattern**: Virtual scrolling with `react-window` or `react-virtualized`
- **Files**: `components/performance/DynamicImport.tsx`, `components/performance/VirtualList.tsx`, `components/performance/ImageLazyLoad.tsx`

---

## Task 34: Accessibility (a11y)

**Status**: [~]  
**Requirements**: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8, 18.9, 43, 44

### 34.1 From Requirements
- **Req 18.1**: Semantic HTML (nav, main, article, section)
- **Req 18.2**: Alt text for all images
- **Req 18.3**: Keyboard navigation for all interactive elements
- **Req 18.4**: Visible focus indicators
- **Req 18.5**: ARIA labels and roles
- **Req 18.6**: Color contrast WCAG AA (4.5:1)
- **Req 18.7**: Screen reader support with heading hierarchy
- **Req 18.8**: Skip-to-content links
- **Req 18.9**: ARIA live regions for dynamic content
- **Req 43**: Accessibility - Keyboard Navigation (Property 43)
- **Req 44**: Accessibility - Image Alt Text (Property 44)

### 34.2 From Design
- **Pattern**: Focus management with `useFocusTrap`
- **Pattern**: Screen reader announcements with `useAnnouncer`
- **Pattern**: Automated a11y testing with jest-axe
- **Files**: `hooks/useFocusTrap.ts`, `hooks/useAnnouncer.ts`, `components/a11y/SkipLink.tsx`, `components/a11y/LiveRegion.tsx`

---

## Task 35: Error Handling and Recovery

**Status**: [~]  
**Requirements**: 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 32.1, 32.2, 32.3, 32.4, 32.5, 32.6, 32.7, 32.8, 32.9, 36, 37, 38, 39, 40, 66

### 35.1 From Requirements
- **Req 16.3**: Validate on blur and submit
- **Req 16.4**: Display inline error messages
- **Req 16.5**: Disable submit until valid
- **Req 16.6**: Map API errors to form fields
- **Req 16.7**: Toast notifications for success/error
- **Req 16.8**: Error boundaries with fallback UI
- **Req 16.9**: Log errors to monitoring service
- **Req 32.1**: Error message with retry button
- **Req 32.2**: Auto-retry with exponential backoff
- **Req 32.3**: Retry 3 times for 5xx errors
- **Req 32.4**: No retry for 4xx errors
- **Req 32.5**: Error boundaries catch React errors
- **Req 32.6**: "Go Back" or "Go Home" button
- **Req 32.7**: Log errors to monitoring
- **Req 32.8**: Retry payment with different method
- **Req 32.9**: Preserve form data on errors
- **Req 36**: Form Validation Feedback (Property 36)
- **Req 37**: API Error Mapping (Property 37)
- **Req 38**: Toast Notifications (Property 38)
- **Req 39**: Error Boundary Handling (Property 39)
- **Req 40**: Error Logging (Property 40)
- **Req 66**: Error Recovery (Property 66)

### 35.2 From Design
- **Pattern**: Error boundary hierarchy — App-level, Section-level, Component-level
- **Pattern**: Toast notification system with auto-dismiss
- **Pattern**: Form error mapping with Zod + React Hook Form
- **Files**: `components/error/ErrorBoundary.tsx`, `components/error/ErrorFallback.tsx`, `components/error/ToastContainer.tsx`, `hooks/useErrorHandler.ts`

---

## Task 36: Loading States and UX

**Status**: [~]  
**Requirements**: 31.1, 31.2, 31.3, 31.4, 31.5, 31.6, 31.7, 31.8, 31.9, 65, 14.7

### 36.1 From Requirements
- **Req 31.1**: Skeleton loaders for content being fetched
- **Req 31.2**: Skeleton loaders matching shape of content
- **Req 31.3**: Spinner indicators for button actions
- **Req 31.4**: Disable buttons while actions in progress
- **Req 31.5**: Progress bars for uploads and long operations
- **Req 31.6**: Suspense boundaries for lazy-loaded components
- **Req 31.7**: Loading states for route transitions
- **Req 31.8**: Optimistic UI updates with rollback on error
- **Req 31.9**: Shimmer animation on skeleton loaders
- **Req 65**: Loading State Display (Property 65)
- **Req 14.7**: Optimistic updates for mutations

### 36.2 From Design
- **Pattern**: Skeleton components matching content layout
- **Pattern**: Shimmer animation with CSS gradients
- **Pattern**: Optimistic updates with React Query
- **Files**: `components/ui/Skeleton.tsx`, `components/ui/Spinner.tsx`, `components/ui/ProgressBar.tsx`, `components/ui/Shimmer.tsx`

---

## Task 37: Date and Time Handling

**Status**: [ ]  
**Requirements**: 30.1, 30.2, 30.3, 30.4, 30.5, 30.6, 30.7, 30.8, 30.9, 62, 63, 64

### 37.1 From Requirements
- **Req 30.1**: Use date-fns or dayjs for date manipulation
- **Req 30.2**: Display dates in user's local timezone
- **Req 30.3**: Format dates according to locale
- **Req 30.4**: Date picker component for booking
- **Req 30.5**: Validate dates are in future
- **Req 30.6**: Relative time display ("2 hours ago")
- **Req 30.7**: Timezone conversions with Backend_API
- **Req 30.8**: Timezone indicators ("10:00 AM ICT")
- **Req 30.9**: Date range selection for multi-day bookings
- **Req 62**: Date Validation (Property 62)
- **Req 63**: Relative Time Display (Property 63)
- **Req 64**: Timezone Handling (Property 64)

### 37.2 From Design
- **Pattern**: date-fns for formatting and manipulation
- **Pattern**: Custom date picker with locale support
- **Pattern**: Timezone conversion utilities
- **Files**: `lib/date-utils.ts`, `components/ui/DatePicker.tsx`, `components/ui/DateRangePicker.tsx`, `components/ui/RelativeTime.tsx`

---

## Task 38: Analytics and Tracking

**Status**: [ ]  
**Requirements**: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7, 23.8, 23.9, 53

### 38.1 From Requirements
- **Req 23.1**: Integrate Google Analytics
- **Req 23.2**: Track page views for all routes
- **Req 23.3**: Track custom events (search, booking, payment, chat)
- **Req 23.4**: Track conversion funnels
- **Req 23.5**: Track AI chat interactions
- **Req 23.6**: Respect user privacy and GDPR
- **Req 23.7**: Cookie consent banner for analytics
- **Req 23.8**: Anonymize user data
- **Req 23.9**: Track performance metrics
- **Req 53**: Analytics Event Tracking (Property 53)

### 38.2 From Design
- **Pattern**: Google Analytics 4 with custom events
- **Pattern**: Privacy-compliant tracking with consent
- **Pattern**: Performance metrics with Web Vitals
- **Files**: `lib/analytics.ts`, `hooks/useAnalytics.ts`, `components/analytics/AnalyticsProvider.tsx`, `components/analytics/ConsentBanner.tsx`

---

## Task 39: Monitoring and Error Tracking

**Status**: [~]  
**Requirements**: 49.1, 49.2, 49.3, 49.4, 49.5, 49.6, 49.7, 49.8, 49.9, 83

### 39.1 From Requirements
- **Req 49.1**: Integrate Sentry
- **Req 49.2**: Capture JavaScript errors with stack traces
- **Req 49.3**: Capture unhandled promise rejections
- **Req 49.4**: Capture API errors with request/response details
- **Req 49.5**: Include user context for authenticated users
- **Req 49.6**: Track page load times
- **Req 49.7**: Track Core Web Vitals (LCP, FID, CLS)
- **Req 49.8**: Custom performance marks for critical flows
- **Req 49.9**: Exclude sensitive data from error reports
- **Req 83**: Performance Monitoring (Property 83)

### 39.2 From Design
- **Pattern**: Sentry integration with beforeSend filtering
- **Pattern**: Performance monitoring with custom spans
- **Pattern**: Web Vitals tracking with `web-vitals` library
- **Files**: `sentry.client.config.ts`, `sentry.server.config.ts`, `lib/monitoring.ts`, `hooks/usePerformance.ts`

---

## Task 40: Security Implementation

**Status**: [~]  
**Requirements**: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7, 24.8, 24.9, 54, 55, 56, 57, 58, 59, 49.9

### 40.1 From Requirements
- **Req 24.1**: HTTPS for all requests
- **Req 24.2**: httpOnly cookies for tokens
- **Req 24.3**: Content Security Policy headers
- **Req 24.4**: Sanitize user input to prevent XSS
- **Req 24.5**: Validate API response data structure
- **Req 24.6**: Client-side rate limiting
- **Req 24.7**: Exclude sensitive data from logs
- **Req 24.8**: CSRF protection for state-changing requests
- **Req 24.9**: Subresource Integrity for third-party scripts
- **Req 54**: Security - Input Sanitization (Property 54)
- **Req 55**: Security - API Response Validation (Property 55)
- **Req 56**: Security - Sensitive Data Protection (Property 56)
- **Req 57**: Security - HTTPS Enforcement (Property 57)
- **Req 58**: Security - Rate Limiting (Property 58)
- **Req 59**: Security - CSRF Protection (Property 59)
- **Req 49.9**: Exclude sensitive data from error reports

### 40.2 From Design
- **Pattern**: DOMPurify for input sanitization
- **Pattern**: Zod schema validation for API responses
- **Pattern**: Rate limiting with token bucket algorithm
- **Files**: `lib/security.ts`, `lib/sanitize.ts`, `middleware.ts` (CSP headers), `hooks/useRateLimit.ts`

---

## Task 41: Data Persistence and Sync

**Status**: [x]  
**Requirements**: 48.1, 48.2, 48.3, 48.4, 48.5, 48.6, 48.7, 48.8, 48.9, 80, 81, 82

### 41.1 From Requirements
- **Req 48.1**: Persist authentication tokens in httpOnly cookies
- **Req 48.2**: Persist user preferences in local storage
- **Req 48.3**: Persist chat history in local storage with size limits
- **Req 48.4**: Persist favorites for unauthenticated users
- **Req 48.5**: Sync local storage data with Backend_API on login
- **Req 48.6**: Background sync for offline actions
- **Req 48.7**: Clear sensitive data on logout
- **Req 48.8**: Data migration for schema changes
- **Req 48.9**: Respect browser storage limits
- **Req 80**: Login Data Sync (Property 80)
- **Req 81**: Storage Schema Migration (Property 81)
- **Req 82**: Storage Quota Handling (Property 82)

### 41.2 From Design
- **Pattern**: IndexedDB for offline mutation queue
- **Pattern**: Local storage with quota checking
- **Pattern**: Schema versioning and migration
- **Files**: `lib/storage.ts`, `lib/sync.ts`, `lib/migration.ts`, `hooks/useStorage.ts`

---

## Task 42: Theme Support

**Status**: [~]  
**Requirements**: 27.6, 27.7, 60

### 42.1 From Requirements
- **Req 27.6**: Dark mode support with theme toggle
- **Req 27.7**: Persist theme preference in local storage
- **Req 60**: Theme Toggle Persistence (Property 60)

### 42.2 From Design
- **Pattern**: CSS variables for dynamic theming
- **Pattern**: next-themes for theme management
- **Pattern**: System preference detection
- **Files**: `providers/theme-provider.tsx`, `components/ui/ThemeToggle.tsx`

---

## Task 43: React Query Optimizations

**Status**: [~]  
**Requirements**: 14.6, 14.7, 14.8, 14.9, 33, 34, 35

### 43.1 From Requirements
- **Req 14.6**: Cache API responses with stale times
- **Req 14.7**: Optimistic updates for mutations
- **Req 14.8**: Refetch on window focus
- **Req 14.9**: Retry logic with exponential backoff
- **Req 33**: API Response Caching (Property 33)
- **Req 34**: Optimistic Updates (Property 34)
- **Req 35**: Request Retry Logic (Property 35)

### 43.2 From Design
- **Pattern**: Query key factories for organized caching
- **Pattern**: Optimistic updates with rollback
- **Pattern**: Infinite scroll with `useInfiniteQuery`
- **Files**: `lib/query-keys.ts`, `hooks/useOptimisticMutation.ts`

---

## Task 44: Testing Infrastructure

**Status**: [ ]  
**Requirements**: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7, 25.8, 25.9

### 44.1 From Requirements
- **Req 25.1**: Use Vitest for unit testing
- **Req 25.2**: Use React Testing Library for component testing
- **Req 25.3**: Use Playwright for E2E testing
- **Req 25.4**: Minimum 80% code coverage for critical paths
- **Req 25.5**: Test authentication flows
- **Req 25.6**: Test booking flows
- **Req 25.7**: Test AI chat WebSocket
- **Req 25.8**: Test offline functionality
- **Req 25.9**: Run tests in CI/CD pipeline

### 44.2 From Design
- **Pattern**: Testing pyramid — 70% Unit/PBT, 20% Integration, 10% E2E
- **Pattern**: fast-check for property-based testing
- **Pattern**: MSW for API mocking
- **Files**: `vitest.config.ts`, `playwright.config.ts`, `tests/setup.ts`, `tests/generators.ts`

### 44.3 Implementation
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        global: 80,
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});

// tests/setup.ts
import { fc } from 'fast-check';

fc.configureGlobal({
  numRuns: 100,
  verbose: true,
  seed: Date.now(),
});
```

---

## Task 45: End-to-End Tests

**Status**: [ ]  
**Requirements**: 25.5, 25.6, 25.7, 25.8

### 45.1 From Requirements
- **Req 25.5**: Test authentication flows (registration, login, token refresh)
- **Req 25.6**: Test booking flows (selection to payment confirmation)
- **Req 25.7**: Test AI chat WebSocket connection and message handling
- **Req 25.8**: Test offline functionality and Service Worker

### 45.2 From Design
- **Pattern**: Playwright for critical user flows
- **Pattern**: Docker Compose for full stack testing
- **Files**: `tests/e2e/auth.spec.ts`, `tests/e2e/booking.spec.ts`, `tests/e2e/chat.spec.ts`, `tests/e2e/offline.spec.ts`

---

## Task 46: Deployment Configuration

**Status**: [~]  
**Requirements**: 26.1, 46.1, 46.2, 46.3, 46.4, 46.5, 46.6, 46.7, 46.8, 46.9

### 46.1 From Requirements
- **Req 26.1**: Use environment variables for configuration
- **Req 46.1**: Use environment variables for all configuration
- **Req 46.2**: Provide .env.example with documented variables
- **Req 46.3**: Validate required environment variables at build time
- **Req 46.4**: Support deployment to Vercel, Netlify
- **Req 46.5**: Health check endpoint
- **Req 46.6**: CORS headers for API requests
- **Req 46.7**: Rate limiting headers
- **Req 46.8**: Caching headers for static assets
- **Req 46.9**: Document deployment steps in README.md

### 46.2 From Design
- **Pattern**: Health check at `/api/health`
- **Pattern**: Environment validation at build time
- **Files**: `app/api/health/route.ts`, `lib/env.ts`, `README.md`

---

## Task 47: Final Integration and Checkpoints

**Status**: [~]  
**Requirements**: 25.9, 17.5, 18.6, 43.9

### 47.1 Checkpoint - Integration Testing
- Test all features work together
- Test authentication flows across app
- Test booking flows end-to-end
- Test AI chat integration
- Ensure all tests pass

### 47.2 Checkpoint - Performance Testing
- Run Lighthouse audits
- Verify performance score above 90
- Test with large datasets
- Verify bundle size is optimized

### 47.3 Checkpoint - Accessibility Testing
- Run automated a11y checks with jest-axe
- Test keyboard navigation
- Test screen reader compatibility
- Verify color contrast

### 47.4 Checkpoint - Cross-Browser Testing
- Test on Chrome, Firefox, Safari, Edge
- Test on iOS and Android devices
- Test PWA installation on all platforms

### 47.5 Final Checkpoint - Production Readiness
- Verify all environment variables configured
- Verify error tracking is working
- Verify analytics is tracking correctly
- Verify all legal pages are complete
- Run full test suite

---

## Verification Matrix

| Property | Requirements Validated | Design Pattern | Task(s) |
|----------|----------------------|----------------|---------|
| Property 1: Authentication Token Round-Trip | 2.1, 2.2, 2.3, 24.2, 48.1 | APIClient + httpOnly cookies | 4 |
| Property 2: Token Refresh on Expiration | 2.4, 15.5 | Response interceptor queue | 4 |
| Property 3: Authentication Failure Redirect | 2.5, 15.6 | Redirect to /login | 4 |
| Property 4: Authenticated Request Authorization | 2.6, 15.2, 15.3 | Request interceptor | 4 |
| Property 5: Logout State Clearing | 2.7, 48.7 | Clear store + cookies | 4 |
| Property 6: Protected Route Access Control | 2.8, 2.9 | Middleware + route guards | 4, 6 |
| Property 7: Navigation Preservation | 3.4, 3.7, 4.6, 7.5, 20.4, 36.8, 41.3 | Next.js Link + router | 6, 7, 8, 10, 14 |
| Property 8: Filter URL Persistence | 4.7, 4.8 | useSearchParams + URL | 8 |
| Property 9: Search Debouncing | 4.5, 17.7, 20.2 | useDebounce(300ms) | 8, 22 |
| Property 10: Booking Form Validation | 5.1, 5.2, 5.3 | Zod + React Hook Form | 11 |
| Property 11: Booking Price Calculation | 5.4, 5.5, 5.6, 34.3, 35.7, 35.9 | Price breakdown component | 11 |
| Property 12: Double-Submission Prevention | 5.8, 31.4 | isPending disabled state | 11 |
| Property 13: Payment Method Handling | 6.1, 6.3, 6.4 | Stripe Elements + QR | 12 |
| Property 14: Payment Result Navigation | 6.5, 6.6, 32.8 | Success/error handlers | 12 |
| Property 15: Booking Status Filtering | 7.2, 7.3 | Tab-based filtering | 14 |
| Property 16: Booking Display Completeness | 7.4, 7.9, 36.1-36.7, 37.1, 37.3, 37.4, 38.1, 38.3, 39.2 | Detail page components | 14 |
| Property 17: Emergency Alert Availability | 7.6, 10.1 | 24-hour check | 14, 15 |
| Property 18: Emergency Alert GPS Capture | 10.2, 10.3, 10.4 | Geolocation API | 15 |
| Property 19: Profile Update Persistence | 8.2, 8.5 | API mutation + store update | 16 |
| Property 20: Language Change Reactivity | 8.6, 13.4, 13.5 | next-intl + localStorage | 16, 18 |
| Property 21: Image Upload Validation | 8.9, 29.2, 29.3, 29.4, 29.5, 35.3 | File validation + compression | 16 |
| Property 22: WebSocket Connection Lifecycle | 9.1, 9.12, 28.1, 28.8 | useWebSocket hook | 17 |
| Property 23: WebSocket Message Round-Trip | 9.3, 9.4, 9.5 | send/onMessage cycle | 17 |
| Property 24: WebSocket Reconnection | 9.10, 28.2, 28.3, 28.6 | Exponential backoff + queue | 17 |
| Property 25: Chat History Persistence | 9.9, 48.3 | localStorage with limits | 17 |
| Property 26: Structured Message Rendering | 9.5, 9.6, 9.7 | Message type components | 17 |
| Property 27: Connection Status Display | 9.11, 28.7 | Status indicator UI | 17 |
| Property 28: Map Tile Caching | 11.2, 11.3, 11.6, 12.3 | Service Worker + Workbox | 9 |
| Property 29: Offline Map Functionality | 11.4, 11.8, 11.9, 12.5 | Offline tile serving | 9 |
| Property 30: PWA Installation | 12.6 | next-pwa + manifest | 19 |
| Property 31: Offline Sync | 12.9, 48.6 | IndexedDB + background sync | 19, 41 |
| Property 32: Internationalization Completeness | 13.3, 13.4, 13.6, 13.7, 13.8, 30.2, 30.3, 30.8, 44.5 | next-intl + locale formatting | 18 |
| Property 33: API Response Caching | 14.6, 14.8 | React Query staleTime | 3, 43 |
| Property 34: Optimistic Updates | 14.7, 31.8 | onMutate + rollback | 3, 43 |
| Property 35: Request Retry Logic | 14.9, 15.9, 32.2, 32.3, 32.4 | Exponential backoff | 3, 4, 43 |
| Property 36: Form Validation Feedback | 16.3, 16.4, 16.5 | Zod + inline errors | 5, 11, 16 |
| Property 37: API Error Mapping | 5.9, 16.6 | Error field mapping | 11 |
| Property 38: Toast Notifications | 16.7, 19.6 | Toast system | 2, 35 |
| Property 39: Error Boundary Handling | 16.8, 32.5, 32.6 | Error boundaries | 1, 35 |
| Property 40: Error Logging | 16.9, 32.7, 49.2-49.5 | Sentry integration | 35, 39 |
| Property 41: Lazy Loading | 17.3 | next/image + Intersection Observer | 33 |
| Property 42: Resource Prefetching | 17.4 | next/link prefetch | 33 |
| Property 43: Keyboard Navigation | 18.3, 18.4 | Focus management | 34 |
| Property 44: Image Alt Text | 18.2 | Alt attributes | 34 |
| Property 45: Push Notification Flow | 19.2, 19.3, 19.4, 19.5 | Service Worker push | 26 |
| Property 46: Notification Preferences | 19.8, 19.9, 23.6 | Preference checks | 26 |
| Property 47: Search Result Grouping | 20.3, 20.5 | Grouped results + highlight | 8, 22 |
| Property 48: Search History Persistence | 20.6, 20.9 | localStorage | 22 |
| Property 49: Empty Search Handling | 20.8 | No results message | 22 |
| Property 50: Review Submission Validation | 21.3, 21.4, 21.5 | Zod schema | 20 |
| Property 51: Review Display and Filtering | 21.1, 21.6, 21.7, 21.8 | Sort/filter UI | 20 |
| Property 52: Favorites Synchronization | 22.2, 22.5, 22.6, 22.7, 22.8, 22.9 | API + localStorage sync | 21 |
| Property 53: Analytics Event Tracking | 23.2, 23.3, 23.4, 23.5, 23.8, 23.9 | GA4 events | 38 |
| Property 54: Input Sanitization | 24.4 | DOMPurify | 40 |
| Property 55: API Response Validation | 24.5 | Zod schemas | 40 |
| Property 56: Sensitive Data Protection | 24.7, 49.9 | Sentry beforeSend | 39, 40 |
| Property 57: HTTPS Enforcement | 24.1 | Axios config | 40 |
| Property 58: Rate Limiting | 24.6 | Token bucket | 40 |
| Property 59: CSRF Protection | 24.8 | CSRF tokens | 40 |
| Property 60: Theme Toggle Persistence | 27.6, 27.7 | localStorage | 42 |
| Property 61: WebSocket Heartbeat | 28.4, 28.5 | Ping/pong messages | 17 |
| Property 62: Date Validation | 30.5 | Future date check | 37 |
| Property 63: Relative Time Display | 30.6 | date-fns formatDistance | 37 |
| Property 64: Timezone Handling | 30.7 | Timezone conversion | 37 |
| Property 65: Loading State Display | 31.1, 31.2, 31.3, 31.5, 31.7 | Skeletons/spinners | 2, 36 |
| Property 66: Error Recovery | 32.1, 32.9 | Retry + form preservation | 35 |
| Property 67: Social Sharing | 33.2, 33.3, 33.4, 33.6, 33.7, 33.8, 33.9 | Web Share API | 27 |
| Property 68: Loyalty Points Display | 34.2, 34.3, 34.5, 34.7, 34.8, 34.9 | Points components | 16 |
| Property 69: Student Discount Workflow | 35.3, 35.4, 35.5, 35.6, 35.8 | Upload + status | 16 |
| Property 70: Booking Confirmation Completeness | 39.1, 39.2, 39.3, 39.4, 39.6, 39.8, 39.9 | Confirmation page | 13 |
| Property 71: Cancellation Workflow | 40.1, 40.2, 40.3, 40.4, 40.5, 40.6, 40.8 | Cancel flow | 14 |
| Property 72: Cancellation Prevention | 40.9 | Date check | 14 |
| Property 73: Festival Display | 41.2, 41.3, 41.4, 41.5, 41.6, 41.7, 41.8, 41.9 | Festival components | 25 |
| Property 74: Contact Form Submission | 42.3, 42.4, 42.9 | Form + API | 29 |
| Property 75: SEO Metadata Completeness | 43.1, 43.2, 43.3, 43.6, 43.7 | Meta tags | 30 |
| Property 76: SEO Heading Hierarchy | 43.8 | h1, h2, h3 structure | 30 |
| Property 77: Currency Conversion | 44.3, 44.4, 44.5, 44.6, 44.9 | Exchange rates | 28 |
| Property 78: Admin Access Control | 45.1, 45.2, 45.9 | Role check + redirect | 31 |
| Property 79: Local Storage Persistence | 48.2, 48.3, 48.4 | Zustand persist | 3, 41 |
| Property 80: Login Data Sync | 48.5 | Sync on login | 41 |
| Property 81: Storage Schema Migration | 48.8 | Version + migration | 41 |
| Property 82: Storage Quota Handling | 48.9 | Quota check | 41 |
| Property 83: Performance Monitoring | 49.6, 49.7, 49.8 | Web Vitals + marks | 39 |
| Property 84: Cookie Consent Compliance | 50.5 | Consent management | 32 |
| Property 85: GDPR Data Rights | 50.7, 50.8 | Data export/delete | 32 |

---

## Summary Statistics

- **Total Tasks**: 47 task groups (160+ individual tasks)
- **Total Requirements**: 50 requirements with 450+ acceptance criteria
- **Total Properties**: 85 correctness properties
- **Technology Stack**: Next.js 14, TypeScript, Tailwind CSS, Zustand, React Query, Axios, Leaflet, next-intl, Stripe, Sentry, GA4
- **Testing**: Vitest, React Testing Library, Playwright, fast-check
- **PWA**: next-pwa, Workbox, Service Worker, IndexedDB
- **Optional Tasks**: Marked with [*] — testing tasks for faster MVP delivery

---

## Implementation Order

1. **Foundation** (Tasks 1-3): Project setup, UI components, state management
2. **Core Features** (Tasks 4-10): Auth, API client, main screens, navigation, maps
3. **Booking System** (Tasks 11-15): Booking flow, payment, confirmation, emergency alerts
4. **User Features** (Tasks 16-22): Profile, AI chat, i18n, PWA, reviews, favorites, search
5. **Extended Features** (Tasks 23-32): Hotels, guides, festivals, notifications, sharing, currency, contact, SEO, admin, legal
6. **Quality & Performance** (Tasks 33-43): Performance, accessibility, error handling, UX, dates, analytics, monitoring, security, persistence, theme, React Query
7. **Testing & Deployment** (Tasks 44-47): Test infrastructure, E2E tests, deployment, final integration
