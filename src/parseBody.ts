import type { ParsedMediaType } from 'content-type';
import contentType from 'content-type';
import type { Request } from 'express';
import httpError from 'http-errors';
import type { Gunzip, Inflate } from 'zlib';
import zlib from 'zlib';

/**
 * Provided a "Request" provided by express or connect (typically a node style
 * HTTPClientRequest), Promise the body data contained.
 */
export async function parseBody(
	req: Request,
): Promise<{ [param: string]: unknown }> {
	const { body } = req;

	// If express has already parsed a body as a keyed object, use it.
	if (typeof body === 'object' && !(body instanceof Buffer)) {
		return body as { [param: string]: unknown };
	}

	// Skip requests without content types.
	if (req.headers['content-type'] === undefined) {
		return {};
	}

	const typeInfo = contentType.parse(req);

	// If express has already parsed a body as a string, and the content-type
	// was application/graphql, parse the string body.
	if (typeof body === 'string' && typeInfo.type === 'application/graphql') {
		return { query: body };
	}

	// Already parsed body we didn't recognise? Parse nothing.
	if (body !== undefined) {
		return {};
	}

	const rawBody = await readBody(req, typeInfo);
	// Use the correct body parser based on Content-Type header.
	switch (typeInfo.type) {
		case 'application/graphql':
			return { query: rawBody };
		case 'application/json':
			if (jsonObjRegex.test(rawBody)) {
				try {
					return JSON.parse(rawBody);
				} catch {
					// Do nothing
				}
			}
			throw httpError(400, 'POST body sent invalid JSON.');
		case 'application/x-www-form-urlencoded':
			return Array.from(new URLSearchParams(rawBody).entries()).reduce(
				(previous: { [param: string]: unknown }, current: [string, string]) => {
					previous[current[0]] = current[1];
					return previous;
				},
				{},
			);
	}

	// If no Content-Type header matches, parse nothing.
	return {};
}

/**
 * RegExp to match an Object-opening brace "{" as the first non-space
 * in a string. Allowed whitespace is defined in RFC 7159:
 *
 *     ' '   Space
 *     '\t'  Horizontal tab
 *     '\n'  Line feed or New line
 *     '\r'  Carriage return
 */
const jsonObjRegex = /^[ \t\n\r]*\{/;

/**
 * Read and parse a request body.
 * @param req
 * @param typeInfo
 * @returns
 */
async function readBody(
	req: Request,
	typeInfo: ParsedMediaType,
): Promise<string> {
	const charset = typeInfo.parameters['charset']?.toLowerCase() ?? 'utf-8';

	// Assert charset encoding per JSON RFC 7159 sec 8.1
	if (charset !== 'utf8' && charset !== 'utf-8' && charset !== 'utf16le') {
		throw httpError(415, `Unsupported charset "${charset.toUpperCase()}".`);
	}

	return decompressed(req, charset);
}

/**
 * Checks if a request is compressed and decompresses it into a string.
 * @param req Request to decompress.
 * @param charset Charset to use when parsing the request into a string.
 * @returns The request in String form.
 */
async function decompressed(
	req: Request,
	charset: BufferEncoding = 'utf-8',
	maxSize: number = 100 * 1024, // 100 KB
): Promise<string> {
	let stream: Request | Inflate | Gunzip;
	const encoding = req.headers['content-encoding']?.toLocaleLowerCase();
	switch (encoding) {
		case undefined:
		case 'identity':
			stream = req;
			break;
		case 'deflate':
			stream = req.pipe(zlib.createInflate());
			break;
		case 'gzip':
			stream = req.pipe(zlib.createGunzip());
			break;
		default:
			throw httpError(415, `Unsupported content-encoding "${encoding}".`);
	}
	const chunks = [];
	let size = 0;
	for await (const chunk of stream) {
		size += chunk.byteLength;
		if (size > maxSize)
			throw httpError(413, 'Invalid body: request entity too large.');
		chunks.push(Buffer.from(chunk));
	}
	return Buffer.concat(chunks).toString(charset);
}
