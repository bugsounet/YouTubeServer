'use strict';

const session = require('express-session')
const express = require('express')
const http = require('http')
const uuid = require('uuid')
const bodyParser = require('body-parser')

const path = require('path')
const moment = require("moment")
const app = express()
const map = new Map()

const { WebSocket, WebSocketServer } = require('ws')


var config = {}
var myDefault = {
  debug: false,
  port: 2411,
  FreeDaysStart: 1,
  FreeDaysStop: 7,
  ForceFreeDays: false
}
var database = {}

const sessionParser = session({
  saveUninitialized: false,
  secret: '$eCuRiTy',
  resave: false
})
var log = (...args) => { /* do nothing **/ }

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
  let tmpDatabase = require("../database/database.js").database
  for (const [key, value] of Object.entries(tmpDatabase)) {
    database[key]= {
      password: value,
      socket: null,
      isAlive: null,
      userId: null
    }
  }
  console.log(getTime(), "There is", Object.keys(database).length, "username in database", )
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
    if (database[username] && database[username].password == password) {
      log("[LOGIN] Login:", username)
      return true
    }
    console.log(getTime(), "[LOGIN] Login Failed:", username)
    return false
  }
}

function onSocketError(err) {
  console.error(err)
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
        )
    },
    compare:function(a,b) {
        return (
            isFinite(a=this.convert(a).valueOf()) &&
            isFinite(b=this.convert(b).valueOf()) ?
            (a>b)-(a<b) :
            NaN
        )
    },
    inRange:function(d,start,end) {
       return (
            isFinite(d=this.convert(d).valueOf()) &&
            isFinite(start=this.convert(start).valueOf()) &&
            isFinite(end=this.convert(end).valueOf()) ?
            start <= d && d <= end :
            NaN
        )
    }
}

/** main code **/

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(sessionParser)
app.get('/', async (req, res) => {
  var now = new Date()
  var day = now.getDate()
  var startDate = new Date()
  var endDate = new Date()

  startDate.setDate(config.FreeDaysStart)
  startDate.setHours(0,1,0)
  endDate.setDate(config.FreeDaysStop)
  endDate.setHours(23,59,0)

  var FreeDays = dates.inRange(now, startDate, endDate) || config.ForceFreeDays
  var ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress

  log("["+ip+"] Query:", req.query)

  if (!req.query.id) return res.sendFile(path.join(__dirname, '../html/403.html'))

  let username = req.query.username
  let password = req.query.password || req.query.token // v1.x compatibility

  let access = await login(username, password, FreeDays)
  if (access) {
    const id = uuid.v4()
    log("Updating session for user:", username, id)
    req.session.userId = id
    req.session.username = username
    res.sendFile(path.join(__dirname, '../html/youtube.html'))
  }
  else res.sendFile(path.join(__dirname, '../html/403.html'))
})

app.get('/403.css', (req, res) => {
  res.sendFile(path.join(__dirname, '../html/403.css'))
})

app.get('/TweenMax.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../html/TweenMax.min.js'))
})

app.post("/volumeControl", (req, res) => {
  let session = req.body.session
  let username = req.body.username
  let volumeControl = {
    volume: req.body.volume
  }
  let error = {
    error: "unknow"
  }

  if (database[username]) {
    if (database[username].userId == session) {
      if (database[username].socket) {
        log("Received:", req.body)
        database[username].socket.send(JSON.stringify(volumeControl))
        return res.send(JSON.stringify(volumeControl))
      } else {
        error.error = "Socket not found"
        log(error.error, username, session)
      }
    } else {
      error.error = "userId not found: " + session
      log(error.error)
    }
  } else {
    error.error = "Username not found: " + username
    log(error.error)
  }
  res.send(JSON.stringify(error))
})

app.get('*', function(req, res){
  res.sendFile(path.join(__dirname, '../html/403.html'))
})

// create http server
const server = http.createServer(app)

const wss = new WebSocketServer({ clientTracking: false, noServer: true })

server.on('upgrade', function (request, socket, head) {
  socket.on('error', onSocketError)

  log('Parsing session from request...')

  sessionParser(request, {}, () => {
    if (!request.session.userId) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    log('Session is parsed!')

    socket.removeListener('error', onSocketError)

    wss.handleUpgrade(request, socket, head, function (ws) {
      wss.emit('connection', ws, request)
    })
  })
})

wss.on('connection', (ws, request) => {
  const userId = request.session.userId
  const username = request.session.username

  map.set(userId, ws)

  ws.on('error', console.error)
  ws.on('pong', (what) => {
    ws.isAlive = true
    log("heartbeat...", username, userId)
  })
  ws.on('message', (message) => {
    if (message == "HELLO") {
      let data = {
        session: userId
      }
      ws.isAlive = true
      database[username].socket = ws
      database[username].userId = userId
      database[username].heartbeat = setInterval(() => {
        if (ws.isAlive === false) {
          ws.terminate()
          clearInterval(database[username].heartbeat)
          database[username].heartbeat = null
        }
        else {
          ws.isAlive = false
          ws.ping()
        }
      }, 20000)
      log("HELLO YouTube Player from", username )
      return ws.send(JSON.stringify(data))
    }
    log(`Received message ${message} from user ${userId}`, username)
  })

  ws.on('close', () => {
    log("close:", username, userId)
    database[username].socket = null
    database[username].userId = null
    clearInterval(database[username].heartbeat)
    database[username].heartbeat = null
    map.delete(userId)
  })
})

// all is ready ! listening...
server.listen(config.port, () => {
  log("Configuration:", config)
  console.log(getTime(),`Listening at http://localhost:${config.port}`)
})
