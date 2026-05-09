# Design Document: DerLg.com Frontend Implementation

## Overview

### Purpose

This design document specifies the technical architecture and implementation details for the DerLg.com frontend application - a Progressive Web App (PWA) for Cambodia travel booking built with Next.js 14. The application provides five main screens (Home, Explore, Booking, My Trip, Profile), an AI-powered travel assistant with full-screen chat interface, offline map support, multi-language capabilities, and comprehensive booking management.

### Scope

The frontend application encompasses:
- Next.js 14 App Router architecture with server and client components
- Authentication system with JWT token management
- Five main navigation screens with responsive design
- AI chat interface with WebSocket connection to Python AI Agent
- Booking flows for trips, hotels, transportation, and guides
- Payment integration with Stripe and QR code support
- Emergency alert system with GPS location
- Offline map with Leaflet.js and service worker caching
- PWA functionality with installability and offline support
- Multi-language support (EN, KH, ZH) with next-intl
- State management with Zustand and React Query
- Comprehensive testing infrastructure

### Technology Stack

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


## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Browser"
        UI[Next.js UI Layer]
        SW[Service Worker]
        Cache[Browser Cache]
        LocalStorage[Local Storage]
    end
    
    subgraph "State Management"
        Zustand[Zustand Store]
        ReactQuery[React Query Cache]
    end
    
    subgraph "Communication Layer"
        APIClient[Axios API Client]
        WSClient[WebSocket Client]
    end
    
    subgraph "Backend Services"
        NestAPI[NestJS REST API]
        AIAgent[Python AI Agent]
        Stripe[Stripe API]
    end
    
    UI --> Zustand
    UI --> ReactQuery
    UI --> APIClient
    UI --> WSClient
    UI --> SW
    
    APIClient --> NestAPI
    WSClient --> AIAgent
    APIClient --> Stripe
    
    SW --> Cache
    UI --> LocalStorage
    
    ReactQuery --> APIClient
```

### Next.js App Router Structure

```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   ├── register/
│   │   └── page.tsx
│   └── layout.tsx (auth layout without main nav)
├── (main)/
│   ├── page.tsx (Home)
│   ├── explore/
│   │   └── page.tsx
│   ├── booking/
│   │   ├── page.tsx
│   │   ├── [id]/
│   │   │   └── page.tsx
│   │   └── payment/
│   │       └── page.tsx
│   ├── my-trip/
│   │   ├── page.tsx
│   │   └── [bookingId]/
│   │       └── page.tsx
│   ├── profile/
│   │   └── page.tsx
│   └── layout.tsx (main layout with nav)
├── api/
│   ├── auth/
│   │   └── refresh/
│   │       └── route.ts
│   └── health/
│       └── route.ts
├── layout.tsx (root layout)
├── error.tsx (error boundary)
├── not-found.tsx
└── globals.css
```

### Component Architecture

The application follows a layered component architecture:

1. **Server Components (Default)**
   - Page layouts and static content
   - Initial data fetching with React Server Components
   - SEO-optimized content rendering

2. **Client Components (Explicit "use client")**
   - Interactive UI elements (forms, modals, drawers)
   - State management consumers
   - WebSocket connections
   - Browser API usage (geolocation, notifications)

3. **Component Hierarchy**
   ```
   Page (Server Component)
   ├── Layout (Server Component)
   │   ├── Navigation (Client Component)
   │   └── Footer (Server Component)
   ├── Content Container (Server Component)
   │   ├── Interactive Feature (Client Component)
   │   │   ├── Form (Client Component)
   │   │   └── Modal (Client Component)
   │   └── Static Content (Server Component)
   └── AI Chat Button (Client Component)
       └── AI Chat Interface (Client Component)
   ```

### State Management Architecture


**Zustand Store (Client State)**

```typescript
interface AppState {
  // Auth state
  user: User | null;
  isAuthenticated: boolean;
  
  // UI state
  isChatOpen: boolean;
  isDrawerOpen: boolean;
  activeModal: string | null;
  
  // Preferences
  language: 'en' | 'kh' | 'zh';
  theme: 'light' | 'dark';
  currency: string;
  
  // Actions
  setUser: (user: User | null) => void;
  openChat: () => void;
  closeChat: () => void;
  setLanguage: (lang: string) => void;
  setTheme: (theme: string) => void;
}
```

**React Query (Server State)**

- Manages all API data fetching and caching
- Automatic background refetching
- Optimistic updates for mutations
- Stale-while-revalidate strategy
- Query keys organized by domain:
  - `['trips', filters]`
  - `['bookings', userId]`
  - `['user', userId]`
  - `['festivals', filters]`

### Data Flow Patterns

**1. Authentication Flow**

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant APIClient
    participant Backend
    participant Zustand
    
    User->>UI: Submit login credentials
    UI->>APIClient: POST /auth/login
    APIClient->>Backend: Request with credentials
    Backend->>APIClient: Return tokens + user data
    APIClient->>Zustand: Store user state
    APIClient->>UI: Set httpOnly cookies
    UI->>User: Redirect to home
```

**2. Booking Flow**

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant ReactQuery
    participant Backend
    participant Stripe
    
    User->>UI: Select trip and dates
    UI->>ReactQuery: Check availability
    ReactQuery->>Backend: GET /trips/:id/availability
    Backend->>ReactQuery: Return available slots
    UI->>User: Show booking form
    User->>UI: Submit booking
    UI->>ReactQuery: Create booking mutation
    ReactQuery->>Backend: POST /bookings
    Backend->>ReactQuery: Return booking ID
    UI->>User: Navigate to payment
    User->>UI: Submit payment
    UI->>Stripe: Process payment
    Stripe->>UI: Payment confirmation
    UI->>ReactQuery: Confirm booking
    ReactQuery->>Backend: PATCH /bookings/:id/confirm
    Backend->>ReactQuery: Return confirmed booking
    UI->>User: Show confirmation page
```


**3. AI Chat Flow**

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant WSClient
    participant AIAgent
    participant Zustand
    
    User->>UI: Open chat
    UI->>Zustand: Set isChatOpen = true
    UI->>WSClient: Establish WebSocket connection
    WSClient->>AIAgent: Connect with auth token
    AIAgent->>WSClient: Connection confirmed
    WSClient->>UI: Update connection status
    
    User->>UI: Send message
    UI->>WSClient: Send via WebSocket
    WSClient->>AIAgent: Transmit message
    UI->>UI: Display user message
    UI->>UI: Show typing indicator
    
    AIAgent->>WSClient: Stream response chunks
    WSClient->>UI: Receive chunks
    UI->>UI: Update message display
    AIAgent->>WSClient: Send complete response
    UI->>UI: Hide typing indicator
    
    User->>UI: Close chat
    UI->>WSClient: Close connection
    UI->>Zustand: Set isChatOpen = false
```

### Offline Architecture

**Service Worker Strategy**

```typescript
// Cache strategies by resource type
const cacheStrategies = {
  // Static assets: Cache first, fallback to network
  static: 'CacheFirst',
  
  // API requests: Network first, fallback to cache
  api: 'NetworkFirst',
  
  // Images: Cache first with expiration
  images: 'CacheFirst',
  
  // Map tiles: Cache first with size limits
  mapTiles: 'CacheFirst',
};

// Cache names
const CACHES = {
  static: 'derlg-static-v1',
  api: 'derlg-api-v1',
  images: 'derlg-images-v1',
  mapTiles: 'derlg-maps-v1',
};
```

**Offline Data Sync**

- Queue mutations in IndexedDB when offline
- Sync queue when connection restored
- Conflict resolution: last-write-wins
- User notification of sync status


## Components and Interfaces

### Core UI Components

**1. Navigation Component**

```typescript
// components/Navigation.tsx
'use client';

interface NavigationProps {
  user: User | null;
}

export function Navigation({ user }: NavigationProps) {
  const { language, setLanguage } = useAppStore();
  const pathname = usePathname();
  
  return (
    <nav className="fixed bottom-0 md:top-0 w-full">
      <NavItem href="/" icon={HomeIcon} active={pathname === '/'} />
      <NavItem href="/explore" icon={CompassIcon} />
      <NavItem href="/booking" icon={CalendarIcon} />
      <NavItem href="/my-trip" icon={MapIcon} />
      <NavItem href="/profile" icon={UserIcon} />
      <LanguageSelector value={language} onChange={setLanguage} />
      <AIButton onClick={openChat} />
    </nav>
  );
}
```

**2. AI Chat Interface**

