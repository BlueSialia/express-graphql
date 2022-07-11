import type { Request, Response } from 'express';
import type {
	DocumentNode,
	ExecutionResult,
	FormattedExecutionResult,
} from 'graphql';
import {
	execute,
	getOperationAST,
	GraphQLError,
	parse,
	Source,
	specifiedRules,
	validate,
	validateSchema,
} from 'graphql';
import httpError from 'http-errors';
import type {
	CustomGraphiQLProps,
	GraphQLParams,
	ProvidedOptions,
	UsableOptions,
	UserOptions,
} from 'interfaces';
import { parseBody } from 'parseBody';
import { renderGraphiQL } from 'renderGraphiQL';

export * from 'interfaces';

/**
 * Middleware for express; takes an options object or function as input to
 * configure behavior, and returns an express middleware.
 */
export function graphqlHTTP(
	options: ProvidedOptions,
): (request: Request, response: Response) => Promise<void> {
	devAssertIsNonNullable(options, 'GraphQL middleware requires options.');

	return async function graphqlMiddleware(
		request: Request,
		response: Response,
	): Promise<void> {
		let params: GraphQLParams;
		let userOptions: UserOptions;
		let finalOptions!: UsableOptions;
		let showGraphiQL: boolean;
		let result: ExecutionResult = {};

		try {
			// Initialize variables.
			if (typeof options !== 'function') userOptions = await options;
			else userOptions = await options(request, response);
			finalOptions = resolveOptions(userOptions, request);
			params = await getGraphQLParams(request);
			if (typeof options === 'function')
				userOptions = await options(request, response, params);
			finalOptions = resolveOptions(userOptions, request);
			const { query, variables, operationName } = params;

			showGraphiQL =
				canDisplayGraphiQL(request, params) && Boolean(userOptions.graphiql);

			// GraphQL HTTP only supports GET and POST methods.
			if (request.method !== 'GET' && request.method !== 'POST') {
				throw httpError(405, 'GraphQL only supports GET and POST requests.', {
					headers: { Allow: 'GET, POST' },
				});
			}

			// If allowed to show GraphiQL, present it instead of JSON.
			if (showGraphiQL) {
				return respondWithGraphiQL(response, params, finalOptions.graphiql);
			}

			// If there is no query return a 400: Bad Request.
			if (query === undefined) {
				throw httpError(400, 'Must provide query string.');
			}

			// Validate Schema
			const schemaValidationErrors = validateSchema(finalOptions.schema);
			if (schemaValidationErrors.length > 0) {
				// Return 500: Internal Server Error if invalid schema.
				response.statusCode = 500;
				throw schemaValidationErrors;
			}

			// Parse source to AST, reporting any syntax error.
			let documentAST: DocumentNode;
			try {
				documentAST = finalOptions.parseFn(
					new Source(query, 'GraphQL request'),
				);
			} catch (syntaxError: unknown) {
				// Return 400: Bad Request if any syntax errors exist.
				response.statusCode = 400;
				throw syntaxError;
			}

			// Validate AST, reporting any errors.
			const validationErrors = finalOptions.validateFn(
				finalOptions.schema,
				documentAST,
				[...specifiedRules, ...finalOptions.validationRules],
			);
			if (validationErrors.length > 0) {
				// Return 400: Bad Request if any validation errors exist.
				response.statusCode = 400;
				throw validationErrors;
			}

			// Only query operations are allowed on GET requests.
			if (request.method === 'GET') {
				// Determine if this GET request will perform a non-query.
				const operationAST = getOperationAST(documentAST, operationName);
				if (operationAST && operationAST.operation !== 'query') {
					// If GraphiQL can be shown, do not perform this query, but
					// provide it to GraphiQL so that the requester may perform it
					// themselves if desired.
					if (showGraphiQL)
						return respondWithGraphiQL(response, params, finalOptions.graphiql);

					// Otherwise, report a 405: Method Not Allowed error.
					throw httpError(
						405,
						`Can only perform a ${operationAST.operation} operation from a POST request.`,
						{ headers: { Allow: 'POST' } },
					);
				}
			}

			// Perform the execution, reporting any errors creating the context.
			try {
				result = await finalOptions.executeFn({
					schema: finalOptions.schema,
					document: documentAST,
					rootValue: finalOptions.rootValue,
					contextValue: finalOptions.context,
					variableValues: variables,
					operationName,
					fieldResolver: finalOptions.fieldResolver,
					typeResolver: finalOptions.typeResolver,
				});
			} catch (contextError: unknown) {
				// Return 400: Bad Request if any execution context errors exist.
				response.statusCode = 400;
				throw contextError;
			}

			// Collect and apply any metadata extensions if a function was provided.
			// https://graphql.github.io/graphql-spec/#sec-Response-Format
			if (finalOptions.extensions) {
				const extensions = await finalOptions.extensions({
					document: documentAST,
					variables,
					operationName,
					result,
					context: finalOptions.context,
				});

				if (extensions !== undefined) {
					result = { ...result, extensions };
				}
			}

			// If no data was included in the result, that indicates a runtime query
			// error, indicate as such with a generic status code.
			// Note: Information about the error itself will still be contained in
			// the resulting JSON payload.
			// https://graphql.github.io/graphql-spec/#sec-Data
			if (response.statusCode === 200 && result.data == null) {
				response.statusCode = 500;
			}
		} catch (error: unknown) {
			const errors = error instanceof Array ? error : [error];

			// Transform into GraphQLFormattedError.
			result.errors = errors.map((error) => {
				let status: number;
				if (error instanceof GraphQLError) {
					status = (error.originalError as httpError.HttpError)?.status ?? 500;
				} else if (error instanceof httpError.HttpError) {
					status = error.status;
					if (error.headers !== undefined) {
						for (const [key, value] of Object.entries(error.headers)) {
							response.setHeader(key, String(value));
						}
					}
					error = new GraphQLError(error.message, {
						originalError: error as Error,
					});
				} else if (error instanceof Error) {
					status = 500;
					error = httpError(500, error);
					error = new GraphQLError(error.message, {
						originalError: error as Error,
					});
				} else {
					status = 500;
					error = httpError(500, String(error));
					error = new GraphQLError(error.message, {
						originalError: error as Error,
					});
				}

				// Ensure code is an error code.
				if (response.statusCode === undefined || response.statusCode < 400) {
					response.statusCode = status;
				}

				return error;
			});
		}

		const formattedResult: FormattedExecutionResult = {
			...result,
			errors: result.errors?.map((error) => {
				return finalOptions?.formatErrorFn !== undefined
					? finalOptions.formatErrorFn(error)
					: (error as GraphQLError).toJSON();
			}),
		};

		// If "pretty" JSON isn't requested, use response.json method.
		// Otherwise use the simplified sendResponse method.
		if (typeof finalOptions !== 'undefined' && finalOptions.pretty === true) {
			return sendResponse(
				response,
				'application/json',
				JSON.stringify(formattedResult, null, 2),
			);
		} else {
			response.json(formattedResult);
			return;
		}
	};
}

