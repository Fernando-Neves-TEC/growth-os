/** Endpoints de autenticação humana (S2) — sessão servidor-side em cookie HttpOnly. */
import { Body, Controller, Get, Inject, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import { zodBody } from "../validation/zod.pipe.js";
import { AuthService, SESSION_COOKIE } from "./auth.service.js";
import { Human, Public } from "./auth.decorators.js";

const LoginSchema = z.object({
  email: z.string().email("email inválido"),
  password: z.string().min(8, "senha muito curta"),
});

function reqContext(req: Request): { requestId: string; ip: string | null; path: string; userAgent: string | null } {
  return {
    requestId: randomUUID(),
    ip: req.ip ?? null,
    path: req.originalUrl ?? req.url ?? "",
    userAgent: (req.headers["user-agent"] as string | undefined) ?? null,
  };
}

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  // GAUNTLET SECURITY CLOSURE — limite ESPECÍFICO p/ login (5/min por IP), independente do global,
  // usando o mecanismo oficial @nestjs/throttler (não há contador próprio).
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("login")
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body(zodBody(LoginSchema)) body: z.infer<typeof LoginSchema>) {
    const session = await this.auth.login({ email: body.email, password: body.password }, reqContext(req));
    this.setSessionCookie(res, session.sessionToken, session.expiresAt);
    return { operator: session.operator, csrfToken: session.csrfToken, expiresAt: session.expiresAt };
  }

  @Public()
  @Get("me")
  async me(@Req() req: Request) {
    const session = await this.auth.resolveSession((req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE], reqContext(req));
    if (!session) throw new UnauthorizedException("não autenticado");
    return { operator: session.operator, csrfToken: session.csrfToken, expiresAt: session.expiresAt };
  }

  @Human()
  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookie = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    await this.auth.logout(cookie, {
      ...reqContext(req),
      actorOperatorId: (req as Request & { operator?: { id: string } }).operator?.id,
    });
    this.clearSessionCookie(res);
    return { ok: true };
  }

  private setSessionCookie(res: Response, token: string, expiresAt: string): void {
    const secure = (process.env.GROWTHOS_MODE ?? "simulation") === "approved";
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      expires: new Date(expiresAt),
    });
  }

  private clearSessionCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, path: "/" });
  }
}
