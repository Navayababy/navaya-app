import posthog from 'posthog-js'

const key  = import.meta.env.VITE_POSTHOG_KEY
const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

export const isAnalyticsConfigured = !!key

let initialised = false

// Starts anonymous (PostHog assigns a random device id); identifyUser() links
// that id to an account once someone signs in. Autocapture/pageviews are off
// because this is a single-page app with manual screen tracking (trackScreen).
export function initAnalytics() {
  if (!isAnalyticsConfigured || initialised) return
  posthog.init(key, {
    api_host: host,
    person_profiles: 'identified_only',
    capture_pageview: false,
    autocapture: false,
    disable_session_recording: true,
  })
  initialised = true
}

// Never pass free text, names, emails or other PII in properties — this app
// handles infant health data and events should stay coarse (enums, counts,
// booleans, duration buckets).
export function trackEvent(name, properties = {}) {
  if (!isAnalyticsConfigured || !initialised) return
  posthog.capture(name, properties)
}

export function trackScreen(screenName) {
  trackEvent('screen_view', { screen: screenName })
}

// id should be the Supabase auth user id (a uuid), never an email or name.
export function identifyUser(id, traits = {}) {
  if (!isAnalyticsConfigured || !initialised || !id) return
  posthog.identify(id, traits)
}

export function resetAnalyticsUser() {
  if (!isAnalyticsConfigured || !initialised) return
  posthog.reset()
}
