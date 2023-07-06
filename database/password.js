const uuid = require('uuid')

const password = uuid.v4()

if (process.argv[2]) {
  console.log('"' + process.argv[2] + '": "' + password + '"', "\n")
} else {
  console.error("username missing!", "\n")
  console.log("Syntax:")
  console.log("npm run password <username>", "\n")
}
