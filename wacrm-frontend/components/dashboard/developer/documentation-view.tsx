'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Check, ExternalLink, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const API_DOMAIN = process.env.NEXT_PUBLIC_PUBLIC_API_DOMAIN || 'api.resend.in';
const BASE_URL = `https://${API_DOMAIN}/v1`;

interface CodeBlockProps {
  code: string;
  language?: string;
}

function CodeBlock({ code, language = 'bash' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-lg bg-zinc-950 dark:bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono text-xs overflow-hidden my-3 shadow-xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-zinc-900/90 dark:bg-zinc-800/60 border-b border-zinc-800 text-[11px] text-zinc-400">
        <span className="uppercase tracking-wider font-semibold">{language}</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-zinc-400 hover:text-white hover:bg-zinc-800 gap-1 text-[11px]"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </Button>
      </div>
      <div className="p-4 overflow-x-auto leading-relaxed">
        <pre>{code}</pre>
      </div>
    </div>
  );
}

function MultiLangSnippet({
  curlCode,
  jsCode,
  nodeCode,
  phpCode,
  pythonCode,
}: {
  curlCode: string;
  jsCode: string;
  nodeCode: string;
  phpCode: string;
  pythonCode: string;
}) {
  const [activeTab, setActiveTab] = useState<'curl' | 'js' | 'node' | 'php' | 'python'>('curl');

  return (
    <div className="my-4">
      <div className="flex items-center gap-1 border-b border-border mb-2 text-xs">
        <button
          onClick={() => setActiveTab('curl')}
          className={`px-3 py-1.5 font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'curl'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          cURL
        </button>
        <button
          onClick={() => setActiveTab('js')}
          className={`px-3 py-1.5 font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'js'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          JavaScript
        </button>
        <button
          onClick={() => setActiveTab('node')}
          className={`px-3 py-1.5 font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'node'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Node.js
        </button>
        <button
          onClick={() => setActiveTab('php')}
          className={`px-3 py-1.5 font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'php'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          PHP
        </button>
        <button
          onClick={() => setActiveTab('python')}
          className={`px-3 py-1.5 font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'python'
              ? 'border-primary text-primary font-semibold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Python
        </button>
      </div>

      {activeTab === 'curl' && <CodeBlock code={curlCode} language="bash" />}
      {activeTab === 'js' && <CodeBlock code={jsCode} language="javascript" />}
      {activeTab === 'node' && <CodeBlock code={nodeCode} language="javascript" />}
      {activeTab === 'php' && <CodeBlock code={phpCode} language="php" />}
      {activeTab === 'python' && <CodeBlock code={pythonCode} language="python" />}
    </div>
  );
}

export function DocumentationView() {
  const [activeSection, setActiveSection] = useState('getting-started');

  const scrollTo = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const navItems = [
    { id: 'getting-started', label: 'Getting Started' },
    { id: 'authentication', label: 'Authentication' },
    { id: 'connections', label: 'WhatsApp Connections' },
    { id: 'messages', label: 'Send Messages' },
    { id: 'message-status', label: 'Message Status' },
    { id: 'templates', label: 'Templates' },
    { id: 'contacts', label: 'Contacts' },
    { id: 'rate-limits', label: 'Rate Limits & Quota' },
    { id: 'idempotency', label: 'Idempotency Keys' },
    { id: 'error-codes', label: 'Error Codes' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Sticky Table of Contents */}
      <div className="md:col-span-1 hidden md:block">
        <div className="sticky top-20 rounded-lg border bg-card p-3 space-y-1 text-xs">
          <p className="font-semibold text-foreground px-2 py-1 uppercase tracking-wider text-[10px] text-muted-foreground">
            API Documentation
          </p>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className={`w-full text-left px-2.5 py-1.5 rounded-md transition-colors font-medium ${
                activeSection === item.id
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
          <div className="pt-2 border-t mt-2">
            <a
              href="/v1/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-muted-foreground hover:text-foreground text-[11px]"
            >
              <span>OpenAPI 3.1 Spec</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Main Documentation Body */}
      <div className="md:col-span-3 space-y-10 text-sm leading-relaxed text-foreground/90">
        {/* Section: Getting Started */}
        <section id="getting-started" className="space-y-3 scroll-mt-20">
          <div className="border-b pb-2">
            <h2 className="text-xl font-bold tracking-tight">Getting Started</h2>
            <p className="text-xs text-muted-foreground">
              Send your first WhatsApp message in minutes with the WACRM Developer API.
            </p>
          </div>

          <div className="space-y-2">
            <p>
              The WACRM Public REST API is served directly at <code>{BASE_URL}</code>. Follow these 4 steps to send your first message:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 pl-1 text-xs text-foreground/80">
              <li>
                <strong>Create an API Key</strong> in the <em>API Keys</em> tab above, selecting the <code>messages:send</code> scope.
              </li>
              <li>
                <strong>Get your Connection ID</strong> (e.g. <code>wa_01KABC...</code>) from the <em>Connections</em> tab.
              </li>
              <li>
                <strong>Make an authorized POST request</strong> with your message body.
              </li>
              <li>
                <strong>Track delivery status</strong> using the returned message ID (<code>msg_01K...</code>).
              </li>
            </ol>
          </div>
        </section>

        {/* Section: Authentication */}
        <section id="authentication" className="space-y-3 scroll-mt-20">
          <div className="border-b pb-2">
            <h2 className="text-xl font-bold tracking-tight">Authentication</h2>
            <p className="text-xs text-muted-foreground">
              Secure Bearer token authorization using cryptographic API keys.
            </p>
          </div>

          <p>
            Authenticate every request by passing your API key in the <code>Authorization</code> header:
          </p>

          <CodeBlock code={`Authorization: Bearer rk_live_xxxxxxxxxxxxxxxxxxxxxxxx`} language="http" />

          <div className="p-3 bg-muted/60 border rounded-lg text-xs space-y-1">
            <p className="font-semibold text-foreground">API Key Format & Security:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Keys begin with the prefix <code>rk_live_</code>.</li>
              <li>Raw secrets are never saved in plaintext; only SHA-256 hashes are verified.</li>
              <li>Revoked keys are blocked immediately across all instances.</li>
            </ul>
          </div>
        </section>

        {/* Section: WhatsApp Connections */}
        <section id="connections" className="space-y-3 scroll-mt-20">
          <div className="border-b pb-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs">GET</Badge>
              <h2 className="text-xl font-bold tracking-tight">/v1/connections</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Retrieve all WhatsApp accounts authorized for your API key.
            </p>
          </div>

          <p>Required scope: <code>connections:read</code></p>

          <MultiLangSnippet
            curlCode={`curl -X GET "${BASE_URL}/connections" \\
  -H "Authorization: Bearer rk_live_xxxxxxxxxxxxxxxx"`}
            jsCode={`const response = await fetch("${BASE_URL}/connections", {
  headers: {
    "Authorization": "Bearer rk_live_xxxxxxxxxxxxxxxx"
  }
});
const data = await response.json();`}
            nodeCode={`const https = require("https");

const options = {
  hostname: "${API_DOMAIN}",
  path: "/v1/connections",
  method: "GET",
  headers: {
    "Authorization": "Bearer rk_live_xxxxxxxxxxxxxxxx"
  }
};

const req = https.request(options, (res) => {
  let body = "";
  res.on("data", (chunk) => body += chunk);
  res.on("end", () => console.log(JSON.parse(body)));
});
req.end();`}
            phpCode={`<?php
$curl = curl_init();
curl_setopt_array($curl, [
  CURLOPT_URL => "${BASE_URL}/connections",
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer rk_live_xxxxxxxxxxxxxxxx"
  ],
]);
$response = curl_exec($curl);
curl_close($curl);
echo $response;`}
            pythonCode={`import requests

headers = {
    "Authorization": "Bearer rk_live_xxxxxxxxxxxxxxxx"
}
response = requests.get("${BASE_URL}/connections", headers=headers)
print(response.json())`}
          />

          <p className="text-xs font-semibold">Example Response:</p>
          <CodeBlock
            code={`{
  "data": [
    {
      "id": "wa_01KABC123",
      "name": "Support WhatsApp",
      "phone_number": "916307239058",
      "provider": "qr",
      "status": "connected"
    },
    {
      "id": "wa_02KXYZ456",
      "name": "Official Marketing",
      "phone_number": "919876543210",
      "provider": "meta",
      "status": "connected"
    }
  ],
  "request_id": "req_01KABC..."
}`}
            language="json"
          />
        </section>

        {/* Section: Send Messages */}
        <section id="messages" className="space-y-3 scroll-mt-20">
          <div className="border-b pb-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-600 text-white font-mono text-xs">POST</Badge>
              <h2 className="text-xl font-bold tracking-tight">/v1/messages</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Send a text, image, video, audio, or document WhatsApp message.
            </p>
          </div>

          <p>Required scope: <code>messages:send</code></p>

          <MultiLangSnippet
            curlCode={`curl -X POST "${BASE_URL}/messages" \\
  -H "Authorization: Bearer rk_live_xxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: order-10492-msg-1" \\
  -d '{
    "connection_id": "wa_01KABC123",
    "to": "919876543210",
    "type": "text",
    "text": {
      "body": "Hello! Your package has been dispatched via courier."
    }
  }'`}
            jsCode={`const res = await fetch("${BASE_URL}/messages", {
  method: "POST",
  headers: {
    "Authorization": "Bearer rk_live_xxxxxxxxxxxxxxxx",
    "Content-Type": "application/json",
    "Idempotency-Key": "order-10492-msg-1"
  },
  body: JSON.stringify({
    connection_id: "wa_01KABC123",
    to: "919876543210",
    type: "text",
    text: {
      body: "Hello! Your package has been dispatched via courier."
    }
  })
});
const result = await res.json();`}
            nodeCode={`const https = require("https");

const payload = JSON.stringify({
  connection_id: "wa_01KABC123",
  to: "919876543210",
  type: "text",
  text: { body: "Hello! Your package has been dispatched." }
});

const req = https.request({
  hostname: "${API_DOMAIN}",
  path: "/v1/messages",
  method: "POST",
  headers: {
    "Authorization": "Bearer rk_live_xxxxxxxxxxxxxxxx",
    "Content-Type": "application/json",
    "Idempotency-Key": "order-10492-msg-1",
    "Content-Length": Buffer.byteLength(payload)
  }
}, (res) => {
  let body = "";
  res.on("data", (chunk) => body += chunk);
  res.on("end", () => console.log(JSON.parse(body)));
});

req.write(payload);
req.end();`}
            phpCode={`<?php
$payload = [
  "connection_id" => "wa_01KABC123",
  "to" => "919876543210",
  "type" => "text",
  "text" => [
    "body" => "Hello! Your package has been dispatched."
  ]
];

$curl = curl_init();
curl_setopt_array($curl, [
  CURLOPT_URL => "${BASE_URL}/messages",
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POSTFIELDS => json_encode($payload),
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer rk_live_xxxxxxxxxxxxxxxx",
    "Content-Type: application/json",
    "Idempotency-Key: order-10492-msg-1"
  ],
]);
$response = curl_exec($curl);
curl_close($curl);
echo $response;`}
            pythonCode={`import requests

payload = {
    "connection_id": "wa_01KABC123",
    "to": "919876543210",
    "type": "text",
    "text": {
        "body": "Hello! Your package has been dispatched."
    }
}
headers = {
    "Authorization": "Bearer rk_live_xxxxxxxxxxxxxxxx",
    "Content-Type": "application/json",
    "Idempotency-Key": "order-10492-msg-1"
}
res = requests.post("${BASE_URL}/messages", json=payload, headers=headers)
print(res.json())`}
          />

          <p className="text-xs font-semibold">Response (HTTP 202 Accepted):</p>
          <CodeBlock
            code={`{
  "data": {
    "id": "msg_01KABCXYZ987",
    "status": "accepted",
    "connection_id": "wa_01KABC123",
    "to": "919876543210",
    "provider": "meta",
    "created_at": "2026-09-23T11:00:00.000Z"
  },
  "request_id": "req_01K998..."
}`}
            language="json"
          />
        </section>

        {/* Section: Message Status */}
        <section id="message-status" className="space-y-3 scroll-mt-20">
          <div className="border-b pb-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs">GET</Badge>
              <h2 className="text-xl font-bold tracking-tight">/v1/messages/:id</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Retrieve real-time delivery status for a message.
            </p>
          </div>

          <p>Required scope: <code>messages:read</code></p>

          <CodeBlock
            code={`curl -X GET "${BASE_URL}/messages/msg_01KABCXYZ987" \\
  -H "Authorization: Bearer rk_live_xxxxxxxxxxxxxxxx"`}
            language="bash"
          />

          <p className="text-xs font-semibold">Response:</p>
          <CodeBlock
            code={`{
  "data": {
    "id": "msg_01KABCXYZ987",
    "status": "delivered",
    "connection_id": "wa_01KABC123",
    "to": "919876543210",
    "created_at": "2026-09-23T11:00:00.000Z",
    "updated_at": "2026-09-23T11:00:03.000Z"
  },
  "request_id": "req_01K..."
}`}
            language="json"
          />
        </section>

        {/* Section: Templates */}
        <section id="templates" className="space-y-3 scroll-mt-20">
          <div className="border-b pb-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-600 text-white font-mono text-xs">POST</Badge>
              <h2 className="text-xl font-bold tracking-tight">/v1/template-messages</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Send approved Meta WhatsApp Cloud templates with variables.
            </p>
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs space-y-1 text-amber-900 dark:text-amber-200">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Meta Cloud Connections Only
            </p>
            <p>
              Meta templates are only supported by Meta Cloud API connections. Attempting to send a template through a QR/Baileys connection will return <code>400 TEMPLATE_NOT_SUPPORTED_BY_CONNECTION</code>.
            </p>
          </div>

          <CodeBlock
            code={`curl -X POST "${BASE_URL}/template-messages" \\
  -H "Authorization: Bearer rk_live_xxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "connection_id": "wa_02KXYZ456",
    "to": "919876543210",
    "template_name": "order_update",
    "language_code": "en_US",
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Hamid" },
          { "type": "text", "text": "ORD-991" }
        ]
      }
    ]
  }'`}
            language="bash"
          />
        </section>

        {/* Section: Contacts */}
        <section id="contacts" className="space-y-3 scroll-mt-20">
          <div className="border-b pb-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono text-xs">GET</Badge>
              <h2 className="text-xl font-bold tracking-tight">/v1/contacts</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Paginated contacts retrieval with search support.
            </p>
          </div>

          <p>Required scope: <code>contacts:read</code></p>

          <CodeBlock
            code={`curl -X GET "${BASE_URL}/contacts?page=1&limit=25&search=John" \\
  -H "Authorization: Bearer rk_live_xxxxxxxxxxxxxxxx"`}
            language="bash"
          />
        </section>

        {/* Section: Rate Limits */}
        <section id="rate-limits" className="space-y-3 scroll-mt-20">
          <div className="border-b pb-2">
            <h2 className="text-xl font-bold tracking-tight">Rate Limits & Quotas</h2>
            <p className="text-xs text-muted-foreground">
              Multi-layer protection across IP, API Key, Workspace, and WhatsApp connections.
            </p>
          </div>

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-muted text-muted-foreground font-medium text-left">
                <tr>
                  <th className="p-2.5">Layer</th>
                  <th className="p-2.5">Scope</th>
                  <th className="p-2.5">Default Limit</th>
                  <th className="p-2.5">Behavior Exceeded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="p-2.5 font-semibold">Layer 1 — IP</td>
                  <td className="p-2.5 text-muted-foreground">Per Client IP</td>
                  <td className="p-2.5 font-mono">120 req / min</td>
                  <td className="p-2.5">HTTP 429 + Retry-After</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-semibold">Layer 2 — API Key</td>
                  <td className="p-2.5 text-muted-foreground">Per Bearer Key</td>
                  <td className="p-2.5 font-mono">60 req / min</td>
                  <td className="p-2.5">HTTP 429 + Retry-After</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-semibold">Layer 3 — Workspace</td>
                  <td className="p-2.5 text-muted-foreground">Across all keys</td>
                  <td className="p-2.5 font-mono">120 req / min</td>
                  <td className="p-2.5">HTTP 429 + Retry-After</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-semibold">Layer 4 — Connection</td>
                  <td className="p-2.5 text-muted-foreground">Per WhatsApp account</td>
                  <td className="p-2.5 font-mono">30 msg / min</td>
                  <td className="p-2.5">HTTP 429 + Anti-ban delay</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-semibold">Layer 5 — Plan Quota</td>
                  <td className="p-2.5 text-muted-foreground">Monthly volume</td>
                  <td className="p-2.5 font-mono">Per Subscription</td>
                  <td className="p-2.5">HTTP 403 QUOTA_EXCEEDED</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            All responses include standard headers: <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code>, and <code>X-RateLimit-Reset</code>.
          </p>
        </section>

        {/* Section: Idempotency */}
        <section id="idempotency" className="space-y-3 scroll-mt-20">
          <div className="border-b pb-2">
            <h2 className="text-xl font-bold tracking-tight">Idempotency Keys</h2>
            <p className="text-xs text-muted-foreground">
              Guaranteed exactly-once message dispatch over unreliable networks.
            </p>
          </div>

          <p>
            When dispatching messages, pass the <code>Idempotency-Key</code> header with a unique string (e.g. your database order or event UUID):
          </p>

          <CodeBlock code={`Idempotency-Key: invoice-94810-send`} language="http" />

          <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
            <li>If a network timeout occurs, retrying the exact same request will return the previously saved result without sending another WhatsApp message.</li>
            <li>Reusing an idempotency key with a modified body will return <code>409 IDEMPOTENCY_KEY_REUSED</code>.</li>
            <li>Idempotency keys are safely cached for 24 hours.</li>
          </ul>
        </section>

        {/* Section: Error Codes */}
        <section id="error-codes" className="space-y-3 scroll-mt-20">
          <div className="border-b pb-2">
            <h2 className="text-xl font-bold tracking-tight">Standard Error Codes</h2>
            <p className="text-xs text-muted-foreground">
              Consistent, structured JSON error envelopes across all endpoints.
            </p>
          </div>

          <CodeBlock
            code={`{
  "error": {
    "code": "CONNECTION_NOT_ALLOWED",
    "message": "This API key is not authorized to use the requested WhatsApp connection.",
    "request_id": "req_01KABC..."
  }
}`}
            language="json"
          />

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-muted text-muted-foreground font-medium text-left">
                <tr>
                  <th className="p-2.5">Error Code</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono text-[11px]">
                <tr>
                  <td className="p-2.5 font-bold text-foreground">INVALID_API_KEY</td>
                  <td className="p-2.5 text-muted-foreground">401</td>
                  <td className="p-2.5 font-sans">Missing, invalid, or expired API key.</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-foreground">API_KEY_REVOKED</td>
                  <td className="p-2.5 text-muted-foreground">401</td>
                  <td className="p-2.5 font-sans">The API key was explicitly revoked.</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-foreground">INSUFFICIENT_SCOPE</td>
                  <td className="p-2.5 text-muted-foreground">403</td>
                  <td className="p-2.5 font-sans">API key lacks required scope for this endpoint.</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-foreground">CONNECTION_REQUIRED</td>
                  <td className="p-2.5 text-muted-foreground">400</td>
                  <td className="p-2.5 font-sans">connection_id omitted and no default is configured.</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-foreground">CONNECTION_NOT_FOUND</td>
                  <td className="p-2.5 text-muted-foreground">404</td>
                  <td className="p-2.5 font-sans">WhatsApp connection does not exist or outside workspace.</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-foreground">CONNECTION_NOT_ALLOWED</td>
                  <td className="p-2.5 text-muted-foreground">403</td>
                  <td className="p-2.5 font-sans">API key is not authorized for this specific WhatsApp account.</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-foreground">CONNECTION_DISCONNECTED</td>
                  <td className="p-2.5 text-muted-foreground">400</td>
                  <td className="p-2.5 font-sans">Target WhatsApp account is logged out or disconnected.</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-foreground">TEMPLATE_NOT_SUPPORTED_BY_CONNECTION</td>
                  <td className="p-2.5 text-muted-foreground">400</td>
                  <td className="p-2.5 font-sans">Attempted to send a Meta template through a QR connection.</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-foreground">INVALID_PHONE_NUMBER</td>
                  <td className="p-2.5 text-muted-foreground">400</td>
                  <td className="p-2.5 font-sans">Invalid phone format or not registered on WhatsApp.</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-foreground">RATE_LIMITED</td>
                  <td className="p-2.5 text-muted-foreground">429</td>
                  <td className="p-2.5 font-sans">Request rate limit exceeded. Check Retry-After header.</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-foreground">QUOTA_EXCEEDED</td>
                  <td className="p-2.5 text-muted-foreground">403</td>
                  <td className="p-2.5 font-sans">Monthly message limit exceeded for workspace plan.</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-bold text-foreground">IDEMPOTENCY_KEY_REUSED</td>
                  <td className="p-2.5 text-muted-foreground">409</td>
                  <td className="p-2.5 font-sans">Same idempotency key submitted with different body.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
