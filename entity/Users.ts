import { EntitySchemaOptions } from 'typeorm/entity-schema/EntitySchemaOptions';

export interface UserEntity {
  id?: number;
  name: string;
  address: string;
  role: string;
}

const Users: EntitySchemaOptions<UserEntity> = {
  name: "Users",
  columns: {
    id: {
      primary: true,
      type: "int",
      generated: true
    },
    name: {
      type: "varchar"
    },
    address: {
      type: "varchar"
    },
    role: {
      type: "varchar"
    }
  }
};

export default Users;
