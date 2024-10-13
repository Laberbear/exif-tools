const path = require('path');
const fs = require('fs').promises;
const { default: DmsCoordinates } = require('dms-conversion');
const { getExifFromFile, addExifToFile } = require('./exifWrapper');
const { findRecord, findPlaceVisit } = require('./db');

/**
 * Add the paths to your photos here
 * It's not recursive, so if you have subfolders you also have to add them here
 */
const photoLibs = [
  '/path/to/my/photos',
];

// Maximum Time in ms a raw location record can be before/after the photo was taken
// If further away, we declare it as stale and will not use it for GPS data
const DELTA_THRESHOLD = 1000 * 60 * 20;

async function timeToLocation(timestamp) {
  const placeVisit = await findPlaceVisit(timestamp);
  if (placeVisit) {
    return {
      placeVisit: true,
      ...placeVisit,
    };
  }
  const record = await findRecord(timestamp);
  if (record.delta > DELTA_THRESHOLD) {
    return null;
  }
  return {
    locationRecord: true,
    ...record,
  };
}

async function getTimeFromPhoto(filepath) {
  const exif = await getExifFromFile(filepath);
  if (!exif || Object.keys(exif).length === 0) {
    return { noExifData: true };
  }
  const timestamp = exif['Exif.Photo.DateTimeDigitized']
    ?? exif['Exif.Image.DateTime'];
  const utcOffset = exif['Exif.Photo.OffsetTime'];
  if (
    (exif['Exif.GPSInfo.GPSLatitude'] && !exif['Exif.GPSInfo.GPSProcessingMethod'])
    || (exif['Exif.GPSInfo.GPSProcessingMethod']
      && !exif['Exif.GPSInfo.GPSProcessingMethod'].includes('GoogleMapsInfer'))
  ) {
    console.log('skipping', filepath, 'because it already has gps');
    return { alreadyHasGps: true };
  }
  if (!timestamp) {
    return { noExifData: true };
  }
  try {
    const [year, month, day, hour, minute, second] = timestamp.replace(' ', ':').split(':');
    let date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}.000`);
    if (utcOffset) {
      date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}.000${utcOffset}`);
    }
    return { time: date.getTime() };
  } catch (error) {
    console.error(filepath);
    console.error(exif);
    throw error;
  }
}

async function writeGps(file, location) {
  /**
   * Desired Outcome: (GPSTag gets written automatically)
   * Exif.Image.GPSTag                             746
   * Exif.GPSInfo.GPSLatitudeRef                   N
   * Exif.GPSInfo.GPSLatitude                      51/1 37/1 48163079/1000000
   * Exif.GPSInfo.GPSLongitudeRef                  E
   * Exif.GPSInfo.GPSLongitude                     10/1 28/1 27187319/1000000
   */
  const dms = new DmsCoordinates(location.lat, location.lng);
  const latitudeRef = dms.latitude.hemisphere;
  const longitudeRef = dms.longitude.hemisphere;
  const lat = dms.dmsArrays.latitude;
  const lng = dms.dmsArrays.longitude;
  const gpsLatitude = `${lat[0]}/1 ${lat[1]}/1 ${Math.round(lat[2] * 1000000)}/1000000`;
  const gpsLongtide = `${lng[0]}/1 ${lng[1]}/1 ${Math.round(lng[2] * 1000000)}/1000000`;

  const exif = {
    'Exif.Image.GPSTag': 746,
    'Exif.GPSInfo.GPSLatitudeRef': latitudeRef,
    'Exif.GPSInfo.GPSLatitude': gpsLatitude,
    'Exif.GPSInfo.GPSLongitudeRef': longitudeRef,
    'Exif.GPSInfo.GPSLongitude': gpsLongtide,
    'Exif.GPSInfo.GPSProcessingMethod': 'GoogleMapsInferV0',
  };

  // Get mtime for later rewrite
  const data = await fs.stat(file);
  try {
    await addExifToFile(file, exif);
    // Write back original modified time to leave the file as is
    await fs.utimes(file, data.atime, data.mtime);
  } catch (error) {
    // Write back original modified time to leave the file as is
    await fs.utimes(file, data.atime, data.mtime);
    throw error;
  }
}

async function getAllPhotos(photoLibs) {
  const files = [];
  for (const folder of photoLibs) {
    const folderFiles = await fs.readdir(folder);
    files.push(
      ...folderFiles
        .filter((file) => file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.jpeg'))
        .map((file) => path.join(folder, file)),
    );
  }
  return files;
}

async function main() {
  const files = await getAllPhotos(photoLibs);
  console.log(`Found ${files.length} photos`);

  const chunksize = 100;
  let currentIndex = 0;
  let conversionCount = 0;
  const deltas = [];
  const stats = {
    total: 0,
    errors: 0,
    alreadyHasGps: 0,
    noExifData: 0,
    gpsViaPlaceVisit: 0,
    gpsViaLocationRecord: 0,
    noLocationFound: 0,
  };
  let chunkStart = Date.now();
  while (files.length >= currentIndex) {
    console.log(`Working on Chunk: ${currentIndex}/${files.length}
      Last Chunk took ${((Date.now() - chunkStart) / 1000).toFixed(2)}s`);
    chunkStart = Date.now();
    const chunk = files.slice(currentIndex, currentIndex + chunksize);
    currentIndex += chunksize;
    const promises = chunk.map(async (file) => {
      stats.total += 1;
      const { time, alreadyHasGps, noExifData } = await getTimeFromPhoto(file);
      if (alreadyHasGps) {
        stats.alreadyHasGps += 1;
        return;
      }
      if (noExifData) {
        stats.noExifData += 1;
        return;
      }
      if (time) {
        try {
          const location = await timeToLocation(time);
          if (location?.placeVisit) {
            stats.gpsViaPlaceVisit += 1;
          } else if (location?.locationRecord) {
            stats.gpsViaLocationRecord += 1;
            deltas.push(location.delta);
          } else {
            stats.noLocationFound += 1;
            return;
          }
          await writeGps(file, location);
        } catch (error) {
          stats.errors += 1;
          console.error(`Error on File ${file}`);
          console.error(error);
        }
      } else {
        stats.errors += 1;
        console.log(`skipping ${file}`);
      }
    });

    await Promise.all(promises);
    conversionCount += chunk.length;
  }
  console.log('Total files converted (or tried to)', conversionCount);
  console.log(stats);
}

main();