function resolveOptions(options: UserOptions, request: Request): UsableOptions {
	const mutableOptions = { ...options };

	devAssertIsObject(
		options,
		'GraphQL middleware option function must return an options object or a promise which will be resolved to an options object.',
	);

	devAssertIsObject(
		mutableOptions.schema,
		'GraphQL middleware options must contain a schema.',
	);

	const defaultGraphiqlOptions = {
		fetcher: {
			url:
				request.protocol +
				'://' +
				(request.headers['x-forwarded-host'] ?? request.headers.host) +
				request.originalUrl?.split('?')[0],
		},
	};

	if (
		typeof mutableOptions.graphiql === 'boolean' ||
		mutableOptions.graphiql === undefined
	) {
		mutableOptions.graphiql = defaultGraphiqlOptions;
	} else {
		devAssertIsObject(
			mutableOptions.graphiql,
			'GraphiQL options must be either a boolean or an object.',
		);
		mutableOptions.graphiql = {
			...mutableOptions.graphiql,
			...{
				fetcher: {
					...defaultGraphiqlOptions.fetcher,
					...mutableOptions.graphiql.fetcher,
				},
			},
		};
	}

	return {
		schema: mutableOptions.schema,
		graphiql: mutableOptions.graphiql,
		rootValue: mutableOptions.rootValue,
		context: mutableOptions.context ?? request,
		pretty: mutableOptions.pretty ?? false,
		extensions: mutableOptions.extensions,
		validationRules: mutableOptions.validationRules ?? [],
		validateFn: mutableOptions.validateFn ?? validate,
		executeFn: mutableOptions.executeFn ?? execute,
		formatErrorFn: mutableOptions.formatErrorFn,
		parseFn: mutableOptions.parseFn ?? parse,
		fieldResolver: mutableOptions.fieldResolver,
		typeResolver: mutableOptions.typeResolver,
	};
}

function respondWithGraphiQL(
	response: Response,
	params: GraphQLParams,
	options: CustomGraphiQLProps,
): void {
	const payload = renderGraphiQL(params, options);
	return sendResponse(response, 'text/html', payload);
}

/**
 * Provided a "Request" provided by express, Promise the GraphQL request parameters.
 */
export async function getGraphQLParams(
	request: Request,
): Promise<GraphQLParams> {
	const urlData = new URLSearchParams(request.url.split('?')[1]);
	const bodyData = await parseBody(request);

	// GraphQL Query string.
	let query = urlData.get('query') ?? bodyData['query'];
	if (typeof query !== 'string') {
		query = undefined;
	}

	// Parse the variables if needed.
	let variables = urlData.get('variables') ?? bodyData['variables'];
	if (typeof variables === 'string') {
		try {
			variables = JSON.parse(variables);
		} catch {
			throw httpError(400, 'Variables are invalid JSON.');
		}
	} else if (typeof variables !== 'object') {
		variables = undefined;
	}

	// Name of GraphQL operation to execute.
	let operationName = urlData.get('operationName') ?? bodyData['operationName'];
	if (typeof operationName !== 'string') {
		operationName = undefined;
	}

	const raw = urlData.get('raw') !== null || bodyData['raw'] !== undefined;

	return {
		query: query as string,
		variables: variables as { [name: string]: unknown },
		operationName: operationName as string,
		raw,
	};
}

/**
 * Helper function to determine if GraphiQL can be displayed.
 */
function canDisplayGraphiQL(request: Request, params: GraphQLParams): boolean {
	// If `raw` false, GraphiQL mode is not enabled.
	// Allowed to show GraphiQL if not requested as raw and this request prefers HTML over JSON.
	return params.raw === false && request.accepts(['json', 'html']) === 'html';
}

/**
 * Helper function for sending a response using only the core Node server APIs.
 */
function sendResponse(response: Response, type: string, data: string): void {
	const chunk = Buffer.from(data, 'utf8');
	response.setHeader('Content-Type', type + '; charset=utf-8');
	response.setHeader('Content-Length', String(chunk.length));
	response.end(chunk);
}

function devAssertIsObject(value: unknown, message: string): void {
	devAssert(value != null && typeof value === 'object', message);
}

function devAssertIsNonNullable(value: unknown, message: string): void {
	devAssert(value != null, message);
}

function devAssert(condition: unknown, message: string): void {
	const booleanCondition = Boolean(condition);
	if (booleanCondition === false) {
		throw new TypeError(message);
	}
}
