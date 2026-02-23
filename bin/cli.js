#!/usr/bin/env node
import { main } from "../dist/cli/index.js";
await main(process.argv.slice(2));
