import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const port = process.env.PORT || "5000";
const stripeCli = spawn(
  "stripe",
  [
    "listen",
    "--forward-to",
    `localhost:${port}/api/stripe/webhook`,
    "--events",
    "checkout.session.completed",
  ],
  {
    cwd: backendDirectory,
    env: process.env,
    shell: process.platform === "win32",
    stdio: ["inherit", "pipe", "pipe"],
  },
);

let serverProcess;
let outputBuffer = "";
let stopping = false;

const stop = (exitCode = 0) => {
  if (stopping) return;
  stopping = true;
  serverProcess?.kill();
  stripeCli.kill();
  process.exitCode = exitCode;
};

const forwardOutput = (stream, write) => {
  stream.on("data", (chunk) => {
    write.write(chunk);
    outputBuffer = (outputBuffer + chunk.toString()).slice(-4000);

    const secret = outputBuffer.match(/whsec_[A-Za-z0-9]+/)?.[0];
    if (secret && !serverProcess) {
      console.log("Starting the backend with the Stripe CLI webhook secret.");
      serverProcess = spawn(
        process.execPath,
        ["node_modules/nodemon/bin/nodemon.js", "index.js"],
        {
          cwd: backendDirectory,
          env: { ...process.env, PORT: port, STRIPE_WEBHOOK_SECRET: secret },
          stdio: "inherit",
        },
      );
      serverProcess.on("error", (error) => {
        console.error("Could not start the backend:", error.message);
        stop(1);
      });
      serverProcess.on("exit", (code) => {
        if (!stopping) stop(code || 0);
      });
    }
  });
};

forwardOutput(stripeCli.stdout, process.stdout);
forwardOutput(stripeCli.stderr, process.stderr);

stripeCli.on("error", (error) => {
  console.error(
    `Could not start Stripe CLI (${error.message}). Install it and run 'stripe login', then retry.`,
  );
  stop(1);
});
stripeCli.on("exit", (code) => {
  if (!stopping) {
    if (/api_key_expired|expired api key/i.test(outputBuffer)) {
      console.error(
        "Stripe CLI authentication expired. Run `stripe login`, then retry `npm run dev`. If needed, run `stripe logout` before `stripe login`.",
      );
    } else {
      console.error("Stripe CLI stopped; stopping the local backend.");
    }
    stop(code || 1);
  }
});

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
