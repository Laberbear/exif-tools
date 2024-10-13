const { drizzle } = require('drizzle-orm/better-sqlite3');
const Database = require('better-sqlite3');
const {
  lte,
  desc,
  gte,
  asc,
  and,
} = require('drizzle-orm');
const { records, placeVisit } = require('./schema');

const sqlite = new Database('./data/sqlite.db');
const db = drizzle(sqlite);

async function insertRecords(locations) {
  return db.insert(records).values(locations).run();
}
async function insertPlaceVisits(placeVisits) {
  return db.insert(placeVisit).values(placeVisits).run();
}

async function removePlaceVists() {
  return db.delete(placeVisit).run();
}

async function removeRecords() {
  return db.delete(records).run();
}

async function findPlaceVisit(timestamp) {
  const fittingPlaceVisit = await db.select().from(placeVisit)
    .where(and(
      lte(placeVisit.startTimestamp, timestamp),
      gte(placeVisit.endTimestamp, timestamp),
    ))
    .limit(1);
  if (fittingPlaceVisit.length) {
    return {
      ...fittingPlaceVisit[0],
      lat: fittingPlaceVisit[0].lat / 10000000,
      lng: fittingPlaceVisit[0].lng / 10000000,
    };
  }
  return null;
}

async function findRecord(timestamp) {
  if (!timestamp) {
    throw Error('timestamp is not gud');
  }
  const before = await db.select().from(records)
    .where(lte(records.timestamp, timestamp))
    .orderBy(desc(records.timestamp))
    .limit(1);
  const after = await db.select().from(records)
    .where(gte(records.timestamp, timestamp))
    .orderBy(asc(records.timestamp))
    .limit(1);
  const beforeRecord = before[0];
  const afterRecord = after[0];
  let beforeDelta = Number.MAX_SAFE_INTEGER;
  let afterDelta = Number.MAX_SAFE_INTEGER;
  if (!beforeRecord && !afterRecord) {
    return null;
  }
  if (beforeRecord) {
    beforeDelta = timestamp - before[0].timestamp;
  }
  if (afterRecord) {
    afterDelta = after[0].timestamp - timestamp;
  }

  let selectedDelta = afterDelta;
  let [selected] = after;
  if (beforeDelta < afterDelta) {
    [selected] = before;
    selectedDelta = beforeDelta;
  }

  return {
    ...selected,
    lat: selected.lat / 10000000,
    lng: selected.lng / 10000000,
    delta: selectedDelta,
  };
}

module.exports = {
  insertRecords,
  findRecord,
  insertPlaceVisits,
  findPlaceVisit,
  removePlaceVists,
  removeRecords,
};
