# Implementation Plan: DerLg.com Frontend (Next.js 14)

## Overview

This implementation plan breaks down the DerLg.com frontend application into discrete, actionable coding tasks. The application is a Progressive Web App (PWA) for Cambodia travel booking built with Next.js 14, featuring five main screens, AI-powered chat, offline maps, multi-language support, and comprehensive booking management.

The tasks are organized by feature area and build incrementally, with each task referencing specific requirements from the requirements document. Testing tasks are marked as optional with `*` to allow for faster MVP delivery.

## Technology Stack

- Next.js 14 (App Router), TypeScript, Tailwind CSS
- State: Zustand (client), React Query (server)
- Forms: React Hook Form + Zod
- API: Axios, WebSocket
- Maps: Leaflet.js
- i18n: next-intl
- Testing: Vitest, React Testing Library, Playwright
- PWA: next-pwa

## Tasks

### 1. Project Setup and Foundation

- [ ] 1.1 Initialize Next.js 14 project with TypeScript and App Router
  - Create Next.js 14 app with `create-next-app`
  - Configure TypeScript with strict mode
  - Set up App Router directory structure
  - Configure next.config.js with PWA plugin
  - _Requirements: 1.1, 1.6, 26.1_

- [ ] 1.2 Configure Tailwind CSS and design system
  - Install and configure Tailwind CSS
  - Create custom theme with color palette, typography, spacing
  - Define breakpoints for responsive design (mobile 320px+, tablet 768px+, desktop 1024px+)
  - Set up CSS variables for theming
  - _Requirements: 1.7, 27.1, 27.2, 27.8_

- [ ] 1.3 Set up development tooling
  - Configure ESLint with TypeScript rules
  - Configure Prettier with consistent formatting
  - Set up Husky and lint-staged for pre-commit hooks
  - Configure environment variables with .env.example
  - _Requirements: 26.2, 26.3, 26.4, 26.5, 46.2_

- [ ] 1.4 Create root layout and error boundaries
  - Implement app/layout.tsx with metadata and global styles
  - Create app/error.tsx for error boundary
  - Create app/not-found.tsx for 404 pages
  - Set up app/globals.css with Tailwind directives
  - _Requirements: 1.3, 16.8_


### 2. Core UI Component Library

- [ ] 2.1 Create base UI components
  - Implement Button component with variants (primary, secondary, outline, ghost)
  - Implement Input component with validation states and icons
  - Implement Card component for content blocks
  - Implement Badge component for status indicators
  - Implement Avatar component for user profiles
  - _Requirements: 27.3, 47.1, 47.2, 47.3, 47.9, 47.10_

- [ ] 2.2 Create modal and drawer components
  - Implement Modal component with customizable content and actions
  - Implement Drawer component for side panels (used for AI chat)
  - Add accessibility features (focus trap, ESC to close, ARIA labels)
  - _Requirements: 47.4, 47.5, 18.5_

- [ ] 2.3 Create notification and feedback components
  - Implement Toast component for notifications
  - Implement skeleton loader components
  - Implement loading spinner and progress bar components
  - _Requirements: 16.7, 31.1, 31.2, 31.5, 47.6_

- [ ] 2.4 Create form components
  - Implement Dropdown/Select component
  - Implement DatePicker component with calendar
  - Implement Textarea component
  - Implement Checkbox and Radio components
  - _Requirements: 30.4, 47.8_

- [ ] 2.5 Create navigation components
  - Implement Tabs component for tabbed interfaces
  - Implement bottom navigation bar for mobile
  - Implement top navigation header for desktop
  - Add active state indicators
  - _Requirements: 47.7, 1.8_

- [ ]* 2.6 Write unit tests for UI components
  - Test Button variants and disabled states
  - Test Input validation states and error messages
  - Test Modal open/close and accessibility
  - Test Toast notifications display and dismiss
  - _Requirements: 25.2_

### 3. State Management Setup

- [ ] 3.1 Configure Zustand store for client state
  - Install Zustand
  - Create store with auth state (user, isAuthenticated)
  - Add UI state (isChatOpen, isDrawerOpen, activeModal)
  - Add preferences state (language, theme, currency)
  - Create actions (setUser, openChat, closeChat, setLanguage, setTheme)
  - _Requirements: 14.1, 14.3, 14.4, 14.5_

- [ ] 3.2 Configure React Query for server state
  - Install @tanstack/react-query
  - Create QueryClient with configuration
  - Set up QueryClientProvider in root layout
  - Configure stale times and cache invalidation
  - Configure retry logic with exponential backoff
  - _Requirements: 14.2, 14.6, 14.8, 14.9_

- [ ]* 3.3 Write property test for state management
  - **Property 79: Local Storage Persistence**
  - **Validates: Requirements 48.2, 48.3, 48.4**
  - Test that user preferences persist in local storage and restore on app load

### 4. API Client and Authentication

- [ ] 4.1 Implement Axios API client
  - Create API client with base URL and timeout configuration
  - Add request interceptors for auth headers and language
  - Add response interceptors for error handling
  - Implement token refresh logic on 401 responses
  - Implement retry logic with exponential backoff
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.9_

- [ ] 4.2 Create authentication hooks and utilities
  - Implement useAuth hook with login, register, logout, refreshToken
  - Create token storage utilities (httpOnly cookies)
  - Implement protected route wrapper component
  - Create auth context provider
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

- [ ] 4.3 Create TypeScript interfaces for API data models
  - Define User, Trip, Booking, Place, Festival interfaces
  - Define Hotel, Transportation, Guide, Review interfaces
  - Define ChatMessage, EmergencyAlert interfaces
  - Export all types from central types file
  - _Requirements: 15.8_

- [ ]* 4.4 Write property tests for authentication
  - **Property 1: Authentication Token Round-Trip**
  - **Validates: Requirements 2.1, 2.2, 2.3, 24.2, 48.1**
  - **Property 2: Token Refresh on Expiration**
  - **Validates: Requirements 2.4, 15.5**
  - **Property 3: Authentication Failure Redirect**
  - **Validates: Requirements 2.5, 15.6**

- [ ]* 4.5 Write unit tests for API client
  - Test request interceptor adds auth headers
  - Test response interceptor handles 401 with token refresh
  - Test retry logic for 5xx errors
  - Test error handling for network failures
  - _Requirements: 25.5_

### 5. Authentication Pages

- [ ] 5.1 Create login page
  - Implement app/(auth)/login/page.tsx
  - Create login form with email and password fields
  - Add form validation with Zod schema
  - Integrate with useAuth hook
  - Add loading states and error messages
  - _Requirements: 2.1, 2.2, 16.1, 16.2, 16.3_

- [ ] 5.2 Create registration page
  - Implement app/(auth)/register/page.tsx
  - Create registration form with email, password, name, phone
  - Add password strength indicator
  - Add form validation with Zod schema
  - Integrate with useAuth hook
  - _Requirements: 2.1, 2.2, 16.1, 16.2_

- [ ] 5.3 Create auth layout
  - Implement app/(auth)/layout.tsx without main navigation
  - Add auth-specific styling and branding
  - _Requirements: 1.3_

- [ ]* 5.4 Write integration tests for auth flow
  - Test complete login flow from form to redirect
  - Test registration flow with validation
  - Test protected route redirect to login
  - _Requirements: 25.5_

### 6. Main Layout and Navigation

- [ ] 6.1 Create main layout with navigation
  - Implement app/(main)/layout.tsx with navigation
  - Create Navigation component with bottom tabs (mobile) and top nav (desktop)
  - Add navigation items: Home, Explore, Booking, My Trip, Profile
  - Add language selector and AI button
  - Implement responsive design
  - _Requirements: 1.3, 1.8, 3.4, 3.7_

