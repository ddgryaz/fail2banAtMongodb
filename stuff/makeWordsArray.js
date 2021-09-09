const PrepareWords = require('PrepareWords')
const settings = require('../settings.js')

const serverName = require('os').hostname();
const makeWordsArray = (ip) => {
  return Object.values(new PrepareWords().fromString(ip).fromString(settings.dbSettings.user).fromString(serverName))[0]
};

module.exports = makeWordsArray
