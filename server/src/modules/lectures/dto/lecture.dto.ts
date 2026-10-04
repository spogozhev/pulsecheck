import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class StartLectureDto {
  @IsUUID()
  presentationId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  course?: string;
}

export class SetSlideDto {
  @IsInt()
  @Min(0)
  index!: number;
}

export class ListLecturesDto {
  @IsOptional()
  @IsString()
  from?: string; // ISO-дата

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  course?: string;

  @IsOptional()
  @IsIn(['active', 'finished'])
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}