```typescript
// components/AIChat.tsx
'use client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'trip_card' | 'hotel_card' | 'action_buttons';
  metadata?: Record<string, any>;
  timestamp: Date;
}

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIChat({ isOpen, onClose }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const { connection, send, status } = useWebSocket();
  
  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: input,
      type: 'text',
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);
    
    await send({ message: input, context: getContext() });
  };
  
  return (
    <Drawer isOpen={isOpen} onClose={onClose} position="right" fullScreen>
      <ChatHeader status={status} onClose={onClose} />
      <MessageList messages={messages} />
      {isTyping && <TypingIndicator />}
      <ChatInput 
        value={input} 
        onChange={setInput} 
        onSend={handleSend}
        disabled={status !== 'connected'}
      />
    </Drawer>
  );
}
```

**3. Booking Form Component**

```typescript
// components/BookingForm.tsx
'use client';

interface BookingFormProps {
  tripId: string;
  onSuccess: (bookingId: string) => void;
}

const bookingSchema = z.object({
  startDate: z.date().min(new Date(), 'Date must be in the future'),
  guestCount: z.number().min(1).max(20),
  specialRequests: z.string().max(500).optional(),
  applyLoyaltyPoints: z.boolean(),
  studentDiscount: z.boolean(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

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
    <form onSubmit={handleSubmit(onSubmit)}>
      <DatePicker {...register('startDate')} error={errors.startDate?.message} />
      <NumberInput {...register('guestCount')} error={errors.guestCount?.message} />
      <Textarea {...register('specialRequests')} error={errors.specialRequests?.message} />
      <Checkbox {...register('applyLoyaltyPoints')} label="Use loyalty points" />
      <Checkbox {...register('studentDiscount')} label="Apply student discount" />
      <Button type="submit" loading={createBooking.isPending}>
        Book Now
      </Button>
    </form>
  );
}
```


**4. Payment Component**

```typescript
// components/PaymentForm.tsx
'use client';

import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

interface PaymentFormProps {
  bookingId: string;
  amount: number;
  onSuccess: () => void;
}

function PaymentFormInner({ bookingId, amount, onSuccess }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'qr'>('card');
  
  const processPayment = useMutation({
    mutationFn: async (paymentData: any) => {
      if (paymentMethod === 'card') {
        const { error, paymentIntent } = await stripe!.confirmCardPayment(
          paymentData.clientSecret,
          { payment_method: { card: elements!.getElement(CardElement)! } }
        );
        if (error) throw error;
        return paymentIntent;
      } else {
        return api.post(`/payments/${bookingId}/qr`, paymentData);
      }
    },
    onSuccess,
  });
  
  return (
    <div>
      <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} />
      {paymentMethod === 'card' ? (
        <CardElement options={cardElementOptions} />
      ) : (
        <QRCodeDisplay bookingId={bookingId} amount={amount} />
      )}
      <Button onClick={() => processPayment.mutate({ bookingId, amount })}>
        Pay ${amount}
      </Button>
    </div>
  );
}

export function PaymentForm(props: PaymentFormProps) {
  const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY!);
  return (
    <Elements stripe={stripePromise}>
      <PaymentFormInner {...props} />
    </Elements>
  );
}
```

**5. Map Component**

```typescript
// components/Map.tsx
'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface MapProps {
  center: [number, number];
  zoom: number;
  markers: Array<{
    id: string;
    position: [number, number];
    title: string;
    type: 'place' | 'festival' | 'booking';
  }>;
  onMarkerClick?: (id: string) => void;
}

export function Map({ center, zoom, markers, onMarkerClick }: MapProps) {
  const { isOffline } = useNetworkStatus();
  
  return (
    <MapContainer center={center} zoom={zoom} className="h-full w-full">
      <TileLayer
        url={isOffline 
          ? '/offline-tiles/{z}/{x}/{y}.png' 
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        }
        attribution='&copy; OpenStreetMap contributors'
      />
      {markers.map(marker => (
        <Marker 
          key={marker.id} 
          position={marker.position}
          icon={getMarkerIcon(marker.type)}
          eventHandlers={{
            click: () => onMarkerClick?.(marker.id)
          }}
        >
          <Popup>{marker.title}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
```

### Custom Hooks

**1. useWebSocket Hook**

```typescript
// hooks/useWebSocket.ts

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
  url,
  onMessage,
  onError,
  reconnect = true,
  reconnectInterval = 1000,
  maxReconnectAttempts = 5,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [status, setStatus] = useState<UseWebSocketReturn['status']>('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  
  const connect = useCallback(() => {
    setStatus('connecting');
    const ws = new WebSocket(url);
    
    ws.onopen = () => {
      setStatus('connected');
      setReconnectAttempts(0);
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
        const delay = reconnectInterval * Math.pow(2, reconnectAttempts);
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempts(prev => prev + 1);
          connect();
        }, delay);
      }
    };
    
    wsRef.current = ws;
  }, [url, reconnect, reconnectAttempts, maxReconnectAttempts]);
  
  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);
  
  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);
  
  const close = useCallback(() => {
    wsRef.current?.close();
  }, []);
  
  return { send, close, status, reconnectAttempts };
}
```


**2. useAuth Hook**

```typescript
// hooks/useAuth.ts

interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const { user, setUser } = useAppStore();
  const router = useRouter();
  
  const loginMutation = useMutation({
    mutationFn: (credentials: LoginCredentials) => 
      api.post('/auth/login', credentials),
    onSuccess: (response) => {
      setUser(response.data.user);
      // Tokens stored in httpOnly cookies by backend
      router.push('/');
    },
  });
  
  const registerMutation = useMutation({
    mutationFn: (data: RegisterData) => 
      api.post('/auth/register', data),
    onSuccess: (response) => {
      setUser(response.data.user);
      router.push('/');
    },
  });
  
  const logoutMutation = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      setUser(null);
      router.push('/login');
    },
  });
  
  const refreshToken = async () => {
    try {
      const response = await api.post('/auth/refresh');
      setUser(response.data.user);
    } catch (error) {
      setUser(null);
      router.push('/login');
    }
  };
  
  return {
    user,
    isAuthenticated: !!user,
    isLoading: loginMutation.isPending || registerMutation.isPending,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    refreshToken,
  };
}
```

**3. useEmergencyAlert Hook**

```typescript
// hooks/useEmergencyAlert.ts

interface UseEmergencyAlertReturn {
  sendAlert: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

export function useEmergencyAlert(bookingId: string): UseEmergencyAlertReturn {
  const [location, setLocation] = useState<GeolocationCoordinates | null>(null);
  
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

### API Client Implementation

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
      withCredentials: true, // Send cookies
    });
    
    this.setupInterceptors();
  }
  
  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add common headers
        config.headers['Content-Type'] = 'application/json';
        config.headers['Accept-Language'] = this.getLanguage();
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;
        
        // Handle 401 Unauthorized
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // Wait for token refresh
            return new Promise((resolve) => {
              this.refreshSubscribers.push((token: string) => {
                resolve(this.client(originalRequest));
              });
            });
          }
          
          originalRequest._retry = true;
          this.isRefreshing = true;
          
          try {
            await this.refreshToken();
            this.isRefreshing = false;
            this.refreshSubscribers.forEach(cb => cb('refreshed'));
            this.refreshSubscribers = [];
            return this.client(originalRequest);
          } catch (refreshError) {
            this.isRefreshing = false;
            // Redirect to login
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }
        
        // Handle other errors
        return Promise.reject(this.handleError(error));
      }
    );
  }
  
  private async refreshToken() {
    const response = await this.client.post('/auth/refresh');
    return response.data;
  }
  
  private getLanguage(): string {
    return localStorage.getItem('language') || 'en';
  }
  
  private handleError(error: AxiosError): Error {
    if (error.response) {
      // Server responded with error
      const message = (error.response.data as any)?.message || 'An error occurred';
      return new Error(message);
    } else if (error.request) {
      // Request made but no response
      return new Error('Network error. Please check your connection.');
    } else {
      // Something else happened
      return new Error(error.message);
    }
  }
  
  // Public methods
  get<T>(url: string, config?: any) {
    return this.client.get<T>(url, config);
  }
  
  post<T>(url: string, data?: any, config?: any) {
    return this.client.post<T>(url, data, config);
  }
  
  put<T>(url: string, data?: any, config?: any) {
    return this.client.put<T>(url, data, config);
  }
  
  patch<T>(url: string, data?: any, config?: any) {
    return this.client.patch<T>(url, data, config);
  }
  
  delete<T>(url: string, config?: any) {
    return this.client.delete<T>(url, config);
  }
}

export const api = new APIClient();
```


