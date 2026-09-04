import fs from "node:fs";
import path from "node:path";
const target=path.resolve("src","generated-scan-local.js");fs.mkdirSync(path.dirname(target),{recursive:true});if(!fs.existsSync(target))fs.writeFileSync(target,"export const scanLocalReady = true;\n");
