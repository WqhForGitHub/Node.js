import { IsString, IsOptional } from 'class-validator';
export class CreateAttendanceDto {
  @IsString() employeeId: string;
  @IsString() @IsOptional() date: string;
  @IsString() @IsOptional() status: string;
}
