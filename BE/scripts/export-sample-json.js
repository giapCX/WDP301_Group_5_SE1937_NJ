const fs = require('node:fs');
const path = require('node:path');
const { EJSON } = require('mongoose').mongo.BSON;
const data = require('../src/config/sample-data');

const directory = path.join(__dirname, '../data/sample');
fs.mkdirSync(directory, { recursive: true });

for (const [collection, rows] of Object.entries(data)) {
  const file = path.join(directory, `${collection}.json`);
  fs.writeFileSync(file, EJSON.stringify(rows, null, 2, { relaxed: true }) + '\n');
  console.log(`${collection}.json: ${rows.length} documents`);
}
