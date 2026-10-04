import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { Public } from '../../common/decorators/public.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { AuthService, IssuedSession } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

@ApiTags('Аутентификация')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Регистрация преподавателя' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.register(dto);
    this.setCookies(res, session.token);
    void this.audit.log(req, 'auth.register', { entityId: session.user.id });
    return session;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Вход (JWT в httpOnly-cookie sid + Bearer-токен в ответе)' })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const session = await this.auth.login(dto);
      this.setCookies(res, session.token);
      void this.audit.log(req, 'auth.login', { entityId: session.user.id });
      return session;
    } catch (e) {
      void this.audit.log(req, 'auth.login_failed', { meta: { email: dto.email } });
      throw e;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Выход' })
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('sid', { path: '/' });
    res.clearCookie('csrf', { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @ApiOperation({ summary: 'Текущий пользователь' })
  async me(@CurrentUser() user: AuthUser) {
    return { user };
  }

  private setCookies(res: Response, token: string): void {
    const secure = this.config.get<boolean>('isProd');
    res.cookie('sid', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: WEEK_MS,
      path: '/',
    });
    res.cookie('csrf', randomBytes(24).toString('hex'), {
      httpOnly: false,
      sameSite: 'lax',
      secure,
      maxAge: WEEK_MS,
      path: '/',
    });
  }
}
