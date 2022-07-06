import type { CustomGraphiQLProps, GraphQLParams } from 'interfaces';

/**
 * Ensures string values are safe to be used within a <script> tag.
 */
function safeSerialize(
  data: { [name: string]: unknown } | string | boolean | undefined,
): string {
  return data !== undefined
    ? JSON.stringify(data).replace(/\//g, '\\/')
    : 'undefined';
}

/**
 * Compile time function. @See ./resources/customTransformation.ts
 */
declare function loadFileStaticallyFromNPM(npmPath: string): string;

/**
 * When express-graphql receives a request which does not Accept JSON, but does
 * Accept HTML, it may present GraphiQL, the in-browser GraphQL explorer IDE.
 *
 * When shown, it will be pre-populated with the result of having executed the
 * requested query.
 */
export function renderGraphiQL(
  data: GraphQLParams,
  props: CustomGraphiQLProps,
  polyfill = false,
): string {
  props.query = safeSerialize(data.query);
  props.variables = safeSerialize(data.variables);
  props.operationName = safeSerialize(data.operationName);
  let propsString = '';
  for (const prop in props) {
    if (
      prop !== 'fetcher' &&
      Object.prototype.hasOwnProperty.call(props, prop)
    ) {
      const property = (props as { [key: string]: unknown })[prop];
      propsString = propsString + prop + ': ' + JSON.stringify(property) + ', ';
    }
  }
  let pollyfillScripts = '';
  if (polyfill) {
    pollyfillScripts = `<script>
    // promise-polyfill/dist/polyfill.min.js
    ${loadFileStaticallyFromNPM('promise-polyfill/dist/polyfill.min.js')}
  </script>
  <script>
    // unfetch/dist/unfetch.umd.js
    ${loadFileStaticallyFromNPM('unfetch/dist/unfetch.umd.js')}
  </script>`;
  }

  let subscriptionScript = '';
  if (props.fetcher?.subscriptionUrl !== undefined) {
    subscriptionScript = `<script>
      // graphql-ws/umd/graphql-ws.js
      ${loadFileStaticallyFromNPM('graphql-ws/umd/graphql-ws.js')}
    </script>`;
  }

  return `<!--
The request to this GraphQL server provided the header "Accept: text/html"
and as a result has been presented GraphiQL - an in-browser IDE for
exploring GraphQL.

If you wish to receive JSON, provide the header "Accept: application/json" or
add "&raw" to the end of the URL within a browser.
-->
<!DOCTYPE html>
<html>
  <head>
    <title>GraphiQL</title>
    <meta name="robots" content="noindex" />
    <style>
      body {
        height: 100%;
        margin: 0;
        width: 100%;
        overflow: hidden;
      }
      #graphiql {
        height: 100vh;
      }
    </style>
    <style>
      /* graphiql/graphiql.css */
      ${loadFileStaticallyFromNPM('graphiql/graphiql.min.css')}
    </style>
    ${pollyfillScripts}
    <script>
      // react/umd/react.production.min.js
      ${loadFileStaticallyFromNPM('react/umd/react.production.min.js')}
    </script>
    <script>
      // react-dom/umd/react-dom.production.min.js
      ${loadFileStaticallyFromNPM('react-dom/umd/react-dom.production.min.js')}
    </script>
  </head>

  <body>
    <div id="graphiql">Loading...</div>
    <script>
      // graphiql/graphiql.min.js
      ${loadFileStaticallyFromNPM('graphiql/graphiql.min.js')}
    </script>
    ${subscriptionScript}
    <script>
      ReactDOM.render(
        React.createElement(GraphiQL, {
          fetcher: GraphiQL.createFetcher(${JSON.stringify(props.fetcher)}),
          ${propsString}
          }),
        document.getElementById('graphiql'),
      );
    </script>
  </body>
</html>`;
}
