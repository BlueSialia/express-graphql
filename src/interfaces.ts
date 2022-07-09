import type { Request, Response } from 'express';
import type {
  DocumentNode,
  ExecutionArgs,
  ExecutionResult,
  FormattedExecutionResult,
  GraphQLError,
  GraphQLFieldResolver,
  GraphQLFormattedError,
  GraphQLSchema,
  GraphQLTypeResolver,
  Source,
  ValidationRule,
} from 'graphql';

type MaybePromise<T> = Promise<T> | T;

type WantedGraphiQLProps =
  | 'query'
  | 'variables'
  | 'headers'
  | 'operationName'
  | 'response'
  | 'defaultQuery'
  | 'defaultVariableEditorOpen'
  | 'defaultSecondaryEditorOpen'
  | 'headerEditorEnabled'
  | 'shouldPersistHeaders'
  | 'editorTheme'
  | 'keyMap'
  | 'introspectionQueryName'
  | 'readOnly'
  | 'docExplorerOpen'
  | 'maxHistoryLength';
type WantedCreateFetcherOptions = 'url' | 'subscriptionUrl' | 'headers';

export type CustomGraphiQLProps = Pick<GraphiQLProps, WantedGraphiQLProps> & {
  fetcher?: Partial<Pick<CreateFetcherOptions, WantedCreateFetcherOptions>>;
};

/**
 * Used to configure the graphqlHTTP middleware by providing a schema
 * and other configuration options.
 *
 * Options can be provided as an Object, a Promise for an Object, or a Function
 * that returns an Object or a Promise for an Object.
 */
export type ProvidedOptions =
  | ((
      request: Request,
      response: Response,
      params?: GraphQLParams,
    ) => MaybePromise<UserOptions>)
  | MaybePromise<UserOptions>;

interface Options {
  /**
   * A `GraphQLSchema` instance from [`GraphQL.js`](https://github.com/graphql/graphql-js/blob/main/src/type/schema.ts#L135).
   *
   * A `schema` _must_ be provided.
   */
  schema: GraphQLSchema;

  /**
   * A boolean to optionally enable [GraphiQL](https://github.com/graphql/graphiql/tree/main/packages/graphiql) when the GraphQL endpoint is loaded in a browser.
   * Alternatively, instead of `true` you can pass in a {@link GraphiQLProps} object.
   */
  graphiql: boolean | CustomGraphiQLProps;

  /**
   * A value to pass as the `rootValue` to the `execute()` function from [`GraphQL.js/src/execution/execute.ts`](https://github.com/graphql/graphql-js/blob/main/src/execution/execute.ts#148).
   */
  rootValue?: unknown;

  /**
   * A value to pass as the `contextValue` to the `execute()` function from [`GraphQL.js/src/execution/execute.ts`](https://github.com/graphql/graphql-js/blob/main/src/execution/execute.ts#L149).
   *
   * If `context` is not provided, the `request` object is passed as the context.
   */
  context: unknown;

  /**
   * A boolean to configure whether the output should be pretty-printed.
   */
  pretty: boolean;

  /**
   * An optional function for adding additional metadata to the GraphQL response
   * as a key-value object. The result will be added to "extensions" field in
   * the resulting JSON. This is often a useful place to add development time
   * info such as the runtime of a query or the amount of resources consumed.
   *
   * Information about the request is provided to be used.
   *
   * This function may be async.
   */
  extensions?: (
    info: RequestInfo,
  ) => MaybePromise<undefined | { [key: string]: unknown }>;

  /**
   * An optional array of validation rules that will be applied on the document in addition to those defined by the GraphQL spec.
   */
  validationRules: ReadonlyArray<ValidationRule>;

  /**
   * An optional function which will be used to validate instead of default `validate` from `graphql-js`.
   */
  validateFn: (
    schema: GraphQLSchema,
    documentAST: DocumentNode,
    rules: ReadonlyArray<ValidationRule>,
  ) => ReadonlyArray<GraphQLError>;

  /**
   * An optional function which will be used to execute instead of default `execute` from `graphql-js`.
   */
  executeFn: (args: ExecutionArgs) => MaybePromise<ExecutionResult>;

  /**
   * An optional function which will be used to format any errors produced by
   * fulfilling a GraphQL operation. If no function is provided, GraphQL's
   * default function will be used.
   */
  formatErrorFn?: (error: GraphQLError) => GraphQLFormattedError;

  /**
   * An optional function which will be used to create a document instead of
   * the default `parse` from `graphql-js`.
   */
  parseFn: (source: Source) => DocumentNode;

