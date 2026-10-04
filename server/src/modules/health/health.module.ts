import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: 'HEALTH_REDIS',
      useFactory: (config: ConfigService) => new Redis(config.get<string>('redisUrl')!, { lazyConnect: true }),
      inject: [ConfigService],
    },
  ],
  exports: ['HEALTH_REDIS'],
})
export class HealthModule implements OnModuleDestroy {
  constructor(@Inject('HEALTH_REDIS') private readonly redis: Redis) {}
  async onModuleDestroy() {
    await this.redis.quit().catch(() => undefined);
  }
}