- [ ] 6.2 Implement route protection
  - Create middleware for protected routes
  - Check authentication before rendering protected pages
  - Redirect to login with return URL for unauthenticated access
  - _Requirements: 2.8, 2.9_

- [ ]* 6.3 Write property test for navigation
  - **Property 7: Navigation Preservation**
  - **Validates: Requirements 3.4, 3.7, 4.6, 7.5, 20.4, 36.8, 41.3**
  - Test that navigation actions preserve data and navigate correctly

### 7. Home Screen

- [ ] 7.1 Create Home page structure
  - Implement app/(main)/page.tsx
  - Create hero section with search bar and AI quick-start button
  - Create featured trips section with grid layout
  - Create upcoming festivals section
  - Create categories section with icons
  - _Requirements: 3.1, 3.2, 3.3, 3.6_

- [ ] 7.2 Implement featured trips with React Query
  - Create useTrips hook with React Query
  - Fetch featured trips from Backend API
  - Display trips with images, titles, prices, durations
  - Implement infinite scroll or pagination
  - Add loading skeletons
  - _Requirements: 3.2, 3.8, 3.9_

- [ ] 7.3 Implement festivals display
  - Create useFestivals hook with React Query
  - Fetch upcoming festivals from Backend API
  - Display festivals with dates, locations, descriptions
  - Add click handler to navigate to festival details
  - _Requirements: 3.3_

- [ ] 7.4 Add category navigation
  - Create category cards with icons (Temples, Nature, Culture, Adventure, Food)
  - Add click handlers to navigate to Explore with pre-filtered category
  - _Requirements: 3.6, 3.7_

- [ ]* 7.5 Write integration tests for Home screen
  - Test featured trips load and display
  - Test category click navigates to Explore
  - Test AI button opens chat
  - _Requirements: 25.6_

### 8. Explore Screen

- [ ] 8.1 Create Explore page with tabs
  - Implement app/(main)/explore/page.tsx
  - Create tabs for Places, Festivals, and Maps
  - Implement tab switching logic
  - _Requirements: 4.1_

- [ ] 8.2 Implement Places tab with filtering
  - Create usePlaces hook with React Query
  - Fetch places from Backend API
  - Implement filters for category, region, price range
  - Display filter chips with real-time updates
  - Implement infinite scroll
  - _Requirements: 4.2, 4.7, 4.9_

- [ ] 8.3 Implement Festivals tab with filtering
  - Create useFestivals hook with filtering
  - Fetch festivals from Backend API
  - Implement filters for date and location
  - Display filter chips
  - Implement infinite scroll
  - _Requirements: 4.3, 4.7, 4.9_

- [ ] 8.4 Implement search functionality
  - Create search input with debounced API calls (300ms)
  - Implement useSearch hook with React Query
  - Display search results grouped by type
  - Highlight matching text in results
  - _Requirements: 4.5, 9, 20.1, 20.2, 20.3, 20.5_

- [ ] 8.5 Implement place/festival detail modal
  - Create detail modal component
  - Display full information and booking options
  - Add click handler to open modal
  - _Requirements: 4.6_

- [ ]* 8.6 Write property tests for Explore features
  - **Property 8: Filter URL Persistence**
  - **Validates: Requirements 4.7, 4.8**
  - **Property 9: Search Debouncing**
  - **Validates: Requirements 4.5, 17.7, 20.2**
  - **Property 47: Search Result Grouping**
  - **Validates: Requirements 20.3, 20.5**

### 9. Maps Integration

- [ ] 9.1 Set up Leaflet.js for maps
  - Install react-leaflet and leaflet
  - Create Map component with MapContainer and TileLayer
  - Configure OpenStreetMap tiles
  - Add responsive sizing
  - _Requirements: 11.1_

- [ ] 9.2 Implement map markers and interactions
  - Add markers for places and festivals
  - Implement marker click to show popup
  - Add custom marker icons by type
  - Display user location marker
  - _Requirements: 4.4, 11.8_

- [ ] 9.3 Implement offline map caching
  - Configure Service Worker for map tile caching
  - Implement cache-first strategy for tiles
  - Add download button to pre-cache regions
  - Display storage usage
  - Allow clearing cached map data
  - _Requirements: 11.2, 11.3, 11.5, 11.6, 11.7_

- [ ] 9.4 Add offline mode support
  - Detect online/offline status
  - Serve cached tiles when offline
  - Display offline banner
  - Show cached markers only
  - _Requirements: 11.4, 11.9_

- [ ]* 9.5 Write property tests for map features
  - **Property 28: Map Tile Caching**
  - **Validates: Requirements 11.2, 11.3, 11.6, 12.3**
  - **Property 29: Offline Map Functionality**
  - **Validates: Requirements 11.4, 11.8, 11.9, 12.5**

### 10. Trip Detail Page

- [ ] 10.1 Create trip detail page
  - Implement app/(main)/trips/[id]/page.tsx
  - Fetch trip details with React Query
  - Display title, description, duration, price, images
  - Create photo gallery with lightbox
  - _Requirements: 36.1, 36.10_

- [ ] 10.2 Display trip itinerary and details
  - Create itinerary component with day-by-day activities
  - Display included/excluded items
  - Display meeting point and pickup info
  - Display cancellation policy
  - _Requirements: 36.2, 36.3, 36.4, 36.5_

- [ ] 10.3 Add reviews and ratings section
  - Fetch reviews with React Query and pagination
  - Display average rating and review count
  - Implement review sorting and filtering
  - Display verified booking badges
  - _Requirements: 36.6, 21.1, 21.6, 21.7, 21.8_

- [ ] 10.4 Add booking button and recommendations
  - Create "Book Now" button with navigation to booking flow
  - Display available dates with calendar picker
  - Fetch and display similar/recommended trips
  - _Requirements: 36.7, 36.8, 36.9_

- [ ]* 10.5 Write integration tests for trip detail page
  - Test trip details load and display
  - Test photo gallery interactions
  - Test booking button navigation
  - _Requirements: 25.6_


### 11. Booking Flow

- [ ] 11.1 Create booking form component
  - Implement BookingForm component with date, guest count, special requests
  - Add form validation with Zod schema
  - Validate dates are in future and available
  - Implement React Hook Form integration
  - _Requirements: 5.1, 5.2, 16.1, 16.2, 16.3_

- [ ] 11.2 Implement booking creation
  - Create useCreateBooking mutation with React Query
  - Call Backend API to check availability
  - Create booking and receive confirmation
  - Prevent double-submission by disabling button
  - Display error messages from API
  - _Requirements: 5.2, 5.3, 5.8, 5.9_

- [ ] 11.3 Display booking summary with pricing
  - Calculate and display total price with breakdown
  - Display student discount if available
  - Display loyalty points to be earned
  - Show applicable discounts
  - _Requirements: 5.4, 5.5, 5.6, 34.3, 35.7_

- [ ] 11.4 Create booking page
  - Implement app/(main)/booking/page.tsx
  - Display booking form
  - Navigate to payment on successful booking
  - _Requirements: 5.7_

- [ ]* 11.5 Write property tests for booking flow
  - **Property 10: Booking Form Validation**
  - **Validates: Requirements 5.1, 5.2, 5.3**
  - **Property 11: Booking Price Calculation**
  - **Validates: Requirements 5.4, 5.5, 5.6, 34.3, 35.7, 35.9**
  - **Property 12: Double-Submission Prevention**
  - **Validates: Requirements 5.8, 31.4**

