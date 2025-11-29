# Spec Summary (Lite)

Transform document export system from prototype (base64-encoded, memory-bound) to production microservice using Puppeteer browser pooling, Handlebars templates, and Encore object storage with streaming downloads. Implements state-tracked exports (queued→processing→ready), automatic 24h cleanup, and completes staff export endpoints. Targets <3s PDF generation for 100 transactions and <2s Excel for 1000 rows while handling 10+ concurrent requests via shared browser pool (5 instances max, 30s timeout).

