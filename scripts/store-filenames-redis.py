#!/usr/bin/env python3
"""Read all image filenames from /home/rayu/DerLg/data/ and store in Redis.

Each image is stored as:
  key  : slugified filename stem (e.g. "wat-botum-6")
  value: original filename string (e.g. "Wat Botum-6.jpg")
  ttl  : 24 hours
"""

import os
import redis

DATA_DIR = "/home/rayu/DerLg/data"
REDIS_HOST = "localhost"
REDIS_PORT = 6379
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif"}

def slugify_filename(filename: str) -> str:
    stem = os.path.splitext(filename)[0]
    return stem.lower().replace(" ", "-")

def main() -> None:
    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    r.ping()
    print(f"✅ Connected to Redis at {REDIS_HOST}:{REDIS_PORT}")

    count = 0
    errors = 0
    keys = []

    for root, _dirs, files in os.walk(DATA_DIR):
        for fname in sorted(files):
            ext = os.path.splitext(fname)[1].lower()
            if ext not in IMAGE_EXTENSIONS:
                continue

            key = slugify_filename(fname)
            try:
                r.set(key, fname, ex=86400)
                keys.append(key)
                count += 1
            except Exception as exc:
                print(f"  ❌ {fname}: {exc}")
                errors += 1

    print(f"\nDone. {count} filenames stored, {errors} errors.")

    # Sample verification
    sample = keys[:5]
    print(f"\nSample entries in Redis:")
    for k in sample:
        print(f"  {k} → {r.get(k)}")

if __name__ == "__main__":
    main()
