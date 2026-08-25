import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AttendanceModule } from './attendance/attendance.module';
import { EmployeeModule } from './employee/employee.module';
import { StatsModule } from './stats/stats.module';
@Module({
  imports: [AuthModule, AttendanceModule, EmployeeModule, StatsModule],
})
export class AppModule {}
