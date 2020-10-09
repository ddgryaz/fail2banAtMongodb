const Jail = require('fail2ban').Jail
const Fail2Ban = require('fail2ban').Fail2Ban
const settings = require('../settings.js')
const dbConnector = new (require('MinimalMongodb'))(settings.dbSettings)

const f2bSocket = settings.fail2banSocket || '/var/run/fail2ban/fail2ban.sock'
const ourJailName = settings.ourJailName || 'ansServices'

const timeoutPromise = (timeout) => new Promise((resolve) => setTimeout(resolve, timeout))
const jailNames = (settings.jailNames || ['nginx-botsearch', 'sshd']).concat([ourJailName])
const fail = new Fail2Ban(f2bSocket);

(async function () { // Can't use await at the top level
  console.log('Fail2Ban status')
  console.dir(await fail.status)
  const mdb = await dbConnector.connect()
  const cmd = process.argv[2]
  // console.log("cmd",cmd,'ip:',ip);
  const ip = process.argv[3] || '10.152.64.98'
  if (cmd === 'ban') {
    console.log('ban', ip)
    await mdb.collection('ban').insertOne({
      ip: ip,
      t: new Date(),
      msg: 'tst',
      serverName: 'TestApp'
    })
  } else if (cmd === 'unban') {
    console.log('Unban', ip)
    await mdb.collection('unban').insertOne({
      ip: ip,
      t: new Date(),
      reason: 'Test manual'
    })
  }

  await timeoutPromise(1000)
  for (var jailIdx = 0; jailIdx < jailNames.length; jailIdx++) {
    const jailName = jailNames[jailIdx]
    const jail = new Jail(jailName, f2bSocket)
    console.log(jailName)
    /* console.log(await jail.actions);
    jailName=="ansServices" && await jail.addAction("iptables-allports");
    console.log("actions",await jail.actions);
    console.log("actionBan iptables-multiport",await jail.action('iptables-multiport').actionBan);
    console.log("actionBan actionProperties",await jail.action('iptables-multiport').actionProperties);
    console.log("actionBan iptables-allports",await jail.action('iptables-allports').actionBan); */

    console.log(await jail.status)
  }

  await dbConnector.client.close()
})().then(() => {
//  server.close(()=>{
  console.log('Finish')
//  });
}).catch((err) => {
  console.log('Error', err)
})
