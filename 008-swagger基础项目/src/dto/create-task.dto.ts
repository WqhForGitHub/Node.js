import { IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class CreateTaskDto {
  @ApiProperty({ example: 'Buy milk' })
  @IsString()
  title: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  done?: boolean;
}