## Data Models

### TypeScript Interfaces

**User and Authentication**

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  profilePicture: string | null;
  role: 'user' | 'admin';
  loyaltyPoints: number;
  studentDiscountStatus: 'none' | 'pending' | 'approved' | 'rejected';
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

interface UserPreferences {
  language: 'en' | 'kh' | 'zh';
  currency: string;
  theme: 'light' | 'dark';
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone?: string;
}
```

**Trip and Booking**

```typescript
interface Trip {
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  duration: number; // days
  price: number;
  currency: string;
  category: 'temples' | 'nature' | 'culture' | 'adventure' | 'food';
  images: string[];
  itinerary: ItineraryDay[];
  included: string[];
  excluded: string[];
  meetingPoint: string;
  pickupInfo: string;
  cancellationPolicy: string;
  maxGuests: number;
  rating: number;
  reviewCount: number;
  loyaltyPointsEarned: number;
  studentDiscountPercent: number;
  availableDates: Date[];
  createdAt: Date;
  updatedAt: Date;
}

interface ItineraryDay {
  day: number;
  title: string;
  description: string;
  activities: string[];
  meals: string[];
  accommodation: string | null;
}

interface Booking {
  id: string;
  userId: string;
  tripId: string | null;
  hotelId: string | null;
  transportationId: string | null;
  guideId: string | null;
  type: 'trip' | 'hotel' | 'transportation' | 'guide';
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  startDate: Date;
  endDate: Date;
  guestCount: number;
  specialRequests: string | null;
  totalPrice: number;
  currency: string;
  discounts: BookingDiscount[];
  loyaltyPointsUsed: number;
  loyaltyPointsEarned: number;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paymentMethod: 'card' | 'qr';
  qrCode: string | null;
  confirmationCode: string;
  createdAt: Date;
  updatedAt: Date;
}

