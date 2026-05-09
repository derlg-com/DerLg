# Requirements Document

## Introduction

This document specifies the requirements for the DerLg.com frontend application, a Cambodia travel booking platform built with Next.js 14. The frontend provides a Progressive Web App (PWA) experience with five main screens (Home, Explore, Booking, My Trip, Profile), an AI-powered travel assistant with full-screen chat interface, offline map support, multi-language capabilities, and comprehensive booking management for trips, hotels, transportation, and guides. The application integrates with a NestJS backend API and a Python AI Agent service.

## Glossary

- **Frontend_App**: The Next.js 14 client application running in the user's browser
- **Backend_API**: The NestJS REST API service providing data and business logic
- **AI_Agent**: The Python-based conversational AI service using LangGraph and Claude
- **User**: A person using the DerLg.com platform (authenticated or guest)
- **Auth_Token**: JWT access token for authenticated API requests
- **Refresh_Token**: JWT token used to obtain new access tokens
- **WebSocket_Connection**: Real-time bidirectional connection for AI chat
- **Service_Worker**: Browser background script enabling offline functionality
- **Trip**: A pre-packaged travel experience with itinerary and pricing
- **Booking**: A confirmed reservation for a trip, hotel, transportation, or guide
- **Emergency_Alert**: A distress signal sent with GPS coordinates
- **Loyalty_Points**: Reward points earned through bookings and activities
- **Student_Discount**: Special pricing for verified students
- **Offline_Map**: Cached map tiles accessible without internet connection
- **i18n_System**: Internationalization system supporting EN, KH, ZH languages
- **PWA**: Progressive Web App with installable and offline capabilities
- **Route_Segment**: A Next.js App Router page or layout component
- **Server_Component**: React Server Component rendered on the server
- **Client_Component**: React Client Component with interactivity
- **State_Manager**: Zustand store managing client-side application state
- **Query_Cache**: React Query cache for server state management


## Requirements

### Requirement 1: Application Foundation and Routing

**User Story:** As a developer, I want a properly configured Next.js 14 App Router application, so that I can build a modern, performant web application with server and client components.

#### Acceptance Criteria

1. THE Frontend_App SHALL use Next.js 14 with App Router architecture
2. THE Frontend_App SHALL define Route_Segments for Home (/), Explore (/explore), Booking (/booking), My Trip (/my-trip), and Profile (/profile)
3. THE Frontend_App SHALL implement a root layout with shared navigation and metadata
4. THE Frontend_App SHALL use Server_Components by default for static content
5. THE Frontend_App SHALL use Client_Components only when interactivity is required
6. THE Frontend_App SHALL configure TypeScript with strict mode enabled
7. THE Frontend_App SHALL use Tailwind CSS for styling with a custom design system
8. THE Frontend_App SHALL implement responsive layouts for mobile, tablet, and desktop viewports

### Requirement 2: Authentication System

**User Story:** As a user, I want to register, login, and stay authenticated, so that I can access personalized features and manage my bookings.

#### Acceptance Criteria

1. WHEN a user submits valid registration credentials, THE Frontend_App SHALL call the Backend_API registration endpoint and store the returned Auth_Token and Refresh_Token
2. WHEN a user submits valid login credentials, THE Frontend_App SHALL call the Backend_API login endpoint and store the returned Auth_Token and Refresh_Token
3. THE Frontend_App SHALL store Auth_Token and Refresh_Token in httpOnly cookies
4. WHEN an Auth_Token expires, THE Frontend_App SHALL automatically use the Refresh_Token to obtain a new Auth_Token
5. WHEN a Refresh_Token is invalid or expired, THE Frontend_App SHALL redirect the user to the login page
6. THE Frontend_App SHALL include the Auth_Token in the Authorization header for all authenticated API requests
7. WHEN a user logs out, THE Frontend_App SHALL clear all authentication tokens and redirect to the home page
8. THE Frontend_App SHALL protect authenticated routes by checking token validity before rendering
9. WHEN a user accesses a protected route without authentication, THE Frontend_App SHALL redirect to the login page with a return URL parameter


### Requirement 3: Home Screen

**User Story:** As a user, I want to see featured trips, upcoming festivals, and quick access to the AI assistant, so that I can discover travel opportunities and get help planning my trip.

#### Acceptance Criteria

1. THE Frontend_App SHALL display a hero section with a search bar and AI quick-start button on the Home screen
2. THE Frontend_App SHALL fetch and display featured trips from the Backend_API with images, titles, prices, and durations
3. THE Frontend_App SHALL fetch and display upcoming festivals from the Backend_API with dates, locations, and descriptions
4. WHEN a user clicks a featured trip, THE Frontend_App SHALL navigate to the trip detail page
5. WHEN a user clicks the AI quick-start button, THE Frontend_App SHALL open the full-screen AI chat interface
6. THE Frontend_App SHALL display a categories section with icons for Temples, Nature, Culture, Adventure, and Food
7. WHEN a user clicks a category, THE Frontend_App SHALL navigate to the Explore screen with that category pre-filtered
8. THE Frontend_App SHALL implement infinite scroll or pagination for featured trips
9. THE Frontend_App SHALL display loading skeletons while fetching data from the Backend_API

### Requirement 4: Explore Screen

**User Story:** As a user, I want to browse places, festivals, and view offline maps, so that I can discover destinations and plan my itinerary.

#### Acceptance Criteria

1. THE Frontend_App SHALL display tabs for Places, Festivals, and Maps on the Explore screen
2. WHEN the Places tab is active, THE Frontend_App SHALL fetch and display places from the Backend_API with filtering by category, region, and price range
3. WHEN the Festivals tab is active, THE Frontend_App SHALL fetch and display festivals from the Backend_API with filtering by date and location
4. WHEN the Maps tab is active, THE Frontend_App SHALL display an interactive map using Leaflet.js with markers for places and festivals
5. THE Frontend_App SHALL implement search functionality with debounced input for places and festivals
6. WHEN a user clicks a place or festival, THE Frontend_App SHALL display a detail modal with full information and booking options
7. THE Frontend_App SHALL display filter chips that update the displayed results in real-time
8. THE Frontend_App SHALL persist filter selections in URL query parameters for shareable links
9. THE Frontend_App SHALL implement infinite scroll for places and festivals lists


