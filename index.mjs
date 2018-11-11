'use strict';

const express = require('express');
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const googleapis = require('googleapis');
const cors = require('cors');

const google = googleapis.google;
admin.initializeApp(functions.config().firebase);
const app = express();
app.use(cors({ origin: true })); // Automatically allow cross-origin requests

const homeCal = 'arg866jdemphj7vs6cfq1m03ms@group.calendar.google.com';
const eventCal = 'qn75cofpf3sqjlp8121tblc1j8@group.calendar.google.com';
const maxDays = 7;

const formatEvent = (event) => {
  return {
    name: event.summary,
    date: event.start.date,
    label: (event.location) ? event.location : '',
    desc: (event.description) ? event.description : '',
  };
};

const getDateString = (date) => {
  const pad = function(num) {
    const norm = Math.floor(Math.abs(num));
    return (norm < 10 ? '0' : '') + norm;
  };
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const getGoogleDateString = (date) => {
  return `${getDateString(date)}T00:00:00Z`;
}

const getEvents = async (calendar, calId) => {
  const today = new Date();
  const maxTime = new Date();
  maxTime.setDate(maxTime.getDate() + maxDays);
  const eventsReq = await calendar.events.list({
    calendarId: calId,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100,
    fields: 'items(description,location,start,summary)',
    timeMin: getGoogleDateString(today),
    timeMax: getGoogleDateString(maxTime),
  });
  const events = [];
  for (const event of eventsReq.data.items) {
    events.push(formatEvent(event));
  }
  return events;
};

const buildBaseSchedule = () => {
  const schedule = {};
  for (let i = 0; i < maxDays; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    schedule[getDateString(date)] = {
      house: '',
      events: [],
    };
  }
  return schedule;
};

const injectHouses = (schedule, houses) => {
  for (const event of houses) {
    if (!schedule.hasOwnProperty(event.date)) continue;
    schedule[event.date].house = event.name
  }
  return schedule;
};

const injectEvents = (schedule, events) => {
  for (const event of events) {
    if (!schedule.hasOwnProperty(event.date)) continue;
    schedule[event.date].events.push(event);
  }
  return schedule;
};

app.get('/health', (req, res) => {
  res.json({ message: "all good" });
});

app.get("/cal", async (req, res) =>  {
  let schedule = buildBaseSchedule();
  const client = await google.auth.getClient({
    keyFile: 'jwt.keys.json',
    scopes: 'https://www.googleapis.com/auth/calendar',
  });
  const calendar = google.calendar({
    version: 'v3',
    auth: client,
  });
  const houses = await getEvents(calendar, homeCal);
  schedule = injectHouses(schedule, houses);
  const events = await getEvents(calendar, eventCal);
  schedule = injectEvents(schedule, events);
  res.json(schedule);
});

//app.listen(3000, () => console.log('Rest API listening on port 3000!'));
exports.jude = functions.https.onRequest(app);
