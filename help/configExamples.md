## systemd service
example [/etc/systemd/system/fail2banAtMongodb.service](help/fail2banAtMongodb.service)
```
[Unit]  
Description=fail2banAtMongodb
After=syslog.target network.target

[Service]  
PIDFile=/var/run/fail2banAtMongodb.pid
WorkingDirectory=/srv/fail2banAtMongodb/
ExecStart=/usr/bin/node app.js
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
#This is a jail for fail2banAtMongodb
#This jail used to receive bans from another servers
#Log file would be empty
#Fail2ban require filter property, to start jail :(
enabled = true
filter   = sshd
action   = iptables-allports
logpath  = /dev/null
backend  = polling
bantime  = 12h
```
