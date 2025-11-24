import { Injectable } from '@nestjs/common';
import { Between, DataSource, ILike, In } from 'typeorm';
import { User, UserStatus } from '#/user/entities/user.entity';
import * as dayjs from 'dayjs';
import { Payment } from '#/payment/entities/payment.entity';

export interface DashboardAdmin {
  totalCustomer: number;
  newCustomer: number;
  praAktifCustomer: number;
  activeCustomer: number;
  inactiveCustomer: number;
  packageInformations: Payment[];
  needConfirmations?: any[];
  transactionSummary?: any[];
}
@Injectable()
export class DashboardService {
  constructor(private dataSource: DataSource) {}

  async listDashboard(this_year?: boolean) {
    const whereCondition: any = {};

    if (this_year) {
      const startOfYear = dayjs().startOf('year').format();
      const endOfYear = dayjs().endOf('year').format();
      console.log(startOfYear, endOfYear);
      whereCondition.createdAt = Between(startOfYear, endOfYear);
    }
    const dataCustomer = await this.dataSource.manager.find(User, {
      where: { ...whereCondition, role: { name: ILike('user') } },
      relations: { role: true },
    });
    const newCust = dataCustomer.filter(
      (cust) => cust.status == UserStatus.BARU,
    );
    const pendingCust = dataCustomer.filter(
      (cust) => cust.status == UserStatus.PENDING,
    );
    const activeCust = dataCustomer.filter(
      (cust) => cust.status == UserStatus.AKTIF,
    );
    const inactiveCust = dataCustomer.filter(
      (cust) => cust.status == UserStatus.NONAKTIF,
    );
    const total = dataCustomer.length;

    //pakets
    const dataPayment = await this.dataSource.manager
      .getRepository(Payment)
      .createQueryBuilder('payment')
      .leftJoin('payment.paket', 'paket')
      .select('paket.speed', 'paketSpeed')
      .addSelect('COUNT(payment.id)', 'total')
      .groupBy('paket.speed')
      .getRawMany();
    console.log(dataPayment);

    //
    const dataPendingInactive = await this.dataSource.manager.find(User, {
      where: { status: In([ILike(`%${UserStatus.PENDING}%`),ILike(`%${UserStatus.NONAKTIF}%`)]), role: { name: ILike('user')} },
      select: { customerId: true, updatedAt: true, status: true },
    });

    const formattedDate = dataPendingInactive.map((cust) => ({
      ...cust,
      updatedAt: dayjs(cust.updatedAt).format('DD/MM/YYYY HH.mm'),
    }));

    //count transaction
    const dataTransactions = await this.dataSource.manager
      .getRepository(Payment)
      .createQueryBuilder('payment')
      .select("TO_CHAR(payment.createdAt, 'Mon')", 'month')
      .addSelect('SUM(payment.price)', 'total')
      .where('payment.status = :status', { status: 'CONFIRMED' })
      .andWhere(
        this_year
          ? 'EXTRACT(YEAR FROM payment.createdAt) = EXTRACT(YEAR FROM CURRENT_DATE)'
          : '1=1', // Always true if not filtering by year
      )
      .groupBy("TO_CHAR(payment.createdAt, 'Mon')")
      .orderBy('MIN(payment.createdAt)', 'ASC')
      .getRawMany();

    // 2. Format DB results
    const dbTransactionMap = new Map<string, number>();
    dataTransactions.forEach((trx) => {
      // Ensure 'total' is a number
      dbTransactionMap.set(trx.month, parseFloat(trx.total) || 0);
    });

    // 3. Generate list of all months (short names like 'Jan', 'Feb')
    const allMonths: string[] = [];
    for (let i = 0; i < 12; i++) {
      // Use dayjs to get consistent short month names
      allMonths.push(dayjs().month(i).format('MMM'));
    }

    // 4. Merge DB data with all months, filling missing months with 0
    const formattedTransactions = allMonths.map((monthName) => {
      const total = dbTransactionMap.get(monthName) ?? 0;
      return {
        month: monthName,
        total: Number(total.toFixed(2)), // Ensure it's a clean number, rounded to 2 decimals
      };
    });
    
    const datas: DashboardAdmin = {
      totalCustomer: total,
      newCustomer: newCust.length,
      praAktifCustomer: pendingCust.length,
      activeCustomer: activeCust.length,
      inactiveCustomer: inactiveCust.length,
      packageInformations: dataPayment,
      needConfirmations: formattedDate,
      transactionSummary: formattedTransactions,
    };
    return datas;
  }
}
