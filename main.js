const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const BASE_TEMP_DIR = path.join(__dirname, 'temp');
const BASE_OUTPUTS_DIR = path.join(__dirname, 'outputs');
const PROMPT_PATH = path.join(__dirname, 'prompt.txt');
const RUN_GEMINI_PATH = path.join(__dirname, 'run_gemini.sh');

if (!fs.existsSync(BASE_TEMP_DIR)) fs.mkdirSync(BASE_TEMP_DIR);
if (!fs.existsSync(BASE_OUTPUTS_DIR)) fs.mkdirSync(BASE_OUTPUTS_DIR);

app.post('/analyze', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const { repo_url } = req.body;
  if (!repo_url || typeof repo_url !== 'string' || !repo_url.startsWith('https://github.com/')) {
    res.write('event: error\ndata: {"error":"Valid GitHub URL required"}\n\n');
    res.end();
    return;
  }

  const workId = crypto.randomUUID();
  const workTempDir = path.join(BASE_TEMP_DIR, workId);
  const workOutputDir = path.join(BASE_OUTPUTS_DIR, workId);
  const profilePath = path.join(workOutputDir, 'profile.json');

  fs.mkdirSync(workTempDir, { recursive: true });
  fs.mkdirSync(workOutputDir, { recursive: true });

  const cleanup = () => {
    fs.rmSync(workTempDir, { recursive: true, force: true });
  };

  const getRepoCmd = `bash get_repo.sh "${repo_url.replace(/"/g, '')}" "${workTempDir}"`;

  exec(getRepoCmd, (err, stdout, stderr) => {
    if (err) {
      res.write(`event: error\ndata: {"error":${JSON.stringify(stderr || err.message)}}\n\n`);
      cleanup();
      res.end();
      return;
    }

    fs.readdir(workTempDir, (err, files) => {
      if (err || files.length === 0) {
        res.write('event: error\ndata: {"error":"Failed to read temp dir"}\n\n');
        cleanup();
        res.end();
        return;
      }
      
      const repoDir = files.find(f => f !== 'repo.tar.gz');
      if (!repoDir) {
        res.write('event: error\ndata: {"error":"Repo extraction failed"}\n\n');
        cleanup();
        res.end();
        return;
      }
      
      const repoPath = path.join(workTempDir, repoDir);

      const geminiProc = exec(`bash "${RUN_GEMINI_PATH}" "${PROMPT_PATH}" "${profilePath}"`, { cwd: repoPath });
      
      geminiProc.stdout.on('data', chunk => {
        // Stream progress to client
        res.write(`data: ${chunk}\n\n`);
      });

      geminiProc.stderr.on('data', chunk => {
        res.write(`event: log\ndata: ${JSON.stringify(chunk)}\n\n`);
      });

      geminiProc.on('close', code => {
        if (code === 0) {
          const expectedJsonPath = path.join(workOutputDir, 'profile.json');
          
          fs.readFile(expectedJsonPath, 'utf8', (err, data) => {
            if (!err) {
              console.log(data);

              const jsonLine = JSON.stringify(JSON.parse(data));

              console.log(jsonLine);
              
              res.write(`event: profile\ndata: ${jsonLine}\n\n`);
            } else {
              res.write(`event: error\ndata: {"error":"${err.message}"}\n\n`);
            }
            cleanup();
            res.end();
          });
        } else {
          res.write(`event: error\ndata: {"error":"Gemini analysis failed with code ${code}"}\n\n`);
          cleanup();
          res.end();
        }
      });
    });
  });
});

app.listen(2841, () => {
  console.log('Server running on http://localhost:2841');
});
