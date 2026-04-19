import cors from "cors";
import express from "express";
import bcrypt from "bcryptjs";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const usersFilePath = path.join(__dirname, "users.json");
const distPath = path.join(__dirname, "..", "dist");
const app = express();
const port = 4000;

app.use(cors());
app.use(express.json());

async function ensureUsersFile() {
  try {
    await fs.access(usersFilePath);
  } catch {
    await fs.writeFile(usersFilePath, JSON.stringify([], null, 2));
  }
}

async function readUsers() {
  await ensureUsersFile();
  const fileContents = await fs.readFile(usersFilePath, "utf-8");
  return JSON.parse(fileContents);
}

async function writeUsers(users) {
  await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2));
}

function sanitizeUser(user) {
  return {
    email: user.email,
    createdAt: user.createdAt,
  };
}

app.post("/api/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const users = await readUsers();
    const existingUser = users.find((user) => user.email === normalizedEmail);

    if (existingUser) {
      return res.status(409).json({ message: "User already exists. Please sign in." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = {
      email: normalizedEmail,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    await writeUsers(users);

    return res.status(201).json({ message: "Registration successful." });
  } catch (error) {
    return res.status(500).json({ message: "Unable to register user." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const users = await readUsers();
    const existingUser = users.find((user) => user.email === normalizedEmail);

    if (!existingUser) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const passwordMatches = await bcrypt.compare(password, existingUser.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    return res.status(200).json({
      message: "Login successful.",
      user: sanitizeUser(existingUser),
    });
  } catch (error) {
    return res.status(500).json({ message: "Unable to login." });
  }
});

app.use(express.static(distPath));

app.get("*", async (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }

  try {
    await fs.access(path.join(distPath, "index.html"));
    return res.sendFile(path.join(distPath, "index.html"));
  } catch {
    return res
      .status(404)
      .send("Frontend not built yet. Run `npm.cmd run build` first.");
  }
});

app.listen(port, async () => {
  await ensureUsersFile();
  console.log(`prompt2deploy backend running on http://localhost:${port}`);
});