interface BookingDiscount {
  type: 'student' | 'loyalty' | 'promo';
  amount: number;
  description: string;
}
```

**Place and Festival**

```typescript
interface Place {
  id: string;
  name: string;
  description: string;
  category: 'temples' | 'nature' | 'culture' | 'adventure' | 'food';
  region: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  images: string[];
  priceRange: 'free' | 'budget' | 'moderate' | 'luxury';
  rating: number;
  reviewCount: number;
  openingHours: string;
  entryFee: number | null;
  relatedTrips: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface Festival {
  id: string;
  name: string;
  description: string;
  type: 'religious' | 'cultural' | 'music' | 'food';
  startDate: Date;
  endDate: Date;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  images: string[];
  activities: string[];
  relatedTrips: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

**Hotel and Transportation**

```typescript
interface Hotel {
  id: string;
  name: string;
  description: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  images: string[];
  rating: number;
  reviewCount: number;
  amenities: string[];
  roomTypes: RoomType[];
  checkInTime: string;
  checkOutTime: string;
  cancellationPolicy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface RoomType {
  id: string;
  name: string;
  description: string;
  capacity: number;
  pricePerNight: number;
  images: string[];
  amenities: string[];
}

interface Transportation {
  id: string;
  type: 'bus' | 'van' | 'private_car';
  name: string;
  description: string;
  departureLocation: string;
  arrivalLocation: string;
  schedule: TransportationSchedule[];
  capacity: number;
  price: number;
  amenities: string[];
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface TransportationSchedule {
  id: string;
  departureTime: string;
  arrivalTime: string;
  availableDates: Date[];
  availableSeats: number;
}
```

**Guide and Review**

```typescript
interface Guide {
  id: string;
  name: string;
  bio: string;
  profilePicture: string;
  languages: string[];
  specialties: string[];
  experience: number; // years
  certifications: string[];
  rating: number;
  reviewCount: number;
  pricePerHour: number;
  pricePerDay: number;
  availability: GuideAvailability[];
  createdAt: Date;
  updatedAt: Date;
}

interface GuideAvailability {
  date: Date;
  slots: Array<{
    startTime: string;
    endTime: string;
    isBooked: boolean;
  }>;
}

interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  targetId: string; // trip, hotel, guide, etc.
  targetType: 'trip' | 'hotel' | 'guide' | 'transportation';
  rating: number;
  title: string;
  content: string;
  images: string[];
  isVerifiedBooking: boolean;
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

**AI Chat**

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'trip_card' | 'hotel_card' | 'action_buttons';
  metadata?: {
    tripId?: string;
    hotelId?: string;
    actions?: ChatAction[];
  };
  timestamp: Date;
}

interface ChatAction {
  type: 'book_trip' | 'view_details' | 'save_favorite' | 'share';
  label: string;
  data: Record<string, any>;
}

interface WebSocketMessage {
  type: 'message' | 'typing' | 'error' | 'connection';
  data: any;
  timestamp: string;
}
```

**Emergency Alert**

```typescript
interface EmergencyAlert {
  id: string;
  userId: string;
  bookingId: string;
  location: {
    latitude: number;
    longitude: number;
  };
  status: 'pending' | 'acknowledged' | 'resolved';
  message: string | null;
  createdAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following redundancies and consolidations:

**Redundancy Analysis:**
- Authentication token storage (2.3, 24.2, 48.1) - All specify httpOnly cookies, can be consolidated
- WebSocket connection establishment (9.1, 28.1) - Duplicate requirements
- Local storage persistence (13.5, 22.8, 48.2, 48.3, 48.4) - Multiple properties about local storage can be grouped
- Error display and retry (16.4, 32.1) - Similar error handling patterns
- API token inclusion (2.6, 15.2) - Duplicate requirements about auth headers
- Offline caching (11.2, 11.3, 12.3) - Overlapping caching requirements
- Form validation (16.3, 16.4, 16.5) - Can be combined into comprehensive form validation property
- Date/time formatting (30.2, 30.3, 30.8) - Can be consolidated into locale-aware formatting property

**Consolidated Properties:**
After removing redundancies, the following unique properties remain for testing.

### Property 1: Authentication Token Round-Trip

*For any* valid login or registration credentials, submitting them should result in authentication tokens being stored in httpOnly cookies and the user being authenticated in the application state.

**Validates: Requirements 2.1, 2.2, 2.3, 24.2, 48.1**

### Property 2: Token Refresh on Expiration

*For any* expired Auth_Token with a valid Refresh_Token, the system should automatically obtain a new Auth_Token without user intervention.

**Validates: Requirements 2.4, 15.5**

### Property 3: Authentication Failure Redirect

*For any* invalid or expired Refresh_Token, the system should clear authentication state and redirect to the login page.

**Validates: Requirements 2.5, 15.6**

### Property 4: Authenticated Request Authorization

*For any* authenticated API request, the Auth_Token should be included in the Authorization header.

**Validates: Requirements 2.6, 15.2, 15.3**

### Property 5: Logout State Clearing

*For any* authenticated user, logging out should clear all authentication tokens and application state, then redirect to the home page.

**Validates: Requirements 2.7, 48.7**

### Property 6: Protected Route Access Control

*For any* protected route, accessing it without valid authentication should redirect to the login page with a return URL parameter.

**Validates: Requirements 2.8, 2.9**

### Property 7: Navigation Preservation

*For any* navigation action (clicking trip, category, place, festival, booking), the system should navigate to the correct destination with appropriate data.

**Validates: Requirements 3.4, 3.7, 4.6, 7.5, 20.4, 36.8, 41.3**

### Property 8: Filter URL Persistence

*For any* filter selection on the Explore screen, the filter state should be persisted in URL query parameters for shareable links.

**Validates: Requirements 4.7, 4.8**

### Property 9: Search Debouncing

*For any* search input, the system should debounce the input with 300ms delay before calling the API.

**Validates: Requirements 4.5, 17.7, 20.2**

### Property 10: Booking Form Validation

*For any* booking form submission, the system should validate date availability, guest count, and required fields before creating the booking.

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 11: Booking Price Calculation

*For any* booking, the system should display total price with breakdown of costs, applicable discounts (student, loyalty), and loyalty points to be earned.

**Validates: Requirements 5.4, 5.5, 5.6, 34.3, 35.7, 35.9**

### Property 12: Double-Submission Prevention

*For any* form submission (booking, payment, profile update), the submit button should be disabled after the first submission to prevent double-submission.

**Validates: Requirements 5.8, 31.4**

### Property 13: Payment Method Handling

*For any* payment screen, the system should fetch payment options and handle both Stripe card payments and QR code payments correctly.

**Validates: Requirements 6.1, 6.3, 6.4**

### Property 14: Payment Result Navigation

*For any* payment attempt, success should navigate to confirmation page and failure should display error message with retry option.

**Validates: Requirements 6.5, 6.6, 32.8**

### Property 15: Booking Status Filtering

*For any* booking list view (Upcoming/Past), the system should filter bookings by status correctly (confirmed/pending for Upcoming, completed/cancelled for Past).

**Validates: Requirements 7.2, 7.3**

### Property 16: Booking Display Completeness

*For any* booking, the system should display all required information including trip name, dates, location, status, total price, and QR code.

**Validates: Requirements 7.4, 7.9, 36.1-36.7, 37.1, 37.3, 37.4, 38.1, 38.3, 39.2**

### Property 17: Emergency Alert Availability

*For any* booking within 24 hours of start time, the Emergency Alert button should be displayed and functional.

**Validates: Requirements 7.6, 10.1**

### Property 18: Emergency Alert GPS Capture

*For any* emergency alert with granted GPS permission, the system should capture current coordinates and send them with the booking ID to the API.

**Validates: Requirements 10.2, 10.3, 10.4**

### Property 19: Profile Update Persistence

*For any* profile field edit (name, email, phone, password, preferences), saving should call the API and update the application state.

**Validates: Requirements 8.2, 8.5**

### Property 20: Language Change Reactivity

*For any* language selection change, the UI should update immediately and the preference should persist in local storage.

**Validates: Requirements 8.6, 13.4, 13.5**

### Property 21: Image Upload Validation and Compression

*For any* image upload (profile picture, review photos), the system should validate file type and size, compress the image, and show upload progress.

**Validates: Requirements 8.9, 29.2, 29.3, 29.4, 29.5, 35.3**

### Property 22: WebSocket Connection Lifecycle

*For any* AI chat session, opening the chat should establish a WebSocket connection, and closing the chat should close the connection.

**Validates: Requirements 9.1, 9.12, 28.1, 28.8**

### Property 23: WebSocket Message Round-Trip

*For any* message sent through the AI chat, it should be transmitted via WebSocket, displayed in the chat, and responses should be received and displayed.

**Validates: Requirements 9.3, 9.4, 9.5**

### Property 24: WebSocket Reconnection

*For any* WebSocket connection loss, the system should attempt to reconnect automatically with exponential backoff and queue messages sent while disconnected.

**Validates: Requirements 9.10, 28.2, 28.3, 28.6**

### Property 25: Chat History Persistence

*For any* chat session, messages should persist in local storage and be restored when the chat is reopened.

**Validates: Requirements 9.9, 48.3**

### Property 26: Structured Message Rendering

*For any* AI message type (text, trip card, hotel card, action buttons), the system should render it correctly with appropriate interactive elements.

**Validates: Requirements 9.5, 9.6, 9.7**

### Property 27: Connection Status Display

*For any* WebSocket connection state (connecting, connected, disconnected), the UI should display the corresponding status indicator.

**Validates: Requirements 9.11, 28.7**

### Property 28: Map Tile Caching

*For any* map region viewed, the system should cache visible tiles for offline access via the Service Worker.

**Validates: Requirements 11.2, 11.3, 11.6, 12.3**

### Property 29: Offline Map Functionality

*For any* cached map region, when offline the system should serve cached tiles and display markers for saved places and bookings.

**Validates: Requirements 11.4, 11.8, 11.9, 12.5**

### Property 30: PWA Installation

*For any* device meeting PWA criteria, the system should display an install prompt and be installable.

**Validates: Requirements 12.6**

### Property 31: Offline Sync

*For any* pending action (booking, profile update) performed while offline, the system should sync it when connection is restored.

**Validates: Requirements 12.9, 48.6**

### Property 32: Internationalization Completeness

*For any* selected language (EN, KH, ZH), all UI text, dates, times, and currencies should be formatted according to that locale.

**Validates: Requirements 13.3, 13.4, 13.6, 13.7, 13.8, 30.2, 30.3, 30.8, 44.5**

### Property 33: API Response Caching

*For any* API request, React Query should cache the response with appropriate stale time and implement automatic refetch on window focus.

**Validates: Requirements 14.6, 14.8**

### Property 34: Optimistic Updates

*For any* mutation (booking, profile update, favorite toggle), the system should implement optimistic UI updates with rollback on error.

**Validates: Requirements 14.7, 31.8**

### Property 35: Request Retry Logic

*For any* failed API request, the system should implement retry logic with exponential backoff (3 retries for 5xx errors, no retry for 4xx errors).

**Validates: Requirements 14.9, 15.9, 32.2, 32.3, 32.4**

### Property 36: Form Validation Feedback

*For any* form input, validation should occur on blur and submit, with error messages displayed below invalid fields and submit button disabled until valid.

**Validates: Requirements 16.3, 16.4, 16.5**

### Property 37: API Error Mapping

*For any* validation error from the Backend API, the system should map it to the corresponding form field and display the error message.

**Validates: Requirements 5.9, 16.6**

### Property 38: Toast Notifications

*For any* action result (success or error), the system should display a toast notification with appropriate message.

**Validates: Requirements 16.7, 19.6**

### Property 39: Error Boundary Handling

*For any* React error, error boundaries should catch it and display fallback UI with navigation options.

**Validates: Requirements 16.8, 32.5, 32.6**

### Property 40: Error Logging

*For any* error (JavaScript, promise rejection, API error), the system should log it to the monitoring service with appropriate context.

**Validates: Requirements 16.9, 32.7, 49.2, 49.3, 49.4, 49.5**

### Property 41: Lazy Loading

*For any* image below the fold, lazy loading should be implemented to defer loading until needed.

**Validates: Requirements 17.3**

### Property 42: Resource Prefetching

*For any* link hover, the system should prefetch the next page route and critical resources.

**Validates: Requirements 17.4**

### Property 43: Accessibility - Keyboard Navigation

*For any* interactive element, keyboard navigation should work and focus indicators should be visible.

**Validates: Requirements 18.3, 18.4**

### Property 44: Accessibility - Image Alt Text

*For any* image element, alt text should be present for screen reader accessibility.

**Validates: Requirements 18.2**

### Property 45: Push Notification Flow

*For any* granted push notification permission, the system should register a service worker, send the token to the API, and display received notifications.

**Validates: Requirements 19.2, 19.3, 19.4, 19.5**

### Property 46: Notification Preferences

*For any* notification preference setting, the system should respect it when sending notifications.

**Validates: Requirements 19.8, 19.9, 23.6**

### Property 47: Search Result Grouping

*For any* search query, results should be grouped by type (trips, places, festivals, hotels) with matching text highlighted.

**Validates: Requirements 20.3, 20.5**

### Property 48: Search History Persistence

*For any* search query, it should be added to search history which persists in local storage and can be cleared.

**Validates: Requirements 20.6, 20.9**

### Property 49: Empty Search Handling

*For any* search query returning no results, the system should display a "no results" message with suggestions.

**Validates: Requirements 20.8**

### Property 50: Review Submission Validation

*For any* review submission, the system should validate text length (10-1000 characters), enforce photo limit (5 max), and only allow reviews for completed bookings.

**Validates: Requirements 21.3, 21.4, 21.5**

### Property 51: Review Display and Filtering

*For any* item with reviews, the system should display average rating, review count, and allow sorting/filtering by rating with verified booking badges.

**Validates: Requirements 21.1, 21.6, 21.7, 21.8**

### Property 52: Favorites Synchronization

*For any* favorite toggle, the system should update via API for authenticated users or local storage for unauthenticated users, with sync on login.

**Validates: Requirements 22.2, 22.5, 22.6, 22.7, 22.8, 22.9**

### Property 53: Analytics Event Tracking

*For any* key user action (page view, search, booking, payment, chat interaction), the system should track it in analytics with anonymized data.

**Validates: Requirements 23.2, 23.3, 23.4, 23.5, 23.8, 23.9**

### Property 54: Security - Input Sanitization

*For any* user input, the system should sanitize it to prevent XSS attacks before rendering or sending to the API.

**Validates: Requirements 24.4**

### Property 55: Security - API Response Validation

*For any* API response, the system should validate the data structure before using it in the application.

**Validates: Requirements 24.5**

### Property 56: Security - Sensitive Data Protection

*For any* logging or error reporting, sensitive information (tokens, passwords) should be excluded.

**Validates: Requirements 24.7, 49.9**

### Property 57: Security - HTTPS Enforcement

*For any* network request, HTTPS should be used.

**Validates: Requirements 24.1**

### Property 58: Security - Rate Limiting

*For any* API endpoint, client-side rate limiting should prevent excessive requests.

**Validates: Requirements 24.6**

### Property 59: Security - CSRF Protection

*For any* state-changing request, CSRF protection should be implemented.

**Validates: Requirements 24.8**

### Property 60: Theme Toggle Persistence

*For any* theme change (light/dark), the UI should update immediately and the preference should persist in local storage.

**Validates: Requirements 27.6, 27.7**

### Property 61: WebSocket Heartbeat

*For any* active WebSocket connection, heartbeat messages should be sent periodically, and failed heartbeats should trigger reconnection.

**Validates: Requirements 28.4, 28.5**

### Property 62: Date Validation

*For any* booking date selection, the system should validate that dates are in the future and within available dates.

**Validates: Requirements 30.5**

### Property 63: Relative Time Display

*For any* recent timestamp, the system should display relative time (e.g., "2 hours ago").

**Validates: Requirements 30.6**

### Property 64: Timezone Handling

*For any* date/time communication with the API, timezone conversion should occur correctly.

**Validates: Requirements 30.7**

### Property 65: Loading State Display

*For any* async operation (API call, file upload, route transition), appropriate loading indicators (skeleton, spinner, progress bar) should be displayed.

**Validates: Requirements 31.1, 31.2, 31.3, 31.5, 31.7**

### Property 66: Error Recovery

*For any* network error, the system should display an error message with a retry button and preserve form data.

**Validates: Requirements 32.1, 32.9**

### Property 67: Social Sharing

*For any* shareable item (trip, place, booking), the system should provide sharing options (Web Share API or fallbacks) and track share events.

**Validates: Requirements 33.2, 33.3, 33.4, 33.6, 33.7, 33.8, 33.9**

### Property 68: Loyalty Points Display

*For any* booking or profile view, loyalty points balance, earned points, and redemption options should be displayed correctly.

**Validates: Requirements 34.2, 34.3, 34.5, 34.7, 34.8, 34.9**

### Property 69: Student Discount Workflow

*For any* student verification document upload, the system should validate file type/size, send to API, display status, and apply discount when approved.

**Validates: Requirements 35.3, 35.4, 35.5, 35.6, 35.8**

### Property 70: Booking Confirmation Completeness

*For any* confirmed booking, the system should display confirmation page, send email, provide PDF download, show QR code, and allow calendar export.

**Validates: Requirements 39.1, 39.2, 39.3, 39.4, 39.6, 39.8, 39.9**

### Property 71: Cancellation Workflow

*For any* cancellable booking, the system should display cancel button, show policy/refund, require confirmation, call API, update status, and send email.

**Validates: Requirements 40.1, 40.2, 40.3, 40.4, 40.5, 40.6, 40.8**

### Property 72: Cancellation Prevention

*For any* booking within the no-cancellation period, the cancel button should not be displayed or should be disabled.

**Validates: Requirements 40.9**

### Property 73: Festival Display and Interaction

*For any* festival, the system should display details, related trips, allow filtering, favoriting, show countdown, and send reminders.

**Validates: Requirements 41.2, 41.3, 41.4, 41.5, 41.6, 41.7, 41.8, 41.9**

### Property 74: Contact Form Submission

*For any* contact form submission, the system should validate fields, send to API, display success message, and enforce file attachment limits.

**Validates: Requirements 42.3, 42.4, 42.9**

### Property 75: SEO Metadata Completeness

*For any* page, the system should generate dynamic meta tags, structured data, canonical URLs, Open Graph tags, and Twitter Card tags.

**Validates: Requirements 43.1, 43.2, 43.3, 43.6, 43.7**

### Property 76: SEO Heading Hierarchy

*For any* page, proper heading hierarchy (h1, h2, h3) should be maintained.

**Validates: Requirements 43.8**

### Property 77: Currency Conversion

*For any* currency selection, the system should fetch exchange rates, convert all prices, format according to locale, and persist the preference.

**Validates: Requirements 44.3, 44.4, 44.5, 44.6, 44.9**

### Property 78: Admin Access Control

*For any* user with admin role, admin navigation should be visible and admin routes should be accessible; for non-admin users, admin routes should redirect.

**Validates: Requirements 45.1, 45.2, 45.9**

### Property 79: Local Storage Persistence

*For any* user preference (language, theme, currency, favorites, chat history), it should persist in local storage and be restored on app load.

**Validates: Requirements 48.2, 48.3, 48.4**

### Property 80: Login Data Sync

*For any* user login, local storage data (favorites, preferences) should sync with the Backend API.

**Validates: Requirements 48.5**

### Property 81: Storage Schema Migration

*For any* local storage schema change, the system should implement data migration to handle existing data.

**Validates: Requirements 48.8**

### Property 82: Storage Quota Handling

*For any* local storage operation, the system should respect browser storage limits and handle quota exceeded errors gracefully.

**Validates: Requirements 48.9**

### Property 83: Performance Monitoring

*For any* page load and critical user flow, performance metrics (load time, Core Web Vitals, custom marks) should be tracked.

**Validates: Requirements 49.6, 49.7, 49.8**

### Property 84: Cookie Consent Compliance

*For any* cookie preference selection, the system should respect it and disable non-essential cookies when rejected.

**Validates: Requirements 50.5**

### Property 85: GDPR Data Rights

*For any* user data request (download, deletion), the system should process it correctly.

**Validates: Requirements 50.7, 50.8**


## Error Handling

### Error Categories

**1. Network Errors**
- Connection timeout (30s default)
- Network unavailable
- DNS resolution failure
- Server unreachable

**Handling Strategy:**
- Display user-friendly error message
- Provide retry button
- Implement automatic retry with exponential backoff for transient errors
- Cache last successful response for offline fallback

**2. API Errors**

**4xx Client Errors:**
- 400 Bad Request: Display validation errors mapped to form fields
- 401 Unauthorized: Attempt token refresh, redirect to login if fails
- 403 Forbidden: Display access denied message
- 404 Not Found: Display not found page with navigation options
- 429 Too Many Requests: Display rate limit message with retry after time

**5xx Server Errors:**
- 500 Internal Server Error: Retry up to 3 times with exponential backoff
- 502 Bad Gateway: Retry with backoff
- 503 Service Unavailable: Display maintenance message
- 504 Gateway Timeout: Retry with backoff

**Handling Strategy:**
```typescript
const handleAPIError = (error: AxiosError) => {
  const status = error.response?.status;
  
  if (status === 401) {
    return refreshTokenAndRetry(error.config);
  }
  
  if (status && status >= 500) {
    return retryWithBackoff(error.config, 3);
  }
  
  if (status && status >= 400 && status < 500) {
    const message = error.response?.data?.message || 'Request failed';
    toast.error(message);
    return Promise.reject(error);
  }
  
  // Network error
  toast.error('Network error. Please check your connection.');
  return Promise.reject(error);
};
```

**3. Validation Errors**
- Form field validation failures
- File upload validation (type, size)
- Date validation (past dates, unavailable dates)
- Business rule violations (double booking, insufficient points)

**Handling Strategy:**
- Display inline error messages below fields
- Disable submit button until valid
- Preserve user input on error
- Map API validation errors to form fields

**4. WebSocket Errors**
- Connection failed
- Connection closed unexpectedly
- Message send failure
- Heartbeat timeout

**Handling Strategy:**
```typescript
const handleWebSocketError = (error: Event) => {
  console.error('WebSocket error:', error);
  
  // Update connection status
  setConnectionStatus('error');
  
  // Attempt reconnection with exponential backoff
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
  setTimeout(() => reconnect(), delay);
  
  // Queue messages for retry
  queuePendingMessages();
  
  // Display user-friendly message
  toast.error('Connection lost. Reconnecting...');
};
```

**5. React Errors**
- Component render errors
- Event handler errors
- Lifecycle method errors
- Hook errors

**Handling Strategy:**
```typescript
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to monitoring service
    Sentry.captureException(error, { extra: errorInfo });
    
    // Update state to show fallback UI
    this.setState({ hasError: true, error });
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback 
          error={this.state.error}
          onReset={() => this.setState({ hasError: false })}
        />
      );
    }
    
    return this.props.children;
  }
}
```

**6. Payment Errors**
- Card declined
- Insufficient funds
- 3D Secure authentication failed
- Payment processing timeout
- QR code payment pending

**Handling Strategy:**
- Display specific error message from Stripe
- Allow retry with same or different payment method
- Preserve booking data
- Show payment status updates for QR code payments
- Provide support contact information

**7. File Upload Errors**
- File too large
- Invalid file type
- Upload timeout
- Server storage full

**Handling Strategy:**
- Validate before upload (client-side)
- Display progress indicator
- Show specific error message
- Allow retry
- Compress images before upload to reduce failures

### Error Logging and Monitoring

**Sentry Integration:**
```typescript
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event, hint) {
    // Exclude sensitive data
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers?.Authorization;
    }
    
    // Add user context for authenticated users
    if (user) {
      event.user = {
        id: user.id,
        email: user.email,
      };
    }
    
    return event;
  },
});
```

**Error Context:**
- User ID and email (if authenticated)
- Current route and navigation history
- Browser and device information
- Network status (online/offline)
- Recent user actions (breadcrumbs)
- API request/response details
- Component stack trace

### Graceful Degradation

**Offline Mode:**
- Serve cached content when offline
- Queue mutations for later sync
- Display offline banner
- Disable features requiring network
- Show cached map tiles

**Feature Detection:**
- Check for WebSocket support, fallback to polling
- Check for Web Share API, fallback to copy link
- Check for geolocation API, fallback to manual entry
- Check for push notification support, fallback to in-app only
- Check for service worker support, fallback to online-only mode

**Progressive Enhancement:**
- Core functionality works without JavaScript
- Enhanced features with JavaScript enabled
- Optimized experience with modern browser features
- Accessible fallbacks for all interactive elements


## Testing Strategy

### Overview

The testing strategy employs a dual approach combining unit tests for specific examples and edge cases with property-based tests for universal properties across all inputs. This ensures comprehensive coverage while avoiding redundant testing.

### Testing Pyramid

```
        /\
       /  \
      / E2E \          10% - End-to-End Tests (Critical User Flows)
     /______\
    /        \
   / Integr.  \       20% - Integration Tests (Component + API)
  /____________\
 /              \
