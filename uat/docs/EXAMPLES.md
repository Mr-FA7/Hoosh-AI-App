# UAT — Example Scenarios

## OS & shell

```bash
uat doctor
```

Shows detected OS, available shells, and package manager hints.

## Unified intents (cross-shell)

```bash
uat unified list.files
uat unified show.cwd
```

Maps to `ls -la` / `dir` / `Get-ChildItem` automatically.

## Raw shell execution (with safety)

```bash
uat exec "echo hello"
uat exec "dir"           # Windows CMD/PowerShell context via default shell
```

Blocked patterns (e.g. destructive `rm -rf /`) exit without running. Use `--yes` only after review for `confirm`-tier rules.

## Natural language → command (Ollama)

```bash
export OLLAMA_HOST=http://127.0.0.1:11434
uat ask "show all files in current directory including hidden"
uat ask "print working directory" --exec --yes
```

## Runtime recipes (print only; run manually)

```bash
uat runtime list
uat runtime install node
```

## Project detection

```bash
uat project .
```

## Self-update check (configure repo first)

```bash
export UAT_UPDATE_REPO=your-org/universal-ai-terminal
uat update check
```

## Plugins

```bash
uat plugins
```
