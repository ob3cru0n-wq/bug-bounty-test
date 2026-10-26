const { fork } = require("child_process");
const path = require("path");

const labs = [
  { name: "07-implicit",         script: "lab-07-implicit/backend/server.js" },
  { name: "08-gis-onetap",      script: "lab-08-gis-onetap/backend/server.js" },
  { name: "09-gis-button",      script: "lab-09-gis-button/backend/server.js" },
  { name: "10-gis-token-client", script: "lab-10-gis-token-client/backend/server.js" },
  { name: "11-gis-code-client",  script: "lab-11-gis-code-client/backend/server.js" },
];

for (const lab of labs) {
  const child = fork(path.join(__dirname, lab.script));
  child.on("error", (err) => console.error(`[${lab.name}] ${err.message}`));
  child.on("exit", (code) => console.log(`[${lab.name}] exited (${code})`));
}

console.log("\nAll labs starting...\n");
