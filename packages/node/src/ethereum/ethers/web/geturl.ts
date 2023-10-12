/* eslint-disable */
'use strict';

import http from 'http';
import https from 'https';
import { gunzipSync } from 'zlib';
import { parse } from 'url';
import {
  assert,
  concat,
  getBytes,
  toUtf8Bytes,
} from 'ethers/lib.commonjs/utils';
import type { GetUrlResponse, Options } from './types';

export { GetUrlResponse, Options };

function getResponse(request: http.ClientRequest): Promise<GetUrlResponse> {
  return new Promise((resolve, reject) => {
    request.once('response', (resp: http.IncomingMessage) => {
      const response: GetUrlResponse = {
        statusCode: resp.statusCode,
        statusMessage: resp.statusMessage,
        headers: Object.keys(resp.headers).reduce((accum, name) => {
          let value = resp.headers[name];
          if (Array.isArray(value)) {
            value = value.join(', ');
          }
          accum[name] = value;
          return accum;
        }, <{ [name: string]: string }>{}),
        body: null,
      };
      //resp.setEncoding("utf8");

      resp.on('data', (chunk: Uint8Array) => {
        if (response.body == null) {
          response.body = new Uint8Array(0);
        }
        // TODO unsure if this is correct
        response.body = toUtf8Bytes(concat([response.body, chunk]));
      });

      resp.on('end', () => {
        if (response.headers['content-encoding'] === 'gzip') {
          //const size = response.body.length;
          response.body = getBytes(gunzipSync(response.body));
          //console.log("Delta:", response.body.length - size, Buffer.from(response.body).toString());
        }
        resolve(response);
      });

      resp.on('error', (error) => {
        /* istanbul ignore next */
        (<any>error).response = response;
        reject(error);
      });
    });

    request.on('error', (error) => {
      reject(error);
    });
  });
}

// The URL.parse uses null instead of the empty string
function nonnull(value: string): string {
  if (value == null) {
    return '';
  }
  return value;
}

export async function getUrl(
  href: string,
  options?: Options,
): Promise<GetUrlResponse> {
  if (options == null) {
    options = {};
  }

  // @TODO: Once we drop support for node 8, we can pass the href
  //        directly into request and skip adding the components
  //        to this request object
  const url = parse(href);

  const request = {
    protocol: nonnull(url.protocol),
    hostname: nonnull(url.hostname),
    port: nonnull(url.port),
    path: nonnull(url.pathname) + nonnull(url.search),

    method: options.method || 'GET',
    headers: Object.assign(options.headers || {}),
    agent: null,
  };

  if (options.allowGzip) {
    request.headers['accept-encoding'] = 'gzip';
  }

  let req: http.ClientRequest = null;
  switch (nonnull(url.protocol)) {
    case 'http:':
      if (options?.agents?.http) {
        request.agent = options.agents.http;
      }
      req = http.request(request);
      break;
    case 'https:':
      if (options?.agents?.https) {
        request.agent = options.agents.https;
      }
      req = https.request(request);
      break;
    default:
      /* istanbul ignore next */
      assert(
        {
          protocol: url.protocol,
          operation: 'request',
        },
        `unsupported protocol ${url.protocol}`,
        'UNSUPPORTED_OPERATION',
      );
  }

  if (options.body) {
    req.write(Buffer.from(options.body));
  }
  req.end();

  const response = await getResponse(req);
  return response;
}
