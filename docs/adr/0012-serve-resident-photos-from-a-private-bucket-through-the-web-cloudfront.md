# Serve Resident photos from a private bucket through the web CloudFront under unguessable keys

A Resident can have a photo that housemates see as an avatar (epic #211). Avatars appear on every screen of a Home, so they must load fast from a cache, cost almost nothing, and fit the budget of [ADR 0002](0002-mirror-the-work-stack.md): nothing that bills while idle. The photo must not sit in the database (it would bloat Neon's free tier and every query), and the Lambda should not carry image bytes.

## Decision

Photos live in a **private S3 bucket**, `homeowner-<env>-photos-<account id>`, with public access blocked and server-side encryption. The **existing web CloudFront distribution** serves them under `/avatars/*` as a second origin, through Origin Access Control, using the same managed cache and security-header policies as the app. The bucket policy lets only that distribution read, and only the `avatars/` prefix, so nothing under `pending/` is ever served.

- **Keys are random and unguessable**, at least 128 bits: `avatars/<random>.<webp|jpg>`. The URL is the capability.
- **Uploads go by presigned PUT.** The API signs a URL for `pending/<userId>/<random>`; the browser sends the file straight to S3 (the bucket's CORS allows `PUT` from the web origin only). The API then promotes a confirmed upload by copying it to `avatars/` and deleting the pending object. Unconfirmed uploads expire after one day by a lifecycle rule.
- **The API role gets exactly the object permissions it needs**: put, get and delete on `pending/*`, put and delete on `avatars/*`, and no `s3:ListBucket`. The scheduled job's role gets none.
- Images are read from the web origin itself, so they need no CORS and no second domain.

## Alternatives rejected

- **Signed URLs or signed cookies.** They need a CloudFront key pair to manage and rotate, and a URL that changes on every read defeats the browser and CDN cache. The epic puts per-viewer access control out of scope.
- **An API proxy** (the Lambda reads S3 and streams the image). It costs Lambda time and egress for every image view and there is no CDN cache in front of it.
- **A separate distribution.** A second domain, CORS for any canvas use of the image, and more Terraform for no gain over a path on the distribution that already exists.
- **Public-read objects.** Account-wide policy blocks public buckets, and they would expose the whole bucket instead of one prefix.

## Consequences

- **Anyone holding a photo URL can view it.** The key is unguessable, not secret. A URL shared outside the Home keeps working until the object is removed.
- **Removal is eventually consistent.** Deleting an object does not purge CloudFront; the cached copy lives up to the cache policy's default lifetime (one day). We do not issue invalidations, which keeps it free. A replaced photo gets a new key, so only a deletion has this delay.
- **JPEG is accepted next to WebP**, because Safari's canvas cannot encode WebP and the PWA resizes photos in a canvas before uploading.
- **A missing avatar answers 200 with HTML.** Without `s3:ListBucket`, S3 answers 403 for a missing key, and the distribution-wide `custom_error_response` for 403 and 404 (the SPA fallback) then serves `index.html` with status 200. An `<img>` cannot decode it and fires `onerror`, so the Avatar component must fall back on `onerror`, not on the status. CloudFront cannot scope error responses to one behaviour without a Lambda@Edge or CloudFront Function, which we do not add for cost and complexity. For the same reason the API cannot tell a missing pending object (403) from a forbidden one.
- **Pending objects cost nothing beyond a day** of storage.
- **Cost is cents a month**: a few hundred objects of about 100 KB are fractions of a cent, and requests and transfer fit the free tier. The new bucket, Origin Access Control and behaviour bill nothing while idle.
- **Deploying needs the bootstrap grant** from #228: the deploy roles can create `homeowner-<env>-photos-*` buckets only after a human re-applies `infra/bootstrap`.