  /**
   * A resolver function to use when one is not provided by the schema.
   * If not provided, the default field resolver is used (which looks for a
   * value or method on the source value with the field's name).
   */
  fieldResolver?: GraphQLFieldResolver<unknown, unknown>;

  /**
   * A type resolver function to use when none is provided by the schema.
   * If not provided, the default type resolver is used (which looks for a
   * `__typename` field or alternatively calls the `isTypeOf` method).
   */
  typeResolver?: GraphQLTypeResolver<unknown, unknown>;
}

type NotRequiredByUsers =
  | 'graphiql'
  | 'context'
  | 'pretty'
  | 'validationRules'
  | 'validateFn'
  | 'executeFn'
  | 'parseFn';

export type UserOptions = Partial<Pick<Options, NotRequiredByUsers>> &
  Omit<Options, NotRequiredByUsers>;

export type UsableOptions = Omit<Options, 'graphiql'> & {
  graphiql: Exclude<Options['graphiql'], boolean>;
};

/**
 * All information about a GraphQL request.
 */
export interface RequestInfo {
  /**
   * The parsed GraphQL document.
   */
  document: DocumentNode;

  /**
   * The variable values used at runtime.
   */
  variables?: { readonly [name: string]: unknown };

  /**
   * The (optional) operation name requested.
   */
  operationName?: string;

  /**
   * The result of executing the operation.
   */
  result: FormattedExecutionResult;

  /**
   * A value to pass as the context to the graphql() function.
   */
  context?: unknown;
}

export interface GraphQLParams {
  query?: string;
  variables?: { readonly [name: string]: unknown };
  operationName?: string;
  raw: boolean;
}

/**
 * Obtained from graphiql.
 * API docs for this live here:
 *
 * https://graphiql-test.netlify.app/typedoc/modules/graphiql.html#graphiqlprops
 */