- [ ]* 11.6 Write unit tests for booking form
  - Test date validation (future dates only)
  - Test guest count validation
  - Test form submission with valid data
  - Test error display for invalid inputs
  - _Requirements: 25.6_

### 12. Payment Integration

- [ ] 12.1 Set up Stripe integration
  - Install @stripe/stripe-js and @stripe/react-stripe-js
  - Create Stripe provider wrapper
  - Load Stripe with publishable key
  - _Requirements: 6.2_

- [ ] 12.2 Create payment form component
  - Implement PaymentForm with Stripe Elements
  - Add CardElement for card payments
  - Implement payment method selector (card/QR)
  - Display QR code for QR payments
  - _Requirements: 6.2, 6.3_

- [ ] 12.3 Implement payment processing
  - Create useProcessPayment mutation
  - Handle Stripe card payment with confirmCardPayment
  - Handle QR code payment via Backend API
  - Implement 3D Secure authentication flow
  - Display payment status updates for QR payments
  - _Requirements: 6.4, 6.7, 6.8_

- [ ] 12.4 Create payment page
  - Implement app/(main)/booking/payment/page.tsx
  - Fetch payment options from Backend API
  - Display payment form
  - Handle success/failure navigation
  - _Requirements: 6.1, 6.5, 6.6_

- [ ] 12.5 Add payment receipt functionality
  - Store payment receipt data
  - Allow PDF download of receipt
  - _Requirements: 6.9_

- [ ]* 12.6 Write property tests for payment
  - **Property 13: Payment Method Handling**
  - **Validates: Requirements 6.1, 6.3, 6.4**
  - **Property 14: Payment Result Navigation**
  - **Validates: Requirements 6.5, 6.6, 32.8**

- [ ]* 12.7 Write integration tests for payment flow
  - Test Stripe card payment flow
  - Test QR code payment display
  - Test payment error handling
  - _Requirements: 25.6_

### 13. Booking Confirmation

- [ ] 13.1 Create booking confirmation page
  - Implement app/(main)/booking/confirmation/page.tsx
  - Display booking details and reference number
  - Display QR code for check-in
  - Show payment receipt with itemized costs
  - _Requirements: 39.1, 39.2, 39.5, 7.9_

- [ ] 13.2 Add confirmation actions
  - Send confirmation email via Backend API
  - Allow PDF download of confirmation
  - Allow PDF download of receipt
  - Add to calendar (iCal format)
  - Display next steps and preparation instructions
  - _Requirements: 39.3, 39.4, 39.6, 39.8, 39.9_

- [ ] 13.3 Display contact and support info
  - Show support contact information
  - Display instructions for changes
  - _Requirements: 39.7_

- [ ]* 13.4 Write property test for booking confirmation
  - **Property 70: Booking Confirmation Completeness**
  - **Validates: Requirements 39.1, 39.2, 39.3, 39.4, 39.6, 39.8, 39.9**

### 14. My Trip Screen

- [ ] 14.1 Create My Trip page with tabs
  - Implement app/(main)/my-trip/page.tsx
  - Create tabs for Upcoming and Past bookings
  - Implement tab switching logic
  - _Requirements: 7.1_

- [ ] 14.2 Implement Upcoming bookings tab
  - Create useBookings hook with React Query
  - Fetch bookings with status "confirmed" or "pending"
  - Display bookings with trip name, dates, location, status, price
  - Add click handler to navigate to booking detail
  - _Requirements: 7.2, 7.4_

- [ ] 14.3 Implement Past bookings tab
  - Fetch bookings with status "completed" or "cancelled"
  - Display bookings with same information as Upcoming
  - _Requirements: 7.3, 7.4_

- [ ] 14.4 Create booking detail page
  - Implement app/(main)/my-trip/[bookingId]/page.tsx
  - Display full booking information and itinerary
  - Display QR code for check-in
  - Display contact information
  - _Requirements: 7.5, 7.9, 36.1-36.7, 37.1, 37.3, 37.4, 38.1, 38.3, 39.2_

- [ ] 14.5 Add Emergency Alert button
  - Display Emergency Alert button for bookings within 24 hours of start
  - Implement emergency alert functionality (will be completed in task 15)
  - _Requirements: 7.6, 10.1_

- [ ] 14.6 Implement booking cancellation
  - Add "Cancel Booking" button on detail page
  - Display cancellation policy and refund amount
  - Require confirmation with reason selection
  - Call Backend API cancellation endpoint
  - Update booking status to "cancelled"
  - Display cancellation confirmation
  - _Requirements: 7.7, 7.8, 40.1, 40.2, 40.3, 40.4, 40.5, 40.6_

- [ ]* 14.7 Write property tests for My Trip features
  - **Property 15: Booking Status Filtering**
  - **Validates: Requirements 7.2, 7.3**
  - **Property 16: Booking Display Completeness**
  - **Validates: Requirements 7.4, 7.9, 36.1-36.7, 37.1, 37.3, 37.4, 38.1, 38.3, 39.2**
  - **Property 71: Cancellation Workflow**
  - **Validates: Requirements 40.1, 40.2, 40.3, 40.4, 40.5, 40.6, 40.8**
  - **Property 72: Cancellation Prevention**
  - **Validates: Requirements 40.9**

### 15. Emergency Alert System

- [ ] 15.1 Create useEmergencyAlert hook
  - Implement hook to capture GPS location
  - Request GPS permission from browser
  - Capture latitude and longitude coordinates
  - Handle permission denied with manual entry option
  - _Requirements: 10.2, 10.3, 10.6_

- [ ] 15.2 Implement emergency alert sending
  - Create useSendAlert mutation with React Query
  - Send alert with GPS coordinates and booking ID to Backend API
  - Display confirmation message with emergency contact numbers
  - Display user location on map before sending
  - Add cancel button with 5-second countdown
  - _Requirements: 10.4, 10.5, 10.7, 10.8_

- [ ] 15.3 Integrate Emergency Alert button in booking detail
  - Connect Emergency Alert button to useEmergencyAlert hook
  - Show button only for bookings within 24 hours
  - _Requirements: 7.6, 10.1_

- [ ]* 15.4 Write property tests for emergency alerts
  - **Property 17: Emergency Alert Availability**
  - **Validates: Requirements 7.6, 10.1**
  - **Property 18: Emergency Alert GPS Capture**
  - **Validates: Requirements 10.2, 10.3, 10.4**

### 16. Profile Screen

- [ ] 16.1 Create Profile page structure
  - Implement app/(main)/profile/page.tsx
  - Display user profile information (name, email, phone, profile picture)
  - Create sections for loyalty points, student discount, settings
  - _Requirements: 8.1, 8.3, 8.4_

- [ ] 16.2 Implement profile editing
  - Create profile edit form with validation
  - Allow editing name, email, phone
  - Implement useUpdateProfile mutation
  - Save changes via Backend API
  - _Requirements: 8.2, 8.5_

- [ ] 16.3 Add profile picture upload
  - Implement image upload with file input or drag-and-drop
  - Validate file type (JPEG, PNG, WebP) and size (max 5MB)
  - Compress image before upload
  - Crop to square format (400x400px)
  - Display upload progress
  - _Requirements: 8.9, 29.1, 29.2, 29.3, 29.4, 29.5, 29.7_

- [ ] 16.4 Implement password change
  - Create password change form
  - Require current password and new password
  - Validate password strength
  - Call Backend API to update password
  - _Requirements: 8.5_

- [ ] 16.5 Display loyalty points
  - Fetch and display current loyalty points balance
  - Display points history with pagination
  - Show points earned per booking
  - Display progress bar for next reward tier
  - Show points redemption options
  - _Requirements: 8.3, 34.1, 34.2, 34.4, 34.5, 34.6, 34.8_