/   Unit + PBT   \    70% - Unit Tests + Property-Based Tests
/__________________\
```

### Property-Based Testing

**Library:** fast-check (for TypeScript/JavaScript)

**Configuration:**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
});

// tests/setup.ts
import { fc } from 'fast-check';

// Configure fast-check
fc.configureGlobal({
  numRuns: 100, // Minimum 100 iterations per property test
  verbose: true,
  seed: Date.now(),
});
```

**Property Test Template:**
```typescript
import { describe, it, expect } from 'vitest';
import { fc } from 'fast-check';

describe('Feature: frontend-nextjs-implementation', () => {
  it('Property 1: Authentication Token Round-Trip', () => {
    /**
     * Feature: frontend-nextjs-implementation, Property 1: Authentication Token Round-Trip
     * For any valid login or registration credentials, submitting them should result 
     * in authentication tokens being stored in httpOnly cookies and the user being 
     * authenticated in the application state.
     */
    fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          password: fc.string({ minLength: 8, maxLength: 50 }),
        }),
        async (credentials) => {
          // Arrange
          const { result } = renderHook(() => useAuth());
          
          // Act
          await act(async () => {
            await result.current.login(credentials);
          });
          
          // Assert
          expect(result.current.isAuthenticated).toBe(true);
          expect(result.current.user).toBeDefined();
          expect(document.cookie).toContain('auth_token');
        }
      )
    );
  });
  
  it('Property 23: WebSocket Message Round-Trip', () => {
    /**
     * Feature: frontend-nextjs-implementation, Property 23: WebSocket Message Round-Trip
     * For any message sent through the AI chat, it should be transmitted via WebSocket,
     * displayed in the chat, and responses should be received and displayed.
     */
    fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 500 }),
        async (message) => {
          // Arrange
          const { result } = renderHook(() => useWebSocket({
            url: 'ws://localhost:8000/chat',
            onMessage: vi.fn(),
          }));
          
          await waitFor(() => {
            expect(result.current.status).toBe('connected');
          });
          
          // Act
          act(() => {
            result.current.send({ message });
          });
          
          // Assert
          await waitFor(() => {
            expect(result.current.onMessage).toHaveBeenCalled();
          });
        }
      )
    );
  });
});
```