### Requirement 5: Booking Flow

**User Story:** As a user, I want to book trips, hotels, transportation, and guides, so that I can plan and confirm my travel arrangements.

#### Acceptance Criteria

1. WHEN a user selects a trip, hotel, transportation, or guide, THE Frontend_App SHALL display a booking form with date selection, guest count, and special requests
2. THE Frontend_App SHALL validate that selected dates are available by calling the Backend_API availability endpoint
3. WHEN a user submits a booking form, THE Frontend_App SHALL create a booking via the Backend_API and receive a booking confirmation
4. THE Frontend_App SHALL display a booking summary with total price, breakdown of costs, and applicable discounts
5. WHEN a Student_Discount is available, THE Frontend_App SHALL display the discount amount and require student verification
6. THE Frontend_App SHALL calculate and display Loyalty_Points that will be earned from the booking
7. WHEN a booking is created, THE Frontend_App SHALL navigate to the payment screen with the booking ID
8. THE Frontend_App SHALL prevent double-booking by disabling the submit button after the first submission
9. THE Frontend_App SHALL display error messages from the Backend_API for invalid booking requests

### Requirement 6: Payment Integration

**User Story:** As a user, I want to pay for bookings using Stripe or QR code, so that I can complete my reservations securely.

#### Acceptance Criteria

1. WHEN a user reaches the payment screen, THE Frontend_App SHALL fetch payment options from the Backend_API
2. THE Frontend_App SHALL display Stripe card payment form using Stripe Elements
3. WHEN a user selects QR code payment, THE Frontend_App SHALL display a QR code image from the Backend_API
4. WHEN a user submits a Stripe payment, THE Frontend_App SHALL call the Backend_API payment endpoint and handle the payment confirmation
5. WHEN a payment succeeds, THE Frontend_App SHALL display a success message and navigate to the booking confirmation page
6. WHEN a payment fails, THE Frontend_App SHALL display the error message from Stripe or the Backend_API
7. THE Frontend_App SHALL implement 3D Secure authentication flow for Stripe payments when required
8. THE Frontend_App SHALL display payment status updates in real-time for QR code payments
9. THE Frontend_App SHALL store the payment receipt and allow users to download it as PDF


### Requirement 7: My Trip Screen

**User Story:** As a user, I want to view my upcoming and past bookings, so that I can manage my travel plans and access booking details.

#### Acceptance Criteria

1. THE Frontend_App SHALL display tabs for Upcoming and Past bookings on the My Trip screen
2. WHEN the Upcoming tab is active, THE Frontend_App SHALL fetch and display bookings with status "confirmed" or "pending" from the Backend_API
3. WHEN the Past tab is active, THE Frontend_App SHALL fetch and display bookings with status "completed" or "cancelled" from the Backend_API
4. THE Frontend_App SHALL display each booking with trip name, dates, location, status, and total price
5. WHEN a user clicks a booking, THE Frontend_App SHALL navigate to the booking detail page with full itinerary and contact information
6. WHEN a booking is within 24 hours of start time, THE Frontend_App SHALL display an Emergency_Alert button
7. THE Frontend_App SHALL allow users to cancel bookings by calling the Backend_API cancellation endpoint
8. WHEN a user cancels a booking, THE Frontend_App SHALL display the cancellation policy and refund amount before confirmation
9. THE Frontend_App SHALL display a QR code for each booking that can be scanned for check-in

### Requirement 8: Profile Screen

**User Story:** As a user, I want to manage my profile, view loyalty points, and configure preferences, so that I can personalize my experience.

#### Acceptance Criteria

1. THE Frontend_App SHALL display user profile information including name, email, phone, and profile picture on the Profile screen
2. THE Frontend_App SHALL allow users to edit profile information and save changes via the Backend_API
3. THE Frontend_App SHALL display current Loyalty_Points balance and points history
4. THE Frontend_App SHALL display Student_Discount status and allow users to upload verification documents
5. THE Frontend_App SHALL allow users to change their password by providing current and new passwords
6. THE Frontend_App SHALL display language selection for EN, KH, and ZH with immediate UI updates
7. THE Frontend_App SHALL display notification preferences with toggles for email, push, and SMS notifications
8. THE Frontend_App SHALL allow users to delete their account with a confirmation dialog
9. WHEN a user uploads a profile picture, THE Frontend_App SHALL compress the image before sending to the Backend_API


### Requirement 9: AI Chat Interface

**User Story:** As a user, I want to chat with an AI travel assistant, so that I can get personalized recommendations and answers to my travel questions.

#### Acceptance Criteria

1. WHEN a user opens the AI chat, THE Frontend_App SHALL establish a WebSocket_Connection to the AI_Agent service
2. THE Frontend_App SHALL display a full-screen chat interface with message history and input field
3. WHEN a user sends a message, THE Frontend_App SHALL transmit the message via the WebSocket_Connection and display it in the chat
4. WHEN the AI_Agent sends a response, THE Frontend_App SHALL receive it via the WebSocket_Connection and display it in the chat
5. THE Frontend_App SHALL render structured message types including text, trip cards, hotel cards, and action buttons
6. WHEN the AI_Agent sends a trip recommendation, THE Frontend_App SHALL display an interactive trip card with booking button
7. WHEN a user clicks a booking button in the chat, THE Frontend_App SHALL navigate to the booking flow with pre-filled information
8. THE Frontend_App SHALL display typing indicators when the AI_Agent is processing a response
9. THE Frontend_App SHALL persist chat history in local storage and restore it when the chat is reopened
10. WHEN the WebSocket_Connection is lost, THE Frontend_App SHALL attempt to reconnect automatically with exponential backoff
11. THE Frontend_App SHALL display connection status indicators for connected, connecting, and disconnected states
12. THE Frontend_App SHALL allow users to close the chat and return to the previous screen

### Requirement 10: Emergency Alert System

**User Story:** As a user, I want to send emergency alerts with my location, so that I can get help when I'm in distress during my trip.

#### Acceptance Criteria

