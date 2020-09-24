# fail2banAtMongodb

This is nodejs application to synchronize ban list at multiple servers.
Application run as daemon. Application connect to fail2ban via socket.
![Scheme](help/fail2banAtMongodb.svg)

## Install

```bash
npm install fail2banAtMongodb
```

create [settings.js](help/settings.js)
```javascript
module.exports={
  dbSettings:{
      user:'fail2ban',
      pwd:"xxxxx",
      db:'fail2ban',
      replica:{
        name:"ansReplica",
        members:["localhost:37017","localhost:37018"]
      }
  },
  fail2banSocket:'/var/run/fail2ban/fail2ban.sock',
  jailNames:['nginx-botsearch','sshd'],
  banTime:(60*60*12), //12h
  loop:15000,
  ourJailName:'ansServices'
};
```

Create collections and indexes (expire time)
```bash
npm run firstrun
```

run at console (need root access /var/run/fail2ban/fail2ban.sock)
```bash
sudo npm start
```

Show jail status
```
sudo npm run status
```
Status like this:
```
sshd
{
  filter: {
    currentlyFailed: 16,
    totalFailed: 1624,
    fileList: [ '_SYSTEMD_UNIT=sshd.service + _COMM=sshd' ]
  },
  actions: {
    currentlyBanned: 32,
    totalBanned: 334,
    bannedIPList: [
      '37.187.113.229',  '45.148.10.65',
      '51.77.147.5',     '54.38.240.23',
      '79.136.70.159',   '85.209.0.7',
      '119.28.51.97',    '61.189.243.28',
      '49.234.210.179',  '49.235.252.236',
      '185.235.40.133',  '139.59.66.101'
    ]
  }
}
ansServices
{
  filter: {
    currentlyFailed: 16,
    totalFailed: 1564,
    fileList: [ '_SYSTEMD_UNIT=sshd.service + _COMM=sshd' ]
  },
  actions: { currentlyBanned: 0, totalBanned: 256, bannedIPList: [] }
}
```

## Install to system
```
  sudo npm run installHelper
```
helper script creates
/etc/systemd/system/fail2banAtMongodb.service
/etc/fail2ban/jail.d/custom.local


## systemd service
example [/etc/systemd/system/fail2banAtMongodb.service](help/fail2banAtMongodb.service)
```
[Unit]  
Description=fail2banAtMongodb
After=syslog.target network.target

[Service]  
PIDFile=/var/run/fail2banAtMongodb.pid
WorkingDirectory=/srv/fail2banAtMongodb/
ExecStart=node app.js
User=root
Group=root
RestartSec=15
Restart=always

[Install]  
WantedBy=multi-user.target
```
# fail2ban config
example [/etc/fail2ban/jail.d/custom.local](help/custom.local)
```
[sshd]
enabled = true
bantime  = 12h
findtime  = 60m
maxretry = 5

[nginx-botsearch]
enabled = true
bantime  = 12h
findtime  = 60m
maxretry = 5

[ansServices]
enabled = true
filter   = sshd
action   = iptables-allports
logpath  = /var/log/ansServices.log
bantime  = 12h
```
