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

  const discordClient = new Discord.Client({ ws: { intents: ['GUILD_PRESENCES', 'GUILD_MEMBERS'] }});
  const googleClient = await connectToGoogleSheets();

  discordClient.on('ready', () => {
    console.log(`Logged in as ${discordClient.user.tag}!`);
  });
  
  // Create an event listener for new guild members
  discordClient.on('guildMemberAdd', member => {
    // Send the message to a designated channel on a server:
    console.log('New Member joined the server');
    const channel = discordClient.channels.cache.get('817219700467302461');
    discordClient.channels.fetch('817219700467302461').then(channel => console.log(channel.name)).catch(console.error);
    //console.log("Channel:", discordClient.channels.cache.get('817219700467302461'));
    // Do nothing if the channel wasn't found on this server
    //if (!channel) return;
    //console.log('Able to find welcome channel');
    // Send the message, mentioning the member
    //channel.send(`Welcome to the AURA Discord server, ${member}! To get access to the rest of the server, make sure to Verify your AURA Membership at <#816653958042746960>.`);
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
          const isMember = await getMembership(googleClient, idNumber);
          if (!isMember) {
            message.reply(getRandomFail() +
              'You haven\'t paid your fees! Yell at Sato if you have paid.');
            break;
          }

          const user = message.member;
          await user.setNickname(firstName + ' ' + lastName);
          console.log("Received:", isMember)

          const fullMemberRole = message.guild.roles.cache.find(role => role.name === 'Full Member')
          const associateMemberRole = message.guild.roles.cache.find(role => role.name === 'Associate Member')

          if (isMember === true ){
            await user.roles.remove(associateMemberRole)
            await user.roles.add(fullMemberRole);
          } else if (isMember === 2 ){
            await user.roles.remove(fullMemberRole)
            await user.roles.add(associateMemberRole);
          } else {
            message.reply(getRandomFail() + 'Something went wrong, Yell at Reeve.');
            break;
          }
          
          message.reply(getRandomSuccess());
        }
        catch (error) {
          if (error instanceof Error && error.message === 'NOT REGISTERED') {
            message.reply(getRandomFail() +
              'We don\'t have that student ID in our system. Register at aura.org.nz/signup first. Yell at Reeve if you have already.');
          } else if (error instanceof Error && error.message === 'NOT RECORDED'){
            message.reply(getRandomFail() +
              'Looks like you\'ve signed up but we haven\'t recorded your payment yet. Yell at Sato if you haven\'t already.' );
          } else {
            console.error("Received firstName", firstName, ", lastName", lastName,"and idNumber", idNumber, ". Error updating roles: ", error);
            console.log(message.channel.type, message.member);
            message.reply(getRandomFail() + 'Something went wrong, Yell at Reeve.');
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
  const signupIdList = (await getValues(googleClient,'signupId')).data.values;
  const associateIdList = (await getValues(googleClient, 'associateId')).data.values;
  const paidIndex = idList.findIndex(cell => cell[0] === idNumber);
  const signupIndex = signupIdList.findIndex(cell => cell[0] === idNumber);
  const paidResult = (await getValues(googleClient,'paid')).data.values[paidIndex];
  const isAssociate = associateIdList.findIndex((cell) => cell[0] === idNumber);

  if(signupIndex === -1) {
    throw new Error('NOT REGISTERED');
  }

  var today = new Date();
  var sem2Start = new Date(today.getFullYear(), 6); // Start requiring Sem 2 payments from July.
  
  if (isAssociate !== -1){
    return 2;
  } else{

    if(paidIndex === -1) {
      throw new Error('NOT RECORDED');
    }
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
  'Sorry, Hans. Wrong guess.\n',
  'Uh-oh spaghyeeti-O\'s!\n', // This isn't a Die-Hard reference.
];

function getRandomFail() {
  const index = Math.floor(Math.random() * FAIL.length);
  return FAIL[index];
}
