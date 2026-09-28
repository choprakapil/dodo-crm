[RULE]

# Web Security & Safe Failure Surface

Verify applicable:
- Content-Security-Policy;
- HSTS in production;
- X-Content-Type-Options;
- Referrer-Policy;
- Permissions-Policy;
- frame protection;
- secure cookies;
- CSRF strategy where applicable;
- rate limiting;
- input validation;
- output encoding;
- safe redirect handling.

Error pages must never expose:
- stack traces;
- secrets;
- database details;
- internal filesystem paths;
- tokens;
- provider credentials.

Security configuration must be tested in the deployed environment where possible.
