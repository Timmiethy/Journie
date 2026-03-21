import { ArrayNotEmpty, IsArray, IsString, Matches } from 'class-validator';

export class ReorderMomentsDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  order!: string[];
}
