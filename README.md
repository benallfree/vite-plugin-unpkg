# vite-plugin-unpkg

A Vite plugin for no-build setups that replaces unpkg URLs with local monorepo packages during development.

## What it does

When developing in a monorepo, you might want to import scripts directly from unpkg for production while using local workspace packages during development. This plugin automatically replaces `https://unpkg.com/<package>` URLs with local versions when the package exists in your monorepo.

## Installation

```bash
bun install vite-plugin-unpkg
```

## Usage

Add the plugin to your `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import { unpkg } from 'vite-plugin-unpkg'

export default defineConfig(({ mode }) => ({
  publicDir: 'public',
  plugins: [unpkg({ mode, root: __dirname })],
}))
```

## How it works

1. **Transform phase**: During development, the plugin scans your code for unpkg URLs
2. **Package detection**: It checks if the package name matches any workspace package in your monorepo
3. **URL replacement**: Replaces `https://unpkg.com/<package>` with `/@unpkg/<package>` for local packages only
4. **Local serving**: Sets up a dev server middleware to serve the actual files from your workspace using `resolve.exports`

## Example

If you have a workspace package called `@myorg/utils`, this import:

```js
import { helper } from 'https://unpkg.com/@myorg/utils'
```

Will be automatically transformed to:

```js
import { helper } from '/@unpkg/@myorg/utils'
```

And served from your local workspace during development, while remaining as the unpkg URL in production builds.

## Configuration

- `mode`: The build mode (typically from Vite's config)
- `root`: The root directory (typically `__dirname`)

## Development

```bash
bun install
bun run dev
```

This project was created using `bun init` in bun v1.2.2. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
