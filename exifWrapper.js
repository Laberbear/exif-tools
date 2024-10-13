const util = require('util');
const exec = util.promisify(require('child_process').exec);

async function addExifToFile(filePath, exifObj) {
  const sanitizedPath = filePath.replace(/ /gm, '\\ ')
    .replace(/\(/gm, '\\(')
    .replace(/\)/gm, '\\)');
  let commandString = './exiv2/bin/exiv2';
  let delCommandString = './exiv2/bin/exiv2';
  for (const [key, val] of Object.entries(exifObj)) {
    if (key === 'Exif.GPSInfo.GPSLatitude' || key === 'Exif.GPSInfo.GPSLongitude') {
      delCommandString += ` -M"del ${key} Rational"`;
      commandString += ` -M"add ${key} Rational ${val}"`;
    } else if (key === 'Exif.Image.GPSTag') {
      delCommandString += ` -M"del ${key} Ascii"`;
      // commandString += ` -M"add ${key} Long ${val}"`;
    } else {
      delCommandString += ` -M"del ${key} Ascii"`;
      commandString += ` -M"add ${key} Ascii ${val}"`;
    }
  }
  // On error this just does nothing
  try {
    await exec(`${delCommandString} ${sanitizedPath}`);
    await exec(`${commandString} ${sanitizedPath}`);
  } catch (error) {
    console.error(`${commandString} ${sanitizedPath}`);
    console.error(filePath);
    console.error(error);
    console.error('Failed above failed');
  }
}
async function getExifFromFile(filePath) {
  const sanitizedPath = filePath.replace(/ /gm, '\\ ')
    .replace(/\(/gm, '\\(')
    .replace(/\)/gm, '\\)');
  const commandString = './bin/exiv2';
  // On error this just does nothing
  try {
    const { stdout } = await exec(`${commandString} -PEkv ${sanitizedPath}`);
    const data = {};
    stdout.split('\n').forEach((element) => {
      const key = element.substring(0, element.indexOf(' '));
      const val = element.substring(element.indexOf(' ')).trim();
      if (key && val !== null && val !== '') {
        data[key] = val;
      }
    });
    return data;
  } catch (error) {
    console.error(`${commandString} ${sanitizedPath}`);
    console.error(filePath);
    console.error(error);
    console.error('Failed above failed');
  }
  return null;
}

module.exports = {
  addExifToFile,
  getExifFromFile,
};
