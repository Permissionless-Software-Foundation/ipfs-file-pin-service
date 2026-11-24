# Docker Containers

The 'production' environment is assumed to be a set of Docker containers orchestrated with Docker Compose. The files in this directory will stand up two Docker containers:

1 An instance of MongoDB.
2 The JavaScript software in this repository.

The software in this repository depends on the MongoDB container, so if it isn't running correctly, the application won't run correctly either.

There is no IPFS container: the IPFS node is embedded in this application. It is created at startup by the `helia-coord` library (see `src/adapters/ipfs/ipfs.js`), and its datastore is kept in the `../data/ipfsdata` volume. Nothing needs to be installed or administered separately.

## IPFS

The embedded node's ports are set with environment variables in the `start-production.sh` shell script. By default the container uses the following ports:

- 4001 for TCP connections, exposed publicly. Set with `IPFS_TCP_PORT`.
- 4003 for WebSocket connections, exposed publicly. Set with `IPFS_WS_PORT`.
- 4005 for WebRTC connections, exposed publicly. Set with `IPFS_WEB_RTC_PORT`, and disabled unless `USE_WEB_RTC` is also set.

If you already have an IPFS node running on the computer, you will need to change these ports to avoid a conflict. Update the `IPFS_*` environment variables in the `start-production.sh` shell script, and the matching entries under `ports:` for the application service in `docker-compose.yml`. Then rebuild and restart the containers:

- `docker-compose build`
- `docker-compose up -d`

Note that the port changes also need to be announced to other peers if this node has a publicly accessible IP address; see the `CONNECT_PREF` setting in `start-production.sh`.