- [ ] 16.6 Implement student discount verification
  - Create student discount section
  - Allow document upload (PDF, JPEG, PNG, max 10MB)
  - Validate file type and size
  - Send documents to Backend API
  - Display verification status (pending, approved, rejected)
  - Display student badge when approved
  - _Requirements: 8.4, 35.1, 35.2, 35.3, 35.4, 35.5, 35.6_

- [ ] 16.7 Add preferences settings
  - Implement language selector (EN, KH, ZH) with immediate UI update
  - Implement theme toggle (light/dark) with immediate update
  - Implement currency selector
  - Implement notification preferences (email, push, SMS)
  - Persist all preferences in local storage
  - _Requirements: 8.6, 8.7, 27.6, 27.7, 44.2_

- [ ] 16.8 Add account deletion
  - Create account deletion button
  - Display confirmation dialog
  - Call Backend API to delete account
  - _Requirements: 8.8, 50.8_

- [ ]* 16.9 Write property tests for profile features
  - **Property 19: Profile Update Persistence**
  - **Validates: Requirements 8.2, 8.5**
  - **Property 20: Language Change Reactivity**
  - **Validates: Requirements 8.6, 13.4, 13.5**
  - **Property 21: Image Upload Validation and Compression**
  - **Validates: Requirements 8.9, 29.2, 29.3, 29.4, 29.5, 35.3**
  - **Property 68: Loyalty Points Display**
  - **Validates: Requirements 34.2, 34.3, 34.5, 34.7, 34.8, 34.9**
  - **Property 69: Student Discount Workflow**
  - **Validates: Requirements 35.3, 35.4, 35.5, 35.6, 35.8**

### 17. AI Chat Interface

- [ ] 17.1 Create useWebSocket hook
  - Implement WebSocket connection management
  - Add connection retry logic with exponential backoff
  - Implement heartbeat/ping messages
  - Queue messages sent while disconnected
  - Handle connection lifecycle (open, close, error)
  - _Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6, 28.8, 28.9_

- [ ] 17.2 Create AI Chat component
  - Implement AIChat component with full-screen drawer
  - Display message history
  - Create message input field
  - Display typing indicators
  - Show connection status (connected, connecting, disconnected)
  - _Requirements: 9.2, 9.3, 9.8, 9.11, 28.7_

- [ ] 17.3 Implement message sending and receiving
  - Send messages via WebSocket
  - Display user messages immediately
  - Receive and display AI responses
  - Handle structured message types (text, trip_card, hotel_card, action_buttons)
  - _Requirements: 9.3, 9.4, 9.5, 9.6_

- [ ] 17.4 Add interactive message elements
  - Render trip cards with booking buttons
  - Render hotel cards with booking buttons
  - Render action buttons with click handlers
  - Navigate to booking flow with pre-filled information
  - _Requirements: 9.6, 9.7_

- [ ] 17.5 Implement chat history persistence
  - Persist messages in local storage
  - Restore chat history when reopened
  - Implement size limits for storage
  - _Requirements: 9.9, 48.3_

- [ ] 17.6 Add chat open/close functionality
  - Connect AI button in navigation to open chat
  - Establish WebSocket connection on open
  - Close WebSocket connection on close
  - Update Zustand store state
  - _Requirements: 9.1, 9.12_

- [ ]* 17.7 Write property tests for AI chat
  - **Property 22: WebSocket Connection Lifecycle**
  - **Validates: Requirements 9.1, 9.12, 28.1, 28.8**
  - **Property 23: WebSocket Message Round-Trip**
  - **Validates: Requirements 9.3, 9.4, 9.5**
  - **Property 24: WebSocket Reconnection**
  - **Validates: Requirements 9.10, 28.2, 28.3, 28.6**
  - **Property 25: Chat History Persistence**
  - **Validates: Requirements 9.9, 48.3**
  - **Property 26: Structured Message Rendering**
  - **Validates: Requirements 9.5, 9.6, 9.7**
  - **Property 27: Connection Status Display**
  - **Validates: Requirements 9.11, 28.7**
  - **Property 61: WebSocket Heartbeat**
  - **Validates: Requirements 28.4, 28.5**

- [ ]* 17.8 Write integration tests for AI chat
  - Test WebSocket connection establishment
  - Test message send and receive
  - Test reconnection on connection loss
  - Test chat history restoration
  - _Requirements: 25.7_

### 18. Internationalization (i18n)

- [ ] 18.1 Set up next-intl
  - Install next-intl
  - Configure i18n with EN, KH, ZH locales
  - Create translation files for each language
  - Set up middleware for locale detection
  - _Requirements: 13.1, 13.2_

- [ ] 18.2 Implement language detection and switching
  - Detect browser language as default
  - Create language selector component
  - Update all UI text on language change
  - Persist selected language in local storage
  - _Requirements: 13.3, 13.4, 13.5_

- [ ] 18.3 Translate static UI text
  - Translate all buttons, labels, error messages
  - Translate navigation items
  - Translate form labels and placeholders
  - _Requirements: 13.6_

- [ ] 18.4 Implement dynamic content translation
  - Fetch translated content from Backend API based on locale
  - Translate trip descriptions, place names
  - _Requirements: 13.7_

- [ ] 18.5 Add locale-aware formatting
  - Format dates according to locale
  - Format times according to locale
  - Format currencies according to locale
  - _Requirements: 13.8, 30.2, 30.3, 44.5_

- [ ]* 18.6 Write property test for internationalization
  - **Property 32: Internationalization Completeness**
  - **Validates: Requirements 13.3, 13.4, 13.6, 13.7, 13.8, 30.2, 30.3, 30.8, 44.5**

### 19. Progressive Web App (PWA)

- [ ] 19.1 Configure PWA with next-pwa
  - Install next-pwa
  - Configure next.config.js with PWA plugin
  - Create web app manifest with app name, icons, theme colors
  - Set display mode to standalone
  - _Requirements: 12.1, 12.7_

- [ ] 19.2 Implement Service Worker
  - Configure Service Worker with Workbox
  - Implement cache-first strategy for static assets
  - Implement network-first strategy for API requests
  - Cache static assets (CSS, JS, images)
  - _Requirements: 12.2, 12.3, 12.4_

- [ ] 19.3 Add offline functionality
  - Display cached pages when offline
  - Create custom offline page
  - Display offline banner when no connection
  - _Requirements: 12.5, 12.8, 11.9_

- [ ] 19.4 Implement install prompt
  - Display install prompt when PWA criteria met
  - Make app installable on iOS, Android, desktop
  - _Requirements: 12.6, 12.7_

- [ ] 19.5 Add offline sync
  - Queue pending actions in IndexedDB when offline
  - Sync queued actions when connection restored
  - Display sync status to user
  - _Requirements: 12.9, 48.6_

- [ ]* 19.6 Write property tests for PWA features
  - **Property 30: PWA Installation**
  - **Validates: Requirements 12.6**
  - **Property 31: Offline Sync**
  - **Validates: Requirements 12.9, 48.6**


### 20. Reviews and Ratings

- [ ] 20.1 Create review display component
  - Fetch reviews with React Query and pagination
  - Display average rating and review count
  - Show individual reviews with rating, text, photos
  - Display verified booking badges
  - _Requirements: 21.1, 21.2, 21.8_

- [ ] 20.2 Implement review sorting and filtering
  - Add sort options (most recent, highest rated)
  - Add filter by rating
  - _Requirements: 21.6, 21.7_

