import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { EmployeeModule } from './employee/employee.module';
import { DepartmentModule } from './department/department.module';
import { StatsModule } from './stats/stats.module';
@Module({
  imports: [AuthModule, EmployeeModule, DepartmentModule, StatsModule],
})
export class AppModule {}
