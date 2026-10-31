
require("dotenv").config();

const bcrypt = require("bcryptjs");
const readline = require("readline");
const { pool } = require("../src/config/database");

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Hidden password input: hindi ipinapakita ang password habang nagta-type.
function askPassword(question) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;

    if (!stdin.isTTY) {
      return reject(new Error("Please run this script in a terminal."));
    }

    let password = "";
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    function cleanup() {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      process.stdout.write("\n");
    }

    function onData(char) {
      if (char === "\u0003") {
        cleanup();
        reject(new Error("Setup cancelled."));
      } else if (char === "\r" || char === "\n") {
        cleanup();
        resolve(password);
      } else if (char === "\u007f" || char === "\b") {
        password = password.slice(0, -1);
      } else if (char >= " ") {
        password += char;
      }
    }

    stdin.on("data", onData);
  });
}

async function main() {
  try {
    const [coordinators] = await pool.query(
      "SELECT user_id FROM users WHERE role = 'coordinator' LIMIT 1"
    );

    if (coordinators.length > 0) {
      console.log("A Coordinator account already exists. Setup stopped.");
      return;
    }

    const name = await ask("Coordinator name: ");
    const email = (await ask("Coordinator email: ")).toLowerCase();
    const password = await askPassword("Coordinator password: ");

    if (!name || !email || !password) {
      throw new Error("All fields are required.");
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      throw new Error("Please enter a valid email address.");
    }

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }

    const [existing] = await pool.query(
      "SELECT user_id FROM users WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      throw new Error("That email is already registered.");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, verification_status)
       VALUES (?, ?, ?, 'coordinator', 'APPROVED')
       RETURNING user_id`,
      [name.slice(0, 100), email, passwordHash]
    );

    console.log("Initial Coordinator created successfully.");
    console.log("User ID:", result[0].user_id);
    console.log("Role: coordinator");
    console.log("You can now log in to LogiSync.");
  } catch (error) {
    console.error("Setup failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