- [ ] 20.3 Create review submission form
  - Allow review submission for completed bookings only
  - Add rating selector (1-5 stars)
  - Add text input with character count (10-1000 chars)
  - Allow photo uploads (max 5 photos)
  - Validate inputs with Zod schema
  - _Requirements: 21.3, 21.4, 21.5_

- [ ] 20.4 Implement review editing and deletion
  - Allow users to edit their own reviews
  - Allow users to delete their own reviews
  - _Requirements: 21.9_

- [ ]* 20.5 Write property tests for reviews
  - **Property 50: Review Submission Validation**
  - **Validates: Requirements 21.3, 21.4, 21.5**
  - **Property 51: Review Display and Filtering**
  - **Validates: Requirements 21.1, 21.6, 21.7, 21.8**

### 21. Favorites and Wishlists

- [ ] 21.1 Implement favorites functionality
  - Add heart icon to trip and place cards
  - Create useFavorites hook with React Query
  - Toggle favorite status via Backend API for authenticated users
  - Store favorites in local storage for unauthenticated users
  - _Requirements: 22.1, 22.2, 22.8_

- [ ] 21.2 Create Favorites section in Profile
  - Display all favorited items
  - Fetch favorites from Backend API
  - Allow removing items from favorites
  - Display count in navigation
  - _Requirements: 22.3, 22.4, 22.5, 22.7_

- [ ] 21.3 Implement favorites sync
  - Sync local favorites with Backend API on login
  - Sync across devices for authenticated users
  - _Requirements: 22.6, 22.9_

- [ ]* 21.4 Write property test for favorites
  - **Property 52: Favorites Synchronization**
  - **Validates: Requirements 22.2, 22.5, 22.6, 22.7, 22.8, 22.9**

### 22. Search Functionality

- [ ] 22.1 Create global search component
  - Add search bar in navigation header
  - Implement debounced search input (300ms)
  - Create useSearch hook with React Query
  - _Requirements: 20.1, 20.2_

- [ ] 22.2 Display search results
  - Group results by type (trips, places, festivals, hotels)
  - Highlight matching text
  - Navigate to detail page on click
  - Display "no results" message with suggestions
  - _Requirements: 20.3, 20.4, 20.5, 20.8_

- [ ] 22.3 Implement search history
  - Display recent searches
  - Persist search history in local storage
  - Allow clearing search history
  - _Requirements: 20.6, 20.9_

- [ ] 22.4 Add autocomplete suggestions
  - Implement autocomplete based on popular searches
  - _Requirements: 20.7_

- [ ]* 22.5 Write property tests for search
  - **Property 48: Search History Persistence**
  - **Validates: Requirements 20.6, 20.9**
  - **Property 49: Empty Search Handling**
  - **Validates: Requirements 20.8**

### 23. Hotel and Transportation Booking

- [ ] 23.1 Create hotel listing page
  - Implement app/(main)/hotels/page.tsx
  - Fetch and display hotels with images, prices, ratings, amenities
  - Implement filters (price range, rating, amenities)
  - _Requirements: 37.1, 37.2_

- [ ] 23.2 Create hotel detail page
  - Implement app/(main)/hotels/[id]/page.tsx
  - Display hotel details, room types, check-in/check-out times, policies
  - Add booking button
  - _Requirements: 37.3_

- [ ] 23.3 Create transportation listing page
  - Implement app/(main)/transportation/page.tsx
  - Display transportation options (bus, van, private car) with schedules and prices
  - Allow selecting departure and arrival locations
  - Display available seats/capacity
  - _Requirements: 37.4, 37.5, 37.6_

- [ ] 23.4 Implement hotel booking flow
  - Create hotel booking form with date and room selection
  - Integrate with booking creation logic
  - _Requirements: 37.7_

- [ ] 23.5 Implement transportation booking flow
  - Create transportation booking form with date and time selection
  - Integrate with booking creation logic
  - _Requirements: 37.8_

- [ ] 23.6 Add combined pricing
  - Display combined pricing for hotel + transportation
  - _Requirements: 37.9_

### 24. Guide Booking

- [ ] 24.1 Create guide listing page
  - Implement app/(main)/guides/page.tsx
  - Display guide profiles with photos, languages, specialties, ratings
  - Implement filters (language, specialty, availability)
  - _Requirements: 38.1, 38.2_

- [ ] 24.2 Create guide detail page
  - Implement app/(main)/guides/[id]/page.tsx
  - Display guide details, experience, certifications, reviews
  - Display availability calendar
  - Display pricing based on duration and group size
  - _Requirements: 38.3, 38.4, 38.6_

- [ ] 24.3 Implement guide messaging
  - Allow users to send messages to guides before booking
  - _Requirements: 38.7_

- [ ] 24.4 Implement guide booking flow
  - Create guide booking form with date, time, duration, group size
  - Allow selecting tour duration (half-day, full-day, multi-day)
  - Integrate with booking creation logic
  - _Requirements: 38.5, 38.8_

- [ ] 24.5 Display guide contact after booking
  - Show guide contact information on booking confirmation
  - _Requirements: 38.9_

### 25. Festival Features

- [ ] 25.1 Create festival calendar view
  - Implement monthly and list views
  - Display festival markers with color coding by type
  - _Requirements: 41.1, 41.2_

- [ ] 25.2 Create festival detail page
  - Display festival details (date, location, description, activities)
  - Display related trips and accommodations
  - Add favorite button
  - Display photo and video gallery
  - _Requirements: 41.3, 41.4, 41.6, 41.9_

- [ ] 25.3 Implement festival filtering
  - Add filters by type (religious, cultural, music, food)
  - _Requirements: 41.5_

- [ ] 25.4 Add festival countdown and reminders
  - Display countdown timers for upcoming festivals
  - Send reminders for favorited festivals via notifications
  - _Requirements: 41.7, 41.8_

- [ ]* 25.5 Write property test for festivals
  - **Property 73: Festival Display and Interaction**
  - **Validates: Requirements 41.2, 41.3, 41.4, 41.5, 41.6, 41.7, 41.8, 41.9**

### 26. Notifications

- [ ] 26.1 Implement push notification setup
  - Request push notification permission
  - Register Service Worker for push notifications
  - Send push token to Backend API
  - _Requirements: 19.1, 19.2, 19.3_

- [ ] 26.2 Handle push notifications
  - Display notifications with title, body, icon
  - Navigate to relevant page on notification click
  - _Requirements: 19.4, 19.5_

- [ ] 26.3 Create in-app notification system
  - Display in-app notifications for real-time updates
  - Create notification center showing recent notifications
  - Allow marking notifications as read
  - _Requirements: 19.6, 19.7, 19.8_

- [ ] 26.4 Respect notification preferences
  - Check user preferences before sending notifications
  - _Requirements: 19.9, 23.6_

- [ ]* 26.5 Write property tests for notifications
  - **Property 45: Push Notification Flow**
  - **Validates: Requirements 19.2, 19.3, 19.4, 19.5**
  - **Property 46: Notification Preferences**
  - **Validates: Requirements 19.8, 19.9, 23.6**

### 27. Social Sharing

- [ ] 27.1 Implement share functionality
  - Add share buttons on trip and place detail pages
  - Implement Web Share API for native sharing
  - Provide fallback options (copy link, email, WhatsApp, Facebook)
  - _Requirements: 33.1, 33.2, 33.3_

- [ ] 27.2 Generate shareable URLs
  - Create shareable URLs with Open Graph metadata
  - Implement Open Graph meta tags for rich previews
  - _Requirements: 33.4, 33.5_

- [ ] 27.3 Add share feedback and tracking
  - Display success message when link copied
  - Track share events in analytics
  - _Requirements: 33.6, 33.7_

