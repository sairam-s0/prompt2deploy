import { useEffect, useMemo, useState } from "react";
import { downloadProjectZip } from "./zip";

const promptExamples = [
  "Build a Python CLI todo manager with save/load support and a clean README.",
  "Create a React landing page for a fitness startup with a pricing section and FAQ.",
  "Generate a Node.js API starter for notes with CRUD routes and setup instructions.",
];

function App() {
  const [prompt, setPrompt] = useState("");
  const [project, setProject] = useState(null);
  const [selectedPath, setSelectedPath] = useState("README.md");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState({
    configured: false,
    missing: [],
    baseUrl: "",
    model: null,
  });

  useEffect(() => {
    let ignore = false;

    async function loadStatus() {
      try {
        const response = await fetch("/api/status");
        const payload = await response.json();

        if (!ignore) {
          setStatus(payload);
        }
      } catch {
        if (!ignore) {
          setStatus({
            configured: false,
            missing: ["Backend offline"],
            baseUrl: "",
            model: null,
          });
        }
      }
    }

    loadStatus();

    return () => {
      ignore = true;
    };
  }, []);

  const selectedFile = useMemo(() => {
    if (!project?.files?.length) {
      return null;
    }

    return project.files.find((file) => file.path === selectedPath) || project.files[0];
  }, [project, selectedPath]);

  async function handleGenerate(event) {
    event.preventDefault();

    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      setError("Write a prompt first so the backend can shape it into files.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: trimmedPrompt }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Generation failed.");
      }

      setProject(payload);
      setSelectedPath(
        payload.files.find((file) => file.path === "README.md")?.path || payload.files[0]?.path || "",
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">Server-side AI project generator</p>
          <h1>prompt2deploy</h1>
          <p className="lead">
            Paste a prompt, let the backend shape it for the model, preview the files,
            then download the generated project as a zip.
          </p>
        </div>

        <div className="status-strip">
          <div className={`status-badge ${status.configured ? "online" : "offline"}`}>
            {status.configured ? "AI backend ready" : "Backend setup needed"}
          </div>
          <p>
            Model: <strong>{status.model || "Not configured yet"}</strong>
          </p>
          <p className="muted">
            The API key stays on the server. Users only send prompts.
          </p>
        </div>
      </section>

      <section className="workspace-grid">
        <form className="panel composer-panel" onSubmit={handleGenerate}>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Prompt</p>
              <h2>Describe what should be generated</h2>
            </div>
            <span className="capsule">Backend adds structure</span>
          </div>

          <textarea
            className="prompt-box"
            placeholder="Example: create a Python app that takes a CSV file and prints a summary report, with README and requirements if needed."
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />

          <div className="example-row">
            {promptExamples.map((example) => (
              <button
                className="example-chip"
                key={example}
                onClick={() => setPrompt(example)}
                type="button"
              >
                {example}
              </button>
            ))}
          </div>

          {!status.configured ? (
            <div className="callout warning">
              <strong>Backend configuration is incomplete.</strong>
              <p>
                Add <code>AI_API_KEY</code> and <code>AI_MODEL</code> in your backend
                environment, then restart the server.
              </p>
              {status.missing?.length ? (
                <p className="muted">Missing: {status.missing.join(", ")}</p>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className="callout error">
              <strong>Generation failed.</strong>
              <p>{error}</p>
            </div>
          ) : null}

          <div className="action-row">
            <button className="primary-button" disabled={loading} type="submit">
              {loading ? "Generating project..." : "Generate project"}
            </button>
            {project ? (
              <button
                className="ghost-button"
                onClick={() => downloadProjectZip(project)}
                type="button"
              >
                Download zip
              </button>
            ) : null}
          </div>
        </form>

        <section className="panel preview-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Preview</p>
              <h2>{project ? project.projectName : "Generated files will appear here"}</h2>
            </div>
            {project ? <span className="capsule">{project.files.length} files</span> : null}
          </div>

          {project ? (
            <>
              <p className="summary">{project.summary}</p>

              <div className="preview-grid">
                <div className="file-list">
                  {project.files.map((file) => (
                    <button
                      className={selectedFile?.path === file.path ? "file-pill active" : "file-pill"}
                      key={file.path}
                      onClick={() => setSelectedPath(file.path)}
                      type="button"
                    >
                      {file.path}
                    </button>
                  ))}
                </div>

                <div className="file-viewer">
                  <div className="viewer-topbar">
                    <span>{selectedFile?.path}</span>
                    <span>{selectedFile?.content.length || 0} chars</span>
                  </div>
                  <pre>{selectedFile?.content || ""}</pre>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p className="empty-kicker">No project generated yet</p>
              <p>
                Once you send a prompt, the backend will guide the model into a strict JSON
                file bundle, then this panel will show the files before download.
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

export default App;
