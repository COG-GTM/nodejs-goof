var typeorm = require("typeorm");
var EntitySchema = typeorm.EntitySchema;

const Users = require("./entity/Users")

const dataSource = new typeorm.DataSource({
  name: "mysql",
  type: "mysql",
  host: process.env.MYSQL_HOST || "localhost",
  port: Number(process.env.MYSQL_PORT) || 3306,
  username: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || "acme",
  synchronize: true,
  "logging": true,
  entities: [
    new EntitySchema(Users)
  ]
})

const MAX_CONNECT_ATTEMPTS = 10

// MySQL can take a while to accept connections (e.g. on a fresh docker compose up), so retry.
function initialize(attempt) {
  return dataSource.initialize().catch((err) => {
    if (attempt >= MAX_CONNECT_ATTEMPTS) throw err
    console.error('MySQL not ready (attempt %d/%d), retrying in 3s', attempt, MAX_CONNECT_ATTEMPTS)
    return new Promise((resolve) => setTimeout(resolve, 3000)).then(() => initialize(attempt + 1))
  })
}

initialize(1).then(() => {
  const repo = dataSource.getRepository("Users")

  console.log('Seeding 2 users to MySQL users table: Liran (role: user), Simon (role: admin')
  const inserts = [
    repo.insert({
      name: "Liran",
      address: "IL",
      role: "user"
    }),
    repo.insert({
      name: "Simon",
      address: "UK",
      role: "admin"
    })
  ];

  return Promise.all(inserts)
}).catch((err) => {
  console.error('failed connecting and seeding users to the MySQL database')
  console.error(err)
})

module.exports = dataSource