export type GraphiQLProps = {
  /**
   * Required. A function which accepts GraphQL-HTTP parameters and returns a Promise, Observable or AsyncIterable
   * which resolves to the GraphQL parsed JSON response.
   *
   * We suggest using `@graphiql/toolkit` `createGraphiQLFetcher()` to cover most implementations,
   * including custom headers, websockets and even incremental delivery for @defer and @stream.
   *
   * [`GraphiQL Create Fetcher documentation`](https://graphiql-test.netlify.app/typedoc/modules/graphiql-toolkit.html#fetcher)
   *  **Required.**
   */
  fetcher: unknown;
  /**
   * Optionally provide the `GraphQLSchema`. If present, GraphiQL skips schema introspection.
   */
  schema?: GraphQLSchema;
  /**
   * An array of graphql ValidationRules
   */
  validationRules?: ValidationRule[];
  /**
   * Optionally provide the query in a controlled-component manner. This will override the user state.
   *
   * If you just want to provide a different initial query, use `defaultQuery`
   */
  query?: string;
  /**
   * Same as above. provide a json string that controls the present variables editor state.
   */
  variables?: string;
  /**
   * provide a json string that controls the headers editor state
   */
  headers?: string;
  /**
   * The operationName to use when executing the current operation.
   * Overrides the dropdown when multiple operations are present.
   */
  operationName?: string;
  /**
   * provide a json string that controls the results editor state
   */
  response?: string;
  /**
   * Provide a custom storage API, as an alternative to localStorage.
   * [`Storage`](https://graphiql-test.netlify.app/typedoc/interfaces/graphiql.storage.html
   * default: StorageAPI
   */
  storage?: unknown;
  /**
   * The defaultQuery present when the editor is first loaded
   * and the user has no local query editing state
   * @default "A really long graphql # comment that welcomes you to GraphiQL"
   */
  defaultQuery?: string;
  /**
   * Should the variables editor be open by default?
   * default: true
   */
  defaultVariableEditorOpen?: boolean;
  /**
   * Should the "secondary editor" that contains both headers or variables be open by default?
   * default: true
   */
  defaultSecondaryEditorOpen?: boolean;
  /**
   * Should the headers editor even be enabled?
   * Note that you can still pass custom headers in the fetcher
   * default: true
   */
  headerEditorEnabled?: boolean;
  /**
   * Should user header changes be persisted to localStorage?
   * default: false
   */
  shouldPersistHeaders?: boolean;
  /**
   * Provide an array of fragment nodes or a string to append to queries,
   * and for validation and completion
   */
  externalFragments?: string | unknown[];
  /**
   * Handler for when a user copies a query
   */
  onCopyQuery?: (query?: string) => void;
  /**
   * Handler for when a user edits a query.
   */
  onEditQuery?: (query?: string, documentAST?: DocumentNode) => void;
  /**
   * Handler for when a user edits variables.
   */
  onEditVariables?: (value: string) => void;
  /**
   * Handler for when a user edits headers.
   */
  onEditHeaders?: (value: string) => void;
  /**
   * Handler for when a user edits operation names
   */
  onEditOperationName?: (operationName: string) => void;
  /**
   * Handler for when the user toggles the doc pane
   */
  onToggleDocs?: (docExplorerOpen: boolean) => void;
  /**
   * A custom function to determine which field leafs are automatically
   * added when fill leafs command is used
   */
  getDefaultFieldNames?: unknown;
  /**
   * The CodeMirror 5 editor theme you'd like to use
   *
   */
  editorTheme?: string;
  /**
   * The CodeMirror 5 editor keybindings you'd like to use
   *
   * Note: may be deprecated for monaco
   *
   * See: https://codemirror.net/5/doc/manual.html#option_keyMap
   *
   * @default 'sublime'
   */
  keyMap?: 'sublime' | 'emacs' | 'vim';
  /**
   * On history pane toggle event
   */
  onToggleHistory?: (historyPaneOpen: boolean) => void;
  /**
   * Custom results tooltip component
   */
  ResultsTooltip?: unknown;
  /**
   * decide whether schema responses should be validated.
   *
   * default: false
   */
  dangerouslyAssumeSchemaIsValid?: boolean;
  /**
   * Enable new introspectionQuery option `inputValueDeprecation`
   * DANGER: your server must be configured to support this new feature,
   * or else introspection will fail with an invalid query
   *
   * default: false
   */
  inputValueDeprecation?: boolean;
  /**
   * Enable new introspectionQuery option `schemaDescription`, which expects the `__Schema.description` field
   * DANGER: your server must be configured to support a `__Schema.description` field on
   * introspection or it will fail with an invalid query.
   *
   * default: false
   */
  schemaDescription?: boolean;
  /**
   * OperationName to use for introspection queries
   *
   * default: false
   *
   */
  introspectionQueryName?: string;
  /**
   * Set codemirror editors to readOnly state
   */
  readOnly?: boolean;
  /**
   * Toggle the doc explorer state by default/programmatically
   *
   * default: false
   */
  docExplorerOpen?: boolean;
  /**
   * Custom toolbar configuration
   */
  toolbar?: unknown;
  /**
   * Max query history to retain
   * default: 20
   */
  maxHistoryLength?: number;
  /**
   * Callback that is invoked once a remote schema has been fetched.
   */
  onSchemaChange?: (schema: GraphQLSchema) => void;
  /**
   * Content to place before the top bar (logo).
   */
  beforeTopBarContent?: unknown;

  /**
   * Whether tabs should be enabled.
   * default: false
   */
  tabs?:
    | boolean
    | {
        /**
         * Callback that is invoked onTabChange.
         */
        onTabChange?: (tab: unknown) => void;
      };

  children?: unknown;
};

/**
 * Obtained from @graphiql/toolkit.
 * Options for creating a simple, spec-compliant GraphiQL fetcher
 */
export interface CreateFetcherOptions {
  /**
   * url for HTTP(S) requests. required!
   */
  url: string;
  /**
   * url for websocket subscription requests
   */
  subscriptionUrl?: string;
  /**
   * `wsClient` implementation that matches `ws-graphql` signature,
   * whether via `createClient()` itself or another client.
   */
  wsClient?: unknown;
  /**
   * `legacyWsClient` implementation that matches `subscriptions-transport-ws` signature,
   * whether via `new SubcriptionsClient()` itself or another client with a similar signature.
   */
  legacyWsClient?: unknown;
  /**
   * alias for `legacyWsClient`
   */
  legacyClient?: unknown;
  /**
   * Headers you can provide statically.
   *
   * If you enable the headers editor and the user provides
   * A header you set statically here, it will be overriden by their value.
   */
  headers?: Record<string, string>;
  /**
   * Websockets connection params used when you provide subscriptionUrl. graphql-ws `ClientOptions.connectionParams`
   */
  wsConnectionParams?: unknown;
  /**
   * You can disable the usage of the `fetch-multipart-graphql` library
   * entirely, defaulting to a simple fetch POST implementation.
   */
  enableIncrementalDelivery?: boolean;
  /**
   * The fetch implementation, in case the user needs to override this for SSR
   * or other purposes. this does not override the `fetch-multipart-graphql`
   * default fetch behavior yet.
   */
  fetch?: unknown;
  /**
   * An optional custom fetcher specifically for your schema. For most cases
   * the `url` and `headers` property should have you covered.
   */
  schemaFetcher?: unknown;
}
