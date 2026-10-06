import 'server-only'
import { z } from 'zod'
import type { ApiErrorBody } from '@/shared/schemas/api'
import { idSchema } from '@/shared/schemas/common'
import { errorFields, logger } from '../logger'
import { AppError, notFound, pgErrorCode, validationError } from './errors'

const MAX_BODY_BYTES = 64 * 1024

type Handler<Ctx> = (request: Request, context: Ctx) => Promise<Response>

/**
 * Wraps a route handler with: request id, error → HTTP mapping, `no-store` caching and one
 * structured access log line per request. Handlers stay focused on parse → service → respond.
 */
export function withApi<Ctx>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (request, context) => {
    const requestId = crypto.randomUUID()
    const started = performance.now()
    let response: Response
    try {
      response = await handler(request, context)
    } catch (error) {
      response = errorResponse(error, requestId)
    }
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('X-Request-Id', requestId)
    logger.info('request', {
      requestId,
      method: request.method,
      path: new URL(request.url).pathname,
      status: response.status,
      durationMs: Math.round(performance.now() - started),
    })
    return response
  }
}

function errorResponse(error: unknown, requestId: string): Response {
  const appError = toAppError(error)
  if (appError) {
    if (appError.status >= 500)
      logger.error('dependency failure', { requestId, ...errorFields(error) })
    const body: ApiErrorBody = {
      error: {
        code: appError.code,
        message: appError.message,
        requestId,
        ...(appError.details && { details: appError.details }),
      },
    }
    return Response.json(body, { status: appError.status })
  }
  logger.error('unhandled error', { requestId, ...errorFields(error) })
  const body: ApiErrorBody = {
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong', requestId },
  }
  return Response.json(body, { status: 500 })
}

// Connection-level failures (postgres.js codes + Postgres admin/limit codes). Retryable, so 503.
const DB_UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'CONNECT_TIMEOUT',
  'CONNECTION_CLOSED',
  'CONNECTION_ENDED',
  'CONNECTION_DESTROYED',
  '57P01', // admin_shutdown
  '57P03', // cannot_connect_now
  '53300', // too_many_connections
])

/** Maps known failures to client-facing errors; anything else is a 500. */
export function toAppError(error: unknown): AppError | undefined {
  if (error instanceof AppError) return error
  const code = pgErrorCode(error)
  if (code && DB_UNAVAILABLE_CODES.has(code)) {
    return new AppError(
      503,
      'DB_UNAVAILABLE',
      'The database is temporarily unavailable. Try again.',
    )
  }
  switch (code) {
    case '23514': // check_violation
    case '22001': // string_data_right_truncation
    case '22P02': // invalid_text_representation
      return validationError('The request contains invalid values')
    default:
      return undefined
  }
}

// ---- Request parsing helpers -------------------------------------------------------------

function zodDetails(error: z.ZodError) {
  const { formErrors, fieldErrors } = z.flattenError(error)
  return { formErrors, fieldErrors: fieldErrors as Record<string, string[]> }
}

export function parseOrThrow<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input)
  if (!result.success) {
    const details = zodDetails(result.error)
    const message = details.formErrors[0] ?? 'Some fields are invalid'
    throw validationError(message, details)
  }
  return result.data
}

/** Reads and validates a JSON body: 415 for other content types, 413 when oversized, 400 for bad JSON. */
export async function readJson<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.output<S>> {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json')
  }
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large')
  }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON')
  }
  return parseOrThrow(schema, json)
}

/** A malformed id can't match any row, so it's a 404 (not a 400 and never a DB cast error). */
export function parseId(
  value: string,
  onInvalid: () => AppError = () => notFound('NOT_FOUND', 'Not found'),
) {
  const result = idSchema.safeParse(value)
  if (!result.success) throw onInvalid()
  return result.data
}

export const ok = <T, M>(data: T, meta?: M, status = 200) =>
  Response.json(meta === undefined ? { data } : { data, meta }, { status })

export const created = <T>(data: T) => ok(data, undefined, 201)

export const noContent = () => new Response(null, { status: 204 })
