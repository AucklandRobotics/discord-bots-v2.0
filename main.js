const startVolunteers = require('./volunteers.js');

process.on('unhandledRejection', up => {
  throw up;
});


startVolunteers();
