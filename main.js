const util = require('util');
const fs = require('fs');
const readFile = util.promisify(fs.readFile);

const Discord = require('discord.js');
const { google } = require('googleapis');
const sheets = google.sheets('v4');

process.on('unhandledRejection', up => {
  throw up;
});

init();

async function loadConfig() {
  if (process.argv.includes('--locally')) {
    const configFile = await readFile('./config.json', { encoding: 'utf8' });
    let config;
    try {
      config = JSON.parse(configFile);
    } catch (error) {
      console.error('Error: Could not parse ./config.json...');
      throw error;
    }

    process.env.DISCORD_BOT_TOKEN = config.discordBotToken;
    process.env.SPREADSHEET_ID = config.spreadsheetId;

    process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS =
      await readFile('./service-account.json', { encoding: 'utf8' });
  }

  if (!process.env.DISCORD_BOT_TOKEN) {
    console.error('Error: The DISCORD_BOT_TOKEN environment variable has not');
    console.error('been set. Aborting.');
    process.exit(1);
  }
  if (!process.env.SPREADSHEET_ID) {
    console.error('Error: The SPREADSHEET_ID environment variable has not');
    console.error('been set. Aborting.');
    process.exit(1);
  }
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS) {
    console.error('Error: The GOOGLE_SERVICE_ACCOUNT_CREDENTIALS environment');
    console.error('variable has not been set. Aborting.');
    process.exit(1);
  }
}

async function init() {
  await loadConfig();

  const discordClient = new Discord.Client();
  const googleClient = await connectToGoogleSheets();

  discordClient.on('ready', () => {
    console.log(`Logged in as ${discordClient.user.tag}!`);
  });

  discordClient.on('message', async message => {

    const tokens = message.content.trim().split(/\s+/g);

    switch (tokens[0].toLowerCase()) {
      case '!loghours':
        if (tokens.length === 3) {
            tokens.splice(1, 0, message.author.tag); // 'name' is the Discord 'tag' (e.g. hydrabolt#0001)
        }
      
        if (tokens.length !== 4) {
          message.reply('Sorry, I didn\'t understand you. Please try again?\n' +
            'Here\'s the format I understand:\n' +
            '```\n!logHours <your-name> <description> <hours>\n```');
          break;
        }

        const name = tokens[1];
        const description = tokens[2];
        const hours = tokens[3];

        if (isNaN(hours)) {
          message.reply('I couldn\'t figure out how many hours you did. ' +
            'Please try again?\n');
          break;
        }

        try {
          const prevMilestone = await getCurrentMilestone(googleClient);
          await logHours({ googleClient, name, description, hours });
          const newMilestone = await getCurrentMilestone(googleClient);

          message.reply(getRandomAppreciation());

          // Note: people could enter negative hours to correct their entries.
          if (newMilestone > prevMilestone) {
            message.channel.send('Congratulations, we\'ve now volunteered ' +
              `for more than ${newMilestone} hours!`);
          }
        } catch (error) {
          console.error('Error occured while logging hours:', error);
          message.reply('Could not log hours :( yell at ernest');
        }
        break;

    case '!gethours': {
      if (tokens.length === 1) {
          tokens.splice(1, 0, message.author.tag); // 'name' is the Discord 'tag' (e.g. hydrabolt#0001)
      }
      
      if (tokens.length !== 2) {
          message.reply('Sorry, I didn\'t understand you. Please try again?\n' +
          'Here\'s the format I understand:\n' +
          '```\n!getHours [your-name]\n```');
          break;
      }
      
      const name = tokens[1];
      const totalHours = getTotalHours(googleClient, name);
    }
    }

  });

  discordClient.login(process.env.DISCORD_BOT_TOKEN);
}

async function connectToGoogleSheets() {
  const credentials =
    JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS);

  const googleClient = new google.auth.JWT(
    credentials.client_email,
    null, // No key file.
    credentials.private_key,
    ['https://www.googleapis.com/auth/spreadsheets'],
  );

  return googleClient;
}

async function logHours({ googleClient, name, description, hours }) {
  await sheets.spreadsheets.values.append({
    // Under the authority of our authenticated service account...
    auth: googleClient,

    // ...append a row with the following data...
    resource: {
      values: [
        [name, description, new Date().toISOString(), +hours],
      ],
    },

    // ...to the following spreadsheet...
    spreadsheetId: process.env.SPREADSHEET_ID,

    // ...to the table that is found at the following named range...
    range: 'hours_table_next',

    // ...without parsing formulae...
    valueInputOption: 'RAW',

    // ...without overwriting existing data...
    insertDataOption: 'INSERT_ROWS',
  });
}

const APPRECIATIONS = [
  'Thanks!',
  'Nice!',
  'Sweet!',
];

function getRandomAppreciation() {
  const index = Math.floor(Math.random() * APPRECIATIONS.length);
  return APPRECIATIONS[index];
}

async function getCurrentMilestone(googleClient) {
  const milestoneStartDate = (await sheets.spreadsheets.values.get({
    auth: googleClient,
    range: 'milestones_start_date',
    spreadsheetId: process.env.SPREADSHEET_ID,
  })).data.values[0][0];

  const milestoneStartMillis = Date.parse(milestoneStartDate);

  const dateHoursTable = await sheets.spreadsheets.values.get({
    auth: googleClient,
    range: 'date_hours_table',
    spreadsheetId: process.env.SPREADSHEET_ID,

    // Format numbers such that they can be parsed into numbers.
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  const countedHours = dateHoursTable.data.values.map(([date, hours]) => {
    if (isNaN(hours)) return 0;
    if (Date.parse(date) < milestoneStartMillis) return 0;
    return +hours;
  });

  const totalHours = countedHours.reduce((sum, hour) => (
    sum + hour
  ));

  const milestonesColumn = await sheets.spreadsheets.values.get({
    auth: googleClient,
    range: 'milestones_column',
    spreadsheetId: process.env.SPREADSHEET_ID,
  });

  const milestones = milestonesColumn.data.values.map(row => (
    isNaN(row) ? 0 : +row[0]
  ));

  const bestMilestone = milestones.reduce((best, milestone) => (
    totalHours >= milestone ? milestone : best
  ));

  return bestMilestone;
}

async function getTotalHours(googleClient, user) {
  user = user || "ALL";
  
  const pivotTables = await sheets.spreadsheets.get({
    auth: googleClient,
    fields: "sheets(properties.sheetId, data.rowData.values.pivotTable)",
    spreadsheetId: process.env.SPREADSHEET_ID,
  });
  console.log(JSON.stringify(pivotTables));

  const hiscoresTable = await sheets.spreadsheets.values.get({
    auth: googleClient,
    range: 'date_hours_table',
    spreadsheetId: process.env.SPREADSHEET_ID,

    // Format numbers such that they can be parsed into numbers.
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
}
