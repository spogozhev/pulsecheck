import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';
import { APP_VERSION } from '../../app.version';

@ApiTags('Мониторинг')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('HEALTH_REDIS') private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Проверка живости: БД и очередь (для балансировщика/мониторинга)' })
  async health() {
    const db = await this.prisma
      .$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false);

    let redis = false;
    try {
      redis = (await this.redis.ping()) === 'PONG';
    } catch {
      redis = false;
    }

    const ok = db && redis;
    if (!ok) throw new ServiceUnavailableException({ statusCode: 503, ok, db, redis });
    return { ok: true, db, redis, version: APP_VERSION };
  }
}
