const startVolunteers = require('./volunteers.js');
const startPermissions = require('./permissions.js');

process.on('unhandledRejection', up => {
  throw up;
});


startVolunteers();
startPermissions();
