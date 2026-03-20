import { IsString, IsArray } from 'class-validator';

export class ReorderMomentsDto {
  @IsString()
  date!: string;

  @IsArray()
  @IsString({ each: true })
  order!: string[];
}