1. WHEN a user has an active booking within 24 hours of start time, THE Frontend_App SHALL display an Emergency_Alert button
2. WHEN a user clicks the Emergency_Alert button, THE Frontend_App SHALL request GPS location permission from the browser
3. WHEN GPS permission is granted, THE Frontend_App SHALL capture the current latitude and longitude coordinates
4. THE Frontend_App SHALL send the emergency alert with GPS coordinates and booking ID to the Backend_API
5. WHEN an emergency alert is sent successfully, THE Frontend_App SHALL display a confirmation message with emergency contact numbers
6. WHEN GPS permission is denied, THE Frontend_App SHALL allow the user to manually enter their location
7. THE Frontend_App SHALL display the user's current location on a map before sending the alert
8. THE Frontend_App SHALL include a cancel button with a 5-second countdown before sending the alert


### Requirement 11: Offline Map Support

**User Story:** As a user, I want to access maps offline, so that I can navigate even without internet connection.

#### Acceptance Criteria

1. THE Frontend_App SHALL use Leaflet.js for map rendering with OpenStreetMap tiles
2. THE Frontend_App SHALL implement a Service_Worker that caches map tiles for offline access
3. WHEN a user views a map region, THE Frontend_App SHALL cache the visible tiles in the browser cache
4. WHEN a user is offline, THE Frontend_App SHALL serve cached map tiles from the Service_Worker
5. THE Frontend_App SHALL display a download button to pre-cache map tiles for specific regions
6. WHEN a user downloads a region, THE Frontend_App SHALL cache all tiles within the specified zoom levels and boundaries
7. THE Frontend_App SHALL display storage usage and allow users to clear cached map data
8. THE Frontend_App SHALL display markers for saved places and bookings on the offline map
9. WHEN a user is offline, THE Frontend_App SHALL display a banner indicating offline mode

### Requirement 12: Progressive Web App (PWA)

**User Story:** As a user, I want to install the app on my device and use it offline, so that I can access it like a native application.

#### Acceptance Criteria

1. THE Frontend_App SHALL include a web app manifest with app name, icons, theme colors, and display mode
2. THE Frontend_App SHALL implement a Service_Worker for offline functionality and caching strategies
3. THE Frontend_App SHALL cache static assets (CSS, JS, images) for offline access
4. THE Frontend_App SHALL implement a cache-first strategy for static assets and network-first strategy for API requests
5. WHEN a user is offline, THE Frontend_App SHALL display cached pages and data
6. THE Frontend_App SHALL display an install prompt when PWA installation criteria are met
7. THE Frontend_App SHALL be installable on iOS, Android, and desktop browsers
8. THE Frontend_App SHALL display a custom offline page when no cached content is available
9. THE Frontend_App SHALL sync pending actions (bookings, profile updates) when connection is restored


### Requirement 13: Internationalization (i18n)

**User Story:** As a user, I want to use the app in my preferred language, so that I can understand all content and navigate easily.

#### Acceptance Criteria

1. THE Frontend_App SHALL support English (EN), Khmer (KH), and Chinese (ZH) languages
2. THE Frontend_App SHALL use next-intl or react-i18next for the i18n_System
3. THE Frontend_App SHALL detect the user's browser language and set it as the default language
4. WHEN a user changes the language in settings, THE Frontend_App SHALL update all UI text immediately
5. THE Frontend_App SHALL persist the selected language in local storage
6. THE Frontend_App SHALL translate all static UI text including buttons, labels, and error messages
7. THE Frontend_App SHALL fetch translated content (trip descriptions, place names) from the Backend_API based on the selected language
8. THE Frontend_App SHALL format dates, times, and currencies according to the selected locale
9. THE Frontend_App SHALL support right-to-left (RTL) layout if additional languages require it in the future

### Requirement 14: State Management

**User Story:** As a developer, I want a predictable state management system, so that I can manage client-side state and server state efficiently.

#### Acceptance Criteria

1. THE Frontend_App SHALL use Zustand as the State_Manager for client-side application state
2. THE Frontend_App SHALL use React Query as the Query_Cache for server state management
3. THE State_Manager SHALL manage authentication state including Auth_Token, Refresh_Token, and user profile
4. THE State_Manager SHALL manage UI state including modal visibility, drawer state, and loading indicators
5. THE State_Manager SHALL manage chat state including message history and WebSocket_Connection status
6. THE Query_Cache SHALL cache API responses with configurable stale times and cache invalidation
7. THE Query_Cache SHALL implement optimistic updates for mutations (bookings, profile updates)
8. THE Query_Cache SHALL automatically refetch data when the window regains focus
9. THE Query_Cache SHALL implement retry logic with exponential backoff for failed requests


### Requirement 15: API Integration Layer

**User Story:** As a developer, I want a centralized API client, so that I can make consistent and type-safe requests to the Backend_API.

#### Acceptance Criteria

1. THE Frontend_App SHALL implement an API client using Axios or Fetch with TypeScript types
2. THE API client SHALL include the Auth_Token in the Authorization header for authenticated requests
3. THE API client SHALL implement request interceptors to add common headers and authentication
4. THE API client SHALL implement response interceptors to handle errors and token refresh
5. WHEN a 401 Unauthorized response is received, THE API client SHALL attempt to refresh the Auth_Token using the Refresh_Token
6. WHEN token refresh fails, THE API client SHALL clear authentication state and redirect to login
7. THE API client SHALL implement timeout configuration with default 30-second timeout
8. THE API client SHALL parse and transform API responses into TypeScript interfaces
9. THE API client SHALL implement retry logic for network errors with exponential backoff

### Requirement 16: Form Validation and Error Handling

**User Story:** As a user, I want clear validation feedback and error messages, so that I can correct mistakes and complete forms successfully.

#### Acceptance Criteria

1. THE Frontend_App SHALL use React Hook Form or Formik for form state management
2. THE Frontend_App SHALL use Zod or Yup for schema validation
3. THE Frontend_App SHALL validate form inputs on blur and on submit
4. WHEN a form field is invalid, THE Frontend_App SHALL display an error message below the field
5. THE Frontend_App SHALL disable submit buttons until all required fields are valid
6. WHEN the Backend_API returns validation errors, THE Frontend_App SHALL map them to the corresponding form fields
7. THE Frontend_App SHALL display toast notifications for successful actions and global errors
8. THE Frontend_App SHALL implement error boundaries to catch and display React errors gracefully
9. THE Frontend_App SHALL log errors to a monitoring service (Sentry or similar) in production