**Generators for Domain Objects:**
```typescript
// tests/generators.ts
import { fc } from 'fast-check';

export const userArbitrary = fc.record({
  id: fc.uuid(),
  email: fc.emailAddress(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  phone: fc.option(fc.string({ minLength: 10, maxLength: 15 })),
  loyaltyPoints: fc.nat({ max: 100000 }),
  studentDiscountStatus: fc.constantFrom('none', 'pending', 'approved', 'rejected'),
});

export const tripArbitrary = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 10, maxLength: 100 }),
  description: fc.lorem({ maxCount: 50 }),
  duration: fc.integer({ min: 1, max: 30 }),
  price: fc.float({ min: 10, max: 10000, noNaN: true }),
  category: fc.constantFrom('temples', 'nature', 'culture', 'adventure', 'food'),
  maxGuests: fc.integer({ min: 1, max: 50 }),
});

export const bookingArbitrary = fc.record({
  id: fc.uuid(),
  userId: fc.uuid(),
  tripId: fc.uuid(),
  startDate: fc.date({ min: new Date() }),
  guestCount: fc.integer({ min: 1, max: 20 }),
  totalPrice: fc.float({ min: 10, max: 50000, noNaN: true }),
  status: fc.constantFrom('pending', 'confirmed', 'completed', 'cancelled'),
});

export const chatMessageArbitrary = fc.record({
  id: fc.uuid(),
  role: fc.constantFrom('user', 'assistant'),
  content: fc.string({ minLength: 1, maxLength: 1000 }),
  type: fc.constantFrom('text', 'trip_card', 'hotel_card', 'action_buttons'),
  timestamp: fc.date(),
});
```

### Unit Testing

**Framework:** Vitest + React Testing Library

**Focus Areas:**
- Specific examples demonstrating correct behavior
- Edge cases (empty inputs, boundary values, special characters)
- Error conditions and error handling
- Integration points between components
- UI interactions and user flows

**Example Unit Tests:**
```typescript
describe('BookingForm', () => {
  it('should display validation error for past dates', async () => {
    const { getByLabelText, getByText } = render(<BookingForm tripId="123" />);
    
    const dateInput = getByLabelText('Start Date');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    await userEvent.type(dateInput, yesterday.toISOString().split('T')[0]);
    await userEvent.tab(); // Trigger blur validation
    
    expect(getByText('Date must be in the future')).toBeInTheDocument();
  });
  
  it('should disable submit button while submitting', async () => {
    const { getByRole } = render(<BookingForm tripId="123" />);
    
    const submitButton = getByRole('button', { name: /book now/i });
    
    await userEvent.click(submitButton);
    
    expect(submitButton).toBeDisabled();
  });
  
  it('should handle empty guest count', async () => {
    const { getByLabelText, getByText } = render(<BookingForm tripId="123" />);
    
    const guestInput = getByLabelText('Number of Guests');
    
    await userEvent.clear(guestInput);
    await userEvent.tab();
    
    expect(getByText('Guest count is required')).toBeInTheDocument();
  });
});
```

### Integration Testing

**Focus:** Component interactions with API and state management

**Example:**
```typescript
describe('Booking Flow Integration', () => {
  it('should complete full booking flow', async () => {
    // Mock API responses
    server.use(
      rest.get('/api/trips/:id', (req, res, ctx) => {
        return res(ctx.json(mockTrip));
      }),
      rest.post('/api/bookings', (req, res, ctx) => {
        return res(ctx.json({ id: '123', status: 'confirmed' }));
      })
    );
    
    const { getByText, getByLabelText, getByRole } = render(
      <QueryClientProvider client={queryClient}>
        <TripDetailPage tripId="trip-123" />
      </QueryClientProvider>
    );
    
    // Wait for trip to load
    await waitFor(() => {
      expect(getByText(mockTrip.title)).toBeInTheDocument();
    });
    
    // Click book button
    await userEvent.click(getByRole('button', { name: /book now/i }));
    
    // Fill booking form
    const dateInput = getByLabelText('Start Date');
    await userEvent.type(dateInput, '2024-12-25');
    
    const guestInput = getByLabelText('Number of Guests');
    await userEvent.type(guestInput, '2');
    
    // Submit booking
    await userEvent.click(getByRole('button', { name: /confirm booking/i }));
    
    // Verify navigation to payment
    await waitFor(() => {
      expect(window.location.pathname).toBe('/booking/payment');
    });
  });
});
```

### End-to-End Testing

**Framework:** Playwright

**Critical User Flows:**
1. User registration and login
2. Trip search and booking with payment
3. AI chat interaction with trip recommendation
4. Profile update and student verification
5. Emergency alert with GPS
6. Offline map access
7. Multi-language switching
8. Booking cancellation and refund

