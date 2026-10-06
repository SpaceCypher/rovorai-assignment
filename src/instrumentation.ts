// Runs once when a server instance starts, before it handles requests:
// invalid configuration fails the boot instead of the first request.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getEnv } = await import('./server/env')
    getEnv()
  }
}