- [ ] 27.4 Add booking sharing
  - Allow sharing booking confirmations
  - Generate QR codes for offline sharing
  - _Requirements: 33.8, 33.9_

- [ ]* 27.5 Write property test for social sharing
  - **Property 67: Social Sharing**
  - **Validates: Requirements 33.2, 33.3, 33.4, 33.6, 33.7, 33.8, 33.9**

### 28. Currency Conversion

- [ ] 28.1 Implement currency selector
  - Create currency selector component
  - Display USD as default currency
  - Allow selecting from currency list
  - Persist preference in local storage
  - _Requirements: 44.1, 44.2, 44.6_

- [ ] 28.2 Implement currency conversion
  - Fetch exchange rates from Backend API
  - Convert all prices to selected currency
  - Format currency according to locale
  - Display currency disclaimer
  - Display original and converted currency
  - _Requirements: 44.3, 44.4, 44.5, 44.7, 44.9_

- [ ] 28.3 Update exchange rates
  - Fetch and update exchange rates daily
  - _Requirements: 44.8_

- [ ]* 28.4 Write property test for currency conversion
  - **Property 77: Currency Conversion**
  - **Validates: Requirements 44.3, 44.4, 44.5, 44.6, 44.9**

### 29. Contact and Support

- [ ] 29.1 Create contact page
  - Implement app/(main)/contact/page.tsx
  - Display contact form with name, email, subject, message fields
  - Validate form inputs
  - Allow file attachments (max 5MB)
  - _Requirements: 42.1, 42.2, 42.9_

- [ ] 29.2 Implement contact form submission
  - Send message to Backend API
  - Display success message
  - _Requirements: 42.3, 42.4_

- [ ] 29.3 Add support information
  - Display support email and phone number
  - Display business hours
  - Create FAQ section
  - _Requirements: 42.5, 42.6, 42.8_

- [ ] 29.4 Add live chat widget
  - Implement live chat widget for real-time support
  - _Requirements: 42.7_

- [ ]* 29.5 Write property test for contact form
  - **Property 74: Contact Form Submission**
  - **Validates: Requirements 42.3, 42.4, 42.9**

### 30. SEO Optimization

- [ ] 30.1 Implement dynamic meta tags
  - Add dynamic title, description, keywords for all pages
  - Use Next.js Metadata API
  - _Requirements: 43.1_

- [ ] 30.2 Add structured data
  - Generate JSON-LD structured data for trips, hotels, reviews
  - _Requirements: 43.2_

- [ ] 30.3 Implement canonical URLs and sitemaps
  - Add canonical URLs to prevent duplicate content
  - Generate sitemap.xml with all public pages
  - Generate robots.txt with crawling instructions
  - _Requirements: 43.3, 43.4, 43.5_

- [ ] 30.4 Add social media tags
  - Implement Open Graph tags for social sharing
  - Implement Twitter Card tags
  - _Requirements: 43.6, 43.7_

- [ ] 30.5 Ensure proper heading hierarchy
  - Verify all pages have proper h1, h2, h3 hierarchy
  - _Requirements: 43.8_

- [ ] 30.6 Implement server-side rendering
  - Use Next.js SSR for critical pages
  - _Requirements: 43.9_

- [ ]* 30.7 Write property tests for SEO
  - **Property 75: SEO Metadata Completeness**
  - **Validates: Requirements 43.1, 43.2, 43.3, 43.6, 43.7**
  - **Property 76: SEO Heading Hierarchy**
  - **Validates: Requirements 43.8**

### 31. Admin Dashboard

- [ ] 31.1 Create admin layout and navigation
  - Implement app/(admin)/layout.tsx
  - Add admin navigation link for admin users
  - Protect admin routes by role
  - _Requirements: 45.1, 45.2_

- [ ] 31.2 Create admin dashboard page
  - Implement app/(admin)/dashboard/page.tsx
  - Display key metrics (bookings, revenue, users)
  - Display analytics charts
  - _Requirements: 45.3, 45.8_

- [ ] 31.3 Create admin booking management
  - Display all bookings with filters
  - Allow viewing and managing bookings
  - _Requirements: 45.4_

- [ ] 31.4 Create admin support management
  - Display support messages
  - Allow responding to messages
  - _Requirements: 45.5_

- [ ] 31.5 Create admin review moderation
  - Display all reviews
  - Allow moderating reviews
  - _Requirements: 45.6_

- [ ] 31.6 Create admin emergency alert management
  - Display emergency alerts
  - Allow managing alerts
  - _Requirements: 45.7_

- [ ] 31.7 Add admin access control
  - Redirect non-admin users to home page
  - _Requirements: 45.9_

- [ ]* 31.8 Write property test for admin access
  - **Property 78: Admin Access Control**
  - **Validates: Requirements 45.1, 45.2, 45.9**

### 32. Legal and Compliance

- [ ] 32.1 Create legal pages
  - Implement Terms of Service page
  - Implement Privacy Policy page
  - Implement Cookie Policy page
  - _Requirements: 50.1, 50.2, 50.3_

- [ ] 32.2 Implement cookie consent
  - Create cookie consent banner
  - Add accept/reject options
  - Respect user preferences and disable non-essential cookies when rejected
  - _Requirements: 23.7, 50.4, 50.5_

- [ ] 32.3 Add GDPR features
  - Create GDPR data request form
  - Allow users to download personal data
  - Allow users to request account deletion
  - _Requirements: 50.6, 50.7, 50.8_

- [ ] 32.4 Add age verification
  - Display age verification for users under 18
  - _Requirements: 50.9_

- [ ]* 32.5 Write property test for cookie consent
  - **Property 84: Cookie Consent Compliance**
  - **Validates: Requirements 50.5**

### 33. Performance Optimization

- [ ] 33.1 Implement code splitting
  - Use dynamic imports for route-based chunks
  - Implement lazy loading for heavy components
  - _Requirements: 17.1_

- [ ] 33.2 Optimize images
  - Use Next.js Image component throughout app
  - Implement lazy loading for below-fold images
  - _Requirements: 17.2, 17.3_

- [ ] 33.3 Add resource prefetching
  - Prefetch critical resources on hover
  - Prefetch next-page routes
  - _Requirements: 17.4_

- [ ] 33.4 Implement virtual scrolling
  - Add virtual scrolling for long lists (trips, bookings)
  - _Requirements: 17.8_

- [ ] 33.5 Optimize bundle size
  - Analyze bundle composition
  - Tree-shake unused code
  - _Requirements: 17.9, 26.8_

- [ ] 33.6 Achieve performance targets
  - Optimize for Lighthouse score above 90
  - _Requirements: 17.5_

- [ ]* 33.7 Write property tests for performance features
  - **Property 41: Lazy Loading**
  - **Validates: Requirements 17.3**
  - **Property 42: Resource Prefetching**
  - **Validates: Requirements 17.4**


### 34. Accessibility (a11y)

- [ ] 34.1 Implement semantic HTML
  - Use semantic elements (nav, main, article, section)
  - Provide alt text for all images
  - Maintain proper heading hierarchy
  - _Requirements: 18.1, 18.2, 18.7_

- [ ] 34.2 Add keyboard navigation
  - Ensure all interactive elements are keyboard accessible
  - Maintain visible focus indicators
  - Add skip-to-content links
  - _Requirements: 18.3, 18.4, 18.8_

- [ ] 34.3 Add ARIA attributes
  - Use ARIA labels and roles where needed
  - Implement ARIA live regions for dynamic content
  - _Requirements: 18.5, 18.9_

