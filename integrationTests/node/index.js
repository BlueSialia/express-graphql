'use strict';

import { graphqlHTTP } from '@bluesialia/express-graphql';
import assert from 'assert';
import { request } from 'express';
import { buildSchema } from 'graphql';

const schema = buildSchema('type Query { hello: String }');

const middleware = graphqlHTTP({
	graphiql: true,
	pretty: true,
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
	accepts: request.accepts,
};

const res = {
	headers: {},
	setHeader(name, value) {
		this.headers[name] = value;
	},
	text: null,
	end(buffer) {
		this.text = buffer.toString();
	},
};

middleware(req, res).then(() => {
	assert.deepStrictEqual(res.headers, {
		'Content-Length': '40',
		'Content-Type': 'application/json; charset=utf-8',
	});
	assert.deepStrictEqual(
		res.text,
		'{\n  "data": {\n    "hello": "world"\n  }\n}',
	);
});
