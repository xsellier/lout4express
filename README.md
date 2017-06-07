# lout4express [![Build Status](https://travis-ci.org/xsellier/lout4express.svg?branch=master)](https://travis-ci.org/xsellier/lout4express)

Its [lout](https://github.com/hapijs/lout) for express

## Usage

```js
#!/usr/bin/env node

const express = require('express')
const os = require('os')
const Joi = require('joi')
const app = express()
const port = Number(process.env.PORT || 3000)

const lout4express = require('../lib')

const routes = [{
  path: '/v1/complexArray',
  method: 'post',
  validate: {
    query: Joi.object({
      param1: Joi.string().insensitive().required()
    })
  },
  tags: ['admin', 'api'],
  description: 'Test GET',
  notes: 'test note',
  description: 'Example of a fetch route'
},{
  path: '/v1/example/fetch',
  method: 'post',
  validate: {
    query: Joi.object({
      param1: Joi.string().required()
    }),
    params: Joi.object({
      param1: Joi.string().required()
    }),
    body: {
      param1: Joi.array().items({
        param2: Joi.string()
      })
    }
  },
  response: {
    schema: Joi.object({
      param1: Joi.string()
    }),
    status: {
      204: Joi.object({
        param2: Joi.string()
      }),
      404: Joi.object({
        error: 'Failure'
      })
    }
  },
  description: 'Example of a fetch route'
}, {
  path: '/v1/example/fetch',
  method: 'get',
  validate: {
    query: Joi.object({
      param1: Joi.string().required()
    }),
    params: Joi.object({
      param1: Joi.string().required()
    })
  },
  response: {
    schema: Joi.object({
      param1: Joi.string()
    }),
    status: {
      204: Joi.object({
        param2: Joi.string()
      }),
      404: Joi.object({
        error: 'Failure'
      })
    }
  },
  description: 'Example of a fetch route'
}]

app.all('/', lout4express(routes, os.hostname()))

app.listen(port, function () {
  console.log(`Example app listening on port ${port} !`)
})

```

## Installation

### Installing lout4express
```
  npm install lout4express --save
```