**Example E2E Test:**
```typescript
import { test, expect } from '@playwright/test';

test('complete booking flow', async ({ page }) => {
  // Navigate to home
  await page.goto('/');
  
  // Search for trips
  await page.fill('[data-testid="search-input"]', 'Angkor Wat');
  await page.click('[data-testid="search-button"]');
  
  // Select first trip
  await page.click('[data-testid="trip-card"]:first-child');
  
  // Verify trip details loaded
  await expect(page.locator('h1')).toContainText('Angkor Wat');
  
  // Click book now
  await page.click('[data-testid="book-now-button"]');
  
  // Fill booking form
  await page.fill('[name="startDate"]', '2024-12-25');
  await page.fill('[name="guestCount"]', '2');
  
  // Submit booking
  await page.click('[data-testid="submit-booking"]');
  
  // Verify navigation to payment
  await expect(page).toHaveURL(/\/booking\/payment/);
  
  // Fill payment details
  await page.fill('[data-testid="card-number"]', '4242424242424242');
  await page.fill('[data-testid="card-expiry"]', '12/25');
  await page.fill('[data-testid="card-cvc"]', '123');
  
  // Submit payment
  await page.click('[data-testid="submit-payment"]');
  
  // Verify confirmation page
  await expect(page).toHaveURL(/\/booking\/confirmation/);
  await expect(page.locator('[data-testid="booking-reference"]')).toBeVisible();
});
```

### Test Coverage Goals

**Minimum Coverage:**
- Overall: 80%
- Critical paths (auth, booking, payment): 95%
- UI components: 70%
- Utilities and helpers: 90%
- API client: 95%

**Coverage Exclusions:**
- Type definitions
- Configuration files
- Test files
- Generated code

### Continuous Integration

**GitHub Actions Workflow:**
```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run type check
        run: npm run type-check
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
      
      - name: Build
        run: npm run build
```

### Testing Best Practices

**1. Test Isolation**
- Each test should be independent
- Use beforeEach/afterEach for setup/teardown
- Mock external dependencies
- Reset state between tests

**2. Test Naming**
- Use descriptive names: "should [expected behavior] when [condition]"
- Group related tests with describe blocks
- Tag property tests with feature name and property number

**3. Test Data**
- Use factories/generators for test data
- Avoid hardcoded values
- Use realistic data that matches production
- Test edge cases (empty, null, undefined, boundary values)

**4. Assertions**
- One logical assertion per test
- Use specific matchers (toHaveLength vs toBe)
- Assert on user-visible behavior, not implementation details
- Verify both positive and negative cases

**5. Mocking**
- Mock external services (API, WebSocket, geolocation)
- Use MSW for API mocking
- Mock timers for time-dependent tests
- Avoid over-mocking (test real integrations when possible)

**6. Accessibility Testing**
- Use jest-axe for automated a11y checks
- Test keyboard navigation
- Test screen reader announcements
- Verify ARIA attributes

**7. Performance Testing**
- Measure render times for critical components
- Test with large datasets
- Verify virtual scrolling performance
- Monitor bundle size impact

### Test Maintenance

**Regular Reviews:**
- Remove obsolete tests
- Update tests when requirements change
- Refactor duplicated test code
- Keep test coverage above thresholds

**Documentation:**
- Document complex test scenarios
- Explain non-obvious mocking
- Maintain test data generators
- Keep testing guidelines up to date



## Docker Development Environment

### Overview

The development environment uses Docker Compose to orchestrate five containerized services: PostgreSQL database, Redis cache, NestJS backend API, Next.js frontend, and Python AI Agent chatbot. This setup ensures consistent development environments across all team members and simplifies onboarding.

### Docker Architecture

```mermaid
graph TB
    subgraph "Docker Network: derlg-network"
        Frontend[Next.js Frontend<br/>:3000]
        Backend[NestJS Backend<br/>:3001]
        AIAgent[Python AI Agent<br/>:8000]
        PostgreSQL[(PostgreSQL<br/>:5432)]
        Redis[(Redis<br/>:6379)]
    end
    
    Frontend -->|HTTP API| Backend
    Frontend -->|WebSocket| AIAgent
    Backend -->|SQL| PostgreSQL
    Backend -->|Cache| Redis
    AIAgent -->|Cache| Redis
    
    Host[Host Machine<br/>localhost] -->|Port 3000| Frontend
    Host -->|Port 3001| Backend
    Host -->|Port 8000| AIAgent
    
    style Frontend fill:#61dafb
    style Backend fill:#e0234e
    style AIAgent fill:#3776ab
    style PostgreSQL fill:#336791
    style Redis fill:#dc382d
```

### Service Dependencies

**Startup Order:**
1. PostgreSQL (database must be ready first)
2. Redis (cache must be ready)
3. Backend (depends on PostgreSQL and Redis)
4. AI Agent (depends on Redis)
5. Frontend (depends on Backend and AI Agent)

**Health Checks:**
- PostgreSQL: `pg_isready` command
- Redis: `redis-cli ping` command
- Backend: HTTP GET `/health` endpoint
- AI Agent: HTTP GET `/health` endpoint
- Frontend: HTTP GET `/api/health` endpoint

### Docker Compose Configuration

**File: docker-compose.yml**

```yaml
version: '3.9'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: derlg-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: derlg_db
      POSTGRES_USER: derlg_user
      POSTGRES_PASSWORD: derlg_password_dev
      POSTGRES_HOST_AUTH_METHOD: scram-sha-256
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/database/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    networks:
      - derlg-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U derlg_user -d derlg_db"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: derlg-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass derlg_redis_password_dev
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - derlg-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s

  # NestJS Backend API
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
      target: development
    container_name: derlg-backend
    restart: unless-stopped
    environment:
      NODE_ENV: development
      PORT: 3001
      DATABASE_URL: postgresql://derlg_user:derlg_password_dev@postgres:5432/derlg_db
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: derlg_redis_password_dev
      JWT_SECRET: dev_jwt_secret_change_in_production
      JWT_REFRESH_SECRET: dev_jwt_refresh_secret_change_in_production
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
      STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET}
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
      AWS_REGION: ${AWS_REGION}
      AWS_S3_BUCKET: ${AWS_S3_BUCKET}
    ports:
      - "3001:3001"
    volumes:
      - ./backend:/app
      - /app/node_modules
      - backend_uploads:/app/uploads
    networks:
      - derlg-network
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    command: npm run start:dev

  # Python AI Agent
  ai-agent:
    build:
      context: ./ai-agent
      dockerfile: Dockerfile.dev
    container_name: derlg-ai-agent
    restart: unless-stopped
    environment:
      ENVIRONMENT: development
      PORT: 8000
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: derlg_redis_password_dev
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      LOG_LEVEL: debug
      BACKEND_API_URL: http://backend:3001
    ports:
      - "8000:8000"
    volumes:
      - ./ai-agent:/app
      - ai_agent_cache:/app/.cache
    networks:
      - derlg-network
    depends_on:
      redis:
        condition: service_healthy
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    command: python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  # Next.js Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
      target: development
    container_name: derlg-frontend
    restart: unless-stopped
    environment:
      NODE_ENV: development
      NEXT_PUBLIC_API_URL: http://localhost:3001
      NEXT_PUBLIC_WS_URL: ws://localhost:8000
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
      NEXT_PUBLIC_GA_MEASUREMENT_ID: ${NEXT_PUBLIC_GA_MEASUREMENT_ID}
      NEXT_PUBLIC_SENTRY_DSN: ${NEXT_PUBLIC_SENTRY_DSN}
      NEXT_PUBLIC_MAP_TILES_URL: https://tile.openstreetmap.org
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - /app/.next
    networks:
      - derlg-network
    depends_on:
      backend:
        condition: service_healthy
      ai-agent:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    command: npm run dev

networks:
  derlg-network:
    driver: bridge
    name: derlg-network

volumes:
  postgres_data:
    name: derlg_postgres_data
  redis_data:
    name: derlg_redis_data
  backend_uploads:
    name: derlg_backend_uploads
  ai_agent_cache:
    name: derlg_ai_agent_cache
```

### Individual Service Dockerfiles

**Frontend Dockerfile (frontend/Dockerfile.dev)**

```dockerfile
# Multi-stage build for development
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Development stage
FROM base AS development
WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Set environment variable for Next.js
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Start development server with hot reload
CMD ["npm", "run", "dev"]
```

**Backend Dockerfile (backend/Dockerfile.dev)**

