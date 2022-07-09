import { roots, rootValue, schema } from 'examples/schema';
import express from 'express';
import { execute, subscribe } from 'graphql';
import { useServer } from 'graphql-ws/lib/use/ws';
import { createServer } from 'http';
import { graphqlHTTP } from 'index';
import { WebSocketServer } from 'ws';

const PORT = 12000;
const subscriptionUrl = `ws://localhost:${PORT}/subscriptions`;

const app = express();
app.use(
  '/graphql',
  graphqlHTTP({
    schema,
    rootValue,
    graphiql: {
      fetcher: {
        url: `http://localhost:${PORT}/graphql`,
        subscriptionUrl,
      },
    },
  }),
);

const server = createServer(app);

const wsServer = new WebSocketServer({
  server,
  path: '/subscriptions',
});

server.listen(PORT, () => {
  useServer(
    {
      schema,
      roots,
      execute,
      subscribe,
    },
    wsServer,
  );
  console.info(
    `Running a GraphQL API server with subscriptions at http://localhost:${PORT}/graphql`,
  );
});
