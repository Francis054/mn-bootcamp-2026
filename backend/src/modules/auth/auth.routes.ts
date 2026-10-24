import { Router } from 'express';
import { validateDto } from '../../shared/validation/validate-dto.js';
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from '../../shared/http/cookies.js';
import type { AuthService } from './auth.service.js';
import { clearAuthCookies, readCookie, setCsrfCookie, setSessionCookie } from './cookies.js';
import { LoginDto } from './login.dto.js';
import type { SessionService } from './session.service.js';
import { newSecretToken } from './tokens.js';

export function authRouter(auth: AuthService, sessions: SessionService): Router {
  const router = Router();

  router.post('/login', (req, res, next) => {
    validateDto(LoginDto, req.body)
      .then((dto) =>
        auth.login({
          email: dto.email,
          password: dto.password,
          ip: req.ip ?? 'unknown',
          requestId: req.id,
          now: new Date(),
        }),
      )
      .then((result) => {
        setSessionCookie(res, result.sessionToken);
        setCsrfCookie(res, result.csrfToken);
        res.status(200).json({ user: result.user, expiresAt: result.expiresAt });
      })
      .catch(next);
  });

  router.post('/logout', (req, res, next) => {
    auth
      .logout({
        token: readCookie(req.cookies, SESSION_COOKIE_NAME),
        ip: req.ip ?? 'unknown',
        requestId: req.id,
      })
      .then(() => {
        clearAuthCookies(res);
        res.status(204).send();
      })
      .catch(next);
  });

  router.get('/session', (req, res, next) => {
    const token = readCookie(req.cookies, SESSION_COOKIE_NAME);
    if (!token) {
      res.status(200).json({ authenticated: false });
      return;
    }
    sessions
      .authenticate(token, new Date())
      .then((found) => {
        if (!found) {
          clearAuthCookies(res);
          res.status(200).json({ authenticated: false });
          return;
        }
        if (!readCookie(req.cookies, CSRF_COOKIE_NAME)) {
          setCsrfCookie(res, newSecretToken());
        }
        res.status(200).json({
          authenticated: true,
          user: found.user,
          expiresAt: found.expiresAt,
        });
      })
      .catch(next);
  });

  return router;
}
