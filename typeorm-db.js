var typeorm = require("typeorm");
var EntitySchema = typeorm.EntitySchema;

const Users = require("./entity/Users")
const telemetry = require("./startup-telemetry")

typeorm.createConnection({
  name: "mysql",
  type: "mysql",
  host: "localhost",
  port: 3306,
  username: "root",
  password: "root",
  database: "acme",
  synchronize: true,
  "logging": true,
  entities: [
    new EntitySchema(Users)
  ]
}).then(() => {

  const dbConnection = typeorm.getConnection('mysql')

  const repo = dbConnection.getRepository("Users")
  return repo
}).then((repo) => {


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
}).then(() => {
  telemetry.reportStartupSuccess('mysql_connection_ready', {
    connection: 'mysql',
    database: 'acme',
    seeded_users: 2
  })
}).catch((err) => {
  telemetry.reportStartupFailure('mysql_connection_failed', err, {
    connection: 'mysql',
    database: 'acme'
  })
})