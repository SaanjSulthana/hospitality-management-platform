#!/bin/bash
set -e

# Install dependencies
bun install

# Build the application
npx encore build
