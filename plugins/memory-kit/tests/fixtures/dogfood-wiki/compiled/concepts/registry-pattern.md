# Registry Pattern

> Last updated: 2026-04-18 | Seen in: 1 features

## What It Is

A discovery mechanism where a central registry file (e.g., `.claude-plugin/marketplace.json`) at the repository root lists the names, locations, and descriptions of all available plugins or sub-tools.

## Why We Use It

Allows an AI agent (like Claude) to recognize a single repository as a collection of independent tools ("Marketplace") rather than one giant project. It provides a clean entry point for tool discovery across polyglot environments.

## Where Applied

- [[polyglot-marketplace-monorepo]] — Implemented via `.claude-plugin/marketplace.json` at the root.

## Contradictions / Open Questions

- Should the registry also include versioning or dependency info between plugins?
