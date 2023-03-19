const express = require('express')
const path = require('path')
const moment = require("moment")
const app = express()

var config = {}
var myDefault = {
  debug: false,
  port: 2411,
  FreeDaysStart: 1,
  FreeDaysStop: 7,
  ForceFreeDays: false
}

function getTime() {
  let current = "["+ moment().format("DD/MM/YY HH:mm:ss") + "]"
  return current
}

console.log(getTime(),"@bugsounet YouTube Server v"+ require("../package.json").version, "starts...")

try {
  config = require("../config.js").config
  config = Object.assign({}, myDefault, config)
} catch (e) {
  console.error(getTime(), "Error by reading config file!", e)
  console.warn(getTime(), "Starting with default configuration")
  config= myDefault
}

try {
  console.log(getTime(), "Reading Database...")
  database = require("../database/database.js").database
  console.log(getTime(), "There is", Object.keys(database).length, "username in database")
} catch (e) {
  console.error(getTime(), "Error by reading database file!", e)
  process.exit(255)
}

if (config.debug) log = (...args) => { console.log(getTime(), ...args) }
else log = (...args) => { /* do nothing */ }

function login(username, password, FreeDays) {
  if (FreeDays) {
    log("[LOGIN] FreeDays Playing")
    return true
  } else {
    if (!username || !password) return false
    if (database[username] && database[username] == password) {
      log("[LOGIN] Login:", username)
      return true
    }
    console.log(getTime(), "[LOGIN] Login Failed:", username)
    return false
  }
}

var dates = {
    convert:function(d) {
        return (
            d.constructor === Date ? d :
            d.constructor === Array ? new Date(d[0],d[1],d[2]) :
            d.constructor === Number ? new Date(d) :
            d.constructor === String ? new Date(d) :
            typeof d === "object" ? new Date(d.year,d.month,d.date) :
            NaN
        );
    },
    compare:function(a,b) {
        return (
            isFinite(a=this.convert(a).valueOf()) &&
            isFinite(b=this.convert(b).valueOf()) ?
            (a>b)-(a<b) :
            NaN
        );
    },
    inRange:function(d,start,end) {
       return (
            isFinite(d=this.convert(d).valueOf()) &&
            isFinite(start=this.convert(start).valueOf()) &&
            isFinite(end=this.convert(end).valueOf()) ?
            start <= d && d <= end :
            NaN
        );
    }
}

/** main code **/
app.get('/', async (req, res) => {
  var now = new Date();
  var day = now.getDate();
  var startDate = new Date();
  var endDate = new Date();

  startDate.setDate(config.FreeDaysStart);
  startDate.setHours(0,1,0);
  endDate.setDate(config.FreeDaysStop);
  endDate.setHours(23,59,0);

  var FreeDays = dates.inRange(now, startDate, endDate) || config.ForceFreeDays
  var ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress

  log("["+ip+"] Query:", req.query)

  if (!req.query.id) return res.sendFile(path.join(__dirname, '../html/403.html'))

  let username = req.query.username
  let password = req.query.password || req.query.token // v1.x compatibility

  let access = await login(username, password, FreeDays)
  if (access) res.sendFile(path.join(__dirname, '../html/youtube.html'))
  else res.sendFile(path.join(__dirname, '../html/403.html'))
});

app.get('/403.css', (req, res) => {
  res.sendFile(path.join(__dirname, '../html/403.css'))
})

app.get('/TweenMax.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../html/TweenMax.min.js'))
})

app.get('*', function(req, res){
  res.sendFile(path.join(__dirname, '../html/403.html'))
});

app.listen(config.port, () => {
  log("Configuration:", config)
  console.log(getTime(),`Listening at http://localhost:${config.port}`)
})
