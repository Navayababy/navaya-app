import { useState, useCallback } from 'react'

// One-time, per-device hints: shown until dismissed, then never again on
// this device. Callers combine `show` with their own conditions (signed in,
// in a household, etc.) — the hook only owns the seen/unseen flag.
//
// Keys live in the same navaya_ localStorage namespace as lib/storage.js;
// pass just the suffix (e.g. 'guest_notice_dismissed').
export function useOneTimeHint(key) {
  const storageKey = `navaya_${key}`
  const [show, setShow] = useState(() => localStorage.getItem(storageKey) !== '1')
  const dismiss = useCallback(() => {
    localStorage.setItem(storageKey, '1')
    setShow(false)
  }, [storageKey])
  return [show, dismiss]
}
