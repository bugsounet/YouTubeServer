const express = require('express')
const path = require('path')
const moment = require("moment")
const requestPromise = require("request-promise")
const app = express()

var config = {}
var myDefault = {
  debug: false,
  port: 2411,
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

/** main code **/
app.get('/', async (req, res) => {
  log("Query", req.query)

  if (!req.query.id) return res.sendFile(path.join(__dirname, '../html/403.html'))
  res.sendFile(path.join(__dirname, '../html/youtube.html'))
});

app.get('/403.css', (req, res) => {
  res.sendFile(path.join(__dirname, '../html/403.css'))
})

app.get('/TweenMax.js', (req, res) => {
  res.sendFile(path.join(__dirname, '../html/TweenMax.min.js'))
})

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../html/403.html'))
})

app.listen(config.port, () => {
  log("Configuration:", config)
  console.log("["+moment().format("DD/MM/YY HH:mm:ss")+"]",`Listening at http://localhost:${config.port}`)
})
