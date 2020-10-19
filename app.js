const Jail = require('fail2ban').Jail
const Fail2Ban = require('fail2ban').Fail2Ban
const settings = require('./settings.js')
const dbConnector = new (require('MinimalMongodb'))(settings.dbSettings)
const serverName = settings.serverName || require('os').hostname()

const f2bSocket = settings.fail2banSocket || '/var/run/fail2ban/fail2ban.sock'
const ourJailName = settings.ourJailName || 'ansServices'

const timeoutPromise = (timeout) => new Promise((resolve) => setTimeout(resolve, timeout))
const fail = new Fail2Ban(f2bSocket)

const banTime = settings.banTime || (60 * 60 * 12) // 12h

const jailNames = (settings.jailNames || ['nginx-botsearch', 'sshd']).concat([ourJailName])
const jailAns = new Jail(ourJailName, f2bSocket)

const initTime = new Date((new Date()).getTime() - (banTime * 1000))
var state = {
  times: {
    ban: initTime,
    unban: initTime
  }
}

var ignoreIp = {}
var unbanIp = {}
var banIp = {}
var mdb = null
var terminate = false

process.on('SIGINT', () => {
  terminate = true
})

async function refreshState () {
  for (var jailIdx = 0; jailIdx < jailNames.length; jailIdx++) {
    const jailName = jailNames[jailIdx]
    const jail = new Jail(jailName, f2bSocket)
    const newStatus = await jail.status

    for (var i = 0; i < newStatus.actions.bannedIPList.length; i++) {
      const ip = newStatus.actions.bannedIPList[i]

      if (jailName !== ourJailName &&
      !state[jailName].actions.bannedIPList.includes(ip)) {
        await mdb.collection('ban').updateOne({
          ip: ip,
          jail: jailName,
          serverName: serverName
        }, {
          $set: {
            ip: ip,
            jail: jailName,
            msg: 'Sync',
            serverName: serverName,
            t: new Date(),
            dbUser: settings.dbSettings.user,
            appDb: settings.dbSettings.db
          }
        }, {
          upsert: true
        })

        const upd = {
          $set: { lastDate: new Date() },
          $min: { sdate: new Date() },
          $inc: {
            cnt: 1
          }
        }
        upd.$inc['servers.' + serverName] = 1
        await mdb.collection('statistics').updateOne({ ip: ip }, upd, { upsert: true })
        console.log('Insert banDoc ip:%s', ip)
      }
    }
    state[jailName] = newStatus
  }
  state[ourJailName].actions.bannedIPList.forEach((ip) => {
    if (!banIp[ip]) {
      unbanIp[ip] = {
        ip: ip,
        t: new Date(),
        reason: 'atStart'
      }
    }
  })
}

async function addDelIgnoreIp (oper, ip) {
  for (var jailIdx = 0; jailIdx < jailNames.length; jailIdx++) {
    const jailName = jailNames[jailIdx]
    const jail = new Jail(jailName, f2bSocket);
    (oper === 'add')
      ? await jail.addIgnoreIp(ip)
      : await jail.delIgnoreIp(ip)
  }
}

var lastIgnoreIpCheckTime = 0
async function refreshDbIgnores () {
  const docs = await mdb.collection('ignore').find({}).toArray()
  const newIgnore = {}
  const ipsList = docs.map((doc) => {
    newIgnore[doc.ip] = doc
    return doc.ip
  })

  for (var ip in ignoreIp) {
    !ipsList.includes(ip) && ipsList.push(ip)
  }

  for (var i = 0; i < ipsList.length; i++) {
    const ip = ipsList[i]
    if (!ignoreIp[ip] && newIgnore[ip]) {
      // new ignoreIp
      await addDelIgnoreIp('add', ip)
      console.log(`Push ignore ip ${ip}`)
    } else if (ignoreIp[ip] && !newIgnore[ip]) {
      await addDelIgnoreIp('del', ip)
      console.log(`Remove ignore ip ${ip}`)
    }
  }
  ignoreIp = newIgnore
  lastIgnoreIpCheckTime = (new Date()).getTime()
}

