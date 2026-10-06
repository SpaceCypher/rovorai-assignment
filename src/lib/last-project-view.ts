// Remembers each project's last filter string for this browser tab, so "← Project" links from a
// ticket return to the same filtered list (like browser Back). Storage can be unavailable
// (private mode, blocked site data): every access is wrapped and falls back to no filters.

const key = (projectId: string) => `project-view:${projectId}`

export function rememberProjectQuery(projectId: string, search: string) {
  try {
    if (search) sessionStorage.setItem(key(projectId), search)
    else sessionStorage.removeItem(key(projectId))
  } catch {
    // ignore: a convenience only
  }
}

export function projectHref(projectId: string): string {
  let search = ''
  try {
    search = sessionStorage.getItem(key(projectId)) ?? ''
  } catch {
    // ignore
  }
  return `/projects/${projectId}${search ? `?${search}` : ''}`
}
