import axios from "axios";
import { refuseAbsoluteUrl } from "./absoluteUrl";
import { fetchAdapter } from "./fetchAdapter";
import { config } from "../config";

/**
 * A plain Axios instance on the API's base URL, for calls that carry no session. It accepts every status, like
 * the authed client, and refuses absolute URLs, so a call can only reach the API.
 */
export const httpClient = axios.create({
  baseURL: config.apiBaseUrl,
  validateStatus: () => true,
  allowAbsoluteUrls: false,
  adapter: fetchAdapter,
});

httpClient.interceptors.request.use((request) => {
  refuseAbsoluteUrl(request.url);
  return request;
});
