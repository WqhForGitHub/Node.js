import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { InvoiceModule } from './invoice/invoice.module';
import { InvoiceItemModule } from './invoiceItem/invoiceItem.module';
import { StatsModule } from './stats/stats.module';
@Module({
  imports: [AuthModule, InvoiceModule, InvoiceItemModule, StatsModule],
})
export class AppModule {}
