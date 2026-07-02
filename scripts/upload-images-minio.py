#!/usr/bin/env python3
"""Upload all images from /home/rayu/DerLg/data/ to MinIO (derlg-minio).

Uses boto3 S3 client pointed at the local MinIO container.
Objects are stored with the original filename as the key.
"""

import os
import boto3
from botocore.client import Config

DATA_DIR = "/home/rayu/DerLg/data"
MINIO_ENDPOINT = "http://localhost:9000"
MINIO_ACCESS_KEY = "derlg-minio-local-docker"
MINIO_SECRET_KEY = "derlg-mini-local-docker"
BUCKET_NAME = "derlg-images"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif"}

def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=MINIO_ENDPOINT,
        aws_access_key_id=MINIO_ACCESS_KEY,
        aws_secret_access_key=MINIO_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )

def ensure_bucket(s3):
    existing = [b["Name"] for b in s3.list_buckets().get("Buckets", [])]
    if BUCKET_NAME not in existing:
        s3.create_bucket(Bucket=BUCKET_NAME)
        print(f"  Created bucket: {BUCKET_NAME}")
    else:
        print(f"  Bucket already exists: {BUCKET_NAME}")

def main() -> None:
    s3 = get_s3_client()
    ensure_bucket(s3)
    print(f"✅ Connected to MinIO at {MINIO_ENDPOINT}")

    count = 0
    errors = 0
    skipped = 0

    for root, _dirs, files in os.walk(DATA_DIR):
        for fname in sorted(files):
            ext = os.path.splitext(fname)[1].lower()
            if ext not in IMAGE_EXTENSIONS:
                skipped += 1
                continue

            filepath = os.path.join(root, fname)
            try:
                s3.upload_file(
                    filepath,
                    BUCKET_NAME,
                    fname,
                    ExtraArgs={"ContentType": f"image/{ext.lstrip('.')}"},
                )
                count += 1
            except Exception as exc:
                print(f"  ❌ {fname}: {exc}")
                errors += 1

    print(f"\nDone. {count} images uploaded, {errors} errors, {skipped} non-image files skipped.")

    # Verify — list objects in bucket
    objects = s3.list_objects_v2(Bucket=BUCKET_NAME).get("Contents", [])
    print(f"Total objects in bucket '{BUCKET_NAME}': {len(objects)}")
    print("Sample objects:")
    for obj in objects[:5]:
        print(f"  {obj['Key']} ({obj['Size']} bytes)")

if __name__ == "__main__":
    main()
