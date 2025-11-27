import { Injectable } from '@nestjs/common';
import { Between, DataSource, ILike, In, Or } from 'typeorm';
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

    // ===========================
    // FILTER BY YEAR
    // ===========================
    if (this_year) {
      const startOfYear = dayjs().startOf('year').toDate();
      const endOfYear = dayjs().endOf('year').toDate();
      whereCondition.createdAt = Between(startOfYear, endOfYear);
    }

    // ===========================
    // GET ALL CUSTOMER DATA
    // ===========================
    const dataCustomer = await this.dataSource.manager.find(User, {
      where: {
        ...whereCondition,
        role: { name: ILike('user') },
      },
      relations: { role: true },
    });

    const newCust = dataCustomer.filter(
      (cust) => cust.status === UserStatus.BARU,
    );
    const pendingCust = dataCustomer.filter(
      (cust) => cust.status === UserStatus.PENDING,
    );
    const activeCust = dataCustomer.filter(
      (cust) => cust.status === UserStatus.AKTIF,
    );
    const inactiveCust = dataCustomer.filter(
      (cust) => cust.status === UserStatus.NONAKTIF,
    );

    const total = dataCustomer.length;

    // ===========================
    // PAKET INFORMATION
    // ===========================
    const dataPayment = await this.dataSource.manager
      .getRepository(Payment)
      .createQueryBuilder('payment')
      .leftJoin('payment.paket', 'paket')
      .select('paket.speed', 'paketSpeed')
      .addSelect('COUNT(payment.id)', 'total')
      .groupBy('paket.speed')
      .getRawMany();

    // ===========================
    // NEED CONFIRMATION: BARU, PENDING, DITOLAK
    // ===========================
    const dataPendingInactive = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('u')
      .leftJoin('u.role', 'role') // FIX JOIN
      .where('u.status IN (:...statuses)', {
        statuses: [UserStatus.BARU, UserStatus.PENDING, UserStatus.DITOLAK],
      })
      .andWhere('LOWER(role.name) = LOWER(:role)', { role: 'user' }) // FIX ROLE FILTER
      // .select(['u.customerId', 'u.updatedAt', 'u.status']) // SELECT USER FIELDS ONLY
      .getMany();

    const formattedDate = dataPendingInactive.map((cust) => ({
      ...cust,
      updatedAt: dayjs(cust.updatedAt).format('DD/MM/YYYY HH.mm'),
    }));

    // ===========================
    // TRANSACTION SUMMARY (MONTHLY)
    // ===========================
    const dataTransactions = await this.dataSource.manager
      .getRepository(Payment)
      .createQueryBuilder('p')
      .select("TO_CHAR(p.createdAt, 'Mon')", 'month')
      .addSelect('SUM(p.price)', 'total')
      .where('p.status = :status', { status: 'CONFIRMED' })
      .andWhere(
        this_year
          ? 'EXTRACT(YEAR FROM p.createdAt) = EXTRACT(YEAR FROM CURRENT_DATE)'
          : '1=1',
      )
      .groupBy("TO_CHAR(p.createdAt, 'Mon')")
      .orderBy('MIN(p.createdAt)', 'ASC')
      .getRawMany();

    // Convert DB result to map
    const dbTransactionMap = new Map<string, number>();
    dataTransactions.forEach((trx) => {
      dbTransactionMap.set(trx.month, parseFloat(trx.total) || 0);
    });

    // Create full list of months
    const allMonths = [...Array(12)].map((_, i) =>
      dayjs().month(i).format('MMM'),
    );

    const formattedTransactions = allMonths.map((month) => ({
      month,
      total: Number((dbTransactionMap.get(month) || 0).toFixed(2)),
    }));

    return {
      totalCustomer: total,
      newCustomer: newCust.length,
      praAktifCustomer: pendingCust.length,
      activeCustomer: activeCust.length,
      inactiveCustomer: inactiveCust.length,
      packageInformations: dataPayment,
      needConfirmations: formattedDate,
      transactionSummary: formattedTransactions,
    } as DashboardAdmin;
  }
}
