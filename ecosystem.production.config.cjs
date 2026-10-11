/*
 * PM2 reads names, ports, and the current-release symlink from the server-only
 * deploy configuration. Do not put values or secrets in this file.
 */
const current = process.env.RESEND_CURRENT_DIR;
const frontendName = process.env.RESEND_FRONTEND_PM2_NAME;
const backendName = process.env.RESEND_BACKEND_PM2_NAME;

if (!current || !frontendName || !backendName) {
  throw new Error(
    "RESEND_CURRENT_DIR, RESEND_FRONTEND_PM2_NAME, and RESEND_BACKEND_PM2_NAME are required",
  );
}

module.exports = {
  apps: [
    {
      name: frontendName,
      cwd: `${current}/frontend`,
      script: "npm",
      args: "start",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
        PORT: process.env.RESEND_FRONTEND_PORT || "3000",
      },
    },
    {
      name: backendName,
      cwd: `${current}/backend`,
      script: "server.js",
      env: {
        NODE_ENV: "production",
        BACKEND_PORT: process.env.RESEND_BACKEND_PORT || "3010",
      },
    },
  ],
};
