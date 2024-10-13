const fs = require('fs/promises');
const path = require('path');
const { insertPlaceVisits, insertRecords, removePlaceVists, removeRecords } = require('./db');

/**
 * Add your Google Maps Takeout Paths here.
 * semanticHistoryPath is the 'location-history' folder
 * rawRecordsPaths are the JSON files that contain your raw location
 * data (split out from the giant Records.json)
 */
const semanticHistoryPath = './location-history';
const rawRecordsPaths = [
  './splitRecords/records0.json',
  './splitRecords/records1.json',
  './splitRecords/records2.json',
  './splitRecords/records3.json',
];

async function loadRecordFile(filepaths) {
  let records = [];
  for (const filepath of filepaths) {
    const file = await fs.readFile(filepath);
    const data = JSON.parse(file.toString());
    records = [...records, ...data];
  }
  console.log(records.length);
  const chunksize = 1000;
  let currentChunk = 0;
  while (currentChunk < records.length) {
    console.log(`Working on Chunk ${currentChunk} - ${currentChunk + chunksize}`);
    const chunk = records.slice(currentChunk, currentChunk + chunksize);
    await insertRecords(chunk.map((val) => ({
      lat: val.latitudeE7,
      lng: val.longitudeE7,
      timestamp: new Date(val.timestamp).getTime(),
      accuracy: val.accuracy,
      source: val.source,
    })));
    currentChunk += chunksize;
  }
}
async function findLocationFiles(takeoutPath) {
  const years = await fs.readdir(takeoutPath);
  const segments = [];
  for (const year of years) {
    let months;
    try {
      months = await fs.readdir(path.join(takeoutPath, year));
      // eslint-disable-next-line no-unused-vars
    } catch (error) {
      continue;
    }
    for (const month of months) {
      const file = await fs.readFile(path.join(takeoutPath, year, month));
      const json = JSON.parse(file.toString());
      await insertPlaceVisits(
        json.timelineObjects
          .filter((segment) => !!segment.placeVisit)
          .map((segment) => segment.placeVisit)
          .map((segment) => {
            let { name, address } = segment.location;
            if (segment.location.semanticType === 'TYPE_HOME') {
              name = 'Home';
            } else if (segment.location.semanticType === 'TYPE_WORK') {
              name = 'Home';
            } else if (segment.location.semanticType === 'TYPE_SEARCHED_ADDRESS') {
              name = 'Searched Address';
              address = 'Searched Address';
            } else if (segment.location.semanticType === 'TYPE_ALIASED_LOCATION') {
              name = segment.location.name || 'Aliased Location';
              address = segment.location.address || 'Aliased Location';
            } else if (!segment.location.semanticType || segment.location.semanticType === 'TYPE_UNKNOWN') {
              name = segment.location.name || 'Unknown';
              address = segment.location.address || 'Unknown';
            }
            const placeId = segment.location.placeId ?? '';
            if (!address || !name) {
              console.log(name, segment);
            }
            return {
              lat: segment.location.latitudeE7,
              lng: segment.location.longitudeE7,
              address,
              name,
              placeId,
              locationConfidence: segment.location.locationConfidence,
              startTimestamp: new Date(segment.duration.startTimestamp).getTime(),
              endTimestamp: new Date(segment.duration.endTimestamp).getTime(),
            };
          }),
      );
      segments.push(...json.timelineObjects
        .filter((segment) => !!segment.placeVisit));
    }
  }
  console.log(`Found ${segments.length} segments in total`);
  return segments;
}

const CLEAN_DATABASE = false;
async function main() {
  if (CLEAN_DATABASE) {
    await removeRecords();
    await removePlaceVists();
  }
  await loadRecordFile(rawRecordsPaths);
  await findLocationFiles(semanticHistoryPath);
}

main();
