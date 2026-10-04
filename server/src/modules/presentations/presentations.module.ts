import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PresentationsController } from './presentations.controller';
import { SlidesController } from './slides.controller';
import { PollsController } from './polls.controller';
import { PresentationsService } from './presentations.service';
import { SlidesService } from './slides.service';
import { PollsService } from './polls.service';
import { ConverterService } from './converter.service';
import { ConversionProcessor } from './conversion.processor';
import { PortableService } from './portable.service';
import { CONVERSION_QUEUE } from './conversion.constants';

@Module({
  imports: [
    BullModule.registerQueue({
      name: CONVERSION_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 200,
        removeOnFail: 500,
      },
    }),
  ],
  controllers: [PresentationsController, SlidesController, PollsController],
  providers: [
    PresentationsService,
    SlidesService,
    PollsService,
    ConverterService,
    ConversionProcessor,
    PortableService,
  ],
  exports: [PresentationsService],
})
export class PresentationsModule {}
