const responseShapeExample = {
  projectName: "python-notes-cli",
  summary: "A tiny command-line notes app in Python.",
  files: [
    {
      path: "README.md",
      content: "# Python Notes CLI\n\n## Run\n\n```bash\npython main.py\n```",
    },
    {
      path: "main.py",
      content: 'print("hello from notes cli")',
    },
  ],
};

export function getAiConfigStatus() {
  const resolvedConfig = getResolvedConfig();
  const missing = [];

  if (!resolvedConfig.apiKey) {
    missing.push("AI_API_KEY");
  }

  if (!resolvedConfig.model) {
    missing.push("AI_MODEL");
  }

  return {
    configured: missing.length === 0,
    missing,
    baseUrl: resolvedConfig.baseUrl,
    model: resolvedConfig.model || null,
  };
}

export async function generateProjectBundle(rawPrompt) {
  const configStatus = getAiConfigStatus();

  if (!configStatus.configured) {
    const error = new Error(
      `Missing AI configuration: ${configStatus.missing.join(", ")}. Add them in your backend environment.`,
    );
    error.statusCode = 500;
    throw error;
  }

  const prompt = normalizePrompt(rawPrompt);
  const generationGuide = inferGenerationGuide(prompt);
  const messages = buildMessages(prompt, generationGuide);
  const content = await requestChatCompletion(messages);
  const parsedProject = parseModelResponse(content);
  const normalizedProject = normalizeProject(parsedProject, prompt, generationGuide);

  return {
    ...normalizedProject,
    prompt,
    guidance: generationGuide.label,
    generatedAt: new Date().toISOString(),
  };
}

function normalizePrompt(input) {
  return input.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function inferGenerationGuide(prompt) {
  const lowercasePrompt = prompt.toLowerCase();

  if (
    /\breact\b|\bfrontend\b|\bwebsite\b|\blanding page\b|\bui\b|\bdashboard\b/.test(
      lowercasePrompt,
    )
  ) {
    return {
      label: "frontend-web",
      instructions: [
        "Build a small web project.",
        "Prefer the minimum files needed for a runnable frontend.",
        "Include package.json when Node tooling is needed.",
        "Include README.md with install and run steps.",
      ],
    };
  }

  if (/\bnode\b|\bexpress\b|\bjavascript\b|\bapi\b/.test(lowercasePrompt)) {
    return {
      label: "node-service",
      instructions: [
        "Build a small Node.js project.",
        "Prefer index.js or server.js as the entry file unless the user asked for a different filename.",
        "Include package.json and README.md.",
      ],
    };
  }

  return {
    label: "python-starter",
    instructions: [
      "Default to a Python starter project unless the user explicitly asked for another stack.",
      "Include main.py and README.md.",
      "Only add extra files when they materially help the project run.",
    ],
  };
}

function buildMessages(prompt, generationGuide) {
  const systemMessage = [
    "You generate tiny, runnable starter projects from user prompts.",
    "Return JSON only. Do not wrap the JSON in markdown fences.",
    "The JSON must match this shape exactly:",
    JSON.stringify(responseShapeExample, null, 2),
    "Rules:",
    "- Always include README.md in files.",
    "- Keep the project small and focused.",
    "- File paths must be relative and use forward slashes.",
    "- Never include binary files, images, or base64.",
    "- The file contents must be plain text only.",
    "- Prefer a working skeleton over a huge code dump.",
    "- If the prompt is vague, choose a sensible starter and explain how to run it in README.md.",
    "- Avoid placeholder text like TODO unless the user specifically asked for scaffolding.",
    ...generationGuide.instructions.map((instruction) => `- ${instruction}`),
  ].join("\n");

  const userMessage = [
    "Create a project bundle for this request:",
    prompt,
    "",
    "Before deciding files, infer the likely intent and choose the simplest runnable structure.",
    "Make the README concise but useful.",
  ].join("\n");

  return [
    { role: "system", content: systemMessage },
    { role: "user", content: userMessage },
  ];
}

async function requestChatCompletion(messages) {
  const resolvedConfig = getResolvedConfig();
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${resolvedConfig.apiKey}`,
  };

  if (resolvedConfig.baseUrl.includes("openrouter.ai")) {
    if (resolvedConfig.siteUrl) {
      headers["HTTP-Referer"] = resolvedConfig.siteUrl;
    }

    if (resolvedConfig.siteName) {
      headers["X-Title"] = resolvedConfig.siteName;
    }
  }

  const response = await fetch(resolvedConfig.baseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: resolvedConfig.model,
      temperature: Number.isFinite(resolvedConfig.temperature)
        ? resolvedConfig.temperature
        : 0.2,
      max_tokens: Number.isFinite(resolvedConfig.maxTokens) ? resolvedConfig.maxTokens : 5000,
      messages,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      payload?.error?.message || payload?.message || "The AI provider request failed.",
    );
    error.statusCode = response.status;
    error.details = payload;
    throw error;
  }

  const content = unwrapMessageContent(payload?.choices?.[0]?.message?.content);

  if (typeof content !== "string" || !content.trim()) {
    const error = new Error("The AI provider returned an empty response.");
    error.statusCode = 502;
    error.details = payload;
    throw error;
  }

  return content;
}

function getResolvedConfig() {
  const rawBaseUrl =
    process.env.AI_BASE_URL ||
    process.env.OPENROUTER_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    "https://openrouter.ai/api/v1/chat/completions";

  return {
    apiKey:
      process.env.AI_API_KEY ||
      process.env.OPENROUTER_API_KEY ||
      process.env.GROQ_API_KEY ||
      process.env.OPENAI_API_KEY ||
      "",
    baseUrl: normalizeChatCompletionsUrl(rawBaseUrl),
    model: process.env.AI_MODEL || "",
    siteUrl: process.env.AI_SITE_URL || "",
    siteName: process.env.AI_SITE_NAME || "prompt2deploy",
    temperature: Number.parseFloat(process.env.AI_TEMPERATURE || "0.2"),
    maxTokens: Number.parseInt(process.env.AI_MAX_TOKENS || "5000", 10),
  };
}

function normalizeChatCompletionsUrl(baseUrl) {
  if (typeof baseUrl !== "string" || !baseUrl.trim()) {
    return "https://openrouter.ai/api/v1/chat/completions";
  }

  const normalized = baseUrl.trim().replace(/\/+$/, "");

  if (normalized.endsWith("/chat/completions")) {
    return normalized;
  }

  if (
    normalized.endsWith("/api/v1") ||
    normalized.endsWith("/openai/v1") ||
    normalized.endsWith("/v1")
  ) {
    return `${normalized}/chat/completions`;
  }

  return normalized;
}

function parseModelResponse(content) {
  const cleaned = stripMarkdownFences(content.trim());

  try {
    return JSON.parse(cleaned);
  } catch {
    const extracted = extractFirstJsonObject(cleaned);

    try {
      return JSON.parse(extracted);
    } catch {
      const error = new Error(
        "The AI response could not be parsed into the expected JSON file bundle.",
      );
      error.statusCode = 502;
      error.details = { content };
      throw error;
    }
  }
}

function unwrapMessageContent(content) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
  }

  return "";
}

function stripMarkdownFences(content) {
  if (content.startsWith("```")) {
    return content.replace(/^```[a-zA-Z0-9_-]*\n?/, "").replace(/\n?```$/, "").trim();
  }

  return content;
}

