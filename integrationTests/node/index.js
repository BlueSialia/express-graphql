'use strict';

const assert = require('assert');

const { buildSchema } = require('graphql');

const { request } = require('express');

const { graphqlHTTP } = require('@bluesialia/express-graphql');

const schema = buildSchema('type Query { hello: String }');

const middleware = graphqlHTTP({
  graphiql: true,
  schema,
  rootValue: { hello: 'world' },
});

assert(typeof middleware === 'function');

const req = {
  url: 'http://example.com',
  method: 'GET',
  headers: {},
  body: {
    query: '{ hello }',
  },
  accepts: request.accepts
};

const response = {
  headers: {},
  setHeader(name, value) {
    this.headers[name] = value;
  },
  text: null,
  end(buffer) {
    this.text = buffer.toString();
  },
};

middleware(req, response).then(() => {
  assert.deepStrictEqual(response.headers, {
    'Content-Length': '26',
    'Content-Type': 'application/json; charset=utf-8',
  });
  assert.deepStrictEqual(response.text, '{"data":{"hello":"world"}}');
});
