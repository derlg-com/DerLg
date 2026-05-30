"""
Tool schemas aligned with backend DTOs in ai-tools.dto.ts.
"""

ALL_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_trips",
            "description": "Search Cambodia trip packages. Call after gathering destination, duration, people count, and budget.",
            "parameters": {
                "type": "object",
                "properties": {
                    "destination": {"type": "string", "description": "City or region, e.g. 'Siem Reap'"},
                    "duration_days": {"type": "integer", "description": "Trip length in days"},
                    "people_count": {"type": "integer", "description": "Number of travelers"},
                    "budget_usd": {"type": "number", "description": "Max budget per person in USD"},
                },
                "required": ["destination", "duration_days", "people_count", "budget_usd"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_hotels",
            "description": "Search hotels by city, check-in/out dates, and optional price range.",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string"},
                    "check_in": {"type": "string", "description": "YYYY-MM-DD"},
                    "check_out": {"type": "string", "description": "YYYY-MM-DD"},
                    "price_range": {"type": "number", "description": "Max price per night in USD"},
                },
                "required": ["city", "check_in", "check_out"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_guides",
            "description": "Find available tour guides by location, spoken language, and date.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string"},
                    "language": {"type": "string", "description": "Guide's spoken language, e.g. 'en', 'zh'"},
                    "date": {"type": "string", "description": "YYYY-MM-DD"},
                },
                "required": ["location", "language", "date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_transport",
            "description": "Search ground transport options between two locations.",
            "parameters": {
                "type": "object",
                "properties": {
                    "from_location": {"type": "string"},
                    "to_location": {"type": "string"},
                    "departure_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "people_count": {"type": "integer"},
                    "mode": {
                        "type": "string",
                        "enum": ["van", "bus", "tuk_tuk", "taxi", "shuttle", "minivan"],
                    },
                },
                "required": ["from_location", "to_location", "departure_date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_availability",
            "description": "Check availability for a trip, hotel, guide, or transport on a date.",
            "parameters": {
                "type": "object",
                "properties": {
                    "item_type": {"type": "string", "enum": ["trip", "hotel", "guide", "transport"]},
                    "item_id": {"type": "string"},
                    "date": {"type": "string", "description": "YYYY-MM-DD"},
                },
                "required": ["item_type", "item_id", "date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_booking_hold",
            "description": "Create a 15-minute booking hold. Only call after explicit user confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "string"},
                    "item_type": {"type": "string", "enum": ["trip", "hotel", "guide", "transport"]},
                    "item_id": {"type": "string"},
                    "travel_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "people_count": {"type": "integer"},
                },
                "required": ["user_id", "item_type", "item_id", "travel_date", "people_count"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_payment_status",
            "description": "Check payment status for a booking.",
            "parameters": {
                "type": "object",
                "properties": {
                    "booking_id": {"type": "string"},
                },
                "required": ["booking_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "estimate_budget",
            "description": "Estimate trip budget from a natural-language brief.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "e.g. '3 days Siem Reap mid-range for 2 people'"},
                    "locale": {"type": "string", "enum": ["en", "zh", "km"]},
                    "currency": {"type": "string", "default": "USD"},
                    "duration_days": {"type": "integer"},
                    "people_count": {"type": "integer"},
                },
                "required": ["query", "locale"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get weather forecast for a Cambodia location on a date.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string"},
                    "date": {"type": "string", "description": "YYYY-MM-DD"},
                },
                "required": ["location", "date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_emergency_contacts",
            "description": "Get emergency contacts for a Cambodia province.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string"},
                },
                "required": ["location"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_sos_alert",
            "description": "Send SOS emergency alert. Only call when user explicitly requests emergency help.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "string"},
                    "location": {"type": "string"},
                    "message": {"type": "string"},
                },
                "required": ["user_id", "location", "message"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_payment_qr",
            "description": "Generate a Bakong/ABA QR code for payment after a booking hold is created.",
            "parameters": {
                "type": "object",
                "properties": {
                    "booking_id": {"type": "string"},
                    "provider": {"type": "string", "enum": ["BAKONG", "ABA"]},
                },
                "required": ["booking_id", "provider"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_loyalty",
            "description": "Get user's loyalty points balance.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "string"},
                },
                "required": ["user_id"],
            },
        },
    },
]

# Maps tool name → (HTTP method, backend path) — must match ai-tools.controller.ts exactly
TOOL_DISPATCH: dict[str, tuple[str, str]] = {
    "search_trips":           ("POST", "ai-tools/search/trips"),
    "search_hotels":          ("GET",  "ai-tools/hotels"),
    "search_guides":          ("GET",  "ai-tools/guides"),
    "search_transport":       ("GET",  "ai-tools/search/transport"),
    "check_availability":     ("GET",  "ai-tools/availability"),
    "create_booking_hold":    ("POST", "ai-tools/bookings"),
    "check_payment_status":   ("GET",  "ai-tools/payments/status"),
    "estimate_budget":        ("POST", "ai-tools/budget/estimate"),
    "get_weather":            ("GET",  "ai-tools/weather"),
    "get_emergency_contacts": ("GET",  "ai-tools/emergency-contacts"),
    "send_sos_alert":         ("POST", "ai-tools/sos"),
    "generate_payment_qr":    ("POST", "ai-tools/payments/qr"),
    "get_user_loyalty":       ("GET",  "ai-tools/loyalty"),
}
