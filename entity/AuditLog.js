module.exports = {
  name: "AuditLog",
  columns: {
    id: {
      primary: true,
      type: "int",
      generated: true
    },
    action: {
      type: "varchar"
    },
    actor: {
      type: "varchar"
    },
    targetUserId: {
      type: "int"
    },
    role: {
      type: "varchar",
      nullable: true
    },
    createdAt: {
      type: "datetime",
      createDate: true
    }
  }
};
