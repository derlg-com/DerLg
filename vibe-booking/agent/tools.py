"""
9 tool schemas matching docs/modules API contracts.
Endpoints called via BackendClient at /v1/{path}.
"""

ALL_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_trips",
            "description": "Search Cambodia trip packages by natural language query. Call after gathering user intent.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Natural language search intent"},
                    "locale": {"type": "string", "enum": ["en", "zh", "km"]},
                    "user_id": {"type": "string"},
                    "max_results": {"type": "integer", "default": 3, "maximum": 5},
                },
                "required": ["query", "locale"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_hotels",
            "description": "Search hotels by city, dates, and price range.",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string"},
                    "check_in": {"type": "string", "description": "YYYY-MM-DD"},
                    "check_out": {"type": "string", "description": "YYYY-MM-DD"},
                    "price_range": {"type": "string", "enum": ["budget", "mid", "luxury"]},
                    "locale": {"type": "string", "enum": ["en", "zh", "km"]},
                },
                "required": ["city", "check_in", "check_out"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_guides",
            "description": "Find available tour guides by location, language, and date.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string"},
                    "language": {"type": "string", "description": "Guide's spoken language"},
                    "date": {"type": "string", "description": "YYYY-MM-DD"},
                },
                "required": ["location", "date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_availability",
            "description": "Check availability for a hotel room, transport vehicle, or guide on a specific date.",
            "parameters": {
                "type": "object",
                "properties": {
                    "item_type": {"type": "string", "enum": ["HOTEL", "TRANSPORT", "GUIDE"]},
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
            "description": "Create a booking hold after explicit user confirmation. Items can be TRIP, HOTEL, TRANSPORT, or GUIDE.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "string"},
                    "items": {
                        "type": "array",
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
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get weather forecast for a Cambodia location on a specific date.",
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
            "description": "Get emergency contacts (police, hospital, fire, tourist police) for a Cambodia province.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "Province or city name"},
                },
                "required": ["location"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_sos_alert",
            "description": "Send an SOS emergency alert for a user. Only call when user explicitly requests emergency help.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "string"},
                    "location": {"type": "string", "description": "Current location description or coordinates"},
                    "message": {"type": "string", "description": "Emergency description"},
                },
                "required": ["user_id", "location", "message"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_loyalty",
            "description": "Get user's loyalty points balance and tier.",
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

# Maps tool name → (HTTP method, backend path)
TOOL_DISPATCH: dict[str, tuple[str, str]] = {
    "search_trips":           ("POST", "ai-tools/search/trips"),
    "search_hotels":          ("GET",  "ai-tools/hotels"),
    "search_guides":          ("GET",  "ai-tools/guides"),
    "check_availability":     ("GET",  "ai-tools/availability"),
    "create_booking_hold":    ("POST", "ai-tools/bookings"),
    "get_weather":            ("GET",  "ai-tools/weather"),
    "get_emergency_contacts": ("GET",  "ai-tools/emergency-contacts"),
    "send_sos_alert":         ("POST", "ai-tools/sos"),
    "get_user_loyalty":       ("GET",  "ai-tools/loyalty"),
}
