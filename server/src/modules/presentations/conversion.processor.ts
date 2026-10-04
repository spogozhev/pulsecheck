import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { ConverterService } from './converter.service';
import { CONVERSION_QUEUE } from './conversion.constants';

@Processor(CONVERSION_QUEUE)
export class ConversionProcessor extends WorkerHost {
  private readonly logger = new Logger(ConversionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly converter: ConverterService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job<{ presentationId: string }>): Promise<void> {
    const { presentationId } = job.data;
    try {
      await this.run(presentationId);
    } catch (e) {
      const message = String((e as Error)?.message ?? e).slice(0, 500);
      this.logger.error(`Конвертация ${presentationId} не удалась: ${message}`);
      await this.prisma.presentation
        .update({ where: { id: presentationId }, data: { status: 'failed', error: message } })
        .catch(() => undefined);
      throw e;
    }
  }

  private async run(presentationId: string): Promise<void> {
    const presentation = await this.prisma.presentation.findUnique({
      where: { id: presentationId },
    });
    if (!presentation || !presentation.originalPath || presentation.status === 'ready') return;

    const storageDir = this.config.get<string>('storageDir')!;
    const originalAbs = path.join(storageDir, presentation.originalPath);
    const slidesDir = path.join(storageDir, 'slides', presentation.id);
    await rm(slidesDir, { recursive: true, force: true });
    await mkdir(slidesDir, { recursive: true });

    const workDir = path.join(tmpdir(), `pulsecheck-${presentation.id}`);
    await mkdir(workDir, { recursive: true });
    try {
      const pdfInput =
        presentation.sourceType === 'pptx'
          ? await this.converter.pptxToPdf(originalAbs, workDir)
          : originalAbs;

      const pages = await this.converter.rasterizePdf(pdfInput, slidesDir);

      await this.prisma.$transaction([
        this.prisma.slide.deleteMany({ where: { presentationId: presentation.id } }),
        this.prisma.slide.createMany({
          data: pages.map((p, i) => ({
            presentationId: presentation.id,
            index: i,
            imagePath: `slides/${presentation.id}/${p.fileName}`,
          })),
        }),
        this.prisma.presentation.update({
          where: { id: presentation.id },
          data: { status: 'ready', slideCount: pages.length, error: null },
        }),
      ]);
      this.logger.log(`Презентация ${presentation.id}: ${pages.length} слайдов`);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}
