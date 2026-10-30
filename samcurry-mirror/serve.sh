#!/bin/bash
cd "$(dirname "$0")/samcurry.net" && python3 -m http.server 8080
