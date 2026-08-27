export class CustomerResponseDto {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  loyaltyPoints: number;
  isStudentVerified: boolean;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  bookingCount?: number;
  reviewCount?: number;
  totalSpentUsd?: number;
}
