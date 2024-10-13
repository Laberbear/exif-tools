const {
  text,
  sqliteTable,
  integer,
  index,
  real,
} = require('drizzle-orm/sqlite-core');

const records = sqliteTable('records', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  lat: integer('lat').notNull(),
  lng: integer('lng').notNull(),
  accuracy: integer('accuracy').notNull(),
  source: text('source').notNull(),
  timestamp: integer('timestamp').notNull(),
}, (table) => ({
  nameIdx: index('timestamp_idx').on(table.timestamp),
}));

const placeVisit = sqliteTable('place_visit', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  lat: integer('lat').notNull(),
  lng: integer('lng').notNull(),
  address: text('address').notNull(),
  name: text('name').notNull(),
  placeId: text('placeId').notNull(),
  locationConfidence: real('location_confidence').notNull(),
  startTimestamp: integer('start_timestamp').notNull(),
  endTimestamp: integer('end_timestamp').notNull(),
}, (table) => ({
  nameIdx: index('place_visit_timestamp_idx').on(table.startTimestamp, table.endTimestamp),
}));

module.exports = {
  records,
  placeVisit,
};
