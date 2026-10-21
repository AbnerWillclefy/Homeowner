import axios, { AxiosHeaders, type AxiosAdapter, type AxiosResponse } from "axios";

/**
 * An Axios adapter that calls the global `fetch(url, init)` at call time. Axios's own adapters would either
 * bypass a stubbed global fetch (http, in Node) or call `fetch(new Request(...))`; this keeps the call shape
 * `(string, RequestInit)` that the app's tests and Playwright's network fakes already see. It always
 * resolves with the status, so it goes with `validateStatus: () => true`. The body is read as text, so
 * Axios's default `transformResponse` parses JSON and leaves anything else (an HTML page) as a string.
 */
export const fetchAdapter: AxiosAdapter = async (config) => {
  const url = axios.getUri(config);
  const headers = AxiosHeaders.from(config.headers).toJSON();
  const method = (config.method ?? "get").toUpperCase();
  const body = config.data === undefined || config.data === null ? undefined : config.data;

  const response = await fetch(url, {
    ...config.fetchOptions,
    method,
    headers: headers as Record<string, string>,
    body,
    signal: config.signal as AbortSignal | undefined,
  });

  // Axios runs transformResponse on this after the adapter returns.
  const result: AxiosResponse = {
    data: await response.text(),
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    config,
    request: null,
  };
  return result;
};
