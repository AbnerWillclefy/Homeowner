const ABSOLUTE_URL = /^([a-z][a-z\d+.-]*:|\/\/)/i;

/**
 * Throws for an absolute URL. `allowAbsoluteUrls: false` alone would glue it onto the base URL, so each client
 * calls this first, before anything (a token) is attached to a request that would go elsewhere.
 */
export function refuseAbsoluteUrl(url: string | undefined): void {
  if (url && ABSOLUTE_URL.test(url)) throw new Error(`The API client refuses the absolute URL ${url}`);
}
