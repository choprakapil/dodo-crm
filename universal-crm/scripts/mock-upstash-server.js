/* eslint-disable @typescript-eslint/no-require-imports */
// Mock Upstash Redis REST Server for Local Production-Mode Smoke Testing
const http = require("http");

const requestCounts = new Map();

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", chunk => body += chunk);
  req.on("end", () => {
    console.log("Mock Upstash received body:", body);
    try {
      if (body.includes("rate_limited_user") || body.includes("rate_limited_ip") || body.includes("rate_limited")) {
        // Exceeded limit: remainingTokens = -1 (< 0) -> success: false
        responseData = [{ result: [-1, 5] }];
      } else {
        // Allowed: remainingTokens = 4 (>= 0) -> success: true
        responseData = [{ result: [4, 5] }];
      }
    } catch (e) {}

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(responseData));
  });
});

const PORT = 3098;
server.listen(PORT, () => {
  console.log(`Mock Upstash Redis server listening on http://127.0.0.1:${PORT}`);
});
