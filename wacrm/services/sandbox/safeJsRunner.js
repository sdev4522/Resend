const vm = require("node:vm");
const logger = require("../../utils/logger");

// Disallowed patterns that could attempt prototype pollution or sandbox breakout
const DANGEROUS_PATTERNS = [
  /\bprocess\b/,
  /\bchild_process\b/,
  /\brequire\s*\(/,
  /\bimport\s*\(/,
  /\bimport\s+/,
  /\b__proto__\b/,
  /\bconstructor\s*\[/,
  /\bconstructor\s*\./,
  /\bFunction\s*\(/,
  /\beval\s*\(/,
  /\bglobal\b/,
  /\bglobalThis\b/,
  /\bBuffer\b/,
];

const { isPrivateAddress } = require("../../utils/ssrfGuard");

/**
 * SSRF-Safe Fetch Wrapper
 */
async function safeFetch(url, options = {}) {
  const fetchImpl = global.fetch ?? require("node-fetch");
  const parsed = new URL(url);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`);
  }

  if (isPrivateAddress(url)) {
    throw new Error("Access to internal, private, or local network addresses is forbidden.");
  }

  return fetchImpl(url, {
    ...options,
    redirect: "manual", // Prevent open redirect to private endpoints
    timeout: 10000,
  });
}

/**
 * Runs user-supplied JavaScript inside a secure sandbox.
 * Replaces vulnerable vm2 NodeVM.
 *
 * @param {string} code JavaScript code to execute
 * @param {object} contextData Data made available to the script
 * @param {number} timeoutMs Execution timeout in ms (default 3000ms)
 * @returns {Promise<{ success: boolean, result?: any, logs: string[], error?: string }>}
 */
async function executeSafeJs(code, contextData = {}, timeoutMs = 3000) {
  if (typeof code !== "string" || !code.trim()) {
    return { success: false, logs: [], error: "No code provided" };
  }

  // Length guard
  if (code.length > 5000) {
    return { success: false, logs: [], error: "Code exceeds maximum length (5000 chars)" };
  }

  // Static AST / pattern analysis for security hazards
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      return {
        success: false,
        logs: [],
        error: `Security violation: Use of restricted pattern (${pattern.toString()}) is prohibited.`,
      };
    }
  }

  const logs = [];

  // Sandbox capture logs
  const safeConsole = {
    log: (...args) => logs.push(args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")),
    info: (...args) => logs.push(args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")),
    warn: (...args) => logs.push(`WARN: ${args.map(String).join(" ")}`),
    error: (...args) => logs.push(`ERROR: ${args.map(String).join(" ")}`),
  };

  // Safe global environment
  const sandbox = {
    response: contextData.response || null,
    allResponses: contextData.allResponses || {},
    params: contextData.params || {},
    ai: contextData.ai || {},
    functionArgs: contextData.functionArgs || {},
    console: safeConsole,
    fetch: safeFetch,
    Math,
    Date,
    JSON,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURI,
    encodeURIComponent,
    decodeURI,
    decodeURIComponent,
    String,
    Number,
    Boolean,
    Array,
    Object: {
      keys: Object.keys,
      values: Object.values,
      entries: Object.entries,
      assign: Object.assign,
    },
    RegExp,
  };

  const context = vm.createContext(sandbox);

  const wrappedScript = `
    (async () => {
      "use strict";
      ${code}
    })()
  `;

  try {
    const script = new vm.Script(wrappedScript, {
      filename: "user-script.js",
      displayErrors: true,
    });

    const resultPromise = script.runInContext(context, {
      timeout: timeoutMs,
      breakOnSigint: true,
    });

    const result = await Promise.race([
      resultPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Script execution timed out")), timeoutMs)),
    ]);

    return {
      success: true,
      result: result !== undefined ? result : null,
      logs,
    };
  } catch (err) {
    return {
      success: false,
      logs,
      error: err.message || "Script execution failed",
    };
  }
}

module.exports = {
  executeSafeJs,
  safeFetch,
  isPrivateAddress,
};
