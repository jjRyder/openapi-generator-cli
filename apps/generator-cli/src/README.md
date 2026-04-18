# @jjRyder/openapi-generator-cli

A fork of [@openapitools/openapi-generator-cli](https://github.com/OpenAPITools/openapi-generator-cli) that bundles a custom JAR from [jjRyder/openapi-generator](https://github.com/jjRyder/openapi-generator).

The bundled JAR  is included directly in the npm package — no downloads from Maven Central at runtime.

## What's different from the original

The fork extends the **typescript-fetch** generator:

- **OneOf response support** — responses with `oneOf` schemas are deserialized as union types (`A | B | C`). Each candidate type is tried at runtime, with proper imports and serialization logic generated automatically.
- **Structured error handling** — every response status code (both success and error) is handled explicitly. Non-2xx responses have their bodies deserialized (including oneOf) before throwing a `ResponseError` with access to both `response` and parsed `body`.
- **`onErrorResponse` callback** — a centralized hook in `ConfigurationParameters` that is called for all error responses, enabling global error handling (e.g. toasts, logging, i18n) in a single place.

## Installation

### Prerequisites

- **Node.js** >= 20
- **Java** >= 11 (JDK on `PATH`). To install OpenJDK: https://adoptium.net/
- **pnpm** (recommended) or npm

### 1. Configure GitHub Packages registry

Create or edit `.npmrc` in your project root:

```
@jjRyder:registry=https://npm.pkg.github.com
```

The token needs the `read:packages` scope. You can generate one at https://github.com/settings/tokens.

### 2. Install the package

```sh
pnpm add -D @jjRyder/openapi-generator-cli
```

### 3. Create `openapitools.json`

Create `openapitools.json` in your project root:

```json
{
  "$schema": "./node_modules/@jjRyder/openapi-generator-cli/config.schema.json",
  "spaces": 2,
  "generator-cli": {
    "version": "1.0.0"
  }
}
```

Add this file to version control.

### 4. Add a generate script

In your `package.json`:

```json
{
  "scripts": {
    "generate-api": "openapi-generator-cli generate -i http://localhost:5101/swagger/v1/swagger.json -g typescript-fetch -o lib/api-client/codegen --additional-properties=supportsES6=true,typescriptThreePlus=true"
  }
}
```

Adjust `-i` (input spec URL or file path), `-o` (output directory), and `--additional-properties` to your project.

### 5. Generate

```sh
pnpm run generate-api
```

## Local development (without GitHub Packages)

If you're working with the source and want to link the package locally instead of pulling from GitHub Packages:

```sh
# In your project's package.json, use a file: reference:
pnpm add -D @jjRyder/openapi-generator-cli@file:../../path/to/openapi-generator-cli/dist/apps/generator-cli
```

Make sure you've built the package first:

```sh
cd openapi-generator-cli
pnpm install
pnpm run build:package
```

## Build & Publish

```bash
cd openapi-generator-cli

# 1. Install dependencies
pnpm install

# 2. Build the Java fork (if not already built)
cd ../openapi-generator
./mvnw -pl modules/openapi-generator-cli -am clean package -DskipTests

# 3. Build the npm package (CLI + bundled JAR)
# Bump version
# npm version patch   # or minor / major
cd ../openapi-generator-cli

# 4. Build and Publish to GitHub Packages
pnpm run publish
```

## Configuration

The `openapitools.json` file supports generator presets for convenient multi-spec generation:

```json
{
  "$schema": "./node_modules/@jjRyder/openapi-generator-cli/config.schema.json",
  "spaces": 2,
  "generator-cli": {
    "version": "1.0.0",
    "generators": {
      "backend-api": {
        "generatorName": "typescript-fetch",
        "output": "#{cwd}/lib/api-client/codegen",
        "inputSpec": "http://localhost:8080/swagger/v1/swagger.json",
        "additionalProperties": {
          "supportsES6": "true",
          "typescriptThreePlus": "true"
        }
      }
    }
  }
}
```

Then simply run:

```sh
pnpm exec openapi-generator-cli generate
```

### Available placeholders

| placeholder | description                                        | example                                               |
|-------------|----------------------------------------------------|-------------------------------------------------------|
| name        | file name without extension                        | auth                                                  |
| Name        | file name, capitalized                             | Auth                                                  |
| cwd         | current working directory                          | /Users/user/projects/my-project                       |
| base        | file name with extension                           | auth.yaml                                             |
| path        | full path                                          | /Users/user/projects/my-project/docs/auth.yaml        |
| dir         | directory of the file                              | /Users/user/projects/my-project/docs                  |
| relDir      | directory relative to the glob                     | docs                                                  |
| relPath     | path relative to the glob                          | docs/auth.yaml                                        |
| ext         | file extension                                     | yaml                                                  |

## Other versions

The bundled version is `1.0.0`. Other versions from the original openapi-generator (7.x, 6.x, 5.x, etc.) are still available — the CLI will download them from Maven Central on demand if you change the `version` in `openapitools.json`. However, those versions won't include the fork's typescript-fetch enhancements.
