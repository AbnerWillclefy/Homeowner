import axios, { type AxiosInstance, type CreateAxiosDefaults } from "axios";
import { refuseAbsoluteUrl } from "./absoluteUrl";
import { fetchAdapter } from "./fetchAdapter";
import { config } from "../config";

/**
 * An Axios instance on the API's base URL. It accepts every status (callers read `status`, as with fetch) and
 * refuses absolute URLs, so a call can only reach the API. `allowAbsoluteUrls: false` alone would glue an
 * absolute URL onto the base URL, so the guard interceptor throws before the request is sent.
 */
export function createHttpClient(overrides: CreateAxiosDefaults = {}): AxiosInstance {
  const client = axios.create({
    baseURL: config.apiBaseUrl,
    validateStatus: () => true,
    allowAbsoluteUrls: false,
    adapter: fetchAdapter,
    ...overrides,
  });
  client.interceptors.request.use((request) => {
    refuseAbsoluteUrl(request.url);
    return request;
  });
  return client;
}

/** A plain client for calls that carry no session. */
export const httpClient = createHttpClient();