### Requirement 17: Performance Optimization

**User Story:** As a user, I want the app to load quickly and respond smoothly, so that I can have a seamless experience.

#### Acceptance Criteria

1. THE Frontend_App SHALL implement code splitting with dynamic imports for route-based chunks
2. THE Frontend_App SHALL use Next.js Image component for automatic image optimization
3. THE Frontend_App SHALL implement lazy loading for images below the fold
4. THE Frontend_App SHALL prefetch critical resources and next-page routes on hover
5. THE Frontend_App SHALL achieve a Lighthouse performance score above 90
6. THE Frontend_App SHALL implement skeleton loaders for async content
7. THE Frontend_App SHALL debounce search inputs with 300ms delay
8. THE Frontend_App SHALL implement virtual scrolling for long lists (trips, bookings)
9. THE Frontend_App SHALL minimize bundle size by tree-shaking unused code and analyzing bundle composition

### Requirement 18: Accessibility (a11y)

**User Story:** As a user with disabilities, I want the app to be accessible, so that I can use all features with assistive technologies.

#### Acceptance Criteria

1. THE Frontend_App SHALL use semantic HTML elements (nav, main, article, section)
2. THE Frontend_App SHALL provide alt text for all images
3. THE Frontend_App SHALL implement keyboard navigation for all interactive elements
4. THE Frontend_App SHALL maintain visible focus indicators for keyboard navigation
5. THE Frontend_App SHALL use ARIA labels and roles where semantic HTML is insufficient
6. THE Frontend_App SHALL ensure color contrast ratios meet WCAG AA standards (4.5:1 for normal text)
7. THE Frontend_App SHALL support screen readers with proper heading hierarchy and landmarks
8. THE Frontend_App SHALL provide skip-to-content links for keyboard users
9. THE Frontend_App SHALL announce dynamic content changes to screen readers using ARIA live regions


### Requirement 19: Notification System

**User Story:** As a user, I want to receive notifications about booking confirmations, trip reminders, and special offers, so that I stay informed about my travel plans.

#### Acceptance Criteria

1. THE Frontend_App SHALL request push notification permission from the browser
2. WHEN push notification permission is granted, THE Frontend_App SHALL register a service worker for push notifications
3. THE Frontend_App SHALL send the push notification token to the Backend_API for storage
4. WHEN a push notification is received, THE Service_Worker SHALL display it with title, body, and icon
5. WHEN a user clicks a push notification, THE Frontend_App SHALL open and navigate to the relevant page
6. THE Frontend_App SHALL display in-app notifications for real-time updates (booking confirmations, payment status)
7. THE Frontend_App SHALL implement a notification center showing recent notifications
8. THE Frontend_App SHALL allow users to mark notifications as read
9. THE Frontend_App SHALL respect user notification preferences set in the Profile screen

### Requirement 20: Search Functionality

**User Story:** As a user, I want to search for trips, places, and festivals, so that I can quickly find what I'm looking for.

#### Acceptance Criteria

1. THE Frontend_App SHALL display a search bar in the navigation header
2. WHEN a user types in the search bar, THE Frontend_App SHALL debounce input and call the Backend_API search endpoint
3. THE Frontend_App SHALL display search results grouped by type (trips, places, festivals, hotels)
4. WHEN a user clicks a search result, THE Frontend_App SHALL navigate to the detail page
5. THE Frontend_App SHALL highlight matching text in search results
6. THE Frontend_App SHALL display recent searches and allow users to clear search history
7. THE Frontend_App SHALL implement autocomplete suggestions based on popular searches
8. THE Frontend_App SHALL display "no results" message with suggestions when search returns empty
9. THE Frontend_App SHALL persist search history in local storage


### Requirement 21: Reviews and Ratings

**User Story:** As a user, I want to read and write reviews for trips, hotels, and guides, so that I can make informed decisions and share my experiences.

#### Acceptance Criteria

1. THE Frontend_App SHALL display average ratings and review counts for trips, hotels, and guides
2. THE Frontend_App SHALL fetch and display reviews from the Backend_API with pagination
3. WHEN a user has completed a booking, THE Frontend_App SHALL allow them to submit a review with rating (1-5 stars) and text
4. THE Frontend_App SHALL validate that review text is between 10 and 1000 characters
5. THE Frontend_App SHALL allow users to upload photos with their reviews (maximum 5 photos)
6. THE Frontend_App SHALL display reviews sorted by most recent or highest rated
7. THE Frontend_App SHALL allow users to filter reviews by rating
8. THE Frontend_App SHALL display verified booking badges for reviews from confirmed bookings
9. THE Frontend_App SHALL allow users to edit or delete their own reviews

### Requirement 22: Favorites and Wishlists

**User Story:** As a user, I want to save trips and places to my favorites, so that I can easily find them later.

#### Acceptance Criteria

1. THE Frontend_App SHALL display a heart icon on trip and place cards for adding to favorites
2. WHEN a user clicks the heart icon, THE Frontend_App SHALL toggle the favorite status via the Backend_API
3. THE Frontend_App SHALL display a Favorites section in the Profile screen
4. THE Frontend_App SHALL fetch and display all favorited items from the Backend_API
5. THE Frontend_App SHALL allow users to remove items from favorites
6. THE Frontend_App SHALL sync favorites across devices for authenticated users
7. THE Frontend_App SHALL display a count of favorited items in the navigation
8. WHEN a user is not authenticated, THE Frontend_App SHALL store favorites in local storage
9. WHEN a user logs in, THE Frontend_App SHALL sync local favorites with the Backend_API


### Requirement 23: Analytics and Tracking

**User Story:** As a product owner, I want to track user behavior and conversions, so that I can optimize the user experience and business outcomes.

#### Acceptance Criteria

1. THE Frontend_App SHALL integrate Google Analytics or a similar analytics service
2. THE Frontend_App SHALL track page views for all routes
3. THE Frontend_App SHALL track custom events for key actions (search, booking initiation, payment completion)
4. THE Frontend_App SHALL track conversion funnels for the booking flow
5. THE Frontend_App SHALL track AI chat interactions (messages sent, recommendations clicked)
6. THE Frontend_App SHALL respect user privacy preferences and GDPR requirements
7. THE Frontend_App SHALL implement cookie consent banner for analytics tracking
8. THE Frontend_App SHALL anonymize user data before sending to analytics services
9. THE Frontend_App SHALL track performance metrics (page load time, API response time)

