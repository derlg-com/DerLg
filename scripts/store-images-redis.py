#!/usr/bin/env python3
"""Read all images from /home/rayu/DerLg/data/ and store them in Redis.

Each image is stored with:
  key  : the filename (stem only, e.g. "wat-botum-1")
  value: base64-encoded bytes of the file
  ttl  : 24 hours (so cache stays fresh during dev)
"""

import os
import base64
import hashlib
import redis

DATA_DIR = "/home/rayu/DerLg/data"
REDIS_HOST = "localhost"
REDIS_PORT = 6379
# Uncomment if Redis requires a password:
# REDIS_PASSWORD = "rayuchoengrayu"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif"}

def slugify_filename(filename: str) -> str:
    """Turn a filename like 'Wat Botum-6.jpg' into 'wat-botum-6'."""
    stem = os.path.splitext(filename)[0]
    return stem.lower().replace(" ", "-")

def main() -> None:
    r = redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        decode_responses=False,   # store raw bytes as value
        # password=REDIS_PASSWORD,  # uncomment if needed
    )
    r.ping()
    print(f"✅ Connected to Redis at {REDIS_HOST}:{REDIS_PORT}")

    count = 0
    errors = 0
    total_bytes = 0

    for root, _dirs, files in os.walk(DATA_DIR):
        for fname in sorted(files):
            ext = os.path.splitext(fname)[1].lower()
            if ext not in IMAGE_EXTENSIONS:
                continue

            filepath = os.path.join(root, fname)
            key = slugify_filename(fname)

            try:
                with open(filepath, "rb") as f:
                    raw = f.read()
                encoded = base64.b64encode(raw)
                r.set(key, encoded)
                ttl_seconds = 86400
                r.expire(key, ttl_seconds)
                count += 1
                total_bytes += len(encoded)
            except Exception as exc:
                print(f"  ❌ {fname}: {exc}")
                errors += 1

    print(f"\nDone. {count} images stored, {errors} errors.")
    print(f"Total encoded size: {total_bytes / 1024 / 1024:.1f} MB")

    # Verification – sample 5 keys
    sample = r.keys("wat-botum-*")[:5]
    print(f"\nSample keys in Redis ({len(sample)} shown):")
    for k in sample:
        print(f"  {k.decode()} → {r.strlen(k)} bytes")

if __name__ == "__main__":
    main()
