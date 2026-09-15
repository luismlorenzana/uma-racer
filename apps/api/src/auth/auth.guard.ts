import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, createParamDecorator } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as admin from 'firebase-admin'
import type { Request } from 'express'

export const LOCAL_DEV_UID = 'local-dev'

type AuthedRequest = Request & { user?: { uid: string; email?: string } }

// Verifies a Firebase ID token and enforces the owner email allowlist (same guard as uma-planner).
// AUTH_MODE=disabled bypasses everything for local development and acts as a fixed local user.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>()
    if (this.config.get<string>('AUTH_MODE') === 'disabled') {
      req.user = { uid: LOCAL_DEV_UID }
      return true
    }

    const header = req.headers.authorization ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) throw new UnauthorizedException('missing bearer token')

    if (admin.apps.length === 0) admin.initializeApp()
    let decoded: admin.auth.DecodedIdToken
    try {
      decoded = await admin.auth().verifyIdToken(token)
    } catch {
      throw new UnauthorizedException('invalid token')
    }

    const allowed = (this.config.get<string>('ALLOWED_EMAIL') ?? '').toLowerCase()
    if (!allowed || decoded.email?.toLowerCase() !== allowed) {
      throw new UnauthorizedException('not authorized')
    }

    req.user = { uid: decoded.uid, email: decoded.email }
    return true
  }
}

/** The authenticated user's uid (set by AuthGuard). */
export const CurrentUid = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>()
  if (!req.user) throw new UnauthorizedException('no user on request')
  return req.user.uid
})
