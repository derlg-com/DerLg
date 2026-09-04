import { NextResponse, type NextRequest } from 'next/server'

/**
 * Dedicated media proxy route handler for local MinIO storage.
 *
 * Rather than relying on Next.js Turbopack config rewrites (which can fail with
 * 400 Bad Request on proxy header mismatches or during dev server rebuilds),
 * this Route Handler streams media directly from MinIO with clean headers and caching.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path } = await context.params
    if (!path || path.length === 0) {
      return new NextResponse('Not found', { status: 404 })
    }

    const objectPath = path.join('/')
    const minioEndpoint = process.env.STORAGE_ENDPOINT || 'http://localhost:9000'
    const targetUrl = `${minioEndpoint}/derlg-storage/${objectPath}`

    const upstream = await fetch(targetUrl, {
      headers: {
        accept: request.headers.get('accept') || '*/*',
      },
      cache: 'no-store',
    })

    if (!upstream.ok) {
      return new NextResponse(null, { status: upstream.status })
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg'
    const headers = new Headers()
    headers.set('Content-Type', contentType)
    headers.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
    headers.set('Access-Control-Allow-Origin', '*')

    const contentLength = upstream.headers.get('content-length')
    if (contentLength) {
      headers.set('Content-Length', contentLength)
    }

    const etag = upstream.headers.get('etag')
    if (etag) {
      headers.set('ETag', etag)
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error('[derlg-storage] Proxy error:', error)
    return new NextResponse(null, { status: 502 })
  }
}