### Requirement 24: Security Best Practices

**User Story:** As a security-conscious user, I want my data to be protected, so that I can use the app safely.

#### Acceptance Criteria

1. THE Frontend_App SHALL use HTTPS for all network requests
2. THE Frontend_App SHALL store Auth_Token and Refresh_Token in httpOnly cookies to prevent XSS attacks
3. THE Frontend_App SHALL implement Content Security Policy (CSP) headers
4. THE Frontend_App SHALL sanitize user input to prevent XSS attacks
5. THE Frontend_App SHALL validate all data received from the Backend_API
6. THE Frontend_App SHALL implement rate limiting for API requests on the client side
7. THE Frontend_App SHALL not log sensitive information (tokens, passwords) to the console in production
8. THE Frontend_App SHALL implement CSRF protection for state-changing requests
9. THE Frontend_App SHALL use Subresource Integrity (SRI) for third-party scripts


### Requirement 25: Testing Infrastructure

**User Story:** As a developer, I want comprehensive testing, so that I can ensure code quality and prevent regressions.

#### Acceptance Criteria

1. THE Frontend_App SHALL use Vitest or Jest for unit testing
2. THE Frontend_App SHALL use React Testing Library for component testing
3. THE Frontend_App SHALL use Playwright or Cypress for end-to-end testing
4. THE Frontend_App SHALL achieve minimum 80% code coverage for critical paths
5. THE Frontend_App SHALL test authentication flows including login, registration, and token refresh
6. THE Frontend_App SHALL test booking flows from selection to payment confirmation
7. THE Frontend_App SHALL test AI chat WebSocket connection and message handling
8. THE Frontend_App SHALL test offline functionality and Service_Worker behavior
9. THE Frontend_App SHALL run tests in CI/CD pipeline before deployment

### Requirement 26: Development and Build Configuration

**User Story:** As a developer, I want a well-configured development environment, so that I can develop efficiently and deploy reliably.

#### Acceptance Criteria

1. THE Frontend_App SHALL use environment variables for configuration (API URLs, keys)
2. THE Frontend_App SHALL provide separate configurations for development, staging, and production
3. THE Frontend_App SHALL use ESLint for code linting with TypeScript rules
4. THE Frontend_App SHALL use Prettier for code formatting with consistent configuration
5. THE Frontend_App SHALL implement pre-commit hooks with Husky and lint-staged
6. THE Frontend_App SHALL generate source maps for debugging in development
7. THE Frontend_App SHALL minify and optimize code for production builds
8. THE Frontend_App SHALL implement bundle analysis to monitor bundle size
9. THE Frontend_App SHALL document setup instructions in README.md


### Requirement 27: Responsive Design System

**User Story:** As a designer, I want a consistent design system, so that the UI is cohesive and maintainable across all screens.

#### Acceptance Criteria

1. THE Frontend_App SHALL define a design system with color palette, typography, spacing, and breakpoints
2. THE Frontend_App SHALL use Tailwind CSS with custom theme configuration
3. THE Frontend_App SHALL implement reusable UI components (Button, Input, Card, Modal, Drawer)
4. THE Frontend_App SHALL ensure all components are responsive across mobile (320px+), tablet (768px+), and desktop (1024px+)
5. THE Frontend_App SHALL use a mobile-first approach for responsive design
6. THE Frontend_App SHALL implement dark mode support with theme toggle
7. THE Frontend_App SHALL persist theme preference in local storage
8. THE Frontend_App SHALL use CSS variables for dynamic theming
9. THE Frontend_App SHALL document all design tokens and components in Storybook or similar tool

### Requirement 28: WebSocket Connection Management

**User Story:** As a developer, I want robust WebSocket connection handling, so that the AI chat remains stable and reliable.

#### Acceptance Criteria

1. THE Frontend_App SHALL establish a WebSocket_Connection to the AI_Agent service when the chat is opened
2. THE Frontend_App SHALL implement connection retry logic with exponential backoff (1s, 2s, 4s, 8s, max 30s)
3. WHEN the WebSocket_Connection is closed unexpectedly, THE Frontend_App SHALL attempt to reconnect automatically
4. THE Frontend_App SHALL implement heartbeat/ping messages to detect connection health
5. WHEN a heartbeat fails, THE Frontend_App SHALL close and reconnect the WebSocket_Connection
6. THE Frontend_App SHALL queue messages sent while disconnected and send them after reconnection
7. THE Frontend_App SHALL display connection status (connected, connecting, disconnected) in the chat UI
8. THE Frontend_App SHALL close the WebSocket_Connection when the chat is closed or the user navigates away
9. THE Frontend_App SHALL handle WebSocket errors gracefully and display user-friendly error messages


### Requirement 29: Image Upload and Optimization

**User Story:** As a user, I want to upload images for reviews and profile pictures, so that I can personalize my content.

#### Acceptance Criteria

1. THE Frontend_App SHALL allow users to upload images via file input or drag-and-drop
2. THE Frontend_App SHALL validate image file types (JPEG, PNG, WebP) and size (maximum 5MB)
3. THE Frontend_App SHALL compress images on the client side before uploading to reduce bandwidth
4. THE Frontend_App SHALL display image preview before upload
5. THE Frontend_App SHALL show upload progress with percentage indicator
6. WHEN an image upload fails, THE Frontend_App SHALL display an error message and allow retry
7. THE Frontend_App SHALL crop and resize profile pictures to square format (400x400px)
8. THE Frontend_App SHALL support multiple image uploads for reviews (maximum 5 images)
9. THE Frontend_App SHALL use Next.js Image component for displaying uploaded images with optimization

### Requirement 30: Date and Time Handling

**User Story:** As a user, I want dates and times to be displayed in my local timezone, so that I can understand booking schedules correctly.

#### Acceptance Criteria

