#!/bin/bash

# BEGIN: Optional configuration settings

# This mnemonic is used to set up persistent public key for e2ee
# Replace this with your own 12-word mnemonic.
# You can get one at https://wallet.fullstack.cash.
export MNEMONIC="olive two muscle bottom coral ancient wait legend bronze useful process session"

# The human readable name this IPFS node identifies as.
export COORD_NAME=ipfs-file-pin-service


# Allow this node to function as a circuit relay. It must not be behind a firewall.
#export ENABLE_CIRCUIT_RELAY=true
# For browsers to use your circuit realy, you must set up a domain, SSL certificate,
# and you must forward that subdomain to the IPFS_WS_PORT.
#export CR_DOMAIN=subdomain.yourdomain.com

# ---------- Phase-1 (PS010) BCH pin payments ----------
# BCH-only pin pricing. Without these the service refuses to serve
# GET /ipfs/payment-address (it fails closed), so set them for production.
#
# The single, operator-controlled payout address that pin payments are
# sent to. It is the ONLY source of the payout address for clients.
# export PAYOUT_ADDRESS=bitcoincash:qquwutnj07qume8cu6jk6l8n8n8w8a9kjva7ntmy2m
#
# Pin price in satoshis per MB. There is no USD oracle; the operator keeps
# this value current. Example for roughly USD $0.01 per MB at a $200 BCH
# price: (0.01 / 200) * 100000000 = 5000.
# export SATS_PER_MB=5000

# ---------- Optional peer dials (STARTUP_PEERS) ----------
# Comma-separated IPFS multiaddrs dialed after Helia startup. Use this to
# connect to specific nodes on a private network (for example, an
# ipfs-file-stager instance that stages files for pinning). Each entry must
# be a full multiaddr including the /p2p/<peer-id> component.
# export STARTUP_PEERS="/ip4/127.0.0.1/tcp/4002/p2p/12D3KooWxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# END: Optional configuration settings


# Production database connection string.
export DBURL=mongodb://172.17.0.1:5556/ipfs-service-prod

# Configure REST API port
export PORT=5031

# Production settings for the embedded helia-coord IPFS node.
export SVC_ENV=prod
export IPFS_TCP_PORT=4001
export IPFS_WS_PORT=4003
export IPFS_WEB_RTC_PORT=4005
# Set the debug level for helia-coord. 0-3.
# 0 = no debug logs. 3 = maximum debug logs.
export DEBUG_LEVEL=0

# Use local instance of bch-api
#export WALLET_INTERFACE=web2
#export APISERVER=http://172.17.0.1:3000/v5/

# Use this if the IPFS node has a publically accessible IP address.
#export CONNECT_PREF=direct
# Use this if the IPFS node is behind a NAT or Firewall and cannot be accessed directly.
export CONNECT_PREF=cr

# --------------------------------------------------------------------
# IMPORTANT: `npm start` must remain the LAST statement in this file.
# The server blocks here until shutdown, so any environment variables
# exported below this line will never reach the application.
# --------------------------------------------------------------------
npm start
