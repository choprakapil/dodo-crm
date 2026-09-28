[RULE]

# Master Website Completeness Checklist

A website is not complete until every applicable item has evidence.

## Product
- [ ] Goals and primary conversions defined
- [ ] Personas/use cases defined
- [ ] Non-goals defined
- [ ] Content ownership defined

## Information Architecture
- [ ] Route map complete
- [ ] URL policy frozen
- [ ] Navigation hierarchy defined
- [ ] Internal linking defined
- [ ] Search/filter behavior defined where applicable

## Design
- [ ] Bespoke visual direction approved
- [ ] Typography system
- [ ] Spacing/grid system
- [ ] Color/accessibility tokens
- [ ] Media/art-direction system
- [ ] Motion system
- [ ] Reduced-motion system
- [ ] Responsive compositions
- [ ] No generic card/gradient repetition
- [ ] Loading/empty/error states match brand

## Frontend
- [ ] Components reusable by behavior
- [ ] No duplicated logic
- [ ] Route boundaries
- [ ] Forms validated
- [ ] Focus states
- [ ] Keyboard navigation
- [ ] Mobile touch behavior
- [ ] Clean console

## Backend/API
- [ ] Contracts
- [ ] Authentication
- [ ] Authorization
- [ ] Validation
- [ ] Rate limiting
- [ ] Safe retries/idempotency
- [ ] Error contracts
- [ ] Observability

## SEO
- [ ] Titles
- [ ] Descriptions
- [ ] Canonicals
- [ ] Robots
- [ ] Sitemap
- [ ] H1/H2/H3
- [ ] Structured data where eligible
- [ ] OG/social metadata
- [ ] Redirects
- [ ] 404
- [ ] Indexability staging protection

## Media
- [ ] Every image classified
- [ ] Alt text audited
- [ ] Decorative images use empty alt
- [ ] Responsive images
- [ ] Dimensions/aspect ratios
- [ ] Compression/formats
- [ ] Loading priorities
- [ ] Broken-media fallback

## Performance
- [ ] Budgets frozen
- [ ] Bundle audited
- [ ] Dependencies audited
- [ ] Fonts audited
- [ ] Third-party scripts audited
- [ ] Image payload audited
- [ ] Slow network tested
- [ ] Cold load tested
- [ ] Production build tested
- [ ] Core Web Vitals measured where possible

## Resilience
- [ ] 404
- [ ] 403
- [ ] 429
- [ ] 500
- [ ] offline
- [ ] timeout
- [ ] retry
- [ ] empty
- [ ] no results
- [ ] maintenance
- [ ] session expiry
- [ ] third-party failure

## Security
- [ ] Headers
- [ ] Cookies
- [ ] CSRF where applicable
- [ ] Input/output safety
- [ ] Redirect safety
- [ ] Error leakage audit
- [ ] Secrets audit

## QA
- [ ] Route crawl
- [ ] Browser matrix
- [ ] Responsive screenshots
- [ ] Keyboard pass
- [ ] Reduced-motion pass
- [ ] Accessibility manual pass
- [ ] E2E critical flows
- [ ] Final adversarial audit
- [ ] Documentation/state updated
