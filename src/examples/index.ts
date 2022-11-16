import express from 'express';
import { buildSchema } from 'graphql';
import { graphqlHTTP } from '../index.js';

const PORT = 12000;

// Construct a schema, using GraphQL schema language
const schema = buildSchema(`
	type Query {
		hello: String
	}
`);

// The root provides a resolver function for each API endpoint
const rootValue = {
	hello: () => 'Hello world!',
};

const app = express();
app.use(
	'/graphql',
	graphqlHTTP({
		schema,
		rootValue,
		graphiql: true,
	}),
);
app.listen(PORT);
console.log(`Running a GraphQL API server at http://localhost:${PORT}/graphql`);
