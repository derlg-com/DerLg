TOOL_SCHEMAS: list[dict] = [
    {
        "name": "getTripSuggestions",
        "description": "Search for Cambodia trip packages matching traveler preferences. Call this after gathering the user's intent. Pass a natural language query summarizing their request.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Natural language search intent, e.g. '3-day temple tour in Siem Reap under $300 for 2 people'"},
                "locale": {"type": "string", "enum": ["en", "zh", "km"], "description": "Response language"},
                "user_id": {"type": "string", "description": "User UUID"},
                "max_results": {"type": "integer", "default": 3, "maximum": 5},
            },
            "required": ["query", "locale"],
        },
    },
    {
        "name": "getTripItinerary",
        "description": "Get the day-by-day itinerary for a specific trip package.",
        "input_schema": {
            "type": "object",
            "properties": {"trip_id": {"type": "string"}},
            "required": ["trip_id"],
        },
    },
    {
        "name": "getTripImages",
        "description": "Get photo gallery images for a specific trip.",
        "input_schema": {
            "type": "object",
            "properties": {"trip_id": {"type": "string"}},
            "required": ["trip_id"],
        },
    },
    {
        "name": "getHotelDetails",
        "description": "Get detailed hotel information including amenities, room types, and pricing.",
        "input_schema": {
            "type": "object",
            "properties": {"hotel_id": {"type": "string"}},
            "required": ["hotel_id"],
        },
    },
    {
        "name": "getWeatherForecast",
        "description": "Get 5-day weather forecast for a Cambodia destination.",
        "input_schema": {
            "type": "object",
            "properties": {
                "destination": {"type": "string"},
                "date": {"type": "string", "description": "Start date in YYYY-MM-DD format"},
            },
            "required": ["destination", "date"],
        },
    },
    {
        "name": "compareTrips",
        "description": "Compare up to 3 trips side-by-side on price, duration, highlights, and inclusions.",
        "input_schema": {
            "type": "object",
            "properties": {
                "trip_ids": {"type": "array", "items": {"type": "string"}, "maxItems": 3},
            },
            "required": ["trip_ids"],
        },
    },
    {
        "name": "calculateCustomTrip",
        "description": "Calculate the price impact of customizations on a base trip before applying them.",
        "input_schema": {
            "type": "object",
            "properties": {
                "base_trip_id": {"type": "string"},
                "customizations": {"type": "array", "items": {"type": "object"}},
            },
            "required": ["base_trip_id", "customizations"],
        },
    },
    {
        "name": "customizeTrip",
        "description": "Apply confirmed customizations to a trip package.",
        "input_schema": {
            "type": "object",
            "properties": {
                "trip_id": {"type": "string"},
                "customizations": {"type": "array", "items": {"type": "object"}},
            },
            "required": ["trip_id", "customizations"],
        },
    },
    {
        "name": "applyDiscountCode",
        "description": "Apply a discount code to an existing booking.",
        "input_schema": {
            "type": "object",
            "properties": {
                "code": {"type": "string"},
                "booking_id": {"type": "string"},
            },
            "required": ["code", "booking_id"],
        },
    },
    {
        "name": "validateUserDetails",
        "description": "Validate traveler name, phone number, and email before creating a booking.",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "phone": {"type": "string"},
                "email": {"type": "string"},
            },
            "required": ["name", "phone", "email"],
        },
    },
    {
        "name": "createBooking",
        "description": "Create a booking with HOLD status after explicit user confirmation. Items can include TRIP, HOTEL, TRANSPORT, GUIDE.",
        "input_schema": {
            "type": "object",
            "properties": {
                "user_id": {"type": "string", "description": "User UUID"},
                "items": {
                    "type": "array",
                    "description": "Booking line items (trip, hotel, transport, guide)",
                    "items": {
                        "type": "object",
                        "properties": {
                            "item_type": {"type": "string", "enum": ["TRIP", "HOTEL", "TRANSPORT", "GUIDE"]},
                            "item_id": {"type": "string"},
                            "quantity": {"type": "integer"},
                            "metadata": {"type": "object"},
                        },
                        "required": ["item_type", "item_id", "quantity"],
                    },
                },
                "currency": {"type": "string", "default": "USD"},
            },
            "required": ["user_id", "items"],
        },
    },
    {
        "name": "generatePaymentQR",
        "description": "Generate a Bakong/ABA QR payment code for a booking. Call after createBooking succeeds.",
        "input_schema": {
            "type": "object",
            "properties": {
                "booking_id": {"type": "string"},
                "provider": {"type": "string", "enum": ["BAKONG", "ABA"], "description": "Payment provider"},
            },
            "required": ["booking_id", "provider"],
        },
    },
    {
        "name": "checkPaymentStatus",
        "description": "Check the current status of a payment intent.",
        "input_schema": {
            "type": "object",
            "properties": {"payment_intent_id": {"type": "string"}},
            "required": ["payment_intent_id"],
        },
    },
    {
        "name": "cancelBooking",
        "description": "Cancel an existing booking.",
        "input_schema": {
            "type": "object",
            "properties": {"booking_id": {"type": "string"}},
            "required": ["booking_id"],
        },
    },
    {
        "name": "modifyBooking",
        "description": "Modify details of an existing booking.",
        "input_schema": {
            "type": "object",
            "properties": {
                "booking_id": {"type": "string"},
                "modifications": {"type": "object"},
            },
            "required": ["booking_id", "modifications"],
        },
    },
    {
        "name": "getPlaces",
        "description": "Get Cambodia places of interest filtered by category and region.",
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {"type": "string", "description": "temple, beach, market, museum, etc."},
                "region": {"type": "string"},
                "language": {"type": "string", "enum": ["EN", "KH", "ZH"]},
            },
            "required": ["category"],
        },
    },
    {
        "name": "getUpcomingFestivals",
        "description": "Get upcoming Cambodian festivals and events within a date range.",
        "input_schema": {
            "type": "object",
            "properties": {
                "start_date": {"type": "string", "description": "YYYY-MM-DD"},
                "end_date": {"type": "string", "description": "YYYY-MM-DD"},
                "language": {"type": "string", "enum": ["EN", "KH", "ZH"]},
            },
            "required": ["start_date", "end_date"],
        },
    },
    {
        "name": "estimateBudget",
        "description": "Estimate total trip cost breakdown including accommodation, transport, food, and activities.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Budget request, e.g. '3 days in Siem Reap, mid-range'"},
                "locale": {"type": "string", "enum": ["en", "zh", "km"]},
                "currency": {"type": "string", "default": "USD"},
            },
            "required": ["query", "locale"],
        },
    },
    {
        "name": "getCurrencyRates",
        "description": "Get current exchange rates between currencies (USD, KHR, CNY, etc.).",
        "input_schema": {
            "type": "object",
            "properties": {
                "from_currency": {"type": "string"},
                "to_currency": {"type": "string"},
            },
            "required": ["from_currency", "to_currency"],
        },
    },
    {
        "name": "getTransportOptions",
        "description": "Get available transport options between two Cambodia locations.",
        "input_schema": {
            "type": "object",
            "properties": {
                "from_location": {"type": "string"},
                "to_location": {"type": "string"},
                "date": {"type": "string", "description": "YYYY-MM-DD"},
            },
            "required": ["from_location", "to_location"],
        },
    },
]
