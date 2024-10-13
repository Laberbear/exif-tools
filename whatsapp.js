const { addExifToFile } = require('./exifWrapper');
const fs = require('fs').promises;

const DEFAULT_TIMEOFFSET = '+02:00';

async function handleFile(filepath) {
  const fileName = filepath.split('/').slice(-1)[0].replace('IMG-', '');
  const year = fileName.substring(0, 4);
  const month = fileName.substring(4, 6);
  const day = fileName.substring(6, 8);
  let timestring = `${year}:${month}:${day} 12:00:00`;
  const fileNameTime = new Date();
  fileNameTime.setFullYear(year, month - 1, day);
  fileNameTime.setHours(12, 0);
  const data = await fs.stat(filepath);

  // If the mtime (modified time) of the file is on the same day
  // Assume that this is much closer to the actual time the file
  // was received over whatsapp than just using 12:00
  // So we retrieve it, check it and also use it to rewrite the same mtime later on
  // This also changes the ctime, but who cares
  const fileMTime = data.mtime;
  if (
    fileMTime.getDate() === fileNameTime.getDate()
    && fileMTime.getMonth() === fileNameTime.getMonth()
    && fileMTime.getFullYear() === fileNameTime.getFullYear()
  ) {
    const time = fileMTime.toTimeString().split(' ')[0];
    timestring = `${year}:${month}:${day} ${time}`;
  }
  try {
    console.log(`Handling ${fileName} (${timestring})`);
    await addExifToFile(filepath, {
      'Exif.Image.Make': 'WhatsApp',
      'Exif.Photo.DateTimeDigitized': timestring,
      'Exif.Photo.DateTimeOriginal': timestring,
      'Exif.Photo.OffsetTime': DEFAULT_TIMEOFFSET,
      'Exif.Photo.OffsetTimeOriginal': DEFAULT_TIMEOFFSET,
    });
    // Write back original modified time to leave the file as is
    await fs.utimes(filepath, data.atime, data.mtime);
  } catch (error) {
    // Write back original modified time to leave the file as is
    await fs.utimes(filepath, data.atime, data.mtime);
    throw error;
  }
}

async function handleFolder(folderPath) {
  console.log('Handling the following folder:', folderPath);
  const files = await fs.readdir(folderPath);
  const whatsAppFiles = files.filter((file) => {
    const parts = file.split('-');
    return file.startsWith('IMG-')
      && file.endsWith('.jpg')
      && parts.length === 3
      && parts[1].length === 8
      && parts[2].includes('WA');
  });
  console.log(`Found ${whatsAppFiles.length} WhatsApp Images (of ${files.length} in total)`);

  const chunksize = 100;
  let currentIndex = 0;
  let conversionCount = 0;
  while (whatsAppFiles.length >= currentIndex) {
    const chunk = whatsAppFiles.slice(currentIndex, currentIndex + chunksize);
    currentIndex += chunksize;
    const promises = chunk.map((file) => handleFile(`${folderPath}/${file}`));

    await Promise.all(promises);
    conversionCount += chunk.length;
  }
  console.log(`Converted ${conversionCount} of ${whatsAppFiles.length} (maybe had some errors)`);
}

console.log('Script starting');
handleFolder(process.argv[2])
  .then(() => process.exit(0))
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
