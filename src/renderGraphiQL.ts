import type { FormattedExecutionResult } from 'graphql';

export interface GraphiQLData {
  query?: string | null;
  variables?: { readonly [name: string]: unknown } | null;
  operationName?: string | null;
  result?: FormattedExecutionResult;
}

export interface GraphiQLOptions {
  /**
   * An optional GraphQL string to use when no query is provided and no stored
   * query exists from a previous session.  If undefined is provided, GraphiQL
   * will use its own default query.
   */
  defaultQuery?: string;

  /**
   * An optional boolean which enables the header editor when true.
   * Defaults to false.
   */
  headerEditorEnabled?: boolean;

  /**
   * An optional boolean which enables headers to be saved to local
   * storage when true.
   * Defaults to false.
   */
  shouldPersistHeaders?: boolean;

  /**
   * A websocket endpoint for subscription
   */
  subscriptionEndpoint?: string;
}

/**
 * Sanitizes values to be used within a <script> tag.
 */
function safeSerialize(data: string | boolean | null | undefined): string {
  return data != null
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
  data: GraphiQLData,
  options?: GraphiQLOptions,
): string {
  const queryString = data.query;
  const variablesString =
    data.variables != null ? JSON.stringify(data.variables, null, 2) : null;
  const resultString =
    data.result != null ? JSON.stringify(data.result, null, 2) : null;
  const operationName = data.operationName;
  const defaultQuery = options?.defaultQuery;
  const headerEditorEnabled = options?.headerEditorEnabled;
  const shouldPersistHeaders = options?.shouldPersistHeaders;
  const subscriptionEndpoint = options?.subscriptionEndpoint;
  let subscriptionScript = '';
  if (subscriptionEndpoint != null) {
    subscriptionScript = `
    <script>
      ${loadFileStaticallyFromNPM('graphql-ws/umd/graphql-ws.js')}
    </script>
    `;
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
    <script>
      // promise-polyfill/dist/polyfill.min.js
      ${loadFileStaticallyFromNPM('promise-polyfill/dist/polyfill.min.js')}
    </script>
    <script>
      // unfetch/dist/unfetch.umd.js
      ${loadFileStaticallyFromNPM('unfetch/dist/unfetch.umd.js')}
    </script>
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
    // Collect the URL parameters
    const parameters = {};
    window.location.search.substr(1).split('&').forEach(function (entry) {
      const eq = entry.indexOf('=');
      if (eq >= 0) {
        parameters[decodeURIComponent(entry.slice(0, eq))] =
          decodeURIComponent(entry.slice(eq + 1));
      }
    });

    // Produce a Location query string from a parameter object.
    function locationQuery(params) {
      return '?' + Object.keys(params).filter(function (key) {
        return Boolean(params[key]);
      }).map(function (key) {
        return encodeURIComponent(key) + '=' +
          encodeURIComponent(params[key]);
      }).join('&');
    }

    /**
     * When the query and variables string are edited, update the URL bar so
     * that it can be easily shared.
     */
     function updateURL() {
      history.replaceState(null, null, locationQuery(parameters));
    }
      ReactDOM.render(
        React.createElement(GraphiQL, {
          fetcher: GraphiQL.createFetcher({
            url: window.location.origin + window.location.pathname,
            subscriptionUrl: ${safeSerialize(subscriptionEndpoint)},
          }),
          defaultVariableEditorOpen: true,
          query: ${safeSerialize(queryString)},
          response: ${safeSerialize(resultString)},
          variables: ${safeSerialize(variablesString)},
          operationName: ${safeSerialize(operationName)},
          defaultQuery: ${safeSerialize(defaultQuery)},
          headerEditorEnabled: ${safeSerialize(headerEditorEnabled)},
          shouldPersistHeaders: ${safeSerialize(shouldPersistHeaders)}
          }),
        document.getElementById('graphiql'),
      );
    </script>
  </body>
</html>`;
}
