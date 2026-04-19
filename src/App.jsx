import { useEffect, useState } from "react";

const storageKey = "prompt2deploy-user";

const initialForm = {
  email: "",
  password: "",
};

const sampleFiles = [
  { name: "src/", type: "folder" },
  { name: "App.jsx", type: "file", depth: 1 },
  { name: "components/", type: "folder", depth: 1 },
  { name: "PromptPanel.jsx", type: "file", depth: 2 },
  { name: "OutputPreview.jsx", type: "file", depth: 2 },
  { name: "public/", type: "folder" },
  { name: "package.json", type: "file" },
  { name: "README.md", type: "file" },
];

function App() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = window.localStorage.getItem(storageKey);
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const resetFeedback = () => {
    setMessage("");
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    resetFeedback();
    setLoading(true);

    try {
      const endpoint = mode === "register" ? "/api/register" : "/api/login";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Something went wrong.");
      }

      if (mode === "register") {
        setMessage("Registration complete. You can sign in now.");
        setMode("login");
        setForm(initialForm);
      } else {
        window.localStorage.setItem(storageKey, JSON.stringify(payload.user));
        setUser(payload.user);
        setForm(initialForm);
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    window.localStorage.removeItem(storageKey);
    setUser(null);
    setPrompt("");
    resetFeedback();
    setMode("login");
  };

  if (user) {
    return (
      <main className="workspace-shell">
        <section className="workspace-topbar">
          <div>
            <p className="eyebrow">Signed in</p>
            <h1>prompt2deploy</h1>
            <p className="subtle">Welcome back, {user.email}</p>
          </div>
          <button className="ghost-button" onClick={handleLogout}>
            Logout
          </button>
        </section>

        <section className="workspace-grid">
          <div className="panel panel-prompt">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Prompt input</p>
                <h2>Describe the project you want to generate</h2>
              </div>
              <span className="pill">Next step ready</span>
            </div>

            <textarea
              className="prompt-box"
              placeholder="Example: Build a SaaS landing page with dashboard, auth, and billing settings..."
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />

            <div className="prompt-footer">
              <p>
                Prompt collection is wired in now. File generation can be added on
                top of this flow next.
              </p>
              <button className="primary-button" type="button">
                Generate Files Later
              </button>
            </div>
          </div>

          <div className="panel panel-files">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Project structure</p>
                <h2>Generated files preview</h2>
              </div>
            </div>

            <div className="file-tree">
              {sampleFiles.map((item) => (
                <div
                  className={`file-row ${item.type}`}
                  key={`${item.name}-${item.depth ?? 0}`}
                  style={{ paddingLeft: `${(item.depth ?? 0) * 20 + 16}px` }}
                >
                  <span className="file-icon">
                    {item.type === "folder" ? ">" : "-"}
                  </span>
                  <span>{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="hero-panel">
        <p className="badge">AI project launcher</p>
        <h1>prompt2deploy</h1>
        <p className="hero-copy">
          Sign in to start shaping prompts into structured project outputs. New
          users need to register once before their first login.
        </p>

        <div className="feature-grid">
          <article>
            <h3>Secure access</h3>
            <p>Passwords are hashed in the backend before they are saved.</p>
          </article>
          <article>
            <h3>Fluid workflow</h3>
            <p>A responsive two-stage experience for auth and prompt entry.</p>
          </article>
          <article>
            <h3>Project-ready</h3>
            <p>The next page already includes a structured file-output panel.</p>
          </article>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="tabs">
            <button
              className={mode === "login" ? "tab active" : "tab"}
              onClick={() => {
                setMode("login");
                resetFeedback();
              }}
              type="button"
            >
              Sign in
            </button>
            <button
              className={mode === "register" ? "tab active" : "tab"}
              onClick={() => {
                setMode("register");
                resetFeedback();
              }}
              type="button"
            >
              Register
            </button>
          </div>

          <div className="auth-copy">
            <p className="eyebrow">
              {mode === "register" ? "Create your account" : "Welcome back"}
            </p>
            <h2>
              {mode === "register"
                ? "Register before first sign in"
                : "Login with email and password"}
            </h2>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label>
              Email
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Password
              <input
                name="password"
                type="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                required
                minLength={6}
              />
            </label>

            {message ? <p className="feedback success">{message}</p> : null}
            {error ? <p className="feedback error">{error}</p> : null}

            <button className="primary-button" disabled={loading} type="submit">
              {loading
                ? "Please wait..."
                : mode === "register"
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

export default App;
