import { Injectable } from "@nestjs/common";
import { CreateApplicationDto } from "./dto/create-application.dto";
import { UpdateApplicationDto } from "./dto/update-application.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { Application } from "./entities/application.entity";
import { Repository } from "typeorm";

@Injectable()
export class ApplicationService {
  constructor(
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>
  ) {}

  async create(application) {
    await this.applicationRepository.save(application);
    return application;
  }

  async findAll(params: { userId: number }) {
    const [data, count] = await this.applicationRepository.findAndCount({
      where: { admin: { id: params.userId } }
    });
    return {
      applications: data,
      count
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} application`;
  }

  update(id: number, updateApplicationDto: UpdateApplicationDto) {
    return `This action updates a #${id} application`;
  }

  remove(id: number) {
    return `This action removes a #${id} application`;
  }
}
