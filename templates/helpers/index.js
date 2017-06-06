'use strict'

const fs = require('fs')
const path = require('path')

const files = fs.readdirSync(__dirname)

const helpers = files.reduce((js, filename) => {
  const filePath = path.join(__dirname, filename)
  const extname = path.extname(filePath)

  if (fs.statSync(filePath).isFile() &&
      /^\.js$/i.test(extname)) {
    const basename = path.basename(filename, extname)

    js[basename] = require(filePath)
  }

  return js
}, {})

module.exports = helpers