1. THE Frontend_App SHALL use date-fns or dayjs for date manipulation and formatting
2. THE Frontend_App SHALL display all dates and times in the user's local timezone
3. THE Frontend_App SHALL format dates according to the selected locale (EN, KH, ZH)
4. THE Frontend_App SHALL implement a date picker component for booking date selection
5. THE Frontend_App SHALL validate that selected dates are in the future for new bookings
6. THE Frontend_App SHALL display relative time for recent activities (e.g., "2 hours ago")
7. THE Frontend_App SHALL handle timezone conversions when communicating with the Backend_API
8. THE Frontend_App SHALL display booking times with timezone indicators (e.g., "10:00 AM ICT")
9. THE Frontend_App SHALL implement date range selection for multi-day bookings


### Requirement 31: Loading States and Skeletons

**User Story:** As a user, I want to see loading indicators, so that I know the app is working and not frozen.

#### Acceptance Criteria

1. THE Frontend_App SHALL display skeleton loaders for content that is being fetched
2. THE Frontend_App SHALL use skeleton loaders that match the shape of the actual content
3. THE Frontend_App SHALL display spinner indicators for button actions (submit, save)
4. THE Frontend_App SHALL disable buttons while actions are in progress to prevent double-submission
5. THE Frontend_App SHALL display progress bars for file uploads and long-running operations
6. THE Frontend_App SHALL implement suspense boundaries for lazy-loaded components
7. THE Frontend_App SHALL display loading states for route transitions
8. THE Frontend_App SHALL implement optimistic UI updates for mutations with rollback on error
9. THE Frontend_App SHALL display shimmer animation on skeleton loaders for better perceived performance

### Requirement 32: Error Recovery and Retry

**User Story:** As a user, I want to recover from errors easily, so that I can complete my tasks without frustration.

#### Acceptance Criteria

1. WHEN a network request fails, THE Frontend_App SHALL display an error message with a retry button
2. THE Frontend_App SHALL implement automatic retry with exponential backoff for transient errors
3. WHEN the Backend_API returns a 5xx error, THE Frontend_App SHALL retry the request up to 3 times
4. WHEN the Backend_API returns a 4xx error, THE Frontend_App SHALL display the error message without retry
5. THE Frontend_App SHALL implement error boundaries that catch React errors and display fallback UI
6. THE Frontend_App SHALL provide a "Go Back" or "Go Home" button in error states
7. THE Frontend_App SHALL log errors to a monitoring service for debugging
8. WHEN a payment fails, THE Frontend_App SHALL allow the user to retry with the same or different payment method
9. THE Frontend_App SHALL preserve form data when errors occur so users don't lose their input


### Requirement 33: Social Sharing

**User Story:** As a user, I want to share trips and places with friends, so that I can plan trips together.

#### Acceptance Criteria

1. THE Frontend_App SHALL display share buttons on trip and place detail pages
2. THE Frontend_App SHALL implement Web Share API for native sharing on supported devices
3. THE Frontend_App SHALL provide fallback sharing options (copy link, email, WhatsApp, Facebook) when Web Share API is not available
4. WHEN a user clicks share, THE Frontend_App SHALL generate a shareable URL with Open Graph metadata
5. THE Frontend_App SHALL implement Open Graph meta tags for rich previews on social media
6. THE Frontend_App SHALL display a success message when a link is copied to clipboard
7. THE Frontend_App SHALL track share events in analytics
8. THE Frontend_App SHALL allow users to share their booking confirmations
9. THE Frontend_App SHALL generate QR codes for sharing trip details offline

### Requirement 34: Loyalty Points Display

**User Story:** As a user, I want to see how many loyalty points I'll earn, so that I can maximize my rewards.

#### Acceptance Criteria

1. THE Frontend_App SHALL display Loyalty_Points balance prominently in the Profile screen
2. THE Frontend_App SHALL display points earned for each completed booking in the booking history
3. WHEN viewing a trip or hotel, THE Frontend_App SHALL display the points that will be earned from booking
4. THE Frontend_App SHALL fetch points history from the Backend_API with pagination
5. THE Frontend_App SHALL display points expiration dates if applicable
6. THE Frontend_App SHALL display points redemption options and conversion rates
7. THE Frontend_App SHALL allow users to apply points as discount during checkout
8. THE Frontend_App SHALL display a progress bar showing points needed for next reward tier
9. THE Frontend_App SHALL send notifications when users earn points or reach new tiers


### Requirement 35: Student Discount Verification

**User Story:** As a student, I want to verify my student status and receive discounts, so that I can save money on bookings.

#### Acceptance Criteria

1. THE Frontend_App SHALL display a Student_Discount section in the Profile screen
2. THE Frontend_App SHALL allow users to upload student ID or verification documents
3. THE Frontend_App SHALL validate document file types (PDF, JPEG, PNG) and size (maximum 10MB)
4. WHEN a user uploads verification documents, THE Frontend_App SHALL send them to the Backend_API for review
5. THE Frontend_App SHALL display verification status (pending, approved, rejected)
6. WHEN Student_Discount is approved, THE Frontend_App SHALL display a badge in the profile
7. WHEN viewing trips or hotels, THE Frontend_App SHALL display discounted prices for verified students
8. THE Frontend_App SHALL automatically apply Student_Discount during checkout for verified students
9. THE Frontend_App SHALL display discount amount and savings in the booking summary

### Requirement 36: Trip Detail Page

**User Story:** As a user, I want to see comprehensive trip information, so that I can make informed booking decisions.

#### Acceptance Criteria

1. THE Frontend_App SHALL display trip details including title, description, duration, price, and images
2. THE Frontend_App SHALL display a detailed itinerary with day-by-day activities
3. THE Frontend_App SHALL display included and excluded items (meals, transportation, accommodation)
4. THE Frontend_App SHALL display meeting point and pickup information
5. THE Frontend_App SHALL display cancellation policy and refund terms
6. THE Frontend_App SHALL fetch and display reviews and ratings for the trip
7. THE Frontend_App SHALL display available dates with a calendar picker
8. THE Frontend_App SHALL display a "Book Now" button that navigates to the booking flow
9. THE Frontend_App SHALL display similar or recommended trips at the bottom of the page
10. THE Frontend_App SHALL display a photo gallery with lightbox for viewing full-size images


### Requirement 37: Hotel and Transportation Booking