async function refreshDbBans () {
  const unbanDocs = await mdb.collection('unban').find({
    t: { $gt: state.times.unban }
  }).toArray()
  unbanDocs.forEach((unbanDoc) => {
    unbanIp[unbanDoc.ip] = unbanDoc
    state.times.unban = new Date(
      Math.max(state.times.unban.getTime(), unbanDoc.t.getTime()))
  })

  const banDocs = await mdb.collection('ban').find({
    t: { $gt: state.times.ban },
    serverName: { $ne: serverName }
  }).toArray()
  for (var i = 0; i < banDocs.length; i++) {
    const banDoc = banDocs[i]
    if (unbanIp[banDoc.ip] && unbanIp[banDoc.ip].t.getTime() < banDoc.t.getTime()) delete unbanIp[banDoc.ip]
    banDoc.expireTime = new Date(banDoc.t.getTime() + (banTime * 1000))
    const now = new Date()
    if (!ignoreIp[banDoc.ip] && !unbanIp[banDoc.ip] && now.getTime() < banDoc.expireTime.getTime()) {
      await jailAns.ban(banDoc.ip)
      banIp[banDoc.ip] &&
        banIp[banDoc.ip].timeout &&
        clearTimeout(banIp[banDoc.ip].timeout)
      banIp[banDoc.ip] = banDoc
      const timeoutTimeMs = banDoc.expireTime.getTime() - now.getTime()
      banDoc.timeout = setTimeout((banDoc) => {
        unbanIp[banDoc.ip] = {
          ip: banDoc.ip,
          t: new Date(),
          reason: 'timeout'
        }
        delete banIp[banDoc.ip]
      }, timeoutTimeMs, banDoc)
      banDoc.timeout.unref()
      console.log(`Ban ip:${banDoc.ip} msg:${banDoc.msg} receivedFrom:${banDoc.serverName || banDoc.appDb}`)
    } else if (ignoreIp[banDoc.ip]) {
      console.log(`Skip Ban ip:${banDoc.ip} at ignore list`)
    } else if (unbanIp[banDoc.ip]) {
      console.log(`Skip Ban ip:${banDoc.ip} at unban list`)
    } else {
      console.log(`Skip Ban ip:${banDoc.ip} expireTime<now`)
    }
    // Для выбора новых документов в сл цикле
    state.times.ban = new Date(
      Math.max(state.times.ban.getTime(), banDoc.t.getTime()))
  }

  for (var ip in unbanIp) {
    const unbanDoc = unbanIp[ip]
    delete unbanIp[ip]
    banIp[ip] && banIp[ip].timeout &&
      clearTimeout(banIp[ip].timeout)
    delete banIp[ip]

    for (var jailIdx = 0; jailIdx < jailNames.length; jailIdx++) {
      const jailName = jailNames[jailIdx]
      const jail = new Jail(jailName, f2bSocket)
      await jail.unban(ip)
    }
    console.log(`Unban ip:${ip} ${unbanDoc.reason || unbanDoc.msg}`)
  }
}

(async function () { // Can't use await at the top level
  // await fail.reload();
  var f2bStatus = await fail.status
  // try reload config
  !f2bStatus.list.includes(ourJailName) && await fail.reload()
  if (!f2bStatus.list.includes(ourJailName)) {
    console.log('example jail.d/custom.local')
    const config = require('fs').readFileSync('help/custom.local')
    console.log(config.toString())
    throw new Error('You must configure ' + ourJailName + ' jail for manual blocking')
  }
  for (var jailIdx = 0; jailIdx < jailNames.length; jailIdx++) {
    const jailName = jailNames[jailIdx]
    const jail = new Jail(jailName, f2bSocket)
    // await jail.addAction("iptables-allports");
    jail.banTime = banTime
    await jail.start()
    state[jailName] = {
      actions: {
        bannedIPList: []
      }
    }
  }

  mdb = await dbConnector.connect();

  // Начальное сосотояние initial state
  (await mdb.collection('ban').find({
    serverName: serverName,
    t: { $gte: initTime }
  }).toArray()).forEach((doc) => {
    if (!state[doc.jail]) return
    state[doc.jail].actions.bannedIPList.push(doc.ip)
  })

  // infinity loop
  while (true && !terminate) {
    const now = (new Date()).getTime();
    // Проверить список неблокируемых ip каждые 15 мин
    (now - lastIgnoreIpCheckTime) > (60000 * 15) && await refreshDbIgnores()

    await refreshDbBans() // get ban ip from another server via mongoDb
    // send ban command to fail2ban jail=$ourJailName

    await refreshState() // detect new ban ip and store to mongoDb
    // another servers will read it and block

    await timeoutPromise(settings.loop || 15000)
  }

  await dbConnector.client.close()
})().then(() => {
  console.log('Finish')
  process.exit(0)
}).catch((err) => {
  console.log('Error', err)
  process.exit(4)
})
