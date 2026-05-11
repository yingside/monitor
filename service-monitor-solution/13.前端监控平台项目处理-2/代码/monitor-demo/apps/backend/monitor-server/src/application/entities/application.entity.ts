import { Admin } from "src/admin/entities/admin.entity";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Application {
  constructor(partial: Partial<Application>) {
    Object.assign(this, partial);
  }

  @PrimaryGeneratedColumn()
  id: number;

  /**
   * 项目id
   */
  @Column({ type: "varchar", length: 80, name: "app_id" })
  appId: string;

  /**
   * 项目类型
   */
  @Column({ type: "enum", enum: ["vanilla", "react", "vue"] })
  type: "vanilla" | "react" | "vue";

  /**
   * 项目名称
   */
  @Column({ type: "varchar", length: 100 })
  name: string;

  /**
   * 项目描述
   */
  @Column({ type: "text", nullable: true })
  description: string;

  /**
   * 项目创建时间
   */
  @Column({ nullable: true, default: () => "CURRENT_TIMESTAMP", name: "created_at" })
  createdAt?: Date;

  /**
   * 项目更新时间
   */
  @Column({ nullable: true, default: () => "CURRENT_TIMESTAMP", name: "updated_at" })
  updatedAt?: Date;

  @ManyToOne(() => Admin, admin => admin.applications)
  @JoinColumn({
    name: "admin_id",
    referencedColumnName: "id",
    foreignKeyConstraintName: "FK_application_admin"
  })
  admin: Admin;
}