**User Story:** As a user, I want to book hotels and transportation separately, so that I can customize my travel arrangements.

#### Acceptance Criteria

1. THE Frontend_App SHALL display hotel listings with images, prices, ratings, and amenities
2. THE Frontend_App SHALL allow users to filter hotels by price range, rating, and amenities
3. THE Frontend_App SHALL display hotel details including room types, check-in/check-out times, and policies
4. THE Frontend_App SHALL display transportation options (bus, van, private car) with schedules and prices
5. THE Frontend_App SHALL allow users to select departure and arrival locations for transportation
6. THE Frontend_App SHALL display available seats or capacity for transportation options
7. THE Frontend_App SHALL implement a booking flow for hotels with date selection and room selection
8. THE Frontend_App SHALL implement a booking flow for transportation with date and time selection
9. THE Frontend_App SHALL display combined pricing when booking hotel and transportation together

### Requirement 38: Guide Booking

**User Story:** As a user, I want to book local guides, so that I can have personalized tours and local expertise.

#### Acceptance Criteria

1. THE Frontend_App SHALL display guide profiles with photos, languages spoken, specialties, and ratings
2. THE Frontend_App SHALL allow users to filter guides by language, specialty, and availability
3. THE Frontend_App SHALL display guide details including experience, certifications, and reviews
4. THE Frontend_App SHALL display guide availability calendar
5. THE Frontend_App SHALL allow users to select tour duration (half-day, full-day, multi-day)
6. THE Frontend_App SHALL display pricing based on tour duration and group size
7. THE Frontend_App SHALL allow users to send messages to guides before booking
8. THE Frontend_App SHALL implement a booking flow for guides with date, time, and group size selection
9. THE Frontend_App SHALL display guide contact information after booking confirmation


### Requirement 39: Booking Confirmation and Receipt

**User Story:** As a user, I want to receive booking confirmations and receipts, so that I have proof of my reservations.

#### Acceptance Criteria

1. WHEN a booking is confirmed, THE Frontend_App SHALL display a confirmation page with booking details
2. THE Frontend_App SHALL display a booking reference number and QR code
3. THE Frontend_App SHALL send a confirmation email via the Backend_API
4. THE Frontend_App SHALL allow users to download the booking confirmation as PDF
5. THE Frontend_App SHALL display payment receipt with itemized costs and payment method
6. THE Frontend_App SHALL allow users to download the payment receipt as PDF
7. THE Frontend_App SHALL display contact information for support and changes
8. THE Frontend_App SHALL allow users to add the booking to their calendar (iCal format)
9. THE Frontend_App SHALL display next steps and preparation instructions for the trip

### Requirement 40: Cancellation and Refund Flow

**User Story:** As a user, I want to cancel bookings and request refunds, so that I can manage changes to my travel plans.

#### Acceptance Criteria

1. THE Frontend_App SHALL display a "Cancel Booking" button on booking detail pages for cancellable bookings
2. WHEN a user clicks cancel, THE Frontend_App SHALL display the cancellation policy and refund amount
3. THE Frontend_App SHALL require users to confirm cancellation with a reason selection
4. WHEN a user confirms cancellation, THE Frontend_App SHALL call the Backend_API cancellation endpoint
5. THE Frontend_App SHALL display cancellation confirmation with refund timeline
6. THE Frontend_App SHALL update the booking status to "cancelled" in the My Trip screen
7. THE Frontend_App SHALL display refund status (pending, processed, completed)
8. THE Frontend_App SHALL send cancellation confirmation email via the Backend_API
9. THE Frontend_App SHALL prevent cancellation if the booking is within the no-cancellation period


### Requirement 41: Festival Calendar and Details

**User Story:** As a user, I want to see festival schedules and details, so that I can plan my trip around cultural events.

#### Acceptance Criteria

1. THE Frontend_App SHALL display a festival calendar view with monthly and list views
2. THE Frontend_App SHALL display festival markers on the calendar with color coding by type
3. WHEN a user clicks a festival, THE Frontend_App SHALL display festival details including date, location, description, and activities
4. THE Frontend_App SHALL display related trips and accommodations for each festival
5. THE Frontend_App SHALL allow users to filter festivals by type (religious, cultural, music, food)
6. THE Frontend_App SHALL allow users to add festivals to their favorites
7. THE Frontend_App SHALL display countdown timers for upcoming festivals
8. THE Frontend_App SHALL send reminders for favorited festivals via notifications
9. THE Frontend_App SHALL display festival photos and videos in a gallery

### Requirement 42: Contact and Support

**User Story:** As a user, I want to contact support, so that I can get help with issues or questions.

#### Acceptance Criteria

1. THE Frontend_App SHALL display a "Contact Us" link in the navigation footer
2. THE Frontend_App SHALL provide a contact form with fields for name, email, subject, and message
3. WHEN a user submits the contact form, THE Frontend_App SHALL send the message to the Backend_API
4. THE Frontend_App SHALL display a success message after form submission
5. THE Frontend_App SHALL display support email and phone number
6. THE Frontend_App SHALL display FAQ section with common questions and answers
7. THE Frontend_App SHALL implement a live chat widget for real-time support
8. THE Frontend_App SHALL display business hours for support availability
9. THE Frontend_App SHALL allow users to attach files to support messages (maximum 5MB)


### Requirement 43: SEO Optimization

**User Story:** As a marketing manager, I want the app to be search engine optimized, so that we can attract organic traffic.

#### Acceptance Criteria

1. THE Frontend_App SHALL implement dynamic meta tags for title, description, and keywords on all pages
2. THE Frontend_App SHALL generate structured data (JSON-LD) for trips, hotels, and reviews
3. THE Frontend_App SHALL implement canonical URLs to prevent duplicate content issues
4. THE Frontend_App SHALL generate a sitemap.xml file with all public pages
5. THE Frontend_App SHALL generate a robots.txt file with crawling instructions
6. THE Frontend_App SHALL implement Open Graph tags for social media sharing
7. THE Frontend_App SHALL implement Twitter Card tags for Twitter sharing
8. THE Frontend_App SHALL ensure all pages have proper heading hierarchy (h1, h2, h3)
9. THE Frontend_App SHALL implement server-side rendering for critical pages to improve SEO

