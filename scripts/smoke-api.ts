/**
 * End-to-end API smoke test over real HTTP.
 *
 *   pnpm smoke                                  # http://localhost:3000
 *   pnpm smoke https://your-app.vercel.app      # deployed app
 *
 * Creates a uniquely named project, exercises every endpoint, then deletes what it created.
 * Safe against production: it never touches existing data.
 */
const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')
let failures = 0

async function call(method: string, path: string, body?: unknown) {
  const response = await fetch(base + path, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  return {
    status: response.status,
    headers: response.headers,
    body: text ? JSON.parse(text) : null,
  }
}

function check(label: string, condition: boolean, detail?: unknown) {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}`)
  if (!condition) {
    failures++
    if (detail !== undefined) console.log('      ', JSON.stringify(detail).slice(0, 300))
  }
}

async function main() {
  console.log(`Smoke testing ${base}\n`)

  const health = await call('GET', '/api/health')
  check(
    'GET /api/health → 200 db ok',
    health.status === 200 && health.body?.data?.db === 'ok',
    health.body,
  )

  const name = `Smoke ${new Date().toISOString()}`
  const created = await call('POST', '/api/projects', {
    name,
    githubRepo: 'https://github.com/vercel/next.js',
  })
  check(
    'POST /api/projects → 201, repo normalized',
    created.status === 201 && created.body?.data?.githubRepo === 'vercel/next.js',
    created.body,
  )
  const project = created.body?.data
  if (!project) throw new Error('cannot continue without a project')

  try {
    const dup = await call('POST', '/api/projects', { name: name.toUpperCase() })
    check(
      'POST duplicate name → 409 PROJECT_NAME_TAKEN',
      dup.status === 409 && dup.body?.error?.code === 'PROJECT_NAME_TAKEN',
      dup.body,
    )

    const invalid = await call('POST', '/api/projects', { name: '' })
    check(
      'POST invalid → 400 with fieldErrors.name',
      invalid.status === 400 && !!invalid.body?.error?.details?.fieldErrors?.name,
      invalid.body,
    )

    const t1 = await call('POST', `/api/projects/${project.id}/tickets`, {
      title: 'Smoke login bug',
      priority: 'high',
    })
    const t2 = await call('POST', `/api/projects/${project.id}/tickets`, {
      title: 'Smoke docs',
      status: 'done',
    })
    check('POST tickets → 201 x2', t1.status === 201 && t2.status === 201, [t1.body, t2.body])

    const search = await call('GET', `/api/projects/${project.id}/tickets?q=login&priority=high`)
    check(
      'GET tickets?q=login&priority=high → exactly 1',
      search.status === 200 && search.body?.data?.length === 1,
      search.body,
    )

    const detail = await call('GET', `/api/projects/${project.id}`)
    check(
      'GET project → counts todo 1 / done 1',
      detail.body?.data?.ticketCounts?.todo === 1 && detail.body?.data?.ticketCounts?.done === 1,
      detail.body,
    )

    const all = await call('GET', '/api/projects')
    const card = all.body?.data?.find((p: { id: string }) => p.id === project.id)
    check('GET /api/projects → card with 2 recent tickets', card?.recentTickets?.length === 2, card)
    check('responses are Cache-Control: no-store', all.headers.get('cache-control') === 'no-store')

    const ticketId = t1.body.data.id
    const updated = await call('PATCH', `/api/tickets/${ticketId}`, {
      version: 1,
      status: 'in_progress',
    })
    check(
      'PATCH ticket → 200, version 2',
      updated.status === 200 && updated.body?.data?.version === 2,
      updated.body,
    )

    const stale = await call('PATCH', `/api/tickets/${ticketId}`, { version: 1, status: 'done' })
    check(
      'PATCH stale version → 409 VERSION_CONFLICT',
      stale.status === 409 && stale.body?.error?.code === 'VERSION_CONFLICT',
      stale.body,
    )

    const one = await call('GET', `/api/tickets/${ticketId}`)
    check('GET ticket → includes project name', one.body?.data?.project?.name === name, one.body)

    const renamed = await call('PATCH', `/api/projects/${project.id}`, {
      version: 1,
      description: 'smoke',
    })
    check(
      'PATCH project → 200, version 2',
      renamed.status === 200 && renamed.body?.data?.version === 2,
      renamed.body,
    )

    const repo1 = await call('GET', `/api/projects/${project.id}/repository`)
    check(
      'GET repository → 200 vercel/next.js insights',
      repo1.status === 200 && repo1.body?.data?.fullName === 'vercel/next.js',
      repo1.body,
    )
    const repo2 = await call('GET', `/api/projects/${project.id}/repository`)
    check(
      'GET repository again → served from cache',
      repo2.body?.meta?.cached === true,
      repo2.body?.meta,
    )

    const delTicket = await call('DELETE', `/api/tickets/${ticketId}`)
    check('DELETE ticket → 204', delTicket.status === 204)

    const notFound = await call('GET', '/api/tickets/not-a-uuid')
    check('GET malformed id → 404 (not 500)', notFound.status === 404, notFound.body)
  } finally {
    const del = await call('DELETE', `/api/projects/${project.id}`)
    check('DELETE project (cleanup) → 204', del.status === 204)
    const gone = await call('GET', `/api/projects/${project.id}`)
    check('GET deleted project → 404', gone.status === 404)
  }

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