- [ ] 34.4 Ensure color contrast
  - Verify color contrast ratios meet WCAG AA standards (4.5:1)
  - _Requirements: 18.6_

- [ ]* 34.5 Write property tests for accessibility
  - **Property 43: Accessibility - Keyboard Navigation**
  - **Validates: Requirements 18.3, 18.4**
  - **Property 44: Accessibility - Image Alt Text**
  - **Validates: Requirements 18.2**

### 35. Error Handling and Recovery

- [ ] 35.1 Implement form validation and error display
  - Validate on blur and submit
  - Display inline error messages
  - Disable submit until valid
  - Map API errors to form fields
  - _Requirements: 16.3, 16.4, 16.5, 16.6_

- [ ] 35.2 Add toast notifications
  - Display toast for success and error actions
  - _Requirements: 16.7, 19.6_

- [ ] 35.3 Implement error boundaries
  - Create error boundary components
  - Display fallback UI with navigation options
  - _Requirements: 16.8, 32.5, 32.6_

- [ ] 35.4 Add error logging
  - Log errors to monitoring service (Sentry)
  - Include context (user, route, actions)
  - Exclude sensitive data
  - _Requirements: 16.9, 32.7, 49.2, 49.3, 49.4, 49.5, 49.9_

- [ ] 35.5 Implement retry logic
  - Add retry buttons for network errors
  - Implement automatic retry with exponential backoff
  - Preserve form data on errors
  - _Requirements: 32.1, 32.2, 32.3, 32.4, 32.9_

- [ ]* 35.6 Write property tests for error handling
  - **Property 36: Form Validation Feedback**
  - **Validates: Requirements 16.3, 16.4, 16.5**
  - **Property 37: API Error Mapping**
  - **Validates: Requirements 5.9, 16.6**
  - **Property 38: Toast Notifications**
  - **Validates: Requirements 16.7, 19.6**
  - **Property 39: Error Boundary Handling**
  - **Validates: Requirements 16.8, 32.5, 32.6**
  - **Property 40: Error Logging**
  - **Validates: Requirements 16.9, 32.7, 49.2, 49.3, 49.4, 49.5**
  - **Property 66: Error Recovery**
  - **Validates: Requirements 32.1, 32.9**

### 36. Loading States and UX

- [ ] 36.1 Implement loading indicators
  - Add skeleton loaders matching content shape
  - Add spinner indicators for button actions
  - Add progress bars for uploads and long operations
  - Add shimmer animations
  - _Requirements: 31.1, 31.2, 31.3, 31.5, 31.9_

- [ ] 36.2 Add suspense boundaries
  - Implement suspense for lazy-loaded components
  - Add loading states for route transitions
  - _Requirements: 31.6, 31.7_

- [ ] 36.3 Implement optimistic updates
  - Add optimistic UI updates for mutations
  - Implement rollback on error
  - _Requirements: 14.7, 31.8_

- [ ]* 36.4 Write property tests for loading states
  - **Property 65: Loading State Display**
  - **Validates: Requirements 31.1, 31.2, 31.3, 31.5, 31.7**

### 37. Date and Time Handling

- [ ] 37.1 Set up date library
  - Install date-fns or dayjs
  - Create date utility functions
  - _Requirements: 30.1_

- [ ] 37.2 Implement date formatting
  - Display dates in user's local timezone
  - Format dates according to locale
  - Display relative time for recent activities
  - Display timezone indicators
  - _Requirements: 30.2, 30.3, 30.6, 30.8_

- [ ] 37.3 Add date validation
  - Validate dates are in future for bookings
  - Validate date ranges
  - _Requirements: 30.5_

- [ ] 37.4 Implement timezone handling
  - Handle timezone conversions with Backend API
  - _Requirements: 30.7_

- [ ] 37.5 Add date range selection
  - Implement date range picker for multi-day bookings
  - _Requirements: 30.9_

- [ ]* 37.6 Write property tests for date handling
  - **Property 62: Date Validation**
  - **Validates: Requirements 30.5**
  - **Property 63: Relative Time Display**
  - **Validates: Requirements 30.6**
  - **Property 64: Timezone Handling**
  - **Validates: Requirements 30.7**

### 38. Analytics and Tracking

- [ ] 38.1 Set up analytics service
  - Integrate Google Analytics or similar
  - Configure tracking with privacy compliance
  - _Requirements: 23.1, 23.6_

- [ ] 38.2 Implement event tracking
  - Track page views for all routes
  - Track custom events (search, booking, payment, chat)
  - Track conversion funnels
  - Track AI chat interactions
  - Anonymize user data
  - _Requirements: 23.2, 23.3, 23.4, 23.5, 23.8_

- [ ] 38.3 Track performance metrics
  - Track page load times
  - Track API response times
  - _Requirements: 23.9_

- [ ]* 38.4 Write property test for analytics
  - **Property 53: Analytics Event Tracking**
  - **Validates: Requirements 23.2, 23.3, 23.4, 23.5, 23.8, 23.9**

### 39. Monitoring and Error Tracking

- [ ] 39.1 Set up Sentry
  - Install and configure Sentry
  - Configure environment and sample rate
  - Implement beforeSend to exclude sensitive data
  - _Requirements: 49.1_

- [ ] 39.2 Capture errors
  - Capture JavaScript errors with stack traces
  - Capture unhandled promise rejections
  - Capture API errors with request/response details
  - Include user context for authenticated users
  - _Requirements: 49.2, 49.3, 49.4, 49.5_

- [ ] 39.3 Implement performance monitoring
  - Track page load times
  - Track Core Web Vitals (LCP, FID, CLS)
  - Add custom performance marks for critical flows
  - _Requirements: 49.6, 49.7, 49.8_

- [ ]* 39.4 Write property test for monitoring
  - **Property 83: Performance Monitoring**
  - **Validates: Requirements 49.6, 49.7, 49.8**

### 40. Security Implementation

- [ ] 40.1 Implement security best practices
  - Use HTTPS for all requests
  - Store tokens in httpOnly cookies
  - Implement Content Security Policy headers
  - Use Subresource Integrity for third-party scripts
  - _Requirements: 24.1, 24.2, 24.3, 24.9_

- [ ] 40.2 Add input sanitization
  - Sanitize user input to prevent XSS
  - _Requirements: 24.4_

- [ ] 40.3 Implement API response validation
  - Validate data structure before use
  - _Requirements: 24.5_

- [ ] 40.4 Add client-side rate limiting
  - Implement rate limiting for API requests
  - _Requirements: 24.6_

- [ ] 40.5 Implement CSRF protection
  - Add CSRF protection for state-changing requests
  - _Requirements: 24.8_

- [ ] 40.6 Ensure sensitive data protection
  - Exclude tokens and passwords from logs
  - _Requirements: 24.7, 49.9_

- [ ]* 40.7 Write property tests for security
  - **Property 54: Security - Input Sanitization**
  - **Validates: Requirements 24.4**
  - **Property 55: Security - API Response Validation**
  - **Validates: Requirements 24.5**
  - **Property 56: Security - Sensitive Data Protection**
  - **Validates: Requirements 24.7, 49.9**
  - **Property 57: Security - HTTPS Enforcement**
  - **Validates: Requirements 24.1**
  - **Property 58: Security - Rate Limiting**
  - **Validates: Requirements 24.6**
  - **Property 59: Security - CSRF Protection**
  - **Validates: Requirements 24.8**

### 41. Data Persistence and Sync

- [ ] 41.1 Implement local storage utilities
  - Create utilities for storing/retrieving data
  - Handle storage quota exceeded errors
  - _Requirements: 48.9_