### Requirement 44: Currency and Pricing Display

**User Story:** As a user, I want to see prices in my preferred currency, so that I can understand costs in familiar terms.

#### Acceptance Criteria

1. THE Frontend_App SHALL display prices in USD as the default currency
2. THE Frontend_App SHALL allow users to select their preferred currency from a list
3. WHEN a user changes currency, THE Frontend_App SHALL fetch exchange rates from the Backend_API
4. THE Frontend_App SHALL convert and display all prices in the selected currency
5. THE Frontend_App SHALL format currency according to locale conventions
6. THE Frontend_App SHALL persist currency preference in local storage
7. THE Frontend_App SHALL display a currency disclaimer for converted prices
8. THE Frontend_App SHALL update currency conversion rates daily
9. THE Frontend_App SHALL display the original currency and converted currency for transparency


### Requirement 45: Admin Dashboard Access

**User Story:** As an admin user, I want to access admin features, so that I can manage content and bookings.

#### Acceptance Criteria

1. WHEN a user with admin role logs in, THE Frontend_App SHALL display an "Admin" link in the navigation
2. THE Frontend_App SHALL protect admin routes by checking user role before rendering
3. THE Frontend_App SHALL display an admin dashboard with key metrics (bookings, revenue, users)
4. THE Frontend_App SHALL allow admins to view and manage all bookings
5. THE Frontend_App SHALL allow admins to view and respond to support messages
6. THE Frontend_App SHALL allow admins to view and moderate reviews
7. THE Frontend_App SHALL allow admins to manage emergency alerts
8. THE Frontend_App SHALL display analytics charts for booking trends and revenue
9. WHEN a non-admin user attempts to access admin routes, THE Frontend_App SHALL redirect to the home page

### Requirement 46: Deployment and Environment Configuration

**User Story:** As a DevOps engineer, I want proper deployment configuration, so that I can deploy the app reliably to production.

#### Acceptance Criteria

1. THE Frontend_App SHALL use environment variables for all configuration (API URLs, keys, feature flags)
2. THE Frontend_App SHALL provide .env.example file with all required variables documented
3. THE Frontend_App SHALL validate required environment variables at build time
4. THE Frontend_App SHALL support deployment to Vercel, Netlify, or similar platforms
5. THE Frontend_App SHALL implement health check endpoint for monitoring
6. THE Frontend_App SHALL configure CORS headers for API requests
7. THE Frontend_App SHALL implement rate limiting headers for API requests
8. THE Frontend_App SHALL configure caching headers for static assets
9. THE Frontend_App SHALL document deployment steps in README.md


### Requirement 47: Component Library and Reusability

**User Story:** As a developer, I want a comprehensive component library, so that I can build features consistently and efficiently.

#### Acceptance Criteria

1. THE Frontend_App SHALL implement reusable Button component with variants (primary, secondary, outline, ghost)
2. THE Frontend_App SHALL implement reusable Input component with validation states and icons
3. THE Frontend_App SHALL implement reusable Card component for displaying content blocks
4. THE Frontend_App SHALL implement reusable Modal component with customizable content and actions
5. THE Frontend_App SHALL implement reusable Drawer component for side panels
6. THE Frontend_App SHALL implement reusable Toast component for notifications
7. THE Frontend_App SHALL implement reusable Tabs component for tabbed interfaces
8. THE Frontend_App SHALL implement reusable Dropdown component for select inputs
9. THE Frontend_App SHALL implement reusable Badge component for status indicators
10. THE Frontend_App SHALL implement reusable Avatar component for user profiles
11. THE Frontend_App SHALL document all components with props, examples, and usage guidelines

### Requirement 48: Data Persistence and Sync

**User Story:** As a user, I want my data to be saved and synced, so that I don't lose my progress or preferences.

#### Acceptance Criteria

1. THE Frontend_App SHALL persist authentication tokens in httpOnly cookies
2. THE Frontend_App SHALL persist user preferences (language, theme, currency) in local storage
3. THE Frontend_App SHALL persist chat history in local storage with size limits
4. THE Frontend_App SHALL persist favorites in local storage for unauthenticated users
5. WHEN a user logs in, THE Frontend_App SHALL sync local storage data with the Backend_API
6. THE Frontend_App SHALL implement background sync for offline actions when connection is restored
7. THE Frontend_App SHALL clear sensitive data from local storage on logout
8. THE Frontend_App SHALL implement data migration for local storage schema changes
9. THE Frontend_App SHALL respect browser storage limits and handle quota exceeded errors


### Requirement 49: Monitoring and Error Tracking

**User Story:** As a developer, I want to monitor app performance and track errors, so that I can identify and fix issues quickly.

#### Acceptance Criteria

1. THE Frontend_App SHALL integrate Sentry or similar error tracking service
2. THE Frontend_App SHALL capture and report JavaScript errors with stack traces
3. THE Frontend_App SHALL capture and report unhandled promise rejections
4. THE Frontend_App SHALL capture and report API errors with request/response details
5. THE Frontend_App SHALL include user context (ID, email) with error reports for authenticated users
6. THE Frontend_App SHALL implement performance monitoring for page load times
7. THE Frontend_App SHALL track Core Web Vitals (LCP, FID, CLS)
8. THE Frontend_App SHALL implement custom performance marks for critical user flows
9. THE Frontend_App SHALL respect user privacy and exclude sensitive data from error reports

### Requirement 50: Legal and Compliance

**User Story:** As a legal compliance officer, I want proper legal pages and consent mechanisms, so that we comply with regulations.

#### Acceptance Criteria

1. THE Frontend_App SHALL display Terms of Service page with current terms
2. THE Frontend_App SHALL display Privacy Policy page with data handling practices
3. THE Frontend_App SHALL display Cookie Policy page with cookie usage information
4. THE Frontend_App SHALL implement cookie consent banner with accept/reject options
5. THE Frontend_App SHALL respect user cookie preferences and disable non-essential cookies when rejected
6. THE Frontend_App SHALL display GDPR data request form for EU users
7. THE Frontend_App SHALL allow users to download their personal data
8. THE Frontend_App SHALL allow users to request account deletion
9. THE Frontend_App SHALL display age verification for users under 18

