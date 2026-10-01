var typeorm = require("typeorm");
var EntitySchema = typeorm.EntitySchema;

const Users = require("./entity/Users")

const REQUIRED_ENV = ["MYSQL_USER", "MYSQL_PASSWORD"]

function mysqlConfig(env) {
  const missing = REQUIRED_ENV.filter((name) => !env[name])
  if (missing.length) {
    return { missing: missing }
  }

  const port = parseInt(env.MYSQL_PORT || "3306", 10)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    return { invalid: "MYSQL_PORT" }
  }

  const development = env.NODE_ENV === "development"

  return {
    options: {
      name: "mysql",
      type: "mysql",
      host: env.MYSQL_HOST || "localhost",
      port: port,
      username: env.MYSQL_USER,
      password: env.MYSQL_PASSWORD,
      database: env.MYSQL_DATABASE || "acme",
      synchronize: development,
      logging: development,
      entities: [
        new EntitySchema(Users)
      ]
    }
  }
}

function connect(env) {
  const config = mysqlConfig(env)
  if (config.missing) {
    console.error('MySQL disabled: set ' + config.missing.join(', ') + ' to connect to the users database')
    return Promise.resolve(null)
  }
  if (config.invalid) {
    console.error('MySQL disabled: ' + config.invalid + ' is not a valid port')
    return Promise.resolve(null)
  }

  return typeorm.createConnection(config.options).then(() => {

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
  }).catch((err) => {
    console.error('failed connecting and seeding users to the MySQL database')
    console.error(err)
  })
}

module.exports = { mysqlConfig: mysqlConfig, connect: connect }