```dockerfile
FROM node:18-alpine AS base

# Development stage
FROM base AS development
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy application code
COPY . .

# Expose port
EXPOSE 3001

# Start development server with hot reload
CMD ["npm", "run", "start:dev"]
```

**AI Agent Dockerfile (ai-agent/Dockerfile.dev)**

```dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create cache directory
RUN mkdir -p .cache

# Expose port
EXPOSE 8000

# Start development server with hot reload
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

### Environment Variables

**File: .env.example**

```bash
# Database
POSTGRES_DB=derlg_db
POSTGRES_USER=derlg_user
POSTGRES_PASSWORD=derlg_password_dev

# Redis
REDIS_PASSWORD=derlg_redis_password_dev

# Backend
JWT_SECRET=dev_jwt_secret_change_in_production
JWT_REFRESH_SECRET=dev_jwt_refresh_secret_change_in_production

# Stripe (get from Stripe Dashboard)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# AWS S3 (for file uploads)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=derlg-dev-uploads

# OpenAI (for AI Agent)
OPENAI_API_KEY=sk-...

# Anthropic (optional, for AI Agent)
ANTHROPIC_API_KEY=sk-ant-...

# Google Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-...

# Sentry (optional, for error tracking)
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

**Setup Instructions:**
```bash
# Copy example env file
cp .env.example .env

# Edit .env with your actual credentials
nano .env
```

### Development Workflow

**Initial Setup:**

```bash
# 1. Clone the repository
git clone https://github.com/your-org/derlg.com.git
cd derlg.com

# 2. Copy environment variables
cp .env.example .env

# 3. Edit .env with your credentials
nano .env

# 4. Build and start all services
docker-compose up --build

# 5. Wait for all services to be healthy (check logs)
docker-compose ps

# 6. Run database migrations (in a new terminal)
docker-compose exec backend npm run migration:run

# 7. Seed database with initial data (optional)
docker-compose exec backend npm run seed

# 8. Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:3001
# AI Agent: http://localhost:8000
# PostgreSQL: localhost:5432
# Redis: localhost:6379
```

**Daily Development:**

```bash
# Start all services
docker-compose up

# Start specific service
docker-compose up frontend

# Start in detached mode (background)
docker-compose up -d

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f frontend

# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v

# Restart specific service
docker-compose restart backend

# Rebuild specific service
docker-compose up --build frontend
```

**Hot Reload Configuration:**

All services are configured for hot reload during development:

- **Frontend (Next.js)**: File changes trigger automatic rebuild and browser refresh
- **Backend (NestJS)**: File changes trigger automatic restart via `npm run start:dev`
- **AI Agent (Python)**: File changes trigger automatic reload via `uvicorn --reload`

**Volume Mounts:**
- Source code directories are mounted as volumes
- `node_modules` and `.next` are excluded to prevent conflicts
- Changes to source files are immediately reflected in containers

### Database Management

**Running Migrations:**

```bash
# Create a new migration
docker-compose exec backend npm run migration:create -- AddUserTable

# Run pending migrations
docker-compose exec backend npm run migration:run

# Revert last migration
docker-compose exec backend npm run migration:revert

# Show migration status
docker-compose exec backend npm run migration:show
```

**Database Access:**

```bash
# Connect to PostgreSQL via psql
docker-compose exec postgres psql -U derlg_user -d derlg_db

# Backup database
docker-compose exec postgres pg_dump -U derlg_user derlg_db > backup.sql

# Restore database
docker-compose exec -T postgres psql -U derlg_user -d derlg_db < backup.sql

# Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d postgres
docker-compose exec backend npm run migration:run
docker-compose exec backend npm run seed
```

**Redis Access:**

```bash
# Connect to Redis CLI
docker-compose exec redis redis-cli -a derlg_redis_password_dev

# View all keys
docker-compose exec redis redis-cli -a derlg_redis_password_dev KEYS '*'

# Flush all data (WARNING: deletes all cache)
docker-compose exec redis redis-cli -a derlg_redis_password_dev FLUSHALL
```

### Service Communication

**Internal Docker Network:**

Services communicate using Docker's internal DNS:
- Frontend → Backend: `http://backend:3001`
- Frontend → AI Agent: `ws://ai-agent:8000`
- Backend → PostgreSQL: `postgresql://postgres:5432`
- Backend → Redis: `redis://redis:6379`
- AI Agent → Redis: `redis://redis:6379`
- AI Agent → Backend: `http://backend:3001`

**External Access (from host):**

Services are accessible from the host machine:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- AI Agent: `http://localhost:8000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

**Frontend API Configuration:**

The frontend uses different URLs depending on the context:

```typescript
// lib/config.ts
export const API_CONFIG = {
  // Browser requests (from client-side code)
  browserApiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  browserWsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000',
  
  // Server requests (from Next.js server components)
  serverApiUrl: process.env.INTERNAL_API_URL || 'http://backend:3001',
};

// Usage in client component
const response = await fetch(`${API_CONFIG.browserApiUrl}/trips`);

// Usage in server component
const response = await fetch(`${API_CONFIG.serverApiUrl}/trips`);
```

### Troubleshooting

**Service Won't Start:**

```bash
# Check service logs
docker-compose logs [service-name]

# Check service status
docker-compose ps

# Restart service
docker-compose restart [service-name]

# Rebuild service
docker-compose up --build [service-name]
```

**Port Already in Use:**

```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 [PID]

# Or change port in docker-compose.yml
ports:
  - "3001:3000"  # Map host port 3001 to container port 3000
```

**Database Connection Issues:**

```bash
# Check PostgreSQL is healthy
docker-compose exec postgres pg_isready -U derlg_user

# Check connection from backend
docker-compose exec backend npm run typeorm -- query "SELECT 1"

# Verify environment variables
docker-compose exec backend env | grep DATABASE_URL
```

**Hot Reload Not Working:**

```bash
# For Next.js frontend
# Ensure volume mounts are correct in docker-compose.yml
volumes:
  - ./frontend:/app
  - /app/node_modules
  - /app/.next

# For NestJS backend
# Ensure start:dev script uses --watch flag
"start:dev": "nest start --watch"

# Restart service
docker-compose restart frontend
```

**Volume Permission Issues:**

```bash
# Fix ownership (Linux/Mac)
sudo chown -R $USER:$USER ./frontend ./backend ./ai-agent

# Or run containers as current user
docker-compose run --user $(id -u):$(id -g) frontend npm install
```

**Clean Slate Reset:**

```bash
# Stop all services
docker-compose down

# Remove all volumes (WARNING: deletes all data)
docker-compose down -v

# Remove all images
docker-compose down --rmi all

# Rebuild everything
docker-compose up --build
```

### Performance Optimization

**Development Performance:**

1. **Use Docker BuildKit:**
```bash
# Enable BuildKit for faster builds
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
```

2. **Layer Caching:**
- Copy `package.json` before source code
- Install dependencies in separate layer
- Source code changes don't invalidate dependency layer

3. **Volume Performance (Mac/Windows):**
```yaml
# Use delegated consistency for better performance
volumes:
  - ./frontend:/app:delegated
  - /app/node_modules
```

4. **Resource Limits:**
```yaml
# Limit resources for non-critical services
services:
  redis:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

### Production Considerations

**Differences from Production:**

Development setup differs from production:
- Hot reload enabled (disabled in production)
- Source code mounted as volumes (copied in production)
- Debug logging enabled (minimal in production)
- No HTTPS (required in production)
- Weak secrets (strong secrets in production)
- No load balancing (required in production)
- No CDN (required in production)

**Production Dockerfile Example (frontend/Dockerfile):**

```dockerfile
FROM node:18-alpine AS base

# Dependencies stage
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Runner stage
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### CI/CD Integration

**GitHub Actions Example:**

```yaml
name: Docker Build and Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Create .env file
        run: |
          cp .env.example .env
          echo "STRIPE_SECRET_KEY=${{ secrets.STRIPE_SECRET_KEY }}" >> .env
          echo "OPENAI_API_KEY=${{ secrets.OPENAI_API_KEY }}" >> .env
      
      - name: Build Docker images
        run: docker-compose build
      
      - name: Start services
        run: docker-compose up -d
      
      - name: Wait for services to be healthy
        run: |
          timeout 120 bash -c 'until docker-compose ps | grep -q "healthy"; do sleep 5; done'
      
      - name: Run backend tests
        run: docker-compose exec -T backend npm run test
      
      - name: Run frontend tests
        run: docker-compose exec -T frontend npm run test
      
      - name: Run E2E tests
        run: docker-compose exec -T frontend npm run test:e2e
      
      - name: Stop services
        run: docker-compose down
```
