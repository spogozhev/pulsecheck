import { ArrayMaxSize, IsArray, IsOptional, IsString } from 'class-validator';

export class SubmitAnswerDto {
  /** Выбранные варианты (single/multiple). Пусто = пропустить (если вопрос необязательный). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  selectedOptionIds?: string[];

  /** Полный порядок вариантов (ranking). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  rankingOrder?: string[];
}
