# ipfs-file-pin-service

[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com) [![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

## Overview

This project runs a [Helia](https://github.com/ipfs/helia) IPFS node and REST API server that provides **paid IPFS file pinning** using the [PSF File Pinning Protocol (PS010)](https://github.com/Permissionless-Software-Foundation/specifications/blob/master/ps010-file-pinning-protocol.md). It is forked from [ipfs-service-provider](https://github.com/Permissionless-Software-Foundation/ipfs-service-provider).

The service is activated by [psf-slp-indexer-g2](https://github.com/Permissionless-Software-Foundation/psf-slp-indexer-g2) via webhook. When a new [Pin Claim](https://github.com/Permissionless-Software-Foundation/specifications/blob/master/ps010-file-pinning-protocol.md) is detected on the blockchain, the service:

1. Validates that a proper proof-of-burn of PSF tokens was submitted with the claim.
2. Verifies that the burn amount meets the required cost based on file size.
3. Downloads the IPFS content and pins it to the local Helia node.
4. Serves the pinned content via HTTP download and view endpoints.

## Features

- **Blockchain-Validated Pinning** -- Processes Pin Claims from the Bitcoin Cash blockchain and validates proof-of-burn transactions against the PSF token write price set by the [PSF Minting Council](https://PSFoundation.cash).
- **Embedded Helia IPFS Node** -- Runs a full Helia IPFS node with TCP, WebSocket, and optional WebRTC transports. Supports circuit relay for nodes behind NATs/firewalls.
- **Dual API Interface** -- Exposes both a REST API over HTTP and a JSON-RPC API over IPFS for decentralized access.
- **File Downloads and Viewing** -- Serves pinned content via HTTP endpoints for direct file download and in-browser viewing.
- **Automatic Retry Queue** -- Failed downloads are retried with a concurrent queue (up to 20 parallel downloads, 5-minute timeout per attempt).
- **Pin Renewals** -- Supports renewing pins with additional proof-of-burn transactions.
- **Dynamic Pricing** -- Fetches the current write price from the PSF Minting Council so pin costs stay in sync with token valuation.
- **User Management** -- Built-in user authentication with JWT tokens and Passport.js.
- **Periodic Maintenance** -- Timer-based controllers handle pin processing (every 10 minutes), usage cleanup (every hour), and automatic restarts (every 6 hours).

## Requirements

- Node.js **^20.16.0**
- npm **^10.8.1**
- MongoDB **4.2+**
- Docker **^24.0.7** (production deployment)
- Docker Compose **^1.27.4** (production deployment)

## Installation

### Production Environment (Docker)

The recommended way to run in production is with Docker Compose. The [production/docker](./production/docker) directory contains the Dockerfile and Compose configuration.

```bash
cd production/docker
docker-compose up -d
```

This starts two containers:

| Container              | Description                      | Ports                                      |
|------------------------|----------------------------------|--------------------------------------------|
| `mongo-file-service`   | MongoDB 4.2 database             | `5556` -> `27017`                          |
| `file-service`         | Application server               | `5031` (REST), `4001` (TCP), `4003` (WS), `4005` (WebRTC) |

- Bring containers down: `docker-compose down`
- Bring containers back up: `docker-compose up -d`
- View logs: `docker-compose logs -f file-service`

Production environment variables are set in [production/docker/start-production.sh](./production/docker/start-production.sh). Edit this file to configure your deployment before starting containers.

### Development Environment

```bash
git clone https://github.com/Permissionless-Software-Foundation/ipfs-file-pin-service
cd ipfs-file-pin-service
./install-mongo.sh
npm install
npm start
```

The development server starts on port `5031` by default and connects to a local MongoDB instance at `mongodb://localhost:27017/ipfs-file-pin-dev`.

## Configuration

The application is configured through environment variables. All configuration is centralized in [config/env/common.js](./config/env/common.js), with environment-specific overrides in the `config/env/` directory.

### Server

| Variable              | Description                                        | Default                  |
|-----------------------|----------------------------------------------------|--------------------------|
| `PORT`                | REST API port                                      | `5031`                   |
| `SVC_ENV`             | Environment: `development`, `test`, or `prod`      | `development`            |
| `NO_MONGO`            | Disable MongoDB (set to any value to enable)       | *unset* (MongoDB enabled)|
| `ADMIN_PASSWORD`      | Admin account password                             | *unset*                  |
| `DISABLE_NEW_ACCOUNTS`| Disable new user account creation                  | *unset* (accounts enabled)|

### IPFS Node

| Variable               | Description                                                     | Default                  |
|------------------------|-----------------------------------------------------------------|--------------------------|
| `DISABLE_IPFS`         | Disable the IPFS node at startup (set to any value to disable)  | *unset* (IPFS enabled)   |
| `COORD_NAME`           | Human-readable name for the IPFS node                           | `ipfs-bch-wallet-service`|
| `DEBUG_LEVEL`          | helia-coord debug verbosity (0=none, 3=max)                     | `2`                      |
| `IPFS_TCP_PORT`        | IPFS TCP transport port                                         | `4001`                   |
| `IPFS_WS_PORT`         | IPFS WebSocket transport port                                   | `4003`                   |
| `IPFS_WEB_RTC_PORT`    | IPFS WebRTC transport port                                      | `4005`                   |
| `CONNECT_PREF`         | Connection preference: `cr` (circuit relay) or `direct`         | `cr`                     |
| `ENABLE_CIRCUIT_RELAY` | Enable circuit relay mode (node must not be behind a firewall)  | *unset* (disabled)       |
| `CR_DOMAIN`            | SSL domain for WebSocket circuit relay connections               | *unset*                  |
| `USE_WEB_RTC`          | Enable WebRTC transport                                         | `false`                  |
| `IPFS_HOST`            | External IPFS host (production)                                 | `localhost`              |
| `IPFS_API_PORT`        | External IPFS API port (production)                             | `5001`                   |
| `WEB2_API`             | Public REST API URL announced to IPFS peers                     | *unset*                  |

### Wallet

| Variable           | Description                                                         | Default                          |
|--------------------|---------------------------------------------------------------------|----------------------------------|
| `MNEMONIC`         | 12-word BCH mnemonic for encryption keys and payment address        | *empty* (required for production)|
| `WALLET_FILE`      | Path to a wallet file generated by psf-bch-wallet                   | `./wallet.json`                  |
| `WALLET_INTERFACE` | Wallet connection mode: `web3` (IPFS JSON-RPC) or `web2` (HTTP REST)| `web3`                          |
| `APISERVER`        | BCH API server URL (used with `web2` interface)                     | `https://api.fullstack.cash/v5/` |
| `WALLET_AUTH_PASS` | Basic auth password for the web2 API                                | *empty*                          |

### File Pinning

| Variable         | Description                                        | Default                  |
|------------------|----------------------------------------------------|--------------------------|
| `MAX_PIN_SIZE`   | Maximum allowable file size in bytes                | `100000000` (100 MB)     |
| `REQ_TOKEN_QTY`  | Default PSF tokens required per MB (overridden by Minting Council lookup) | `0.03570889` |
| `DOMAIN_NAME`    | Base URL for file download links                   | `http://localhost:5031`  |

### Email (optional)

| Variable      | Description        | Default                   |
|---------------|--------------------|---------------------------|
| `EMAILSERVER` | SMTP server        | `mail.someserver.com`     |
| `EMAILUSER`   | Email username      | `noreply@someserver.com`  |
| `EMAILPASS`   | Email password      | *empty*                   |

### Database (per environment)

| Environment   | Connection String                                  |
|---------------|----------------------------------------------------|
| Development   | `mongodb://localhost:27017/ipfs-file-pin-dev`      |
| Test          | `mongodb://localhost:27017/ipfs-file-pin-test`     |
| Production    | `mongodb://172.17.0.1:5555/ipfs-file-pin-prod` (or override with `DBURL`) |

## REST API Endpoints

The REST API is served on the configured `PORT` (default `5031`). Generated API documentation is available at the root URL after running `npm run docs`.

### IPFS (`/ipfs`)

| Method | Endpoint                   | Description                              |
|--------|----------------------------|------------------------------------------|
| GET    | `/ipfs`                    | Get IPFS node status                     |
| POST   | `/ipfs/peers`              | List connected peers                     |
| POST   | `/ipfs/relays`             | List circuit relay connections            |
| POST   | `/ipfs/connect`            | Connect to a specific peer               |
| POST   | `/ipfs/pin-claim`          | Submit a pin claim (webhook endpoint)    |
| GET    | `/ipfs/pin-status/:cid`    | Get pin status for a CID                |
| GET    | `/ipfs/pins/:page`         | List pins (paginated, 20 per page)       |
| GET    | `/ipfs/unprocessed-pins`   | List unprocessed pin claims              |
| POST   | `/ipfs/pin-local-file`     | Upload and pin a file via HTTP           |
| GET    | `/ipfs/download/:cid/:name?` | Download a pinned file                 |
| GET    | `/ipfs/view/:cid/:name?`  | View a pinned file in the browser        |
| GET    | `/ipfs/download-cid/:cid`  | Download any CID from the IPFS network  |
| GET    | `/ipfs/node`               | Get this node's IPFS identity            |

### Auth (`/auth`)

| Method | Endpoint        | Description      |
|--------|----------------|------------------|
| POST   | `/auth/login`  | User login       |
| POST   | `/auth/logout` | User logout      |

### Users (`/users`)

| Method | Endpoint       | Description      |
|--------|---------------|------------------|
| POST   | `/users`      | Create user      |
| GET    | `/users/:id`  | Get user         |
| PUT    | `/users/:id`  | Update user      |
| DELETE | `/users/:id`  | Delete user      |

### Other

| Method | Endpoint    | Description                        |
|--------|------------|------------------------------------|
| POST   | `/contact` | Send a contact message via email   |
| GET    | `/logs`    | View application logs (password protected) |
| GET    | `/usage`   | Get usage statistics               |

### JSON-RPC API (over IPFS)

In addition to the REST API, the service exposes a JSON-RPC interface over IPFS using [helia-coord](https://www.npmjs.com/package/helia-coord). This allows decentralized access without a direct HTTP connection. Available RPC methods include `pinClaim`, `getFileMetadata`, `getPins`, `users`, `auth`, and `about`.

[psf-bch-wallet](https://github.com/Permissionless-Software-Foundation/psf-bch-wallet) is a CLI tool that can interact with this JSON-RPC API.

## File Structure

This repository follows [Clean Architecture](https://christroutner.github.io/trouts-blog/blog/clean-architecture) principles:

```
src/
├── adapters/          # Interfaces to external services (IPFS, MongoDB, wallet)
│   ├── ipfs/          # Helia IPFS node adapter
│   ├── localdb/       # Mongoose models and database adapter
│   └── wallet.adapter.js
├── controllers/       # Input handlers
│   ├── rest-api/      # Koa REST API routes and middleware
│   ├── json-rpc/      # JSON-RPC handlers (over IPFS)
│   └── timer-controllers.js  # Periodic tasks (pin processing, cleanup)
├── entities/          # Business logic validation
└── use-cases/         # Application business rules
```

## Usage

| Command                | Description                       |
|------------------------|-----------------------------------|
| `npm start`            | Start the server                  |
| `npm test`             | Run unit tests                    |
| `npm run test:all`     | Run unit and e2e tests            |
| `npm run test:e2e:auto`| Run e2e tests only                |
| `npm run lint`         | Lint code with Standard.js        |
| `npm run docs`         | Generate API documentation        |
| `npm run coverage:report` | Generate HTML coverage report  |

## Documentation

API documentation is written inline and generated by [apidoc](http://apidocjs.com/):

```bash
npm run docs
```

Then visit `http://localhost:5020/` to view the generated docs.

There is additional developer documentation in the [dev-docs](./dev-docs) directory.

## License

[MIT](./LICENSE.md)
