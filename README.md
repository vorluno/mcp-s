<div align="center">

<img src="./assets/banner.jpg" alt="mcp-s — Vorluno's family of MCP servers" width="100%" />

# mcp-s

**Vorluno's family of Model Context Protocol servers.**

A curated index of the MCP servers we build to make AI coding agents faster, safer, and aware of each other.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Model Context Protocol](https://img.shields.io/badge/MCP-compatible-6E56CF)](https://modelcontextprotocol.io)
[![Built with Claude Code](https://img.shields.io/badge/Built_with-Claude_Code-D97757)](https://claude.com/claude-code)

</div>

---

> **Not a monorepo.** Each MCP lives in its **own independent repository** so it can be versioned, published, and cloned on its own. This repo is just the index.

## The servers

| MCP | Repo | What it does |
|-----|------|--------------|
| **batuta** | [vorluno/batuta-mcp](https://github.com/vorluno/batuta-mcp) | Splits a task into plans with **disjoint file boundaries** and scaffolds a git worktree per plan, so parallel agents never step on each other. |
| **agora** | [vorluno/agora-mcp](https://github.com/vorluno/agora-mcp) | A shared, persistent **per-repo space**: Claude Code sessions see what the others are doing, get collision warnings, and leave notes (hooks + MCP + SQLite WAL). |

Two complementary takes on multi-agent coding: **batuta** prevents conflicts by *separation*; **agora** surfaces them through *shared awareness*.

## Conventions

- Each new MCP gets its own repo, `vorluno/<name>-mcp`.
- When created, add a row to the table above.
- Typical connection (stdio): `claude mcp add <name> -- bun run /path/to/<name>-mcp/src/index.ts`, or the equivalent `mcpServers` JSON in Warp / Cursor.

## License

[MIT](./LICENSE) © 2026 Vorluno

---

<div align="center">

Built by **[Vorluno](https://vorluno.dev)** — a software studio from Panamá 🇵🇦

</div>
