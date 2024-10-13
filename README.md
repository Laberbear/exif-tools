# Exif Tools

This repository is a collection of the Exif Tools I wrote to manage my photo libraries a bit better.

## Before running any of this, create backups of your photos

I tested these tools on my personal files and all went well, but always be careful when it comes to your precious memories.

## Prerequisites

You need to use Node 20 (best installed using nvm).
Then clone this repository and the install the dependencies with the command:

```
npm ci
```

After that you are ready to get started.

## Current Tools

### Google Maps -> Exif GPS Data

If you took Photos in the past but did not enable Location Data in your Camera app but want it, this might help you.
It analyzes your Google Maps Timeline and if it finds your location for Photos that do not have Exif GPS data yet, it will add it.

The setup for this is a bit more involved due to the sheer amount of data you could get from the Google Maps Takeout.

First get your Google Maps Location History takeout:
https://takeout.google.com/

Location History (Timelime) is what you want.
Deselect all the other options to avoid getting giant export.

After you have received your export, download and extract it.

The data we are interested in is the semantic location history and the raw records.

First you probably have to split up your Records.json file.
Due to limitations in nodejs, each file should not be bigger than 200MBs.
I'd suggest to use a good text editor and just copying/pasting the values in the array into different files.
The outcome files should have the array on a top level. eg. like this

```
[{
  latitudeE7: ...,
  longitudeE7: ...,
  ...
}, {...}, {...}]
```

After that we have to seed this data into an SQLite database, since the JSON format is just too inefficient to use it in the application.

Go to seedDatabase.js and modify the paths provided as parameters in loadRecordFile([...]) to point to all recordsX.json files you have created previously.

Then provide the semantic location history folder path to the findLocationFiles(...) function.

After that we are ready to seed the database!
Run the following commands

```
# Create the Empty SQLite database
npm run migrate-db
# Add the JSON data to the database
npm run seed-migration
```

This should take a while depending on the amount of location data available. (I tested it with 14k Place Visits and 1.5 Million raw location records)

When this script is done, the SQLite database is seeded properly with all your location data and we are ready to infuse your photos from that juicy GPS data.

The steps before you now never need to do again, hurray!

To now process your photos and add the GPS data, open up the index.js file.
At the top of the file, add the paths to your photos to the photoLibs array.
The script will check every image in that folder and add GPS data to it if:

- it's a valid image file
- it already has Exif data with the date the photo was taken
- it does not already have GPS data (unless the GPS data comes from this script for reruns)

Now run the script:

```
node index.js
```

Depending on the amount of images, this might take quite a bit of time.
The script will output current status into your terminal.

After it's done, it will also output a summary of the actions it took.
Please check that to make sure nothing went horribly wrong.

Your photos now have GPS Exif tags in them.

### WhatsApp Images Date Taken

By default WhatsApp strips any Exif Tags from Images that you receive/send.
This might be a good thing for privacy, but if you also backup your WhatsApp images it can lead to the photo showing up at random days (depending on createdAt/modifiedAt timestamps).

So this script will find all the WhatsApp Images (based on naming pattern) in the specified folders.
Then for each it will parse the filename and set the Exif.Photo.DateTime tags to the day you have received/sent this image.
It also looks at the modified date of the file and if it matches the date it will take over the time too.
If the modifie date does not match up with the date parsed from the filename, it will default to 12:00.

Right now it also simply hardcodes +02:00 timezone, so if you use this, be sure to change this to something sensible where you live.

Additionally it adds "WhatsApp" as Exif.Image.Make tag, which usually contains the camera/phone model. To easier identify WhatsApp images in your photo library.

Please Note: The original modified date of the file will not be changed, it will add the Exif Tags and then change the modified date to what it was before.

Examples:

- IMG-20170704-WA0000.jpg
  modified date 01.01.2019 17:45
  => Exif Date: 04.07.2017 12:00

- IMG-20170704-WA0000.jpg
  modified date 04.07.2017 17:45
  => Exif Date: 04.07.2017 17:45

To run the WhatsApp Image tool simply write:

```
node whatsapp.js /PATH/TO/MY/WHATSAPP/FOLDER
```

It should parse all the files in the folder which match the WhatsApp naming pattern and then get going.