- [ ] 41.2 Persist authentication tokens
  - Store tokens in httpOnly cookies
  - _Requirements: 48.1_

- [ ] 41.3 Persist user preferences
  - Store language, theme, currency in local storage
  - _Requirements: 48.2_

- [ ] 41.4 Persist chat history
  - Store chat messages in local storage with size limits
  - _Requirements: 48.3_

- [ ] 41.5 Persist favorites for unauthenticated users
  - Store favorites in local storage
  - _Requirements: 48.4_

- [ ] 41.6 Implement login data sync
  - Sync local storage data with Backend API on login
  - _Requirements: 48.5_

- [ ] 41.7 Implement background sync
  - Queue offline actions in IndexedDB
  - Sync when connection restored
  - _Requirements: 48.6_

- [ ] 41.8 Clear data on logout
  - Clear sensitive data from local storage
  - _Requirements: 48.7_

- [ ] 41.9 Implement storage migration
  - Handle schema changes with data migration
  - _Requirements: 48.8_

- [ ]* 41.10 Write property tests for data persistence
  - **Property 80: Login Data Sync**
  - **Validates: Requirements 48.5**
  - **Property 81: Storage Schema Migration**
  - **Validates: Requirements 48.8**
  - **Property 82: Storage Quota Handling**
  - **Validates: Requirements 48.9**

### 42. Theme Support

- [ ] 42.1 Implement dark mode
  - Create dark mode theme with CSS variables
  - Implement theme toggle component
  - Persist theme preference in local storage
  - Update UI immediately on theme change
  - _Requirements: 27.6, 27.7, 27.8_

- [ ]* 42.2 Write property test for theme
  - **Property 60: Theme Toggle Persistence**
  - **Validates: Requirements 27.6, 27.7**

### 43. React Query Optimizations

- [ ] 43.1 Configure React Query caching
  - Set appropriate stale times for different data types
  - Implement cache invalidation strategies
  - Configure automatic refetch on window focus
  - _Requirements: 14.6, 14.8_

- [ ] 43.2 Implement optimistic updates
  - Add optimistic updates for mutations
  - Implement rollback on error
  - _Requirements: 14.7_

- [ ] 43.3 Add retry logic
  - Configure retry with exponential backoff
  - _Requirements: 14.9_

- [ ]* 43.4 Write property tests for React Query
  - **Property 33: API Response Caching**
  - **Validates: Requirements 14.6, 14.8**
  - **Property 34: Optimistic Updates**
  - **Validates: Requirements 14.7, 31.8**
  - **Property 35: Request Retry Logic**
  - **Validates: Requirements 14.9, 15.9, 32.2, 32.3, 32.4**

### 44. Testing Infrastructure

- [ ] 44.1 Set up Vitest for unit testing
  - Install Vitest and React Testing Library
  - Configure vitest.config.ts
  - Create test setup file
  - _Requirements: 25.1, 25.2_

- [ ] 44.2 Set up fast-check for property-based testing
  - Install fast-check
  - Configure fast-check with 100+ iterations
  - Create domain object generators (User, Trip, Booking, etc.)
  - _Requirements: 25.4_

- [ ] 44.3 Set up Playwright for E2E testing
  - Install Playwright
  - Configure playwright.config.ts
  - _Requirements: 25.3_

- [ ] 44.4 Configure test coverage
  - Set up coverage reporting
  - Configure minimum coverage thresholds (80% overall, 95% critical paths)
  - _Requirements: 25.4_

- [ ] 44.5 Set up CI/CD pipeline
  - Create GitHub Actions workflow
  - Run linter, type check, unit tests, integration tests, E2E tests
  - Upload coverage reports
  - _Requirements: 25.9_

### 45. End-to-End Tests

- [ ]* 45.1 Write E2E test for registration and login
  - Test complete registration flow
  - Test login flow
  - _Requirements: 25.5_

- [ ]* 45.2 Write E2E test for booking flow
  - Test trip search and selection
  - Test booking form submission
  - Test payment with Stripe
  - Test booking confirmation
  - _Requirements: 25.6_

- [ ]* 45.3 Write E2E test for AI chat
  - Test chat opening and connection
  - Test message sending and receiving
  - Test trip recommendation and booking
  - _Requirements: 25.7_

- [ ]* 45.4 Write E2E test for profile management
  - Test profile editing
  - Test student verification upload
  - _Requirements: 25.5_

- [ ]* 45.5 Write E2E test for emergency alert
  - Test emergency alert with GPS
  - _Requirements: 25.5_

- [ ]* 45.6 Write E2E test for offline functionality
  - Test offline map access
  - Test PWA installation
  - _Requirements: 25.8_

- [ ]* 45.7 Write E2E test for multi-language
  - Test language switching
  - Test content translation
  - _Requirements: 25.5_

- [ ]* 45.8 Write E2E test for booking cancellation
  - Test cancellation flow
  - Test refund display
  - _Requirements: 25.6_

### 46. Deployment Configuration

- [ ] 46.1 Configure environment variables
  - Create .env.example with all required variables
  - Document all environment variables
  - Validate required variables at build time
  - _Requirements: 26.1, 46.1, 46.2, 46.3_

- [ ] 46.2 Configure deployment settings
  - Configure for Vercel/Netlify deployment
  - Set up CORS headers
  - Configure rate limiting headers
  - Configure caching headers for static assets
  - _Requirements: 46.4, 46.6, 46.7, 46.8_

- [ ] 46.3 Create health check endpoint
  - Implement app/api/health/route.ts
  - _Requirements: 46.5_

- [ ] 46.4 Document deployment process
  - Update README.md with setup instructions
  - Document deployment steps
  - _Requirements: 26.9, 46.9_

### 47. Final Integration and Testing

- [ ] 47.1 Checkpoint - Integration testing
  - Test all features work together
  - Test authentication flows across app
  - Test booking flows end-to-end
  - Test AI chat integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 47.2 Checkpoint - Performance testing
  - Run Lighthouse audits
  - Verify performance score above 90
  - Test with large datasets
  - Verify bundle size is optimized
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 47.3 Checkpoint - Accessibility testing
  - Run automated a11y checks with jest-axe
  - Test keyboard navigation
  - Test screen reader compatibility
  - Verify color contrast
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 47.4 Checkpoint - Cross-browser testing
  - Test on Chrome, Firefox, Safari, Edge
  - Test on iOS and Android devices
  - Test PWA installation on all platforms
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 47.5 Final checkpoint - Production readiness
  - Verify all environment variables configured
  - Verify error tracking is working
  - Verify analytics is tracking correctly
  - Verify all legal pages are complete
  - Run full test suite
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout implementation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate component interactions
- E2E tests validate critical user flows
- All tasks build incrementally with no orphaned code
- Testing tasks are sub-tasks to keep implementation and testing close together

## Implementation Order

The tasks are organized to build the application incrementally:

1. Foundation (Tasks 1-3): Project setup, UI components, state management
2. Core Features (Tasks 4-10): Auth, API client, main screens, navigation
3. Booking System (Tasks 11-15): Booking flow, payment, confirmation, emergency alerts
4. User Features (Tasks 16-22): Profile, AI chat, i18n, PWA, reviews, favorites, search
5. Extended Features (Tasks 23-32): Hotels, guides, festivals, notifications, sharing, currency, contact, SEO, admin, legal
6. Quality & Performance (Tasks 33-43): Performance, accessibility, error handling, UX, dates, analytics, monitoring, security, persistence, theme, React Query
7. Testing & Deployment (Tasks 44-47): Test infrastructure, E2E tests, deployment, final integration

Each phase builds on the previous one, ensuring a working application at every stage.
