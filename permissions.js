const util = require('util');
const fs = require('fs');
const readFile = util.promisify(fs.readFile);

const Discord = require('discord.js');
const { google } = require('googleapis');
const sheets = google.sheets('v4');

async function loadConfig() {
  if (process.argv.includes('--locally')) {
    const configFile = await readFile('./config.json', { encoding: 'utf8' });
    let config;
    try {
      config = JSON.parse(configFile).permissionsBot;
    } catch (error) {
      console.error('Error: Could not parse ./config.json...');
      throw error;
    }

    process.env.PERMISSIONS_DISCORD_BOT_TOKEN = config.discordBotToken;
    process.env.PERMISSIONS_SPREADSHEET_ID = config.spreadsheetId;

    process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS =
      await readFile('./service-account.json', { encoding: 'utf8' });
  }

  if (!process.env.PERMISSIONS_DISCORD_BOT_TOKEN) {
    console.error('Error: The PERMISSIONS_DISCORD_BOT_TOKEN environment variable has not');
    console.error('been set. Aborting.');
    process.exit(1);
  }
  if (!process.env.PERMISSIONS_SPREADSHEET_ID) {
    console.error('Error: The PERMISSIONS_SPREADSHEET_ID environment variable has not');
    console.error('been set. Aborting.');
    process.exit(1);
  }
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_CREDENTIALS) {
    console.error('Error: The GOOGLE_SERVICE_ACCOUNT_CREDENTIALS environment');
    console.error('variable has not been set. Aborting.');
    process.exit(1);
  }
}

module.exports = async function startVolunteers() {
  await loadConfig();

  const discordClient = new Discord.Client();
  const googleClient = await connectToGoogleSheets();

  discordClient.on('ready', () => {
    console.log(`Logged in as ${discordClient.user.tag}!`);
  });

  discordClient.on('message', async message => {

    const tokens = message.content.trim().split(/\s+/g);

    switch (tokens[0]) {
      case '!verify':
        if (tokens.length !== 4) {
          message.reply('Sorry, I didn\'t understand you. Please try again?\n' +
            'Here\'s the format I understand:\n' +
            '```\n!verify <first-name> <last-name> <id-number>\n```');
          break;
        }

        const firstName = tokens[1];
        const lastName = tokens[2];
        const idNumber = tokens[3];
        try {
          const isFullMember = await getMembership(googleClient, idNumber);
          if (!isFullMember) {
            message.reply(getRandomFail() +
              ' You haven\'t paid your fees! Yell at Sato if you have paid.');
            break;
          }

          const user = message.member;
          await user.setNickname(firstName + ' ' + lastName);
          await user.addRole(message.guild.roles.find('name', 'Full Member'));
          message.reply(getRandomSuccess());
        }
        catch (error) {
          if (error instanceof Error && error.message === 'NOT REGISTERED') {
            message.reply(getRandomFail() +
              ' Register at aura.org.nz/signup first. Yell at Reeve if you have already.');
          } else {
            console.error("Received FirstName:", firstName, ", lastName:", LastName, "and IdNumber:", idNumber, ".Error updating roles: ", error);
            message.reply(getRandomFail() + ' Something went wrong, Yell at Reeve.');
          }
        }
        break;
    }

  });

  discordClient.login(process.env.PERMISSIONS_DISCORD_BOT_TOKEN);
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

async function getValues(googleClient,rangeName) {
  return sheets.spreadsheets.values.get({
    auth: googleClient,
    range: rangeName,
    spreadsheetId: process.env.PERMISSIONS_SPREADSHEET_ID,
  });
}

async function getMembership(googleClient, idNumber) {
  const idList = (await getValues(googleClient,'id')).data.values;
  const index = idList.findIndex(cell => cell[0] === idNumber);
  const paidResult = (await getValues(googleClient,'paid')).data.values[index];
  if(index === -1) {
    throw new Error('NOT REGISTERED');
  }
  var today = new Date();
  var sem2Start = new Date(today.getFullYear(), 6); // Start requiring Sem 2 payments from July.
  
  if (paidResult[2] === 'Yes'){
    return paidResult[2] === 'Yes'; //Check if member paid for Sem 1 + 2
  } else {    
    if (sem2Start - today > 0) {
      return paidResult[0] === 'Yes'; //Check if member paid for Sem 1
    } else {
      return paidResult[1] === 'Yes'; //Check if member paid for Sem 2
    }
  }
}

const SUCCESS = [
  'Welcome to the party pal!',
  'Yippie-Ki-Yay, Motherf***r!',
  'Happy trails, Hans.',
  'Now I Have A Machine Gun. Ho Ho Ho',
];

function getRandomSuccess() {
  const index = Math.floor(Math.random() * SUCCESS.length);
  return SUCCESS[index];
}
const FAIL = [
  'Sorry, Hans. Wrong guess.',
  'Uh-oh spaghyeeti-O\'s!', // This isn't a Die-Hard reference.
];

function getRandomFail() {
  const index = Math.floor(Math.random() * FAIL.length);
  return FAIL[index];
}
