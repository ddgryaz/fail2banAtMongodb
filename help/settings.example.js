module.exports = {
  dbSettings: {
    user: 'fail2ban',
    pwd: 'xxxx',
    db: 'fail2ban',
    replica: {
      name: 'ansReplica',
      members: ['localhost:37017', 'localhost:37018']
    }
  },
  fail2banSocket: '/var/run/fail2ban/fail2ban.sock',
  // fail2banSocket:'/home/user/fail2ban.sock',
  jailNames: ['nginx-botsearch', 'sshd'],
  banTime: (60 * 60 * 12), // 12h
  loop: 15000,
  ourJailName: 'ansServices'
}
