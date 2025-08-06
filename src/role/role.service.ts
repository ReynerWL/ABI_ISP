import { Injectable } from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role } from './entities/role.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) {}

  async create(createRoleDto: CreateRoleDto) {
    const data = new Role();

    data.name = createRoleDto.name;

    const result = await this.roleRepository.insert(data);

    return {
      data: await this.roleRepository.findOne({
        where: { id: result.identifiers[0].id },
      }),
    };
  }

  async findAll() {
    return await this.roleRepository.find();
  }

  async findOne(id: string) {
    return await this.roleRepository.findOneOrFail({ where: { id } });
  }

  async update(id: string, updateRoleDto: UpdateRoleDto) {
    const role = await this.findOne(id);
    const data = new Role();

    data.name = updateRoleDto.name;

    await this.roleRepository.update(role.id, data);

    return {
      data: await this.roleRepository.findOne({ where: { id: role.id } }),
    };
  }

  async remove(id: string) {
    const role = await this.findOne(id);

    await this.roleRepository.softDelete(role.id);

    return `Role With ID ${id} Has Been Deleted`;
  }
}
