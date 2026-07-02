// Fire-and-forget error reporting to /api/log, which writes reports to the
// Vercel function log. Telemetry must never be able to break the flow it is
// observing: this never throws, is never awaited, and is a no-op outside
// production builds (dev has no /api routes and the console already shows
// every error locally).

export function logError(context, error) {
  try {
    if (!import.meta.env.PROD) return
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context,
        message: String(error?.message ?? error ?? '').slice(0, 1000),
        stack: typeof error?.stack === 'string' ? error.stack.slice(0, 2000) : undefined,
      }),
      // keepalive lets a report survive the page unloading right after a crash
      keepalive: true,
    }).catch(() => {})
  } catch { /* never throw from telemetry */ }
}
