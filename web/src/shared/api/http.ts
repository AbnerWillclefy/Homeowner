import axios, { type AxiosInstance, type CreateAxiosDefaults } from "axios";
import { refuseAbsoluteUrl } from "./absoluteUrl";
import { fetchAdapter } from "./fetchAdapter";
import { config } from "../config";

/**
 * An Axios instance on the API's base URL with no interceptors. It accepts every status (callers read
 * `status`, as with fetch). It does not refuse absolute URLs by itself: each client adds that guard as its
 * first step, because `allowAbsoluteUrls: false` alone would glue an absolute URL onto the base URL.
 */
export function createBaseClient(overrides: CreateAxiosDefaults = {}): AxiosInstance {
  return axios.create({
    baseURL: config.apiBaseUrl,
    validateStatus: () => true,
    allowAbsoluteUrls: false,
    adapter: fetchAdapter,
    ...overrides,
  });
}

/** The base client plus the absolute-URL guard, so a call can only reach the API. */
export function createHttpClient(overrides: CreateAxiosDefaults = {}): AxiosInstance {
  const client = createBaseClient(overrides);
  client.interceptors.request.use((request) => {
    refuseAbsoluteUrl(request.url);
    return request;
  });
  return client;
}

/** A plain client for calls that carry no session. */
export const httpClient = createHttpClient();
