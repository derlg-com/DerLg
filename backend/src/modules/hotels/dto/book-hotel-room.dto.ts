export interface BookHotelRoomDto {
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  guestsAdults: number;
  guestsChildren?: number;
  specialRequests?: string;
}
