'use strict'

// Load modules
const fs = require('fs')
const Joi = require('joi')
const path = require('path')
const Handlebars = require('handlebars').create()
const helpers = require('../templates/helpers')

const sources = {
  index: fs.readFileSync(path.join(__dirname, '..', 'templates', 'index.html')).toString(),
  route: fs.readFileSync(path.join(__dirname, '..', 'templates', 'route.html')).toString()
}

const partials = {
  type: fs.readFileSync(path.join(__dirname, '..', 'templates', 'type.html')).toString(),
  'type-header': fs.readFileSync(path.join(__dirname, '..', 'templates', 'type-header.html')).toString()
}

// Registering helpers
Object.keys(helpers).forEach((key) => {
  Handlebars.registerHelper(key, helpers[key])
})

const templates = Object.keys(sources).reduce((acc, current) => {
  // Registering templates
  acc[current] = Handlebars.compile(sources[current])
  return acc
}, {})

Object.keys(partials).forEach((name) => {
  // Registering partials
  Handlebars.registerPartial(name, partials[name])
})

// Declare internals
let internals = {}

internals.docs = function (routes) {
  // handler (request, reply) {
  const connections = []

  routes.forEach((connection) => {
    connection.table = connection.table.filter((item) => {
      if (request.query.path && item.path !== request.query.path) {
        return false
      }

      return !item.settings.isInternal &&
        item.settings.plugins.lout !== false &&
        item.method !== 'options' &&
        (!settings.filterRoutes || settings.filterRoutes({
          method: item.method,
          path: item.path,
          settings: item.settings,
          connection
        }))
    }).sort((route1, route2) => {
      if (route1.path > route2.path) {
        return 1
      }

      if (route1.path < route2.path) {
        return -1
      }

      return settings.methodsOrder.indexOf(route1.method) - settings.methodsOrder.indexOf(route2.method)
    })

    connections.push(connection)
  })

  if (connections.every((connection) => !connection.table.length)) {
    return reply(400)
  }

  if (request.query.path && request.query.server) {
    return reply.view(settings.routeTemplate, internals.getRoutesData(connections[0].table))
  }

  return reply.view(settings.indexTemplate, internals.getConnectionsData(connections))
}

internals.getRoutesData = function (routes) {
  return routes.map((route) => ({
    path: route.url,
    method: route.method.toUpperCase(),
    description: route.description,
    notes: internals.processNotes(route.notes),
    tags: route.tags,
    // auth: internals.processAuth(route),
    vhost: route.vhost,
    cors: route.cors,
    jsonp: route.jsonp,
    pathParams: internals.describe((route.validate || {}).params),
    queryParams: internals.describe((route.validate || {}).query),
    bodyParams: internals.describe((route.validate || {}).body),
    responseParams: internals.describe((route.response || {}).schema),
    statusSchema: internals.describeStatusSchema((route.response || {}).status)
  }))
}

internals.describe = function (params) {
  if (params === null || typeof params !== 'object') {
    return null
  }

  const description = internals.getParamsData(Joi.compile(params).describe())
  description.root = true
  return description
}

internals.describeStatusSchema = function (status) {
  const codes = Object.keys(status || {})
  if (!codes.length) {
    return
  }

  const result = {}
  codes.forEach((code) => {
    result[code] = internals.describe(status[code])
  })
  return result
}

