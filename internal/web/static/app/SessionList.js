// SessionList.js -- Renders groups + sessions from sessionsSignal
import { html } from 'htm/preact'
import { useEffect } from 'preact/hooks'
import { sessionsSignal, selectedIdSignal, authTokenSignal, sessionCostsSignal, focusedIdSignal, searchQuerySignal } from './state.js'
import { isGroupExpanded, groupExpandedSignal } from './groupState.js'
import { GroupRow } from './GroupRow.js'
import { SessionRow } from './SessionRow.js'
import { useKeyboardNav } from './useKeyboardNav.js'

// Fetch batch costs once after the session list first loads
let costsFetched = false
async function fetchBatchCosts(items) {
  if (costsFetched) return
  const ids = (items || [])
    .filter(i => i.type === 'session' && i.session)
    .map(i => i.session.id)
  if (ids.length === 0) return
  costsFetched = true

  const url = '/api/costs/batch?ids=' + ids.join(',')
  const headers = { Accept: 'application/json' }
  const token = authTokenSignal.value
  if (token) headers.Authorization = 'Bearer ' + token

  try {
    const res = await fetch(url, { headers })
    if (!res.ok) return
    const data = await res.json()
    sessionCostsSignal.value = data.costs || {}
  } catch (_) {
    // Cost badges unavailable; fail silently
  }
}

// hasCollapsedAncestor walks from the root down to (and including) the given
// path and returns true if any of those nodes is collapsed. Callers pass a
// session's groupPath here, because a session's groupPath IS its direct
// parent group and a collapsed parent must hide the session.
function hasCollapsedAncestor(path) {
  if (!path) return false
  // Read the signal to subscribe
  void groupExpandedSignal.value
  const parts = path.split('/')
  for (let i = 1; i <= parts.length; i++) {
    const ancestor = parts.slice(0, i).join('/')
    if (!isGroupExpanded(ancestor, true)) return true
  }
  return false
}

// hasCollapsedStrictAncestor walks only the STRICT ancestors of the given
// path (i.e. excludes the path itself). A group must never hide itself just
// because its own collapse state is false — its own state governs whether
// its children are shown, not whether IT is shown. This closes BUG #1 /
// CRIT-01: collapsing a top-level group (parts.length === 1) previously made
// hasCollapsedAncestor(group.path) return true and the group vanished from
// the sidebar.
function hasCollapsedStrictAncestor(path) {
  if (!path) return false
  // Read the signal to subscribe
  void groupExpandedSignal.value
  const parts = path.split('/')
  for (let i = 1; i < parts.length; i++) {
    const ancestor = parts.slice(0, i).join('/')
    if (!isGroupExpanded(ancestor, true)) return true
  }
  return false
}

function fuzzyMatch(text, query) {
  if (!query) return true
  const lower = (text || '').toLowerCase()
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  return terms.every(term => lower.includes(term))
}

function matchesSearch(item, query) {
  if (!query) return true
  if (item.type === 'group' && item.group) {
    return fuzzyMatch(item.group.name + ' ' + item.group.path, query)
  }
  if (item.type === 'session' && item.session) {
    const s = item.session
    return fuzzyMatch([s.title, s.id, s.groupPath, s.path, s.tool].join(' '), query)
  }
  return true
}

export function SessionList() {
  const items = sessionsSignal.value
  const focusedId = focusedIdSignal.value
  const query = searchQuerySignal.value

  useKeyboardNav()

  // Trigger batch cost fetch on first non-empty items
  useEffect(() => {
    if (items && items.length > 0) fetchBatchCosts(items)
  }, [items && items.length])

  // Signal Preact has taken over session list rendering
  useEffect(() => {
    window.__preactSessionListActive = true
    return () => { window.__preactSessionListActive = false }
  }, [])

  // When searching, show all matching sessions (ignore group collapse state)
  const filtered = query
    ? items.filter(item => matchesSearch(item, query))
    : items

  if (!filtered || filtered.length === 0) {
    return html`<div class="px-sp-12 py-sp-16 dark:text-tn-muted text-gray-400 text-sm">
      ${query ? 'No matching sessions' : 'No sessions'}
    </div>`
  }

  return html`<ul class="flex flex-col gap-0.5 py-sp-4 min-w-0" role="list" id="preact-session-list">
    ${filtered.map(item => {
      if (item.type === 'group' && item.group) {
        if (!query && hasCollapsedStrictAncestor(item.group.path)) return null
        return html`<${GroupRow} key=${item.group.path} item=${item} />`
      }
      if (item.type === 'session' && item.session) {
        if (!query && hasCollapsedAncestor(item.session.groupPath)) return null
        const isFocused = focusedId === item.session.id
        return html`<${SessionRow} key=${item.session.id} item=${item} focused=${isFocused} />`
      }
      return null
    })}
  </ul>`
}
