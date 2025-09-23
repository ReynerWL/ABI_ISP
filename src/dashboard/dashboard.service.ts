import { Injectable } from '@nestjs/common';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { Between, DataSource, In } from 'typeorm';
import { User } from '#/user/entities/user.entity';
import * as dayjs from 'dayjs';
import { Payment } from '#/payment/entities/payment.entity';

export interface DashboardAdmin{
  totalCustomer: number;
  newCustomer: number;
  pendingCustomer: number;
  activeCustomer: number;
  inactiveCustomer: number;
  packageInformations:Payment[];
  needConfirmations?: any[];
  transactionSummary?:any[];
}
@Injectable()
export class DashboardService {
  constructor(
        private dataSource: DataSource,
  ){}

  async listDashboard(this_year?:boolean){
    const whereCondition: any = {}

    if(this_year){
      const startOfYear = dayjs().startOf('year').format();
      const endOfYear = dayjs().endOf('year').format();
      console.log(startOfYear, endOfYear);
      whereCondition.createdAt =  Between(startOfYear, endOfYear);
    }
    const dataCustomer  = await this.dataSource.manager.find(User,{
      where:{...whereCondition, role:{name: "USER"}},
      relations: {role: true}
    })
    const newCust = dataCustomer.filter(
      (cust) => cust.status == "NEW"
    );
    const pendingCust = dataCustomer.filter(
      (cust) => cust.status == "PENDING"
    )
    const activeCust = dataCustomer.filter(
      (cust) => cust.status == "ACTIVE"
    )
    const inactiveCust = dataCustomer.filter(
      (cust) => cust.status == "INACTIVE"
    )
    const total = dataCustomer.length

    //pakets
    const dataPayment = await this.dataSource.manager
    .getRepository(Payment)
    .createQueryBuilder('payment')
    .leftJoin('payment.pakets', 'paket')
    .select('paket.speed', 'paketSpeed')
    .addSelect('COUNT(payment.id)', 'total')
    .groupBy('paket.speed')
    .getRawMany()
    console.log(dataPayment)

    //
    const dataPendingInactive = await this.dataSource.manager.find(User, {
      where:{status:In(["PENDING", "INACTIVE"]), role:{name: "USER"}},
      select:{customerId: true, updatedAt: true, status: true}
    })

    const formattedDate = dataPendingInactive.map((cust) =>({
      ...cust,
      updatedAt: dayjs(cust.updatedAt).format("DD/MM/YYYY HH.mm",)
    }))

    //count transaction
    const dataTransactions = await this.dataSource.manager
    .getRepository(Payment)
    .createQueryBuilder('payment')
    .select("TO_CHAR(payment.createdAt, 'Mon')", 'month')
    .addSelect("SUM(payment.price as total)", 'total')
    .where('payment.status =:status', {status: 'PAID'})
    .groupBy("TO_CHAR(payment.createdAt, 'Mon')")
    .orderBy("MIN(payment.createdAt)", 'ASC')
    .getRawMany()

    console.log(dataTransactions, "trx")
    const datas : DashboardAdmin = {
      totalCustomer: total,
      newCustomer: newCust.length,
      pendingCustomer: pendingCust.length,
      activeCustomer: activeCust.length,
      inactiveCustomer: inactiveCust.length,
      packageInformations: dataPayment,
      needConfirmations: formattedDate,
      transactionSummary: dataTransactions
    }
    return {datas}
  }
}