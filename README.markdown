A Discord Bot for Logging Volunteering Hours at AURA
====================================================

*Inspired from [Jack Barker](https://github.com/Jackbk)'s
[original bot](https://github.com/AucklandRobotics/discord-bots)*


## Commands

```
!logHours <name> <event> <number of hours>
```

Adds a new entry to the Google Sheet. The input arguments are space
separated, and `<number of hours>` needs to be a number without units.

## Reporting Problems

Feel free to report an issue at
https://github.com/ErnWong/aura-volunteers-bot/issues

## Contributing, Modifying the Code and Adding Features

First, clone this repository to your machine.

```sh
git clone https://github.com/ErnWong/aura-volunteers-bot.git
```

Next, create a new branch (appropriately named, such as `fix-typo` or
`add-ai`) from the `master` branch, and checkout this new branch.

```sh
git checkout -b <branch name>
```

Perform the changes you want and commit them to git. We recommend you
name your commit messages using an imperative present tense for
consistency, such as *"Add name validation"* instead of *"This commit
added a feature"*.

```sh
git add <file>
git commit
```

Finally, push your branch to this repository, submit a pull request,
and get someone else to approve the pull request.

```sh
git push
```

Once the pull request is approved and merged into the `master` branch,
your changes will be automatically deployed to the Heroku servers, and
you should see the updated bot in the Discord server within a minute or
two.

### Testing

There are no automated tests for this small program. If you are making
large changes, you may want to test your changes on your own Discord
server first. The next section describes how you could run it locally.

## Setting Up

This program requires the following information to run:

1. a Discord bot token so the bot can login onto our Discord server,
2. a Google Sheet to store the data at, and
3. a Google Service Account so the bot can edit the Google Sheet.

### Prerequisite Software

1. Install NodeJS.
2. Install program dependencies by running `npm install` from the
   repository folder.

### Step 1. Getting the Discord Bot Token

An existing Discord Bot in an existing Discord Application has already
been made for AURA.

1. Go to https://discordapp.com/developers/applications
2. Login to the AURA Admin account.
3. Select the appropriate Discord App.
4. Go to the Bot page from the navigation sidebar.
5. You should now be able to find the bot token.

If you wish to add a new Discord Bot, then 

1. Go to https://discordapp.com/developers/applications
2. Login to the AURA Admin account.
3. Create a new application, and give it an appropriate name.
4. Go to the Bot page from the navigation sidebar.
5. Create a bot.
6. Give it a nice username to the bot.
7. Go to the OAuth2 tab from the navigation sidebar.
8. Under the "URL Generator":
    - Select the "bot" checkbox, after which the "Bot Permissions" panel
      becomes visible.
    - Under Bot Permissions > Text Permissions, select "Send Messages".
9. Navigate to the generated URL to add your new Discord Bot to the server.

### Step 2. Creating a Spreadsheet

The bot will add data in the following format:

| Name                 | Event     | Date                     | Hours |
|----------------------|-----------|--------------------------|-------|
| ExampleMcExampleface | Scrimmage | 2019-03-31T08:44:35.020Z | 2.5   |

Create a Google Sheet per usual, but for this bot to function, it needs
to have the following Named Ranges (go to Data > Named ranges... in
your spreadsheet).

- `hours_table_next`. This is the left-most cell to the next empty
  row. This bot will insert rows above `hours_table_next`.
- `date_hours_table`. This range should indicate the two columns, "Date"
  and "Hours". For example, if the Name heading is at position `A1`,
  then the `date_hours_table` range should be `C:D`.
- `milestones_column`. This is the column that contains the total hours
  where you want the bot to announce a milestone.
- `milestones_start_date`. This is a single cell containing the date
  from which you wish to start counting the total hours for the purpose
  of announcing milestones.

See the spreadsheet for an example of the named ranges.

The ID for your spreadsheet can be found in the URL as the long string of
seemingly arbitrary letters, numbers and symbols. (Left as an exercise
to the reader to figure out).

### Step 3. Creating a Google Service Account

1. Go to https://console.developer.google.com/
2. Login to your AURA account.
3. Create a project, or select an existing project in which you would like
   to manage your bots in.
4. Go to the Libraries page from the navigation sidebar, and add
   "Google Sheets API" to the project.
5. Go back to the Dashboard page, and then go to the Credentials page.
6. Add a Service Account key:
    - Select JSON type.
    - Give it a meaningful name.
    - No roles are needed for this Service Account.
7. Go to your spreadsheet, and share the spreadsheet with the email address
   of this Service Account, in the same way as you would normally share
   a document to another user.

### Running Locally

Just throw the Google Service Account JSON file into this repository folder,
and rename the file as `service-account.json`.

Then create a new file called `config.json` file with the following contents:

```json
{
  "spreadsheetId": "<Add your Google Sheet file id here>",
  "discordBotToken": "<Add your Discord bot token here>"
}
```

Then run `npm run locally` to start the bot. To inspect the code in Chrome
Developer Tools, run `npm run inspect`.

Note: Don't commit these two files as they are your secrets.

### Running on Heroku

1. Create a Heroku account.
2. Create a new Heroku app.
3. In the dashboard for your new app, go to the Settings tab, click 
   reveal config vars, and add the three following environment variables:
   - `DISCORD_BOT_TOKEN`. This is the bot token you got in step 1.
   - `SPREADSHEET_ID`. This is the ID you got in step 2.
   - `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS`. This is the JSON file
     you got in step 3.
4. Now go to the Deploy tab, and under Deployment Method choose GitHub.
5. Enter your GitHub repository name below, and connect to it.
6. Enable Automatic Deploys so that pushing to master branch on GitHub will
   deploy the bot to Heroku.

That should be it. Have fun.
