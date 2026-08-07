var typeorm = require("typeorm");
var EntitySchema = typeorm.EntitySchema;

const Users = require("./entity/Users")

const mysqlDataSource = new typeorm.DataSource({
  name: "mysql",
  type: "mysql",
  host: process.env.MYSQL_HOST || "localhost",
  port: 3306,
  username: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || "acme",
  synchronize: true,
  "logging": true,
  entities: [
    new EntitySchema(Users)
  ]
})

module.exports = { mysqlDataSource }

mysqlDataSource.initialize().then((dbConnection) => {

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
}).catch((err) => {
  console.error('failed connecting and seeding users to the MySQL database')
  console.error(err)
})

