import { buildSchema } from 'graphql';

// eslint-disable-next-line import/no-unresolved, node/no-missing-import
import { graphqlHTTP, RequestInfo } from '@bluesialia/express-graphql';

const schema = buildSchema('type Query { hello: String }');

const validationRules = [
	() => ({ Field: () => false }),
	() => ({ Variable: () => true }),
];

graphqlHTTP({
	graphiql: true,
	schema,
	formatErrorFn: (error: Error) => ({
		message: error.message,
	}),
	validationRules,
	extensions: () => ({
		key: 'value',
		key2: 'value',
	}),
});

graphqlHTTP((request: { headers: any }) => ({
	graphiql: true,
	schema,
	context: request.headers,
	validationRules,
}));

graphqlHTTP(async (request: { headers: any }) => ({
	graphiql: true,
	schema: await Promise.resolve(schema),
	context: request.headers,
	extensions: (_args: RequestInfo) => ({}),
	validationRules,
}));
