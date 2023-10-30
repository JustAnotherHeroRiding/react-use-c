const express = require("express");
const childProcess = require("child_process");
const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const os = require("os");

const app = express();
const port = process.env.PORT ?? 3000;

app.use(express.static("dist"));
app.use(express.json());

const zigPath = path.resolve(__dirname, "node_modules/@oven/zig/zig");

function spawn(command, args) {
  return new Promise((resolve) => {
    // damn this api is shit
    const p = childProcess.spawn(command, args, { shell: true });
    const stdouts = [];
    const stderrs = [];

    p.stdout.on("data", (data) => {
      stdouts.push(data);
    });

    p.stderr.on("data", (data) => {
      stderrs.push(data);
    });

    p.on("close", (code) => {
      resolve({
        code: code,
        stdout: Buffer.concat(stdouts).toString(),
        stderr: Buffer.concat(stderrs).toString(),
      });
    });
  });
}

function maketmp() {
  return new Promise((resolve, reject) => {
    fs.mkdtemp(path.join(os.tmpdir(), "use-c"), (err, dir) => {
      if (err !== null) reject(err);
      else resolve(dir);
    });
  });
}

async function runC(code) {
  const dir = await maketmp();
  const cFile = path.join(dir, "main.c");
  const outFile = path.join(dir, "main");
  await fsPromises.writeFile(cFile, decodeURIComponent(code));
  await spawn(zigPath, ["cc", cFile, "-o", outFile], { shell: true });
  const out = await spawn(outFile, []);
  // Here seems to be the problem as I am getting the following error
  /*  {
    code: 1,
    stdout: '',
    stderr: "'C:\\Users\\Admin\\AppData\\Local\\Temp\\use-c6wtGK8\\main' is not recognized as an internal or external command,\r\n" +
      'operable program or batch file.\r\n'
  } */
  console.log("Dir: ", dir);
  console.log("cFile: ", cFile);
  console.log("outFile:", outFile);
  console.log("out:", out);
  return out;
}

app.post("/rpc/rce", async (req, res) => {
  const { code } = req.body;
  const out = await runC(code);
  res.json(out);
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
