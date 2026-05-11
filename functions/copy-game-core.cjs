"use strict";

const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "game-core.js");
const dest = path.join(__dirname, "game-core.js");

fs.copyFileSync(src, dest);
