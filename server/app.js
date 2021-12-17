const express = require('express')
const path = require('path')
const moment = require("moment")
const requestPromise = require("request-promise")
const app = express()

var config = {}
var myDefault = {
  debug: false,
  port: 2411,
  FreeDaysStart: 1,
  FreeDaysStop: 7,
  ForceFreeDays: false
}

console.log("["+moment().format("DD/MM/YY HH:mm:ss")+"]","@bugsounet YouTube Server v"+ require("../package.json").version, "starts...")

try {
  config = require("../config.js").config
  config = Object.assign({}, myDefault, config)
} catch (e) {
  console.log("["+moment().format("DD/MM/YY HH:mm:ss")+"]", "Error by reading config file!", e)
  console.log("["+moment().format("DD/MM/YY HH:mm:ss")+"]", "Starting with default configuration")
  config= myDefault
}

if (config.debug) log = (...args) => { console.log("["+moment().format("DD/MM/YY HH:mm:ss")+"]", ...args) }
else log = (...args) => { /* do nothing */ }

async function Login(login, token) {
  log("Try to login to @bugsounet forum...")

  let res = await requestPromise
    .get('http://forum.bugsounet.fr/api/login', {
      headers: {
        "Authorization":  "Bearer " + token
      }
    })
    .catch(function (err) {
      console.log("error: " + err)
      return false
    })

  if (!res) return false

  var username = res.slice(7,res.length-1)
  if (username == (login.toLowerCase())) {
    log(username, "Login...")
    return username
  }
  else {
    log("Login error!")
    return false
  }
}

async function Query(login, token) {
  let res = await requestPromise
    .get('http://forum.bugsounet.fr/api/groups/youtube/members', {
      headers: {
        "Authorization":  "Bearer " + token
      },
    })
    .catch(function (err) {
      console.log("error: " + err)
      return false
    })

  if (!res) return false

  let response = JSON.parse(res)
  if (response) {
    if (response.users.length) {
      var BreakException = {}
      try {
        response.users.forEach(user => {
          if (user.userslug == login) {
            access = 1
            throw BreakException
          }
        })
      } catch (e) {
        if (e !== BreakException) throw e
      }
    }
    return access ? true : false
  } else {
    log("no response")
    return false
  }    
}

async function main(username, token) {
  let login = await Login(username, token)
  if (login) {
    let access = await Query(login, token)
    if (access) {
      log(login, "have Access to YouTube")
      return true
    }
    else {
      log("NO Access to YouTube")
      return false
    }
  }
  else log("NO Access to YouTube")
  return false
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
  log("Query:", req.query)

  if (!req.query.id) return res.sendFile(path.join(__dirname, '../html/403.html'))

  if (req.query.username === "null" || req.query.token === "null") {
    if (FreeDays) { 
      log("FreeDays Played")
      return res.sendFile(path.join(__dirname, '../html/youtube.html'))
    }
    log("Error 403")
    return res.sendFile(path.join(__dirname, '../html/403.html'))
  }

  let username = req.query.username
  let token = req.query.token

  let access = await main(username, token)
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
  console.log("["+moment().format("DD/MM/YY HH:mm:ss")+"]",`Listening at http://localhost:${config.port}`)
})
