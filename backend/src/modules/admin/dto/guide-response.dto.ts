export class GuideResponseDto {
  id: string;
  userId: string;
  user?: {
    id: string;
    email: string;
    fullName: string | null;
    phone: string | null;
  } | null;
  bio: string | null;
  avatarUrl: string | null;
  images: string[];
  pricePerDayUsd: number;
  isVerified: boolean;
  province: string;
  provinces: string[];
  isActive: boolean;
  languages: string[];
  specialties: string[];
  assignmentCount: number;
  reviewCount: number;
  averageRating: number | null;
  createdAt: Date;
  updatedAt: Date;
}
