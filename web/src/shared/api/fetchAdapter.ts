import axios, { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse } from "axios";

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
  const timeout = config.timeout ? AbortSignal.timeout(config.timeout) : undefined;
  // Axios types `signal` as GenericAbortSignal; in a browser it is always a real AbortSignal.
  const signals = [config.signal as AbortSignal | undefined, timeout].filter((s) => s !== undefined && s !== null);

  let response: Response;
  try {
    response = await fetch(url, {
      ...config.fetchOptions,
      method,
      headers: headers as Record<string, string>,
      body: config.data ?? undefined,
      signal: signals.length > 0 ? AbortSignal.any(signals) : undefined,
    });
  } catch (error) {
    if (timeout?.aborted && !config.signal?.aborted) {
      throw new AxiosError(`timeout of ${config.timeout}ms exceeded`, AxiosError.ECONNABORTED, config);
    }
    throw error;
  }

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