internals.getParamsData = function (param, name) {
  // Detection of "false" as validation rule
  if (!name && param.type === 'object' && param.children && Object.keys(param.children).length === 0) {
    return {
      isDenied: true
    }
  }

  // Detection of conditional alternatives
  if (param.ref && param.is) {
    return {
      condition: {
        key: internals.formatReference(param.ref),
        value: internals.getParamsData(param.is, param.is.type)
      },
      then: param.then && internals.getParamsData(param.then, param.then.type),
      otherwise: param.otherwise && internals.getParamsData(param.otherwise, param.otherwise.type)
    }
  }

  let type
  if (param.valids && param.valids.some(internals.isRef)) {
    type = 'reference'
  } else {
    type = param.type
  }

  const data = {
    name,
    description: param.description,
    notes: internals.processNotes(param.notes),
    tags: param.tags,
    meta: param.meta,
    unit: param.unit,
    type,
    allowedValues: param.valids ? internals.getExistsValues(type, param.valids) : null,
    disallowedValues: param.invalids ? internals.getExistsValues(type, param.invalids) : null,
    examples: param.examples,
    peers: param.dependencies && param.dependencies.map(internals.formatPeers),
    target: type === 'reference' ? internals.getExistsValues(type, param.valids) : null,
    flags: param.flags && {
      allowUnknown: param.flags.allowUnknown,
      default: param.flags.default,
      encoding: param.flags.encoding, // binary specific
      insensitive: param.flags.insensitive, // string specific
      required: param.flags.presence === 'required',
      forbidden: param.flags.presence === 'forbidden',
      stripped: param.flags.strip,
      allowOnly: param.flags.allowOnly
    }
  }

  if (data.type === 'object') {
    let children = []

    if (param.children) {
      const childrenKeys = Object.keys(param.children)
      children = children.concat(childrenKeys.map((key) => internals.getParamsData(param.children[key], key)))
    }

    if (param.patterns) {
      children = children.concat(param.patterns.map((pattern) => internals.getParamsData(pattern.rule, pattern.regex)))
    }

    data.children = children
  }

  if (data.type === 'array' && param.items) {
    if (param.orderedItems) {
      data.orderedItems = param.orderedItems.map((item) => internals.getParamsData(item))
    }

    data.items = []
    data.forbiddenItems = []
    param.items.forEach((item) => {
      item = internals.getParamsData(item)
      if (item.flags && item.flags.forbidden) {
        data.forbiddenItems.push(item)
      } else {
        data.items.push(item)
      }
    })
  }

  if (data.type === 'alternatives') {
    data.alternatives = param.alternatives.map((alternative) => internals.getParamsData(alternative))
  } else {
    if (param.rules) {
      data.rules = param.rules.map((rule) => ({
        name: internals.capitalize(rule.name),
        params: internals.processRuleArgument(rule)
      }))
    } else {
      data.rules = []
    }
  }

  return data
}

internals.getExistsValues = function (type, exists) {
  const values = exists.filter((value) => {
    if (typeof value === 'string' && value.length === 0) {
      return false
    }

    if (type === 'number' && Math.abs(value) === Infinity) {
      return false
    }

    return true
  }).map((value) => {
    if (internals.isRef(value)) {
      return internals.formatReference(value)
    }

    return JSON.stringify(value)
  })

  return values.length ? values : null
}

internals.capitalize = function (string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

internals.formatPeers = function (condition) {
  if (condition.key) {
    return `Requires ${condition.peers.join(', ')} to ${condition.type === 'with' ? '' : 'not '}be present when ${condition.key} is.`
  }

  return `Requires ${condition.peers.join(` ${condition.type} `)}.`
}

internals.isRef = function (ref) {
  return typeof ref === 'string' && /^(ref|context):.+/.test(ref)
}

internals.formatReference = function (ref) {
  if (ref.startsWith('ref:')) {
    return ref.substr(4)
  }

  return '$' + ref.substr(8)
}

internals.processRuleArgument = function (rule) {
  const arg = rule.arg
  if (rule.name === 'assert') {
    return {
      key: internals.formatReference(arg.ref),
      value: internals.getParamsData(arg.schema)
    }
  } else if (rule.name === 'regex' && arg.pattern) {
    let pattern = arg.pattern

    if (arg.name) {
      pattern += ` (${arg.name})`
    }

    if (arg.invert) {
      pattern += ' - inverted'
    }

    return pattern
  } else if (internals.isRef(arg)) {
    return {
      ref: internals.formatReference(arg)
    }
  }

  return arg || ''
}

internals.processNotes = function (notes) {
  if (!notes) {
    return
  }

  if (!Array.isArray(notes)) {
    return [notes]
  }

  return notes
}

internals.processAuth = function (route) {
  const auth = route.connection.auth.lookup(route)

  /* $lab:coverage:off$ */
  if (auth && (auth.entity || auth.scope)) { // Hapi < 12
    auth.access = [{
      entity: auth.entity,
      scope: {
        selection: auth.scope
      }
    }]
  }
  /* $lab:coverage:on$ */

  return auth
}

module.exports = function (routes, hostname) {
  let routesData = internals.getRoutesData(routes)
  let htmlIndex = templates.index([{info: { uri: hostname }, table: routesData }])

  return function (req, res) {
    let html = req.query && req.query.path
      ? templates.route(internals.getRoutesData(routes.filter((route) => route.url === req.query.path)))
      : htmlIndex

    res.send(html)
  }
}
