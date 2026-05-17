from typing import Optional
from pydantic import BaseModel


class TextMessage(BaseModel):
    type: str = "text"
    text: str


class TripCardsMessage(BaseModel):
    type: str = "trip_cards"
    text: str
    trips: list[dict]


class QRPaymentMessage(BaseModel):
    type: str = "qr_payment"
    text: str
    qr_code_url: str
    payment_intent_id: str
    amount_usd: float
    expires_at: Optional[str] = None


class BookingConfirmedMessage(BaseModel):
    type: str = "booking_confirmed"
    text: str
    booking_ref: str
    trip_name: str
    travel_date: str


class WeatherMessage(BaseModel):
    type: str = "weather"
    text: str
    forecast: list[dict]


class ItineraryMessage(BaseModel):
    type: str = "itinerary"
    text: str
    itinerary: list[dict]


class BudgetEstimateMessage(BaseModel):
    type: str = "budget_estimate"
    text: str
    total_estimate_usd: float
    breakdown: dict


class ComparisonMessage(BaseModel):
    type: str = "comparison"
    text: str
    trips: list[dict]


class ImageGalleryMessage(BaseModel):
    type: str = "image_gallery"
    text: str
    images: list[dict]
