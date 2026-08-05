-- AlterEnum
ALTER TYPE "supported_language" ADD VALUE 'ja';
ALTER TYPE "supported_language" ADD VALUE 'ko';
ALTER TYPE "supported_language" ADD VALUE 'fr';
ALTER TYPE "supported_language" ADD VALUE 'de';
ALTER TYPE "supported_language" ADD VALUE 'es';
ALTER TYPE "supported_language" ADD VALUE 'th';
ALTER TYPE "supported_language" ADD VALUE 'vi';

-- CreateEnum
CREATE TYPE "specialty" AS ENUM ('culture_history', 'food_tours', 'nature_trekking', 'photography', 'family_friendly', 'business', 'luxury', 'adventure');

-- DropTable (replaced by enum-backed guide_specialties)
DROP TABLE "guide_specialities";

-- CreateTable
CREATE TABLE "guide_specialties" (
    "id" UUID NOT NULL,
    "guide_id" UUID NOT NULL,
    "specialty" "specialty" NOT NULL,
    CONSTRAINT "guide_specialties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guide_specialties_guide_id_specialty_key" ON "guide_specialties"("guide_id", "specialty");

-- CreateTable (implicit m2m Guide <-> Trip)
CREATE TABLE "_GuideToTrip" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,
    CONSTRAINT "_GuideToTrip_AB_pkey" PRIMARY KEY ("A", "B")
);

-- CreateIndex
CREATE INDEX "_GuideToTrip_B_index" ON "_GuideToTrip"("B");

-- AddForeignKey
ALTER TABLE "guide_specialties" ADD CONSTRAINT "guide_specialties_guide_id_fkey" FOREIGN KEY ("guide_id") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GuideToTrip" ADD CONSTRAINT "_GuideToTrip_A_fkey" FOREIGN KEY ("A") REFERENCES "guides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GuideToTrip" ADD CONSTRAINT "_GuideToTrip_B_fkey" FOREIGN KEY ("B") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
