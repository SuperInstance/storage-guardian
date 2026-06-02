# Contributing to Storage Guardian

Thanks for your interest! Here's how to contribute.

## Development Setup

```bash
git clone https://github.com/SuperInstance/storage-guardian.git
cd storage-guardian
npm install
npm run build
npm test
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm test` | Run test suite |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run typecheck` | Type-check without emitting |
| `npm run cli` | Run CLI via ts-node |

## Project Structure

```
src/
├── core/           # Core types, StorageGuardian class, utilities
├── adapters/       # Storage providers (filesystem, S3, memory)
├── persistence/    # Scan history backends
├── export/         # Output formatters (JSON, Prometheus, Slack, Markdown)
├── alerting/       # Alert rules engine
├── trend/          # Trend analysis and report comparison
├── cli.ts          # CLI entry point
└── index.ts        # Main exports
```

## Guidelines

### Code Style

- TypeScript strict mode enabled
- No `any` types in public APIs
- Use `node:` protocol imports for Node.js built-ins
- Async iterables for streaming operations

### Adding a Storage Provider

1. Implement the `StorageProvider` interface from `src/core/types.ts`
2. Add your provider to `src/adapters/`
3. Export from `src/adapters/index.ts` and `src/index.ts`
4. Add tests in `src/__tests__/`

### Adding an Export Format

1. Add a formatter function in `src/export/index.ts`
2. Add the format to the `ExportOptions` type in `src/core/types.ts`
3. Update the CLI to support the new format
4. Add tests

### Testing

- Write tests in `src/__tests__/`
- Use Jest matchers
- Test both success and error paths
- For file system tests, use `os.tmpdir()` for temporary files

### Commit Messages

- Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`
- Keep messages concise but descriptive

### Pull Requests

- One logical change per PR
- Include tests for new functionality
- Update documentation if needed
- Ensure `npm run typecheck` and `npm test` pass

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