function extractFirstJsonObject(content) {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return content;
  }

  return content.slice(start, end + 1);
}

function normalizeProject(project, originalPrompt, generationGuide) {
  const rawFiles = Array.isArray(project?.files) ? project.files : [];
  const files = rawFiles
    .map((file) => normalizeFile(file))
    .filter(Boolean)
    .filter((file, index, list) => list.findIndex((entry) => entry.path === file.path) === index);

  if (!files.some((file) => file.path === "README.md")) {
    files.unshift({
      path: "README.md",
      content: buildFallbackReadme(project?.projectName, project?.summary, generationGuide.label),
    });
  }

  if (files.length === 1 && generationGuide.label === "python-starter") {
    files.push({
      path: "main.py",
      content: 'print("Hello from your generated project")\n',
    });
  }

  if (files.length === 0) {
    files.push(
      {
        path: "README.md",
        content: buildFallbackReadme(project?.projectName, project?.summary, generationGuide.label),
      },
      {
        path: "main.py",
        content: 'print("Hello from your generated project")\n',
      },
    );
  }

  return {
    projectName: sanitizeProjectName(project?.projectName || deriveProjectName(originalPrompt)),
    summary:
      typeof project?.summary === "string" && project.summary.trim()
        ? project.summary.trim()
        : "A generated starter project based on your prompt.",
    files,
  };
}

function normalizeFile(file) {
  if (!file || typeof file !== "object") {
    return null;
  }

  const pathValue = sanitizeFilePath(file.path);
  const contentValue = typeof file.content === "string" ? file.content.replace(/\r\n/g, "\n") : "";

  if (!pathValue || pathValue.endsWith("/") || !contentValue.trim()) {
    return null;
  }

  return {
    path: pathValue.toLowerCase() === "readme.md" ? "README.md" : pathValue,
    content: contentValue.endsWith("\n") ? contentValue : `${contentValue}\n`,
  };
}

function sanitizeFilePath(filePath) {
  if (typeof filePath !== "string") {
    return "";
  }

  const normalized = filePath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/")
    .trim();

  if (!normalized || normalized.includes("..")) {
    return "";
  }

  return normalized;
}

function sanitizeProjectName(name) {
  const normalized =
    typeof name === "string" && name.trim()
      ? name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")
      : "generated-project";

  return normalized.replace(/^-+|-+$/g, "") || "generated-project";
}

function deriveProjectName(prompt) {
  return prompt.slice(0, 48);
}

function buildFallbackReadme(projectName, summary, guideLabel) {
  const title = sanitizeProjectName(projectName || "generated project")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  const runHint =
    guideLabel === "frontend-web"
      ? "npm install\nnpm run dev"
      : guideLabel === "node-service"
        ? "npm install\nnode index.js"
        : "python main.py";

  return [
    `# ${title || "Generated Project"}`,
    "",
    summary?.trim() || "A generated starter project created from your prompt.",
    "",
    "## Run",
    "",
    "```bash",
    runHint,
    "```",
  ].join("\n");
}
