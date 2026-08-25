import { IsString, IsOptional } from 'class-validator';
export class CreateTripDto {
  @IsString() riderId: string;
  @IsString() @IsOptional() driverId: string;
  @IsString() @IsOptional() fare: string;
}
